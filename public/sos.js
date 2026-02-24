'use strict';

/* ═══════════════════════════════════════════════════════════
   NEXA AI SOS — Emergency Protocol System
   ═══════════════════════════════════════════════════════════ */

const API = '';

// ── State ──────────────────────────────────────────────────
const state = {
    mode: 'normal', // 'normal' | 'emergency'
    user: null,
    config: null,
    session: null,
    beaconInterval: null,
    timerInterval: null,
    currentLocation: null,
    isThinking: false,
    abortController: null,
    isRecording: false,
    mediaRecorder: null,
};

// ── Boot ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('snx_token');
    if (!token) {
        console.log('[SOS] No token found, redirecting to dashboard');
        return redirect();
    }

    try {
        const res = await fetch(`${API}/api/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) {
            console.error('[SOS] Dashboard fetch failed:', res.status);
            localStorage.removeItem('snx_token');
            return redirect();
        }

        const { user } = await res.json();
        if (!user) {
            console.error('[SOS] No user data');
            return redirect();
        }

        console.log('[SOS] User loaded:', user.name);
        state.user = user;
        await loadConfig();
        initChat();
        initConfig();
        initEmergency();
        
        // Add welcome message
        setTimeout(() => {
            addMessage(
                `Hello ${user.name}! I'm Nexa AI, your emergency assistant. I'm actively monitoring for keywords like "help", "emergency", or "danger". How can I assist you today?`,
                'ai'
            );
        }, 500);
    } catch (err) {
        console.error('[SOS] Boot error:', err);
        showToast('⚠️ Failed to initialize. Please try again.');
        setTimeout(redirect, 2000);
    }
});

function redirect() {
    window.location.replace('/dashboard');
}

// ── Load Configuration ─────────────────────────────────────
async function loadConfig() {
    try {
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/sos/config`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
            const { config } = await res.json();
            state.config = config;
        } else {
            // Use defaults
            state.config = getDefaultConfig();
        }
    } catch (err) {
        console.error('[Config Load]', err);
        state.config = getDefaultConfig();
    }
}

function getDefaultConfig() {
    return {
        primaryContact: '',
        secondaryContact: '',
        messageTemplate: "🚨 EMERGENCY ALERT 🚨\nI need help! My current location is {{location}}.\nBattery: {{battery}}\nTime: {{timestamp}}\nPlease send help immediately.",
        safeWords: ['help', 'emergency', 'danger'],
        voiceActivationEnabled: false,
        liveBeaconEnabled: false,
        beaconUpdateInterval: 60,
        batteryLevelEnabled: true,
        timestampEnabled: true,
    };
}

// ── Chat Interface ─────────────────────────────────────────
function initChat() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    sendBtn.addEventListener('click', () => {
        if (state.isThinking) {
            stopThinking();
        } else {
            sendMessage();
        }
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !state.isThinking) sendMessage();
    });

    settingsBtn.addEventListener('click', openConfig);

    // Voice button
    document.getElementById('voiceBtn')?.addEventListener('click', toggleVoiceRecording);
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || state.isThinking) return;

    // Add user message
    addMessage(text, 'user');
    input.value = '';

    // Check for safe words
    const detected = detectSafeWord(text);
    if (detected) {
        setTimeout(() => {
            addMessage(
                `🚨 EMERGENCY DETECTED: I've identified the keyword "${detected}". Activating emergency protocol immediately.`,
                'ai'
            );
            addActionCard();
        }, 500);

        setTimeout(() => {
            activateEmergency(detected);
        }, 2000);
    } else {
        // Show thinking animation
        startThinking();

        try {
            const response = await getGeminiResponse(text);
            stopThinking();
            addMessage(response, 'ai');
        } catch (err) {
            console.error('[Gemini]', err);
            stopThinking();
            addMessage(
                'I\'m here to help. If you need emergency assistance, type "help", "emergency", or "danger".',
                'ai'
            );
        }
    }
}

async function getGeminiResponse(userMessage) {
    try {
        state.abortController = new AbortController();
        const token = localStorage.getItem('snx_token');
        
        const res = await fetch(`${API}/api/sos/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ message: userMessage }),
            signal: state.abortController.signal,
        });

        if (!res.ok) throw new Error('Chat API failed');

        const { response } = await res.json();
        return response;
    } catch (err) {
        if (err.name === 'AbortError') {
            return 'Response generation stopped.';
        }
        console.error('[Gemini API]', err);
        return 'I\'m monitoring your messages. If you need emergency assistance, type "help", "emergency", or "danger".';
    }
}

function addMessage(text, sender) {
    const chat = document.getElementById('chatMessages');
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const msg = document.createElement('div');
    msg.className = `sos-message sos-message--${sender}`;
    msg.innerHTML = `
        <div class="sos-message__avatar">
            ${sender === 'ai' ? `
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L4 9v12c0 9.4 6.8 18.2 16 20 9.2-1.8 16-10.6 16-20V9L20 2z" fill="currentColor"/>
                </svg>
            ` : `
                <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            `}
        </div>
        <div class="sos-message__content">
            <div class="sos-message__text">${escapeHtml(text)}</div>
            <div class="sos-message__time">${time}</div>
        </div>
    `;

    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
}

function addActionCard() {
    const chat = document.getElementById('chatMessages');
    const card = document.createElement('div');
    card.className = 'sos-message sos-message--ai';
    card.innerHTML = `
        <div class="sos-message__avatar">
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 9v12c0 9.4 6.8 18.2 16 20 9.2-1.8 16-10.6 16-20V9L20 2z" fill="currentColor"/>
            </svg>
        </div>
        <div class="sos-message__content">
            <div class="sos-action-card">
                <div class="sos-action-card__header">
                    <div class="sos-action-card__icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="sos-action-card__title">ACTION TAKEN</div>
                </div>
                <div class="sos-action-card__text">
                    911 Alert Sent
                </div>
            </div>
            <div class="sos-message__text">
                I am contacting emergency services with your location.
            </div>
        </div>
    `;

    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
}

function detectSafeWord(text) {
    const lower = text.toLowerCase();
    const safeWords = state.config?.safeWords || ['help', 'emergency', 'danger'];

    for (const word of safeWords) {
        if (lower.includes(word.toLowerCase())) {
            return word;
        }
    }
    return null;
}

// ── Thinking Animation ─────────────────────────────────────
function startThinking() {
    state.isThinking = true;
    
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const inputContainer = document.getElementById('inputContainer');
    
    input.disabled = true;
    input.placeholder = 'AI is thinking...';
    inputContainer.classList.add('disabled');
    
    // Change send button to stop button
    sendBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
        </svg>
    `;
    sendBtn.classList.add('stop');
    
    // Add thinking message
    const chat = document.getElementById('chatMessages');
    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'sos-message sos-message--ai';
    thinkingMsg.id = 'thinkingMessage';
    thinkingMsg.innerHTML = `
        <div class="sos-message__avatar">
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 9v12c0 9.4 6.8 18.2 16 20 9.2-1.8 16-10.6 16-20V9L20 2z" fill="currentColor"/>
            </svg>
        </div>
        <div class="sos-message__content">
            <div class="sos-message__label">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Neural Process
            </div>
            <div class="sos-thinking">
                <div class="sos-thinking__dots">
                    <div class="sos-thinking__dot"></div>
                    <div class="sos-thinking__dot"></div>
                    <div class="sos-thinking__dot"></div>
                </div>
                <span class="sos-thinking__text">Analyzing your message...</span>
            </div>
        </div>
    `;
    
    chat.appendChild(thinkingMsg);
    chat.scrollTop = chat.scrollHeight;
}

function stopThinking() {
    state.isThinking = false;
    
    if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
    }
    
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const inputContainer = document.getElementById('inputContainer');
    
    input.disabled = false;
    input.placeholder = 'Describe your emergency...';
    inputContainer.classList.remove('disabled');
    input.focus();
    
    // Restore send button
    sendBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    sendBtn.classList.remove('stop');
    
    // Remove thinking message
    const thinkingMsg = document.getElementById('thinkingMessage');
    if (thinkingMsg) {
        thinkingMsg.remove();
    }
}

// ── Voice Recording ────────────────────────────────────────
async function toggleVoiceRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaRecorder = new MediaRecorder(stream);
        state.isRecording = true;
        
        const chunks = [];
        state.mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        
        state.mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(blob);
            
            // Show audio in chat
            addAudioMessage(audioUrl);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
            state.isRecording = false;
            updateVoiceButton();
        };
        
        state.mediaRecorder.start();
        updateVoiceButton();
        showToast('🎤 Recording... Tap again to stop', 3000);
    } catch (err) {
        console.error('[Voice Recording]', err);
        showToast('⚠️ Microphone access denied');
        state.isRecording = false;
    }
}

function stopRecording() {
    if (state.mediaRecorder && state.isRecording) {
        state.mediaRecorder.stop();
    }
}

function updateVoiceButton() {
    const voiceBtn = document.getElementById('voiceBtn');
    if (state.isRecording) {
        voiceBtn.classList.add('recording');
        voiceBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor"/>
            </svg>
        `;
    } else {
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
        `;
    }
}

function addAudioMessage(audioUrl) {
    const chat = document.getElementById('chatMessages');
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const msg = document.createElement('div');
    msg.className = 'sos-message sos-message--user';
    msg.innerHTML = `
        <div class="sos-message__avatar">
            <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
        </div>
        <div class="sos-message__content">
            <div class="sos-audio-player">
                <audio controls src="${audioUrl}"></audio>
            </div>
            <div class="sos-message__time">${time}</div>
        </div>
    `;

    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
    
    showToast('🎤 Voice message recorded');
    
    // Get AI response for voice message
    setTimeout(async () => {
        startThinking();
        try {
            const response = await getGeminiResponse('I sent you a voice message. Please acknowledge it and ask if I need any assistance.');
            stopThinking();
            addMessage(response, 'ai');
        } catch (err) {
            console.error('[Voice Response]', err);
            stopThinking();
            addMessage('I received your voice message. How can I assist you today?', 'ai');
        }
    }, 500);
}

// ── Emergency Activation ───────────────────────────────────
async function activateEmergency(triggeredBy) {
    if (state.mode === 'emergency') return;

    // Validate config
    if (!state.config?.primaryContact) {
        showToast('⚠️ Emergency contact not configured. Please configure in settings.');
        return;
    }

    state.mode = 'emergency';

    // Create session
    const sessionId = generateSessionId();
    state.session = {
        id: sessionId,
        triggeredBy,
        startTime: new Date(),
        events: [],
    };

    // Log activation
    logEvent('activation', 'Emergency protocol activated', true);

    // Show emergency screen
    document.getElementById('sosContainer').hidden = true;
    document.getElementById('emergencyScreen').hidden = false;
    document.getElementById('sessionId').textContent = sessionId;

    // Start timer
    startTimer();

    // Get location
    await acquireLocation();

    // Prepare and send message
    await prepareAndSendMessage();

    // Start beacon if enabled
    if (state.config.liveBeaconEnabled) {
        startBeacon();
    }

    // Save session to backend
    await saveSession();
}

function generateSessionId() {
    return `#${Math.random().toString(36).substr(2, 9).toUpperCase()}-SOS`;
}

function logEvent(type, details, success, errorMessage = null) {
    const event = {
        type,
        details,
        success,
        errorMessage,
        timestamp: new Date(),
    };

    state.session.events.push(event);

    // Add to UI
    const log = document.getElementById('systemLog');
    const item = document.createElement('div');
    item.className = `sos-log-item sos-log-item--${success ? 'success' : errorMessage ? 'error' : 'pending'}`;

    const icon = success
        ? '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : errorMessage
        ? '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

    item.innerHTML = `
        ${icon}
        <div class="sos-log-item__text">
            ${escapeHtml(details)}
            ${errorMessage ? `<span class="sos-log-item__detail">${escapeHtml(errorMessage)}</span>` : ''}
        </div>
    `;

    log.appendChild(item);
}

// ── Location Services ──────────────────────────────────────
async function acquireLocation() {
    logEvent('gps_acquisition', 'Acquiring GPS coordinates...', false);

    try {
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            });
        });

        const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(),
        };

        state.currentLocation = coords;

        const mapLink = generateMapLink(coords);
        logEvent('gps_acquired', `Location acquired (±${Math.round(coords.accuracy)}m precision)`, true);

        // Update map
        updateMap(coords, mapLink);

        // Show resend button if beacon enabled
        if (state.config.liveBeaconEnabled) {
            document.getElementById('resendBtn').hidden = false;
        }

        return coords;
    } catch (err) {
        console.error('[GPS]', err);
        logEvent('gps_failed', 'GPS acquisition failed', false, err.message);
        state.currentLocation = null;

        document.getElementById('locationText').textContent = 'Location unavailable';
        return null;
    }
}

function generateMapLink(coords) {
    return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
}

function updateMap(coords, mapLink) {
    const container = document.getElementById('mapContainer');
    container.innerHTML = `
        <iframe
            src="https://www.google.com/maps/embed/v1/place?key=&q=${coords.latitude},${coords.longitude}&zoom=15"
            style="width:100%;height:100%;border:0;border-radius:14px;"
            allowfullscreen
            loading="lazy"
        ></iframe>
    `;

    // Fallback if no API key
    setTimeout(() => {
        if (container.querySelector('iframe').contentDocument?.body?.innerHTML === '') {
            container.innerHTML = `
                <div class="sos-map-placeholder">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="1.5"/>
                        <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                    <span>Location: ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}</span>
                    <a href="${mapLink}" target="_blank" style="color:var(--cyan);font-size:12px;margin-top:8px;">Open in Google Maps</a>
                </div>
            `;
        }
    }, 2000);
}

// ── Message Preparation ────────────────────────────────────
async function prepareAndSendMessage() {
    logEvent('message_preparation', 'Preparing emergency message...', false);

    try {
        const message = await renderTemplate();
        logEvent('message_prepared', 'Emergency message prepared', true);

        // Send via WhatsApp
        await sendWhatsAppMessage(message);
    } catch (err) {
        console.error('[Message]', err);
        logEvent('message_failed', 'Message preparation failed', false, err.message);
    }
}

async function renderTemplate() {
    let template = state.config.messageTemplate;

    // Replace location
    if (state.currentLocation) {
        const mapLink = generateMapLink(state.currentLocation);
        template = template.replace(/\{\{location\}\}/g, mapLink);
    } else {
        template = template.replace(/\{\{location\}\}/g, 'Location unavailable');
    }

    // Replace battery (if enabled and supported)
    if (state.config.batteryLevelEnabled) {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                const level = Math.round(battery.level * 100);
                template = template.replace(/\{\{battery\}\}/g, `${level}%`);
            } else {
                // Remove battery placeholder if API not available
                template = template.replace(/\{\{battery\}\}/g, '').replace(/Battery:\s*\n/g, '');
            }
        } catch {
            template = template.replace(/\{\{battery\}\}/g, '').replace(/Battery:\s*\n/g, '');
        }
    } else {
        template = template.replace(/\{\{battery\}\}/g, '').replace(/Battery:\s*\n/g, '');
    }

    // Replace timestamp
    if (state.config.timestampEnabled) {
        const timestamp = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        template = template.replace(/\{\{timestamp\}\}/g, timestamp);
    } else {
        template = template.replace(/\{\{timestamp\}\}/g, '').replace(/Time:\s*\n/g, '');
    }

    return template.trim();
}

async function sendWhatsAppMessage(message) {
    logEvent('whatsapp_redirect', 'Opening WhatsApp...', false);

    try {
        const contact = state.config.primaryContact.replace(/[^\d+]/g, '');
        
        if (!contact) {
            throw new Error('No emergency contact configured');
        }

        const encodedMessage = encodeURIComponent(message);

        // Detect platform
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const url = isMobile
            ? `whatsapp://send?phone=${contact}&text=${encodedMessage}`
            : `https://web.whatsapp.com/send?phone=${contact}&text=${encodedMessage}`;

        console.log('[WhatsApp] Opening URL:', url);
        console.log('[WhatsApp] Contact:', contact);
        console.log('[WhatsApp] Platform:', isMobile ? 'Mobile' : 'Desktop');

        // Try to open WhatsApp
        const opened = window.open(url, '_blank');
        
        if (!opened) {
            // Fallback: try direct navigation
            window.location.href = url;
        }

        logEvent('whatsapp_redirect', `WhatsApp opened for ${contact}`, true);
        showToast('✅ WhatsApp opened! Press Send to alert your contact.', 4000);
        
        // Show fallback instructions after 3 seconds
        setTimeout(() => {
            if (confirm('Did WhatsApp open successfully?\n\nIf not, click OK to copy the message and contact number.')) {
                copyToClipboard(`Contact: ${contact}\n\nMessage:\n${message}`);
                showToast('📋 Copied! Open WhatsApp manually and paste.', 4000);
            }
        }, 3000);
    } catch (err) {
        console.error('[WhatsApp]', err);
        logEvent('whatsapp_failed', 'WhatsApp redirect failed', false, err.message);
        
        // Show fallback with copy option
        const fallbackMsg = `⚠️ WhatsApp redirect failed.\n\nContact: ${state.config.primaryContact}\n\nMessage:\n${message}`;
        if (confirm(fallbackMsg + '\n\nClick OK to copy this information.')) {
            copyToClipboard(fallbackMsg);
            showToast('📋 Copied! Open WhatsApp manually.', 4000);
        }
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

// ── Live Beacon ────────────────────────────────────────────
function startBeacon() {
    if (state.beaconInterval) return;

    const interval = (state.config.beaconUpdateInterval || 60) * 1000;

    state.beaconInterval = setInterval(async () => {
        logEvent('beacon_update', 'Updating location...', false);
        await acquireLocation();
        logEvent('beacon_update', 'Location updated', true);
    }, interval);

    logEvent('beacon_started', `Live beacon active (updates every ${state.config.beaconUpdateInterval}s)`, true);
}

function stopBeacon() {
    if (state.beaconInterval) {
        clearInterval(state.beaconInterval);
        state.beaconInterval = null;
        logEvent('beacon_stopped', 'Live beacon stopped', true);
    }
}

// ── Timer ──────────────────────────────────────────────────
function startTimer() {
    if (state.timerInterval) return;

    state.timerInterval = setInterval(() => {
        const elapsed = Math.floor((new Date() - state.session.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const mins = Math.floor((elapsed % 3600) / 60);
        const secs = elapsed % 60;

        document.getElementById('timerHours').textContent = String(hours).padStart(2, '0');
        document.getElementById('timerMins').textContent = String(mins).padStart(2, '0');
        document.getElementById('timerSecs').textContent = String(secs).padStart(2, '0');
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// ── Emergency Controls ─────────────────────────────────────
function initEmergency() {
    document.getElementById('endBtn')?.addEventListener('click', confirmEndEmergency);
    document.getElementById('falseAlarmLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        confirmEndEmergency();
    });
    document.getElementById('resendBtn')?.addEventListener('click', resendLocation);
}

function confirmEndEmergency() {
    if (!confirm('⚠️ END EMERGENCY PROTOCOL?\n\nThis will stop all alerts and location tracking.\n\nPress OK to confirm.')) {
        return;
    }

    endEmergency();
}

async function endEmergency() {
    logEvent('termination', 'Emergency protocol terminated by user', true);

    stopBeacon();
    stopTimer();

    state.session.endTime = new Date();
    await saveSession();

    showToast('✅ Emergency protocol ended');

    setTimeout(() => {
        state.mode = 'normal';
        state.session = null;
        document.getElementById('emergencyScreen').hidden = true;
        document.getElementById('sosContainer').hidden = false;

        // Clear chat
        document.getElementById('chatMessages').innerHTML = `
            <div class="sos-message sos-message--ai">
                <div class="sos-message__avatar">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L4 9v12c0 9.4 6.8 18.2 16 20 9.2-1.8 16-10.6 16-20V9L20 2z" fill="currentColor"/>
                    </svg>
                </div>
                <div class="sos-message__content">
                    <div class="sos-message__text">
                        Emergency protocol has been terminated. I'm back to monitoring mode. Stay safe.
                    </div>
                    <div class="sos-message__time">Just now</div>
                </div>
            </div>
        `;
    }, 1500);
}

async function resendLocation() {
    if (!state.currentLocation) {
        showToast('⚠️ No location available');
        return;
    }

    logEvent('manual_resend', 'User requested location resend', true);

    const message = await renderTemplate();
    await sendWhatsAppMessage(message);
}

// ── Session Persistence ────────────────────────────────────
async function saveSession() {
    try {
        const token = localStorage.getItem('snx_token');
        await fetch(`${API}/api/sos/session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                sessionId: state.session.id,
                triggeredBy: state.session.triggeredBy,
                startTime: state.session.startTime,
                endTime: state.session.endTime || null,
                events: state.session.events,
                location: state.currentLocation,
            }),
        });
    } catch (err) {
        console.error('[Session Save]', err);
    }
}

// ── Configuration ──────────────────────────────────────────
function initConfig() {
    document.getElementById('configSave')?.addEventListener('click', saveConfig);
    document.getElementById('configBack')?.addEventListener('click', closeConfig);
    document.getElementById('resetTemplate')?.addEventListener('click', resetTemplate);

    // Voice activation toggle
    document.getElementById('voiceActivation')?.addEventListener('change', (e) => {
        document.getElementById('safeWordField').hidden = !e.target.checked;
    });

    // Insert chips
    document.querySelectorAll('.sos-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const insert = chip.dataset.insert;
            const textarea = document.getElementById('messageTemplate');
            const pos = textarea.selectionStart;
            const text = textarea.value;
            textarea.value = text.slice(0, pos) + insert + text.slice(pos);
            textarea.focus();
        });
    });
}

function openConfig() {
    // Populate fields
    document.getElementById('primaryContact').value = state.config.primaryContact || '';
    document.getElementById('secondaryContact').value = state.config.secondaryContact || '';
    document.getElementById('messageTemplate').value = state.config.messageTemplate || '';
    document.getElementById('safeWord').value = state.config.safeWords?.join(', ') || '';
    document.getElementById('voiceActivation').checked = state.config.voiceActivationEnabled || false;
    document.getElementById('liveBeacon').checked = state.config.liveBeaconEnabled || false;
    document.getElementById('safeWordField').hidden = !state.config.voiceActivationEnabled;

    document.getElementById('configOverlay').hidden = false;
}

function closeConfig() {
    document.getElementById('configOverlay').hidden = true;
}

async function saveConfig() {
    const config = {
        primaryContact: document.getElementById('primaryContact').value.trim(),
        secondaryContact: document.getElementById('secondaryContact').value.trim(),
        messageTemplate: document.getElementById('messageTemplate').value.trim(),
        safeWords: document.getElementById('safeWord').value.split(',').map(w => w.trim()).filter(Boolean),
        voiceActivationEnabled: document.getElementById('voiceActivation').checked,
        liveBeaconEnabled: document.getElementById('liveBeacon').checked,
        beaconUpdateInterval: 60,
        batteryLevelEnabled: true,
        timestampEnabled: true,
    };

    if (!config.safeWords.length) {
        config.safeWords = ['help', 'emergency', 'danger'];
    }

    try {
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/sos/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(config),
        });

        if (res.ok) {
            state.config = config;
            showToast('✅ Configuration saved');
            closeConfig();
        } else {
            showToast('⚠️ Failed to save configuration');
        }
    } catch (err) {
        console.error('[Config Save]', err);
        showToast('⚠️ Failed to save configuration');
    }
}

function resetTemplate() {
    document.getElementById('messageTemplate').value = getDefaultConfig().messageTemplate;
}

// ── Utilities ──────────────────────────────────────────────
function showToast(msg, duration = 2600) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
