import React from "react";
import { Skeleton, KpiCardSkeleton } from "./Skeleton.jsx";

/* ============================================================================
   DASHBOARDSKELETON
   Skeleton modern dengan efek shimmer yang meniru bentuk nyata dashboard
   (Pace strip + 6 KPI Big Cards + Card Tabel/Chart).
   Meningkatkan perceived performance selagi menunggu komputasi data.
============================================================================ */
export function DashboardSkeleton({ colors }) {
  return (
    <div className="sm-fadein space-y-6" aria-busy="true" aria-label="Memuat dashboard...">
      {/* Pace strip skeleton */}
      <div
        className="sm-card p-4 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ background: colors?.glassFill, border: `1px solid ${colors?.glassBorder}` }}
      >
        <div className="w-full md:w-1/3 space-y-2">
          <Skeleton className="h-3 w-28 rounded" colors={colors} />
          <Skeleton className="h-5 w-44 rounded-lg" colors={colors} />
        </div>
        <div className="w-full md:w-2/3 space-y-2">
          <Skeleton className="h-4 w-full rounded-full" colors={colors} />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20 rounded" colors={colors} />
            <Skeleton className="h-3 w-20 rounded" colors={colors} />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCardSkeleton colors={colors} count={6} />
      </div>

      {/* Table / Section placeholder */}
      <div
        className="sm-card p-5"
        style={{ background: colors?.glassFill, border: `1px solid ${colors?.glassBorder}` }}
      >
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-4 w-48 rounded" colors={colors} />
          <Skeleton className="h-8 w-28 rounded-xl" colors={colors} />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" colors={colors} />
          <Skeleton className="h-10 w-full rounded-xl" colors={colors} />
          <Skeleton className="h-10 w-full rounded-xl" colors={colors} />
          <Skeleton className="h-10 w-full rounded-xl" colors={colors} />
        </div>
      </div>
    </div>
  );
}
