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
  invoiceNo: ["NOFK", "NO FAKTUR", "INVOICE"],
  productCode: ["KDBR", "KODE BARANG", "KODE PRODUK"],
  productName: ["NMBR", "NAMA BARANG", "PRODUCT", "PRODUK"],
  qty: ["JUML", "QTY", "QUANTITY"],
  unit: ["UNIT", "SATUAN"],
  konv: ["KONV"],
  baseUnit: ["UNITK"],
  value: ["NTOT", "VALUE", "NILAI", "TOTAL"],
  group: ["GRUP", "GROUP", "KATEGORI", "GOLONGAN"],
};

export const FIELD_LABELS = {
  date: "Tanggal", salesCode: "Kode Sales", salesName: "Nama Sales", outletCode: "Kode Outlet",
  outletName: "Nama Outlet", invoiceNo: "No Faktur", productCode: "Kode Produk", productName: "Nama Produk",
  qty: "Kuantitas", unit: "Satuan", konv: "Faktor Konversi (KONV)", baseUnit: "Satuan Dasar (UNITK)",
  value: "Nilai (Rp)", group: "Grup Produk",
};
