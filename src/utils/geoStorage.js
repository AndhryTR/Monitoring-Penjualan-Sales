/* ============================================================================
   GEO STORAGE & COORDINATE MANAGER (Fitur B4 - Outlet Map Visualization)
   1. Penyimpanan koordinat per depo di localStorage/IndexedDB
   2. Export Template Excel koordinat outlet
   3. Parse & Import Excel koordinat outlet massal
   4. Auto-geocoding via OpenStreetMap Nominatim
   ============================================================================ */

const STORAGE_PREFIX = "sm_outlet_coords_";

export function getDepotKey(depotName) {
  if (!depotName) return "default";
  return String(depotName).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "default";
}

/**
 * Mengambil koordinat tersimpan untuk depo tertentu.
 * Return: { [outletCode]: { lat: number, lng: number, address?: string, updatedAt: string } }
 */
export function getStoredCoordinates(depotName) {
  const key = STORAGE_PREFIX + getDepotKey(depotName);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (err) {
    console.warn("Gagal membaca koordinat outlet dari storage:", err);
    return {};
  }
}

/**
 * Menyimpan data koordinat outlet untuk depo tertentu.
 */
export function saveStoredCoordinates(depotName, coordsMap) {
  const key = STORAGE_PREFIX + getDepotKey(depotName);
  try {
    localStorage.setItem(key, JSON.stringify(coordsMap || {}));
    window.dispatchEvent(new CustomEvent("sm_coords_updated", { detail: { depotName } }));
    return true;
  } catch (err) {
    console.error("Gagal menyimpan koordinat outlet:", err);
    return false;
  }
}

/**
 * Menyimpan atau memperbarui satu titik koordinat outlet.
 */
export function setSingleCoordinate(depotName, outletCode, { lat, lng, address }) {
  if (!outletCode) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (Number.isNaN(numLat) || Number.isNaN(numLng)) return false;
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) return false;

  const current = getStoredCoordinates(depotName);
  current[outletCode] = {
    lat: numLat,
    lng: numLng,
    address: address || current[outletCode]?.address || "",
    updatedAt: new Date().toISOString(),
  };
  return saveStoredCoordinates(depotName, current);
}

/**
 * Menghapus koordinat satu outlet.
 */
export function removeSingleCoordinate(depotName, outletCode) {
  if (!outletCode) return false;
  const current = getStoredCoordinates(depotName);
  if (current[outletCode]) {
    delete current[outletCode];
    return saveStoredCoordinates(depotName, current);
  }
  return true;
}

/* ============================================================================
   EXCEL TEMPLATE EXPORT & PARSE
   ============================================================================ */

const HEADER_FILL = { patternType: "solid", fgColor: { rgb: "0F172A" } };
const HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 };
const BODY_FONT = { color: { rgb: "111827" }, sz: 10 };
const SAMPLE_FONT = { italic: true, color: { rgb: "64748B" }, sz: 10 };

function makeHeader(val) {
  return {
    v: val,
    t: "s",
    s: {
      fill: HEADER_FILL,
      font: HEADER_FONT,
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "0F172A" } },
        bottom: { style: "thin", color: { rgb: "0F172A" } },
        left: { style: "thin", color: { rgb: "0F172A" } },
        right: { style: "thin", color: { rgb: "0F172A" } },
      },
    },
  };
}

function makeCell(val, isItalic = false) {
  return {
    v: String(val ?? ""),
    t: "s",
    s: {
      font: isItalic ? SAMPLE_FONT : BODY_FONT,
      alignment: { vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E2E8F0" } },
        bottom: { style: "thin", color: { rgb: "E2E8F0" } },
        left: { style: "thin", color: { rgb: "E2E8F0" } },
        right: { style: "thin", color: { rgb: "E2E8F0" } },
      },
    },
  };
}

/**
 * Meng-export template Excel koordinat yang sudah otomatis berisi seluruh
 * outlet yang sedang aktif di data saat ini.
 */
export async function exportCoordinateTemplate(outlets = [], depotName = "") {
  const XLSX = await import("xlsx-js-style");
  const stored = getStoredCoordinates(depotName);
  const safeDepot = (depotName || "DEPO").replace(/[^a-zA-Z0-9_-]/g, "_");

  const wb = XLSX.utils.book_new();

  const headers = [
    "KODE OUTLET",
    "NAMA OUTLET",
    "ALAMAT",
    "LATITUDE",
    "LONGITUDE",
    "SALES",
    "STATUS",
  ];

  const rows = [];
  // Header row
  rows.push(headers.map(makeHeader));

  if (outlets.length === 0) {
    // Berikan contoh baris
    rows.push([
      makeCell("T-001", true),
      makeCell("TOKO CONTOH SEJAHTERA", true),
      makeCell("Jl. Merdeka No. 45, Surabaya", true),
      makeCell("-7.250445", true),
      makeCell("112.768845", true),
      makeCell("BUDI SANTOSO", true),
      makeCell("Aktif", true),
    ]);
  } else {
    outlets.forEach((o) => {
      const code = o.outletCode || "";
      const existing = stored[code];
      const latVal = existing?.lat !== undefined ? String(existing.lat) : (o.lat !== undefined ? String(o.lat) : "");
      const lngVal = existing?.lng !== undefined ? String(existing.lng) : (o.lng !== undefined ? String(o.lng) : "");

      rows.push([
        makeCell(code),
        makeCell(o.outletName || ""),
        makeCell(o.outletAddress || existing?.address || ""),
        makeCell(latVal),
        makeCell(lngVal),
        makeCell(o.salesLabel || (o.salesNames ? Array.from(o.salesNames).join(", ") : "")),
        makeCell(o.status || "-"),
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet([]);
  // Pasang data sel
  rows.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      ws[cellRef] = cell;
    });
  });

  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length - 1, c: headers.length - 1 },
  });

  ws["!cols"] = [
    { wch: 16 }, // Kode
    { wch: 30 }, // Nama
    { wch: 40 }, // Alamat
    { wch: 14 }, // Lat
    { wch: 14 }, // Lng
    { wch: 22 }, // Sales
    { wch: 12 }, // Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Koordinat Outlet");

  const filename = `Master_Koordinat_Outlet_${safeDepot}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * Membaca dan mem-parse file Excel koordinat yang diunggah pengguna.
 */
export async function parseCoordinateExcel(file) {
  const XLSX = await import("xlsx-js-style");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          throw new Error("File Excel tidak memiliki sheet yang valid.");
        }
        const ws = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (!rawRows || rawRows.length < 2) {
          throw new Error("File Excel kosong atau tidak memiliki baris data.");
        }

        // Cari baris header
        let headerRowIdx = -1;
        let codeCol = -1;
        let latCol = -1;
        let lngCol = -1;
        let addrCol = -1;

        const codeAliases = ["KODE OUTLET", "KDRL", "KODE TOKO", "KODE", "OUTLET_CODE", "CODE"];
        const latAliases = ["LATITUDE", "LAT", "LOKASI_LAT", "Y", "LAT_OUTLET"];
        const lngAliases = ["LONGITUDE", "LONG", "LON", "LNG", "LOKASI_LONG", "X", "LONG_OUTLET"];
        const addrAliases = ["ALAMAT", "ALRL", "ALAMAT OUTLET", "ADDRESS", "ALAMAT TOKO"];

        for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
          const row = rawRows[r].map((cell) => String(cell || "").trim().toUpperCase());
          const cIdx = row.findIndex((h) => codeAliases.includes(h));
          const ltIdx = row.findIndex((h) => latAliases.includes(h));
          const lgIdx = row.findIndex((h) => lngAliases.includes(h));

          if (cIdx !== -1 && (ltIdx !== -1 || lgIdx !== -1)) {
            headerRowIdx = r;
            codeCol = cIdx;
            latCol = ltIdx;
            lngCol = lgIdx;
            addrCol = row.findIndex((h) => addrAliases.includes(h));
            break;
          }
        }

        if (headerRowIdx === -1 || codeCol === -1 || latCol === -1 || lngCol === -1) {
          throw new Error(
            "Kolom 'KODE OUTLET', 'LATITUDE', dan 'LONGITUDE' tidak ditemukan. Mohon gunakan template yang disediakan."
          );
        }

        const coordsMap = {};
        let successCount = 0;
        let skippedCount = 0;

        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          const code = String(row[codeCol] ?? "").trim();
          if (!code) continue;

          let rawLat = String(row[latCol] ?? "").replace(/,/g, ".").trim();
          let rawLng = String(row[lngCol] ?? "").replace(/,/g, ".").trim();

          const lat = parseFloat(rawLat);
          const lng = parseFloat(rawLng);

          if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            coordsMap[code] = {
              lat,
              lng,
              address: addrCol !== -1 ? String(row[addrCol] ?? "").trim() : "",
              updatedAt: new Date().toISOString(),
            };
            successCount++;
          } else {
            skippedCount++;
          }
        }

        resolve({
          totalRows: rawRows.length - (headerRowIdx + 1),
          successCount,
          skippedCount,
          coordsMap,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Gagal membaca file Excel."));
    reader.readAsArrayBuffer(file);
  });
}

/* ============================================================================
   AUTO-GEOCODING DENGAN OPENSTREETMAP NOMINATIM
   ============================================================================ */

/**
 * Mencari titik latitude dan longitude berdasarkan string alamat
 * menggunakan OpenStreetMap Nominatim API secara gratis dan aman.
 */
export async function geocodeAddress(address, timeoutMs = 8000) {
  if (!address || !address.trim() || address.trim().length < 4) {
    return null;
  }

  const query = `${address.trim()}, Indonesia`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Nominatim request failed: ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const first = data[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);

    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return {
      lat,
      lng,
      displayName: first.display_name,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Geocoding failed for:", address, err.message);
    return null;
  }
}
