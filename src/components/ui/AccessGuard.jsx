/* ============================================================================
   AccessGuard — penjaga akses berbasis permission di level komponen.

   Komponen ini TIDAK memanggil hook Supabase sendiri. Fungsi `canAccess`
   WAJIB dioper dari parent yang sudah memanggil `usePermissions`.

   Export:
   - AccessGuard  : komponen wrapper yang menyembunyikan atau mendisable children
                    berdasarkan hasil `canAccess(permission)`.
   - CanAccess    : helper ringan (render-prop sederhana) untuk inline conditional.

   Props AccessGuard:
   - permission  : string  — ID permission dari PERMISSION_CATALOG (wajib)
   - canAccess   : function — dari usePermissions().canAccess (wajib)
   - mode        : 'hide' (default) | 'disable'
                   'hide'    → children tidak dirender sama sekali jika tidak punya akses
                   'disable' → children tetap dirender dengan pointer-events-none + opacity-40
   - fallback    : ReactNode (opsional) — konten pengganti saat mode='hide' dan tidak punya akses
   - tooltip     : string (opsional) — tooltip yang muncul saat mode='disable' dan tidak punya akses
   - children    : ReactNode — konten yang dijaga

   Props CanAccess:
   - permission  : string  — ID permission
   - canAccess   : function — dari usePermissions().canAccess
   - children    : ReactNode

   Catatan desain:
   - Komponen ini HANYA bertanggung jawab pada UI feedback (hide/disable).
     Logic bisnis (siapa boleh apa) sepenuhnya ada di usePermissions / canAccess.
   - Sengaja tidak memanggil useContext atau hook Supabase langsung agar
     komponen ini dapat dipakai di mana saja tanpa ketergantungan provider.
============================================================================ */

/**
 * AccessGuard — wrapper yang menjaga akses children berdasarkan permission.
 *
 * @param {Object} props
 * @param {string}   props.permission  - ID permission yang diperiksa
 * @param {Function} props.canAccess   - Fungsi canAccess dari usePermissions()
 * @param {'hide'|'disable'} [props.mode='hide'] - Perilaku saat tidak punya akses
 * @param {import('react').ReactNode} [props.fallback=null] - Konten pengganti (hanya mode 'hide')
 * @param {string} [props.tooltip]     - Tooltip saat mode 'disable' (tidak punya akses)
 * @param {import('react').ReactNode} props.children - Konten yang dijaga
 * @returns {import('react').ReactNode}
 */
export function AccessGuard({
  permission,
  canAccess,
  mode = "hide",
  fallback = null,
  tooltip,
  children,
}) {
  // Evaluasi akses — canAccess sudah memuat seluruh logic permission
  const allowed = canAccess(permission);

  // ── Akses ditolak ─────────────────────────────────────────────────────────
  if (!allowed) {
    if (mode === "hide") {
      // Mode 'hide': tidak render sama sekali, tampilkan fallback jika ada
      return fallback;
    }

    // Mode 'disable': tetap render tapi non-interaktif + redup
    // - div luar: cursor 'not-allowed' + tooltip keterangan
    // - div dalam: pointer-events-none + opacity-40 supaya children
    //   tidak dapat diklik meski secara visual masih tampak
    return (
      <div
        title={tooltip || "Akses dibatasi oleh administrator"}
        className="cursor-not-allowed"
      >
        <div className="pointer-events-none opacity-40">{children}</div>
      </div>
    );
  }

  // ── Akses diizinkan: render children normal ────────────────────────────────
  return children;
}

/**
 * CanAccess — helper inline ringan untuk conditional rendering berbasis permission.
 *
 * Lebih ringkas dari AccessGuard saat hanya perlu hide/show tanpa fallback atau disable.
 *
 * Contoh:
 * ```jsx
 * <CanAccess permission="btn:edit_targets" canAccess={canAccess}>
 *   <EditButton />
 * </CanAccess>
 * ```
 *
 * @param {Object} props
 * @param {string}   props.permission - ID permission yang diperiksa
 * @param {Function} props.canAccess  - Fungsi canAccess dari usePermissions()
 * @param {import('react').ReactNode} props.children - Konten yang ditampilkan jika diizinkan
 * @returns {import('react').ReactNode}
 */
export function CanAccess({ permission, canAccess, children }) {
  return canAccess(permission) ? children : null;
}
