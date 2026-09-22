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
  if (/\b(ai|chat|react|thinking)\b/.test(lower)) return "AI";
  if (/\b(laporan|report|peringatan)\b/.test(lower)) return "Laporan";
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

// Ambil riwayat commit dari Git
function getGitCommits() {
  try {
    const rawLog = execSync('git log -n 50 --pretty=format:"%h|%ad|%s" --date=short', {
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
    console.warn("⚠️ [changelog] Tidak dapat membaca git log (mungkin shallow clone atau non-git environment):", err.message);
    return [];
  }
}

// Parse pesan commit berdasarkan Conventional Commits
function parseCommits(commits) {
  const features = [];
  const fixes = [];
  const improvements = [];
  const seenMessages = new Set();

  // Pola: type(scope): message ATAU type: message
  const commitRegex = /^(feat|fix|perf|refactor|style|docs|chore|test)(?:\(([^)]+)\))?:\s*(.+)$/i;

  for (const item of commits) {
    const { hash, subject } = item;
    if (!subject) continue;

    // Abaikan commit merge otomatis atau internal developer
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

    // Deduplikasi pesan identik
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

  const rawCommits = getGitCommits();
  const parsed = parseCommits(rawCommits);

  const currentRelease = {
    version: currentVersion,
    date: today,
    title: `Pembaruan Versi ${currentVersion}`,
    features: parsed.features,
    fixes: parsed.fixes,
    improvements: parsed.improvements,
  };

  // Simpan rilis saat ini di posisi paling atas, pertahankan riwayat versi lama yang berbeda
  const filteredOlder = existingChangelog.filter((rel) => rel.version !== currentVersion);
  const updatedChangelog = [currentRelease, ...filteredOlder];

  fs.writeFileSync(changelogPath, JSON.stringify(updatedChangelog, null, 2) + "\n", "utf-8");

  console.log(`✅ [changelog] Berhasil memperbarui ${path.relative(rootDir, changelogPath)}`);
  console.log(`   - 🚀 Fitur Baru: ${parsed.features.length}`);
  console.log(`   - 🐛 Perbaikan: ${parsed.fixes.length}`);
  console.log(`   - ⚡ Peningkatan: ${parsed.improvements.length}\n`);
}

main();
