#!/usr/bin/env node

/**
 * scripts/generate-changelog.js
 * Generator otomatis Catatan Pembaruan (Changelog) dari riwayat Git commit.
 * Dijalankan otomatis sebelum build (`npm run build`) atau secara manual (`npm run changelog`).
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const packageJsonPath = path.join(rootDir, "package.json");
const changelogPath = path.join(rootDir, "src", "data", "changelog.json");

// Baca versi & info package.json
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const currentVersion = pkg.version || "1.0.0";
const today = new Date().toISOString().split("T")[0];

// Format nama scope agar ramah pengguna
const SCOPE_LABELS = {
  ai: "AI",
  report: "Laporan",
  alerts: "Smart Alerts",
  alert: "Smart Alerts",
  map: "Peta & Lokasi",
  outlet: "Outlet",
  sales: "Sales & Target",
  pwa: "PWA & Offline",
  export: "Ekspor Data",
  ui: "Tampilan",
  auth: "Autentikasi",
  sync: "Sinkronisasi",
  tauri: "Desktop (Tauri)",
};

function inferScopeFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(alerts?|peringatan|anomali)\b/.test(lower)) return "Smart Alerts";
  if (/\b(ai|chat|react|thinking)\b/.test(lower)) return "AI";
  if (/\b(laporan|report)\b/.test(lower)) return "Laporan";
  if (/\b(map|peta|koordinat|toko)\b/.test(lower)) return "Peta & Lokasi";
  if (/\b(pwa|offline|sw|service worker)\b/.test(lower)) return "PWA & Offline";
  if (/\b(target|sales)\b/.test(lower)) return "Sales & Target";
  if (/\b(export|excel|pdf)\b/.test(lower)) return "Ekspor Data";
  if (/\b(tauri|rust)\b/.test(lower)) return "Desktop (Tauri)";
  return null;
}

function formatScope(rawScope, messageText) {
  if (rawScope) {
    const key = rawScope.toLowerCase().trim();
    return SCOPE_LABELS[key] || (rawScope.charAt(0).toUpperCase() + rawScope.slice(1));
  }
  return inferScopeFromText(messageText);
}

function capitalizeFirst(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Cari Git Tag rilis sebelumnya (misal v4.1.0) untuk isolasi commit rentang vPrevious..HEAD
function getPreviousGitTag(currentVer) {
  try {
    const rawTags = execSync("git tag --sort=-creatordate", {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    if (!rawTags || !rawTags.trim()) return null;

    const tags = rawTags
      .trim()
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    const cleanCurrent = currentVer.replace(/^v/, "");

    // Cari tag rilis yang bukan rilis aktif saat ini
    const prevTag = tags.find((t) => {
      const cleanTag = t.replace(/^v/, "");
      return cleanTag !== cleanCurrent;
    });

    return prevTag || null;
  } catch {
    return null;
  }
}

// Ambil riwayat commit dari Git (mendukung rentang tag: previousTag..HEAD)
function getGitCommits(previousTag = null) {
  try {
    let logCmd = 'git log -n 50 --pretty=format:"%h|%ad|%s" --date=short';
    if (previousTag) {
      logCmd = `git log ${previousTag}..HEAD --pretty=format:"%h|%ad|%s" --date=short`;
      console.log(`📌 [changelog] Menggunakan rentang Git Tag: ${previousTag}..HEAD`);
    }

    const rawLog = execSync(logCmd, {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    if (!rawLog || !rawLog.trim()) return [];

    return rawLog
      .trim()
      .split("\n")
      .map((line) => {
        const [hash, date, ...subjectParts] = line.split("|");
        const subject = subjectParts.join("|").trim();
        return { hash, date, subject };
      });
  } catch (err) {
    console.warn("⚠️ [changelog] Gagal membaca git log:", err.message);
    return [];
  }
}

// Parse pesan commit berdasarkan Conventional Commits
function parseCommits(commits, olderHashes = new Set(), olderTitles = new Set()) {
  const features = [];
  const fixes = [];
  const improvements = [];
  const seenMessages = new Set();

  // Pola: type(scope): message ATAU type: message
  const commitRegex = /^(feat|fix|perf|refactor|style|docs|chore|test)(?:\(([^)]+)\))?:\s*(.+)$/i;

  for (const item of commits) {
    const { hash, subject } = item;
    if (!subject) continue;

    // Kritis: Abaikan commit yang sudah pernah tercatat di versi sebelumnya
    if (hash && olderHashes.has(hash.toLowerCase().trim())) {
      continue;
    }

    // Abaikan commit merge otomatis atau commit rilis
    if (/^merge\b/i.test(subject) || /^\d+\.\d+\.\d+$/i.test(subject)) continue;

    const match = subject.match(commitRegex);
    if (!match) {
      // Jika bukan conventional commit tapi mengandung kata penting
      continue;
    }

    const [, rawType, rawScope, rawMessage] = match;
    const type = rawType.toLowerCase();

    // Saring commit internal
    if (["chore", "test", "ci", "docs"].includes(type)) continue;

    const scope = formatScope(rawScope, rawMessage);
    const message = capitalizeFirst(rawMessage.trim());

    // Kritis: Abaikan jika pesan perubahan sudah ada di versi lama
    if (olderTitles.has(message.toLowerCase().trim())) {
      continue;
    }

    // Deduplikasi pesan identik di rilis ini
    const dedupeKey = `${type}:${scope}:${message.toLowerCase()}`;
    if (seenMessages.has(dedupeKey)) continue;
    seenMessages.add(dedupeKey);

    const entry = {
      hash,
      scope: scope || null,
      title: message,
    };

    if (type === "feat") {
      features.push(entry);
    } else if (type === "fix") {
      fixes.push(entry);
    } else if (type === "perf" || type === "refactor" || type === "style") {
      improvements.push(entry);
    }
  }

  return { features, fixes, improvements };
}

function main() {
  console.log(`\n🚀 [changelog] Memproses catatan pembaruan untuk v${currentVersion}...`);

  // Pastikan direktori src/data/ ada
  const dataDir = path.dirname(changelogPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let existingChangelog = [];
  if (fs.existsSync(changelogPath)) {
    try {
      existingChangelog = JSON.parse(fs.readFileSync(changelogPath, "utf-8"));
      if (!Array.isArray(existingChangelog)) existingChangelog = [];
    } catch {
      existingChangelog = [];
    }
  }

  // Pisahkan rilis versi lama (versi yang tidak sama dengan currentVersion)
  const filteredOlder = existingChangelog.filter((rel) => rel.version !== currentVersion);

  // Kumpulkan semua commit hash & judul dari versi-versi lama
  const olderHashes = new Set();
  const olderTitles = new Set();
  for (const rel of filteredOlder) {
    const allOlderItems = [
      ...(rel.features || []),
      ...(rel.fixes || []),
      ...(rel.improvements || []),
    ];
    for (const item of allOlderItems) {
      if (item.hash) olderHashes.add(item.hash.toLowerCase().trim());
      if (item.title) olderTitles.add(item.title.toLowerCase().trim());
    }
  }

  const previousTag = getPreviousGitTag(currentVersion);
  const rawCommits = getGitCommits(previousTag);
  const parsed = parseCommits(rawCommits, olderHashes, olderTitles);

  const existingCurrent = existingChangelog.find((rel) => rel.version === currentVersion);

  // Fungsi penggabung agar entri kustom/manual yang sudah ditulis user tidak terhapus
  function mergeItems(existing = [], parsed = []) {
    const list = [...existing];
    const seenTitles = new Set(existing.map((item) => (item.title || "").toLowerCase().trim()));
    const seenHashes = new Set(existing.map((item) => (item.hash || "").toLowerCase().trim()).filter(Boolean));

    for (const item of parsed) {
      const t = (item.title || "").toLowerCase().trim();
      const h = (item.hash || "").toLowerCase().trim();
      if ((t && seenTitles.has(t)) || (h && seenHashes.has(h))) {
        continue;
      }
      list.push(item);
      if (t) seenTitles.add(t);
      if (h) seenHashes.add(h);
    }
    return list;
  }

  const finalFeatures = mergeItems(existingCurrent?.features || [], parsed.features);
  const finalFixes = mergeItems(existingCurrent?.fixes || [], parsed.fixes);
  const finalImprovements = mergeItems(existingCurrent?.improvements || [], parsed.improvements);

  const currentRelease = {
    version: currentVersion,
    date: existingCurrent?.date || today,
    title: existingCurrent?.title || `Pembaruan Versi ${currentVersion}`,
    features: finalFeatures,
    fixes: finalFixes,
    improvements: finalImprovements,
  };

  // Simpan rilis saat ini di posisi paling atas, pertahankan riwayat versi lama
  const updatedChangelog = [currentRelease, ...filteredOlder];

  fs.writeFileSync(changelogPath, JSON.stringify(updatedChangelog, null, 2) + "\n", "utf-8");

  console.log(`✅ [changelog] Berhasil memperbarui ${path.relative(rootDir, changelogPath)}`);
  console.log(`   - 🚀 Fitur Baru (v${currentVersion}): ${parsed.features.length}`);
  console.log(`   - 🐛 Perbaikan (v${currentVersion}): ${parsed.fixes.length}`);
  console.log(`   - ⚡ Peningkatan (v${currentVersion}): ${parsed.improvements.length}`);
  console.log(`   - 📦 Riwayat Versi Lama Terpelihara: ${filteredOlder.length} versi\n`);
}

main();
