/* ============================================================================
   SYNC ENGINE — sinkronisasi MANUAL (hanya via tombol "Sinkronkan Sekarang")
   Arsitektur peran:
     - admin/supervisor  : bisa tulis MASTER DATA (upload data penjualan global)
     - user biasa        : baca master, sync settings+targets sendiri
     - semua user        : sync settings+targets (per-user) ke tabel `profiles`

   MASTER DATA (tabel master_sales, 1 baris = 1 transaksi):
     - Sumber data penjualan global per depot
     - Semua user login BISA BACA (SELECT)
     - Hanya admin/supervisor BISA TULIS (INSERT/DELETE) via RLS is_editor()
     - Upload HARIAN = incremental: hanya baris dgn date > max_date master yang
       dimasukkan (data tgl 1..hari ini di-upload ulang tiap hari, yang sudah
       ada dilewati). Koreksi data lama = "Hapus Rentang" lalu upload ulang.

   SETTINGS+TARGETS (tabel profiles):
     - 1 baris per user, kolom jsonb `targets` + kolom pengaturan lain
     - Saat sync manual: PUSH baris sendiri (overwrite) + PULL kalau device
       baru/kosong.

   TIDAK ADA sinkronisasi otomatis & tidak ada queue — semuanya hanya terjadi
   saat user menekan tombol. Modul ini TIDAK pernah melempar ke pemanggil:
   kegagalan cloud dibungkus jadi { ok:false, reason }.
============================================================================ */
import { supabase } from "./cloud.js";
import { SYNC_CHUNK_SIZE } from "../constants/thresholds.js";
import { loadMasterMax } from "./storage.js";

const DEVICE_KEY = "smapp:deviceId";
export function getDeviceId() {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch { return "dev_unknown"; }
}

/* ------------------------------ helpers --------------------------------- */

async function currentUser() {
  const { data: sessData } = await supabase.auth.getSession().catch(() => ({ data: null }));
  return sessData?.session?.user || null;
}

/* -------------------- role & master (admin/supervisor) ------------------- */

// Ambil role user saat ini dari profiles. null kalau belum ada baris.
export async function fetchRole() {
  if (!supabase) return null;
  try {
    const user = await currentUser();
    if (!user?.id) return null;
    const { data } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
    return data?.role || "user";
  } catch { return "user"; }
}

// Tanggal terakhir (max date) di master_sales. null kalau master kosong.
export async function fetchMasterMaxDate() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.from("master_sales").select("date").order("date", { ascending: false }).limit(1).maybeSingle();
    return data?.date || null;
  } catch { return null; }
}

// Ambil SEMUA baris master_sales (untuk sync penuh / device baru).
// Pagination loop — Supabase/PostgREST default membatasi 1000 baris/request,
// jadi tanpa .range() cuma dapat 1000 pertama. Loop ini mengambil SEMUA.
export async function fetchAllMasterRows() {
  if (!supabase) return { ok: false, reason: "not_configured", rows: [] };
  try {
    const all = [];
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("master_sales")
        .select("*")
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return { ok: false, reason: error.message, rows: all };
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return { ok: true, rows: all };
  } catch (e) {
    return { ok: false, reason: e.message, rows: [] };
  }
}

// Ambil baris master dengan date >= maxDateLokal (delta dengan overlap satu
// tanggal). Overlap ini penting: transaksi tambahan pada tanggal maksimum yang
// sama harus tetap ikut tersinkron, lalu `mergeMasterRows` mengganti seluruh
// tanggal tersebut dengan versi master. Pagination memakai date+id supaya urutan
// stabil bila satu tanggal berisi lebih dari satu halaman data.
export async function fetchMasterRowsSince(maxDateLokal) {
  if (!supabase) return { ok: false, reason: "not_configured", rows: [] };
  try {
    const all = [];
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      let q = supabase.from("master_sales").select("*");
      if (maxDateLokal) q = q.gte("date", maxDateLokal);
      q = q.order("date", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
      const { data, error } = await q;
      if (error) return { ok: false, reason: error.message, rows: all };
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return { ok: true, rows: all };
  } catch (e) {
    return { ok: false, reason: e.message, rows: [] };
  }
}

/* ---------------------- master pull & merge (all users) ------------------ */

// Petakan baris master_sales (snake_case) ke bentuk lokal (camelCase).
const mapMasterRow = (r) => ({
  date: r.date, salesCode: r.sales_code, salesName: r.sales_name,
  outletCode: r.outlet_code, outletName: r.outlet_name,
  invoiceNo: r.invoice_no, productCode: r.product_code, productName: r.product_name,
  group: r.group_name, qty: r.qty, qtyKarton: r.qty_karton, unconvertible: r.unconvertible,
  value: r.value, unit: r.unit,
});

const toMasterRow = (r, userId = null) => ({
  date: r.date,
  sales_code: r.salesCode ?? null,
  sales_name: r.salesName ?? null,
  outlet_code: r.outletCode ?? null,
  outlet_name: r.outletName ?? null,
  invoice_no: r.invoiceNo ?? null,
  product_code: r.productCode ?? null,
  product_name: r.productName ?? null,
  group_name: r.group ?? null,
  qty: r.qty ?? null,
  qty_karton: r.qtyKarton ?? null,
  unconvertible: r.unconvertible ?? null,
  value: r.value ?? null,
  unit: r.unit ?? null,
  ...(userId ? { uploaded_by: userId } : {}),
});

// Gabungkan master yang baru di-pull ke data lokal. MASTER MENANG utk tanggal
// yang sama: baris lokal dengan tanggal yang ada di master dibuang, diganti
// data master. Kembalikan { merged, maxDate }.
// ⚠️ Sprint 14 / H17: di-extract dari useCloudSync (dulu inline di runSync)
// supaya dipakai ulang oleh tombol "Sinkronkan Data Penjualan" yang mandiri.
export function mergeMasterRows(rawRows, masterRows) {
  const masterRowsArr = masterRows || [];
  const masterDates = new Set(masterRowsArr.map((r) => r.date));
  const keptLocal = (rawRows || []).filter((r) => !masterDates.has(r.date));
  const masterMapped = masterRowsArr.map(mapMasterRow);
  let max = loadMasterMax();
  masterRowsArr.forEach((r) => { if (r.date && (!max || r.date > max)) max = r.date; });
  return { merged: [...keptLocal, ...masterMapped], maxDate: max };
}

// Insert baris master pada tanggal maksimum atau setelahnya. Tanggal maksimum
// ikut dicoba ulang agar transaksi tambahan di hari yang sama dapat masuk;
// constraint unik database mengabaikan transaksi yang sudah ada.
// `rows` = array objek { date, salesCode, outletCode, invoiceNo, productCode,
// group, qty, value, unit } — dipetakan ke kolom snake_case di sini.
// Kembalikan { ok, inserted, skipped, dupInternal, dupSkipped, maxDate, error }.
//
// ⚠️ Sprint 14 / H12 (duplikat dalam file): UNIQUE constraint DB adalah
// (date, invoice_no, product_code, sales_code, outlet_code) — TANPA qty/value. Key dedupe
// lokal di excelParse.js (date|invoiceNo|productCode|qty|value) TIDAK sama,
// jadi dua baris dengan date/invoice/product/sales sama tapi qty beda lolos
// parse, lalu di-upload. ignoreDuplicates di DB menolaknya diam-diam dan
// `inserted += chunk.length` (yang lama) melaporkan jumlah yang dikirim —
// bukan yang benar-benar masuk → selisih "73126 ditambahkan" vs 71351 di DB.
// Fix: pre-scan SEMUA baris dengan key DB yang sama persis, hitung dupInternal
// (tidak dikirim), sisanya upload dengan count:"exact" supaya `inserted` =
// jumlah yang BENAR² masuk DB, selisihnya jadi dupSkipped.
//
// Race condition mitigation:
// - Tabel master_sales punya UNIQUE(date, invoice_no, product_code, sales_code, outlet_code).
// - Insert memakai `.upsert(..., { onConflict, ignoreDuplicates: true })` sehingga
//   bila dua device sync bersamaan dengan maxDate yang sama, baris duplikat
//   diam-diam di-skip di level DB (tidak melempar constraint violation).
//
// ⚠️ Bug fix (H13): `inserted` sebelumnya dihitung sebagai `chunk.length` — SEMUA
// baris yang dikirim dianggap masuk, padahal `.upsert` + `ignoreDuplicates`
// TIDAK menghitung. Dua penyebab baris hilang:
//   H11 — baris yang sudah ADA di DB dari sync/upload sebelumnya ditolak
//         ON CONFLICT (duplikat lintas-upload).
//   H12 — duplikat di DALAM file upload itu sendiri: dedupe lokal app pakai
//         key (date|invoice|product|qty|value, tanpa salesCode) BERBEDA dari
//         UNIQUE DB (date|invoice|product|sales_code). Baris dengan
//         date|invoice|product sama tapi qty/value/salesCode beda lolos dedupe
//         lokal, tapi ditolak DB. Terjadi walau DB kosong.
// Sekarang: `.upsert` pakai `count: "exact"` (PostgREST return jumlah baris
// yang BENAR² ter-insert) + pre-scan dengan key UNIQUE DB sebelum upload
// (baris konflik dalam file dihitung `dupInternal`, tidak dikirim).
//
// Partial-failure accounting:
// - `inserted` dilacak di outer `let` (bukan hanya di dalam loop). Bila chunk
//   ke-2 dari 3 throw, catch return jumlah parsial yang BENAR-BENAR tertulis.
// - `newMax` dihitung dari `newRows[0..i+chunk]` (baris yang sudah ter-insert),
//   bukan dari SELURUH `newRows`. Sinkronisasi berikutnya akan pakai `newMax`
//   ini sebagai batas — kalau salah hitung (memasukkan tanggal yang belum
//   ter-insert), baris-baris itu akan skip selamanya (silent data loss).
export async function pushMasterRows(rows, maxDate) {
  if (!supabase) return { ok: false, reason: "not_configured", inserted: 0, skipped: 0, dupInternal: 0, dupSkipped: 0 };
  // ⚠️ Sprint 4 / Q2: `inserted` & `insertedRows` di-declare DI LUAR `try` block
  // supaya `catch` bisa akses (block-scoped `let`/`const` di dalam `try` tidak
  // berlaku lintas block). Sebelumnya declaration ada di dalam try (lihat
  // Sprint 1 #5), yang menyebabkan `catch` block lihat `insertedRows` dan
  // `inserted` sebagai undefined — partial-failure accounting rusak lagi.
  // ESLint catch bug ini (no-undef).
  let inserted = 0;
  let dupSkipped = 0;
  const insertedRows = [];
  try {
    const user = await currentUser();
    if (!user?.id) return { ok: false, reason: "no_session", inserted: 0, skipped: 0, dupInternal: 0, dupSkipped: 0 };
    let newRows = (rows || []).filter((r) => r.date && (!maxDate || r.date >= maxDate));
    const skipped = (rows || []).length - newRows.length;
    if (!newRows.length) {
      return { ok: true, inserted: 0, skipped, dupInternal: 0, dupSkipped: 0, maxDate };
    }

    // ⚠️ Sprint 19h10 / Bugfix: HAPUS pre-scan dbKey sepenuhnya.
    // Sebelumnya pre-scan pakai key (date|invoice|product|sales|outlet) yang
    // BERBEDA dari dedup lokal (date|invoice|product|qty|value). Akibatnya
    // 2 transaksi dengan date+invoice+product+sales+outlet sama TAPI qty/value
    // berbeda dianggap duplikat oleh syncEngine padahal lolos dedup lokal.
    // Fix: kirim SEMUA baris ke DB, biarkan DB unique constraint + upsert +
    // ignoreDuplicates yang handle duplikat sebenarnya. dupInternal selalu 0.
    const dupInternal = 0;
    if (!newRows.length) {
      return { ok: true, inserted: 0, skipped, dupInternal, dupSkipped: 0, maxDate };
    }
    // `inserted` dilacak di luar loop supaya catch bisa return jumlah parsial
    // yang BENAR-BENAR berhasil tertulis ke DB sebelum throw.
    // `insertedRows` = baris yang sudah BENAR-BENAR ter-insert (untuk hitung
    // newMax yang akurat — bukan dari semua newRows).
    const CHUNK = SYNC_CHUNK_SIZE;
    // ⚠️ Sprint 19h8: tambah outlet_code ke ON_CONFLICT untuk match dengan
    // unique constraint baru di database.
    const ON_CONFLICT = "date,invoice_no,product_code,sales_code,outlet_code";
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const chunkSrc = newRows.slice(i, i + CHUNK);
      const chunk = chunkSrc.map((r) => toMasterRow(r, user.id));
      // .upsert + ignoreDuplicates: bila ada baris dengan composite key yang
      // sama (race condition antar device, atau data lokal duplikat), baris
      // di-skip — TIDAK melempar error. `count: "exact"` membuat response
      // memuat jumlah baris yang BENAR-BENAR di-insert (yang di-skip tidak
      // dihitung) — dipakai untuk `inserted` yang akurat, bukan chunk.length.
      const { error, count } = await supabase
        .from("master_sales")
        .upsert(chunk, { onConflict: ON_CONFLICT, ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      // count bisa undefined kalau server/header tidak mendukung — fallback
      // ke chunk.length (perilaku lama) supaya tidak crash.
      const chunkInserted = typeof count === "number" ? count : chunk.length;
      inserted += chunkInserted;
      dupSkipped += chunk.length - chunkInserted;
      insertedRows.push(...chunkSrc);
    }
    // maxDate baru = tanggal terbesar dari baris yang BENAR-BENAR ter-insert.
    // Pakai `insertedRows` (bukan `newRows`) supaya bila chunk terakhir gagal,
    // `newMax` tidak melompati tanggal yang belum tertulis — yang akan
    // menyebabkan fetchMasterRowsSince(newMax) skip baris-baris itu selamanya.
    let newMax = maxDate;
    insertedRows.forEach((r) => { if (!newMax || r.date > newMax) newMax = r.date; });
    return { ok: true, inserted, skipped, dupInternal, dupSkipped, maxDate: newMax };
  } catch (e) {
    // Bila terjadi error di tengah chunk, `inserted` adalah jumlah parsial
    // yang BENAR-BENAR tertulis ke DB sebelum throw. Caller bisa gunakan ini
    // untuk menampilkan "5 dari 12 baris berhasil" atau memutuskan retry.
    // `ok: false` tetap dipakai sebagai penanda error.
    // `maxDate` di-return dari `insertedRows` (jika ada) supaya sinkronisasi
    // berikutnya tidak mengulang baris yang sudah tertulis.
    let partialMax = maxDate;
    insertedRows.forEach((r) => { if (!partialMax || r.date > partialMax) partialMax = r.date; });
    return { ok: false, reason: e.message, inserted, skipped: 0, dupInternal: 0, dupSkipped, maxDate: partialMax };
  }
}

// Ganti snapshot cloud untuk tanggal yang ada pada file koreksi. Operasi SQL
// berjalan atomik di RPC: baris lama baru dihapus bila seluruh insert baru valid.
export async function replaceMasterRowsForDates(rows) {
  if (!supabase) return { ok: false, reason: "not_configured", inserted: 0, deleted: 0 };
  const validRows = (rows || []).filter((r) => r.date);
  if (!validRows.length) return { ok: false, reason: "no_dated_rows", inserted: 0, deleted: 0 };
  try {
    const { data, error } = await supabase.rpc("replace_master_sales_dates", {
      p_rows: validRows.map((r) => toMasterRow(r)),
    });
    if (error) return { ok: false, reason: error.message, inserted: 0, deleted: 0 };
    return { ok: true, inserted: Number(data?.inserted) || 0, deleted: Number(data?.deleted) || 0 };
  } catch (e) {
    return { ok: false, reason: e.message, inserted: 0, deleted: 0 };
  }
}

// Hapus rentang tanggal di master. Kembalikan { ok, deleted, error }.
export async function deleteMasterRange(dateFrom, dateTo) {
  if (!supabase) return { ok: false, reason: "not_configured", deleted: 0 };
  try {
    const { error, count } = await supabase
      .from("master_sales")
      .delete({ count: "exact" })
      .gte("date", dateFrom)
      .lte("date", dateTo);
    if (error) return { ok: false, reason: error.message, deleted: 0 };
    return { ok: true, deleted: count || 0 };
  } catch (e) {
    return { ok: false, reason: e.message, deleted: 0 };
  }
}

/* --------------------- settings & targets (per-user) --------------------- */

// PUSH settings+targets user sendiri ke profiles (overwrite baris sendiri).
export async function pushSettings(data) {
  if (!supabase) return { ok: false, reason: "not_configured" };
  try {
    const user = await currentUser();
    if (!user?.id) return { ok: false, reason: "no_session" };
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      targets: data.targets ?? null,
      work_days: data.workDays ?? null,
      depot_name: data.depotName ?? null,
      theme: data.theme ?? null,
      projection_method: data.projectionMethod ?? null,
      sidebar_collapsed: data.sidebarCollapsed ?? null,
      updated_at: Date.now(),
      updated_by: getDeviceId(),
    }, { onConflict: "user_id" });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// PULL settings+targets user sendiri dari profiles. null kalau belum ada.
export async function pullSettings() {
  if (!supabase) return { ok: false, reason: "not_configured", data: null };
  try {
    const user = await currentUser();
    if (!user?.id) return { ok: false, reason: "no_session", data: null };
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) return { ok: false, reason: error.message, data: null };
    return { ok: true, data: data || null };
  } catch (e) {
    return { ok: false, reason: e.message, data: null };
  }
}
