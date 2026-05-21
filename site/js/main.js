/**
 * MuXolotl-Converter Site
 * GitHub API integration, download links, OS detection, UI interactions.
 *
 * Notes:
 * - GitHub unauthenticated API is rate-limited. We cache results in localStorage.
 * - /releases/latest returns the latest non-prerelease, non-draft release.
 */

/* =========================================
 * Constants
 * ========================================= */

const GITHUB_REPO = 'MuXolotl/MuXolotl-Converter';
const CACHE_KEY = `gh_release_cache_${GITHUB_REPO}`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const API_HEADERS = {
  Accept: 'application/vnd.github+json',
};

// Map a logical "download button id" to an asset filename pattern.
const ASSET_PATTERNS = {
  'windows-installer': /\.msi$/i,
  'windows-portable': /portable.*\.exe$/i,
  'windows-ffmpeg': /ffmpeg-windows-x64\.zip$/i,

  'macos-intel': /macos-intel\.dmg$/i,
  'macos-silicon': /apple-silicon\.dmg$/i,
  'macos-intel-ffmpeg': /ffmpeg-macos-intel\.zip$/i,
  'macos-silicon-ffmpeg': /ffmpeg-macos-arm64\.zip$/i,

  'linux-deb': /\.deb$/i,
  'linux-ffmpeg': /ffmpeg-linux-x64\.tar\.gz$/i,
};

/* =========================================
 * GitHub API (Latest Release)
 * ========================================= */

async function fetchLatestRelease() {
  const cached = loadCache();
  if (cached) return cached;

  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

  const res = await fetch(url, { headers: API_HEADERS });
  if (!res.ok) throw new Error(`GitHub API failed: ${res.status} ${res.statusText}`);

  const latestRelease = await res.json();
  const data = {
    version: latestRelease.tag_name || null,
    latestRelease,
  };

  saveCache(data);
  return data;
}

function applyGitHubData(data) {
  // Update version tags
  if (data.version) {
    document.querySelectorAll('.version-tag').forEach((el) => {
      el.textContent = String(data.version).replace(/^v/i, '');
    });
  }

  // Update download links from latest release assets
  const assets = data.latestRelease && Array.isArray(data.latestRelease.assets)
    ? data.latestRelease.assets
    : [];

  document.querySelectorAll('[data-download]').forEach((el) => {
    const key = el.dataset.download;
    const pattern = ASSET_PATTERNS[key];

    if (!pattern) return;

    const asset = assets.find((a) => pattern.test(a.name));
    if (asset && asset.browser_download_url) {
      el.href = asset.browser_download_url;
      el.setAttribute('data-ready', 'true');
    } else {
      // Keep href as-is (often "#"), but mark as unavailable for CSS/hooks.
      el.setAttribute('data-ready', 'false');
    }
  });
}

function loadCache(ignoreExpiry = false) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const { timestamp, data } = parsed;
    if (!ignoreExpiry && Date.now() - Number(timestamp) > CACHE_TTL_MS) return null;

    return data || null;
  } catch {
    return null;
  }
}

function saveCache(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      }),
    );
  } catch {
    // Ignore quota errors
  }
}

/* =========================================
 * OS Detection & Download Tabs
 * ========================================= */

function initOSSelector() {
  const buttons = document.querySelectorAll('.os-btn');
  const panels = document.querySelectorAll('.download-panel');

  if (buttons.length === 0) return;

  function selectOS(os) {
    buttons.forEach((b) => b.classList.remove('active'));
    panels.forEach((p) => p.classList.add('hidden'));

    const activeBtn = document.querySelector(`[data-os="${os}"]`);
    const activePanel = document.getElementById(`download-${os}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePanel) activePanel.classList.remove('hidden');
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => selectOS(btn.dataset.os));
  });

  // Auto-detect OS (simple and stable)
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) selectOS('macos-intel');
  else if (ua.includes('linux')) selectOS('linux');
  else selectOS('windows');
}

/* =========================================
 * Mobile Menu
 * ========================================= */

function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');

  if (!btn || !menu) return;

  btn.addEventListener('click', () => menu.classList.toggle('hidden'));

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => menu.classList.add('hidden'));
  });
}

/* =========================================
 * Smooth Scroll
 * ========================================= */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href) return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* =========================================
 * Scroll Reveal Animations
 * ========================================= */

function initScrollReveal() {
  const sections = document.querySelectorAll('section');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
  );

  sections.forEach((section) => {
    section.classList.add('js-reveal');
    observer.observe(section);
  });
}

/* =========================================
 * Navbar Background on Scroll
 * ========================================= */

function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  function update() {
    navbar.style.borderBottomColor =
      window.scrollY > 20
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(255, 255, 255, 0.04)';
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* =========================================
 * Init
 * ========================================= */

document.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();
  initSmoothScroll();
  initScrollReveal();
  initNavbarScroll();
  initOSSelector();

  try {
    const data = await fetchLatestRelease();
    applyGitHubData(data);
  } catch (err) {
    // If online fetch fails, try stale cache.
    const cached = loadCache(true);
    if (cached) applyGitHubData(cached);
    // Otherwise silently ignore.
    // Site remains usable; only version/download URLs won't be auto-populated.
    console.warn('GitHub API fetch failed:', err);
  }
});