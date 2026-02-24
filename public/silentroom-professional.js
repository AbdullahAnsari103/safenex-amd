// Silent Room - Professional Implementation
const API_BASE = '/api/silentroom';

// State
let currentTab = 'chatter';
let currentPage = 1;
let selectedImages = [];
let currentLocation = null;
let selectedPostType = null;

// DOM Elements
const feedContainer = document.getElementById('feedContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');
const createPostBtn = document.getElementById('createPostBtn');
const createPostModal = document.getElementById('createPostModal');
const detailModal = document.getElementById('detailModal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    loadUserProfile();
    loadFeed();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => handleTabSwitch(btn));
    });

    // Create post
    createPostBtn.addEventListener('click', openCreateModal);
    document.getElementById('modalClose').addEventListener('click', closeCreateModal);
    document.getElementById('modalOverlay').addEventListener('click', closeCreateModal);

    // Detail modal
    document.getElementById('detailClose').addEventListener('click', closeDetailModal);
    document.getElementById('detailOverlay').addEventListener('click', closeDetailModal);

    // Post type selection
    document.querySelectorAll('.post-type-btn').forEach(btn => {
        btn.addEventListener('click', () => selectPostType(btn.dataset.type));
    });

    // Location
    document.getElementById('getLocationBtn').addEventListener('click', getCurrentLocation);

    // Image upload
    document.getElementById('imageUpload').addEventListener('click', handleImageUpload);

    // Character count
    document.getElementById('postMessage').addEventListener('input', updateCharCount);

    // Submit
    document.getElementById('submitBtn').addEventListener('click', submitPost);
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function handleTabSwitch(btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    currentPage = 1;
    
    // Update empty state text
    if (currentTab === 'chatter') {
        document.getElementById('emptyTitle').textContent = 'No messages yet';
        document.getElementById('emptyDesc').textContent = 'Be the first to start a conversation';
    } else {
        document.getElementById('emptyTitle').textContent = 'No reports yet';
        document.getElementById('emptyDesc').textContent = 'Be the first to report a safety concern';
    }
    
    loadFeed();
}

// ─── Load User Profile ────────────────────────────────────────────────────────
function loadUserProfile() {
    const token = localStorage.getItem('snx_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Get user initial from token or storage
    const userInitial = localStorage.getItem('userInitial') || 'U';
    document.getElementById('profileInitial').textContent = userInitial;
}

// ─── Load Feed ────────────────────────────────────────────────────────────────
async function loadFeed() {
    try {
        showLoading();
        
        const token = localStorage.getItem('snx_token');
        if (!token) {
            window.location.href = '/';
            return;
        }

        const type = currentTab === 'chatter' ? 'discussion' : 'incident,unsafe_area';
        const response = await fetch(`${API_BASE}/feed?page=${currentPage}&type=${type}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 429) {
                showError('Too many requests. Please wait a moment.');
                return;
            }
            throw new Error('Failed to load feed');
        }

        const data = await response.json();

        if (data.success) {
            renderFeed(data.data);
        } else {
            showError(data.message || 'Failed to load feed');
        }
    } catch (error) {
        console.error('Feed error:', error);
        showError('Unable to load feed. Please check your connection.');
    } finally {
        hideLoading();
    }
}

// ─── Render Feed ──────────────────────────────────────────────────────────────
function renderFeed(items) {
    feedContainer.innerHTML = '';

    if (items.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    items.forEach(item => {
        const card = currentTab === 'chatter' ? createChatterCard(item) : createIntelCard(item);
        feedContainer.appendChild(card);
    });
}

// ─── Create Chatter Card ──────────────────────────────────────────────────────
function createChatterCard(item) {
    const card = document.createElement('div');
    card.className = 'feed-card chatter-card';
    card.onclick = () => openDetail(item.reportId);

    card.innerHTML = `
        <div class="card-header">
            <div class="author-info">
                <div class="author-avatar">${item.author.name.charAt(0)}</div>
                <div class="author-details">
                    <span class="author-name">${escapeHtml(item.author.name)}</span>
                    ${item.author.verified ? '<span class="verified-badge">✓</span>' : ''}
                    <span class="timestamp">${formatTimestamp(item.timestamp)}</span>
                </div>
            </div>
        </div>

        <div class="card-content">
            <p class="card-text">${escapeHtml(item.description)}</p>
            ${item.images && item.images.length > 0 ? `
                <div class="card-images">
                    ${item.images.slice(0, 3).map(img => `
                        <img src="${img.url}" alt="Image" class="card-image">
                    `).join('')}
                </div>
            ` : ''}
        </div>

        <div class="card-footer">
            <button class="action-btn" onclick="event.stopPropagation(); likePost('${item.reportId}')">
                <span>${item.likes > 0 ? '❤️' : '🤍'}</span>
                <span>${item.likes}</span>
            </button>
            <button class="action-btn">
                <span>💬</span>
                <span>${item.commentsCount}</span>
            </button>
            <button class="action-btn">
                <span>👁️</span>
                <span>${item.viewCount}</span>
            </button>
        </div>
    `;

    return card;
}

// ─── Create Intel Card ────────────────────────────────────────────────────────
function createIntelCard(item) {
    const card = document.createElement('div');
    card.className = `feed-card intel-card severity-${item.severity}`;
    card.onclick = () => openDetail(item.reportId);

    const severityLabels = {
        low: 'Low Risk',
        medium: 'Medium Risk',
        high: 'High Risk',
        critical: 'Critical'
    };

    card.innerHTML = `
        <div class="card-header">
            <span class="severity-badge ${item.severity}">${severityLabels[item.severity]}</span>
            <span class="category-badge">${item.category.replace('_', ' ').toUpperCase()}</span>
        </div>

        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        
        <div class="card-location">
            <span>📍</span>
            <span>${escapeHtml(item.location.address)}</span>
        </div>

        ${item.images && item.images.length > 0 ? `
            <img src="${item.images[0].url}" alt="Report image" class="card-image">
        ` : ''}

        <div class="card-meta">
            <div class="meta-item">
                <span>👤</span>
                <span>${escapeHtml(item.author.name)}</span>
                ${item.author.verified ? '<span class="verified-badge">✓</span>' : ''}
            </div>
            <div class="meta-item">
                <span>🕐</span>
                <span>${formatTimestamp(item.timestamp)}</span>
            </div>
        </div>

        <div class="card-footer">
            <button class="action-btn">
                <span>👍</span>
                <span>${item.votes.total}</span>
            </button>
            <button class="action-btn">
                <span>💬</span>
                <span>${item.commentsCount}</span>
            </button>
            <button class="action-btn">
                <span>👁️</span>
                <span>${item.viewCount}</span>
            </button>
        </div>
    `;

    return card;
}

// ─── Open Create Modal ────────────────────────────────────────────────────────
function openCreateModal() {
    resetForm();
    
    if (currentTab === 'chatter') {
        // Chatter mode - simple message
        document.getElementById('modalTitle').textContent = 'New Message';
        document.getElementById('submitText').textContent = 'Post Message';
        document.getElementById('messageLabel').textContent = 'Message';
        document.getElementById('postMessage').placeholder = "What's on your mind?";
        
        // Hide intel-specific fields
        document.getElementById('postTypeSection').style.display = 'none';
        document.getElementById('titleGroup').style.display = 'none';
        document.getElementById('locationGroup').style.display = 'none';
        document.getElementById('metaGroup').style.display = 'none';
        
        selectedPostType = 'discussion';
    } else {
        // Intel mode - structured report
        document.getElementById('modalTitle').textContent = 'New Safety Report';
        document.getElementById('submitText').textContent = 'Submit Report';
        document.getElementById('messageLabel').textContent = 'Description';
        document.getElementById('postMessage').placeholder = 'Describe the situation in detail...';
        
        // Show intel-specific fields
        document.getElementById('postTypeSection').style.display = 'block';
        document.getElementById('titleGroup').style.display = 'block';
        document.getElementById('locationGroup').style.display = 'block';
        document.getElementById('metaGroup').style.display = 'block';
        
        selectedPostType = null;
    }
    
    createPostModal.classList.add('active');
}

function closeCreateModal() {
    createPostModal.classList.remove('active');
    resetForm();
}

function resetForm() {
    document.getElementById('postTitle').value = '';
    document.getElementById('postMessage').value = '';
    document.getElementById('imagePreviewGrid').innerHTML = '';
    document.getElementById('anonymousToggle').checked = false;
    document.getElementById('locationDisplay').style.display = 'none';
    selectedImages = [];
    currentLocation = null;
    selectedPostType = null;
    updateCharCount();
    
    document.querySelectorAll('.post-type-btn').forEach(btn => btn.classList.remove('selected'));
}

// ─── Post Type Selection ──────────────────────────────────────────────────────
function selectPostType(type) {
    selectedPostType = type;
    document.querySelectorAll('.post-type-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.type === type);
    });
}

// ─── Get Current Location ─────────────────────────────────────────────────────
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation not supported');
        return;
    }

    const btn = document.getElementById('getLocationBtn');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>Getting location...</span>';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${currentLocation.latitude}&lon=${currentLocation.longitude}&format=json`
                );
                const data = await response.json();

                currentLocation.address = data.display_name;
                currentLocation.city = data.address.city || data.address.town || '';
                currentLocation.country = data.address.country || '';

                document.getElementById('locationText').textContent = data.display_name;
                document.getElementById('locationDisplay').style.display = 'block';
                btn.innerHTML = '<span>✓</span><span>Location Set</span>';
            } catch (error) {
                console.error('Geocoding error:', error);
                document.getElementById('locationText').textContent = `Lat: ${currentLocation.latitude.toFixed(6)}, Lon: ${currentLocation.longitude.toFixed(6)}`;
                document.getElementById('locationDisplay').style.display = 'block';
                btn.innerHTML = '<span>✓</span><span>Location Set</span>';
            }
        },
        (error) => {
            console.error('Location error:', error);
            showError('Failed to get location');
            btn.disabled = false;
            btn.innerHTML = '<span>📍</span><span>Get Current Location</span>';
        }
    );
}

// ─── Handle Image Upload ──────────────────────────────────────────────────────
function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    const previewGrid = document.getElementById('imagePreviewGrid');

    files.forEach(file => {
        if (selectedImages.length >= 5) {
            showError('Maximum 5 images allowed');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showError('Image size must be less than 5MB');
            return;
        }

        selectedImages.push(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="image-remove-btn" onclick="removeImage(${selectedImages.length - 1})">✕</button>
            `;
            previewGrid.appendChild(preview);
        };
        reader.readAsDataURL(file);
    });
}

function removeImage(index) {
    selectedImages.splice(index, 1);
    const previewGrid = document.getElementById('imagePreviewGrid');
    previewGrid.innerHTML = '';
    selectedImages.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="image-remove-btn" onclick="removeImage(${i})">✕</button>
            `;
            previewGrid.appendChild(preview);
        };
        reader.readAsDataURL(file);
    });
}

// ─── Update Character Count ───────────────────────────────────────────────────
function updateCharCount() {
    const count = document.getElementById('postMessage').value.length;
    document.getElementById('charCount').textContent = count;
}

// ─── Submit Post ──────────────────────────────────────────────────────────────
async function submitPost() {
    const message = document.getElementById('postMessage').value.trim();
    const anonymous = document.getElementById('anonymousToggle').checked;

    // Validation
    if (!message || message.length < 10) {
        showError('Message must be at least 10 characters');
        return;
    }

    if (currentTab === 'intel') {
        // Intel report validation
        if (!selectedPostType) {
            showError('Please select a report type');
            return;
        }

        const title = document.getElementById('postTitle').value.trim();
        if (!title || title.length < 5) {
            showError('Title must be at least 5 characters');
            return;
        }

        if (!currentLocation) {
            showError('Please set a location');
            return;
        }
    }

    try {
        const formData = new FormData();
        formData.append('type', selectedPostType || 'discussion');
        formData.append('description', message);
        formData.append('anonymous', anonymous);

        if (currentTab === 'intel') {
            formData.append('title', document.getElementById('postTitle').value.trim());
            formData.append('category', document.getElementById('postCategory').value);
            formData.append('severity', document.getElementById('postSeverity').value);
            formData.append('latitude', currentLocation.latitude);
            formData.append('longitude', currentLocation.longitude);
            formData.append('address', currentLocation.address || '');
            formData.append('city', currentLocation.city || '');
            formData.append('country', currentLocation.country || '');
        }

        selectedImages.forEach(image => {
            formData.append('images', image);
        });

        const token = localStorage.getItem('snx_token');
        const response = await fetch(`${API_BASE}/report`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            closeCreateModal();
            showSuccess('Posted successfully!');
            loadFeed();
        } else {
            showError(data.message);
        }
    } catch (error) {
        console.error('Submit error:', error);
        showError('Failed to submit post');
    }
}

// ─── Open Detail ──────────────────────────────────────────────────────────────
async function openDetail(reportId) {
    try {
        const token = localStorage.getItem('snx_token');
        const response = await fetch(`${API_BASE}/report/${reportId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            renderDetail(data.data);
            detailModal.classList.add('active');
        }
    } catch (error) {
        console.error('Detail error:', error);
        showError('Failed to load details');
    }
}

function closeDetailModal() {
    detailModal.classList.remove('active');
}

function renderDetail(item) {
    const content = document.getElementById('detailContent');
    
    // Implementation depends on item type
    content.innerHTML = `
        <div class="detail-view">
            <h3>${escapeHtml(item.title || 'Message')}</h3>
            <p>${escapeHtml(item.description)}</p>
            <!-- Add more detail rendering here -->
        </div>
    `;
}

// ─── Like Post ────────────────────────────────────────────────────────────────
async function likePost(reportId) {
    try {
        const token = localStorage.getItem('snx_token');
        await fetch(`${API_BASE}/report/${reportId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadFeed();
    } catch (error) {
        console.error('Like error:', error);
    }
}

// ─── Utility Functions ────────────────────────────────────────────────────────
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading() {
    loadingIndicator.style.display = 'flex';
    feedContainer.style.display = 'none';
}

function hideLoading() {
    loadingIndicator.style.display = 'none';
    feedContainer.style.display = 'block';
}

function showError(message) {
    // Simple alert for now - can be replaced with better UI
    alert('Error: ' + message);
}

function showSuccess(message) {
    // Simple alert for now - can be replaced with better UI
    alert(message);
}
