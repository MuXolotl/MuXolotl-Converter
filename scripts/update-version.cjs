#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const versionFilePath = path.join(__dirname, '..', 'VERSION');
const version = fs.readFileSync(versionFilePath, 'utf8').trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`❌ Invalid version format in VERSION file: "${version}"`);
  console.error('Expected format: X.Y.Z (e.g., 1.0.0)');
  process.exit(1);
}

console.log(`\n📦 Synchronizing version: ${version}\n`);

// Update package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = version;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Updated package.json');

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${version}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log('✅ Updated src-tauri/Cargo.toml');

// Update tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.package.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log('✅ Updated src-tauri/tauri.conf.json');

// Update README.md badges
const readmePath = path.join(__dirname, '..', 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');

const versionBadgeRegex = new RegExp(
  '\```math
!\```math
Version\```\KATEX_INLINE_OPENhttps:\\/\\/img\\.shields\\.io\\/badge\\/version-[\\d.]+-green\\.svg\KATEX_INLINE_CLOSE\```',
  'g'
);
readme = readme.replace(
  versionBadgeRegex,
  `[![Version](https://img.shields.io/badge/version-${version}-green.svg)]`
);

fs.writeFileSync(readmePath, readme);
console.log('✅ Updated README.md version badge');

console.log(`\n🎉 All files synchronized to version ${version}`);
console.log(`\n📝 Git tag will be created automatically by GitHub Actions: v${version}\n`);