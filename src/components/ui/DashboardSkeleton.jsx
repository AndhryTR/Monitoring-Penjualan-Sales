export function DashboardSkeleton({ colors }) {
  return (
    <div className="sm-fadein" aria-busy="true" aria-label="Memuat data">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-panel p-4 animate-pulse">
            <div className="h-3 w-16 rounded mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="h-6 w-20 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>
        ))}
      </div>
      <div className="glass-panel p-5 mb-8 animate-pulse">
        <div className="h-4 w-44 rounded mb-5" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", opacity: 1 - i * 0.08 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
