'use strict';

/* Silent Room — Community Feed */

const API = '';
let currentPage = 1;
let selectedImages = [];
let isLoading = false;
let selectedPostType = 'general';
let currentLocation = null;
let currentFilter = 'all';
let currentSort = 'recent';
let currentTab = 'feed';
let currentPostForComments = null;
let socket = null;

// DOM Elements
const feedContainer = document.getElementById('feedContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');
const createPostBtn = document.getElementById('createPostBtn');
const createPostBtn2 = document.getElementById('createPostBtn2');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const postMessage = document.getElementById('postMessage');
const charCount = document.getElementById('charCount');
const imageUpload = document.getElementById('imageUpload');
const imagePreviewGrid = document.getElementById('imagePreviewGrid');
const anonymousToggle = document.getElementById('anonymousToggle');
const submitBtn = document.getElementById('submitBtn');
const getLocationBtn = document.getElementById('getLocationBtn');
const locationDisplay = document.getElementById('locationDisplay');
const removeLocationBtn = document.getElementById('removeLocationBtn');
const trendingSection = document.getElementById('trendingSection');
const trendingGrid = document.getElementById('trendingGrid');
const sortSelect = document.getElementById('sortSelect');
const myPostsContainer = document.getElementById('myPostsContainer');
const myPostsLoading = document.getElementById('myPostsLoading');
const myPostsEmpty = document.getElementById('myPostsEmpty');
const analyticsContainer = document.getElementById('analyticsContainer');
const commentsModal = document.getElementById('commentsModal');
const commentsClose = document.getElementById('commentsClose');
const commentsList = document.getElementById('commentsList');
const commentInput = document.getElementById('commentInput');
const submitComment = document.getElementById('submitComment');
const commentsPostPreview = document.getElementById('commentsPostPreview');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Wait for Socket.IO to load before initializing
    if (typeof io !== 'undefined') {
        initSocket();
    } else {
        console.warn('Socket.IO not loaded yet, waiting...');
        // Wait and retry
        setTimeout(() => {
            if (typeof io !== 'undefined') {
                initSocket();
            } else {
                console.error('Socket.IO failed to load. Real-time features disabled.');
                showToast('Real-time features unavailable. Please refresh the page.', 'error');
            }
        }, 2000);
    }
    
    loadFeed();
    loadTrending();
    initEventListeners();
    populateNav();
});

// Initialize Socket.IO
function initSocket() {
    if (typeof io === 'undefined') {
        console.error('Socket.IO library not loaded');
        return;
    }
    
    socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
        console.log('🔌 Connected to real-time server');
        socket.emit('join:silentroom');
    });

    socket.on('disconnect', () => {
        console.log('🔌 Disconnected from real-time server');
    });

    socket.on('reconnect', () => {
        console.log('🔌 Reconnected to real-time server');
        socket.emit('join:silentroom');
    });

    // Real-time event listeners
    socket.on('post:created', handleNewPost);
    socket.on('post:updated', handlePostUpdated);
    socket.on('post:deleted', handlePostDeleted);
    socket.on('post:liked', handlePostLiked);
    socket.on('comment:added', handleCommentAdded);
}

// Handle new post in real-time
function handleNewPost(post) {
    // Only add to feed if we're on the feed tab and not filtering
    if (currentTab !== 'feed') return;
    
    // Check if post matches current filter
    if (currentFilter !== 'all' && post.postType !== currentFilter) return;

    // Check if post already exists
    const existingPost = document.querySelector(`[data-post-id="${post.id}"]`);
    if (existingPost) return;

    // Add post to top of feed
    const card = createPostCard(post);
    card.style.animation = 'slideInFromTop 0.5s ease';
    
    if (feedContainer.firstChild) {
        feedContainer.insertBefore(card, feedContainer.firstChild);
    } else {
        feedContainer.appendChild(card);
        emptyState.style.display = 'none';
    }

    // Show notification
    showToast('📢 New post added!', 2000);
}

// Handle post update in real-time
function handlePostUpdated({ postId, post }) {
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;

    // Replace the post card with updated content
    const newCard = createPostCard(post);
    newCard.style.animation = 'pulse 0.5s ease';
    postCard.replaceWith(newCard);
}

// Handle post deletion in real-time
function handlePostDeleted({ postId }) {
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;

    // Animate and remove
    postCard.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
        postCard.remove();
        
        // Check if feed is empty
        if (feedContainer.children.length === 0) {
            emptyState.style.display = 'flex';
        }
    }, 300);
}

// Handle like update in real-time
function handlePostLiked({ postId, liked, likes, userId }) {
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;

    // Update like count
    const likeBtn = postCard.querySelector('.sr-action-btn:first-child');
    const likeCount = likeBtn.querySelector('.like-count');
    likeCount.textContent = likes;

    // Only update button state if it's not the current user's action
    const currentUser = JSON.parse(localStorage.getItem('snx_user') || '{}');
    const currentUserId = currentUser._id || currentUser.id;
    
    if (userId !== currentUserId) {
        // Just update the count, don't change the button state for other users
        return;
    }

    // Update button state for current user
    if (liked) {
        likeBtn.classList.add('sr-action-btn--liked');
        likeBtn.querySelector('svg path').setAttribute('fill', 'currentColor');
    } else {
        likeBtn.classList.remove('sr-action-btn--liked');
        likeBtn.querySelector('svg path').setAttribute('fill', 'none');
    }
}

// Handle new comment in real-time
function handleCommentAdded({ postId, comment }) {
    // Update comment count in feed
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (postCard) {
        const commentBtn = postCard.querySelector('.sr-action-btn:nth-child(2)');
        const commentCount = commentBtn.querySelector('span');
        commentCount.textContent = parseInt(commentCount.textContent) + 1;
    }

    // If comments modal is open for this post, add the comment
    if (currentPostForComments === postId && !commentsModal.hidden) {
        const commentsList = document.getElementById('commentsList');
        
        // Check if comment already exists
        const existingComment = Array.from(commentsList.children).find(
            el => el.querySelector('.sr-comment-text')?.textContent === comment.text
        );
        if (existingComment) return;

        // Add new comment with animation
        const commentEl = document.createElement('div');
        commentEl.className = 'sr-comment';
        commentEl.style.animation = 'slideInFromTop 0.3s ease';
        commentEl.innerHTML = `
            <div class="sr-comment-avatar">${comment.userName[0].toUpperCase()}</div>
            <div class="sr-comment-content">
                <div class="sr-comment-header">
                    <span class="sr-comment-author">${escapeHtml(comment.userName)}</span>
                    <span class="sr-comment-time">Just now</span>
                </div>
                <div class="sr-comment-text">${escapeHtml(comment.text)}</div>
            </div>
        `;

        if (commentsList.firstChild && !commentsList.firstChild.classList.contains('sr-comments-empty')) {
            commentsList.insertBefore(commentEl, commentsList.firstChild);
        } else {
            commentsList.innerHTML = '';
            commentsList.appendChild(commentEl);
        }
    }
}

// Check Authentication
function checkAuth() {
    const token = localStorage.getItem('snx_token');
    if (!token) {
        window.location.replace('/onboarding.html');
    }
}

// Populate Nav
function populateNav() {
    const user = JSON.parse(localStorage.getItem('snx_user') || '{}');
    const initial = (user.name || 'U')[0].toUpperCase();
    const el = document.getElementById('navAvatar');
    if (el) el.textContent = initial;
}

// Event Listeners
function initEventListeners() {
    createPostBtn.addEventListener('click', openModal);
    createPostBtn2.addEventListener('click', openModal);
    document.getElementById('createComplaintBtn').addEventListener('click', openComplaintModal);
    
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    postMessage.addEventListener('input', updateCharCount);
    imageUpload.addEventListener('change', handleImageUpload);
    submitBtn.addEventListener('click', submitPost);
    getLocationBtn.addEventListener('click', getCurrentLocation);
    removeLocationBtn.addEventListener('click', removeLocation);

    // Comments modal
    commentsClose.addEventListener('click', closeCommentsModal);
    commentsModal.addEventListener('click', (e) => {
        if (e.target === commentsModal) closeCommentsModal();
    });
    submitComment.addEventListener('click', addComment);

    // Tab switching
    document.querySelectorAll('.sr-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });

    // Post type buttons
    document.querySelectorAll('.sr-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sr-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedPostType = btn.dataset.type;
            
            // Show/hide private complaint option for complaint and harassment types
            const privateComplaintGroup = document.getElementById('privateComplaintGroup');
            if (selectedPostType === 'complaint' || selectedPostType === 'harassment') {
                privateComplaintGroup.style.display = 'block';
            } else {
                privateComplaintGroup.style.display = 'none';
                document.getElementById('privateComplaintToggle').checked = false;
            }
        });
    });

    // Filter buttons
    document.querySelectorAll('.sr-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sr-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.type;
            currentPage = 1;
            loadFeed();
        });
    });

    // Sort select
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        currentPage = 1;
        loadFeed();
    });
}

// Load Feed
async function loadFeed() {
    if (isLoading) return;
    isLoading = true;

    try {
        showLoading();

        const token = localStorage.getItem('snx_token');
        const url = `${API}/api/silentroom/feed?page=${currentPage}&limit=20&type=${currentFilter}&sort=${currentSort}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem('snx_token');
                window.location.replace('/onboarding.html');
                return;
            }
            throw new Error('Failed to load feed');
        }

        const data = await res.json();

        if (data.success) {
            renderFeed(data.data);
        } else {
            showToast('Failed to load feed');
        }
    } catch (error) {
        console.error('Feed error:', error);
        showToast('Network error. Please check your connection.');
    } finally {
        hideLoading();
        isLoading = false;
    }
}

// Load Trending Posts
async function loadTrending() {
    try {
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/trending?limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data = await res.json();

        if (data.success && data.data.length > 0) {
            renderTrending(data.data);
            trendingSection.style.display = 'block';
        }
    } catch (error) {
        console.error('Trending error:', error);
    }
}

// Render Trending
function renderTrending(posts) {
    trendingGrid.innerHTML = '';

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'sr-trending-card';
        card.onclick = () => viewPost(post.id);

        const initial = post.userName ? post.userName[0].toUpperCase() : 'A';
        const engagement = post.likes + post.comments + post.views;

        card.innerHTML = `
            <div class="sr-trending-card__header">
                <div class="sr-post__avatar sr-post__avatar--sm">${initial}</div>
                <div>
                    <div class="sr-trending-card__author">${escapeHtml(post.userName)}</div>
                    <div class="sr-trending-card__time">${formatTimeAgo(post.createdAt)}</div>
                </div>
            </div>
            <div class="sr-trending-card__message">${escapeHtml(post.message.substring(0, 100))}${post.message.length > 100 ? '...' : ''}</div>
            <div class="sr-trending-card__stats">
                <span>❤️ ${post.likes}</span>
                <span>💬 ${post.comments}</span>
                <span>👁️ ${post.views}</span>
            </div>
        `;

        trendingGrid.appendChild(card);
    });
}

// Render Feed
function renderFeed(posts) {
    feedContainer.innerHTML = '';

    if (posts.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    posts.forEach((post, index) => {
        const card = createPostCard(post);
        card.style.animationDelay = `${index * 0.05}s`;
        feedContainer.appendChild(card);
    });
}

// Create Post Card
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'sr-post';
    card.dataset.postId = post.id;

    const initial = post.userName ? post.userName[0].toUpperCase() : 'A';
    const timeAgo = formatTimeAgo(post.createdAt);
    const currentUser = JSON.parse(localStorage.getItem('snx_user') || '{}');
    
    // Handle both 'id' and '_id' for compatibility
    const currentUserId = currentUser._id || currentUser.id;
    const isOwner = currentUserId === post.userId;

    const typeLabels = {
        general: 'General',
        theft: 'Theft Alert',
        safety_alert: 'Safety Alert',
        lost_found: 'Lost & Found',
        suspicious: 'Suspicious Activity'
    };

    const typeIcons = {
        general: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5"/>',
        theft: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.5"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        safety_alert: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.5"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        lost_found: '<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        suspicious: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    };

    card.innerHTML = `
        ${post.postType !== 'general' ? `
            <div class="sr-post__type-badge sr-post__type-badge--${post.postType}">
                <svg viewBox="0 0 24 24" fill="none">${typeIcons[post.postType]}</svg>
                ${typeLabels[post.postType]}
            </div>
        ` : ''}

        ${post.adminResponse && post.adminResponse.includes('⚠️ WARNING') ? `
            <div class="sr-post__admin-warning">
                <div class="sr-post__admin-warning-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>⚠️ FLAGGED BY ADMIN</span>
                </div>
                <div class="sr-post__admin-warning-text">${escapeHtml(post.adminResponse)}</div>
            </div>
        ` : ''}

        <div class="sr-post__header">
            <div class="sr-post__avatar">${initial}</div>
            <div class="sr-post__info">
                <div class="sr-post__author">
                    ${escapeHtml(post.userName)}
                    ${post.safeNexID && !post.anonymous ? `
                        <span class="sr-post__verified">
                            <svg viewBox="0 0 16 16" fill="none">
                                <circle cx="8" cy="8" r="7" stroke="#22C55E" stroke-width="1.5"/>
                                <path d="M5 8l2 2 4-4" stroke="#22C55E" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </span>
                    ` : ''}
                </div>
                <div class="sr-post__time">${timeAgo}</div>
            </div>
            ${isOwner ? `
                <div class="sr-post__menu">
                    <button class="sr-menu-btn" onclick="togglePostMenu('${post.id}')">
                        <svg viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                            <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                        </svg>
                    </button>
                    <div class="sr-menu-dropdown" id="menu-${post.id}" style="display:none;">
                        <button onclick="editPost('${post.id}')">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Edit Post
                        </button>
                        <button onclick="deletePost('${post.id}')" class="sr-menu-delete">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                            Delete Post
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>

        ${post.location ? `
            <div class="sr-post__location" onclick="openMap(${post.location.latitude}, ${post.location.longitude})">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <span class="sr-post__location-text">${escapeHtml(post.location.address)}</span>
            </div>
        ` : ''}

        <div class="sr-post__message">${escapeHtml(post.message)}</div>

        ${post.images && post.images.length > 0 ? `
            <div class="sr-post__images">
                ${post.images.map((img, idx) => `
                    <img src="data:${img.mimeType};base64,${img.data}" alt="Post image" class="sr-post__image" onclick="viewImage('data:${img.mimeType};base64,${img.data}')">
                `).join('')}
            </div>
        ` : ''}

        <div class="sr-post__actions">
            <button class="sr-action-btn ${post.userLiked ? 'sr-action-btn--liked' : ''}" onclick="toggleLike('${post.id}', this)">
                <svg viewBox="0 0 24 24" fill="${post.userLiked ? 'currentColor' : 'none'}">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="like-count">${post.likes}</span>
            </button>
            <button class="sr-action-btn" onclick="showComments('${post.id}')">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <span>${post.comments}</span>
            </button>
            <button class="sr-action-btn">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <span>${post.views}</span>
            </button>
            ${!isOwner ? `
            <button class="sr-action-btn sr-action-btn--report" onclick="reportPost('${post.id}')" title="Report inappropriate content">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M3 3v18l7-3 8 3V3l-8 3-7-3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Report</span>
            </button>
            ` : ''}
        </div>
    `;

    return card;
}

// Toggle Like
async function toggleLike(postId, btn) {
    try {
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await res.json();

        if (data.success) {
            const countEl = btn.querySelector('.like-count');
            countEl.textContent = data.data.likes;

            if (data.data.liked) {
                btn.classList.add('sr-action-btn--liked');
                btn.querySelector('svg path').setAttribute('fill', 'currentColor');
            } else {
                btn.classList.remove('sr-action-btn--liked');
                btn.querySelector('svg path').setAttribute('fill', 'none');
            }
        }
    } catch (error) {
        console.error('Like error:', error);
    }
}

// Show Comments (placeholder)
function showComments(postId) {
    showToast('Comments feature coming soon!');
}

// View Image
function viewImage(url) {
    window.open(url, '_blank');
}

// Open Map
function openMap(lat, lng) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

// Get Current Location
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported by your browser');
        return;
    }

    getLocationBtn.disabled = true;
    document.getElementById('locationBtnText').textContent = 'Getting location...';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            };

            // Reverse geocode
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${currentLocation.latitude}&lon=${currentLocation.longitude}&format=json`
                );
                const data = await response.json();
                currentLocation.address = data.display_name;
            } catch (error) {
                console.error('Geocoding error:', error);
                currentLocation.address = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
            }

            // Show location display
            document.getElementById('locationAddress').textContent = currentLocation.address;
            document.getElementById('locationCoords').textContent = 
                `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
            locationDisplay.style.display = 'flex';
            getLocationBtn.style.display = 'none';
        },
        (error) => {
            console.error('Location error:', error);
            showToast('Failed to get location. Please enable location services.');
            getLocationBtn.disabled = false;
            document.getElementById('locationBtnText').textContent = 'Add Current Location';
        }
    );
}

// Remove Location
function removeLocation() {
    currentLocation = null;
    locationDisplay.style.display = 'none';
    getLocationBtn.style.display = 'flex';
    getLocationBtn.disabled = false;
    document.getElementById('locationBtnText').textContent = 'Add Current Location';
}

// Open Modal
function openModal() {
    modalOverlay.hidden = false;
    requestAnimationFrame(() => modalOverlay.classList.add('modal--open'));
    postMessage.focus();
}

// Close Modal
function closeModal() {
    modalOverlay.classList.remove('modal--open');
    setTimeout(() => {
        modalOverlay.hidden = true;
        resetForm();
    }, 200);
}

// Reset Form
function resetForm() {
    postMessage.value = '';
    anonymousToggle.checked = false;
    selectedImages = [];
    imagePreviewGrid.innerHTML = '';
    selectedPostType = 'general';
    currentLocation = null;
    locationDisplay.style.display = 'none';
    getLocationBtn.style.display = 'flex';
    getLocationBtn.disabled = false;
    document.getElementById('locationBtnText').textContent = 'Add Current Location';
    document.querySelectorAll('.sr-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'general');
    });
    updateCharCount();
}

// Update Character Count
function updateCharCount() {
    const count = postMessage.value.length;
    charCount.textContent = count;

    if (count > 4500) {
        charCount.style.color = 'var(--yellow)';
    } else if (count > 4900) {
        charCount.style.color = 'var(--red)';
    } else {
        charCount.style.color = 'var(--text-dim)';
    }
}

// Handle Image Upload
function handleImageUpload(e) {
    const files = Array.from(e.target.files);

    files.forEach(file => {
        if (selectedImages.length >= 5) {
            showToast('Maximum 5 images allowed');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size must be less than 5MB');
            return;
        }

        selectedImages.push(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'sr-image-preview';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="sr-image-remove" onclick="removeImage(${selectedImages.length - 1})">✕</button>
            `;
            imagePreviewGrid.appendChild(preview);
        };
        reader.readAsDataURL(file);
    });

    // Reset input
    imageUpload.value = '';
}

// Remove Image
function removeImage(index) {
    selectedImages.splice(index, 1);
    imagePreviewGrid.innerHTML = '';

    selectedImages.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'sr-image-preview';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="sr-image-remove" onclick="removeImage(${i})">✕</button>
            `;
            imagePreviewGrid.appendChild(preview);
        };
        reader.readAsDataURL(file);
    });
}

// Submit Post
async function submitPost() {
    const message = postMessage.value.trim();
    const anonymous = anonymousToggle.checked;
    const privateToggle = document.getElementById('privateComplaintToggle');
    
    // Only allow isPrivate for complaint/harassment types
    const isPrivate = (selectedPostType === 'complaint' || selectedPostType === 'harassment') && privateToggle.checked;

    // Validation
    if (!message) {
        showToast('Please write a message');
        return;
    }

    if (message.length > 5000) {
        showToast('Message too long (max 5000 characters)');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = isPrivate ? 'Submitting Private Complaint...' : 'Posting...';

        const formData = new FormData();
        formData.append('message', message);
        formData.append('postType', selectedPostType);
        formData.append('anonymous', anonymous);
        formData.append('isPrivate', isPrivate);

        // Add location if available
        if (currentLocation) {
            formData.append('latitude', currentLocation.latitude);
            formData.append('longitude', currentLocation.longitude);
            formData.append('address', currentLocation.address);
        }

        // Add images
        selectedImages.forEach(image => {
            formData.append('images', image);
        });

        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });

        const data = await res.json();

        if (data.success) {
            if (isPrivate) {
                showToast('🔒 Private complaint submitted to admin!');
            } else {
                showToast('✅ Post created successfully!');
            }
            closeModal();
            currentPage = 1;
            loadFeed();
        } else {
            showToast(data.message || 'Failed to create post');
        }
    } catch (error) {
        console.error('Submit error:', error);
        showToast('Failed to create post');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Post to Community
        `;
    }
}

// Show Loading
function showLoading() {
    loadingIndicator.style.display = 'flex';
    feedContainer.style.display = 'none';
}

// Hide Loading
function hideLoading() {
    loadingIndicator.style.display = 'none';
    feedContainer.style.display = 'flex';
}

// Show Toast
function showToast(msg, duration = 2600) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
}

// Format Time Ago
function formatTimeAgo(iso) {
    const date = new Date(iso);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toggle Post Menu
function togglePostMenu(postId) {
    const menu = document.getElementById(`menu-${postId}`);
    const allMenus = document.querySelectorAll('.sr-menu-dropdown');
    
    // Close all other menus
    allMenus.forEach(m => {
        if (m.id !== `menu-${postId}`) {
            m.style.display = 'none';
        }
    });
    
    // Toggle current menu
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.sr-post__menu')) {
        document.querySelectorAll('.sr-menu-dropdown').forEach(m => {
            m.style.display = 'none';
        });
    }
});

// Edit Post
let editingPostId = null;

async function editPost(postId) {
    try {
        // Close menu
        document.getElementById(`menu-${postId}`).style.display = 'none';
        
        // Get post data
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post/${postId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        
        const data = await res.json();
        
        if (!data.success) {
            showToast('Failed to load post');
            return;
        }
        
        const post = data.data;
        
        // Populate form with existing data
        editingPostId = postId;
        postMessage.value = post.message;
        selectedPostType = post.postType || 'general';
        
        // Set post type button
        document.querySelectorAll('.sr-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === selectedPostType);
        });
        
        // Set location if exists
        if (post.location) {
            currentLocation = {
                latitude: post.location.latitude,
                longitude: post.location.longitude,
                address: post.location.address,
            };
            document.getElementById('locationAddress').textContent = currentLocation.address;
            document.getElementById('locationCoords').textContent = 
                `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
            locationDisplay.style.display = 'flex';
            getLocationBtn.style.display = 'none';
        }
        
        // Update modal title and button
        document.querySelector('.sr-modal__header h2').textContent = 'Edit Post';
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Update Post
        `;
        
        updateCharCount();
        openModal();
        
    } catch (error) {
        console.error('Edit error:', error);
        showToast('Failed to load post for editing');
    }
}

// Update Submit Post to handle editing
const originalSubmitPost = submitPost;
submitPost = async function() {
    if (editingPostId) {
        await updatePost();
    } else {
        await originalSubmitPost();
    }
};

// Update Post
async function updatePost() {
    const message = postMessage.value.trim();

    // Validation
    if (!message) {
        showToast('Please write a message');
        return;
    }

    if (message.length > 5000) {
        showToast('Message too long (max 5000 characters)');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        const formData = new FormData();
        formData.append('message', message);
        formData.append('postType', selectedPostType);

        // Add location if available
        if (currentLocation) {
            formData.append('latitude', currentLocation.latitude);
            formData.append('longitude', currentLocation.longitude);
            formData.append('address', currentLocation.address);
        } else {
            formData.append('removeLocation', 'true');
        }

        // Add new images if any
        selectedImages.forEach(image => {
            formData.append('images', image);
        });

        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post/${editingPostId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });

        const data = await res.json();

        if (data.success) {
            showToast('✅ Post updated successfully!');
            editingPostId = null;
            closeModal();
            currentPage = 1;
            loadFeed();
        } else {
            showToast(data.message || 'Failed to update post');
        }
    } catch (error) {
        console.error('Update error:', error);
        showToast('Failed to update post');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Post to Community
        `;
    }
}

// Delete Post
async function deletePost(postId) {
    // Close menu
    document.getElementById(`menu-${postId}`).style.display = 'none';
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }

    try {
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await res.json();

        if (data.success) {
            showToast('✅ Post deleted successfully');
            
            // Remove post from DOM with animation
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            if (postCard) {
                postCard.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    postCard.remove();
                    
                    // Check if feed is empty
                    if (feedContainer.children.length === 0) {
                        emptyState.style.display = 'flex';
                    }
                }, 300);
            }
        } else {
            showToast(data.message || 'Failed to delete post');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete post');
    }
}

// Override reset form to handle edit mode
const originalResetForm = resetForm;
resetForm = function() {
    editingPostId = null;
    document.querySelector('.sr-modal__header h2').textContent = 'New Post';
    submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Post to Community
    `;
    originalResetForm();
};

// Open Map
function openMap(lat, lng) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

// View Image
function viewImage(url) {
    window.open(url, '_blank');
}

// Show Comments (placeholder)
function showComments(postId) {
    showToast('Comments feature coming soon!');
}


// View Post (for trending cards)
function viewPost(postId) {
    // Scroll to post in feed or load it
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (postCard) {
        postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        postCard.style.animation = 'pulse 0.5s ease';
    } else {
        showToast('Post not in current view');
    }
}


// Tab Switching
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.sr-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.sr-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'feed') {
        document.getElementById('feedTab').classList.add('active');
    } else if (tabName === 'myposts') {
        document.getElementById('myPostsTab').classList.add('active');
        loadMyPosts();
    } else if (tabName === 'complaints') {
        document.getElementById('complaintsTab').classList.add('active');
        loadComplaints();
    } else if (tabName === 'analytics') {
        document.getElementById('analyticsTab').classList.add('active');
        loadAnalytics();
    }
}

// Load My Posts
async function loadMyPosts() {
    try {
        myPostsLoading.style.display = 'flex';
        myPostsContainer.innerHTML = '';
        myPostsEmpty.style.display = 'none';

        const currentUser = JSON.parse(localStorage.getItem('snx_user') || '{}');
        const userId = currentUser._id || currentUser.id;

        const token = localStorage.getItem('snx_token');
        // Load only public posts (showPrivate=false is default, excludes complaints)
        const res = await fetch(`${API}/api/silentroom/feed?userId=${userId}&limit=100&showPrivate=false`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to load posts');

        const data = await res.json();

        if (data.success && data.data.length > 0) {
            data.data.forEach((post, index) => {
                const card = createPostCard(post);
                card.style.animationDelay = `${index * 0.05}s`;
                myPostsContainer.appendChild(card);
            });
        } else {
            myPostsEmpty.style.display = 'flex';
        }
    } catch (error) {
        console.error('My posts error:', error);
        showToast('Failed to load your posts');
    } finally {
        myPostsLoading.style.display = 'none';
    }
}

// Load Analytics
async function loadAnalytics() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('snx_user') || '{}');
        const userId = currentUser._id || currentUser.id;

        const token = localStorage.getItem('snx_token');
        // Load only public posts for analytics (exclude private complaints)
        const res = await fetch(`${API}/api/silentroom/feed?userId=${userId}&limit=100&showPrivate=false`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to load analytics');

        const data = await res.json();

        if (data.success) {
            renderAnalytics(data.data);
        }
    } catch (error) {
        console.error('Analytics error:', error);
        showToast('Failed to load analytics');
    }
}

// Render Analytics
function renderAnalytics(posts) {
    if (posts.length === 0) {
        analyticsContainer.innerHTML = `
            <div class="sr-empty">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>No analytics yet</h3>
                <p>Create posts to see your analytics</p>
            </div>
        `;
        return;
    }

    // Calculate totals
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
    const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
    const avgEngagement = ((totalLikes + totalComments) / totalPosts).toFixed(1);

    // Group by type
    const byType = {};
    posts.forEach(post => {
        const type = post.postType || 'general';
        if (!byType[type]) {
            byType[type] = { count: 0, likes: 0, comments: 0, views: 0 };
        }
        byType[type].count++;
        byType[type].likes += post.likes;
        byType[type].comments += post.comments;
        byType[type].views += post.views;
    });

    // Find top posts
    const topPosts = [...posts]
        .sort((a, b) => (b.likes + b.comments + b.views) - (a.likes + a.comments + a.views))
        .slice(0, 5);

    analyticsContainer.innerHTML = `
        <!-- Overview Stats -->
        <div class="sr-analytics-grid">
            <div class="sr-stat-card">
                <div class="sr-stat-icon" style="background: linear-gradient(135deg, #2563EB 0%, #06B6D4 100%);">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div class="sr-stat-info">
                    <div class="sr-stat-value">${totalPosts}</div>
                    <div class="sr-stat-label">Total Posts</div>
                </div>
            </div>

            <div class="sr-stat-card">
                <div class="sr-stat-icon" style="background: linear-gradient(135deg, #EF4444 0%, #F59E0B 100%);">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div class="sr-stat-info">
                    <div class="sr-stat-value">${totalLikes}</div>
                    <div class="sr-stat-label">Total Likes</div>
                </div>
            </div>

            <div class="sr-stat-card">
                <div class="sr-stat-icon" style="background: linear-gradient(135deg, #10B981 0%, #06B6D4 100%);">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div class="sr-stat-info">
                    <div class="sr-stat-value">${totalComments}</div>
                    <div class="sr-stat-label">Total Comments</div>
                </div>
            </div>

            <div class="sr-stat-card">
                <div class="sr-stat-icon" style="background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div class="sr-stat-info">
                    <div class="sr-stat-value">${totalViews}</div>
                    <div class="sr-stat-label">Total Views</div>
                </div>
            </div>
        </div>

        <!-- By Type -->
        <div class="sr-analytics-section">
            <h3 class="sr-analytics-title">Posts by Type</h3>
            <div class="sr-type-stats">
                ${Object.entries(byType).map(([type, stats]) => `
                    <div class="sr-type-stat">
                        <div class="sr-type-stat-header">
                            <span class="sr-type-stat-name">${type.replace('_', ' ').toUpperCase()}</span>
                            <span class="sr-type-stat-count">${stats.count} posts</span>
                        </div>
                        <div class="sr-type-stat-metrics">
                            <span>❤️ ${stats.likes}</span>
                            <span>💬 ${stats.comments}</span>
                            <span>👁️ ${stats.views}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Top Posts -->
        <div class="sr-analytics-section">
            <h3 class="sr-analytics-title">Top Performing Posts</h3>
            <div class="sr-top-posts">
                ${topPosts.map((post, index) => `
                    <div class="sr-top-post" onclick="viewPost('${post.id}')">
                        <div class="sr-top-post-rank">#${index + 1}</div>
                        <div class="sr-top-post-content">
                            <div class="sr-top-post-message">${escapeHtml(post.message.substring(0, 80))}${post.message.length > 80 ? '...' : ''}</div>
                            <div class="sr-top-post-stats">
                                <span>❤️ ${post.likes}</span>
                                <span>💬 ${post.comments}</span>
                                <span>👁️ ${post.views}</span>
                                <span class="sr-top-post-engagement">Score: ${post.likes * 3 + post.comments * 2 + post.views}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Report Post
async function reportPost(postId) {
    if (!confirm('Report this post for inappropriate content? The admin will review it.')) {
        return;
    }

    try {
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post/${postId}/report`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await res.json();

        if (data.success) {
            showToast('✅ Post reported to admin');
        } else {
            showToast(data.message || 'Failed to report post');
        }
    } catch (error) {
        console.error('Report error:', error);
        showToast('Failed to report post');
    }
}

// Show Comments
async function showComments(postId) {
    try {
        currentPostForComments = postId;
        
        // Load post details
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post/${postId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to load post');

        const data = await res.json();

        if (data.success) {
            const post = data.data;
            
            // Show post preview
            commentsPostPreview.innerHTML = `
                <div class="sr-comments-post-header">
                    <div class="sr-post__avatar">${post.userName[0].toUpperCase()}</div>
                    <div>
                        <div class="sr-post__author">${escapeHtml(post.userName)}</div>
                        <div class="sr-post__time">${formatTimeAgo(post.createdAt)}</div>
                    </div>
                </div>
                <div class="sr-comments-post-message">${escapeHtml(post.message)}</div>
            `;

            // Load comments
            await loadComments(postId);

            // Show modal
            commentsModal.hidden = false;
            requestAnimationFrame(() => commentsModal.classList.add('modal--open'));
            commentInput.focus();
        }
    } catch (error) {
        console.error('Show comments error:', error);
        showToast('Failed to load comments');
    }
}

// Load Comments
async function loadComments(postId) {
    try {
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post/${postId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to load comments');

        const data = await res.json();

        if (data.success && data.data.comments) {
            renderComments(data.data.comments);
        } else {
            commentsList.innerHTML = '<div class="sr-comments-empty">No comments yet. Be the first to comment!</div>';
        }
    } catch (error) {
        console.error('Load comments error:', error);
        commentsList.innerHTML = '<div class="sr-comments-empty">Failed to load comments</div>';
    }
}

// Render Comments
function renderComments(comments) {
    if (comments.length === 0) {
        commentsList.innerHTML = '<div class="sr-comments-empty">No comments yet. Be the first to comment!</div>';
        return;
    }

    commentsList.innerHTML = comments.map(comment => `
        <div class="sr-comment">
            <div class="sr-comment-avatar">${comment.userName[0].toUpperCase()}</div>
            <div class="sr-comment-content">
                <div class="sr-comment-header">
                    <span class="sr-comment-author">${escapeHtml(comment.userName)}</span>
                    <span class="sr-comment-time">${formatTimeAgo(comment.createdAt)}</span>
                </div>
                <div class="sr-comment-text">${escapeHtml(comment.text)}</div>
            </div>
        </div>
    `).join('');
}

// Add Comment
async function addComment() {
    const text = commentInput.value.trim();

    if (!text) {
        showToast('Please write a comment');
        return;
    }

    if (text.length > 1000) {
        showToast('Comment too long (max 1000 characters)');
        return;
    }

    try {
        submitComment.disabled = true;
        submitComment.textContent = 'Posting...';

        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post/${currentPostForComments}/comment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        const data = await res.json();

        if (data.success) {
            showToast('✅ Comment posted!');
            commentInput.value = '';
            await loadComments(currentPostForComments);
            
            // Update comment count in feed
            const postCard = document.querySelector(`[data-post-id="${currentPostForComments}"]`);
            if (postCard) {
                const commentCountEl = postCard.querySelector('.sr-action-btn:nth-child(2) span');
                if (commentCountEl) {
                    commentCountEl.textContent = parseInt(commentCountEl.textContent) + 1;
                }
            }
        } else {
            showToast(data.message || 'Failed to post comment');
        }
    } catch (error) {
        console.error('Add comment error:', error);
        showToast('Failed to post comment');
    } finally {
        submitComment.disabled = false;
        submitComment.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Post Comment
        `;
    }
}

// Close Comments Modal
function closeCommentsModal() {
    commentsModal.classList.remove('modal--open');
    setTimeout(() => {
        commentsModal.hidden = true;
        currentPostForComments = null;
        commentInput.value = '';
    }, 200);
}


// ═══════════════════════════════════════════════════════════════
// COMPLAINTS SECTION
// ═══════════════════════════════════════════════════════════════

let selectedComplaintType = 'harassment';
let complaintLocation = null;
let complaintImages = [];

// Open Complaint Modal
function openComplaintModal() {
    const modal = document.getElementById('complaintModal');
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    
    // Reset form
    document.getElementById('complaintMessage').value = '';
    document.getElementById('complaintCharCount').textContent = '0';
    document.getElementById('complaintAnonymousToggle').checked = false;
    complaintLocation = null;
    complaintImages = [];
    document.getElementById('complaintLocationDisplay').style.display = 'none';
    document.getElementById('complaintImagePreviewGrid').innerHTML = '';
    
    // Set first type as active
    document.querySelectorAll('[data-complaint-type]').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-complaint-type="harassment"]').classList.add('active');
    selectedComplaintType = 'harassment';
}

// Close Complaint Modal
function closeComplaintModal() {
    const modal = document.getElementById('complaintModal');
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
}

// Initialize Complaint Modal Event Listeners
document.getElementById('complaintModalClose').addEventListener('click', closeComplaintModal);
document.getElementById('complaintModal').addEventListener('click', (e) => {
    if (e.target.id === 'complaintModal') closeComplaintModal();
});

// Complaint type selection
document.querySelectorAll('[data-complaint-type]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-complaint-type]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedComplaintType = btn.dataset.complaintType;
    });
});

// Complaint message character count
document.getElementById('complaintMessage').addEventListener('input', (e) => {
    document.getElementById('complaintCharCount').textContent = e.target.value.length;
});

// Complaint location
document.getElementById('getComplaintLocationBtn').addEventListener('click', async () => {
    const btn = document.getElementById('getComplaintLocationBtn');
    const btnText = document.getElementById('complaintLocationBtnText');
    
    btnText.textContent = 'Getting location...';
    btn.disabled = true;
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        const { latitude, longitude } = position.coords;
        
        // Reverse geocode
        const address = await reverseGeocode(latitude, longitude);
        
        complaintLocation = { latitude, longitude, address };
        
        document.getElementById('complaintLocationAddress').textContent = address;
        document.getElementById('complaintLocationCoords').textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        document.getElementById('complaintLocationDisplay').style.display = 'flex';
        btn.style.display = 'none';
    } catch (error) {
        showToast('Could not get location');
        btnText.textContent = 'Add Location';
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('removeComplaintLocationBtn').addEventListener('click', () => {
    complaintLocation = null;
    document.getElementById('complaintLocationDisplay').style.display = 'none';
    document.getElementById('getComplaintLocationBtn').style.display = 'flex';
});

// Complaint images
document.getElementById('complaintImageUpload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    
    if (complaintImages.length + files.length > 5) {
        showToast('Maximum 5 images allowed');
        return;
    }
    
    complaintImages = [...complaintImages, ...files];
    renderComplaintImagePreviews();
});

function renderComplaintImagePreviews() {
    const grid = document.getElementById('complaintImagePreviewGrid');
    grid.innerHTML = complaintImages.map((file, index) => `
        <div class="sr-image-preview">
            <img src="${URL.createObjectURL(file)}" alt="Preview ${index + 1}">
            <button class="sr-image-remove" onclick="removeComplaintImage(${index})">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function removeComplaintImage(index) {
    complaintImages.splice(index, 1);
    renderComplaintImagePreviews();
}

// Submit Complaint
document.getElementById('submitComplaintBtn').addEventListener('click', async () => {
    const message = document.getElementById('complaintMessage').value.trim();
    const anonymous = document.getElementById('complaintAnonymousToggle').checked;
    
    if (!message) {
        showToast('Please describe your complaint');
        return;
    }
    
    if (message.length > 5000) {
        showToast('Message too long (max 5000 characters)');
        return;
    }
    
    const btn = document.getElementById('submitComplaintBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    
    try {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('postType', 'complaint');
        formData.append('anonymous', anonymous);
        formData.append('isPrivate', 'true'); // Always private
        
        // Add location if available
        if (complaintLocation) {
            formData.append('latitude', complaintLocation.latitude);
            formData.append('longitude', complaintLocation.longitude);
            formData.append('address', complaintLocation.address);
        }
        
        // Add images
        complaintImages.forEach(image => {
            formData.append('images', image);
        });
        
        const token = localStorage.getItem('snx_token');
        const res = await fetch(`${API}/api/silentroom/post`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });
        
        const data = await res.json();
        
        if (data.success) {
            showToast('✅ Complaint submitted successfully!');
            closeComplaintModal();
            switchTab('complaints');
            loadComplaints();
        } else {
            showToast(data.message || 'Failed to submit complaint');
        }
    } catch (error) {
        console.error('Submit complaint error:', error);
        showToast('Failed to submit complaint');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Submit Complaint
        `;
    }
});

// Load Complaints
async function loadComplaints() {
    const container = document.getElementById('complaintsContainer');
    const loading = document.getElementById('complaintsLoading');
    const empty = document.getElementById('complaintsEmpty');
    
    loading.style.display = 'flex';
    container.style.display = 'none';
    empty.style.display = 'none';
    
    try {
        const currentUser = JSON.parse(localStorage.getItem('snx_user') || '{}');
        const userId = currentUser._id || currentUser.id;
        
        const token = localStorage.getItem('snx_token');
        const url = `${API}/api/silentroom/feed?page=1&limit=100&showPrivate=true&userId=${userId}`;
        
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (!res.ok) {
            throw new Error('Failed to load complaints');
        }
        
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            renderComplaints(data.data);
            container.style.display = 'flex';
        } else {
            empty.style.display = 'flex';
        }
    } catch (error) {
        showToast('Failed to load complaints');
        empty.style.display = 'flex';
    } finally {
        loading.style.display = 'none';
    }
}

// Render Complaints
function renderComplaints(complaints) {
    const container = document.getElementById('complaintsContainer');
    
    if (!complaints || complaints.length === 0) {
        container.innerHTML = '<div class="sr-empty"><p>No complaints found</p></div>';
        return;
    }
    
    container.innerHTML = complaints.map(complaint => {
        // Normalize status values
        let status = (complaint.status || 'pending').toLowerCase();
        if (status === 'approve') status = 'approved';
        if (status === 'reject') status = 'rejected';
        
        // Determine status display
        const statusClass = status === 'action_taken' ? 'status-action-taken' : 
                          status === 'approved' ? 'status-approved' : 
                          status === 'rejected' ? 'status-rejected' : 'status-pending';
        
        const statusText = status === 'action_taken' ? '✅ Action Taken' :
                         status === 'approved' ? '👁️ Under Review' : 
                         status === 'rejected' ? '❌ Rejected' : '📝 Submitted';
        
        const statusIcon = status === 'action_taken' ? '✅' :
                          status === 'approved' ? '👁️' :
                          status === 'rejected' ? '❌' : '📝';
        
        return `
            <div class="sr-post sr-post--complaint ${statusClass}">
                <div class="sr-post__header">
                    <div class="sr-post__user">
                        <div class="sr-post__avatar">${complaint.anonymous ? '👤' : (complaint.userName ? complaint.userName[0] : 'U')}</div>
                        <div class="sr-post__user-info">
                            <div class="sr-post__user-name">
                                ${complaint.anonymous ? 'Anonymous' : complaint.userName}
                                <span class="sr-post__complaint-badge">🔒 PRIVATE COMPLAINT</span>
                            </div>
                            <div class="sr-post__meta">
                                <span>${formatTimeAgo(complaint.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="sr-post__status-badge ${statusClass}">
                        ${statusIcon} ${statusText}
                    </div>
                </div>
                
                ${complaint.location ? `
                <div class="sr-post__location">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" stroke-width="1.5"/>
                        <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                    ${complaint.location.address}
                </div>
                ` : ''}
                
                <div class="sr-post__content">
                    <p>${escapeHtml(complaint.message)}</p>
                </div>
                
                ${complaint.images && complaint.images.length > 0 ? `
                <div class="sr-post__images">
                    ${complaint.images.map(img => `
                        <img src="data:${img.mimeType};base64,${img.data}" alt="Evidence" onclick="viewImage('data:${img.mimeType};base64,${img.data}')">
                    `).join('')}
                </div>
                ` : ''}
                
                ${complaint.adminResponse ? `
                <div class="sr-post__admin-response">
                    <div class="sr-post__admin-response-header">
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2"/>
                            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <strong>Response Received</strong>
                    </div>
                    <div class="sr-post__admin-response-text">${escapeHtml(complaint.adminResponse)}</div>
                    ${complaint.adminResponseAt ? `
                    <div class="sr-post__admin-response-time">
                        <svg viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        ${formatTimeAgo(complaint.adminResponseAt)}
                    </div>
                    ` : ''}
                </div>
                ` : ''}
                
                ${status === 'rejected' && !complaint.adminResponse ? `
                <div class="sr-post__rejection-notice">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <p>This complaint was reviewed and rejected. If you believe this was in error, please submit a new complaint with more details.</p>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}
