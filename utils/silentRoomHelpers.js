/**
 * Silent Room Utility Functions
 */

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Generate unique report ID
 * @returns {string} Unique report ID
 */
function generateReportId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SNX-${timestamp}-${random}`;
}

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if valid
 */
function validateCoordinates(lat, lng) {
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}

/**
 * Sanitize text input
 * @param {string} text - Input text
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
    if (!text) return '';
    return text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();
}

/**
 * Basic profanity filter
 * @param {string} text - Input text
 * @returns {string} Filtered text
 */
function filterProfanity(text) {
    // Basic profanity list - extend with comprehensive list
    const profanityList = [
        'badword1',
        'badword2',
        'badword3',
        // Add more words as needed
    ];

    let filtered = text;
    profanityList.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filtered = filtered.replace(regex, '***');
    });

    return filtered;
}

/**
 * Get severity level number
 * @param {string} severity - Severity string
 * @returns {number} Severity level (1-4)
 */
function getSeverityLevel(severity) {
    const levels = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
    };
    return levels[severity] || 1;
}

/**
 * Get severity color
 * @param {string} severity - Severity string
 * @returns {string} Color hex code
 */
function getSeverityColor(severity) {
    const colors = {
        low: '#22c55e',
        medium: '#eab308',
        high: '#f97316',
        critical: '#dc2626',
    };
    return colors[severity] || colors.low;
}

/**
 * Format timestamp for display
 * @param {Date|string} timestamp - Timestamp
 * @returns {string} Formatted time string
 */
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

/**
 * Calculate engagement rate
 * @param {number} views - View count
 * @param {number} interactions - Total interactions (votes + comments + likes)
 * @returns {number} Engagement rate percentage
 */
function calculateEngagementRate(views, interactions) {
    if (views === 0) return 0;
    return Math.round((interactions / views) * 10000) / 100;
}

/**
 * Validate image file
 * @param {Object} file - Multer file object
 * @returns {Object} Validation result
 */
function validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.mimetype)) {
        return {
            valid: false,
            error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File size exceeds 5MB limit.',
        };
    }

    return { valid: true };
}

/**
 * Generate SafeTrace zone update payload
 * @param {Object} report - Report object
 * @returns {Object} SafeTrace payload
 */
function generateSafeTracePayload(report) {
    return {
        zoneId: report.reportId,
        location: {
            latitude: report.location.coordinates[1],
            longitude: report.location.coordinates[0],
            address: report.location.address,
        },
        riskLevel: getSeverityLevel(report.severity),
        riskScore: report.riskScore,
        category: report.category,
        timestamp: report.createdAt,
        clusterRisk: report.clusterRisk,
        similarReportsCount: report.similarReportsCount,
        verified: report.verified,
    };
}

/**
 * Check if report is editable
 * @param {Date} editableUntil - Editable until timestamp
 * @returns {boolean} True if editable
 */
function isReportEditable(editableUntil) {
    return new Date() < new Date(editableUntil);
}

/**
 * Get category display name
 * @param {string} category - Category key
 * @returns {string} Display name
 */
function getCategoryDisplayName(category) {
    const names = {
        violent_crime: 'Violent Crime',
        theft: 'Theft',
        harassment: 'Harassment',
        surveillance: 'Surveillance',
        suspicious_activity: 'Suspicious Activity',
        traffic: 'Traffic',
        environmental: 'Environmental',
        infrastructure: 'Infrastructure',
        general: 'General',
        other: 'Other',
    };
    return names[category] || category;
}

/**
 * Validate report data
 * @param {Object} data - Report data
 * @returns {Object} Validation result
 */
function validateReportData(data) {
    const errors = [];

    if (!data.type || !['incident', 'unsafe_area', 'discussion'].includes(data.type)) {
        errors.push('Invalid report type');
    }

    if (!data.title || data.title.trim().length < 5) {
        errors.push('Title must be at least 5 characters');
    }

    if (!data.description || data.description.trim().length < 10) {
        errors.push('Description must be at least 10 characters');
    }

    if (!validateCoordinates(data.latitude, data.longitude)) {
        errors.push('Invalid location coordinates');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

module.exports = {
    calculateDistance,
    formatDistance,
    generateReportId,
    validateCoordinates,
    sanitizeText,
    filterProfanity,
    getSeverityLevel,
    getSeverityColor,
    formatTimestamp,
    calculateEngagementRate,
    validateImageFile,
    generateSafeTracePayload,
    isReportEditable,
    getCategoryDisplayName,
    validateReportData,
};
