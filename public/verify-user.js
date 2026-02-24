/**
 * SafeNex User Verification Page
 * Displays user details when QR code is scanned
 */

const API_BASE = '/api';

// Get SafeNex ID from URL
function getSafeNexIDFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || urlParams.get('safenexid') || urlParams.get('snx');
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Format date with time
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Mask document number for privacy
function maskDocumentNumber(docNumber) {
    if (!docNumber) return 'N/A';
    const str = docNumber.toString();
    if (str.length <= 4) return str;
    const lastFour = str.slice(-4);
    const masked = 'X'.repeat(Math.min(str.length - 4, 8));
    return `${masked}-${lastFour}`;
}

// Calculate trust score
function calculateTrustScore(user) {
    let score = 50; // Base score
    
    if (user.verified) score += 30;
    if (user.documentType) score += 10;
    if (user.extractedName) score += 10;
    
    // Account age bonus (max 10 points)
    if (user.createdAt) {
        const accountAge = Date.now() - new Date(user.createdAt).getTime();
        const daysOld = accountAge / (1000 * 60 * 60 * 24);
        score += Math.min(Math.floor(daysOld / 30), 10); // 1 point per month, max 10
    }
    
    return Math.min(score, 100);
}

// Get initials from name
function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Load user data
async function loadUserData() {
    const safeNexID = getSafeNexIDFromURL();
    
    if (!safeNexID) {
        showError('No SafeNex ID provided in URL');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/verify/user/${safeNexID}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            showError(data.message || 'User not found');
            return;
        }

        displayUserData(data.data);
    } catch (error) {
        console.error('Error loading user data:', error);
        showError('Failed to load user data. Please try again.');
    }
}

// Display user data
function displayUserData(user) {
    // Hide loading, show success
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('successState').style.display = 'block';

    // Profile section
    const initials = getInitials(user.name);
    document.getElementById('avatarInitial').textContent = initials;
    document.getElementById('userName').textContent = user.name || 'Unknown User';
    document.getElementById('userSafeNexID').textContent = user.safeNexID || 'N/A';

    // Verification status
    if (user.verified && user.verifiedAt) {
        document.getElementById('verifiedDate').textContent = formatDate(user.verifiedAt);
    } else {
        document.getElementById('verifiedDate').textContent = 'Not Verified';
    }

    document.getElementById('documentType').textContent = user.documentType || 'N/A';
    document.getElementById('documentNumber').textContent = maskDocumentNumber(user.documentNumber);

    // Details grid
    document.getElementById('fullName').textContent = user.name || 'N/A';
    document.getElementById('extractedName').textContent = user.extractedName || user.name || 'N/A';
    document.getElementById('memberSince').textContent = formatDate(user.createdAt);

    // Trust score
    const trustScore = calculateTrustScore(user);
    document.getElementById('trustScore').textContent = trustScore;
    document.getElementById('trustScoreFill').style.width = `${trustScore}%`;

    // Update trust indicators based on verification status
    const indicators = document.querySelectorAll('.trust-indicator .indicator-dot');
    indicators[0].classList.toggle('verified', user.verified);
    indicators[1].classList.toggle('verified', user.documentType && user.verified);
    indicators[2].classList.toggle('verified', true); // Always active if profile loads

    // Footer timestamp
    document.getElementById('verificationTime').textContent = `Verified at: ${formatDateTime(new Date())}`;

    // Update page title
    document.title = `${user.name} - SafeNex Verification`;
}

// Show error state
function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
});
