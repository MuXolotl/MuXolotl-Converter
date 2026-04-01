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

const versionFilePath = path.join(rootDir, 'VERSION');
if (!fileExists(versionFilePath)) {
  console.error(`❌ VERSION file not found at: ${versionFilePath}`);
  process.exit(1);
}

const version = readUtf8(versionFilePath).trim();
if (!/^\d+\.\d+\.\d+(-(b|beta)\d*)?$/.test(version)) {
  console.error(`❌ Invalid version format in VERSION file: "${version}"`);
  console.error('Expected formats:');
  console.error('  - Stable:  X.Y.Z (e.g., 1.0.0)');
  console.error('  - Beta:    X.Y.Z-b or X.Y.Z-b1 (e.g., 1.1.0-b, 1.1.0-b2)');
  process.exit(1);
}

const betaMatch = version.match(/^(\d+\.\d+\.\d+)(-(b|beta)(\d*))?$/);
const baseVersion = betaMatch[1]; // 1.1.0
const isBeta = !!betaMatch[2];
const betaNum = betaMatch[4] || '';

const releaseType = isBeta ? `🧪 Beta${betaNum ? ' ' + betaNum : ''}` : '🚀 Stable';

console.log(`\n📦 Display version: ${version} (${releaseType})`);
console.log(`🔧 Build version: ${baseVersion}\n`);

// package.json
(() => {
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (!fileExists(packageJsonPath)) {
    logWarn(`package.json not found at ${packageJsonPath} — skipping`);
    return;
  }
  const packageJson = JSON.parse(readUtf8(packageJsonPath));
  packageJson.version = version;
  writeJson(packageJsonPath, packageJson);
  logOk(`Updated package.json → ${version}`);
})();

// Cargo.toml
(() => {
  const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  if (!fileExists(cargoTomlPath)) {
    logWarn(`src-tauri/Cargo.toml not found — skipping`);
    return;
  }
  let cargoToml = readUtf8(cargoTomlPath);
  const inPackageRegex = /(\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m;
  let replaced = cargoToml.replace(inPackageRegex, `$1${baseVersion}$3`);

  if (replaced === cargoToml) {
    const fallbackRegex = /^(\s*version\s*=\s*")[^"]+(")\s*$/m;
    const fallback = cargoToml.replace(fallbackRegex, `$1${baseVersion}$2`);
    if (fallback === cargoToml) {
      logWarn('Could not find version field to update in src-tauri/Cargo.toml');
    } else {
      writeUtf8(cargoTomlPath, fallback);
      logOk(`Updated src-tauri/Cargo.toml → ${baseVersion}`);
    }
  } else {
    writeUtf8(cargoTomlPath, replaced);
    logOk(`Updated src-tauri/Cargo.toml → ${baseVersion}`);
  }
})();

// tauri.conf.json
(() => {
  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  if (!fileExists(tauriConfPath)) {
    logWarn(`src-tauri/tauri.conf.json not found — skipping`);
    return;
  }
  const tauriConf = JSON.parse(readUtf8(tauriConfPath));

  let updated = false;

  if (Object.prototype.hasOwnProperty.call(tauriConf, 'version')) {
    if (tauriConf.version !== baseVersion) {
      tauriConf.version = baseVersion;
      updated = true;
    }
  }

  if (tauriConf.package && typeof tauriConf.package === 'object') {
    if (tauriConf.package.version !== baseVersion) {
      tauriConf.package.version = baseVersion;
      updated = true;
    }
  }

  if (!updated) {
    if (!('version' in tauriConf) && !(tauriConf.package && tauriConf.package.version)) {
      logWarn('No version field found in src-tauri/tauri.conf.json — consider adding root-level version');
    } else {
      logWarn('tauri.conf.json version already up to date — no changes');
    }
  } else {
    writeJson(tauriConfPath, tauriConf);
    logOk(`Updated src-tauri/tauri.conf.json → ${baseVersion}`);
  }
})();

// src/config.ts
(() => {
  const configPath = path.join(rootDir, 'src', 'config.ts');
  if (!fileExists(configPath)) {
    logWarn('src/config.ts not found — skipping');
    return;
  }

  const configTs = readUtf8(configPath);
  const configVersionRegex = /(version:\s*')([^']+)(')/;
  const updatedConfig = configTs.replace(configVersionRegex, `$1${version}$3`);

  if (updatedConfig === configTs) {
    logWarn('No version string found in src/config.ts — skipping');
  } else {
    writeUtf8(configPath, updatedConfig);
    logOk(`Updated src/config.ts → ${version}`);
  }
})();

// README.md badge
(() => {
  const readmePath = path.join(rootDir, 'README.md');
  if (!fileExists(readmePath)) {
    logWarn('README.md not found — skipping');
    return;
  }

  const readme = readUtf8(readmePath);
  const badgeVersion = version.replace(/-/g, '--');
  const badgeRegex = /(https:\/\/img\.shields\.io\/badge\/version-)([0-9]+\.[0-9]+\.[0-9]+(?:--?(?:b|beta)[0-9]*)?)(-[a-z0-9._-]+\.svg)/gi;
  const updatedReadme = readme.replace(badgeRegex, `$1${badgeVersion}$3`);

  if (updatedReadme === readme) {
    logWarn('No shields.io version badge found in README.md — skipping badge update');
  } else {
    writeUtf8(readmePath, updatedReadme);
    logOk(`Updated README.md version badge → ${version}`);
  }
})();

console.log(`\n🎉 All files synchronized!`);
console.log(`   Display version: ${version}`);
console.log(`   Build version:   ${baseVersion}`);
console.log(`\n📝 Git tag: v${version}\n`);