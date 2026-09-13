-- =============================================================================
-- FILE: setup_permissions.sql
-- PROJECT: Monitoring Penjualan Sales
-- FASE: 1 — Database & SQL Migration (Superuser Admin Dashboard)
-- DESCRIPTION: Idempotent setup script. Aman dijalankan berulang kali.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Tambah constraint peran 'superuser' ke public.profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- Hapus constraint lama jika ada, lalu buat ulang dengan daftar role baru
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'supervisor', 'admin', 'superuser'));


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Fungsi helper is_superuser() & update trigger prevent_role_change()
-- ─────────────────────────────────────────────────────────────────────────────

-- Mengembalikan TRUE jika user yang sedang login memiliki role 'superuser'
CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = auth.uid()
          AND role = 'superuser'
    );
$$;

-- Hapus trigger lama yang memblokir perubahan role secara membabi-buta
DROP FUNCTION IF EXISTS public.prevent_role_change() CASCADE;

-- Buat ulang fungsi prevent_role_change yang aman:
-- Mengizinkan perubahan role jika dilakukan via SQL Editor (auth.uid() is null)
-- atau jika pemanggil adalah superuser, namun tetap melarang user biasa mengedit role-nya sendiri.
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
        RETURN NEW;
    END IF;

    -- Izinkan jika dieksekusi di SQL Editor (direct SQL / service_role)
    IF auth.uid() IS NULL OR coalesce(auth.role(), '') = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Izinkan jika pengguna yang login adalah superuser
    IF public.is_superuser() THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Perubahan role tidak diizinkan kecuali oleh superuser';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Tabel public.app_feature_permissions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_feature_permissions (
    permission_id    text        PRIMARY KEY,
    category         text        NOT NULL,
    name             text        NOT NULL,
    description      text,
    allow_offline    boolean     NOT NULL DEFAULT false,
    allow_user       boolean     NOT NULL DEFAULT false,
    allow_supervisor boolean     NOT NULL DEFAULT true,
    allow_admin      boolean     NOT NULL DEFAULT true,
    updated_at       timestamptz          DEFAULT now(),
    updated_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.app_feature_permissions IS
    'Matriks izin fitur per kategori role. Dikelola oleh superuser.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Tabel public.user_permission_overrides
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id            bigserial   PRIMARY KEY,
    user_id       uuid        NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    permission_id text        NOT NULL REFERENCES public.app_feature_permissions(permission_id) ON DELETE CASCADE,
    is_granted    boolean     NOT NULL,
    reason        text,
    granted_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now(),
    CONSTRAINT uq_user_permission UNIQUE (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_perm_uid
    ON public.user_permission_overrides (user_id);

COMMENT ON TABLE public.user_permission_overrides IS
    'Override izin per-user yang mengabaikan matriks role default.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Tabel public.permission_audit_logs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
    id          bigserial   PRIMARY KEY,
    changed_at  timestamptz DEFAULT now(),
    changed_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    target_type text        NOT NULL,
    target_id   text        NOT NULL,
    old_value   jsonb,
    new_value   jsonb,
    note        text
);

COMMENT ON TABLE public.permission_audit_logs IS
    'Log audit setiap perubahan permission dan role yang dilakukan superuser.';


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: Row Level Security (RLS) dan Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 6a. public.app_feature_permissions
ALTER TABLE public.app_feature_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_feature_permissions select all"    ON public.app_feature_permissions;
CREATE POLICY "app_feature_permissions select all"
    ON public.app_feature_permissions
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "app_feature_permissions all superuser" ON public.app_feature_permissions;
CREATE POLICY "app_feature_permissions all superuser"
    ON public.app_feature_permissions
    FOR ALL
    USING (public.is_superuser())
    WITH CHECK (public.is_superuser());

-- 6b. public.user_permission_overrides
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_perm_overrides select"       ON public.user_permission_overrides;
CREATE POLICY "user_perm_overrides select"
    ON public.user_permission_overrides
    FOR SELECT
    USING (auth.uid() = user_id OR public.is_superuser());

DROP POLICY IF EXISTS "user_perm_overrides all superuser" ON public.user_permission_overrides;
CREATE POLICY "user_perm_overrides all superuser"
    ON public.user_permission_overrides
    FOR ALL
    USING (public.is_superuser())
    WITH CHECK (public.is_superuser());

-- 6c. public.permission_audit_logs
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs all superuser" ON public.permission_audit_logs;
CREATE POLICY "audit_logs all superuser"
    ON public.permission_audit_logs
    FOR ALL
    USING (public.is_superuser())
    WITH CHECK (public.is_superuser());

-- 6d. public.profiles — tambah policy UPDATE untuk superuser
--     Policy lama untuk user update diri sendiri TIDAK dihapus.
DROP POLICY IF EXISTS "profiles update superuser" ON public.profiles;
CREATE POLICY "profiles update superuser"
    ON public.profiles
    FOR UPDATE
    USING (public.is_superuser())
    WITH CHECK (public.is_superuser());

-- 6e. public.profiles — tambah policy SELECT untuk superuser
DROP POLICY IF EXISTS "profiles select superuser" ON public.profiles;
CREATE POLICY "profiles select superuser"
    ON public.profiles
    FOR SELECT
    USING (public.is_superuser());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: RPC Functions
-- ─────────────────────────────────────────────────────────────────────────────

-- 7a. Ambil seluruh daftar pengguna lengkap dengan email (khusus superuser)
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
    user_id  uuid,
    username text,
    role     text,
    email    text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_superuser() THEN
        RAISE EXCEPTION 'Hanya superuser yang berhak melihat daftar pengguna';
    END IF;

    RETURN QUERY
    SELECT 
        p.user_id,
        p.username,
        p.role,
        u.email::text
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    ORDER BY p.username ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_all_users_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_user_role(
    p_user_id uuid,
    p_role    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_role text;
BEGIN
    -- Validasi: pemanggil harus superuser
    IF NOT public.is_superuser() THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Hanya superuser yang dapat mengubah role user.');
    END IF;

    -- Validasi: role target harus valid
    IF p_role NOT IN ('user', 'supervisor', 'admin', 'superuser') THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Role tidak valid. Pilihan: user, supervisor, admin, superuser.');
    END IF;

    -- Anti self-lockout: tidak boleh mengubah role diri sendiri
    IF p_user_id = auth.uid() THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'Superuser tidak dapat mengubah role dirinya sendiri.');
    END IF;

    -- Ambil role lama untuk audit log
    SELECT role INTO v_old_role
    FROM public.profiles
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'User tidak ditemukan.');
    END IF;

    -- Update role
    UPDATE public.profiles
    SET role = p_role
    WHERE user_id = p_user_id;

    -- Catat ke audit log
    INSERT INTO public.permission_audit_logs
        (changed_by, target_type, target_id, old_value, new_value, note)
    VALUES (
        auth.uid(),
        'role_change',
        p_user_id::text,
        jsonb_build_object('role', v_old_role),
        jsonb_build_object('role', p_role),
        'Role diubah via RPC update_user_role'
    );

    RETURN jsonb_build_object('ok', true, 'role', p_role);
END;
$$;

-- Berikan hak eksekusi kepada semua user yang sudah login
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: Seed Data — public.app_feature_permissions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.app_feature_permissions
    (permission_id, category, name, allow_offline, allow_user, allow_supervisor, allow_admin)
VALUES
    ('page:executive',       'page',    'Executive Summary',              true,  true,  true,  true ),
    ('page:main',            'page',    'Main Report',                    true,  true,  true,  true ),
    ('page:sales',           'page',    'Sales Report',                   true,  true,  true,  true ),
    ('page:product',         'page',    'Product Report',                 true,  true,  true,  true ),
    ('page:focus',           'page',    'Product Focus',                  false, true,  true,  true ),
    ('page:outlet',          'page',    'Analisis Outlet',                false, true,  true,  true ),
    ('page:trend',           'page',    'Tren Periode',                   false, true,  true,  true ),
    ('page:compare',         'page',    'Perbandingan',                   false, true,  true,  true ),
    ('page:transactions',    'page',    'Transaksi Mentah',               false, false, true,  true ),
    ('page:stock',           'page',    'Stok Barang',                    false, false, true,  true ),
    ('page:quality',         'page',    'Catatan Kualitas Data',          false, false, true,  true ),
    ('feat:upload_excel',    'feature', 'Upload File Penjualan',          true,  true,  true,  true ),
    ('feat:sample_data',     'feature', 'Muat Data Demo',                 true,  false, false, false),
    ('feat:slideshow',       'feature', 'Mode Pajangan',                  true,  true,  true,  true ),
    ('feat:global_search',   'feature', 'Pencarian Cepat',                true,  true,  true,  true ),
    ('feat:smart_alerts',    'feature', 'Smart Alerts Anomali',           true,  true,  true,  true ),
    ('feat:daily_report',    'feature', 'Generator Laporan Harian',       false, true,  true,  true ),
    ('feat:history_snap',    'feature', 'Riwayat & Snapshot Periode',     false, true,  true,  true ),
    ('feat:depot_switch',    'feature', 'Ganti / Tambah Depo',            false, false, true,  true ),
    ('feat:stock_reconcile', 'feature', 'Impor & Rekonsiliasi Stok',      false, false, false, true ),
    ('feat:visit_schedule',  'feature', 'Atur Jadwal Kunjungan',          false, false, true,  true ),
    ('btn:export_excel',     'button',  'Export Laporan Excel',           false, false, true,  true ),
    ('btn:export_pdf',       'button',  'Export Laporan PDF',             false, true,  true,  true ),
    ('btn:export_image',     'button',  'Export Gambar / Chart',          true,  true,  true,  true ),
    ('btn:edit_targets',     'button',  'Ubah Target Penjualan',          false, false, false, true ),
    ('btn:save_master',      'button',  'Simpan Master ke Cloud',         false, false, true,  true ),
    ('btn:delete_master',    'button',  'Hapus Rentang Master Data',      false, false, false, true ),
    ('btn:drilldown_outlet', 'button',  'Buka Detail Drilldown Outlet',   true,  true,  true,  true ),
    ('btn:clear_all',        'button',  'Hapus Semua Data Lokal',         true,  true,  true,  true )
ON CONFLICT (permission_id) DO NOTHING;

-- =============================================================================
-- END OF FILE: setup_permissions.sql
-- =============================================================================
