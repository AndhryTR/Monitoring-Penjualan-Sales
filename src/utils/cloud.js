/* ============================================================================
   CLOUD — Supabase client + auth helpers
   Semua kontak ke backend lewat modul ini. URL + anon key dari .env.local
   (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Kalau keduanya kosong/belum
   diisi, `supabase` = null dan seluruh app berjalan murni lokal (tanpa login
   & tanpa sinkronisasi) — tidak ada error, tidak ada crash.

   Anon key SAFE dipakai di frontend (bukan rahasia): proteksi data sebenarnya
   lewat Row-Level-Seecurity (user hanya bisa baca baris miliknya sendiri),
   bukan lewat merahasiakan key.

   LOGIN: satu field auto-detect.
     - input mengandung "@"  -> dianggap EMAIL  -> signInWithPassword(email)
     - input tanpa "@"       -> dianggap USERNAME -> rpc get_email_by_username
                              -> resolve ke email -> signInWithPassword(email)
   REGISTRASI: field terpisah (username, email, password, konfirmasi).
============================================================================ */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export const isCloudConfigured = () => !!supabase;

/* ------------------------------ Session ------------------------------ */

export function getSession() {
  return supabase?.auth?.getSession()?.then?.((x) => x.data?.session ?? null) ?? Promise.resolve(null);
}

/** Daftarkan listener state auth. Balikkan fungsi pembatalan. */
export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data?.subscription?.unsubscribe();
}

/* -------------------------------- Login -------------------------------- */
// Error dibungkus jadi objek { code, message }. Code dipakai UI untuk
// menampilkan pesan spesifik (USERNAME_NOT_FOUND dll).

export async function signInWithIdentifier(identifier, password) {
  if (!supabase) return { code: "NOT_CONFIGURED", message: "Cloud belum dikonfigurasi." };
  const raw = identifier.trim();
  if (!raw) return { code: "EMPTY", message: "Masukkan username atau email." };
  if (!password) return { code: "EMPTY", message: "Masukkan password." };

  let email = raw.toLowerCase();
  if (!raw.includes("@")) {
    // dianggap username -> cari email via function SECURITY DEFINER
    try {
      const { data, error } = await supabase.rpc("get_email_by_username", { p_username: raw });
      if (error) return { code: "RPC", message: error.message };
      if (!data) return { code: "USERNAME_NOT_FOUND", message: "Username tidak ditemukan." };
      email = data;
    } catch (e) {
      return { code: "RPC", message: e.message };
    }
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { code: "AUTH", message: "Username atau password salah." };
    return { code: "OK", user: data.user };
  } catch (e) {
    return { code: "AUTH", message: e.message };
  }
}

/* ------------------------------ Registrasi ------------------------------ */
// Profil user dibuat OTOMATIS lewat trigger DB ketika baris auth.users dibuat
// (username diambil dari user_metadata). Username unik -> kalau sudah dipakai,
// signUp() gagal (trigger melanggar constraint UNIQUE).

export async function signUpAccount({ username, email, password }) {
  if (!supabase) return { code: "NOT_CONFIGURED", message: "Cloud belum dikonfigurasi." };
  const uname = (username || "").trim();
  const mail = (email || "").trim().toLowerCase();
  if (uname.length < 3) return { code: "VALIDATION", message: "Username minimal 3 karakter." };
  if (!/^[a-z0-9._-]+$/i.test(uname)) return { code: "VALIDATION", message: "Username hanya huruf, angka, titik, garis bawah, dan strip." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { code: "VALIDATION", message: "Email tidak valid." };
  if (password.length < 6) return { code: "VALIDATION", message: "Password minimal 6 karakter." };

  try {
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { data: { username: uname } },
    });
    if (error) {
      // Supabase balikkan pesan en/raw; petakan yang umum ke Bahasa.
      const m = (error.message || "").toLowerCase();
      if (m.includes("duplicate") || m.includes("already") || m.includes("exist")) {
        return { code: "USERNAME_TAKEN", message: "Username atau email sudah terdaftar." };
      }
      return { code: "AUTH", message: error.message };
    }
    // Kalau email confirmation AKTIF di dashboard, session null -> user harus
    // klik link konfirmasi dulu sebelum bisa login.
    if (data.session) return { code: "OK_SESSION", user: data.user };
    return { code: "NEEDS_CONFIRM", user: data.user, email: mail };
  } catch (e) {
    return { code: "AUTH", message: e.message };
  }
}

export async function signOutAccount() {
  if (!supabase) return;
  try { await supabase.auth.signOut(); } catch (_e) { /* abaikan */ }
}

export async function resetPassword(email) {
  if (!supabase) return { code: "NOT_CONFIGURED", message: "Cloud belum dikonfigurasi." };
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) return { code: "AUTH", message: error.message };
    return { code: "OK" };
  } catch (e) {
    return { code: "AUTH", message: e.message };
  }
}