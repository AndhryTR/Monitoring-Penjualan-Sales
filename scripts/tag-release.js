#!/usr/bin/env node

/**
 * scripts/tag-release.js
 * Membuat Git Tag beranotasi otomatis sesuai versi di package.json.
 * Dijalankan dengan: `npm run tag`
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const packageJsonPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
const version = pkg.version || "1.0.0";
const tagName = `v${version}`;

try {
  // Cek apakah tag sudah ada
  let tagExists = false;
  try {
    execSync(`git rev-parse -q --verify "refs/tags/${tagName}"`, {
      cwd: rootDir,
      stdio: "ignore",
    });
    tagExists = true;
  } catch {
    tagExists = false;
  }

  if (tagExists) {
    console.log(`\n⚠️  [tag] Tag '${tagName}' sudah pernah dibuat sebelumnya.`);
    console.log(`   Untuk mengunggah tag yang ada ke remote: git push origin ${tagName}\n`);
    process.exit(0);
  }

  // Buat Git Tag beranotasi
  execSync(`git tag -a "${tagName}" -m "Release ${tagName}"`, {
    cwd: rootDir,
    stdio: "inherit",
  });

  console.log(`\n🏷️  [tag] Sukses! Git Tag '${tagName}' berhasil dibuat.`);
  console.log(`👉 Untuk mempublikasikan tag ke GitHub, jalankan:`);
  console.log(`   git push origin ${tagName}\n`);
} catch (err) {
  console.error(`\n❌ [tag] Gagal membuat tag:`, err.message, "\n");
  process.exit(1);
}
