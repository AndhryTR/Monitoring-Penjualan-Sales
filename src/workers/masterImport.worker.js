import { parseMasterBuffer } from '../utils/masterImport.js';

// Worker entry untuk parsing file Excel master (3-sheet: Sales, Grup, Fokus).
// Main thread membaca File → ArrayBuffer, lalu mengirim buffer ke sini via
// postMessage. Worker memanggil parseMasterBuffer (sinkron) dan mengembalikan
// hasilnya ke main thread. Pemrosesan di luar UI thread sehingga antarmuka
// tetap responsif saat mengurai file XLSX besar.

self.onmessage = ({ data }) => {
  try {
    // data.buffer = ArrayBuffer yang sudah dibaca main thread dari File object.
    // data.requestId = angka unik agar hook bisa mencocokkan respons ke promise.
    const result = parseMasterBuffer(data.buffer);
    self.postMessage({ requestId: data.requestId, type: 'result', result });
  } catch (error) {
    self.postMessage({
      requestId: data.requestId,
      type: 'error',
      error: error?.message || String(error),
    });
  }
};
