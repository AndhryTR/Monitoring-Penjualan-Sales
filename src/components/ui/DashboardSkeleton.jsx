/* ============================================================================
   DASHBOARDSKELETON
   Skeleton generik yang meniru bentuk akhir dashboard (baris KPI + kartu berisi
   beberapa baris) — dipakai selagi menunggu proses async yang biasanya cepat
   tapi tidak instan (baca sesi terakhir dari IndexedDB saat app pertama dibuka).
   Shimmer terasa lebih "cepat" secara persepsi dibanding spinner polos karena
   user sudah lihat kira-kira bentuk konten yang akan muncul.
============================================================================ */
export function DashboardSkeleton({ colors }) {
  return (
    <div className="sm-fadein" aria-busy="true" aria-label="Memuat data">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="sm-card p-4 animate-pulse">
            <div className="h-3 w-16 rounded mb-3" style={{ background: colors.surface2 }} />
            <div className="h-6 w-20 rounded" style={{ background: colors.surface2 }} />
          </div>
        ))}
      </div>
      <div className="sm-card p-5 mb-8 animate-pulse">
        <div className="h-4 w-44 rounded mb-5" style={{ background: colors.surface2 }} />
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl" style={{ background: colors.surface2, opacity: 1 - i * 0.08 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
