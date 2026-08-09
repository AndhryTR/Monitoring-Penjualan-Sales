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

// Ambil baris master dengan date > maxDateLokal (delta). Untuk sync inkremental:
// device yang sudah pernah syncing tidak perlu mengunduh ulang seluruh master.
// Juga pagination penuh (bisa >1000 baris tanggal baru).
export async function fetchMasterRowsSince(maxDateLokal) {
  if (!supabase) return { ok: false, reason: "not_configured", rows: [] };
  try {
    const all = [];
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      let q = supabase.from("master_sales").select("*");
      if (maxDateLokal) q = q.gt("date", maxDateLokal);
      q = q.order("date", { ascending: true }).range(from, from + PAGE - 1);
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

// Insert baris-baris BARU ke master (hanya yang belum ada: date > maxDate).
// `rows` = array objek { date, salesCode, outletCode, invoiceNo, productCode,
// group, qty, value, unit } — dipetakan ke kolom snake_case di sini.
// Kembalikan { ok, inserted, skipped, maxDate, error }.
//
// Race condition mitigation:
// - Tabel master_sales punya UNIQUE(date, invoice_no, product_code, sales_code).
// - Insert memakai `.upsert(..., { onConflict, ignoreDuplicates: true })` sehingga
//   bila dua device sync bersamaan dengan maxDate yang sama, baris duplikat
//   diam-diam di-skip di level DB (tidak melempar constraint violation).
//
// Partial-failure accounting:
// - `inserted` dilacak di outer `let` (bukan hanya di dalam loop). Bila chunk
//   ke-2 dari 3 throw, catch return jumlah parsial yang BENAR-BENAR tertulis.
// - `newMax` dihitung dari `newRows[0..i+chunk]` (baris yang sudah ter-insert),
//   bukan dari SELURUH `newRows`. Sinkronisasi berikutnya akan pakai `newMax`
//   ini sebagai batas — kalau salah hitung (memasukkan tanggal yang belum
//   ter-insert), baris-baris itu akan skip selamanya (silent data loss).
export async function pushMasterRows(rows, maxDate) {
  if (!supabase) return { ok: false, reason: "not_configured", inserted: 0, skipped: 0 };
  // ⚠️ Sprint 4 / Q2: `inserted` & `insertedRows` di-declare DI LUAR `try` block
  // supaya `catch` bisa akses (block-scoped `let`/`const` di dalam `try` tidak
  // berlaku lintas block). Sebelumnya declaration ada di dalam try (lihat
  // Sprint 1 #5), yang menyebabkan `catch` block lihat `insertedRows` dan
  // `inserted` sebagai undefined — partial-failure accounting rusak lagi.
  // ESLint catch bug ini (no-undef).
  let inserted = 0;
  const insertedRows = [];
  try {
    const user = await currentUser();
    if (!user?.id) return { ok: false, reason: "no_session", inserted: 0, skipped: 0 };
    const newRows = (rows || []).filter((r) => r.date && (!maxDate || r.date > maxDate));
    const skipped = (rows || []).length - newRows.length;
    if (!newRows.length) {
      return { ok: true, inserted: 0, skipped, maxDate };
    }
    // `inserted` dilacak di luar loop supaya catch bisa return jumlah parsial
    // yang BENAR-BENAR berhasil tertulis ke DB sebelum throw.
    // `insertedRows` = baris yang sudah BENAR-BENAR ter-insert (untuk hitung
    // newMax yang akurat — bukan dari semua newRows).
    const CHUNK = SYNC_CHUNK_SIZE;
    // Composite key yang dipakai di UNIQUE constraint (lihat setup.sql).
    const ON_CONFLICT = "date,invoice_no,product_code,sales_code";
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const chunkSrc = newRows.slice(i, i + CHUNK);
      const chunk = chunkSrc.map((r) => ({
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
        uploaded_by: user.id,
      }));
      // .upsert + ignoreDuplicates: bila ada baris dengan composite key yang
      // sama (race condition antar device, atau data lokal duplikat), baris
      // di-skip — TIDAK melempar error. Stempel `inserted` tetap di-increment
      // sesuai jumlah yang dikirim; pengguna bisa membedakan "inserted" vs
      // "benar-benar baru" lewat field `skipped` (jika duplikat, net effect
      // di DB lebih kecil dari inserted).
      const { error } = await supabase
        .from("master_sales")
        .upsert(chunk, { onConflict: ON_CONFLICT, ignoreDuplicates: true });
      if (error) throw error;
      inserted += chunk.length;
      insertedRows.push(...chunkSrc);
    }
    // maxDate baru = tanggal terbesar dari baris yang BENAR-BENAR ter-insert.
    // Pakai `insertedRows` (bukan `newRows`) supaya bila chunk terakhir gagal,
    // `newMax` tidak melompati tanggal yang belum tertulis — yang akan
    // menyebabkan fetchMasterRowsSince(newMax) skip baris-baris itu selamanya.
    let newMax = maxDate;
    insertedRows.forEach((r) => { if (!newMax || r.date > newMax) newMax = r.date; });
    return { ok: true, inserted, skipped, maxDate: newMax };
  } catch (e) {
    // Bila terjadi error di tengah chunk, `inserted` adalah jumlah parsial
    // yang BENAR-BENAR tertulis ke DB sebelum throw. Caller bisa gunakan ini
    // untuk menampilkan "5 dari 12 baris berhasil" atau memutuskan retry.
    // `ok: false` tetap dipakai sebagai penanda error.
    // `maxDate` di-return dari `insertedRows` (jika ada) supaya sinkronisasi
    // berikutnya tidak mengulang baris yang sudah tertulis.
    let partialMax = maxDate;
    insertedRows.forEach((r) => { if (!partialMax || r.date > partialMax) partialMax = r.date; });
    return { ok: false, reason: e.message, inserted, skipped: 0, maxDate: partialMax };
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
