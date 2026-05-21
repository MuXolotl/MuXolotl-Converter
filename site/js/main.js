/**
 * MuXolotl-Converter Site
 * GitHub API integration, download links, OS detection, UI interactions.
 */

// =========================================
// Constants
// =========================================

const GITHUB_REPO = 'MuXolotl/MuXolotl-Converter';
const CACHE_KEY = `gh_stats_${GITHUB_REPO}`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const ASSET_PATTERNS = {
    'windows-installer':    /\.msi$/i,
    'windows-portable':     /portable.*\.exe$/i,
    'windows-ffmpeg':       /windows-x64\.zip$/i,
    'macos-intel':          /macos-intel\.dmg$/i,
    'macos-silicon':        /apple-silicon\.dmg$/i,
    'macos-intel-ffmpeg':   /macos-intel\.zip$/i,
    'macos-silicon-ffmpeg': /macos-arm64\.zip$/i,
    'linux-deb':            /\.deb$/i,
    'linux-ffmpeg':         /linux-x64\.tar\.gz$/i,
};

// =========================================
// GitHub API
// =========================================

async function fetchGitHubData() {
    try {
        const cached = loadCache();
        if (cached) {
            applyGitHubData(cached);
            return;
        }

        const [repoRes, releasesRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${GITHUB_REPO}`),
            fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`),
        ]);

        if (!repoRes.ok || !releasesRes.ok) return;

        const repo = await repoRes.json();
        const releases = await releasesRes.json();

        let totalDownloads = 0;
        if (Array.isArray(releases)) {
            for (const release of releases) {
                for (const asset of release.assets || []) {
                    totalDownloads += asset.download_count;
                }
            }
        }

        const latestRelease = Array.isArray(releases) && releases.length > 0 ? releases[0] : null;

        const data = {
            stars: repo.stargazers_count || 0,
            forks: repo.forks_count || 0,
            downloads: totalDownloads,
            version: latestRelease ? latestRelease.tag_name : null,
            latestRelease,
        };

        saveCache(data);
        applyGitHubData(data);
    } catch (err) {
        console.warn('GitHub API fetch failed:', err);
        const cached = loadCache(true);
        if (cached) applyGitHubData(cached);
    }
}

function applyGitHubData(data) {
    // Update version tags
    if (data.version) {
        document.querySelectorAll('.version-tag').forEach(el => {
            el.textContent = data.version.replace(/^v/, '');
        });
    }

    // Update download links from latest release assets
    if (data.latestRelease && data.latestRelease.assets) {
        document.querySelectorAll('[data-download]').forEach(btn => {
            const key = btn.dataset.download;
            const pattern = ASSET_PATTERNS[key];
            if (!pattern) return;

            const asset = data.latestRelease.assets.find(a => pattern.test(a.name));
            if (asset) btn.href = asset.browser_download_url;
        });
    }
}

function loadCache(ignoreExpiry) {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { timestamp, data } = JSON.parse(raw);
        if (!ignoreExpiry && Date.now() - timestamp > CACHE_TTL_MS) return null;
        return data;
    } catch {
        return null;
    }
}

function saveCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data,
        }));
    } catch { /* quota exceeded, ignore */ }
}

// =========================================
// OS Detection & Download Tabs
// =========================================

function initOSSelector() {
    const buttons = document.querySelectorAll('.os-btn');
    const panels = document.querySelectorAll('.download-panel');

    if (buttons.length === 0) return;

    function selectOS(os) {
        buttons.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.add('hidden'));

        const activeBtn = document.querySelector(`[data-os="${os}"]`);
        const activePanel = document.getElementById(`download-${os}`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activePanel) activePanel.classList.remove('hidden');
    }

    buttons.forEach(btn => {
        btn.addEventListener('click', () => selectOS(btn.dataset.os));
    });

    // Auto-detect OS
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) selectOS('macos-intel');
    else if (ua.includes('linux')) selectOS('linux');
    else selectOS('windows');
}

// =========================================
// Mobile Menu
// =========================================

function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobileMenu');

    if (!btn || !menu) return;

    btn.addEventListener('click', () => menu.classList.toggle('hidden'));

    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => menu.classList.add('hidden'));
    });
}

// =========================================
// Smooth Scroll
// =========================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// =========================================
// Scroll Reveal Animations
// =========================================

function initScrollReveal() {
    const sections = document.querySelectorAll('section');
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('js-reveal', 'visible');
                }
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    sections.forEach(section => {
        section.classList.add('js-reveal');
        observer.observe(section);
    });
}

// =========================================
// Navbar Background on Scroll
// =========================================

function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    function update() {
        if (window.scrollY > 20) {
            navbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.08)';
        } else {
            navbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.04)';
        }
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
}

// =========================================
// Init
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initSmoothScroll();
    initScrollReveal();
    initNavbarScroll();
    initOSSelector();
    fetchGitHubData();
});
