import { parseWorkbookBuffer, dedupeRows } from "../utils/excelParse.js";

// Worker entry khusus parser Excel. Import lokal ini akan dibundle Vite menjadi
// file worker production terpisah; browser mapping xlsx-js-style mencegah Node
// builtins masuk ke bundle.
self.onmessage = async ({ data }) => {
  try {
    const results = [];
    const totalFiles = Math.max(data.files.length, 1);

    for (let index = 0; index < data.files.length; index += 1) {
      const file = data.files[index];
      const parsed = await parseWorkbookBuffer(file.buffer, (fraction, info) => {
        const fileFraction = info?.phase === "structure" ? 0.25 : fraction;
        const progress = ((index + Math.min(Math.max(fileFraction, 0), 1)) / totalFiles) * 100;
        self.postMessage({ requestId: data.requestId, type: "progress", progress });
      });
      const deduped = dedupeRows(parsed.rows);
      parsed.parseMeta.duplicateRowsRemoved = deduped.duplicateCount;
      results.push({ rows: deduped.rows, parseMeta: parsed.parseMeta, name: file.name });
      self.postMessage({
        requestId: data.requestId,
        type: "progress",
        progress: ((index + 1) / totalFiles) * 100,
      });
    }

    self.postMessage({ requestId: data.requestId, type: "result", results });
  } catch (error) {
    self.postMessage({
      requestId: data.requestId,
      type: "error",
      error: error?.message || String(error),
    });
  }
};