/* ============================================================================
   BACKUP EXPORT/IMPORT
   Ekspor gabungan Settings (target, hari kerja, nama depo, tema, filter,
   metode proyeksi) + Riwayat snapshot periode jadi satu file .json yang bisa
   di-download, disimpan, lalu diimpor lagi (mis. pindah device/browser, atau
   backup sebelum "Hapus Semua Data").

   SENGAJA TIDAK termasuk data transaksi mentah (rawRows) — itu bisa ribuan
   baris dan disimpan terpisah di IndexedDB; fitur ini murni untuk
   pengaturan + riwayat snapshot yang ringan, sesuai namanya.
============================================================================ */

const BACKUP_APP_ID = "smapp-backup";
const BACKUP_VERSION = 1;

export function buildBackupPayload({ theme, filters, workDays, targets, depotName, projectionMethod, history }) {
  return {
    _app: BACKUP_APP_ID,
    _v: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: { theme, filters, workDays, targets, depotName, projectionMethod },
    history: history || [],
  };
}

export function downloadBackupFile(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Backup_Pengaturan_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Baca & validasi file backup. Menolak (reject) file yang bukan format JSON
// valid atau bukan berasal dari fitur backup ini (_app mismatch) — supaya
// user tidak sengaja import file .json yang salah tanpa pesan yang jelas.
export function parseBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || parsed._app !== BACKUP_APP_ID || !parsed.settings) {
          reject(new Error("File ini bukan file backup yang valid dari aplikasi ini."));
          return;
        }
        resolve(parsed);
      } catch (e) {
        reject(new Error("File tidak bisa dibaca — pastikan formatnya .json dan tidak rusak."));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsText(file);
  });
}
