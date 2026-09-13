/* ============================================================================
   DEPO TEMPLATE — Sprint 18 / Multi-Depo
   Template untuk membuat depo baru. Dipakai oleh useSettings.addDepot() saat
   user klik "Tambah Depo Baru" di DepotSwitcher (Sprint B).

   Tiga template tersedia:
   - BLANK       : 0 sales, 0 grup, 0 fokus — user setup dari nol
   - STANDARD    : 0 sales, 5 grup produk umum (placeholder target = 0)
   - DUPLICATE   : salinan dari depo existing (dipakai addDepot saat template
                   tidak diberikan — fallback ke salinan depo aktif bila ada)

   ⚠️ Tidak ada default sales di template — sales hardcode di defaultTargets.json
   tidak boleh dipakai untuk depo baru. Depo baru mulai kosong; user yang
   import via Excel atau tambah manual via AddSalesModal (Sprint B/C).
============================================================================ */

import { WORK_DAYS_DEFAULT } from "./thresholds.js";

export const DEFAULT_DEPOT_NAME = "DEPO LOTIM";
export const DEFAULT_DEPOT_CODE = "LOTIM";

// Grup produk umum sebagai placeholder untuk depo baru. User bisa rename/hapus
// setelahnya. Bukan hardcode wajib — hanya convenience supaya depo baru tidak
// 100% kosong (yang bisa membingungkan user pemula).
export const STANDARD_GRUPS = [
  { name: "BERAT", value: 0, ao: 0, focus: false },
  { name: "RINGAN", value: 0, ao: 0, focus: false },
  { name: "MINUMAN", value: 0, ao: 0, focus: false },
  { name: "KECAP", value: 0, ao: 0, focus: false },
  { name: "SAMBAL", value: 0, ao: 0, focus: false },
];

// Generate ID depo unik lokal. Format: "dep_" + slug nama + "_" + 4 char random.
// Tidak dipakai sebagai key cloud (cloud sync tetap pakai profiles row).
export function generateDepotId(name) {
  const slug = String(name || "depo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 12) || "depo";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `dep_${slug}_${suffix}`;
}

// Generate kode depo dari nama — 6 huruf pertama uppercase tanpa spasi.
export function generateDepotCode(name) {
  return String(name || "DEPO")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6) || "DEPO";
}

// Template BLANK: tidak ada sales/grup/fokus sama sekali.
export function makeBlankDepot(name, code) {
  const now = new Date().toISOString();
  return {
    id: generateDepotId(name),
    name: String(name || "DEPO BARU").trim(),
    code: String(code || generateDepotCode(name)).trim(),
    workDays: WORK_DAYS_DEFAULT,
    targets: [],
    createdAt: now,
    updatedAt: now,
  };
}

// Template STANDARD: 0 sales, 5 grup placeholder (value=0, focus=false).
// Grup di sini hanya referensi kosong — saat user tambah sales, grup ini
// tidak otomatis attached ke sales baru (sales baru mulai tanpa grup).
export function makeStandardDepot(name, code) {
  const depot = makeBlankDepot(name, code);
  // Simpan grup standar sebagai metadata depo (BUKAN di-attach ke sales).
  // Saat Sprint C Excel import, grup dari Sheet 2 akan replace ini.
  depot.standardGrups = STANDARD_GRUPS.map((g) => ({ ...g }));
  return depot;
}

// Salinan depo existing — dipakai saat user pilih "Duplikat dari" di dialog
// tambah depo. Targets disalin dalam (deep copy via JSON.parse/stringify).
export function duplicateDepot(sourceDepot, newName, newCode) {
  const now = new Date().toISOString();
  const copy = JSON.parse(JSON.stringify(sourceDepot));
  return {
    ...copy,
    id: generateDepotId(newName),
    name: String(newName || sourceDepot.name + " (copy)").trim(),
    code: String(newCode || generateDepotCode(newName)).trim(),
    createdAt: now,
    updatedAt: now,
  };
}
