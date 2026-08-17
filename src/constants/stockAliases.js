/* ============================================================================
   STOCK ALIASES — Sprint 19 / Stock Module
   Alias header untuk parser Excel master stok. Konsisten dengan pola aliases
   di aliases.js — case-insensitive, dipakai oleh buildStockFieldMap().

   Header dari sample file user:
   KCAB, KDBR, IPPN, KDGR, GRUP, NMBR, JUML, UNIT, HRST, NTOT,
   JUML1, KONV1, UNIT1, JUML2, KONV2, UNIT2, JUML3, KONV3, UNIT3, NMCB
============================================================================ */
export const STOCK_ALIASES = {
  branchCode: ["KCAB", "KODE CABANG", "KODE GUDANG", "CABANG"],
  productCode: ["KDBR", "KODE BARANG", "KODE PRODUK", "KODE BRG"],
  isActive: ["IPPN", "AKTIF", "ACTIVE"],
  groupCode: ["KDGR", "KODE GRUP", "KODE GROUP"],
  group: ["GRUP", "GROUP", "KATEGORI", "GOLONGAN"],
  productName: ["NMBR", "NAMA BARANG", "NAMA PRODUK", "NAMA BRG"],
  qtyBase: ["JUML", "QTY", "STOK", "JUMLAH", "SALDO"],
  unit: ["UNIT", "SATUAN"],
  unitCost: ["HRST", "HARGA SATUAN", "HARGA", "COST", "HPP"],
  totalValue: ["NTOT", "NILAI TOTAL", "VALUE", "NILAI"],
  // Konversi 3-level (sama dengan pattern KONV/baseUnit di excelParse.js)
  conv1Qty: ["JUML1", "JUML_1"], conv1Factor: ["KONV1", "KONV_1"], conv1Unit: ["UNIT1", "UNIT_1"],
  conv2Qty: ["JUML2", "JUML_2"], conv2Factor: ["KONV2", "KONV_2"], conv2Unit: ["UNIT2", "UNIT_2"],
  conv3Qty: ["JUML3", "JUML_3"], conv3Factor: ["KONV3", "KONV_3"], conv3Unit: ["UNIT3", "UNIT_3"],
  branchName: ["NMCB", "NAMA CABANG", "NAMA GUDANG", "NAMA DEPO"],
};
