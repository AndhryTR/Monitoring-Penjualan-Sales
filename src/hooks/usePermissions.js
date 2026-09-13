/* ============================================================================
   usePermissions — hook manajemen permission matrix untuk Superuser Dashboard.

   Aliran data:
   1. Saat mount, baca cache dari localStorage:
      - `smapp:permissions_matrix`  → matrix global (semua permission × role)
      - `smapp:user_overrides`      → override per-akun untuk user login saat ini
   2. Bila Supabase tersedia + ada sessionUser, fetch ke cloud:
      - `app_feature_permissions`   → matrix global (overwrite cache)
      - `user_permission_overrides` → override akun ini (overwrite cache)
   3. `canAccess(permissionId, simulateRole?)` mengevaluasi akses berdasarkan:
      - simulasi role (jika superuser sedang test)
      - role superuser → selalu true
      - override akun spesifik → ikut nilai override
      - matrix berdasarkan role → ikut kolom allow_admin/supervisor/user
      - offline (tidak login) → ikut kolom allow_offline

   API yang di-expose:
   - matrix           : state matrix dari Supabase / cache / fallback
   - overrides        : state override untuk user login ini
   - isSuperuser      : boolean, true jika userRole === 'superuser'
   - simulateRole     : string | null, role yang sedang disimulasikan
   - setSimulateRole  : setter untuk simulasi role
   - canAccess(id, simulateRole?) : fn → boolean
   - refreshMatrix()  : paksa sync ulang dari Supabase
   - updateMatrixRow(permissionId, updates) : upsert baris ke Supabase + state lokal
   - updateUserOverride(targetUserId, permissionId, isGranted, reason) : upsert override
   - removeUserOverride(targetUserId, permissionId) : hapus override
============================================================================ */
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../utils/cloud.js";
import { DEFAULT_PERMISSIONS_FALLBACK, PERMISSION_CATALOG } from "../constants/permissions.js";

const CATALOG_MAP = Object.fromEntries((PERMISSION_CATALOG || []).map((p) => [p.id, p]));

/* ── localStorage keys ────────────────────────────────────────────────────── */
const LS_MATRIX_KEY = "smapp:permissions_matrix";
const LS_OVERRIDES_KEY = "smapp:user_overrides";

/* ── helpers: baca/tulis localStorage dengan silent try-catch ─────────────── */

/**
 * Baca JSON dari localStorage. Return null jika tidak ada atau parse error.
 * @param {string} key
 * @returns {any|null}
 */
function lsGet(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Tulis nilai ke localStorage sebagai JSON. Silent error.
 * @param {string} key
 * @param {any} value
 */
function lsSet(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage full atau private mode — abaikan */
  }
}

/* ── normalisasi baris Supabase ───────────────────────────────────────────── */

/**
 * Ubah array baris dari `app_feature_permissions` Supabase menjadi
 * map { [permission_id]: { allow_offline, allow_user, allow_supervisor, allow_admin } }.
 * @param {Array<Object>} rows
 * @returns {Record<string, Object>}
 */
function normalizeMatrix(rows) {
  if (!Array.isArray(rows)) return {};
  return Object.fromEntries(
    rows.map((r) => [
      r.permission_id,
      {
        allow_offline: Boolean(r.allow_offline),
        allow_user: Boolean(r.allow_user),
        allow_supervisor: Boolean(r.allow_supervisor),
        allow_admin: Boolean(r.allow_admin),
        category: r.category,
        name: r.name,
        description: r.description,
      },
    ])
  );
}

/**
 * Ubah array baris dari `user_permission_overrides` Supabase menjadi
 * map { [permission_id]: { is_granted, reason } }.
 * @param {Array<Object>} rows
 * @returns {Record<string, Object>}
 */
function normalizeOverrides(rows) {
  if (!Array.isArray(rows)) return {};
  return Object.fromEntries(
    rows.map((r) => [
      r.permission_id,
      {
        is_granted: Boolean(r.is_granted),
        reason: r.reason || null,
      },
    ])
  );
}

/* ============================================================================
   Hook utama
============================================================================ */

/**
 * `usePermissions` — hook manajemen matrix permission + override per-user.
 *
 * @param {Object} params
 * @param {string|null} params.userRole   - Role user yang sedang login ('user'|'supervisor'|'admin'|'superuser'|null)
 * @param {Object|null} params.sessionUser - Objek user dari Supabase auth ({ id, email, ... }) atau null jika offline
 * @returns {Object} API lengkap (lihat JSDoc di bawah)
 */
export function usePermissions({ userRole = null, sessionUser = null } = {}) {
  /* ── State: matrix permission global (dari Supabase / cache / fallback) ─── */
  const [matrix, setMatrix] = useState(() => {
    const cached = lsGet(LS_MATRIX_KEY);
    // Gunakan fallback jika cache kosong / null
    return (cached && Object.keys(cached).length > 0)
      ? cached
      : DEFAULT_PERMISSIONS_FALLBACK;
  });

  /* ── State: override per-akun untuk user login saat ini ─────────────────── */
  const [overrides, setOverrides] = useState(() => lsGet(LS_OVERRIDES_KEY) || {});

  /* ── State: role yang sedang disimulasikan oleh superuser ───────────────── */
  const [simulateRole, setSimulateRole] = useState(null);

  /* ── Derived: apakah user saat ini adalah superuser ─────────────────────── */
  const isSuperuser = useMemo(() => userRole === "superuser", [userRole]);

  /* ── fetchMatrix: ambil matrix global dari Supabase ─────────────────────── */
  const fetchMatrix = useCallback(async () => {
    if (!supabase) return; // offline / tidak dikonfigurasi
    try {
      const { data, error } = await supabase
        .from("app_feature_permissions")
        .select("*");
      if (error) {
        console.warn("[usePermissions] fetchMatrix error:", error.message);
        return;
      }
      if (data && data.length > 0) {
        const normalized = normalizeMatrix(data);
        setMatrix(normalized);
        lsSet(LS_MATRIX_KEY, normalized);
      }
    } catch (e) {
      console.warn("[usePermissions] fetchMatrix exception:", e.message);
    }
  }, []);

  /* ── fetchOverrides: ambil override untuk user yang sedang login ─────────── */
  const fetchOverrides = useCallback(async (userId) => {
    if (!supabase || !userId) return;
    try {
      const { data, error } = await supabase
        .from("user_permission_overrides")
        .select("*")
        .eq("user_id", userId);
      if (error) {
        console.warn("[usePermissions] fetchOverrides error:", error.message);
        return;
      }
      const normalized = normalizeOverrides(data || []);
      setOverrides(normalized);
      lsSet(LS_OVERRIDES_KEY, normalized);
    } catch (e) {
      console.warn("[usePermissions] fetchOverrides exception:", e.message);
    }
  }, []);

  /* ── Effect 1: fetch matrix global saat aplikasi dibuka (termasuk tamu) ─── */
  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  /* ── Effect 2: fetch override akun khusus saat user login ────────────────── */
  useEffect(() => {
    if (!sessionUser?.id) {
      setOverrides({});
      return;
    }
    fetchOverrides(sessionUser.id);
  }, [sessionUser?.id, fetchOverrides]);

  /* ── refreshMatrix: API publik untuk trigger sync ulang manual ───────────── */
  const refreshMatrix = useCallback(() => {
    fetchMatrix();
    if (sessionUser?.id) fetchOverrides(sessionUser.id);
  }, [fetchMatrix, fetchOverrides, sessionUser?.id]);

  /* ── canAccess: evaluasi apakah permission_id diizinkan ─────────────────── */
  /**
   * Evaluasi apakah permission diberikan untuk role / sesi saat ini.
   *
   * Algoritma (prioritas dari atas ke bawah):
   * 1. Jika `simulateRole` aktif — pakai logic role simulasi, abaikan superuser bypass.
   * 2. Jika role asli adalah 'superuser' (tanpa simulasi) — selalu true.
   * 3. Cek override akun spesifik (user_permission_overrides) → ikut nilai override.
   * 4. Jika login → cek matrix berdasarkan role (allow_admin / allow_supervisor / allow_user).
   * 5. Jika offline (tidak login) → cek allow_offline.
   *
   * @param {string} permissionId - ID permission dari PERMISSION_CATALOG
   * @param {string|null} [forceSimulateRole=null] - Override simulasi role satu kali
   *   (dipakai komponen yang ingin pass simulasi tanpa melalui state)
   * @returns {boolean}
   */
  const canAccess = useCallback(
    (permissionId, forceSimulateRole = null) => {
      // Tentukan role yang dipakai untuk evaluasi ini
      const effectiveSimulate = forceSimulateRole ?? simulateRole;

      // ── 1. Mode simulasi: evaluasi seolah-olah sebagai role yang disimulasikan ──
      if (effectiveSimulate !== null) {
        const perm = matrix[permissionId] ?? DEFAULT_PERMISSIONS_FALLBACK[permissionId];
        if (!perm) return false; // permission tidak dikenal → larang

        if (effectiveSimulate === "superuser") return true;
        if (effectiveSimulate === "admin") return Boolean(perm.allow_admin);
        if (effectiveSimulate === "supervisor") return Boolean(perm.allow_supervisor);
        if (effectiveSimulate === "user") return Boolean(perm.allow_user);
        // offline simulation
        return Boolean(perm.allow_offline);
      }

      // ── 2. Superuser bypass (tanpa simulasi) ─────────────────────────────────
      if (isSuperuser) return true;

      // ── 3. Override akun spesifik (hanya berlaku jika user login) ────────────
      if (sessionUser?.id && permissionId in overrides) {
        return Boolean(overrides[permissionId].is_granted);
      }

      // Ambil baris permission dari matrix (atau fallback default)
      const perm = matrix[permissionId] ?? DEFAULT_PERMISSIONS_FALLBACK[permissionId];
      if (!perm) return false; // permission tidak dikenal → larang

      // ── 4. User login → cek role matrix ──────────────────────────────────────
      if (sessionUser?.id) {
        if (userRole === "admin") return Boolean(perm.allow_admin);
        if (userRole === "supervisor") return Boolean(perm.allow_supervisor);
        // Default: treat semua role login lain sebagai 'user'
        return Boolean(perm.allow_user);
      }

      // ── 5. Offline (tidak ada sesi login) → cek allow_offline ────────────────
      return Boolean(perm.allow_offline);
    },
    [matrix, overrides, isSuperuser, userRole, sessionUser, simulateRole]
  );

  /* ── updateMatrixRow: upsert satu baris permission di Supabase + state ───── */
  /**
   * Update satu baris di `app_feature_permissions` Supabase dan sinkronkan state lokal.
   *
   * @param {string} permissionId - ID permission yang akan di-update
   * @param {{ allow_offline?: boolean, allow_user?: boolean, allow_supervisor?: boolean, allow_admin?: boolean }} updates
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  const updateMatrixRow = useCallback(async (permissionId, updates) => {
    // Update state lokal terlebih dahulu (optimistic update)
    const prevMatrix = matrix;
    const newRow = {
      ...(matrix[permissionId] ?? DEFAULT_PERMISSIONS_FALLBACK[permissionId] ?? {}),
      ...updates,
    };
    const nextMatrix = { ...matrix, [permissionId]: newRow };
    setMatrix(nextMatrix);
    lsSet(LS_MATRIX_KEY, nextMatrix);

    // Sync ke Supabase jika tersedia
    if (!supabase) {
      return { ok: true, reason: "local_only" }; // simpan lokal saja jika offline
    }
    try {
      const catalogItem = CATALOG_MAP[permissionId];
      const payload = {
        permission_id: permissionId,
        category: newRow.category || catalogItem?.category || (permissionId.startsWith("page:") ? "page" : permissionId.startsWith("btn:") ? "button" : "feature"),
        name: newRow.name || catalogItem?.name || permissionId,
        description: newRow.description || catalogItem?.description || null,
        allow_offline: newRow.allow_offline ?? false,
        allow_user: newRow.allow_user ?? false,
        allow_supervisor: newRow.allow_supervisor ?? false,
        allow_admin: newRow.allow_admin ?? false,
        updated_at: new Date().toISOString(),
        ...(sessionUser?.id ? { updated_by: sessionUser.id } : {}),
      };
      const { error } = await supabase
        .from("app_feature_permissions")
        .upsert(payload, { onConflict: "permission_id" });
      if (error) {
        // Rollback state lokal jika Supabase gagal
        setMatrix(prevMatrix);
        lsSet(LS_MATRIX_KEY, prevMatrix);
        console.warn("[usePermissions] updateMatrixRow error:", error.message);
        return { ok: false, reason: error.message };
      }
      return { ok: true };
    } catch (e) {
      // Rollback
      setMatrix(prevMatrix);
      lsSet(LS_MATRIX_KEY, prevMatrix);
      console.warn("[usePermissions] updateMatrixRow exception:", e.message);
      return { ok: false, reason: e.message };
    }
  }, [matrix, sessionUser]);

  /* ── updateUserOverride: upsert override akun di Supabase ───────────────── */
  /**
   * Upsert satu baris override di `user_permission_overrides` Supabase.
   * Override ini berlaku secara global untuk target user (bukan hanya user saat ini).
   *
   * @param {string} targetUserId   - user_id target yang di-override
   * @param {string} permissionId   - ID permission yang di-override
   * @param {boolean} isGranted     - apakah akses diberikan (true) atau dicabut (false)
   * @param {string} [reason=""]    - alasan / catatan override (untuk audit log)
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  const updateUserOverride = useCallback(
    async (targetUserId, permissionId, isGranted, reason = "") => {
      if (!supabase) return { ok: false, reason: "not_configured" };
      try {
        const payload = {
          user_id: targetUserId,
          permission_id: permissionId,
          is_granted: isGranted,
          reason: reason || null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("user_permission_overrides")
          .upsert(payload, { onConflict: "user_id,permission_id" });
        if (error) {
          console.warn("[usePermissions] updateUserOverride error:", error.message);
          return { ok: false, reason: error.message };
        }
        // Perbarui state lokal hanya jika override adalah untuk user yang sedang login
        if (targetUserId === sessionUser?.id) {
          const nextOverrides = {
            ...overrides,
            [permissionId]: { is_granted: isGranted, reason: reason || null },
          };
          setOverrides(nextOverrides);
          lsSet(LS_OVERRIDES_KEY, nextOverrides);
        }
        return { ok: true };
      } catch (e) {
        console.warn("[usePermissions] updateUserOverride exception:", e.message);
        return { ok: false, reason: e.message };
      }
    },
    [overrides, sessionUser?.id]
  );

  /* ── removeUserOverride: hapus override akun dari Supabase ──────────────── */
  /**
   * Hapus satu baris override dari `user_permission_overrides` Supabase.
   *
   * @param {string} targetUserId  - user_id yang override-nya ingin dihapus
   * @param {string} permissionId  - ID permission yang override-nya dihapus
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  const removeUserOverride = useCallback(
    async (targetUserId, permissionId) => {
      if (!supabase) return { ok: false, reason: "not_configured" };
      try {
        const { error } = await supabase
          .from("user_permission_overrides")
          .delete()
          .eq("user_id", targetUserId)
          .eq("permission_id", permissionId);
        if (error) {
          console.warn("[usePermissions] removeUserOverride error:", error.message);
          return { ok: false, reason: error.message };
        }
        // Hapus dari state lokal jika override adalah milik user yang sedang login
        if (targetUserId === sessionUser?.id && permissionId in overrides) {
          const nextOverrides = { ...overrides };
          delete nextOverrides[permissionId];
          setOverrides(nextOverrides);
          lsSet(LS_OVERRIDES_KEY, nextOverrides);
        }
        return { ok: true };
      } catch (e) {
        console.warn("[usePermissions] removeUserOverride exception:", e.message);
        return { ok: false, reason: e.message };
      }
    },
    [overrides, sessionUser?.id]
  );

  /* ── Return API lengkap ──────────────────────────────────────────────────── */
  return {
    /** Matrix global permission: { [permission_id]: { allow_offline, allow_user, allow_supervisor, allow_admin } } */
    matrix,
    /** Override per-akun untuk user yang sedang login: { [permission_id]: { is_granted, reason } } */
    overrides,
    /** true jika userRole === 'superuser' */
    isSuperuser,
    /** Role yang sedang disimulasikan (null = tidak simulasi) */
    simulateRole,
    /** Setter untuk mengaktifkan/menonaktifkan simulasi role */
    setSimulateRole,
    /**
     * Evaluasi akses permission.
     * @param {string} permissionId
     * @param {string|null} [forceSimulateRole] - Override simulasi sekali saja
     * @returns {boolean}
     */
    canAccess,
    /** Paksa sync ulang matrix + overrides dari Supabase */
    refreshMatrix,
    /**
     * Update satu baris permission di Supabase + state lokal.
     * @param {string} permissionId
     * @param {{ allow_offline?, allow_user?, allow_supervisor?, allow_admin? }} updates
     * @returns {Promise<{ok, reason?}>}
     */
    updateMatrixRow,
    /**
     * Upsert override permission untuk user target.
     * @param {string} targetUserId
     * @param {string} permissionId
     * @param {boolean} isGranted
     * @param {string} [reason]
     * @returns {Promise<{ok, reason?}>}
     */
    updateUserOverride,
    /**
     * Hapus override permission untuk user target.
     * @param {string} targetUserId
     * @param {string} permissionId
     * @returns {Promise<{ok, reason?}>}
     */
    removeUserOverride,
  };
}
