import { useMemo } from "react";
import { dateStrToLocalDate, todayLocalDateStr, effectiveKartonQty } from "../../utils/excelParse.js";
import { sumBy } from "lodash";

/* ============================================================================
   EXCEL REPORT — HTML TWIN
   Replikasi visual persis dari worksheet Excel yang dihasilkan
   utils/excelExport.js → exportToExcel(). Dipakai oleh ExportMenu saat user
   pilih "Excel sebagai Gambar" — HTML twin di-render off-screen, lalu
   di-capture oleh html2canvas.

   Tujuan: gambar hasil capture terlihat IDENTIK dengan file Excel (warna,
   merge, gradient, font) sehingga konsistensi template terjaga.

   Catatan: achGradientColor sengaja di-duplicate dari excelExport.js (bukan
   di-import) supaya file ini self-contained dan excelExport.js tidak perlu
   diubah. Kedua fungsi harus tetap identik — kalau satu diubah, ubah yang
   satunya juga.
============================================================================ */

// ─── Konstanta visual — IDENTIK dengan excelExport.js ───────────────────────
const XL_COLORS = {
  headerCyan: "#6DD9FF",
  headerPurple: "#7030A0",
  mint: "#4BFF9C",
  yellowTier: "#FFFF00",
  gold: "#FFC000",
  navy: "#002060",
  border: "#D9D9D9",
  text: "#000000",
  textWhite: "#FFFFFF",
};

const XL_TIER_FILL = {
  mint: XL_COLORS.mint,
  amber: XL_COLORS.yellowTier,
  violet: XL_COLORS.gold,
};

const ACH_GRADIENT_STOPS = [
  { pct: 0, rgb: [248, 105, 107] },   // merah pastel
  { pct: 0.7, rgb: [255, 235, 132] }, // kuning pastel
  { pct: 1.0, rgb: [99, 190, 123] },  // hijau pastel
];

function achGradientColor(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  const p = Math.max(0, pct);
  const stops = ACH_GRADIENT_STOPS;
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].pct && p <= stops[i + 1].pct) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const range = hi.pct - lo.pct;
  const t = range > 0 ? Math.min(1, Math.max(0, (p - lo.pct) / range)) : 1;
  const r = Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t);
  const g = Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t);
  const b = Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// Lebar kolom dalam px — konversi dari char width di excelExport.js
// Excel default: 1 char ≈ 7px at Calibri 10pt
// Catatan: kolom SALESMAN (idx 1) dan PRODUK FOKUS NAMA (idx 10) sengaja dilebarkan
// dari konversi naif supaya nama panjang (mis. "BUDI KARYAWAN") tidak terpotong.
// Walau teks sudah wrap, lebar lebih lega = lebih sedikit baris per cell = lebih rapi.
const COL_WIDTHS_CHAR = [4, 28, 16, 8, 16, 8, 11, 8, 16, 8, 28, 11, 12, 10];
const COL_WIDTHS_PX = COL_WIDTHS_CHAR.map((w) => Math.max(32, w * 7 + 6));

const TOTAL_WIDTH_PX = COL_WIDTHS_PX.reduce((a, b) => a + b, 0);

// Helper format angka — sama dengan Excel number format
function fmtMoney(n) {
  if (n === null || n === undefined || n === "") return "-";
  const num = Number(n) || 0;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(num);
}
function fmtInt(n) {
  if (n === null || n === undefined || n === "") return "-";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}
function fmtPct(pct, decimals = 2) {
  if (pct === null || pct === undefined || pct === "-" || Number.isNaN(pct)) return "-";
  const v = pct * 100;
  return v.toFixed(decimals) + "%";
}

// Format tanggal Indonesia untuk info header
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtDateID(dateStr) {
  if (!dateStr) return "-";
  const d = dateStrToLocalDate(dateStr);
  if (!d) return dateStr;
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtMonthYear(dateStr) {
  if (!dateStr) return "-";
  const d = dateStrToLocalDate(dateStr);
  if (!d) return dateStr;
  return `${MONTHS_ID[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

/* ============================================================================
   KOMPONEN UTAMA
============================================================================ */
export function ExcelReportHtml({ agg, targets, opts }) {
  const { workDays, depotName } = opts || {};

  // Pre-compute data untuk render — mirror logic di exportToExcel
  const data = useMemo(() => {
    const sdHariIni = agg.meta.uniqueDays;
    const sisaHk = Math.max(0, (workDays || 0) - sdHariIni);
    const timeGone = workDays ? sdHariIni / workDays : 0;

    // Per sales: breakdown groups + focus
    const salesRows = agg.bySales.map((sm, idx) => {
      const tierFill = XL_TIER_FILL[sm.tier] || XL_COLORS.yellowTier;
      const maxSub = Math.max(sm.groups.length, sm.focus.length);
      const subRows = [];
      for (let i = 0; i < maxSub; i++) {
        subRows.push({
          group: i < sm.groups.length ? sm.groups[i] : null,
          focus: i < sm.focus.length ? sm.focus[i] : null,
        });
      }
      return {
        idx, sm, tierFill, subRows,
        hasFocus: sm.focus.length > 0,
      };
    });

    // TOTAL
    const tTargetV = sumBy(agg.bySales, "targetValue");
    const tTargetAo = sumBy(agg.bySales, "targetAo");
    const tRealV = sumBy(agg.bySales, "realisasiValue");
    const tRealAo = sumBy(agg.bySales, "realisasiAo");
    const anyUnconvertible = agg.bySales.some((sm) => sm.focus.some((f) => f.hasUnconvertible));

    return {
      sdHariIni, sisaHk, timeGone,
      salesRows,
      total: { tTargetV, tTargetAo, tRealV, tRealAo, anyUnconvertible },
      firstDate: agg.meta.firstDate,
      lastDate: agg.meta.lastDate,
    };
  }, [agg, targets, workDays]);

  // Inline style helpers
  // Catatan: tableLayout:"fixed" di <table> memaksa kolom menghormati width
  // yang ditetapkan. Tanpa whiteSpace:"normal" + wordBreak:"break-word",
  // teks panjang (mis. "BUDI KARYAWAN" atau "TAIKO CHIPS 10 X 10") akan
  // terpotong di ujung sel karena browser default truncate.
  // Dengan wrapping, teks turun ke baris baru — tinggi baris auto-adjust.
  const cellBase = {
    padding: "5px 6px",
    border: `0.5pt solid ${XL_COLORS.border}`,
    fontFamily: "Calibri, Arial, sans-serif",
    fontSize: "10pt",
    color: XL_COLORS.text,
    verticalAlign: "middle",
    whiteSpace: "normal",        // izinkan text wrap ke baris baru
    wordBreak: "break-word",     // pecah kata panjang jika perlu
    overflowWrap: "break-word",  // fallback untuk browser lama
    lineHeight: "1.25",          // spacing antar baris dalam sel multi-line
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  };
  const cellRight = { ...cellBase, textAlign: "right" };
  const cellCenter = { ...cellBase, textAlign: "center" };
  const cellLeft = { ...cellBase, textAlign: "left" };

  return (
    <div
      style={{
        width: `${TOTAL_WIDTH_PX}px`,
        background: "#FFFFFF",
        padding: "16px",
        fontFamily: "Calibri, Arial, sans-serif",
        fontSize: "10pt",
        color: XL_COLORS.text,
        boxSizing: "content-box",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          width: `${TOTAL_WIDTH_PX}px`,
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          {COL_WIDTHS_PX.map((w, i) => (
            <col key={i} style={{ width: `${w}px` }} />
          ))}
        </colgroup>

        <tbody>
          {/* ───── BLOK INFO HEADER (baris 1-5) ───── */}
          <tr>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold" }}>BULAN</td>
            <td style={{ ...cellLeft, border: "none" }}>{fmtMonthYear(data.firstDate)}</td>
            <td colSpan={9} style={{ border: "none" }} />
            <td style={{ ...cellRight, border: "none", fontWeight: "bold" }}>{fmtDateID(data.lastDate)}</td>
            <td style={{ border: "none" }} />
          </tr>
          <tr>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold" }}>HARI KERJA</td>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold" }}>{fmtInt(workDays || 0)}</td>
            <td colSpan={11} style={{ border: "none" }} />
          </tr>
          <tr>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold" }}>SD HARI INI</td>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold" }}>{fmtInt(data.sdHariIni)}</td>
            <td colSpan={11} style={{ border: "none" }} />
          </tr>
          <tr>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold" }}>SISA HK</td>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold" }}>{fmtInt(data.sisaHk)}</td>
            <td colSpan={11} style={{ border: "none" }} />
          </tr>
          <tr>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold" }}>TIME GONE</td>
            <td style={{ ...cellLeft, border: "none", fontWeight: "bold", background: XL_COLORS.gold }}>
              {fmtPct(data.timeGone)}
            </td>
            <td colSpan={4} style={{ border: "none" }} />
            <td
              colSpan={4}
              style={{
                ...cellCenter,
                border: "none",
                fontWeight: "bold",
                fontSize: "13pt",
              }}
            >
              {depotName || "DEPO LOTIM"}
            </td>
            <td colSpan={3} style={{ border: "none" }} />
          </tr>

          {/* ───── Spacer kosong ───── */}
          <tr><td colSpan={14} style={{ border: "none", height: "8px" }} /></tr>

          {/* ───── HEADER KOLOM (baris 6-7) ───── */}
          <tr>
            <td rowSpan={2} style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>NO</td>
            <td rowSpan={2} style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>SALESMAN</td>
            <td colSpan={2} style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>TARGET</td>
            <td colSpan={2} style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>REALISASI</td>
            <td colSpan={2} style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>ACH</td>
            <td colSpan={2} style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>DEVIASI</td>
            <td colSpan={4} style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerPurple, color: XL_COLORS.textWhite }}>PRODUK FOKUS</td>
          </tr>
          <tr>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>VALUE</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>AO</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>VALUE</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>AO</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>VALUE</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>AO</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>VALUE</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerCyan }}>AO</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerPurple, color: XL_COLORS.textWhite }}>NAMA</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerPurple, color: XL_COLORS.textWhite }}>TARGET</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerPurple, color: XL_COLORS.textWhite }}>REALISASI</td>
            <td style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerPurple, color: XL_COLORS.textWhite }}>%</td>
          </tr>

          {/* ───── BARIS DATA PER SALES ───── */}
          {data.salesRows.map(({ idx, sm, tierFill, subRows, hasFocus }) => (
            <SalesRowsBlock
              key={sm.code}
              idx={idx}
              sm={sm}
              tierFill={tierFill}
              subRows={subRows}
              hasFocus={hasFocus}
              cellBase={cellBase}
              cellLeft={cellLeft}
              cellRight={cellRight}
              cellCenter={cellCenter}
            />
          ))}

          {/* ───── BARIS TOTAL ───── */}
          <TotalRow total={data.total} cellBase={cellBase} cellLeft={cellLeft} cellRight={cellRight} cellCenter={cellCenter} />

          {/* ───── CATATAN KAKI (kalau ada unconvertible) ───── */}
          {data.total.anyUnconvertible && (
            <tr>
              <td colSpan={14} style={{ ...cellLeft, border: "none", fontSize: "9pt", paddingTop: "12px" }}>
                * Sebagian transaksi produk ini tidak bisa dikonversi ke satuan karton (tidak ada baris satuan KARTON untuk produk tsb di data mentah) — angka realisasi memakai satuan asli.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer caption — ditampilkan di gambar tapi tidak di Excel (info only) */}
      <div style={{
        marginTop: "16px",
        fontSize: "8pt",
        color: "#888",
        textAlign: "right",
        fontFamily: "Calibri, Arial, sans-serif",
      }}>
        Dihasilkan oleh Monitoring Penjualan — {todayLocalDateStr()}
      </div>
    </div>
  );
}

/* ─── Sub-komponen: blok baris untuk 1 sales (header + sub-rows) ─── */
function SalesRowsBlock({ idx, sm, tierFill, subRows, hasFocus, cellBase, cellLeft, cellRight, cellCenter }) {
  return (
    <>
      {/* Baris header sales */}
      <tr>
        <td rowSpan={subRows.length + 1} style={{ ...cellCenter, fontWeight: "bold" }}>
          {idx + 1}
        </td>
        <td style={{ ...cellLeft, fontWeight: "bold", background: tierFill }}>{sm.name}</td>
        <td style={{ ...cellRight, background: tierFill }}>{fmtMoney(sm.targetValue)}</td>
        <td style={{ ...cellCenter, background: tierFill }}>{fmtInt(sm.targetAo)}</td>
        <td style={{ ...cellRight, background: tierFill }}>{fmtMoney(sm.realisasiValue)}</td>
        <td style={{ ...cellCenter, background: tierFill }}>{fmtInt(sm.realisasiAo)}</td>
        <td
          style={{
            ...cellCenter,
            fontWeight: "bold",
            background: sm.targetValue ? achGradientColor(sm.ach) : "transparent",
          }}
        >
          {sm.targetValue ? fmtPct(sm.ach) : "-"}
        </td>
        <td
          style={{
            ...cellCenter,
            fontWeight: "bold",
            background: sm.targetAo ? achGradientColor(sm.achAo) : "transparent",
          }}
        >
          {sm.targetAo ? fmtPct(sm.achAo) : "-"}
        </td>
        <td style={{ ...cellRight, background: XL_COLORS.yellowTier }}>
          {fmtMoney(sm.targetValue ? sm.deviasiValue : 0)}
        </td>
        <td style={{ ...cellCenter, background: XL_COLORS.yellowTier }}>
          {fmtInt(sm.targetAo ? sm.deviasiAo : 0)}
        </td>
        {hasFocus ? (
          <td colSpan={4} style={{ ...cellCenter, fontWeight: "bold", background: XL_COLORS.headerPurple, color: XL_COLORS.textWhite }}>
            {sm.name}
          </td>
        ) : (
          <td colSpan={4} style={{ ...cellLeft, background: tierFill, fontSize: "9pt" }}>
            *PRODUK FOKUS DALAM SATUAN KARTON
          </td>
        )}
      </tr>

      {/* Sub-rows: groups × focus */}
      {subRows.map(({ group, focus }, i) => (
        <tr key={i}>
          {group ? (
            <>
              <td style={cellLeft}>{group.name}</td>
              <td style={cellRight}>{fmtMoney(group.targetValue)}</td>
              <td style={{ ...cellCenter, background: tierFill }}>{fmtInt(group.targetAo)}</td>
              <td style={cellRight}>{fmtMoney(group.realisasiValue)}</td>
              <td style={cellCenter}>{fmtInt(group.realisasiAo)}</td>
              <td
                style={{
                  ...cellCenter,
                  fontWeight: "bold",
                  background: group.targetValue ? achGradientColor(group.ach) : "transparent",
                }}
              >
                {group.targetValue ? fmtPct(group.ach) : "-"}
              </td>
              <td
                style={{
                  ...cellCenter,
                  fontWeight: "bold",
                  background: group.targetAo ? achGradientColor(group.achAo) : "transparent",
                }}
              >
                {group.targetAo ? fmtPct(group.achAo) : "-"}
              </td>
              <td style={{ ...cellRight, background: XL_COLORS.yellowTier }}>{fmtMoney(group.deviasiValue)}</td>
              <td style={{ ...cellCenter, background: XL_COLORS.yellowTier }}>{fmtInt(group.deviasiAo)}</td>
            </>
          ) : (
            <>
              <td style={cellLeft} />
              <td style={cellRight} />
              <td style={cellCenter} />
              <td style={cellRight} />
              <td style={cellCenter} />
              <td style={cellCenter} />
              <td style={cellCenter} />
              <td style={cellRight} />
              <td style={cellCenter} />
            </>
          )}
          {focus ? (
            <>
              <td style={cellLeft}>{focus.hasUnconvertible ? `${focus.name} *` : focus.name}</td>
              <td style={cellCenter}>{fmtInt(focus.target)}</td>
              <td style={cellCenter}>{fmtInt(focus.realisasi)}</td>
              <td
                style={{
                  ...cellCenter,
                  fontWeight: "bold",
                  background: focus.target ? achGradientColor(focus.pct) : "transparent",
                }}
              >
                {fmtPct(focus.pct, 1)}
              </td>
            </>
          ) : (
            <>
              <td style={cellLeft} />
              <td style={cellCenter} />
              <td style={cellCenter} />
              <td style={cellCenter} />
            </>
          )}
        </tr>
      ))}
    </>
  );
}

/* ─── Sub-komponen: baris TOTAL ─── */
function TotalRow({ total, cellBase, cellLeft, cellRight, cellCenter }) {
  const { tTargetV, tTargetAo, tRealV, tRealAo } = total;
  const totalAchV = tTargetV ? tRealV / tTargetV : null;
  const totalAchAo = tTargetAo ? tRealAo / tTargetAo : null;
  const navyStyle = { background: XL_COLORS.navy, color: XL_COLORS.textWhite };

  return (
    <tr>
      <td style={{ ...cellCenter, ...navyStyle }} />
      <td style={{ ...cellLeft, ...navyStyle, fontWeight: "bold" }}>TOTAL</td>
      <td style={{ ...cellRight, ...navyStyle, fontWeight: "bold" }}>{fmtMoney(tTargetV)}</td>
      <td style={{ ...cellCenter, ...navyStyle, fontWeight: "bold" }}>{fmtInt(tTargetAo)}</td>
      <td style={{ ...cellRight, ...navyStyle, fontWeight: "bold" }}>{fmtMoney(tRealV)}</td>
      <td style={{ ...cellCenter, ...navyStyle, fontWeight: "bold" }}>{fmtInt(tRealAo)}</td>
      <td
        style={{
          ...cellCenter,
          fontWeight: "bold",
          background: tTargetV ? achGradientColor(totalAchV) : "transparent",
        }}
      >
        {tTargetV ? fmtPct(totalAchV) : "-"}
      </td>
      <td
        style={{
          ...cellCenter,
          fontWeight: "bold",
          background: tTargetAo ? achGradientColor(totalAchAo) : "transparent",
        }}
      >
        {tTargetAo ? fmtPct(totalAchAo) : "-"}
      </td>
      <td style={{ ...cellRight, ...navyStyle, fontWeight: "bold" }}>{fmtMoney(tTargetV - tRealV)}</td>
      <td style={{ ...cellCenter, ...navyStyle, fontWeight: "bold" }}>{fmtInt(tTargetAo - tRealAo)}</td>
      <td style={cellLeft} />
      <td style={cellCenter} />
      <td style={cellCenter} />
      <td style={cellCenter} />
    </tr>
  );
}

export default ExcelReportHtml;
