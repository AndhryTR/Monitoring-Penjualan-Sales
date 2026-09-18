// aiDispatcher — konteks ringkas + transport Direct + parse + validasi (Task 3).
// Catatan: ALLOWLIST didefinisikan di sini; Task 4 (aiTools.js) akan memilikinya
// dan modul ini cukup re-export agar impor tunggal dari aiTools.
// Tahap 1: tambah cariOutlet, cariProduk, detailSales, analisisDrop + ReAct loop + chat history.
// Tahap 2: tambah navigasiTab, aturFilter, resetFilter — UI Action Tools.

export const ALLOWLIST = [
  "chat",
  "queryData",
  "bacaBulanan",
  "bacaTarget",
  "bacaJadwal",
  "bacaStok",
  "bacaTransaksi",
  "analisis",
  "setTarget",
  "setJadwal",
  "hapusDataAktif",
  "exportCustom",
  // Tahap 1: smart client-side search
  "cariOutlet",
  "cariProduk",
  "detailSales",
  "analisisDrop",
  // Tahap 2: UI Action Tools
  "navigasiTab",
  "aturFilter",
  "resetFilter",
  // Tahap 3: Deep Data & Inventory
  "cariStok",
];



export const WRITE_TOOLS = [
  "setTarget", "setJadwal", "hapusDataAktif", "exportCustom",
  "navigasiTab", "aturFilter", "resetFilter",
];
export const WRITE_TOOLS_SET = new Set(WRITE_TOOLS);

function num(n, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? Number(v.toFixed(d)) : 0;
}

function str(v, max = 80) {
  const s = String(v ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// Ringkasan konteks — HANYA field ringkas yang diteruskan ke LLM.
// Batasan keras: extra mentah (rawRows/transaksi/depots penuh) DIBUANG di sini
// sebagai pengaman lapis kedua bila pemanggil kirim objek mentah (pernah
// sebabkan "Input is too long" — payload puluhan MB walau perintah "hai").
const MAX_LIST = 30;
const MAX_STR = 40;

function slimSales(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_LIST).map((s) => ({
    kode: str(s.kode ?? s.code ?? s.id ?? "", 24),
    nama: str(s.nama ?? s.name ?? "", MAX_STR),
    ach: num(s.ach ?? s.achievement ?? 0, 1),
    total: num(s.total ?? s.realisasi ?? s.value ?? 0, 0),
  }));
}

function slimSemua(s) {
  if (!s || typeof s !== "object") return null;
  return {
    total: num(s.total ?? 0, 0),
    target: num(s.target ?? 0, 0),
    ach: s.ach != null ? num(s.ach, 1) : null,
    ao: num(s.ao ?? 0, 0),
    nBaris: num(s.nBaris ?? 0, 0),
    dari: s.dari ?? null, sampai: s.sampai ?? null, hari: num(s.hari ?? 0, 0),
    sales: slimSales(s.sales),
  };
}

function slimBulanan(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 24).map((m) => ({
    bulan: str(m.bulan ?? "", 10),
    label: str(m.label ?? "", 24),
    total: num(m.total ?? 0, 0),
    target: num(m.target ?? 0, 0),
    ach: m.ach != null ? num(m.ach, 1) : null,
    ao: num(m.ao ?? 0, 0),
    nBaris: num(m.nBaris ?? 0, 0),
    sales: slimSales(m.sales),
  }));
}
function slimTargets(t) {
  const list = Array.isArray(t)
    ? t
    : t && typeof t === "object"
      ? Object.entries(t).slice(0, MAX_LIST).map(([kode, v]) => (
        v && typeof v === "object"
          ? { kode, ...(v) }
          : { kode, value: v }
      ))
      : [];
  return list.slice(0, MAX_LIST).map((x) => ({
    kode: str(x.kode ?? x.code ?? "", 24),
    nama: str(x.nama ?? x.name ?? "", MAX_STR),
    value: num(x.value ?? x.total?.value ?? x.nilai ?? 0, 0),
    ao: num(x.ao ?? x.total?.ao ?? 0, 0),
  }));
}

export function buildContext(input = {}) {
  const { agg = {}, filters = {} } = input;
  // agg boleh bentuk ringkas (total/achGlobal) atau mentah (totals.*) — normalisasi.
  const totals = agg?.totals && typeof agg.totals === "object" ? agg.totals : agg;
  // extra HANYA ambil hitungan yang sudah diringkas pemanggil; array mentah dibuang.
  const extra = input.extra && typeof input.extra === "object" ? input.extra : {};
  const extraSafe = {};
  for (const [k, v] of Object.entries(extra)) {
    if (Array.isArray(v)) {
      extraSafe[k + "Count"] = v.length;
    } else if (v && typeof v === "object") {
      const keys = Object.keys(v);
      extraSafe[k] = keys.length > MAX_LIST ? { keys: keys.length } : v;
    } else if (typeof v === "number" || typeof v === "string" || typeof v === "boolean" || v == null) {
      extraSafe[k] = typeof v === "string" ? str(v, 120) : v;
    }
  }
  return {
    total: num(input.total ?? totals.realisasiValue ?? totals.total ?? 0, 0),
    targetValue: num(input.targetValue ?? totals.targetValue ?? 0, 0),
    achGlobal: num(input.achGlobal ?? totals.ach ?? 0, 1),
    ao: num(input.ao ?? totals.realisasiAo ?? totals.ao ?? 0, 0),
    nBaris: num(input.nBaris ?? 0, 0),
    periode: input.periode && typeof input.periode === "object" ? input.periode : {},
    depotName: str(input.depotName ?? "", MAX_STR),
    nDepo: num(input.nDepo ?? 0, 0),
    filterAktif: filters && typeof filters === "object"
      ? { sales: Array.isArray(filters.salesCodes) ? filters.salesCodes.length : (filters.sales ?? 0), groups: Array.isArray(filters.groups) ? filters.groups.slice(0, MAX_LIST) : filters.groups ?? [] }
      : {},
    sales: slimSales(input.sales),
    targets: slimTargets(input.targets),
    semua: slimSemua(input.semua),
    bulanan: slimBulanan(input.bulanan),
    stok: input.stok && typeof input.stok === "object" ? input.stok : null,
    extra: extraSafe,
  };
}

// Skema OpenAI-compatible Tools untuk native function calling.
// Digunakan oleh provider modern (Groq, OpenRouter, OpenAI, DeepSeek, vLLM).
export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "cariOutlet",
      description: "Cari toko/outlet pelanggan berdasarkan nama, kode, atau status keaktifan (aktif/berisiko/dormant).",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Kata kunci nama atau kode outlet" },
          status: { type: "string", enum: ["aktif", "berisiko", "dormant", "semua"], description: "Filter status keaktifan toko" },
          sortBy: { type: "string", enum: ["value", "transaksi", "terakhir"], description: "Urutkan berdasarkan omzet, jumlah invoice, atau tanggal belanja terakhir" },
          limit: { type: "integer", description: "Maksimum jumlah outlet yang ditampilkan (default 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cariProduk",
      description: "Cari produk/SKU barang dagangan berdasarkan nama atau grup produk.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Kata kunci nama atau kode produk/SKU" },
          grup: { type: "string", description: "Filter nama grup produk (mis. MINYAK, MAKANAN)" },
          sortBy: { type: "string", enum: ["value", "qty", "outlet"], description: "Urutkan berdasarkan omzet nilai, kuantitas, atau jangkauan toko" },
          limit: { type: "integer", description: "Maksimum jumlah produk (default 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detailSales",
      description: "Ambil profil komprehensif 1 orang sales: pencapaian ACH, realisasi vs target, outlet utama, dan tren bulanan.",
      parameters: {
        type: "object",
        properties: {
          kode: { type: "string", description: "Kode sales (mis. AGM01, S01)" },
          nama: { type: "string", description: "Nama sales jika kode tidak diketahui" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analisisDrop",
      description: "Analisis otomatis performa tim penjualan: identifikasi sales dengan ACH terendah/merah dan hitung gap kekurangan target.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cariStok",
      description: "Cek stok inventaris fisik per SKU atau filter barang yang habis (stockout), kritis (< 7 hari coverage), atau overstock.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Kata kunci nama atau kode SKU barang" },
          status: { type: "string", enum: ["habis", "kritis", "overstock", "semua"], description: "Filter kondisi stok" },
          grup: { type: "string", description: "Filter nama grup produk" },
          limit: { type: "integer", description: "Batas jumlah data (default 15)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bacaStok",
      description: "Ambil ringkasan global status inventaris gudang (total SKU, total barang habis, total barang kritis).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bacaTransaksi",
      description: "Cari riwayat faktur/transaksi faktual penjualan dengan filter fleksibel.",
      parameters: {
        type: "object",
        properties: {
          invoiceNo: { type: "string", description: "Nomor faktur / invoice" },
          outlet: { type: "string", description: "Nama atau kode toko/outlet" },
          sales: { type: "string", description: "Nama atau kode sales pembina" },
          produk: { type: "string", description: "Nama atau kode produk yang terjual" },
          dari: { type: "string", description: "Tanggal mulai (format YYYY-MM-DD)" },
          sampai: { type: "string", description: "Tanggal akhir (format YYYY-MM-DD)" },
          limit: { type: "integer", description: "Maksimal faktur yang ditampilkan (default 15)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigasiTab",
      description: "Pindahkan tampilan dashboard ke halaman/tab tertentu (memerlukan persetujuan pengguna).",
      parameters: {
        type: "object",
        properties: {
          tab: {
            type: "string",
            enum: ["executive", "main", "sales", "product", "focus", "outlet", "trend", "compare", "transactions", "stock", "quality"],
            description: "Nama key tab halaman tujuan",
          },
        },
        required: ["tab"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "aturFilter",
      description: "Terapkan filter sales, grup barang, atau tanggal ke dashboard (memerlukan persetujuan pengguna).",
      parameters: {
        type: "object",
        properties: {
          salesCodes: { type: "array", items: { type: "string" }, description: "Daftar kode sales yang difilter" },
          groups: { type: "array", items: { type: "string" }, description: "Daftar nama grup produk yang difilter" },
          dateFrom: { type: "string", description: "Tanggal mulai YYYY-MM-DD" },
          dateTo: { type: "string", description: "Tanggal akhir YYYY-MM-DD" },
          datePreset: { type: "string", description: "Preset tanggal (mis. all, custom)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resetFilter",
      description: "Hapus semua filter aktif dan tampilkan seluruh data dashboard (memerlukan persetujuan pengguna).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryData",
      description: "Ambil peringkat sales berdasarkan ACH, total omzet, atau nama.",
      parameters: {
        type: "object",
        properties: {
          sortBy: { type: "string", enum: ["ach", "total", "nama"], description: "Kriteria pengurutan" },
          order: { type: "string", enum: ["asc", "desc"], description: "Urutan menaik atau menurun" },
          limit: { type: "integer", description: "Jumlah baris (default 5)" },
          minAch: { type: "number", description: "Ambang batas minimum ACH" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bacaBulanan",
      description: "Ambil deret tren performa penjualan bulanan.",
      parameters: {
        type: "object",
        properties: {
          kode: { type: "string", description: "Filter sales tertentu (opsional)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bacaTarget",
      description: "Baca daftar target penjualan per sales atau filter sales tertentu.",
      parameters: {
        type: "object",
        properties: {
          kode: { type: "string", description: "Kode atau nama sales" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bacaJadwal",
      description: "Baca jadwal rencana kunjungan sales per hari.",
      parameters: {
        type: "object",
        properties: {
          hari: { type: "string", description: "Nama hari kunjungan (senin, selasa, dll)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analisis",
      description: "Ringkasan cepat performa global penjualan dan tim terendah.",
      parameters: {
        type: "object",
        properties: {
          rentang: { type: "string", enum: ["semua", "filter"], description: "Cakupan semua data atau filter layar" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "setTarget",
      description: "Ubah target penjualan sales (memerlukan persetujuan pengguna).",
      parameters: {
        type: "object",
        properties: {
          kode: { type: "string", description: "Kode sales" },
          nilai: { type: "number", description: "Target nilai rupiah baru" },
          ao: { type: "number", description: "Target active outlet baru" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exportCustom",
      description: "Ekspor data laporan monitoring ke file Excel (memerlukan persetujuan pengguna).",
      parameters: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["xlsx", "csv"], description: "Format file ekspor" },
          scope: { type: "string", description: "Cakupan data yang diekspor" },
          filename: { type: "string", description: "Nama file tujuan" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "chat",
      description: "Gunakan untuk percakapan umum, sapaan, ucapan terima kasih, atau penjelasan tanpa aksi data.",
      parameters: {
        type: "object",
        properties: {
          jawaban: { type: "string", description: "Teks balasan ramah dalam Bahasa Indonesia" },
        },
        required: ["jawaban"],
      },
    },
  },
];

export const SYSTEM_PROMPT = [

  "Kamu dispatcher tool untuk aplikasi monitoring penjualan sales.",
  "Jawab HANYA JSON valid: {\"tool\": string, \"params\": object, \"ringkasan\": string}.",
  "Tanpa markdown, tanpa kode fence, tanpa teks di luar JSON.",
  "tool wajib salah satu dari: " + ALLOWLIST.join(", ") + ".",
  "Selain daftar itu DILARANG — jangan buat nama tool lain.",
  "",
  "OBROLAN UMUM: sapaan (hai/halo/pagi), terima kasih, tanya kabar/kemampuan",
  "  -> tool `chat`, params {\"jawaban\": \"teks balasan Bahasa Indonesia ramah + tawarkan bantuan\"}.",
  "  Contoh: \"hai\" -> {\"tool\":\"chat\",\"params\":{\"jawaban\":\"Halo! Saya asisten monitoring penjualan. Mau analisis ACH, cari outlet/produk, ubah target, atau export laporan?\"},\"ringkasan\":\"Sapaan\"}.",
  "",
  "PENCARIAN DATA:",
  "  cariOutlet: cari toko/outlet. params: {\"q\":\"kata kunci nama/kode\",\"status\":\"aktif|berisiko|dormant\",\"sortBy\":\"value|transaksi|terakhir\",\"limit\":N}.",
  "    Contoh: \"outlet dormant\" -> {\"tool\":\"cariOutlet\",\"params\":{\"status\":\"dormant\",\"limit\":10},\"ringkasan\":\"Cari outlet tidak aktif >30 hari\"}.",
  "    Contoh: \"toko Sumber Rejeki\" -> {\"tool\":\"cariOutlet\",\"params\":{\"q\":\"sumber rejeki\"},\"ringkasan\":\"Cari outlet Sumber Rejeki\"}.",
  "  cariProduk: cari SKU/produk. params: {\"q\":\"kata kunci\",\"grup\":\"nama grup\",\"sortBy\":\"value|qty|outlet\",\"limit\":N}.",
  "    Contoh: \"produk minyak goreng\" -> {\"tool\":\"cariProduk\",\"params\":{\"q\":\"minyak goreng\"},\"ringkasan\":\"Cari produk minyak goreng\"}.",
  "  detailSales: profil mendalam 1 sales. params: {\"kode\":\"kode sales\",\"nama\":\"nama sales\"}.",
  "    Contoh: \"detail sales Budi\" -> {\"tool\":\"detailSales\",\"params\":{\"nama\":\"budi\"},\"ringkasan\":\"Profil lengkap sales Budi\"}.",
  "  analisisDrop: identifikasi penyebab performa rendah, gap target, sales merah. params: {}.",
  "    Contoh: \"kenapa ACH turun\" -> {\"tool\":\"analisisDrop\",\"params\":{},\"ringkasan\":\"Analisis penyebab ACH rendah\"}.",
  "  bacaTransaksi: cari data faktur/transaksi spesifik. params: {\"invoiceNo\":\"no faktur\", \"outlet\":\"nama/kode outlet\", \"sales\":\"nama/kode sales\", \"produk\":\"nama/kode produk\", \"dari\":\"YYYY-MM-DD\", \"sampai\":\"YYYY-MM-DD\", \"limit\":N}.",
  "    Contoh: \"transaksi Toko Sumber\" -> {\"tool\":\"bacaTransaksi\",\"params\":{\"outlet\":\"sumber\"},\"ringkasan\":\"Cek faktur Toko Sumber\"}.",
  "    Contoh: \"cari faktur INV-001\" -> {\"tool\":\"bacaTransaksi\",\"params\":{\"invoiceNo\":\"INV-001\"},\"ringkasan\":\"Cari faktur INV-001\"}.",
  "  cariStok: cek stok inventaris fisik per SKU atau filter barang kritis. params: {\"q\":\"nama/kode SKU\", \"status\":\"habis|kritis|overstock|semua\", \"grup\":\"nama grup\", \"limit\":N}.",
  "    Contoh: \"stok barang yang habis\" -> {\"tool\":\"cariStok\",\"params\":{\"status\":\"habis\"},\"ringkasan\":\"Cek barang habis / stockout\"}.",
  "    Contoh: \"stok yang menipis atau kritis\" -> {\"tool\":\"cariStok\",\"params\":{\"status\":\"kritis\"},\"ringkasan\":\"Cek barang coverage < 7 hari\"}.",
  "    Contoh: \"sisa stok Beras 5kg\" -> {\"tool\":\"cariStok\",\"params\":{\"q\":\"beras 5kg\"},\"ringkasan\":\"Cek stok Beras 5kg\"}.",
  "  bacaStok: ringkasan global stok (total SKU, habis, kritis, nilai). params: {}.",
  "",
  "ANALISIS & TREN:",
  "  queryData: dukung params {\"sortBy\":\"ach|total|nama\", \"order\":\"asc|desc\", \"limit\":N, \"minAch\":N}.",
  "    Contoh: \"3 sales terendah\" -> {\"tool\":\"queryData\",\"params\":{\"sortBy\":\"ach\",\"order\":\"asc\",\"limit\":3},\"ringkasan\":\"Ambil 3 sales ACH terendah\"}.",
  "  RENTANG WAKTU: \"3 bulan terakhir\", \"bulan lalu\", \"tren penjualan\" -> tool `bacaBulanan`.",
  "  analisis: ringkasan global ACH, sales di bawah target. analisisDrop: lebih dalam, cari gap.",
  "  queryData/analisis tanpa rentang = cakupan SEMUA data (bukan filter layar).",
  "  Hanya pakai filter layar bila user eksplisit sebut (\"di filter ini\", \"yang tampil\").",
  "",
  "NAVIGASI & FILTER DASHBOARD (memerlukan konfirmasi user sebelum dieksekusi):",
  "  navigasiTab: pindah ke halaman/tab dashboard.",
  "    Tab tersedia: executive (Ringkasan), main (Main Report), sales (Sales Report),",
  "    product (Product Report), focus (Produk Fokus), outlet (Analisis Outlet),",
  "    trend (Tren Periode), compare (Perbandingan), transactions (Transaksi),",
  "    stock (Stok Barang), quality (Catatan Data).",
  "    params: { \"tab\": \"outlet\" }",
  "    Contoh: \"buka halaman outlet\" -> {\"tool\":\"navigasiTab\",\"params\":{\"tab\":\"outlet\"},\"ringkasan\":\"Buka Analisis Outlet\"}.",
  "    Contoh: \"pergi ke transaksi\" -> {\"tool\":\"navigasiTab\",\"params\":{\"tab\":\"transactions\"},\"ringkasan\":\"Buka halaman Transaksi\"}.",
  "  aturFilter: ubah filter dashboard (sales, grup, tanggal).",
  "    params: { \"salesCodes\":[\"S01\",\"S02\"], \"groups\":[\"MINYAK\"], \"dateFrom\":\"2024-01-01\", \"dateTo\":\"2024-01-31\" }",
  "    PENTING: untuk filter sales, gunakan kode sales (bukan nama). Cari kode dulu dengan cariOutlet/detailSales jika belum tahu.",
  "    Contoh: \"filter bulan Januari\" -> {\"tool\":\"aturFilter\",\"params\":{\"dateFrom\":\"2024-01-01\",\"dateTo\":\"2024-01-31\"},\"ringkasan\":\"Filter ke Januari 2024\"}.",
  "    Contoh: \"tampilkan grup minyak saja\" -> {\"tool\":\"aturFilter\",\"params\":{\"groups\":[\"MINYAK\"]},\"ringkasan\":\"Filter ke grup MINYAK\"}.",
  "  resetFilter: hapus semua filter aktif. params: {}",
  "    Contoh: \"tampilkan semua data\" -> {\"tool\":\"resetFilter\",\"params\":{},\"ringkasan\":\"Reset semua filter\"}.",
  "    Contoh: \"hapus filter\" -> {\"tool\":\"resetFilter\",\"params\":{},\"ringkasan\":\"Hapus semua filter aktif\"}.",
  "",
  "params wajib object (boleh {}). ringkasan wajib string Bahasa Indonesia singkat.",
  "Bila perintah menyebut nama orang/toko/produk -> pakai cariOutlet/cariProduk/detailSales.",
  "Bila perintah tanya stok/inventaris/barang habis/menipis -> pakai cariStok atau bacaStok.",
  "Bila perintah cari transaksi/faktur/nota belanja -> pakai bacaTransaksi.",
  "Bila perintah soal performa rendah/drop/merah -> pakai analisisDrop atau detailSales.",
  "Bila perintah minta pindah halaman/tab -> pakai navigasiTab.",
  "Bila perintah minta ubah filter/tampilan -> pakai aturFilter atau resetFilter.",
].join("\n");



// Prompt untuk tahap sintesis ReAct: AI sudah dapat data dari tool, sekarang merangkum.
export const SYNTHESIS_PROMPT = [
  "Kamu asisten analitik penjualan. Data tool sudah diambil dan tersedia di riwayat percakapan.",
  "Tugas kamu: buat ANALISIS NARATIF yang informatif berdasarkan data yang sudah ada.",
  "Jawab dalam Bahasa Indonesia yang jelas dan actionable.",
  "Format: jawab JSON {\"tool\":\"chat\",\"params\":{\"jawaban\":\"...\"},\"ringkasan\":\"Sintesis data\"}.",
  "Isi jawaban WAJIB mencakup:",
  "  - Kesimpulan utama dari data yang ditemukan",
  "  - Angka-angka penting (ACH, omzet, jumlah outlet, dll)",
  "  - Rekomendasi atau langkah selanjutnya bila relevan",
  "  - Maksimum 400 kata, terstruktur dengan baris baru untuk keterbacaan",
  "JANGAN panggil tool lain — hanya rangkum dari data yang sudah ada.",
].join("\n");



export function mapDispatchError(err, res, opts) {
  const status = res?.status ?? err?.status;
  if (status === 401) return new Error("API key salah / habis (401). Periksa key di setelan AI.");
  if (status === 429) return new Error("Limit tercapai (429). Tunggu sebentar lalu coba lagi.");
  if (err instanceof TypeError || err?.name === "TypeError") {
    return new Error("Base URL tak reachable / CORS diblokir — periksa baseURL atau coba mode Proxy.");
  }
  if (err?.name === "AbortError") {
    // Sumber reason: signal pemanggil (drawer) > reason error > default timeout.
    // Chrome: DOMException AbortError tak bawa .reason ("aborted without reason"),
    // tapi opts.signal.reason selalu ada bila batal manual.
    const fromSignal = opts?.signal?.reason;
    const fromErr = err?.reason ?? err?.cause;
    const pick = fromSignal ?? fromErr;
    const msg = pick instanceof Error ? pick.message : (typeof pick === "string" && pick ? pick : "");
    return new Error(msg || "Request dibatalkan (timeout 90 detik — server AI tak merespons).");
  }
  return err instanceof Error ? err : new Error(String(err ?? "Gagal memanggil AI."));
}

// Parse respons OpenAI-compatible, mendukung JSON standar maupun fallback stream SSE (data: {...}).
// Respons kosong = ERROR (bukan sukses diam) — pernah tampilkan "Terhubung!" palsu
// padahal request tak sampai ke provider (tanpa riwayat di dashboard).
// Parse respons OpenAI-compatible, mendukung JSON standar, native tool_calls, maupun fallback stream SSE (data: {...}).
// Respons kosong = ERROR (bukan sukses diam).
export function parseOpenAiResponseText(rawText) {
  const text = String(rawText || "").trim();
  if (!text) throw new Error("Respons kosong dari server AI — request tak sampai ke provider (cek tunnel/Base URL).");

  // 1. Coba parse sebagai JSON biasa
  try {
    const data = JSON.parse(text);
    const msg = data?.choices?.[0]?.message;

    // A. Native Tool Calling: jika ada tool_calls, kembalikan objek khusus
    if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) {
      const tc = msg.tool_calls[0];
      const fnName = tc?.function?.name;
      let fnArgs = {};
      try {
        fnArgs = JSON.parse(tc?.function?.arguments || "{}");
      } catch {
        fnArgs = {};
      }
      return {
        isNativeToolCall: true,
        tool: fnName,
        params: fnArgs,
        ringkasan: `Panggil tool ${fnName}`,
        toolCallId: tc?.id,
        rawText: text,
      };
    }

    const content = msg?.content;
    if (content !== undefined && content !== null) {
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((c) => (typeof c === "string" ? c : c?.text || "")).join("");
      }
      return String(content);
    }
    if (data?.choices?.[0]?.text !== undefined && data?.choices?.[0]?.text !== null) {
      return String(data.choices[0].text);
    }
    if (data?.text !== undefined && data?.text !== null) return String(data.text);
    if (data?.response !== undefined && data?.response !== null) return String(data.response);
  } catch {
    // Bukan JSON standar, lanjut ke fallback SSE
  }

  // 2. Fallback: Parse Server-Sent Events (data: {...})
  const lines = text.split("\n");
  let combinedContent = "";
  let hasValidSse = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "data: [DONE]") continue;
    if (trimmed.startsWith("data:")) {
      try {
        const jsonStr = trimmed.slice(5).trim();
        const parsed = JSON.parse(jsonStr);
        const delta =
          parsed?.choices?.[0]?.delta?.content ??
          parsed?.choices?.[0]?.message?.content ??
          "";
        combinedContent += delta;
        hasValidSse = true;
      } catch {
        // Abaikan baris SSE yang tidak valid
      }
    }
  }

  if (hasValidSse) return combinedContent;
  throw new Error(`Format respons AI tidak valid: ${text.slice(0, 120)}`);
}


// Deteksi runtime Tauri (desktop exe) — invoke IPC, bebas CORS/CSP WebView.
export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// POST via command Rust `ai_chat` (reqwest) — khusus Tauri desktop.
// Key tetap di device (disimpan via setelan), request keluar dari Rust.
// Catatan: invoke yang sudah jalan tak bisa dibatalkan dari JS;
// timeout 90s ditegakkan di sisi Rust (reqwest + tokio).
export async function callTauri(settings, messages) {
  const baseURL = String(settings?.baseURL ?? "").replace(/\/+$/, "");
  if (!baseURL) throw new Error("baseURL kosong — isi di setelan AI.");
  if (!settings?.model) throw new Error("model kosong — isi di setelan AI.");
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const rawText = await invoke("ai_chat", {
      req: {
        base_url: baseURL,
        api_key: settings?.key || "",
        model: settings.model,
        messages,
        json_mode: settings?.apiType !== "custom",
      },
    });
    return parseOpenAiResponseText(rawText);
  } catch (e) {
    const msg = typeof e === "string" ? e : (e?.message || String(e));
    throw new Error(msg);
  }
}

// Helper membaca stream SSE (Server-Sent Events) secara realtime.
// Mengalirkan setiap delta token ke callback onDelta(textChunk) dan mengembalikan teks utuh.
export async function readSseStream(response, onDelta) {

  if (!response?.body || typeof response.body.getReader !== "function") {
    // Fallback bila runtime tidak memiliki getReader
    const text = await response.text();
    const content = parseOpenAiResponseText(text);
    if (typeof onDelta === "function" && typeof content === "string") onDelta(content);
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullContent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Proses per baris
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // simpan sisa baris belum lengkap

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (trimmed.startsWith("data:")) {
          try {
            const json = JSON.parse(trimmed.slice(5).trim());
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullContent += delta;
              if (typeof onDelta === "function") onDelta(delta);
            }
          } catch {
            // Abaikan JSON parsial
          }
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  return fullContent;
}

// POST ke backend proxy same-origin; API key provider tetap berada di server.
export async function callProxy(settings, messages, opts = {}) {
  const proxyURL = String(settings?.backendURL || "/api/ai").trim().replace(/\/+$/, "") || "/api/ai";
  if (!settings?.model) throw new Error("model kosong — isi di setelan AI.");
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 60000;
  const isStream = opts.stream === true && typeof opts.onDelta === "function";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const useTools = opts.useTools !== false && Array.isArray(opts.tools || TOOL_SCHEMAS);
    const body = {
      model: settings.model,
      messages,
      stream: isStream,
      ...(useTools ? { tools: opts.tools || TOOL_SCHEMAS, tool_choice: opts.tool_choice || "auto" } : {}),
    };
    const res = await fetchFn(proxyURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw Object.assign(mapDispatchError(null, res), { status: res.status });
    if (isStream) {
      return await readSseStream(res, opts.onDelta);
    }
    return parseOpenAiResponseText(await res.text());
  } catch (e) {
    throw e instanceof TypeError ? mapDispatchError(e) : e;
  } finally {
    clearTimeout(timer);
  }
}

// POST {baseURL}/chat/completions, timeout 90s (tunnel lambat).
// Mendukung Native Tool Calling serta SSE Chunk Streaming (opsional via opts.onDelta).
export async function callDirect(settings, messages, opts = {}) {
  const baseURL = String(settings?.baseURL ?? "").replace(/\/+$/, "");
  if (!baseURL) throw new Error("baseURL kosong — isi di setelan AI.");
  if (!settings?.model) throw new Error("model kosong — isi di setelan AI.");
  const url = baseURL + "/chat/completions";
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 90000;
  const useTools = opts.useTools !== false && settings?.apiType !== "custom" && Array.isArray(opts.tools || TOOL_SCHEMAS);
  const isStream = opts.stream === true && typeof opts.onDelta === "function";

  const ctrl = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort(opts.signal.reason);
    else opts.signal.addEventListener("abort", () => ctrl.abort(opts.signal.reason), { once: true });
  }
  const t = setTimeout(() => ctrl.abort(new Error("Timeout 90 detik — server AI tak merespons.")), timeoutMs);

  // Buat payload dengan native tools atau streaming
  const makeBody = (withTools, withStream) => ({
    model: settings.model,
    messages,
    stream: withStream,
    ...(withTools
      ? { tools: opts.tools || TOOL_SCHEMAS, tool_choice: opts.tool_choice || "auto" }
      : settings?.apiType !== "custom" && !withStream ? { response_format: { type: "json_object" } } : {}),
  });

  try {
    let res = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings?.key ? { Authorization: "Bearer " + settings.key } : {}),
      },
      body: JSON.stringify(makeBody(useTools, isStream)),
      signal: ctrl.signal,
    });

    // Fallback: Jika provider menolak parameter `tools` (400 Bad Request), coba ulang tanpa `tools`
    if (!res.ok && res.status === 400 && useTools) {
      try {
        const retryRes = await fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(settings?.key ? { Authorization: "Bearer " + settings.key } : {}),
          },
          body: JSON.stringify(makeBody(false, isStream)),
          signal: ctrl.signal,
        });
        if (retryRes.ok) res = retryRes;
      } catch {
        // Biarkan error awal ditangani di bawah jika retry gagal
      }
    }

    if (!res.ok) throw Object.assign(mapDispatchError(null, res), { status: res.status });
    if (isStream) {
      return await readSseStream(res, opts.onDelta);
    }
    const rawText = await res.text();
    return parseOpenAiResponseText(rawText);
  } catch (e) {
    throw mapDispatchError(e, null, opts);
  } finally {
    clearTimeout(t);
  }
}



// Validasi tool call. Sukses: {ok:true, tool, params, ringkasan}.
// Gagal: {ok:false, reason, raw}.
// Model sering bungkus JSON dalam fence markdown (```json ... ```) atau
// selipkan teks di sekitarnya — ekstrak objek {...} dulu sebelum parse.
function extractJsonObject(text) {
  let s = String(text ?? "").trim();
  // Buang fence markdown bila ada.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    return { obj: JSON.parse(s), raw: s };
  } catch { /* lanjut */ }
  // Ambil objek {...} pertama yang parse valid (tahan brace dalam string).
  let start = -1;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const candidate = s.slice(start, i + 1);
        try {
          return { obj: JSON.parse(candidate), raw: candidate };
        } catch { /* coba objek berikutnya */ }
        start = -1;
      }
    }
  }
  return { obj: null, raw: s };
}

export function parseToolCall(input) {
  // Jika input sudah berbentuk native tool call object dari parseOpenAiResponseText
  if (input && typeof input === "object" && input.isNativeToolCall) {
    const { tool, params, ringkasan, toolCallId, rawText } = input;
    if (!ALLOWLIST.includes(tool)) {
      return { ok: false, reason: `Tool asing/dilarang: ${String(tool ?? "?")}.`, raw: rawText };
    }
    return {
      ok: true,
      tool,
      params: params ?? {},
      ringkasan: ringkasan || `Tool: ${tool}`,
      toolCallId,
      isNativeToolCall: true,
    };
  }

  const raw = String(input ?? "");
  const { obj } = extractJsonObject(raw);
  if (!obj) {
    return { ok: false, reason: "JSON rusak — tampilkan mentah.", raw };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, reason: "Format bukan object JSON.", raw };
  }
  const { tool, params, ringkasan } = obj;
  if (typeof tool !== "string" || !ALLOWLIST.includes(tool)) {
    return { ok: false, reason: `Tool asing/dilarang: ${String(tool ?? "?")}.`, raw };
  }

  if (params !== undefined && (typeof params !== "object" || params === null || Array.isArray(params))) {
    return { ok: false, reason: "params harus object.", raw };
  }
  if (typeof ringkasan !== "string") {
    return { ok: false, reason: "ringkasan harus string.", raw };
  }
  const out = { ok: true, tool, params: params ?? {}, ringkasan };
  // chat: jawaban wajib string tak kosong (itu seluruh isi balasan).
  if (tool === "chat") {
    const j = out.params?.jawaban;
    if (typeof j !== "string" || !j.trim()) {
      return { ok: false, reason: "chat wajib params.jawaban string tak kosong.", raw };
    }
    out.params = { jawaban: j.trim().slice(0, 2000) };
    return out;
  }
  if (WRITE_TOOLS_SET.has(tool) && (!out.params || typeof out.params !== "object")) {
    return { ok: false, reason: "Tool tulis wajib params object.", raw };
  }
  return out;
}

// Tool-tool yang tidak memerlukan sintesis setelah dieksekusi (langsung jawab).
// Tool tulis dan chat tidak perlu ReAct loop.
const NO_REACT_TOOLS = new Set(["chat", ...WRITE_TOOLS]);


// Helper: panggil transport AI sesuai platform/mode.
async function callTransport(settings, messages, opts) {
  return isTauriRuntime()
    ? callTauri(settings, messages)
    : settings?.mode === "proxy"
      ? callProxy(settings, messages, opts)
      : callDirect(settings, messages, opts);
}

// Orkestrasi multi-turn ReAct:
// 1. Bangun konteks ringkas + kirim ke LLM (dengan riwayat chat sliding window).
// 2. LLM memilih tool via JSON.
// 3. Jika tool baca → eksekusi di client → kirim hasil ke LLM (SYNTHESIS_PROMPT).
// 4. LLM hasilkan jawaban naratif (tool: "chat").
// chatHistory: array {role:"user"|"assistant", text: string} — 6 pesan terakhir.
// executeTool: fungsi (tool, params, ctx) → {ok, data?, reason?} — injeksi dari UI.
export async function dispatch(userText, ctxInput, settings, opts = {}) {
  const ctx = buildContext(ctxInput);
  const chatHistory = Array.isArray(opts.chatHistory) ? opts.chatHistory.slice(-6) : [];
  const executeTool = typeof opts.executeTool === "function" ? opts.executeTool : null;

  // Bangun pesan awal: system + riwayat + perintah baru
  const historyMsgs = chatHistory.flatMap((m) => {
    // Hanya user dan assistant biasa (bukan pending/tool result)
    if (m.role === "user") return [{ role: "user", content: String(m.text ?? "").slice(0, 500) }];
    if (m.role === "assistant" && m.text && !m.isError && !m.preview) {
      return [{ role: "assistant", content: String(m.text ?? "").slice(0, 500) }];
    }
    return [];
  });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historyMsgs,
    { role: "user", content: JSON.stringify({ perintah: String(userText ?? ""), konteks: ctx }) },
  ];

  // Putaran 1: LLM pilih tool
  const text = await callTransport(settings, messages, opts);
  const parsed = parseToolCall(text);

  // Jika tool tidak bisa/tidak perlu ReAct, langsung return
  if (!parsed.ok || NO_REACT_TOOLS.has(parsed.tool) || !executeTool) {
    return { text, parsed, ctx, reactSteps: [] };
  }

  // Putaran 2 (ReAct): eksekusi tool di client, kirim hasil ke LLM untuk sintesis
  const reactSteps = [];
  try {
    const toolResult = executeTool(parsed.tool, parsed.params ?? {}, ctx);
    reactSteps.push({ tool: parsed.tool, params: parsed.params, result: toolResult });

    if (toolResult.ok && toolResult.data) {
      // Serialisasi hasil tool (max 2000 char untuk hemat token)
      const dataStr = JSON.stringify(toolResult.data).slice(0, 2000);
      const synthMessages = [
        { role: "system", content: SYNTHESIS_PROMPT },
        ...historyMsgs,
        { role: "user", content: JSON.stringify({ perintah: String(userText ?? ""), konteks: ctx }) },
        { role: "assistant", content: text },
        {
          role: "user",
          content: `Hasil tool ${parsed.tool}: ${dataStr}\n\nBerikan analisis naratif berdasarkan data ini.`,
        },
      ];
      const isStreamSynth = typeof opts.onDelta === "function";
      const synthText = await callTransport(settings, synthMessages, {
        ...opts,
        useTools: false,
        stream: isStreamSynth,
        onDelta: opts.onDelta,
      });
      const synthParsed = parseToolCall(synthText);
      // Jika sintesis berhasil hasilkan chat (atau teks naratif), gunakan itu sebagai respons final
      if (synthParsed.ok && synthParsed.tool === "chat") {
        return { text: synthText, parsed: synthParsed, ctx, reactSteps, intermediate: { text, parsed, toolResult } };
      }

      // Jika model mengembalikan teks polos (bukan JSON), bungkus sebagai chat jawaban
      if (!synthParsed.ok && typeof synthText === "string" && synthText.trim() && !synthText.trim().startsWith("{")) {
        return {
          text: synthText,
          parsed: { ok: true, tool: "chat", params: { jawaban: synthText.trim() }, ringkasan: "Sintesis AI" },
          ctx,
          reactSteps,
          intermediate: { text, parsed, toolResult },
        };
      }

    }
  } catch {
    // Sintesis gagal → fallback ke respons asli (tool call biasa)
  }

  return { text, parsed, ctx, reactSteps };
}

