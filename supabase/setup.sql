-- ============================================================================
-- MONITORING PENJUALAN — Sinkronisasi lintas perangkat (ARSITEKTUR PERAN)
-- Jalankan SEMUA blok ini sekali di SQL Editor dashboard Supabase Anda
-- (https://supabase.com/dashboard/project/yykrlapoodqjeuwjrssw/sql/new)
-- Aman dijalankan ulang (pakai CREATE OR REPLACE / IF NOT EXISTS).
--
-- Skema ini menggantikan desain lama (sales_data per-user) dengan:
--   profiles    -> per-user (target, pengaturan, + kolom `role`)
--   master_sales-> dataset transaksi GLOBAL per depot (1 baris = 1 transaksi)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) PROFIL USER (per-user; + kolom `role`)
--    role: 'user' (default) | 'supervisor' | 'admin' — di-set MANUAL di DB
--    (Table Editor / SQL). Tidak ada UI untuk mengubah role.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  role text not null default 'user',
  targets jsonb,
  work_days jsonb,
  depot_name text,
  theme text,
  projection_method text,
  sidebar_collapsed boolean,
  updated_at bigint,
  updated_by text
);

-- ----------------------------------------------------------------------------
-- 2) TABEL MASTER DATA (dataset transaksi global per depot; 1 baris/transaksi)
--    RLS: SEMUA user terautentikasi boleh SELECT; hanya admin/supervisor
--         boleh INSERT/DELETE (via helper is_editor di bawah).
-- ----------------------------------------------------------------------------
create table if not exists public.master_sales (
  id bigserial primary key,
  date text not null,
  sales_code text,
  sales_name text,
  outlet_code text,
  outlet_name text,
  invoice_no text,
  product_code text,
  product_name text,
  group_name text,
  qty numeric,
  qty_karton numeric,
  unconvertible boolean,
  value numeric,
  unit text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz default now(),
  constraint uq_master_sales_unique
    unique (date, invoice_no, product_code, sales_code, outlet_code)
);
create index if not exists idx_master_sales_date on public.master_sales (date);
create index if not exists idx_master_sales_sales on public.master_sales (sales_code);
create index if not exists idx_master_sales_inv on public.master_sales (invoice_no);

-- Index pendukung untuk query by outlet_code & uploaded_by (audit + aggregasi).
create index if not exists idx_master_sales_outlet on public.master_sales (outlet_code);
create index if not exists idx_master_sales_uploaded_by on public.master_sales (uploaded_by);
-- ⚠️ Sprint 5 / S7: index uploaded_at untuk query "what changed since X
-- timestamp" (audit log, debug sync conflict). Sebelumnya hanya uploaded_by
-- yang di-index — query ORDER BY uploaded_at / WHERE uploaded_at > X
-- menyebabkan full scan di tabel besar.
create index if not exists idx_master_sales_uploaded_at on public.master_sales (uploaded_at);

-- ----------------------------------------------------------------------------
-- 3) TRIGGER PROFIL OTOMATIS SAAT REGISTRASI (role default 'user')
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, lower(coalesce(new.raw_user_meta_data ->> 'username', '')))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4) RESOLVE USERNAME -> EMAIL (untuk login satu field auto-detect)
--
-- ⚠️  PERINGATAN KEAMANAN:
-- Fungsi ini membaca `auth.users.email` dan harus dipanggil oleh anon (pre-login,
-- saat user belum punya sesi). Karena `auth.users` tidak tunduk pada RLS, fungsi
-- wajib SECURITY DEFINER. Konsekuensinya: siapa pun dengan anon key publik
-- dapat menebak username untuk memetakan daftar email user.
--
-- Mitigasi yang DIREKOMENDASIKAN (belum diimplementasikan di sini):
--   1. Pindahkan lookup sign-in ke Edge Function yang memvalidasi reCAPTCHA /
--      Cloudflare Turnstile sebelum memanggil fungsi ini, dan terapkan rate
--      limit per IP (mis. 5 percobaan / 5 menit).
--   2. Atau ganti mekanisme login dari "username → email" menjadi login
--      langsung dengan username via custom RPC yang return access_token (bukan
--      email), sehingga email tidak pernah diekspos.
--   3. Pantau akses anomali (banyak panggilan per IP) via Supabase Logs.
--
-- Sementara fungsi tetap ada, JANGAN ekspos anon key publik di tempat yang
-- tidak aman, dan pertimbangkan mengganti alur login.
-- ----------------------------------------------------------------------------
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select u.email
  from auth.users u
  where lower(u.raw_user_meta_data ->> 'username') = lower(p_username)
  limit 1;
$$;

-- Best-effort: REVOKE dari role yang tidak butuh, GRANT hanya ke anon
-- (karena fungsi dipanggil pre-login). Pastikan tidak ada role lain yang
-- tidak perlu mendapat EXECUTE.
revoke execute on function public.get_email_by_username(text) from authenticated;
revoke execute on function public.get_email_by_username(text) from service_role;
grant execute on function public.get_email_by_username(text) to anon;

-- ----------------------------------------------------------------------------
-- 5) HELPER ROLE: apakah user saat ini boleh mengedit master (admin/supervisor)
-- ----------------------------------------------------------------------------
create or replace function public.is_editor()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((
    select role in ('admin','supervisor')
    from public.profiles
    where user_id = auth.uid()
  ), false);
$$;

-- Ganti seluruh snapshot transaksi pada tanggal yang ada di file koreksi.
-- Satu pemanggilan RPC adalah satu transaksi PostgreSQL: jika insert gagal,
-- penghapusan data lama otomatis dibatalkan.
create or replace function public.replace_master_sales_dates(p_rows jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_dates text[];
  v_deleted integer;
  v_inserted integer;
begin
  if not public.is_editor() then
    raise exception 'Hanya admin atau supervisor yang dapat mengganti master data';
  end if;

  select array_agg(distinct row_data->>'date')
  into v_dates
  from jsonb_array_elements(p_rows) row_data
  where coalesce(row_data->>'date', '') <> '';

  if coalesce(array_length(v_dates, 1), 0) = 0 then
    raise exception 'File koreksi tidak memiliki tanggal valid';
  end if;

  delete from public.master_sales where date = any(v_dates);
  get diagnostics v_deleted = row_count;

  insert into public.master_sales (
    date, sales_code, sales_name, outlet_code, outlet_name, invoice_no,
    product_code, product_name, group_name, qty, qty_karton, unconvertible,
    value, unit, uploaded_by
  )
  select
    r.date, r.sales_code, r.sales_name, r.outlet_code, r.outlet_name, r.invoice_no,
    r.product_code, r.product_name, r.group_name, r.qty, r.qty_karton, r.unconvertible,
    r.value, r.unit, auth.uid()
  from jsonb_to_recordset(p_rows) as r(
    date text, sales_code text, sales_name text, outlet_code text, outlet_name text,
    invoice_no text, product_code text, product_name text, group_name text,
    qty numeric, qty_karton numeric, unconvertible boolean, value numeric, unit text
  )
  where r.date = any(v_dates)
  on conflict (date, invoice_no, product_code, sales_code, outlet_code) do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted);
end;
$$;
revoke all on function public.replace_master_sales_dates(jsonb) from public;
grant execute on function public.replace_master_sales_dates(jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 6) ROW LEVEL SECURITY
--    profiles    : user hanya SELECT/UPDATE baris miliknya sendiri
--    master_sales: semua user login SELECT; hanya editor INSERT/DELETE
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.master_sales enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = user_id);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = user_id);

-- master_sales: semua user login boleh baca
drop policy if exists "master_sales select authed" on public.master_sales;
create policy "master_sales select authed" on public.master_sales
  for select using (auth.role() = 'authenticated');
-- hanya admin/supervisor boleh insert
drop policy if exists "master_sales insert editor" on public.master_sales;
create policy "master_sales insert editor" on public.master_sales
  for insert with check (auth.role() = 'authenticated' and public.is_editor());
-- hanya admin/supervisor boleh delete (hapus rentang / reset)
drop policy if exists "master_sales delete editor" on public.master_sales;
create policy "master_sales delete editor" on public.master_sales
  for delete using (auth.role() = 'authenticated' and public.is_editor());

-- ----------------------------------------------------------------------------
-- 7) CONTOH SET ROLE MANUAL (jalankan di SQL Editor):
--    update public.profiles set role = 'admin' where username = 'nama_username';
--    update public.profiles set role = 'supervisor' where username = 'nama';
-- ----------------------------------------------------------------------------
