/* ============================================================================
   SuperuserAdminPage — Admin Dashboard untuk Superuser
   Fase 3: Manajemen Akses & Hak Izin Sistem

   Sub-tab:
   1. access-matrix  — Matriks Hak Akses per role
   2. user-roles     — Manajemen Role Pengguna
   3. user-overrides — Pengecualian Akun Spesifik
   4. simulator      — Simulator Tampilan Role

   Inner components (semua dalam 1 file):
   - Toggle           — iOS-style switch kecil
   - RoleBadge        — badge berwarna per role
   - SimulatorBanner  — Banner saat simulasi aktif
   - MatrixTab        — Sub-tab 1
   - UserRolesTab     — Sub-tab 2
   - UserOverridesTab — Sub-tab 3
   - SimulatorTab     — Sub-tab 4
============================================================================ */
import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Users,
  Shield,
  Eye,
  Search,
  Loader2,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { supabase } from "../utils/cloud.js";
import {
  PERMISSION_CATALOG,
  CATEGORY_LABELS,
  PERMISSION_CATEGORIES,
  ROLE_LABELS,
} from "../constants/permissions.js";

/* ============================================================================
   Toggle — iOS-style switch kecil, reusable di dalam file ini
============================================================================ */
function Toggle({ checked, onChange, disabled, color }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none"
      style={{
        background: checked ? (color || "#34D399") : "rgba(156,163,175,0.3)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 m-0.5"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}

/* ============================================================================
   RoleBadge — badge kecil berwarna untuk role
============================================================================ */
function RoleBadge({ role, colors }) {
  const colorMap = {
    user: colors.gold,
    supervisor: colors.blue,
    admin: colors.mint,
    superuser: colors.violet,
  };
  const c = colorMap[role] || colors.textMuted;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
      style={{ background: c + "22", color: c, border: `1px solid ${c}44` }}
    >
      {ROLE_LABELS[role] || role}
    </span>
  );
}

/* ============================================================================
   SimulatorBanner — tampil saat simulateRole aktif
============================================================================ */
function SimulatorBanner({ simulateRole, setSimulateRole, colors }) {
  return (
    <div
      className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl sm-fadeup"
      style={{
        background: colors.violet + "14",
        border: `1px solid ${colors.violet}44`,
      }}
    >
      <div className="flex items-center gap-2 text-sm" style={{ color: colors.text }}>
        <span>🎭</span>
        <span>
          <b>MODE SIMULATOR AKTIF</b> — Anda melihat tampilan sebagai{" "}
          <b>{ROLE_LABELS[simulateRole] || simulateRole}</b>
        </span>
      </div>
      <button
        onClick={() => setSimulateRole(null)}
        className="sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
        style={{ background: colors.violet, color: "#fff" }}
      >
        Keluar Simulator
      </button>
    </div>
  );
}

/* ============================================================================
   MatrixTab — Sub-tab 1: Matriks Hak Akses
============================================================================ */
function MatrixTab({ matrix, updateMatrixRow, colors }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [savingId, setSavingId] = useState(null);
  const [saveError, setSaveError] = useState("");

  const handleToggle = useCallback(
    async (permissionId, field, currentValue) => {
      setSavingId(permissionId);
      setSaveError("");
      const result = await updateMatrixRow(permissionId, { [field]: !currentValue });
      setSavingId(null);
      if (!result.ok) {
        setSaveError(
          `Gagal menyimpan "${permissionId}": ${result.reason || "error tidak diketahui"}`
        );
      }
    },
    [updateMatrixRow]
  );

  const filtered = PERMISSION_CATALOG.filter((item) => {
    const matchCat = filterCategory === "all" || item.category === filterCategory;
    const matchSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const grouped = PERMISSION_CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter((i) => i.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const roleColumns = [
    { field: "allow_offline", label: "Offline / Tamu", color: colors.textMuted },
    { field: "allow_user", label: "User Biasa", color: colors.gold },
    { field: "allow_supervisor", label: "Supervisor", color: colors.blue },
    { field: "allow_admin", label: "Admin Depo", color: colors.mint },
  ];

  const inputStyle = {
    background: colors.glassFill,
    color: colors.text,
    border: `1px solid ${colors.glassBorder}`,
    colorScheme: colors.colorScheme,
  };

  return (
    <div className="sm-fadeup space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: colors.textMuted }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari fitur / permission ID…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
            style={inputStyle}
          />
        </div>
        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm outline-none"
            style={{ ...inputStyle, minWidth: "160px" }}
          >
            <option value="all">Semua Kategori</option>
            {PERMISSION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: colors.textMuted }}
          />
        </div>
      </div>

      {/* Error banner */}
      {saveError && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
          style={{
            background: colors.coral + "14",
            color: colors.coral,
            border: `1px solid ${colors.coral}33`,
          }}
        >
          <AlertTriangle size={13} className="shrink-0" />
          {saveError}
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-sm" style={{ color: colors.textMuted }}>
          Tidak ada permission yang cocok dengan pencarian.
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="sm-card overflow-hidden">
            {/* Category header */}
            <div
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
              style={{
                background: colors.glassFill,
                borderBottom: `1px solid ${colors.glassBorder}`,
                color: colors.tableHeader,
              }}
            >
              {CATEGORY_LABELS[cat]}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
                    <th
                      className="text-left px-4 py-2.5 text-xs font-semibold"
                      style={{ color: colors.tableHeader }}
                    >
                      Fitur / Halaman
                    </th>
                    {roleColumns.map((col) => (
                      <th
                        key={col.field}
                        className="px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap"
                        style={{ color: col.color }}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th
                      className="px-3 py-2.5 text-xs font-semibold text-center"
                      style={{ color: colors.tableHeader }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const current = matrix[item.id] || {
                      allow_offline: item.defaultOffline,
                      allow_user: item.defaultUser,
                      allow_supervisor: item.defaultSupervisor,
                      allow_admin: item.defaultAdmin,
                    };
                    const isSaving = savingId === item.id;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom:
                            idx < items.length - 1
                              ? `1px solid ${colors.glassBorder}`
                              : "none",
                          background: isSaving ? colors.violet + "08" : "transparent",
                        }}
                      >
                        {/* Feature name */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm" style={{ color: colors.text }}>
                            {item.name}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                            {item.id}
                          </div>
                        </td>

                        {/* Toggle columns */}
                        {roleColumns.map((col) => (
                          <td key={col.field} className="px-3 py-3 text-center">
                            <Toggle
                              checked={Boolean(current[col.field])}
                              onChange={() =>
                                handleToggle(item.id, col.field, current[col.field])
                              }
                              disabled={isSaving}
                              color={col.color}
                            />
                          </td>
                        ))}

                        {/* Saving status */}
                        <td className="px-3 py-3 text-center">
                          {isSaving ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold animate-pulse"
                              style={{ color: colors.violet }}
                            >
                              <Loader2 size={11} className="animate-spin" />
                              Menyimpan…
                            </span>
                          ) : (
                            <span className="text-[11px]" style={{ color: colors.textMuted }}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ============================================================================
   UserRolesTab — Sub-tab 2: Manajemen Role Pengguna
============================================================================ */
function UserRolesTab({ sessionUser, colors }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [changingId, setChangingId] = useState(null);
  const [changeError, setChangeError] = useState("");
  const [changeSuccessId, setChangeSuccessId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsers() {
      if (!supabase) { setLoadingUsers(false); return; }
      setLoadingUsers(true);
      setFetchError("");
      try {
        // Coba RPC get_all_users_for_admin (bisa ambil email dari auth.users)
        let res = await supabase.rpc("get_all_users_for_admin");
        if (res.error) {
          // Fallback ke direct query profiles (hanya kolom yang ada di tabel profiles)
          res = await supabase
            .from("profiles")
            .select("user_id, username, role")
            .order("username");
        }
        if (!cancelled) {
          if (res.error) {
            setFetchError(`Gagal mengambil data user: ${res.error.message}`);
          } else {
            setUsers(res.data || []);
          }
          setLoadingUsers(false);
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(`Exception: ${e.message}`);
          setLoadingUsers(false);
        }
      }
    }
    fetchUsers();
    return () => { cancelled = true; };
  }, []);

  const handleRoleChange = useCallback(async (userId, newRole) => {
    if (!supabase) { setChangeError("Supabase tidak terkonfigurasi."); return; }
    setChangingId(userId);
    setChangeError("");
    setChangeSuccessId(null);
    try {
      const { error } = await supabase.rpc("update_user_role", {
        p_user_id: userId,
        p_role: newRole,
      });
      if (error) {
        setChangeError(`Gagal mengubah role: ${error.message}`);
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
        );
        setChangeSuccessId(userId);
        setTimeout(() => setChangeSuccessId(null), 2000);
      }
    } catch (e) {
      setChangeError(`Error: ${e.message}`);
    } finally {
      setChangingId(null);
    }
  }, []);

  const filtered = users.filter((u) => {
    if (!searchUser) return true;
    const q = searchUser.toLowerCase();
    return (
      (u.username || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  const inputStyle = {
    background: colors.glassFill,
    color: colors.text,
    border: `1px solid ${colors.glassBorder}`,
    colorScheme: colors.colorScheme,
  };

  const editableRoles = ["user", "supervisor", "admin"];

  return (
    <div className="sm-fadeup space-y-4">
      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: colors.textMuted }}
        />
        <input
          type="text"
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
          placeholder="Cari username atau email…"
          className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
          style={inputStyle}
        />
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
          style={{
            background: colors.coral + "14",
            color: colors.coral,
            border: `1px solid ${colors.coral}33`,
          }}
        >
          <AlertTriangle size={13} className="shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Change Error */}
      {changeError && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
          style={{
            background: colors.coral + "14",
            color: colors.coral,
            border: `1px solid ${colors.coral}33`,
          }}
        >
          <AlertTriangle size={13} className="shrink-0" />
          {changeError}
        </div>
      )}

      {/* Table */}
      <div className="sm-card overflow-hidden">
        {loadingUsers ? (
          <div
            className="flex items-center justify-center gap-2 py-12 text-sm"
            style={{ color: colors.textMuted }}
          >
            <Loader2 size={16} className="animate-spin" />
            Memuat daftar pengguna…
          </div>
        ) : !supabase ? (
          <div
            className="flex items-center gap-2 px-4 py-12 text-sm justify-center"
            style={{ color: colors.textMuted }}
          >
            <AlertTriangle size={15} style={{ color: colors.gold }} />
            Supabase tidak terkonfigurasi — fitur ini membutuhkan koneksi cloud.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${colors.glassBorder}`,
                    background: colors.glassFill,
                  }}
                >
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold"
                    style={{ color: colors.tableHeader }}
                  >
                    Username
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold"
                    style={{ color: colors.tableHeader }}
                  >
                    Role Saat Ini
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-semibold text-left"
                    style={{ color: colors.tableHeader }}
                  >
                    Ubah Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-center py-10 text-sm"
                      style={{ color: colors.textMuted }}
                    >
                      {searchUser ? "Tidak ada pengguna yang cocok." : "Belum ada pengguna."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((user, idx) => {
                    const isSelf = sessionUser?.id === user.user_id;
                    const isChanging = changingId === user.user_id;
                    const isSuccess = changeSuccessId === user.user_id;
                    return (
                      <tr
                        key={user.user_id}
                        style={{
                          borderBottom:
                            idx < filtered.length - 1
                              ? `1px solid ${colors.glassBorder}`
                              : "none",
                        }}
                      >
                        {/* Username + email */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.text }}>
                              {user.username || user.user_id.slice(0, 8) + "…"}
                            </span>
                            {isSelf && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                style={{ background: colors.mint + "22", color: colors.mint }}
                              >
                                Anda
                              </span>
                            )}
                          </div>
                          {user.email && (
                            <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                              {user.email}
                            </div>
                          )}
                        </td>

                        {/* Current role badge */}
                        <td className="px-4 py-3">
                          <RoleBadge role={user.role || "user"} colors={colors} />
                        </td>

                        {/* Role selector */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <select
                                value={user.role || "user"}
                                disabled={isSelf || isChanging || user.role === "superuser"}
                                onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                                className="appearance-none pl-2.5 pr-7 py-1.5 rounded-lg text-xs outline-none"
                                style={{
                                  ...inputStyle,
                                  opacity: isSelf || user.role === "superuser" ? 0.5 : 1,
                                  cursor:
                                    isSelf || user.role === "superuser"
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                              >
                                {user.role === "superuser" ? (
                                  <option value="superuser">{ROLE_LABELS.superuser}</option>
                                ) : (
                                  editableRoles.map((r) => (
                                    <option key={r} value={r}>
                                      {ROLE_LABELS[r]}
                                    </option>
                                  ))
                                )}
                              </select>
                              <ChevronDown
                                size={11}
                                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ color: colors.textMuted }}
                              />
                            </div>

                            {isChanging && (
                              <Loader2
                                size={14}
                                className="animate-spin shrink-0"
                                style={{ color: colors.violet }}
                              />
                            )}
                            {isSuccess && (
                              <Check size={14} className="shrink-0" style={{ color: colors.mint }} />
                            )}
                            {user.role === "superuser" && (
                              <span className="text-[10px] font-semibold" style={{ color: colors.violet }}>
                                Hanya via SQL
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] px-1" style={{ color: colors.textMuted }}>
        ⚠️ Role <b>Superuser</b> tidak dapat ditetapkan dari UI ini — hanya bisa diatur
        langsung via SQL di Supabase sebagai perlindungan anti-lockout.
      </p>
    </div>
  );
}

/* ============================================================================
   UserOverridesTab — Sub-tab 3: Pengecualian Akun Spesifik
============================================================================ */
function UserOverridesTab({ matrix, updateUserOverride, removeUserOverride, colors }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOverrides, setUserOverrides] = useState({});
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [actionState, setActionState] = useState({});
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchUsers() {
      if (!supabase) { setLoadingUsers(false); return; }
      try {
        let res = await supabase.rpc("get_all_users_for_admin");
        if (res.error) {
          res = await supabase
            .from("profiles")
            .select("user_id, username, role")
            .order("username");
        }
        if (!cancelled) {
          if (!res.error) setUsers(res.data || []);
          setLoadingUsers(false);
        }
      } catch {
        if (!cancelled) setLoadingUsers(false);
      }
    }
    fetchUsers();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedUser || !supabase) { setUserOverrides({}); return; }
    let cancelled = false;
    async function fetchUserOverrides() {
      setLoadingOverrides(true);
      try {
        const { data, error } = await supabase
          .from("user_permission_overrides")
          .select("*")
          .eq("user_id", selectedUser.user_id);
        if (!cancelled) {
          if (!error && data) {
            const map = {};
            data.forEach((row) => {
              map[row.permission_id] = {
                is_granted: Boolean(row.is_granted),
                reason: row.reason || null,
              };
            });
            setUserOverrides(map);
          }
          setLoadingOverrides(false);
        }
      } catch {
        if (!cancelled) setLoadingOverrides(false);
      }
    }
    fetchUserOverrides();
    return () => { cancelled = true; };
  }, [selectedUser?.user_id]);

  const handleSetOverride = useCallback(
    async (permId, isGranted) => {
      if (!selectedUser) return;
      setActionState((prev) => ({ ...prev, [permId]: "loading" }));
      setActionError("");
      const result = await updateUserOverride(selectedUser.user_id, permId, isGranted);
      if (result.ok) {
        setUserOverrides((prev) => ({
          ...prev,
          [permId]: { is_granted: isGranted, reason: null },
        }));
        setActionState((prev) => ({ ...prev, [permId]: "ok" }));
        setTimeout(() =>
          setActionState((prev) => { const n = { ...prev }; delete n[permId]; return n; }),
          1500
        );
      } else {
        setActionState((prev) => ({ ...prev, [permId]: "error" }));
        setActionError(result.reason || "Gagal menyimpan override.");
      }
    },
    [selectedUser, updateUserOverride]
  );

  const handleRemoveOverride = useCallback(
    async (permId) => {
      if (!selectedUser) return;
      setActionState((prev) => ({ ...prev, [permId]: "loading" }));
      setActionError("");
      const result = await removeUserOverride(selectedUser.user_id, permId);
      if (result.ok) {
        setUserOverrides((prev) => { const n = { ...prev }; delete n[permId]; return n; });
        setActionState((prev) => ({ ...prev, [permId]: "ok" }));
        setTimeout(() =>
          setActionState((prev) => { const n = { ...prev }; delete n[permId]; return n; }),
          1500
        );
      } else {
        setActionState((prev) => ({ ...prev, [permId]: "error" }));
        setActionError(result.reason || "Gagal menghapus override.");
      }
    },
    [selectedUser, removeUserOverride]
  );

  const getDefaultAccess = useCallback(
    (permId, role) => {
      const row = matrix[permId];
      if (!row) return false;
      if (role === "admin") return Boolean(row.allow_admin);
      if (role === "supervisor") return Boolean(row.allow_supervisor);
      if (role === "user") return Boolean(row.allow_user);
      return Boolean(row.allow_offline);
    },
    [matrix]
  );

  const filteredUsers = users.filter((u) => {
    if (!searchUser) return true;
    return (u.username || "").toLowerCase().includes(searchUser.toLowerCase());
  });

  const inputStyle = {
    background: colors.glassFill,
    color: colors.text,
    border: `1px solid ${colors.glassBorder}`,
    colorScheme: colors.colorScheme,
  };

  if (!supabase) {
    return (
      <div
        className="sm-fadeup flex items-center gap-2 px-4 py-12 justify-center text-sm"
        style={{ color: colors.textMuted }}
      >
        <AlertTriangle size={15} style={{ color: colors.gold }} />
        Supabase tidak terkonfigurasi — fitur ini membutuhkan koneksi cloud.
      </div>
    );
  }

  return (
    <div className="sm-fadeup">
      <div className="flex flex-col md:flex-row gap-4" style={{ minHeight: "400px" }}>
        {/* Left: user list */}
        <div
          className="md:w-64 shrink-0 sm-card flex flex-col overflow-hidden"
          style={{ maxHeight: "600px" }}
        >
          <div className="p-3 shrink-0" style={{ borderBottom: `1px solid ${colors.glassBorder}` }}>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: colors.textMuted }}
              />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Cari pengguna…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loadingUsers ? (
              <div
                className="flex items-center justify-center gap-2 py-8 text-xs"
                style={{ color: colors.textMuted }}
              >
                <Loader2 size={14} className="animate-spin" />
                Memuat…
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-xs" style={{ color: colors.textMuted }}>
                Tidak ada pengguna.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUser?.user_id === user.user_id;
                return (
                  <button
                    key={user.user_id}
                    onClick={() => {
                      setSelectedUser(user);
                      setActionError("");
                      setActionState({});
                    }}
                    className="w-full text-left px-3 py-2.5 transition-colors"
                    style={{
                      background: isSelected ? colors.violet + "22" : "transparent",
                      borderBottom: `1px solid ${colors.glassBorder}`,
                      borderLeft: isSelected
                        ? `3px solid ${colors.violet}`
                        : "3px solid transparent",
                    }}
                  >
                    <div className="text-xs font-medium" style={{ color: colors.text }}>
                      {user.username || user.user_id.slice(0, 10)}
                    </div>
                    <div className="mt-0.5">
                      <RoleBadge role={user.role || "user"} colors={colors} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: overrides detail */}
        <div className="flex-1 min-w-0">
          {!selectedUser ? (
            <div
              className="sm-card flex flex-col items-center justify-center text-center py-16 h-full"
              style={{ minHeight: "200px" }}
            >
              <Shield size={32} style={{ color: colors.violet + "66" }} />
              <p className="mt-3 text-sm font-medium" style={{ color: colors.textMuted }}>
                Pilih pengguna di sebelah kiri untuk mengelola override permission-nya.
              </p>
            </div>
          ) : (
            <div className="sm-card overflow-hidden">
              <div
                className="px-4 py-3 flex items-center justify-between shrink-0"
                style={{
                  borderBottom: `1px solid ${colors.glassBorder}`,
                  background: colors.glassFill,
                }}
              >
                <div>
                  <div className="font-semibold text-sm" style={{ color: colors.text }}>
                    {selectedUser.username || selectedUser.user_id.slice(0, 12)}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: colors.textMuted }}>
                    Override permission khusus untuk akun ini
                  </div>
                </div>
                <RoleBadge role={selectedUser.role || "user"} colors={colors} />
              </div>

              {actionError && (
                <div
                  className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{
                    background: colors.coral + "14",
                    color: colors.coral,
                    border: `1px solid ${colors.coral}33`,
                  }}
                >
                  <AlertTriangle size={12} className="shrink-0" />
                  {actionError}
                </div>
              )}

              {loadingOverrides ? (
                <div
                  className="flex items-center justify-center gap-2 py-10 text-sm"
                  style={{ color: colors.textMuted }}
                >
                  <Loader2 size={15} className="animate-spin" />
                  Memuat override…
                </div>
              ) : (
                <div
                  className="overflow-x-auto"
                  style={{ maxHeight: "480px", overflowY: "auto" }}
                >
                  <table className="w-full text-sm">
                    <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                      <tr
                        style={{
                          background: colors.glassFill,
                          borderBottom: `1px solid ${colors.glassBorder}`,
                        }}
                      >
                        <th
                          className="text-left px-4 py-2.5 text-xs font-semibold"
                          style={{ color: colors.tableHeader }}
                        >
                          Permission
                        </th>
                        <th
                          className="px-3 py-2.5 text-xs font-semibold text-center"
                          style={{ color: colors.tableHeader }}
                        >
                          Default Role
                        </th>
                        <th
                          className="px-3 py-2.5 text-xs font-semibold text-center"
                          style={{ color: colors.tableHeader }}
                        >
                          Override
                        </th>
                        <th
                          className="px-3 py-2.5 text-xs font-semibold text-center"
                          style={{ color: colors.tableHeader }}
                        >
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_CATALOG.map((perm, idx) => {
                        const defaultAccess = getDefaultAccess(perm.id, selectedUser.role);
                        const hasOverride = perm.id in userOverrides;
                        const override = userOverrides[perm.id];
                        const state = actionState[perm.id];
                        return (
                          <tr
                            key={perm.id}
                            style={{
                              borderBottom:
                                idx < PERMISSION_CATALOG.length - 1
                                  ? `1px solid ${colors.glassBorder}`
                                  : "none",
                              background: hasOverride ? colors.violet + "06" : "transparent",
                            }}
                          >
                            <td className="px-4 py-2.5">
                              <div
                                className="text-xs font-medium"
                                style={{ color: colors.text }}
                              >
                                {perm.name}
                              </div>
                              <div
                                className="text-[10px] mt-0.5"
                                style={{ color: colors.textMuted }}
                              >
                                {perm.id}
                              </div>
                            </td>

                            <td className="px-3 py-2.5 text-center">
                              {defaultAccess ? (
                                <Check
                                  size={13}
                                  style={{ color: colors.mint, display: "inline" }}
                                />
                              ) : (
                                <X
                                  size={13}
                                  style={{ color: colors.coral, display: "inline" }}
                                />
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-center">
                              {hasOverride ? (
                                override.is_granted ? (
                                  <span
                                    className="text-[10px] font-bold"
                                    style={{ color: colors.mint }}
                                  >
                                    ✓ Diizinkan
                                  </span>
                                ) : (
                                  <span
                                    className="text-[10px] font-bold"
                                    style={{ color: colors.coral }}
                                  >
                                    ✗ Dicabut
                                  </span>
                                )
                              ) : (
                                <span
                                  className="text-[10px]"
                                  style={{ color: colors.textMuted }}
                                >
                                  Default
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-center">
                              {state === "loading" ? (
                                <Loader2
                                  size={13}
                                  className="animate-spin inline"
                                  style={{ color: colors.violet }}
                                />
                              ) : state === "ok" ? (
                                <Check
                                  size={13}
                                  className="inline"
                                  style={{ color: colors.mint }}
                                />
                              ) : (
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {(!hasOverride || !override?.is_granted) && (
                                    <button
                                      onClick={() => handleSetOverride(perm.id, true)}
                                      className="sm-btn px-2 py-1 rounded-md text-[10px] font-semibold"
                                      style={{
                                        background: colors.mint + "22",
                                        color: colors.mint,
                                      }}
                                    >
                                      Izinkan
                                    </button>
                                  )}
                                  {(!hasOverride || override?.is_granted) && (
                                    <button
                                      onClick={() => handleSetOverride(perm.id, false)}
                                      className="sm-btn px-2 py-1 rounded-md text-[10px] font-semibold"
                                      style={{
                                        background: colors.coral + "22",
                                        color: colors.coral,
                                      }}
                                    >
                                      Cabut
                                    </button>
                                  )}
                                  {hasOverride && (
                                    <button
                                      onClick={() => handleRemoveOverride(perm.id)}
                                      className="sm-btn px-2 py-1 rounded-md text-[10px] font-semibold"
                                      style={{
                                        background: colors.glassFill,
                                        color: colors.textMuted,
                                        border: `1px solid ${colors.glassBorder}`,
                                      }}
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SimulatorTab — Sub-tab 4: Simulator Tampilan Role
============================================================================ */
function SimulatorTab({ simulateRole, setSimulateRole, colors }) {
  const roleOptions = [
    {
      value: null,
      label: "Nonaktifkan Simulator",
      desc: "Tampilkan app sesuai role Superuser Anda yang sesungguhnya.",
      icon: "🔓",
      color: colors.textMuted,
    },
    {
      value: "offline",
      label: "Offline / Tamu",
      desc: "Tampilan tanpa sesi login — hanya fitur yang diizinkan secara offline.",
      icon: "🌐",
      color: colors.textMuted,
    },
    {
      value: "user",
      label: "User Biasa",
      desc: "Tampilan sebagai karyawan standar tanpa akses laporan sensitif.",
      icon: "👤",
      color: colors.gold,
    },
    {
      value: "supervisor",
      label: "Supervisor",
      desc: "Tampilan sebagai supervisor dengan akses laporan transaksi & stok.",
      icon: "🧑‍💼",
      color: colors.blue,
    },
    {
      value: "admin",
      label: "Admin Depo",
      desc: "Tampilan sebagai admin dengan akses penuh kecuali panel superuser ini.",
      icon: "🛡️",
      color: colors.mint,
    },
  ];

  const [pending, setPending] = useState(simulateRole);

  return (
    <div className="sm-fadeup max-w-xl space-y-4">
      {/* Info card */}
      <div
        className="sm-card px-4 py-3 flex items-start gap-3"
        style={{ borderLeft: `3px solid ${colors.violet}` }}
      >
        <Eye size={16} className="shrink-0 mt-0.5" style={{ color: colors.violet }} />
        <div className="text-xs" style={{ color: colors.textMuted }}>
          <b style={{ color: colors.text }}>Mode Simulator</b> memungkinkan Anda
          melihat tampilan aplikasi seolah-olah Anda login sebagai role yang berbeda.
          Sesi Supabase Anda tidak berubah — hanya tampilan UI yang menyesuaikan.
        </div>
      </div>

      {/* Role option cards */}
      <div className="space-y-2">
        {roleOptions.map((opt) => {
          const isSelected = pending === opt.value;
          return (
            <button
              key={String(opt.value)}
              onClick={() => setPending(opt.value)}
              className="w-full text-left px-4 py-3 rounded-xl transition-all sm-btn"
              style={{
                background: isSelected
                  ? (opt.color || colors.violet) + "18"
                  : colors.glassFill,
                border: `1.5px solid ${
                  isSelected
                    ? (opt.color || colors.violet) + "66"
                    : colors.glassBorder
                }`,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{opt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm"
                    style={{
                      color: isSelected ? opt.color || colors.violet : colors.text,
                    }}
                  >
                    {opt.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                    {opt.desc}
                  </div>
                </div>
                {isSelected && (
                  <Check
                    size={16}
                    style={{ color: opt.color || colors.violet, flexShrink: 0 }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Apply button */}
      <button
        onClick={() => setSimulateRole(pending)}
        className="sm-btn w-full px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        style={{ background: colors.violet, color: "#fff" }}
      >
        <Eye size={15} />
        {pending === null
          ? "Nonaktifkan Simulator"
          : `Aktifkan Simulator: ${ROLE_LABELS[pending] || "Offline / Tamu"}`}
      </button>

      {simulateRole && (
        <p className="text-[11px] text-center" style={{ color: colors.textMuted }}>
          Simulator sedang aktif sebagai{" "}
          <b>{ROLE_LABELS[simulateRole] || simulateRole}</b>. Tekan
          "Nonaktifkan Simulator" untuk kembali ke tampilan normal.
        </p>
      )}

      {/* Warning note */}
      <div
        className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
        style={{
          background: colors.gold + "14",
          color: colors.gold,
          border: `1px solid ${colors.gold}33`,
        }}
      >
        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
        <span>
          Simulator hanya berdampak pada tampilan halaman ini dan evaluasi{" "}
          <code>canAccess()</code>. Sesi login Supabase dan data tidak berubah.
        </span>
      </div>
    </div>
  );
}

/* ============================================================================
   SuperuserAdminPage — Halaman utama (exported)
============================================================================ */

const SUB_TABS = [
  { id: "access-matrix", label: "Matriks Akses", Icon: Shield },
  { id: "user-roles", label: "Role Pengguna", Icon: Users },
  { id: "user-overrides", label: "Pengecualian Akun", Icon: ShieldCheck },
  { id: "simulator", label: "Simulator", Icon: Eye },
];

/**
 * SuperuserAdminPage — Admin Dashboard halaman utama.
 *
 * @param {Object} props
 * @param {Object} props.colors           - color tokens dari THEMES
 * @param {string} props.userRole         - role user yang sedang login
 * @param {Object|null} props.sessionUser - objek user Supabase
 * @param {Function} props.canAccess      - fn canAccess(permId) → boolean
 * @param {Object} props.permissions      - objek dari usePermissions()
 */
export function SuperuserAdminPage({
  colors,
  userRole,
  sessionUser,
  canAccess,
  permissions: {
    matrix,
    overrides,
    isSuperuser,
    updateMatrixRow,
    updateUserOverride,
    removeUserOverride,
    simulateRole,
    setSimulateRole,
  },
}) {
  const [activeTab, setActiveTab] = useState("access-matrix");

  return (
    <div className="sm-fadeup">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="p-2 rounded-xl shrink-0"
          style={{ background: colors.violet + "1A" }}
        >
          <ShieldCheck size={20} style={{ color: colors.violet }} />
        </div>
        <div>
          <h1 className="disp text-xl font-bold" style={{ color: colors.text }}>
            Admin Dashboard
          </h1>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            Superuser · Manajemen Akses &amp; Hak Izin Sistem
          </p>
        </div>
      </div>

      {/* Simulator Banner */}
      {simulateRole && (
        <SimulatorBanner
          simulateRole={simulateRole}
          setSimulateRole={setSimulateRole}
          colors={colors}
        />
      )}

      {/* Sub-tab navigation */}
      <div
        className="flex p-1 rounded-xl mb-5 gap-1 overflow-x-auto"
        style={{
          background: colors.glassSubtle,
          border: `1px solid ${colors.glassBorder}`,
        }}
      >
        {SUB_TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 sm-btn px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all"
              style={{
                background: isActive ? colors.glassFillStrong : "transparent",
                color: isActive ? colors.violet : colors.textMuted,
                border: isActive
                  ? `1px solid ${colors.violet}33`
                  : "1px solid transparent",
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "access-matrix" && (
        <MatrixTab matrix={matrix} updateMatrixRow={updateMatrixRow} colors={colors} />
      )}
      {activeTab === "user-roles" && (
        <UserRolesTab sessionUser={sessionUser} colors={colors} />
      )}
      {activeTab === "user-overrides" && (
        <UserOverridesTab
          matrix={matrix}
          updateUserOverride={updateUserOverride}
          removeUserOverride={removeUserOverride}
          colors={colors}
        />
      )}
      {activeTab === "simulator" && (
        <SimulatorTab
          simulateRole={simulateRole}
          setSimulateRole={setSimulateRole}
          colors={colors}
        />
      )}
    </div>
  );
}
