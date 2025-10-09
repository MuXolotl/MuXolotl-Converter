#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : content + '\n');
}

function writeJson(filePath, obj) {
  writeUtf8(filePath, JSON.stringify(obj, null, 2));
}

function fileExists(p) {
  return fs.existsSync(p) && fs.statSync(p).isFile();
}

function logOk(msg) {
  console.log(`✅ ${msg}`);
}

function logWarn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function logStep(title) {
  console.log(`\n${title}`);
}

const versionFilePath = path.join(rootDir, 'VERSION');
if (!fileExists(versionFilePath)) {
  console.error(`❌ VERSION file not found at: ${versionFilePath}`);
  process.exit(1);
}

const version = readUtf8(versionFilePath).trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`❌ Invalid version format in VERSION file: "${version}"`);
  console.error('Expected format: X.Y.Z (e.g., 1.0.0)');
  process.exit(1);
}

console.log(`\n📦 Synchronizing version: ${version}\n`);

(() => {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fileExists(packageJsonPath)) {
    logWarn(`package.json not found at ${packageJsonPath} — skipping`);
    return;
  }
  const packageJson = JSON.parse(readUtf8(packageJsonPath));
  packageJson.version = version;
  writeJson(packageJsonPath, packageJson);
  logOk('Updated package.json');
})();

(() => {
  const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  if (!fileExists(cargoTomlPath)) {
    logWarn(`src-tauri/Cargo.toml not found — skipping`);
    return;
  }
  let cargoToml = readUtf8(cargoTomlPath);
  const replaced = cargoToml.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
    `$1${version}$3`
  );

  if (replaced === cargoToml) {
    const fallback = cargoToml.replace(/(?m)^(version\s*=\s*").*(")\s*$/, `$1${version}$2`);
    if (fallback === cargoToml) {
      logWarn('Could not find version field to update in src-tauri/Cargo.toml');
    } else {
      writeUtf8(cargoTomlPath, fallback);
      logOk('Updated src-tauri/Cargo.toml (fallback)');
    }
  } else {
    writeUtf8(cargoTomlPath, replaced);
    logOk('Updated src-tauri/Cargo.toml');
  }
})();

(() => {
  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  if (!fileExists(tauriConfPath)) {
    logWarn(`src-tauri/tauri.conf.json not found — skipping`);
    return;
  }
  const tauriConf = JSON.parse(readUtf8(tauriConfPath));

  let updated = false;
  if (tauriConf.package && typeof tauriConf.package === 'object') {
    if (tauriConf.package.version !== version) {
      tauriConf.package.version = version;
      updated = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(tauriConf, 'version')) {
    if (tauriConf.version !== version) {
      tauriConf.version = version;
      updated = true;
    }
  }

  if (!updated) {
    if (!(tauriConf.package && tauriConf.package.version) && !('version' in tauriConf)) {
      logWarn('No version field found in src-tauri/tauri.conf.json — consider adding package.version');
    } else {
      logWarn('tauri.conf.json version already up to date — no changes');
    }
  } else {
    writeJson(tauriConfPath, tauriConf);
    logOk('Updated src-tauri/tauri.conf.json');
  }
})();

(() => {
  const readmePath = path.join(rootDir, 'README.md');
  if (!fileExists(readmePath)) {
    logWarn('README.md not found — skipping');
    return;
  }

  let readme = readUtf8(readmePath);
  const badgeRegex = /(https:\/\/img\.shields\.io\/badge\/version-)(\d+\.\d+\.\d+)(-[a-z0-9._-]+\.svg)/gi;

  if (!badgeRegex.test(readme)) {
    logWarn('No shields.io version badge found in README.md — skipping badge update');
  } else {
    readme = readme.replace(badgeRegex, `$1${version}$3`);
    writeUtf8(readmePath, readme);
    logOk('Updated README.md version badge');
  }
})();

console.log(`\n🎉 All files synchronized to version ${version}`);
console.log(`\n📝 Git tag will be created automatically by GitHub Actions: v${version}\n`);