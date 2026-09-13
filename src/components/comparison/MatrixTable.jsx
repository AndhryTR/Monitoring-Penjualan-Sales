import { fmtRp, fmtNum, fmtPct } from "../../utils/formatters.js";
import { getAchColor } from "../../constants/thresholds.js";
import { GrowthBadge } from "../ui/GrowthBadge.jsx";
import { TableScrollWrapper } from "../ui/TableScrollWrapper.jsx";

/* ============================================================================
   MATRIXTABLE — baris entitas × kolom periode + kolom growth.
   Tiap sel menampilkan metrik aktif; kalau periode itu full bulan, ACH kecil
   di bawah (konsisten dengan tabel Tren Periode). Kolom pertama sticky.
============================================================================ */
export function MatrixTable({ rows, periods, periodColor, metricKey, isMoney, isPct, showAch, colors }) {
  if (!rows.length) return null;
  return (
    <TableScrollWrapper colors={colors} className="-mx-1">
      <table key={periods.map((p) => p.id).join("|") + ":" + metricKey} className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
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
                          <div className="text-[10px] mono" style={{ color: getAchColor(c.ach, colors) }}>
                            {fmtPct(c.ach)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="text-right px-3 py-2 whitespace-nowrap">
                <GrowthBadge growth={r.growth} colors={colors} variant="inline" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScrollWrapper>
  );
}
