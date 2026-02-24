/**
 * SafeNex API Utilities
 * Shared API helper functions with proper error handling
 */

'use strict';

const API_BASE = '';  // Same origin

/**
 * Make a POST request to the API
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
 * @param {object|FormData} body - Request body
 * @param {boolean} isFormData - Whether body is FormData
 * @returns {Promise<object>} Response data
 */
async function apiPost(endpoint, body, isFormData = false) {
    const token = localStorage.getItem('snx_token');
    const headers = {};
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers,
            body: isFormData ? body : JSON.stringify(body),
        });

        // Check if response is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Non-JSON response received:', await res.text());
            throw new Error('Backend API is not available. Please ensure Cloud Functions are deployed.');
        }

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || `Request failed with status ${res.status}`);
        }
        return data;
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Please check your internet connection.');
        }
        throw error;
    }
}

/**
 * Make a GET request to the API
 * @param {string} endpoint - API endpoint
 * @returns {Promise<object>} Response data
 */
async function apiGet(endpoint) {
    const token = localStorage.getItem('snx_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { headers });
        
        // Check if response is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Non-JSON response received:', await res.text());
            throw new Error('Backend API is not available. Please ensure Cloud Functions are deployed.');
        }
        
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || `Request failed with status ${res.status}`);
        }
        return data;
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Please check your internet connection.');
        }
        throw error;
    }
}

/**
 * Make a PUT request to the API
 * @param {string} endpoint - API endpoint
 * @param {object} body - Request body
 * @returns {Promise<object>} Response data
 */
async function apiPut(endpoint, body) {
    const token = localStorage.getItem('snx_token');
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body),
        });

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Backend API is not available. Please ensure Cloud Functions are deployed.');
        }

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || `Request failed with status ${res.status}`);
        }
        return data;
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Please check your internet connection.');
        }
        throw error;
    }
}

/**
 * Make a DELETE request to the API
 * @param {string} endpoint - API endpoint
 * @returns {Promise<object>} Response data
 */
async function apiDelete(endpoint) {
    const token = localStorage.getItem('snx_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE',
            headers,
        });

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Backend API is not available. Please ensure Cloud Functions are deployed.');
        }

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || `Request failed with status ${res.status}`);
        }
        return data;
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Please check your internet connection.');
        }
        throw error;
    }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
    return !!localStorage.getItem('snx_token');
}

/**
 * Get current user from localStorage
 * @returns {object|null}
 */
function getCurrentUser() {
    const userStr = localStorage.getItem('snx_user');
    return userStr ? JSON.parse(userStr) : null;
}

/**
 * Logout user
 */
function logout() {
    localStorage.removeItem('snx_token');
    localStorage.removeItem('snx_user');
    window.location.href = '/landing.html';
}
