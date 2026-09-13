/* ============================================================================
   COLUMN ALIASES for flexible excel parsing
   Setiap field punya daftar kemungkinan nama header (case-insensitive).
   buildFieldMap di utils/excelParse.js akan mencocokkan header file Excel
   dengan alias-alias ini untuk menemukan indeks kolom yang sesuai.
============================================================================ */
export const ALIASES = {
  date: ["TGFK", "TANGGAL", "TANGGAL FAKTUR", "DATE"],
  salesCode: ["KDSL", "KODE SALES", "SALES CODE", "KODE SALESMAN"],
  salesName: ["NMSL", "SALESMAN", "NAMA SALES", "NAMA SALESMAN"],
  outletCode: ["KDRL", "KODE OUTLET", "KODE TOKO"],
  outletName: ["NMRL", "NAMA OUTLET", "NAMA TOKO"],
  // ⚠️ Sprint 17i: alamat outlet — opsional (tidak semua file export sistem
  // sell-out punya kolom ini). Dipakai di export Excel Analisis Outlet.
  // ⚠️ Sprint 17j: tambah alias "ALRL" (dipakai di file export user).
  outletAddress: ["ALRL", "ALAMAT", "ALAMAT OUTLET", "ALAMAT TOKO", "ADDRESS", "ALAMAT2"],
  invoiceNo: ["NOFK", "NO FAKTUR", "INVOICE"],
  productCode: ["KDBR", "KODE BARANG", "KODE PRODUK"],
  productName: ["NMBR", "NAMA BARANG", "PRODUCT", "PRODUK"],
  qty: ["JUML", "QTY", "QUANTITY"],
  unit: ["UNIT", "SATUAN"],
  konv: ["KONV"],
  baseUnit: ["UNITK"],
  value: ["NTOT", "VALUE", "NILAI", "TOTAL"],
  group: ["GRUP", "GROUP", "KATEGORI", "GOLONGAN"],
  latitude: ["LAT", "LATITUDE", "LOKASI_LAT", "LAT_OUTLET", "Y"],
  longitude: ["LONG", "LONGITUDE", "LON", "LNG", "LOKASI_LONG", "LONG_OUTLET", "X"],
  coordinates: ["KOORDINAT", "COORDINATE", "GEO", "GPS", "LOKASI"],
};

export const FIELD_LABELS = {
  date: "Tanggal", salesCode: "Kode Sales", salesName: "Nama Sales", outletCode: "Kode Outlet",
  outletName: "Nama Outlet", outletAddress: "Alamat Outlet", invoiceNo: "No Faktur",
  productCode: "Kode Produk", productName: "Nama Produk",
  qty: "Kuantitas", unit: "Satuan", konv: "Faktor Konversi (KONV)", baseUnit: "Satuan Dasar (UNITK)",
  value: "Nilai (Rp)", group: "Grup Produk",
  latitude: "Latitude", longitude: "Longitude", coordinates: "Koordinat",
};
