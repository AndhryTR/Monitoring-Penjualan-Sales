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

-- tambahkan kolom role kalau profil sudah ada tanpa role (migrasi)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role') then
    alter table public.profiles add column role text not null default 'user';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2) TABEL MASTER DATA (dataset transaksi global per depot; 1 baris/transaksi)
--    RLS: SEMUA user terautentikasi boleh SELECT; hanya admin/supervisor
--         boleh INSERT/DELETE (via helper is_editor di bawah).
-- ----------------------------------------------------------------------------
create table if not exists public.master_sales (
  id bigserial primary key,
  date text not null,
  sales_code text,
  outlet_code text,
  invoice_no text,
  product_code text,
  group_name text,
  qty numeric,
  value numeric,
  unit text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz default now()
);
create index if not exists idx_master_sales_date on public.master_sales (date);
create index if not exists idx_master_sales_sales on public.master_sales (sales_code);
create index if not exists idx_master_sales_inv on public.master_sales (invoice_no);

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
