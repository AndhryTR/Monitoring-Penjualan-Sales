-- ============================================================================
-- MONITORING PENJUALAN — Sinkronisasi lintas perangkat
-- Jalankan SEMUA blok ini sekali di SQL Editor dashboard Supabase Anda
-- (https://supabase.com/dashboard/project/yykrlapoodqjeuwjrssw/sql/new)
-- Aman dijalankan ulang (pakai CREATE OR REPLACE / IF NOT EXISTS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) TABEL PROFIL USER
-- Satu baris per user. Kolom jsonb `targets` menyimpan seluruh konfigurasi
-- target (struktur sama persis dengan yang disimpan di localStorage).
-- updated_at = timestamp sinkronisasi terakhir, updated_by = device id.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
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
-- 2) TABEL DATA PENJUALAN (rawRows hasil upload, bisa ribuan baris)
-- ----------------------------------------------------------------------------
create table if not exists public.sales_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  file_name text,
  parse_meta jsonb,
  raw_rows jsonb,
  updated_at bigint,
  updated_by text
);

-- ----------------------------------------------------------------------------
-- 3) TABEL RIWAYAT SNAPSHOT PERIODE
-- ----------------------------------------------------------------------------
create table if not exists public.history (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entries jsonb,
  updated_at bigint,
  updated_by text
);

-- ----------------------------------------------------------------------------
-- 4) PROFIL OTOMATIS SAAT REGISTRASI
-- Trigger: tiap baris auth.users dibuat -> buat baris profiles dengan username
-- dari user_metadata (dikirim app saat signUp). Kalau username sudah dipakai,
-- insert GAGAL -> signUp() ikut gagal (Supabase balikkan error).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', ''))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5) RESOLVE USERNAME -> EMAIL (untuk login satu field auto-detect)
-- SECURITY DEFINER: dipanggil dari sisi klien (anon). Hanya membalas EMAIL
-- kalau username persis cocok (case-insensitive). Tidak membocorkan data lain.
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
-- 6) ROW LEVEL SECURITY — isolasi data antar user
-- User hanya bisa SELECT / UPSERT baris miliknya sendiri (auth.uid()).
-- Tanpa RLS ini, anon key bisa membaca SEMUA data user lain.
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sales_data enable row level security;
alter table public.history enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles upsert own" on public.profiles;
create policy "profiles upsert own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = user_id);

drop policy if exists "sales_data select own" on public.sales_data;
create policy "sales_data select own" on public.sales_data
  for select using (auth.uid() = user_id);

drop policy if exists "sales_data upsert own" on public.sales_data;
create policy "sales_data insert own" on public.sales_data
  for insert with check (auth.uid() = user_id);
create policy "sales_data update own" on public.sales_data
  for update using (auth.uid() = user_id);

drop policy if exists "history select own" on public.history;
create policy "history select own" on public.history
  for select using (auth.uid() = user_id);

drop policy if exists "history upsert own" on public.history;
create policy "history insert own" on public.history
  for insert with check (auth.uid() = user_id);
create policy "history update own" on public.history
  for update using (auth.uid() = user_id);

-- ============================================================================
-- SELESAI. Setelah ini buka app -> ikon akun di header -> Daftar akun baru.
-- ============================================================================
