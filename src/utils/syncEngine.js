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

const DEVICE_KEY = "smapp:deviceId";
export function getDeviceId() {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "dev_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (_e) { return "dev_unknown"; }
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
  } catch (_e) { return "user"; }
}

// Tanggal terakhir (max date) di master_sales. null kalau master kosong.
export async function fetchMasterMaxDate() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.from("master_sales").select("date").order("date", { ascending: false }).limit(1).maybeSingle();
    return data?.date || null;
  } catch (_e) { return null; }
}

// Ambil SEMUA baris master_sales (untuk sync penuh / device baru).
export async function fetchAllMasterRows() {
  if (!supabase) return { ok: false, reason: "not_configured", rows: [] };
  try {
    const { data, error } = await supabase.from("master_sales").select("*").order("date", { ascending: true });
    if (error) return { ok: false, reason: error.message, rows: [] };
    return { ok: true, rows: data || [] };
  } catch (e) {
    return { ok: false, reason: e.message, rows: [] };
  }
}

// Insert baris-baris BARU ke master (hanya yang belum ada: date > maxDate).
// `rows` = array objek { date, salesCode, outletCode, invoiceNo, productCode,
// group, qty, value, unit } — dipetakan ke kolom snake_case di sini.
// Kembalikan { ok, inserted, skipped, maxDate, error }.
export async function pushMasterRows(rows, maxDate) {
  if (!supabase) return { ok: false, reason: "not_configured", inserted: 0, skipped: 0 };
  try {
    const user = await currentUser();
    if (!user?.id) return { ok: false, reason: "no_session", inserted: 0, skipped: 0 };
    const newRows = (rows || []).filter((r) => r.date && (!maxDate || r.date > maxDate));
    const skipped = (rows || []).length - newRows.length;
    if (!newRows.length) {
      return { ok: true, inserted: 0, skipped, maxDate };
    }
    // Batch insert dalam potongan 500 baris (hindari request terlalu besar).
    let inserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const chunk = newRows.slice(i, i + CHUNK).map((r) => ({
        date: r.date,
        sales_code: r.salesCode ?? null,
        outlet_code: r.outletCode ?? null,
        invoice_no: r.invoiceNo ?? null,
        product_code: r.productCode ?? null,
        group_name: r.group ?? null,
        qty: r.qty ?? null,
        value: r.value ?? null,
        unit: r.unit ?? null,
        uploaded_by: user.id,
      }));
      const { error } = await supabase.from("master_sales").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    }
    // maxDate baru = tanggal terbesar dari data yang barusan dimasukkan.
    let newMax = maxDate;
    newRows.forEach((r) => { if (!newMax || r.date > newMax) newMax = r.date; });
    return { ok: true, inserted, skipped, maxDate: newMax };
  } catch (e) {
    return { ok: false, reason: e.message, inserted: 0, skipped: 0 };
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

// Hapus SEMUA master (reset total). Hanya editor. Kembalikan { ok, deleted }.
export async function resetMaster() {
  if (!supabase) return { ok: false, reason: "not_configured", deleted: 0 };
  try {
    const { error, count } = await supabase.from("master_sales").delete({ count: "exact" }).neq("id", 0);
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
