import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtRp, fmtNum, fmtPct } from "../../utils/formatters.js";

/* ============================================================================
   MATRIXTABLE — baris entitas × kolom periode + kolom growth.
   Tiap sel menampilkan metrik aktif; kalau periode itu full bulan, ACH kecil
   di bawah (konsisten dengan tabel Tren Periode). Kolom pertama sticky.
============================================================================ */
export function MatrixTable({ rows, periods, periodColor, metricKey, isMoney, isPct, showAch, colors }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="text-left px-3 py-2 sticky left-0 z-10" style={{ background: colors.modalPanelBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", color: colors.tableHeader, fontWeight: 500, fontSize: 11, textTransform: "uppercase", minWidth: 140 }}>
              Entitas
            </th>
            {periods.map((p, i) => (
              <th key={p.id} className="text-right px-3 py-2 whitespace-nowrap" style={{ color: colors.tableHeader, fontWeight: 500, fontSize: 11, textTransform: "uppercase", borderTop: `2px solid ${periodColor(p, i)}` }}>
                {p.label}
              </th>
            ))}
            <th className="text-right px-3 py-2 whitespace-nowrap" style={{ color: colors.tableHeader, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>Growth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="sm-row">
              <td className="px-3 py-2 sticky left-0 z-10 truncate max-w-[180px]" style={{ background: colors.modalPanelBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
                {r.name}
              </td>
              {r.cells.map((c, i) => {
                const v = c.exists ? (metricKey === "qty" && r.qtyByPeriod ? r.qtyByPeriod[i].qty : metricKey === "qty" ? c.qty : metricKey === "value" ? c.value : metricKey === "ao" ? c.ao : metricKey === "ach" ? c.ach : c.deviasi) : null;
                return (
                  <td key={c.period.id} className="text-right px-3 py-2 whitespace-nowrap">
                    {!c.exists ? (
                      <span className="text-xs" style={{ color: colors.textMuted }}>-</span>
                    ) : (
                      <div>
                        <div className="mono">{v === null || v === undefined ? "-" : isPct ? fmtPct(v) : isMoney ? fmtRp(v) : fmtNum(v)}</div>
                        {showAch && c.exists && c.ach !== null && metricKey !== "ach" && (
                          <div className="text-[10px] mono" style={{ color: c.ach >= 1 ? colors.mint : c.ach >= 0.7 ? colors.gold : colors.coral }}>
                            {fmtPct(c.ach)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="text-right px-3 py-2 whitespace-nowrap">
                {r.growth === null || r.growth === undefined ? (
                  <span className="mono text-xs" style={{ color: colors.textMuted }}>-</span>
                ) : (
                  <span className="mono text-xs font-semibold inline-flex items-center gap-0.5" style={{ color: r.growth >= 0 ? colors.mint : colors.coral }}>
                    {r.growth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {fmtPct(Math.abs(r.growth))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
