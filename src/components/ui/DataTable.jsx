import { useState, useMemo, useEffect } from "react";
import { Search, X, ChevronLeft, ChevronRight, ArrowUp, ArrowUpDown } from "lucide-react";
import { fmtNum } from "../../utils/formatters.js";
import { TableScrollWrapper } from "./TableScrollWrapper.jsx";
import { CustomSelect } from "./CustomSelect.jsx";

/* ============================================================================
   DATATABLE
   Tabel dengan sort & search. Di desktop (≥640px) tampil sebagai tabel klasik
   dengan sticky header. Di mobile (<640px) tampil sebagai card-stack — tiap
   baris jadi kartu dengan kolom pertama sebagai judul, kolom data sisanya
   dalam grid 2-kolom label-value, dan kolom aksi sebagai footer.
============================================================================ */
export function DataTable({ columns, rows, initialSortKey, colors, searchable, searchKeys, searchPlaceholder, pageSize, mobileTitleKey, mobileSubtitleKey, mobileCornerKey, rowKey }) {
  const [sortKey, setSortKey] = useState(initialSortKey || columns[0].key);
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(pageSize || null);

  useEffect(() => {
    if (pageSize) setPerPage(pageSize);
  }, [pageSize]);

  const effectivePageSize = perPage || pageSize;

  const pageSizeOptions = useMemo(() => {
    const defaults = [25, 50, 100, 250, 500];
    if (effectivePageSize && !defaults.includes(effectivePageSize)) {
      return [...defaults, effectivePageSize].sort((a, b) => a - b);
    }
    return defaults;
  }, [effectivePageSize]);

  // Reset ke halaman pertama setiap kali dataset SUMBER berubah (mis. filter
  // global/lokal berubah), query pencarian berubah, atau perPage berubah.
  // Sengaja TIDAK reset saat ganti sortKey/sortDir: re-sort tetap beroperasi
  // di atas SELURUH data, jadi user boleh ganti urutan tanpa kehilangan posisi halaman.
  useEffect(() => { setPage(1); }, [rows, query, perPage]);

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
    const isAsc = sortDir === "asc";
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === vb) return 0;
      if (va === null || va === undefined || va === "") return isAsc ? 1 : -1;
      if (vb === null || vb === undefined || vb === "") return isAsc ? -1 : 1;
      if (typeof va === "string" || typeof vb === "string") {
        const sa = String(va);
        const sb = String(vb);
        const cmp = sa < sb ? -1 : (sa > sb ? 1 : 0);
        return isAsc ? cmp : -cmp;
      }
      const diff = (Number(va) || 0) - (Number(vb) || 0);
      return isAsc ? diff : -diff;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);
  const toggleSort = (k) => { if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };

  // Slice HANYA di sini — setelah search & sort selesai jalan di atas SELURUH
  // `sorted`. Titik krusial: pemotongan baris (per-halaman) terjadi SETELAH
  // data masuk ke DataTable, jadi search & sort bekerja di seluruh hasil
  // filter, bukan di window yang sudah "dimuat" — user tidak salah baca data
  // (mis. sort by Value tetap mengurutkan semua transaksi, bukan cuma halaman ini).
  const totalPages = effectivePageSize ? Math.max(1, Math.ceil(sorted.length / effectivePageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleRows = effectivePageSize ? sorted.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize) : sorted;

  // Nomor halaman yang ditampilkan sebagai pill: kalau total sedikit (≤7)
  // tampilkan semua; kalau banyak, tampilkan halaman pertama/terakhir + 1
  // sebelum/sesudah halaman aktif, sisanya diringkas jadi "…".
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, 2, totalPages - 1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  }, [totalPages, currentPage]);

  // Untuk tampilan card mobile: default-nya kolom pertama yang punya label jadi
  // judul kartu (perilaku lama, tetap dipakai di 8+ tempat lain). Kalau
  // mobileTitleKey diberikan (mis. tabel Transaksi), judul dipilih eksplisit —
  // penting karena kolom pertama tidak selalu paling informatif untuk di-scan
  // (mis. "Tanggal" kurang berguna sebagai judul dibanding "Outlet"/"Produk").
  const titleCol = mobileTitleKey ? columns.find((c) => c.key === mobileTitleKey) : (columns.find((c) => c.label) || columns[0]);
  const subtitleCol = mobileSubtitleKey ? columns.find((c) => c.key === mobileSubtitleKey) : null;
  const cornerCol = mobileCornerKey ? columns.find((c) => c.key === mobileCornerKey) : null;
  const dataCols = columns.filter((c) => c !== titleCol && c !== subtitleCol && c !== cornerCol && c.label);
  const actionCols = columns.filter((c) => !c.label);

  // Judul/subjudul/pojok kartu SENGAJA tidak selalu memanggil c.render(row) —
  // beberapa render kolom (mis. outletName) punya styling khusus tabel desktop
  // (truncate + max-w piksel tetap) yang kalau dipakai apa adanya di kartu
  // mobile (lebar penuh) malah bikin teks terpotong tanpa alasan jelas.
  // - Kalau kolom ini dipilih via mobileTitleKey/subtitleKey/cornerKey (eksplisit),
  //   tampilkan NILAI MENTAH saja (tanpa constraint desktop).
  // - Kalau tidak (perilaku lama/default, cuma titleCol yang bisa begini),
  //   tetap panggil render seperti biasa demi backward-compat.
  const mobileCellValue = (col, row, isExplicit) => {
    if (!col) return null;
    if (!isExplicit && col.render) return col.render(row);
    const v = row[col.key];
    return v === undefined || v === null || v === "" ? "-" : v;
  };

  return (
    <div className="sm-card overflow-hidden">
      {searchable && (
        <div className="px-4 pt-4 pb-1">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textMuted }} />
            <input
              type="text"
              aria-label={searchPlaceholder || "Cari data tabel"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder || "Cari..."}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-sm outline-none"
              style={{ background: colors.glassFill, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${colors.glassBorder}`, color: colors.text }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:opacity-75 transition-opacity"
                style={{ color: colors.textMuted }}
              >
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
      <TableScrollWrapper colors={colors} className="max-h-[65vh] overflow-y-auto" wrapperClassName="hidden sm:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: colors.glassFillStrong, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
              {columns.map((c) => {
                const isSortable = Boolean(c.label);
                const isCurrentSort = sortKey === c.key;
                const sortDirection = isCurrentSort ? (sortDir === "asc" ? "ascending" : "descending") : "none";
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={isSortable ? sortDirection : undefined}
                    onClick={() => isSortable && toggleSort(c.key)}
                    className={`px-4 py-3 text-left select-none whitespace-nowrap ${isSortable ? "cursor-pointer" : ""}`}
                    style={{
                      color: colors.tableHeader,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      background: colors.glassFillStrong,
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      boxShadow: `0 1px 0 ${colors.glassBorderElevated}`,
                    }}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSort(c.key);
                        }}
                        aria-label={`Urutkan berdasarkan ${c.label}${isCurrentSort ? `, saat ini ${sortDir === "asc" ? "naik" : "turun"}` : ""}`}
                        className="group inline-flex items-center gap-1.5 uppercase font-semibold transition-colors focus-visible:outline-none focus-visible:underline rounded"
                        style={{ color: isCurrentSort ? colors.text : colors.tableHeader }}
                      >
                        <span>{c.label}</span>
                        <span className="inline-flex items-center">
                          {isCurrentSort ? (
                            <ArrowUp
                              size={12}
                              className="shrink-0 transition-transform duration-200"
                              style={{
                                color: colors.mint,
                                transform: sortDir === "asc" ? "rotate(0deg)" : "rotate(180deg)",
                              }}
                            />
                          ) : (
                            <ArrowUpDown size={11} className="shrink-0 opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60 transition-opacity" style={{ color: colors.textMuted }} />
                          )}
                        </span>
                      </button>
                    ) : (
                      c.label || <span className="sr-only">Aksi</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody key={`${currentPage}-${sortKey}-${sortDir}`} className="sm-fadein">
            {visibleRows.map((row, i) => (
              // ⚠️ Sprint 4 / K2: stable key — pakai rowKey prop bila disupply,
              // fallback ke composite dari row values (bukan array index).
              // Sort/filter/scroll reorder rows; index-based key causes React
              // reuse DOM for wrong row, breaking future row-level state
              // (focus, transitions, expandable rows, etc.).
              //
              // ⚠️ Sprint 18d16 / Bugfix: HAPUS salesName & productName dari
              // fallback karena TIDAK UNIK untuk tabel transaksi (banyak
              // transaksi dari sales yang sama dengan produk yang sama → semua
              // dapat key identik → React hanya render 1 row per unique key,
              // sisanya di-drop → tabel tidak update saat filter/search berubah.
              // Sekarang fallback: row.code || row.name || r-${i}.
              // - Sales/Group tables punya code/name unik → safe
              // - Transaction/Outlet tables tidak punya code/name → fallback ke
              //   index r-${i} yang selalu unik dalam satu render
              <tr key={typeof rowKey === "function" ? rowKey(row, i) : (rowKey && row[rowKey] !== undefined ? row[rowKey] : (row.code || row.name || `r-${i}`))} className="sm-row" style={{ borderTop: `1px solid ${colors.glassBorder}`, background: i % 2 === 1 ? colors.glassSubtle : "transparent" }}>
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
      </TableScrollWrapper>

      {/* Mobile (<640px): card-stack — tiap baris jadi kartu dengan judul +
          grid 2-kolom label-value + optional footer aksi. Menghindari horizontal
          scroll yang menyiksa di layar sempit (mis. tabel 7-8 kolom). */}
      <div className="sm:hidden">
        {/* Mobile sort bar agar pengguna mobile juga dapat memilih urutan */}
        {columns.some((c) => c.label) && (
          <div
            className="px-4 py-2.5 flex items-center justify-between gap-2 border-b"
            style={{ borderColor: colors.glassBorder, background: colors.glassSubtle }}
          >
            <span className="text-xs font-medium" style={{ color: colors.textMuted }}>
              Urutkan:
            </span>
            <div className="flex items-center gap-2">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                aria-label="Pilih kolom pengurutan data"
                className="text-xs rounded-lg px-2.5 py-1 outline-none font-medium cursor-pointer"
                style={{
                  background: colors.glassFill,
                  color: colors.text,
                  border: `1px solid ${colors.glassBorder}`,
                }}
              >
                {columns
                  .filter((c) => c.label)
                  .map((c) => (
                    <option
                      key={c.key}
                      value={c.key}
                      style={{ background: colors.surface || "#111827", color: colors.text || "#F9FAFB" }}
                    >
                      {c.label}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                aria-label={`Arah urutan: ${sortDir === "asc" ? "naik (A-Z / terkecil)" : "turun (Z-A / terbesar)"}`}
                className="sm-btn p-1 rounded-lg text-xs flex items-center justify-center w-7 h-7"
                style={{ color: colors.text, border: `1px solid ${colors.glassBorder}` }}
              >
                <ArrowUp
                  size={13}
                  className="transition-transform duration-200"
                  style={{
                    color: colors.mint,
                    transform: sortDir === "asc" ? "rotate(0deg)" : "rotate(180deg)",
                  }}
                />
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[65vh] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: colors.textMuted }}>
            {query ? "Tidak ada hasil yang cocok dengan pencarian" : "Belum ada data untuk filter ini"}
          </div>
        ) : (
          <div key={`${currentPage}-${sortKey}-${sortDir}`} className="sm-fadein">
            {visibleRows.map((row, i) => (
              <div
                // ⚠️ Sprint 4 / K2: stable key (mirip dengan table view di atas).
                // ⚠️ Sprint 18d16 / Bugfix: hapus salesName & productName dari
                // fallback (tidak unik untuk transaksi) → pakai index r-${i}.
                key={typeof rowKey === "function" ? rowKey(row, i) : (rowKey && row[rowKey] !== undefined ? row[rowKey] : (row.code || row.name || `r-${i}`))}
                className="px-4 py-3.5"
                style={{ borderTop: i === 0 ? "none" : `1px solid ${colors.glassBorder}` }}
              >
                {/* Judul kartu: default = kolom pertama yang punya label; kalau
                    mobileTitleKey diisi, pakai kolom itu (nilai mentah, tanpa
                    styling khusus tabel desktop). Pojok kanan opsional (mis.
                    tanggal) untuk konteks cepat tanpa jadi judul utama. */}
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <div className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                    {mobileCellValue(titleCol, row, Boolean(mobileTitleKey))}
                  </div>
                  {cornerCol && (
                    <div className="shrink-0 text-xs mono" style={{ color: colors.textMuted }}>
                      {mobileCellValue(cornerCol, row, true)}
                    </div>
                  )}
                </div>
                {subtitleCol && (
                  <div className="text-xs mb-2 truncate" style={{ color: colors.textMuted }}>
                    {mobileCellValue(subtitleCol, row, true)}
                  </div>
                )}
                {!subtitleCol && <div className="mb-1" />}

                {/* Grid 2-kolom label-value untuk kolom data sisanya */}
                {dataCols.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {dataCols.map((c) => (
                      <div key={c.key} className="min-w-0">
                        <div
                          className="uppercase tracking-wider mb-0.5"
                          style={{ color: colors.tableHeader, fontSize: 9.5, letterSpacing: "0.04em" }}
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
    </div>

      {effectivePageSize && sorted.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ borderTop: `1px solid ${colors.glassBorder}` }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs" style={{ color: colors.textMuted }}>
              Menampilkan {fmtNum((currentPage - 1) * effectivePageSize + 1)}–{fmtNum(Math.min(currentPage * effectivePageSize, sorted.length))} dari {fmtNum(sorted.length)} baris
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.textMuted }}>
              <span>Baris:</span>
              <CustomSelect
                value={effectivePageSize}
                onChange={(v) => {
                  setPerPage(Number(v));
                  setPage(1);
                }}
                options={pageSizeOptions.map((sz) => ({ value: sz, label: String(sz) }))}
                colors={colors}
                size="xs"
                align="right"
                menuWidth="match-trigger"
              />
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Halaman sebelumnya"
                className="sm-btn w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: colors.text }}
              >
                <ChevronLeft size={14} />
              </button>
              {pageNumbers.map((p, idx) => {
                const prevP = pageNumbers[idx - 1];
                const showEllipsis = prevP !== undefined && p - prevP > 1;
                const active = p === currentPage;
                return (
                  <span key={p} className="flex items-center gap-1">
                    {showEllipsis && <span className="px-1 text-xs" style={{ color: colors.textMuted }}>…</span>}
                    <button
                      onClick={() => setPage(p)}
                      aria-label={`Halaman ${p}`}
                      aria-current={active ? "page" : undefined}
                      className="sm-btn min-w-8 h-8 px-2 rounded-lg text-xs font-semibold mono"
                      style={{
                        background: active ? colors.mint + "1F" : colors.glassFill,
                        border: `1px solid ${active ? colors.mint + "55" : colors.glassBorder}`,
                        color: active ? colors.mint : colors.text,
                      }}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Halaman berikutnya"
                className="sm-btn w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: colors.text }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
