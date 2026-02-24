/**
 * SafeNex Onboarding – Phase 1
 * onboarding.js — Complete API integration, step navigation, UI logic
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════ */
const STATE = {
    token: localStorage.getItem('snx_token') || null,
    user: JSON.parse(localStorage.getItem('snx_user') || 'null'),
    selectedDocType: 'aadhaar',
    selectedFile: null,
    currentStep: 1,
    verificationData: null,
};

const API = '';  // Same origin — empty base URL

/* ═══════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════ */

function $(id) { return document.getElementById(id); }

function showAlert(id, msg, type = 'error') {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `form-alert form-alert--${type}`;
    el.hidden = false;
}

function hideAlert(id) {
    const el = $(id);
    if (el) el.hidden = true;
}

function setButtonLoading(btn, loading) {
    const text = btn.querySelector('.btn__text');
    const spinner = btn.querySelector('.btn__spinner');
    if (loading) {
        btn.disabled = true;
        text.hidden = true;
        spinner.hidden = false;
    } else {
        btn.disabled = false;
        text.hidden = false;
        spinner.hidden = true;
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function maskDocNumber(num) {
    if (!num) return '—';
    const str = String(num).replace(/\s/g, '');
    if (str.length <= 4) return str;
    return '•••• •••• ' + str.slice(-4);
}

/* ═══════════════════════════════════════════════════════════
   STEP NAVIGATION
   ═══════════════════════════════════════════════════════════ */

const STEP_IDS = ['step-1', 'step-2', 'step-3', 'step-4', 'step-processing', 'step-error'];
const PROGRESS_MAP = { 1: 25, 2: 50, 3: 75, 4: 100 };

function showStep(stepIdOrNum) {
    const stepId = typeof stepIdOrNum === 'number' ? `step-${stepIdOrNum}` : stepIdOrNum;

    STEP_IDS.forEach((id) => {
        const el = $(id);
        if (!el) return;
        if (id === stepId) {
            el.hidden = false;
            el.classList.add('active');
        } else {
            el.hidden = true;
            el.classList.remove('active');
        }
    });

    // Update progress bar (only for numbered steps)
    if (typeof stepIdOrNum === 'number') {
        STATE.currentStep = stepIdOrNum;
        const fill = $('progressFill');
        if (fill) fill.style.width = `${PROGRESS_MAP[stepIdOrNum] || 25}%`;

        // Update step labels
        for (let i = 1; i <= 4; i++) {
            const lbl = $(`label-${i}`);
            if (!lbl) continue;
            lbl.classList.remove('active', 'completed');
            if (i < stepIdOrNum) lbl.classList.add('completed');
            else if (i === stepIdOrNum) lbl.classList.add('active');
        }
    }
}

/* ═══════════════════════════════════════════════════════════
   API CALLS
   ═══════════════════════════════════════════════════════════ */

async function apiPost(endpoint, body, isFormData = false) {
    const headers = {};
    if (STATE.token) headers['Authorization'] = `Bearer ${STATE.token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers,
        body: isFormData ? body : JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed.');
    return data;
}

async function apiGet(endpoint) {
    const headers = STATE.token ? { 'Authorization': `Bearer ${STATE.token}` } : {};
    const res = await fetch(`${API}${endpoint}`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed.');
    return data;
}

/* ═══════════════════════════════════════════════════════════
   STEP 1 — REGISTER
   ═══════════════════════════════════════════════════════════ */

function initRegisterForm() {
    const form = $('registerForm');
    const btn = $('registerBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert('registerError');

        const name = $('regName').value.trim();
        const email = $('regEmail').value.trim();
        const password = $('regPassword').value;

        // Client-side validation
        let hasError = false;
        if (!name || name.length < 2) {
            $('nameError').textContent = 'Please enter your full name.';
            hasError = true;
        } else { $('nameError').textContent = ''; }

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            $('emailError').textContent = 'Please enter a valid email address.';
            hasError = true;
        } else { $('emailError').textContent = ''; }

        if (!password || password.length < 8) {
            $('passwordError').textContent = 'Password must be at least 8 characters.';
            hasError = true;
        } else { $('passwordError').textContent = ''; }

        if (hasError) return;

        setButtonLoading(btn, true);

        try {
            const data = await apiPost('/api/auth/register', { name, email, password });
            STATE.token = data.token;
            STATE.user = data.user;
            localStorage.setItem('snx_token', data.token);
            localStorage.setItem('snx_user', JSON.stringify(data.user));
            showStep(3);  // Skip to doc upload — user is logged in fresh
        } catch (err) {
            showAlert('registerError', err.message || 'Registration failed. Please try again.');
        } finally {
            setButtonLoading(btn, false);
        }
    });

    // Toggle "go to login"
    $('goToLogin').addEventListener('click', () => showStep(2));
}

/* ═══════════════════════════════════════════════════════════
   STEP 2 — LOGIN
   ═══════════════════════════════════════════════════════════ */

function initLoginForm() {
    const form = $('loginForm');
    const btn = $('loginBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert('loginError');

        const email = $('loginEmail').value.trim();
        const password = $('loginPassword').value;

        if (!email || !password) {
            showAlert('loginError', 'Please enter your email and password.');
            return;
        }

        setButtonLoading(btn, true);

        try {
            const data = await apiPost('/api/auth/login', { email, password });
            STATE.token = data.token;
            STATE.user = data.user;
            localStorage.setItem('snx_token', data.token);
            localStorage.setItem('snx_user', JSON.stringify(data.user));

            // If already verified, go straight to ID card
            if (data.user.verified && data.user.safeNexID) {
                STATE.verificationData = {
                    safeNexID: data.user.safeNexID,
                    qrCodeURL: data.user.qrCodePath
                        ? `/qrcodes/${data.user.qrCodePath.split(/[\\/]/).pop()}`
                        : null,
                };
                // Fetch full profile for display
                try {
                    const dash = await apiGet('/api/dashboard');
                    renderIDCard(dash.user);
                } catch (_) { }
                showStep(4);
            } else {
                showStep(3);
            }
        } catch (err) {
            showAlert('loginError', err.message || 'Login failed. Please check your credentials.');
        } finally {
            setButtonLoading(btn, false);
        }
    });

    $('goToRegister').addEventListener('click', () => showStep(1));
}

/* ═══════════════════════════════════════════════════════════
   STEP 3 — DOCUMENT UPLOAD
   ═══════════════════════════════════════════════════════════ */

function initDocumentUpload() {
    // Doc type selection
    document.querySelectorAll('.doc-type-card').forEach((card) => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.doc-type-card').forEach((c) => c.classList.remove('active'));
            card.classList.add('active');
            STATE.selectedDocType = card.dataset.type;
        });
    });

    // Upload zone + input
    const zone = $('uploadZone');
    const input = $('documentFile');
    const choose = $('chooseFileBtn');

    zone.addEventListener('click', () => input.click());
    choose.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });

    // Drag and drop
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFileSelected(file);
    });

    input.addEventListener('change', () => {
        if (input.files?.[0]) handleFileSelected(input.files[0]);
    });

    // Remove file
    $('removeFile').addEventListener('click', () => {
        STATE.selectedFile = null;
        input.value = '';
        $('filePreview').hidden = true;
        $('submitVerifyBtn').disabled = true;
        hideAlert('uploadError');
    });

    // Submit
    $('submitVerifyBtn').addEventListener('click', submitVerification);
}

function handleFileSelected(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
        showAlert('uploadError', 'Invalid file type. Please upload a JPG, PNG, or PDF.');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showAlert('uploadError', 'File is too large. Maximum size is 10MB.');
        return;
    }
    hideAlert('uploadError');
    STATE.selectedFile = file;

    // Show preview
    $('previewName').textContent = file.name;
    $('previewSize').textContent = `${formatFileSize(file.size)} • Ready`;
    $('filePreview').hidden = false;

    // Animate bar to 100%
    setTimeout(() => { $('previewBarFill').style.width = '100%'; }, 50);
    $('submitVerifyBtn').disabled = false;
}

/* ═══════════════════════════════════════════════════════════
   SUBMIT VERIFICATION — CORE FLOW
   ═══════════════════════════════════════════════════════════ */

async function submitVerification() {
    if (!STATE.selectedFile) {
        showAlert('uploadError', 'Please select a document to upload.');
        return;
    }
    if (!STATE.token) {
        showAlert('uploadError', 'Session expired. Please log in again.');
        showStep(2);
        return;
    }

    hideAlert('uploadError');

    // Transition to processing screen
    showStep('step-processing');
    resetCheckSteps();

    // Start animated check steps
    const stepTimings = [0, 2500, 5000, 8000];
    stepTimings.forEach((delay, i) => {
        setTimeout(() => activateCheckStep(i + 1), delay);
    });

    // Build FormData
    const formData = new FormData();
    formData.append('document', STATE.selectedFile);
    formData.append('documentType', STATE.selectedDocType);

    try {
        // Mark step 1 done quickly, let 2/3 run during network call
        setTimeout(() => markCheckStepDone(1), 1500);

        const data = await apiPost('/api/verify/document', formData, true);

        // Finish remaining steps
        markCheckStepDone(2);
        setTimeout(() => markCheckStepDone(3), 400);
        setTimeout(() => {
            markCheckStepDone(4);
            STATE.verificationData = data;
            setTimeout(() => {
                renderIDCard({
                    name: data.extractedName || STATE.user?.name || 'Verified User',
                    documentType: data.documentType,
                    safeNexID: data.safeNexID,
                    documentNumber: data.documentNumber,
                    verifiedAt: data.verifiedAt,
                    qrCodeURL: data.qrCodeURL,
                });
                showStep(4);
            }, 700);
        }, 900);

    } catch (err) {
        // Show error state
        $('errorReason').textContent = err.message || 'Document verification failed. Please upload a clearer image.';
        showStep('step-error');
    }
}

/* ─── Check Step Animation ──────────────────────────────── */

function resetCheckSteps() {
    for (let i = 1; i <= 4; i++) {
        const el = document.querySelector(`#cs-${i}`);
        if (el) {
            el.dataset.state = 'pending';
            // Remove inline done icon if injected
            const icon = el.querySelector('.cs-done');
            if (icon) icon.remove();
        }
    }
}

function activateCheckStep(num) {
    const el = $(`cs-${num}`);
    if (el) el.dataset.state = 'active';
}

function markCheckStepDone(num) {
    const el = $(`cs-${num}`);
    if (!el) return;
    el.dataset.state = 'done';
    const iconWrap = el.querySelector('.check-step__icon');
    if (iconWrap) {
        iconWrap.innerHTML = `
      <svg class="cs-done" viewBox="0 0 24 24" fill="none" style="width:22px;height:22px;">
        <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22C55E" stroke-width="1.5"/>
        <path d="M8 12l3 3 5-6" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
}

/* ═══════════════════════════════════════════════════════════
   STEP 4 — RENDER ID CARD
   ═══════════════════════════════════════════════════════════ */

function renderIDCard(data) {
    const docLabel = data.documentType === 'aadhaar' ? 'National ID (Aadhaar)' : 'International Passport';
    const verifiedAt = formatDate(data.verifiedAt);
    const maskedDoc = maskDocNumber(data.documentNumber);

    // ID Card fields
    $('cardName').textContent = data.name || STATE.user?.name || '—';
    $('cardDocType').textContent = docLabel;
    $('cardSafeNexID').textContent = data.safeNexID || '—';
    $('cardVerifiedAt').textContent = verifiedAt;

    // QR Code
    if (data.qrCodeURL) {
        $('qrImage').src = data.qrCodeURL;
        $('qrImage').alt = 'SafeNex QR Code';
    }

    // Verified info table
    $('viName').textContent = data.name || STATE.user?.name || '—';
    $('viDocType').textContent = docLabel;
    $('viDocNumber').textContent = maskedDoc;
    $('viVerifiedAt').textContent = verifiedAt;
}

/* ═══════════════════════════════════════════════════════════
   STEP 4 ACTIONS
   ═══════════════════════════════════════════════════════════ */

function initIDCardActions() {
    // Enter Dashboard — only accessible when verified
    $('enterDashboardBtn').addEventListener('click', () => {
        window.location.href = '/dashboard';
    });

    // Share ID
    $('shareIDBtn').addEventListener('click', async () => {
        const safeNexID = STATE.verificationData?.safeNexID || '—';
        const text = `My SafeNex Verified ID: ${safeNexID}\nIssued by SafeNex Identity System`;
        if (navigator.share) {
            try { await navigator.share({ title: 'SafeNex ID', text }); } catch (_) { }
        } else {
            await navigator.clipboard.writeText(text);
            alert('SafeNex ID copied to clipboard!');
        }
    });

    // Download QR
    $('downloadQRBtn').addEventListener('click', () => {
        const qrSrc = $('qrImage').src;
        if (!qrSrc) return;
        const a = document.createElement('a');
        a.href = qrSrc;
        a.download = `SafeNex-QR-${STATE.verificationData?.safeNexID || 'code'}.png`;
        a.click();
    });

    // Retry (from error screen)
    $('retryBtn').addEventListener('click', () => {
        STATE.selectedFile = null;
        $('documentFile').value = '';
        $('filePreview').hidden = true;
        $('submitVerifyBtn').disabled = true;
        $('previewBarFill').style.width = '0%';
        showStep(3);
    });

    // Need help
    $('needHelp').addEventListener('click', (e) => {
        e.preventDefault();
        alert(`SafeNex Support\n\nFor help with document verification:\n✉️ support@safenex.io\n\nTips:\n• Use a high-resolution photo\n• Ensure all 4 corners of the document are visible\n• Avoid glare and shadows\n• For Aadhaar: both front and back recommended`);
    });
}

/* ═══════════════════════════════════════════════════════════
   TOGGLE PASSWORD VISIBILITY
   ═══════════════════════════════════════════════════════════ */

function initPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = $(btn.dataset.target);
            if (!target) return;
            target.type = target.type === 'password' ? 'text' : 'password';
        });
    });
}

/* ═══════════════════════════════════════════════════════════
   SESSION RESUME — Auto-login if token present
   ═══════════════════════════════════════════════════════════ */

async function resumeSession() {
    if (!STATE.token) return false;

    try {
        const data = await apiGet('/api/dashboard');
        STATE.user = data.user;
        localStorage.setItem('snx_user', JSON.stringify(data.user));

        if (data.user.verified && data.user.safeNexID) {
            // Already verified — go straight to the dashboard
            window.location.replace('/dashboard');
            return true;
        }

        // Logged in but not verified
        showStep(3);
        return true;
    } catch (_) {
        // Token invalid/expired — clear and stay on step 1
        localStorage.removeItem('snx_token');
        localStorage.removeItem('snx_user');
        STATE.token = null;
        STATE.user = null;
        return false;
    }
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
    // Init all form sections
    initRegisterForm();
    initLoginForm();
    initDocumentUpload();
    initIDCardActions();
    initPasswordToggles();
    initMissionCarousel();

    // Try to resume existing session
    const resumed = await resumeSession();

    // If no resumed session, start at step 1 (already shown by CSS .active on step-1)
    if (!resumed) {
        showStep(1);
    }
});


/* ═══════════════════════════════════════════════════════════
   MISSION CAROUSEL - Desktop & Mobile
   ═══════════════════════════════════════════════════════════ */

function initMissionCarousel() {
    // Initialize desktop carousel (in sidebar)
    initCarousel('missionCarousel');
    
    // Initialize mobile carousel (compact version)
    initMobileCarousel();
}

function initMobileCarousel() {
    const section = document.getElementById('mobileMissionSection');
    if (!section) return;
    
    // Close button handler
    const closeBtn = document.getElementById('closeMobileMission');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            section.style.display = 'none';
            // Save preference to localStorage
            localStorage.setItem('snx_hide_mission_carousel', 'true');
        });
    }
    
    // Check if user previously closed the carousel
    if (localStorage.getItem('snx_hide_mission_carousel') === 'true') {
        section.style.display = 'none';
        return; // Don't initialize carousel if hidden
    }
    
    let currentSlide = 1;
    const totalSlides = 4;
    let touchStartX = 0;
    let touchEndX = 0;
    let autoPlayInterval = null;
    
    const slides = section.querySelectorAll('.mobile-mission-slide');
    const dots = section.querySelectorAll('.mobile-dot');
    
    function showSlide(slideNum) {
        if (slideNum > totalSlides) slideNum = 1;
        if (slideNum < 1) slideNum = totalSlides;
        
        currentSlide = slideNum;
        
        slides.forEach((slide, index) => {
            slide.classList.toggle('active', index + 1 === currentSlide);
        });
        
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index + 1 === currentSlide);
        });
    }
    
    function nextSlide() {
        showSlide(currentSlide + 1);
    }
    
    function startAutoPlay() {
        stopAutoPlay();
        autoPlayInterval = setInterval(nextSlide, 4000);
    }
    
    function stopAutoPlay() {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
        }
    }
    
    // Dot navigation
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            stopAutoPlay();
            showSlide(index + 1);
            startAutoPlay();
        });
    });
    
    // Touch swipe
    section.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoPlay();
    }, { passive: true });
    
    section.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                nextSlide();
            } else {
                showSlide(currentSlide - 1);
            }
        }
        startAutoPlay();
    }, { passive: true });
    
    // Start autoplay
    startAutoPlay();
    
    // Pause when page hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoPlay();
        } else {
            startAutoPlay();
        }
    });
}

function initCarousel(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    let currentSlide = 1;
    const totalSlides = 4;
    let touchStartX = 0;
    let touchEndX = 0;
    let autoPlayInterval = null;
    
    function showSlide(slideNum) {
        if (slideNum > totalSlides) slideNum = 1;
        if (slideNum < 1) slideNum = totalSlides;
        
        currentSlide = slideNum;
        
        carousel.querySelectorAll('.mission-slide').forEach((slide) => {
            slide.classList.remove('active');
            if (parseInt(slide.dataset.slide) === currentSlide) {
                slide.classList.add('active');
            }
        });
        
        carousel.querySelectorAll('.mission-dot').forEach((dot) => {
            dot.classList.remove('active');
            if (parseInt(dot.dataset.slide) === currentSlide) {
                dot.classList.add('active');
            }
        });
    }
    
    function nextSlide() {
        showSlide(currentSlide + 1);
    }
    
    function prevSlide() {
        showSlide(currentSlide - 1);
    }
    
    function startAutoPlay() {
        stopAutoPlay();
        autoPlayInterval = setInterval(nextSlide, 5000);
    }
    
    function stopAutoPlay() {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
        }
    }
    
    // Navigation buttons
    carousel.querySelectorAll('.mission-nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            stopAutoPlay();
            const direction = btn.dataset.nav;
            if (direction === 'next') {
                nextSlide();
            } else {
                prevSlide();
            }
            startAutoPlay();
        });
    });
    
    // Dot navigation
    carousel.querySelectorAll('.mission-dot').forEach((dot) => {
        dot.addEventListener('click', () => {
            stopAutoPlay();
            showSlide(parseInt(dot.dataset.slide));
            startAutoPlay();
        });
    });
    
    // Touch swipe
    carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoPlay();
    }, { passive: true });
    
    carousel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
        startAutoPlay();
    }, { passive: true });
    
    // Mouse drag
    let isDragging = false;
    let dragStartX = 0;
    
    carousel.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        stopAutoPlay();
        carousel.style.cursor = 'grabbing';
    });
    
    carousel.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
    });
    
    carousel.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        carousel.style.cursor = 'grab';
        
        const diff = dragStartX - e.clientX;
        
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
        startAutoPlay();
    });
    
    carousel.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            carousel.style.cursor = 'grab';
            startAutoPlay();
        }
    });
    
    carousel.style.cursor = 'grab';
    
    // Pause on hover (desktop only)
    if (window.matchMedia('(hover: hover)').matches) {
        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);
    }
    
    // Start autoplay
    startAutoPlay();
    
    // Pause when page hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoPlay();
        } else {
            startAutoPlay();
        }
    });
}
