import { useState, useMemo, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { fmtNum } from "../../utils/formatters.js";

/* ============================================================================
   DATATABLE
   Tabel dengan sort & search. Di desktop (≥640px) tampil sebagai tabel klasik
   dengan sticky header. Di mobile (<640px) tampil sebagai card-stack — tiap
   baris jadi kartu dengan kolom pertama sebagai judul, kolom data sisanya
   dalam grid 2-kolom label-value, dan kolom aksi sebagai footer.
============================================================================ */
export function DataTable({ columns, rows, initialSortKey, colors, searchable, searchKeys, searchPlaceholder, pageSize }) {
  const [sortKey, setSortKey] = useState(initialSortKey || columns[0].key);
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");
  // visibleCount HANYA relevan kalau pageSize diberikan (mis. tabel transaksi
  // dengan ribuan baris). Kalau tidak diberikan, semua baris hasil search+sort
  // ditampilkan sekaligus (perilaku lama, tetap dipakai di 8+ tempat lain).
  const [visibleCount, setVisibleCount] = useState(pageSize || Infinity);

  // Reset ke halaman pertama setiap kali dataset SUMBER berubah (mis. filter
  // global/lokal berubah) atau query pencarian berubah — supaya user tidak
  // "stuck" melihat baris ke-1500 dari hasil filter baru yang cuma 200 baris.
  // Sengaja TIDAK reset saat ganti sortKey/sortDir: re-sort tetap beroperasi
  // di atas SELURUH data (bukan cuma yang sudah termuat), jadi user boleh
  // ganti urutan tanpa kehilangan progres "sudah muat berapa banyak".
  useEffect(() => { setVisibleCount(pageSize || Infinity); }, [rows, query, pageSize]);

  // Kolom yang dijadikan target pencarian: pakai searchKeys eksplisit kalau ada,
  // kalau tidak, fallback ke semua kolom yang nilainya berupa string di baris pertama.
  const effectiveSearchKeys = useMemo(() => {
    if (searchKeys && searchKeys.length) return searchKeys;
    if (!rows.length) return [];
    return columns.map((c) => c.key).filter((k) => typeof rows[0][k] === "string");
  }, [searchKeys, columns, rows]);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((row) => effectiveSearchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)));
  }, [rows, searchable, query, effectiveSearchKeys]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);
  const toggleSort = (k) => { if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };

  // Slice HANYA di sini — setelah search & sort selesai jalan di atas SELURUH
  // `sorted`. Ini titik krusial fix bug sebelumnya: dulu pemotongan baris
  // (incremental load) terjadi SEBELUM data masuk ke DataTable, jadi search &
  // sort cuma bekerja di window yang sudah "dimuat", bukan di seluruh hasil
  // filter — user bisa salah baca data (mis. sort by Value cuma mengurutkan
  // 500 baris pertama, bukan top-value dari semua transaksi).
  const visibleRows = pageSize ? sorted.slice(0, visibleCount) : sorted;
  const hasMore = Boolean(pageSize) && sorted.length > visibleCount;

  // Untuk tampilan card mobile: kolom pertama jadi judul kartu, kolom lainnya
  // (yang punya label non-kosong) jadi pasangan label-value di grid 2 kolom.
  // Kolom dengan label kosong (biasanya tombol aksi seperti DrilldownButton)
  // ditampilkan sebagai footer kartu agar tidak mengganggu layout grid.
  const titleCol = columns.find((c) => c.label) || columns[0];
  const dataCols = columns.filter((c) => c !== titleCol && c.label);
  const actionCols = columns.filter((c) => !c.label);

  return (
    <div className="sm-card overflow-hidden">
      {searchable && (
        <div className="px-4 pt-4 pb-1">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder || "Cari..."}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-sm outline-none"
              style={{ background: colors.surface2, border: `1px solid ${colors.border}`, color: colors.text }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }}>
                <X size={14} />
              </button>
            )}
          </div>
          {query && (
            <div className="text-xs mt-1.5" style={{ color: colors.textMuted }}>
              {sorted.length} hasil untuk "{query}"
            </div>
          )}
        </div>
      )}

      {/* Desktop (≥640px): tabel klasik dengan sticky header & sort */}
      <div className="hidden sm:block overflow-auto max-h-[65vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: colors.surface2 }}>
              {columns.map((c) => (
                <th key={c.key} onClick={() => c.label && toggleSort(c.key)} className="px-4 py-3 text-left cursor-pointer select-none whitespace-nowrap"
                  style={{ color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", background: colors.surface2, boxShadow: `0 1px 0 ${colors.border}` }}>
                  {c.label} {sortKey === c.key && (sortDir === "asc" ? "↑" : "↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className="sm-row" style={{ borderTop: `1px solid ${colors.border}` }}>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 whitespace-nowrap">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center" style={{ color: colors.textMuted }}>
                {query ? "Tidak ada hasil yang cocok dengan pencarian" : "Belum ada data untuk filter ini"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile (<640px): card-stack — tiap baris jadi kartu dengan judul +
          grid 2-kolom label-value + optional footer aksi. Menghindari horizontal
          scroll yang menyiksa di layar sempit (mis. tabel 7-8 kolom). */}
      <div className="sm:hidden max-h-[65vh] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: colors.textMuted }}>
            {query ? "Tidak ada hasil yang cocok dengan pencarian" : "Belum ada data untuk filter ini"}
          </div>
        ) : (
          <div>
            {visibleRows.map((row, i) => (
              <div
                key={i}
                className="px-4 py-3.5"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${colors.border}` }}
              >
                {/* Judul kartu = kolom pertama yang punya label */}
                <div className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
                  {titleCol.render ? titleCol.render(row) : row[titleCol.key]}
                </div>

                {/* Grid 2-kolom label-value untuk kolom data sisanya */}
                {dataCols.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {dataCols.map((c) => (
                      <div key={c.key} className="min-w-0">
                        <div
                          className="uppercase tracking-wider mb-0.5"
                          style={{ color: colors.textMuted, fontSize: 9.5, letterSpacing: "0.04em" }}
                        >
                          {c.label}
                        </div>
                        <div className="text-sm mono truncate" style={{ color: colors.text }}>
                          {c.render ? c.render(row) : row[c.key]}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer aksi (tombol drilldown, dll) — full-width di bawah */}
                {actionCols.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    {actionCols.map((c) => (
                      <span key={c.key}>
                        {c.render ? c.render(row) : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="text-center py-4 px-4" style={{ borderTop: `1px solid ${colors.border}` }}>
          <button
            onClick={() => setVisibleCount((c) => c + pageSize)}
            className="sm-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: colors.surface2, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            <ChevronDown size={14} /> Muat lebih banyak ({fmtNum(sorted.length - visibleCount)} baris tersisa)
          </button>
          <div className="text-xs mt-2" style={{ color: colors.textMuted }}>
            Menampilkan {fmtNum(visibleCount)} dari {fmtNum(sorted.length)} baris
          </div>
        </div>
      )}
    </div>
  );
}
