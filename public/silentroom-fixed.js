// Silent Room - Fixed Frontend Logic
const API_BASE = '/api/silentroom';
let currentPage = 1;
let currentTab = 'intel';
let selectedReportType = null;
let selectedImages = [];
let currentLocation = null;
let currentUser = null;

// DOM Elements
const feedContainer = document.getElementById('feedContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');
const createPostBtn = document.getElementById('createPostBtn');
const createReportModal = document.getElementById('createReportModal');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const confirmationModal = document.getElementById('confirmationModal');
const reportDetailModal = document.getElementById('reportDetailModal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Silent Room initializing...');
    initializeUser();
    setupEventListeners();
    loadFeed();
});

// Initialize User from localStorage
function initializeUser() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            currentUser = JSON.parse(userStr);
            console.log('User loaded:', currentUser);
            updateUserAvatar();
        } else {
            console.warn('No user data found in localStorage');
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

// Update User Avatar
function updateUserAvatar() {
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar && currentUser) {
        const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
        profileAvatar.innerHTML = `
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%233b82f6'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='white' font-size='40' font-family='Arial'%3E${initial}%3C/text%3E%3C/svg%3E" alt="${currentUser.name || 'User'}">
        `;
    }
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        currentPage = 1;
        loadFeed();
    });
});

// Load Feed
async function loadFeed() {
    try {
        console.log('Loading feed...');
        showLoading();
        
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            showError('Please login to continue');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
            return;
        }

        const type = currentTab === 'intel' ? 'incident,unsafe_area' : 'discussion';
        console.log('Fetching feed:', { page: currentPage, type });
        
        const response = await fetch(`${API_BASE}/feed?page=${currentPage}&type=${type}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        console.log('Response status:', response.status);

        if (response.status === 401) {
            console.error('Unauthorized - token may be invalid');
            showError('Session expired. Please login again.');
            setTimeout(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/';
            }, 2000);
            return;
        }

        const data = await response.json();
        console.log('Feed data:', data);

        if (data.success) {
            if (data.data && data.data.length > 0) {
                renderFeed(data.data);
            } else {
                showEmptyState();
            }
        } else {
            console.error('Feed load failed:', data.message);
            showEmptyState();
        }
    } catch (error) {
        console.error('Feed error:', error);
        showEmptyState();
    } finally {
        hideLoading();
    }
}

// Render Feed
function renderFeed(reports) {
    feedContainer.innerHTML = '';
    emptyState.style.display = 'none';

    if (!reports || reports.length === 0) {
        showEmptyState();
        return;
    }

    reports.forEach((report, index) => {
        const card = createFeedCard(report);
        card.style.animationDelay = `${index * 0.1}s`;
        feedContainer.appendChild(card);
    });
}

// Show Empty State
function showEmptyState() {
    feedContainer.innerHTML = '';
    emptyState.style.display = 'block';
    emptyState.innerHTML = `
        <div class="empty-icon">📡</div>
        <h3>No Reports Yet</h3>
        <p>Be the first to contribute to community safety</p>
        <button class="submit-btn" onclick="document.getElementById('createPostBtn').click()" style="max-width: 300px; margin: 1rem auto;">
            <span>Create First Report</span>
            <span>→</span>
        </button>
    `;
}

// Create Feed Card
function createFeedCard(report) {
    const card = document.createElement('div');
    card.className = `feed-card ${report.severity === 'high' ? 'high-risk' : ''} ${report.severity === 'critical' ? 'critical-risk' : ''}`;
    card.onclick = () => openReportDetail(report.reportId);

    const categoryLabels = {
        violent_crime: 'VIOLENT CRIME',
        theft: 'THEFT',
        harassment: 'HARASSMENT',
        surveillance: 'SURVEILLANCE',
        suspicious_activity: 'SUSPICIOUS ACTIVITY',
        traffic: 'TRAFFIC',
        environmental: 'ENVIRONMENTAL',
        infrastructure: 'INFRASTRUCTURE',
        general: 'GENERAL',
        other: 'OTHER',
    };

    card.innerHTML = `
        <div class="card-header">
            <div class="card-meta">
                <span class="category-badge ${report.category}">${categoryLabels[report.category] || report.category.toUpperCase()}</span>
                <span class="timestamp">
                    <span>🕐</span>
                    <span>${formatTimestamp(report.timestamp)}</span>
                </span>
            </div>
            <div class="risk-indicator ${report.severity}">
                ${report.severity === 'high' ? 'HIGH RISK' : report.severity === 'critical' ? 'CRITICAL' : report.severity.toUpperCase()}
            </div>
        </div>

        <h3 class="card-title">${escapeHtml(report.title)}</h3>
        
        <div class="card-location">
            <span>📍</span>
            <span>${escapeHtml(report.location.address || report.location.city || 'Unknown Location')}</span>
        </div>

        ${report.images && report.images.length > 0 ? `
            <div style="position: relative;">
                <img src="${report.images[0].url}" alt="Report image" class="card-image">
                ${report.type === 'incident' && report.severity === 'critical' ? '<div class="live-badge">LIVE CAM</div>' : ''}
            </div>
        ` : ''}

        <div class="card-footer">
            <div class="card-badges">
                ${report.author && report.author.verified ? `
                    <div class="verified-badge">
                        <span>✓</span>
                        <span>VERIFIED</span>
                    </div>
                ` : ''}
                ${report.similarReportsCount > 0 ? `
                    <div class="reports-count">
                        <span>⚠️</span>
                        <span>+${report.similarReportsCount} Reports</span>
                    </div>
                ` : ''}
            </div>
            <a href="#" class="view-link" onclick="event.stopPropagation(); openReportDetail('${report.reportId}')">
                View Details
                <span>→</span>
            </a>
        </div>

        <div class="card-stats">
            <div class="stat-item ${report.votes && report.votes.total > 0 ? 'active' : ''}">
                <span>👍</span>
                <span>${report.votes ? report.votes.total : 0}</span>
            </div>
            <div class="stat-item">
                <span>💬</span>
                <span>${report.commentsCount || 0}</span>
            </div>
            <div class="stat-item">
                <span>👁️</span>
               