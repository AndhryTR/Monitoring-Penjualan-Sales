import React from "react";

/**
 * Komponen Skeleton Shimmer serbaguna untuk status loading yang halus dan modern.
 * Menggunakan utility background shimmer CSS yang selaras dengan tema gelap/terang.
 *
 * @param {object} props
 * @param {string} [props.className=""] - kelas Tailwind (lebar, tinggi, radius)
 * @param {object} [props.colors] - token tema aktif
 * @param {object} [props.style] - custom style tambahan
 */
export function Skeleton({ className = "h-4 w-full rounded-md", colors, style = {} }) {
  const bg = colors ? colors.surface2 || colors.glassFill || "rgba(255, 255, 255, 0.08)" : undefined;

  return (
    <div
      className={`sm-shimmer ${className}`}
      style={{
        backgroundColor: bg,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton khusus kartu KPI besar (meniru layout KpiBigCard saat data agregat sedang diproses).
 */
export function KpiCardSkeleton({ colors, count = 1 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {items.map((key) => (
        <div
          key={key}
          className="sm-card p-5 min-w-0 h-full flex flex-col justify-between"
          style={{
            background: colors?.glassFill,
            border: `1px solid ${colors?.glassBorder || "rgba(255,255,255,0.08)"}`,
          }}
        >
          {/* Header placeholder */}
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3.5 w-24 rounded" colors={colors} />
            <Skeleton className="h-7 w-7 rounded-lg" colors={colors} />
          </div>

          {/* Value placeholder */}
          <div className="my-2">
            <Skeleton className="h-8 w-36 rounded-lg" colors={colors} />
          </div>

          {/* Chart/progress placeholder */}
          <div className="my-2">
            <Skeleton className="h-5 w-full rounded" colors={colors} />
          </div>

          {/* Footer placeholder */}
          <div
            className="flex items-center justify-between mt-3 pt-3"
            style={{ borderTop: `1px solid ${colors?.glassBorder || "rgba(255,255,255,0.06)"}` }}
          >
            <Skeleton className="h-3 w-28 rounded" colors={colors} />
            <Skeleton className="h-3 w-16 rounded" colors={colors} />
          </div>
        </div>
      ))}
    </>
  );
}

export default Skeleton;
