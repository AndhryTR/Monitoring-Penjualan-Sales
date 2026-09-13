# Desain AI Automasi In-App (Hybrid C) — 2026-09-13
Status: rancangan, belum coding. Scope A drawer.

## Status Implementasi (2026-09-13)
SELESAI (Tahap 1, Build lolos, Smoke 7/7):
- Task 1: `feat:ai_chat` permission di `src/constants/permissions.js` (default: supervisor/admin true, user false).
- Task 2: `src/utils/aiSettings.js` (load/save/clear API key & model).
- Task 3: `src/utils/aiDispatcher.js` (buildContext ringkas tanpa rawRows mentah, callDirect timeout 60s retry 1x, parseToolCall validasi whitelist).
- Task 4: `src/utils/aiTools.js` (baca data, analisis, setTarget, setJadwal, hapusDataAktif, exportCustom; tool tulis wajib preview + tahan eksekusi sebelum konfirmasi).
- Task 5: `src/components/ai/AiChatDrawer.jsx` + wire ke `SalesMonitoringApp.jsx` + tombol Sparkles header + MobileHeaderMenu integration + permission gate.

## 1. Arsitektur + keamanan (disetujui)
- Panel chat -> dispatcher -> 2 transport (Direct / Proxy). Dispatcher tak tahu mode.
- AI tak sentuh DB/file langsung. Hanya lewat tool whitelist JS.
- Tulis: preview -> ConfirmDialog -> eksekusi -> toast -> riwayat.
- Larang: ubah role/user, akses auth, drop-all tanpa verifikasi ganda, hapus butuh 2 langkah.
- Log perintah + hasil di riwayat chat lokal (tanpa key).

## 2. Transport + setelan (disetujui)
- Direct: fetch POST {baseURL}/chat/completions gaya OpenAI-compat (OpenRouter, DeepSeek, Groq, Ollama).
  Field: mode, apiType (openai-compat/custom), baseURL, model, key (password, localStorage device saja), tombol uji koneksi.
- Proxy: field backendURL + kunci akses proxy. Key LLM di env server.
  Rujukan: Supabase Edge Function (validasi token login + forward + log + rate-limit). Alternatif server Node 1 file.
- Timeout 60 dtk, retry 1x. Error jujur: 401/429/CORS + saran per kasus.

## 3. Tool + perintah (disetujui)
- Baca: queryData, bacaTarget, bacaJadwal, bacaStok, bacaTransaksi, analisis (ACH, outlier, rekomendasi).
- Tulis: setTarget (sales/grup), setJadwal (auto/manual/reset), hapusDataAktif (syarat ketat), exportCustom (Excel/PDF/gambar + pilih kolom, pakai modul export existing).
- Format AI dipaksa JSON: {tool, params, ringkasan_bahasa}. Di luar skema -> tolak, tampil mentah sebagai teks.
- Contoh: "set target grup X sales Y 50jt" -> preview lama->baru -> konfirm -> tulis depots -> autosave + sync existing.

## 4. UI/UX + privasi/biaya (disetujui, varian A)
- Desktop: drawer kanan tetap 380px, dashboard menyempit. Header (judul + badge Direct/Proxy + setelan + tutup), riwayat scroll, bawah input + kirim + chip saran.
- Mobile: bottom-sheet 85vh (pola Bell/FilterBar), backdrop.
- Status: mengetik, eksekusi tool (nama + preview), hasil/error.
- Riwayat 50 pesan lokal per device, hapus manual, tanpa key.
- Chip cepat: "Analisis ACH minggu ini", "Set target...", "Export Excel...".
- Privasi: badge "key di device ini" mode Direct. Kirim ke LLM hanya konteks ringkas (total, ACH, N baris, filter aktif) bukan rawRows mentah.
- Biaya: tampil usage prompt+completion bila provider kembalikan. Tanpa streaming dulu.

## 5. File rencana (belum coding)
- `src/components/ai/AiChatDrawer.jsx` (baru): drawer + sheet + input + riwayat + chip.
- `src/utils/aiDispatcher.js` (baru): bangun konteks ringkas, panggil transport, parse JSON, validasi skema + whitelist.
- `src/utils/aiTools.js` (baru): implementasi tool baca/tulis, tiap tulis kembalikan preview.
- `src/utils/aiSettings.js` (baru): load/save setelan AI (mode, apiType, baseURL, model, key device / backendURL + proxyKey).
- `src/components/ui/ConfirmDialog.jsx` (pakai existing): preview tiap aksi tulis.
- `src/utils/notifyExport.js` notifyError (pakai existing): error AI.
- Edge Function `supabase/functions/ai-proxy/index.ts` (baru, tahap 2): forward + rate-limit + log.
- Setelan AI masuk SettingsModal tab baru atau gear di drawer (putuskan saat implementasi; default gear di drawer).

## 6. Skema validasi
- Tool di luar whitelist -> tolak.
- Params tak lengkap/angka tak valid -> tolak + minta klarifikasi via chat.
- Tulis tanpa preview+konfirm -> larang di kode (dispatcher enforce, bukan janji prompt).
- Hapus: wajib sebut target eksplisit + konfirm 2 langkah bila N baris > ambang (mis. >100 baris).

## 7. Error handling
- LLM 401: "Key salah / habis" + link setelan. 429: "limit, coba lagi". CORS/timeout Direct: "coba Proxy atau base URL lain".
- Tool gagal: toast error + pesan chat, data tak berubah setengah (tulis via setter existing yang atomik per aksi).
- JSON tak valid: tampil mentah sebagai teks, tawarkan "coba lagi".

## 8. Pengujian
- Build lolos.
- Smoke: dispatcher parse JSON valid/tolak invalid, whitelist tolak tool asing, preview setTarget benar, exportCustom panggil modul existing (mock).
- Manual: Direct uji koneksi, kirim analisis, set target + konfirm + batal, hapus + konfirm, export custom, ganti Proxy.

## 9. Tahap
- Tahap 1: Direct + baca + setTarget/setJadwal/exportCustom + ConfirmDialog + drawer.
- Tahap 2: Proxy Edge Function + hapusDataAktif + log server.
- Bukan sekarang: streaming, suara, agen multi-langkah otonom, ubah role/user.

## 10. Permission admin dashboard (disetujui)
- Permission baru `feat:ai_chat` (Chat AI Automasi), kategori feature.
- Default: offline false, user false, supervisor true, admin true.
  User biasa default mati (biaya key + risiko tulis). Superuser atur via matriks + override per user (UserOverridesTab existing, tanpa kode tambahan).
- Gate di UI: canAccess("feat:ai_chat") false -> tombol/chat hilang total (bukan disabled).
- Tahap 2: Edge Function validasi permission server-side juga (client gate bisa bypass).
- Granular tahap 2 (catat, belum): `feat:ai_chat_write` pisah baca vs tulis.

## Self-review
- Tanpa TBD/TODO. Konsisten: dispatcher enforce konfirm (bukan prompt). Scope 1 spek. Ambigu "custom apiType" -> arti: header/body custom via template sederhana, detail saat plan.
