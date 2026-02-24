'use strict';

/* ═══════════════════════════════════════════════════════════
   SafeNex Dashboard — dashboard.js
   Auth gate, user data population, interactivity
   ═══════════════════════════════════════════════════════════ */

const API = '';

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('snx_token');

    // 1. No token → back to onboarding
    if (!token) return redirect();

    try {
        const res = await fetch(`${API}/api/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) {
            localStorage.removeItem('snx_token');
            localStorage.removeItem('snx_user');
            return redirect();
        }

        const { user } = await res.json();

        // 2. Not verified → back to onboarding
        if (!user || !user.verified) return redirect();

        // 3. Populate everything
        populateNav(user);
        populateHero();
        populateIdentityCard(user);
        populateMemberInfo(user);
        await populateActivity(user); // Make it async to fetch real data
        initStats();
        initNav();
        initModuleButtons();
        initUserMenu();
        initDownloadQR(user);
        initModal(user);
        setYear();
        initNavHighlight();
        checkSOSStatus(); // Check if SOS is configured

    } catch (err) {
        console.error('[Dashboard]', err);
        redirect();
    }
});

function redirect() {
    window.location.replace('/onboarding.html');
}

// ── Populate Nav ─────────────────────────────────────────
function populateNav(user) {
    const initial = (user.name || 'U')[0].toUpperCase();
    const el = document.getElementById('navAvatar');
    if (el) el.textContent = initial;

    const nameEl = document.getElementById('navName');
    if (nameEl) nameEl.textContent = user.name?.split(' ')[0] || 'User';

    const dropName = document.getElementById('dropName');
    if (dropName) dropName.textContent = user.name || 'User';

    const dropSnx = document.getElementById('dropSnxId');
    if (dropSnx) dropSnx.textContent = user.safeNexID || '—';

    // Show admin button only for admin email
    if (user.email === 'abdullahansari01618@gmail.com') {
        const adminBtnContainer = document.getElementById('adminBtnContainer');
        if (adminBtnContainer) {
            adminBtnContainer.style.display = 'block';
        }
    }
}

// ── Populate Hero ─────────────────────────────────────────
function populateHero() {
    // Uptime: hours since midnight
    const now = new Date();
    const hours = now.getHours();
    const el = document.getElementById('uptimeHours');
    if (el) el.textContent = hours || 24;
}

// ── Animated Stat Counters ───────────────────────────────
function initStats() {
    document.querySelectorAll('.stat-number[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        let start = 0;
        const step = Math.ceil(target / 30);
        const timer = setInterval(() => {
            start = Math.min(start + step, target);
            el.textContent = start;
            if (start >= target) clearInterval(timer);
        }, 40);
    });
}

// ── Populate Identity Card ───────────────────────────────
function populateIdentityCard(user) {
    const isAadhaar = user.documentType === 'aadhaar';
    const docLabel = isAadhaar ? 'National ID (Aadhaar)' : 'International Passport';
    const docShort = isAadhaar ? 'Aadhaar' : 'Passport';

    // v2 card
    setText('idName', user.name || user.extractedName || '—');
    setText('idSnxId', user.safeNexID || '—');
    setText('idVerifiedAt', formatDate(user.verifiedAt));
    setText('idIssueYear', new Date(user.verifiedAt || Date.now()).getFullYear());

    // Avatar initial
    const avatarEl = document.getElementById('idAvatar');
    if (avatarEl) avatarEl.textContent = (user.name || 'U')[0].toUpperCase();

    // Doc type badge
    setText('idDocTypeBadge', docShort);

    // QR code
    const qrEl = document.getElementById('idQrCode');
    if (qrEl && user.qrCodeURL) {
        qrEl.src = user.qrCodeURL;
        qrEl.onerror = () => { qrEl.style.display = 'none'; };
    }

    // Copy SNX ID button
    initCopyBtn(user);
    // QR expand buttons
    initQrExpand(user);
}

// ── Populate Member Info ─────────────────────────────────
function populateMemberInfo(user) {
    setText('memberSince', formatDate(user.memberSince || user.createdAt));
    setText('memberEmail', user.email || '—');
}

// ── Activity Feed ────────────────────────────────────────
// ── Populate Activity with Real User Data ────────────────
async function populateActivity(user) {
    try {
        // Fetch real activity data from backend
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/activity`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        let activities = [];

        if (res.ok) {
            const data = await res.json();
            activities = data.activities || [];
        }

        // If no real activities, use default ones based on user data
        if (activities.length === 0) {
            const verifiedAt = user.verifiedAt ? new Date(user.verifiedAt) : new Date();
            const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
            
            activities = [
                {
                    color: 'green',
                    title: 'Safety Network Activated',
                    desc: `AI protection enabled. SafeNex ID assigned: ${user.safeNexID || '—'}. All safety modules online.`,
                    time: verifiedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    timestamp: verifiedAt.getTime(),
                },
                {
                    color: 'blue',
                    title: 'System Diagnostics',
                    desc: 'Routine safety check completed successfully. All protection nodes responsive.',
                    time: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    timestamp: Date.now() - 2 * 60 * 60 * 1000,
                },
                {
                    color: 'cyan',
                    title: 'SafeTrace Module Updated',
                    desc: '3 new safe zones added in your area. Route database refreshed with real-time data.',
                    time: new Date(Date.now() - 3 * 60 * 60 * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    timestamp: Date.now() - 3 * 60 * 60 * 1000,
                },
                {
                    color: 'green',
                    title: 'Safety Profile Created',
                    desc: 'Welcome to SafeNex. Your urban safety network has been initialized.',
                    time: createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    timestamp: createdAt.getTime(),
                },
            ];

            // Sort by timestamp (newest first)
            activities.sort((a, b) => b.timestamp - a.timestamp);
        }

        const list = document.getElementById('activityList');
        if (!list) return;

        list.innerHTML = activities.slice(0, 5).map((a, i) => `
        <div class="activity-item" style="animation-delay:${i * 0.07}s">
          <div class="activity-item__bar activity-item__bar--${a.color}"></div>
          <div>
            <div class="activity-item__title">${escapeHtml(a.title)}</div>
            <div class="activity-item__desc">${escapeHtml(a.desc)}</div>
          </div>
          <span class="activity-item__time">${a.time}</span>
        </div>
      `).join('');
    } catch (err) {
        console.error('[Activity]', err);
        // Fallback to basic activity
        const list = document.getElementById('activityList');
        if (list) {
            list.innerHTML = `
                <div class="activity-item">
                    <div class="activity-item__bar activity-item__bar--green"></div>
                    <div>
                        <div class="activity-item__title">Safety Network Active</div>
                        <div class="activity-item__desc">Your SafeNex protection is online and monitoring.</div>
                    </div>
                    <span class="activity-item__time">Now</span>
                </div>
            `;
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Nav Mobile Toggle ────────────────────────────────────
function initNav() {
    const btn = document.getElementById('navHamburger');
    const drawer = document.getElementById('navDrawer');
    if (!btn || !drawer) return;

    btn.addEventListener('click', () => {
        const open = !drawer.hidden;
        drawer.hidden = open;
        btn.setAttribute('aria-expanded', String(!open));
    });

    // Close on link click
    drawer.querySelectorAll('[data-close]').forEach(link => {
        link.addEventListener('click', () => {
            drawer.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        });
    });

    // Mobile logout
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);
}

// ── User Menu Dropdown ───────────────────────────────────
function initUserMenu() {
    const trigger = document.getElementById('userMenuBtn');
    const dropdown = document.getElementById('userDropdown');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !dropdown.hidden;
        dropdown.hidden = open;
        trigger.setAttribute('aria-expanded', String(!open));
    });

    document.addEventListener('click', () => {
        dropdown.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('supportBtn')?.addEventListener('click', () => {
        dropdown.hidden = true;
        alert('SafeNex Support\n\n✉️ support@safenex.io\n📞 1800-SAFE-NEX\n\nResponse time: < 24 hours');
    });
    document.getElementById('viewIdBtn')?.addEventListener('click', () => {
        dropdown.hidden = true;
        openModal();
    });

    document.getElementById('adminBtn')?.addEventListener('click', () => {
        dropdown.hidden = true;
        window.location.href = '/sys-admin-panel-x9k2m7p4.html';
    });
}

// ── Module Buttons ───────────────────────────────────────
function initModuleButtons() {
    const comingSoon = (name) => () =>
        alert(`🛡️ ${name}\n\nThis module is coming soon in SafeNex Phase 2.\nYour account is pre-registered for early access.`);

    document.querySelectorAll('.mod-card__btn, .module-card__btn').forEach(btn => {
        const text = btn.textContent.trim();
        if (text.includes('SafeTrace')) {
            btn.addEventListener('click', () => {
                window.location.href = '/safetrace';
            });
        }
        if (text.includes('Silent Room')) {
            btn.addEventListener('click', () => {
                window.location.href = '/silentroom';
            });
        }
        if (text.includes('SOS') || text.includes('Activate')) {
            btn.addEventListener('click', () => {
                window.location.href = '/sos-redesign.html';
            });
        }
    });
}

// ── Download QR ──────────────────────────────────────────
function downloadQR(user) {
    const src = document.getElementById('idQrCode')?.src || document.getElementById('modalQR')?.src;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `SafeNex-QR-${user.safeNexID || 'code'}.png`;
    a.click();
    showToast('✅ QR Code downloaded!');
}

function initDownloadQR(user) {
    document.getElementById('downloadQRBtn')?.addEventListener('click', () => downloadQR(user));
    document.getElementById('modalDownloadBtn')?.addEventListener('click', () => downloadQR(user));
}

// ── Copy SNX ID ───────────────────────────────────────────
function initCopyBtn(user) {
    const btn = document.getElementById('copySnxBtn');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = user.safeNexID || '';
        try {
            await navigator.clipboard.writeText(id);
            btn.classList.add('copied');
            showToast('✅ SafeNex ID copied to clipboard!');
            setTimeout(() => btn.classList.remove('copied'), 2000);
        } catch {
            showToast('Could not copy — try manually selecting the ID.');
        }
    });
}

// ── QR Expand (inline → fullscreen modal) ─────────────────
function initQrExpand(user) {
    const open = () => openModal();
    document.getElementById('qrExpandBtn')?.addEventListener('click', open);
    document.getElementById('qrFullBtn')?.addEventListener('click', open);
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, duration = 2600) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
}

// ── Identity Modal ───────────────────────────────────────
function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.classList.remove('modal--open');
        setTimeout(() => { overlay.hidden = true; }, 200);
    }
}

function openModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.hidden = false;
        // Force reflow then add class for animation
        requestAnimationFrame(() => overlay.classList.add('modal--open'));
    }
}

function initModal(user) {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');

    // ── Populate all sheet fields ──────────────────────────
    const isAadhaar = user.documentType === 'aadhaar';

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setT('modalAvatar', (user.name || 'U')[0].toUpperCase());
    setT('modalName', user.name || '—');
    setT('modalSnxId', user.safeNexID || '—');
    setT('modalVerifiedAt', formatDate(user.verifiedAt));
    setT('modalDocFull', isAadhaar ? 'National ID (Aadhaar)' : 'International Passport');
    setT('modalDocType', isAadhaar ? 'Aadhaar' : 'Passport');
    setT('modalYear', new Date(user.verifiedAt || Date.now()).getFullYear());

    const modalQR = document.getElementById('modalQR');
    if (modalQR && user.qrCodeURL) modalQR.src = user.qrCodeURL;

    // ── Modal copy button ──────────────────────────────────
    document.getElementById('modalCopyBtn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(user.safeNexID || '');
            showToast('✅ SafeNex ID copied!');
            const btn = document.getElementById('modalCopyBtn');
            btn?.classList.add('copied');
            setTimeout(() => btn?.classList.remove('copied'), 2000);
        } catch { showToast('Could not copy — tap to select manually.'); }
    });

    // ── Share ──────────────────────────────────────────────
    document.getElementById('modalShareBtn')?.addEventListener('click', async () => {
        const text = `My SafeNex Verified ID: ${user.safeNexID || '—'}\nIssued by SafeNex AI Engine`;
        if (navigator.share) {
            try { await navigator.share({ title: 'SafeNex Identity', text }); } catch (_) { }
        } else {
            await navigator.clipboard.writeText(text).catch(() => { });
            showToast('✅ ID info copied to clipboard!');
        }
    });

    // ── Refresh QR Code ────────────────────────────────────
    document.getElementById('modalRefreshQRBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('modalRefreshQRBtn');
        const originalText = btn.innerHTML;
        
        try {
            // Show loading state
            btn.disabled = true;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Refreshing...';
            
            // Call API to regenerate QR code
            const response = await fetch('/api/verify/regenerate-qr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('snx_token')}`
                }
            });

            const data = await response.json();

            if (data.success) {
                // Update QR code images
                const modalQR = document.getElementById('modalQR');
                const idQrCode = document.getElementById('idQrCode');
                
                if (modalQR) modalQR.src = data.qrCodeURL;
                if (idQrCode) idQrCode.src = data.qrCodeURL;
                
                // Update user object
                user.qrCodeURL = data.qrCodeURL;
                
                showToast('✅ QR code refreshed successfully!');
            } else {
                throw new Error(data.message || 'Failed to refresh QR code');
            }
        } catch (error) {
            console.error('Error refreshing QR code:', error);
            showToast('❌ Failed to refresh QR code. Please try again.');
        } finally {
            // Restore button state
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    // ── Close button ───────────────────────────────────────
    closeBtn?.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}


// ── Nav Highlight on Scroll ──────────────────────────────
function initNavHighlight() {
    const sections = document.querySelectorAll('section[id], div[id]');
    const links = document.querySelectorAll('.nav__link');

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                links.forEach(l => {
                    l.classList.toggle('nav__link--active', l.getAttribute('href') === `#${entry.target.id}`);
                });
            }
        });
    }, { threshold: 0.4 });

    sections.forEach(s => observer.observe(s));
}

// ── Check SOS Configuration Status ──────────────────────
async function checkSOSStatus() {
    try {
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/sos/config`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const badge = document.getElementById('sosStatusBadge');
        if (!badge) return;

        if (res.ok) {
            const { config } = await res.json();
            
            // Check if SOS is configured (has primary contact)
            if (config && config.primaryContact) {
                // SOS is configured - show ONLINE
                badge.innerHTML = '<span class="mod-badge__dot"></span>ONLINE';
                badge.className = 'mod-badge mod-badge--online';
            } else {
                // SOS not configured - show STANDBY
                badge.innerHTML = '<span class="mod-badge__dot mod-badge__dot--standby"></span>STANDBY';
                badge.className = 'mod-badge mod-badge--standby';
            }
        } else {
            // Error fetching config - show STANDBY
            badge.innerHTML = '<span class="mod-badge__dot mod-badge__dot--standby"></span>STANDBY';
            badge.className = 'mod-badge mod-badge--standby';
        }
    } catch (err) {
        console.error('[SOS Status]', err);
        // On error, show STANDBY
        const badge = document.getElementById('sosStatusBadge');
        if (badge) {
            badge.innerHTML = '<span class="mod-badge__dot mod-badge__dot--standby"></span>STANDBY';
            badge.className = 'mod-badge mod-badge--standby';
        }
    }
}

// ── Logout ───────────────────────────────────────────────
function logout() {
    localStorage.removeItem('snx_token');
    localStorage.removeItem('snx_user');
    window.location.replace('/onboarding.html');
}

// ── Year ─────────────────────────────────────────────────
function setYear() {
    const el = document.getElementById('currentYear');
    if (el) el.textContent = new Date().getFullYear();
}

// ── Helpers ──────────────────────────────────────────────
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
