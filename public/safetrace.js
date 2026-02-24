/**
 * SafeTrace Frontend - Production-Ready Risk-Aware Navigation
 */

// Configuration
const API_BASE = '/api/safetrace';
const UPDATE_INTERVAL = 10000; // 10 seconds for location updates
const DEVIATION_THRESHOLD = 50; // 50 meters
const MAX_ROUTE_DISTANCE_KM = 150; // OpenRouteService limit for walking routes

// State
let map = null;
let userMarker = null;
let currentPosition = null;
let currentHeading = null; // Track user's heading/direction
let watchId = null;
let routes = [];
let selectedRoute = null;
let routeLayer = null;
let dangerZoneLayer = null;
let isNavigating = false;
let updateTimer = null;
let autocompleteTimeout = null;
let usingGPS = false;
let manualStartLocation = null;
let mapTheme = 'bright'; // Default theme
let tileLayer = null; // Store tile layer reference
let travelMode = 'foot-walking'; // Default travel mode

// Get auth token
function getToken() {
    // Try both token names for compatibility
    return localStorage.getItem('snx_token') || localStorage.getItem('token');
}

// API Helper
async function apiCall(endpoint, options = {}) {
    const token = getToken();
    if (!token) {
        console.warn('No authentication token found');
        throw new Error('Authentication required');
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Failed to parse response:', parseError);
            throw new Error('Invalid response from server');
        }

        if (!response.ok) {
            // If unauthorized, redirect to login
            if (response.status === 401 || response.status === 403) {
                console.error('Authentication failed, redirecting to login');
                setTimeout(() => {
                    window.location.href = '/onboarding.html';
                }, 1000);
            }
            throw new Error(data?.message || data?.error || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Initialize Map
function initMap() {
    try {
        console.log('Initializing map...');
        
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.error('Leaflet library not loaded!');
            showNotification('Map library failed to load. Please refresh the page.', 'error');
            return;
        }

        // Initialize map
        map = L.map('map', {
            zoomControl: false,
            attributionControl: false
        }).setView([19.0760, 72.8777], 13); // Default to Mumbai

        console.log('Map object created');

        // Load saved theme or default to bright
        mapTheme = localStorage.getItem('safetrace_map_theme') || 'bright';
        
        // Apply theme
        applyMapTheme(mapTheme);

        console.log('Tiles added');

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

        // Initialize layers
        dangerZoneLayer = L.layerGroup().addTo(map);
        routeLayer = L.layerGroup().addTo(map);

        console.log('Map initialized successfully');

        // Hide loading indicator
        const mapLoading = document.getElementById('mapLoading');
        if (mapLoading) {
            mapLoading.style.display = 'none';
        }

        // Force map to resize
        setTimeout(() => {
            map.invalidateSize();
        }, 100);

        // Start location tracking
        startLocationTracking();
    } catch (error) {
        console.error('Map initialization error:', error);
        showNotification('Failed to initialize map: ' + error.message, 'error');
        
        // Hide loading indicator
        const mapLoading = document.getElementById('mapLoading');
        if (mapLoading) {
            mapLoading.innerHTML = '<p style="color: #EF4444;">Failed to load map. Please refresh the page.</p>';
        }
    }
}

// Apply Map Theme
function applyMapTheme(theme) {
    // Remove existing tile layer if present
    if (tileLayer) {
        map.removeLayer(tileLayer);
    }

    if (theme === 'dark') {
        // Dark theme tiles
        tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors, © CARTO'
        }).addTo(map);
    } else {
        // Bright theme tiles (default OpenStreetMap)
        tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }

    // Update button states
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Save preference
    localStorage.setItem('safetrace_map_theme', theme);
    mapTheme = theme;
}

// Toggle Map Theme
function toggleMapTheme(theme) {
    applyMapTheme(theme);
    showNotification(`Map theme changed to ${theme}`, 'success');
}

// Start Location Tracking
function startLocationTracking() {
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser', 'error');
        updateLocationStatus('Geolocation not supported. Please enter address manually.', 'error');
        return;
    }

    updateLocationStatus('Getting your location...', 'info');

    // Get initial position with longer timeout
    navigator.geolocation.getCurrentPosition(
        (position) => {
            updateUserLocation(position);
            updateLocationStatus('GPS location active', 'success');
        },
        (error) => {
            console.error('Geolocation error:', error);
            handleGeolocationError(error);
        },
        {
            enableHighAccuracy: true,
            timeout: 30000, // Increased to 30 seconds
            maximumAge: 0
        }
    );

    // Watch position with controlled updates
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            updateUserLocation(position);
        },
        (error) => {
            console.error('Geolocation watch error:', error);
            // Don't show error for watch position, just log it
        },
        {
            enableHighAccuracy: true,
            timeout: 30000, // Increased to 30 seconds
            maximumAge: 10000 // Allow 10 second old positions
        }
    );
}

// Handle Geolocation Errors
function handleGeolocationError(error) {
    let message = '';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location access denied. Please enable location or enter address manually.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable. Please enter address manually.';
            break;
        case error.TIMEOUT:
            message = 'Location request timeout. Please enter address manually.';
            break;
        default:
            message = 'Unable to get location. Please enter address manually.';
    }
    updateLocationStatus(message, 'error');
    showNotification(message, 'warning');
    
    // Make input editable
    const startInput = document.getElementById('startInput');
    if (startInput) {
        startInput.placeholder = 'Enter your starting location...';
    }
}

// Update Location Status
function updateLocationStatus(message, type = 'info') {
    const statusElement = document.getElementById('locationStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `input-hint ${type}`;
    }
}

// Use My Location Button Handler
function useMyLocation() {
    const btn = document.getElementById('useLocationBtn');
    const startInput = document.getElementById('startInput');
    
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser', 'error');
        updateLocationStatus('Geolocation not supported', 'error');
        return;
    }

    // Show loading state
    btn.classList.add('loading');
    btn.disabled = true;
    updateLocationStatus('Getting your location...', 'info');
    startInput.value = 'Getting location...';
    startInput.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude, heading, accuracy } = position.coords;
            currentPosition = { latitude, longitude };
            usingGPS = true;
            manualStartLocation = null;
            
            // Store heading if available
            if (heading !== null && heading !== undefined) {
                currentHeading = heading;
            }

            // Update input
            startInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            startInput.disabled = false;
            
            // Update marker with directional arrow
            if (!userMarker) {
                createDirectionalMarker(latitude, longitude, heading, accuracy);
                map.setView([latitude, longitude], 15);
            } else {
                updateDirectionalMarker(latitude, longitude, heading, accuracy);
                map.setView([latitude, longitude], 15);
            }

            // Remove loading state
            btn.classList.remove('loading');
            btn.disabled = false;
            updateLocationStatus('GPS location active', 'success');
            showNotification('Location acquired successfully', 'success');

            // Start watching position
            if (!watchId) {
                startLocationTracking();
            }
        },
        (error) => {
            console.error('Geolocation error:', error);
            btn.classList.remove('loading');
            btn.disabled = false;
            startInput.value = '';
            startInput.disabled = false;
            handleGeolocationError(error);
        },
        {
            enableHighAccuracy: true,
            timeout: 30000, // Increased to 30 seconds
            maximumAge: 0
        }
    );
}

// Update User Location
function updateUserLocation(position) {
    const { latitude, longitude, heading, accuracy } = position.coords;
    currentPosition = { latitude, longitude };
    
    // Update heading if available (from device compass)
    if (heading !== null && heading !== undefined) {
        currentHeading = heading;
    }

    // Only update input if using GPS mode
    if (usingGPS) {
        document.getElementById('startInput').value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }

    // Update or create marker with directional arrow
    if (!userMarker) {
        createDirectionalMarker(latitude, longitude, currentHeading, accuracy);
        
        // Only center map if using GPS
        if (usingGPS) {
            map.setView([latitude, longitude], 15);
        }
    } else {
        updateDirectionalMarker(latitude, longitude, currentHeading, accuracy);
    }

    // Check for deviation if navigating
    if (isNavigating && selectedRoute) {
        checkDeviation();
    }
}

// Create Directional Marker with Arrow
function createDirectionalMarker(lat, lng, heading, accuracy) {
    const rotation = heading !== null && heading !== undefined ? heading : 0;
    
    // Create custom icon with arrow pointing in direction of movement
    const icon = L.divIcon({
        className: 'user-location-arrow',
        html: `
            <svg viewBox="0 0 24 24" fill="none" style="transform: rotate(${rotation}deg); transition: transform 0.3s ease;">
                <path d="M12 2L4 20l8-4 8 4-8-18z" fill="#3B82F6" stroke="white" stroke-width="2"/>
            </svg>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    userMarker = L.marker([lat, lng], { icon }).addTo(map);
    
    // Do NOT add accuracy circle - removed as per requirement
}

// Update Directional Marker
function updateDirectionalMarker(lat, lng, heading, accuracy) {
    const rotation = heading !== null && heading !== undefined ? heading : currentHeading || 0;
    
    // Update icon with new rotation - arrow head points in direction of movement
    const icon = L.divIcon({
        className: 'user-location-arrow',
        html: `
            <svg viewBox="0 0 24 24" fill="none" style="transform: rotate(${rotation}deg); transition: transform 0.3s ease;">
                <path d="M12 2L4 20l8-4 8 4-8-18z" fill="#3B82F6" stroke="white" stroke-width="2"/>
            </svg>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    userMarker.setIcon(icon);
    userMarker.setLatLng([lat, lng]);
    
    // Store heading for future updates
    if (heading !== null && heading !== undefined) {
        currentHeading = heading;
    }
}

// Check Deviation from Route
async function checkDeviation() {
    if (!currentPosition || !selectedRoute) return;

    try {
        const response = await apiCall('/check-deviation', {
            method: 'POST',
            body: JSON.stringify({
                currentLat: currentPosition.latitude,
                currentLng: currentPosition.longitude,
                routeCoordinates: selectedRoute.coordinates,
                threshold: DEVIATION_THRESHOLD
            })
        });

        if (response.data.deviated) {
            showNotification('You have deviated from the route. Recalculating...', 'warning');
            // Trigger reroute
            const destInput = document.getElementById('destInput');
            if (destInput.value) {
                findRoutes();
            }
        } else if (response.data.remainingRoute) {
            // Update route to show only remaining path
            updateRemainingRoute(response.data.remainingRoute);
        }
    } catch (error) {
        console.error('Deviation check error:', error);
    }
}

// Update Remaining Route
function updateRemainingRoute(remainingCoordinates) {
    if (!routeLayer) return;

    routeLayer.clearLayers();

    // Draw remaining route
    const latlngs = remainingCoordinates.map(coord => [coord[1], coord[0]]);
    
    L.polyline(latlngs, {
        color: '#8B5CF6',
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round'
    }).addTo(routeLayer);

    // Add destination marker
    const lastCoord = remainingCoordinates[remainingCoordinates.length - 1];
    const destIcon = L.divIcon({
        className: 'destination-marker',
        html: `<div style="width: 30px; height: 30px; background: #EF4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    L.marker([lastCoord[1], lastCoord[0]], { icon: destIcon }).addTo(routeLayer);
}

// Find Routes
async function findRoutes() {
    const startInput = document.getElementById('startInput');
    const destInput = document.getElementById('destInput');
    const startValue = startInput.value.trim();
    const destValue = destInput.value.trim();

    if (!destValue) {
        showNotification('Please enter a destination', 'error');
        return;
    }

    showLoading(true);

    try {
        let startLat, startLng;

        // Determine start location
        if (usingGPS && currentPosition) {
            // Use GPS location
            startLat = currentPosition.latitude;
            startLng = currentPosition.longitude;
        } else if (startValue) {
            // Use manual address input - geocode it
            try {
                const startGeocodeResponse = await apiCall('/geocode', {
                    method: 'POST',
                    body: JSON.stringify({ address: startValue })
                });
                const startLocation = startGeocodeResponse.data;
                startLat = startLocation.latitude;
                startLng = startLocation.longitude;
                
                // Update manual start location
                manualStartLocation = { latitude: startLat, longitude: startLng };
                
                // Update marker for manual location
                if (!userMarker) {
                    const icon = L.divIcon({
                        className: 'user-location-marker',
                        html: `<div style="width: 20px; height: 20px; background: #F59E0B; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });
                    userMarker = L.marker([startLat, startLng], { icon }).addTo(map);
                } else {
                    userMarker.setLatLng([startLat, startLng]);
                }
                map.setView([startLat, startLng], 14);
            } catch (error) {
                showNotification('Could not find starting location. Please check the address.', 'error');
                showLoading(false);
                return;
            }
        } else {
            showNotification('Please enter a starting location or use GPS', 'error');
            showLoading(false);
            return;
        }

        // Geocode destination
        const geocodeResponse = await apiCall('/geocode', {
            method: 'POST',
            body: JSON.stringify({ address: destValue })
        });

        const destination = geocodeResponse.data;

        // Calculate distance
        const distance = calculateDistanceKm(
            startLat,
            startLng,
            destination.latitude,
            destination.longitude
        );

        // Check if distance is within limits
        if (distance > MAX_ROUTE_DISTANCE_KM) {
            showNotification(
                `Destination is too far (${distance.toFixed(1)}km). Walking routes are limited to ${MAX_ROUTE_DISTANCE_KM}km. Please choose a closer location.`,
                'error'
            );
            showLoading(false);
            return;
        }

        // Warn if distance is very long
        if (distance > 50) {
            showNotification(
                `Long distance route: ${distance.toFixed(1)}km. This may take a while to calculate.`,
                'warning'
            );
        }

        // Get routes
        const routesResponse = await apiCall('/routes', {
            method: 'POST',
            body: JSON.stringify({
                startLat: startLat,
                startLng: startLng,
                endLat: destination.latitude,
                endLng: destination.longitude,
                travelMode: travelMode, // Pass selected travel mode
                startAddress: startValue || `${startLat.toFixed(5)}, ${startLng.toFixed(5)}`,
                endAddress: destValue
            })
        });

        console.log('Routes response:', routesResponse);

        // Validate response structure
        if (!routesResponse || !routesResponse.data) {
            throw new Error('Invalid response from server');
        }

        if (!routesResponse.data.routes || !Array.isArray(routesResponse.data.routes)) {
            throw new Error('No routes found in response');
        }

        routes = routesResponse.data.routes;
        const dangerZones = routesResponse.data.dangerZones || [];

        console.log('Routes received:', routes.length);
        console.log('First route:', routes[0]);
        console.log('AI Insights:', routes[0]?.aiInsights);
        console.log('Navigation Guidance:', routes[0]?.navigationGuidance);

        // Validate routes have coordinates
        const validRoutes = routes.filter(route => 
            route && route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0
        );

        if (validRoutes.length === 0) {
            throw new Error('No valid routes with coordinates found');
        }

        routes = validRoutes;

        // Display routes
        displayRoutes(routes);

        // Display danger zones
        displayDangerZones(dangerZones);

        // Auto-select recommended route
        if (routes.length > 0) {
            selectRoute(0);
        }

        showNotification(`Found ${routes.length} route${routes.length > 1 ? 's' : ''}`, 'success');
    } catch (error) {
        console.error('Route finding error:', error);
        showNotification(error.message || 'Failed to find routes', 'error');
    } finally {
        showLoading(false);
    }
}

// Calculate distance in kilometers
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in kilometers
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
}

// Display Routes
function displayRoutes(routesList) {
    const routesSection = document.getElementById('routesSection');
    const routesListElement = document.getElementById('routesList');
    const routeCount = document.getElementById('routeCount');

    routesSection.style.display = 'block';
    routeCount.textContent = `${routesList.length} route${routesList.length > 1 ? 's' : ''}`;

    routesListElement.innerHTML = routesList.map((route, index) => `
        <div class="route-card ${route.recommended ? 'recommended' : ''}" data-index="${index}">
            <div class="route-header">
                <div class="route-title">Route ${index + 1}</div>
                <div class="risk-badge ${route.risk.riskLevel}">${route.risk.riskLevel}</div>
            </div>
            <div class="route-stats">
                <div class="route-stat">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 11a3 3 0 106 0 3 3 0 00-6 0z" stroke="currentColor" stroke-width="2"/>
                        <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    ${route.distanceKm} km
                </div>
                <div class="route-stat">
                    <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    ${route.durationDisplay || route.durationMin + ' min'}
                </div>
                <div class="route-stat">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Risk: ${route.risk.totalRisk}
                </div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.route-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            selectRoute(index);
        });
    });
}

// Select Route
function selectRoute(index) {
    selectedRoute = routes[index];

    // Update UI
    document.querySelectorAll('.route-card').forEach((card, i) => {
        card.classList.toggle('selected', i === index);
    });

    // Draw route on map
    drawRoute(selectedRoute);

    // Show intelligence panel
    showIntelligencePanel(selectedRoute);

    // Start navigation
    isNavigating = true;

    // Save to history
    saveRouteToHistory(selectedRoute);
}

// Draw Route on Map
function drawRoute(route) {
    if (!routeLayer) {
        console.error('Route layer not initialized');
        return;
    }

    if (!route) {
        console.error('No route provided to drawRoute');
        return;
    }

    if (!route.coordinates || !Array.isArray(route.coordinates) || route.coordinates.length === 0) {
        console.error('Route has no valid coordinates:', route);
        showNotification('Route data is invalid', 'error');
        return;
    }

    routeLayer.clearLayers();

    try {
        const latlngs = route.coordinates.map(coord => {
            if (!Array.isArray(coord) || coord.length < 2) {
                console.warn('Invalid coordinate:', coord);
                return null;
            }
            return [coord[1], coord[0]];
        }).filter(coord => coord !== null);

        if (latlngs.length === 0) {
            throw new Error('No valid coordinates to draw');
        }

        // Draw route line
        const routeLine = L.polyline(latlngs, {
            color: '#8B5CF6',
            weight: 6,
            opacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round'
        }).addTo(routeLayer);

        // Add destination marker
        const lastCoord = route.coordinates[route.coordinates.length - 1];
        if (Array.isArray(lastCoord) && lastCoord.length >= 2) {
            const destIcon = L.divIcon({
                className: 'destination-marker',
                html: `<div style="width: 30px; height: 30px; background: #EF4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            L.marker([lastCoord[1], lastCoord[0]], { icon: destIcon }).addTo(routeLayer);
        }

        // Fit map to route
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    } catch (error) {
        console.error('Error drawing route:', error);
        showNotification('Failed to display route on map', 'error');
    }
}

// Display Danger Zones
function displayDangerZones(zones) {
    if (!dangerZoneLayer) return;

    dangerZoneLayer.clearLayers();

    zones.forEach(zone => {
        // Determine color based on severity - DARKER COLORS
        const severityKey = zone.severity || 'medium';
        const color = {
            safe: '#059669',      // Darker green
            low: '#2563EB',       // Darker blue
            medium: '#D97706',    // Darker orange
            high: '#DC2626',      // Darker red
            critical: '#991B1B'   // Very dark red
        }[severityKey] || '#475569';

        // Different styling for verified vs user-reported zones
        const isVerified = zone.type === 'verified';
        const fillOpacity = isVerified ? 0.45 : 0.35; // Increased opacity for darker appearance
        const weight = isVerified ? 3 : 2;

        // Draw circle
        const circle = L.circle([zone.latitude, zone.longitude], {
            radius: zone.radius,
            color: color,
            fillColor: color,
            fillOpacity: fillOpacity,
            weight: weight,
            opacity: 1.0, // Increased from 0.9/0.8 for darker borders
            className: isVerified ? 'verified-danger-zone' : 'user-danger-zone'
        }).addTo(dangerZoneLayer);

        // Create popup content
        let popupContent = `
            <div style="padding: 8px; font-family: Inter, sans-serif; min-width: 200px;">
                ${isVerified ? `
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                        <svg viewBox="0 0 24 24" fill="none" style="width: 16px; height: 16px; color: #10B981;">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span style="font-size: 11px; color: #10B981; font-weight: 600; text-transform: uppercase;">Verified Zone</span>
                    </div>
                ` : ''}
                <div style="font-weight: 700; margin-bottom: 4px; text-transform: capitalize; color: #0A0E1A;">
                    ${zone.placeName || zone.category.replace(/_/g, ' ')}
                </div>
                <div style="font-size: 12px; color: #64748B; margin-bottom: 8px;">
                    ${zone.description || 'No description'}
                </div>
                <div style="font-size: 11px; color: #94A3B8;">
                    <div style="margin-bottom: 4px;">
                        <span style="font-weight: 600;">Risk:</span> 
                        <span style="color: ${color}; font-weight: 600; text-transform: capitalize;">${severityKey}</span>
                    </div>
                    ${zone.activeHours ? `
                        <div style="margin-bottom: 4px;">
                            <span style="font-weight: 600;">Active Hours:</span> ${zone.activeHours}
                        </div>
                    ` : ''}
                    ${zone.reportCount ? `
                        <div style="margin-bottom: 4px;">
                            <span style="font-weight: 600;">Reports:</span> ${zone.reportCount}
                        </div>
                    ` : ''}
                    ${zone.source ? `
                        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF;">
                            Source: ${zone.source}
                        </div>
                    ` : ''}
                    ${zone.lastReported ? `
                        <div style="margin-top: 4px;">
                            <span style="font-weight: 600;">Last:</span> ${new Date(zone.lastReported).toLocaleDateString()}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        circle.bindPopup(popupContent);
    });
}

// Show Intelligence Panel
function showIntelligencePanel(route) {
    const panel = document.getElementById('intelligencePanel');
    const content = document.getElementById('panelContent');

    const risk = route.risk;
    const riskColor = {
        safe: '#10B981',
        low: '#3B82F6',
        medium: '#F59E0B',
        high: '#EF4444',
        critical: '#DC2626'
    }[risk.riskLevel] || '#64748B';

    let aiInsightsHTML = '';
    if (route.aiInsights && route.aiInsights.success) {
        const insights = route.aiInsights;
        
        // Clean up analysis text - remove any markdown formatting
        let analysisText = insights.analysis || '';
        analysisText = analysisText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/,'').trim();
        
        // If analysis still looks like JSON, try to extract meaningful text
        if (analysisText.startsWith('{') || analysisText.startsWith('[')) {
            analysisText = 'Route analysis completed. See details below.';
        }
        
        aiInsightsHTML = `
            <div class="ai-insights-section">
                <div class="ai-header">
                    <svg viewBox="0 0 24 24" fill="none" style="width: 20px; height: 20px; color: #8B5CF6;">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h4>AI Route Analysis</h4>
                </div>
                <p class="ai-summary">${analysisText}</p>
                
                ${insights.keyInsights && insights.keyInsights.length > 0 ? `
                    <div class="ai-insights-list">
                        <h5>📌 Key Insights</h5>
                        ${insights.keyInsights.map((insight, index) => `
                            <div class="insight-item">
                                <span class="insight-number">${index + 1}</span>
                                <span class="insight-text">${insight}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${insights.safetyTips && insights.safetyTips.length > 0 ? `
                    <div class="safety-tips-list">
                        <h5>🛡️ Safety Tips</h5>
                        ${insights.safetyTips.map((tip, index) => `
                            <div class="safety-tip-item">
                                <span class="tip-number">${index + 1}</span>
                                <span class="tip-text">${tip}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${insights.timeRecommendations ? `
                    <div class="time-recommendations">
                        <h5>⏰ Best Time to Travel</h5>
                        <p>${insights.timeRecommendations}</p>
                    </div>
                ` : ''}
                
                ${insights.alternativeConsiderations ? `
                    <div class="alternative-considerations">
                        <h5>🔄 Alternative Route Considerations</h5>
                        <p>${insights.alternativeConsiderations}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    let navigationHTML = '';
    if (route.navigationGuidance && route.navigationGuidance.success && route.navigationGuidance.steps && route.navigationGuidance.steps.length > 0) {
        navigationHTML = `
            <div class="navigation-guidance-section">
                <div class="nav-header">
                    <svg viewBox="0 0 24 24" fill="none" style="width: 20px; height: 20px; color: #3B82F6;">
                        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <h4>Step-by-Step Guidance</h4>
                </div>
                <div class="navigation-steps">
                    ${route.navigationGuidance.steps.map((step, index) => `
                        <div class="nav-step ${index === 0 ? 'nav-step-first' : ''} ${index === route.navigationGuidance.steps.length - 1 ? 'nav-step-last' : ''}">
                            <div class="nav-step-number">${step.stepNumber || index + 1}</div>
                            <div class="nav-step-content">
                                <div class="nav-step-instruction">${step.instruction}</div>
                                <div class="nav-step-meta">
                                    <span class="nav-distance">📍 ${step.distance}</span>
                                    ${step.estimatedTime ? `<span class="nav-time">⏱️ ${step.estimatedTime}</span>` : ''}
                                </div>
                                ${step.safetyNote ? `
                                    <div class="nav-step-safety">
                                        <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px; color: #F59E0B; flex-shrink: 0;">
                                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2"/>
                                        </svg>
                                        <span>${step.safetyNote}</span>
                                    </div>
                                ` : ''}
                                ${step.landmark ? `
                                    <div class="nav-step-landmark">
                                        <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px; color: #8B5CF6;">
                                            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" stroke="currentColor" stroke-width="2"/>
                                            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2"/>
                                        </svg>
                                        <span>${step.landmark}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="risk-summary">
            <div class="risk-score">
                <div class="risk-score-value" style="color: ${riskColor};">${risk.totalRisk}</div>
                <div>
                    <div style="font-weight: 600; font-size: 14px;">${risk.riskLevel.toUpperCase()} RISK</div>
                    <div style="font-size: 12px; color: #64748B;">${route.distanceKm} km • ${route.durationDisplay || route.durationMin + ' min'}</div>
                </div>
            </div>
            ${risk.riskFactors.length > 0 ? `
                <div class="risk-factors">
                    ${risk.riskFactors.map(factor => `
                        <div class="risk-factor">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            ${factor}
                        </div>
                    `).join('')}
                </div>
            ` : '<div style="color: #10B981; font-size: 13px;">✓ No significant risk factors detected</div>'}
        </div>
        
        ${aiInsightsHTML}
        
        ${navigationHTML}
        
        ${risk.affectedZones.length > 0 ? `
            <div class="affected-zones">
                <h4>Affected Zones</h4>
                ${risk.affectedZones.map(zone => `
                    <div class="zone-item">
                        <div class="zone-item-header">
                            <span class="zone-category">${zone.category}</span>
                            <span class="risk-badge ${zone.severity}">${zone.severity}</span>
                        </div>
                        <div class="zone-description">${zone.description || 'No description'}</div>
                        <div style="font-size: 11px; color: #64748B; margin-top: 4px;">
                            ${zone.distance}m away${zone.reportCount ? ` • ${zone.reportCount} report${zone.reportCount > 1 ? 's' : ''}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;

    panel.style.display = 'block';
}

// Save Route to History
async function saveRouteToHistory(route) {
    try {
        const startInput = document.getElementById('startInput').value;
        const destInput = document.getElementById('destInput').value;
        
        // Determine start coordinates
        let startLat, startLng;
        if (usingGPS && currentPosition) {
            startLat = currentPosition.latitude;
            startLng = currentPosition.longitude;
        } else if (manualStartLocation) {
            startLat = manualStartLocation.latitude;
            startLng = manualStartLocation.longitude;
        } else {
            // Fallback to current position if available
            if (currentPosition) {
                startLat = currentPosition.latitude;
                startLng = currentPosition.longitude;
            } else {
                console.warn('No start location available for history');
                return;
            }
        }

        await apiCall('/history', {
            method: 'POST',
            body: JSON.stringify({
                startLat: startLat,
                startLng: startLng,
                endLat: route.coordinates[route.coordinates.length - 1][1],
                endLng: route.coordinates[route.coordinates.length - 1][0],
                startAddress: startInput,
                endAddress: destInput,
                selectedRoute: route.id,
                riskScore: route.risk.totalRisk,
                distance: route.distance,
                duration: route.duration
            })
        });
    } catch (error) {
        console.error('Failed to save route history:', error);
    }
}

// Load Route History
async function loadRouteHistory() {
    // Check if user is authenticated first
    const token = getToken();
    if (!token) {
        console.log('No token found, skipping history load');
        return;
    }

    try {
        const response = await apiCall('/history');
        const history = response.data.history;

        const historyList = document.getElementById('historyList');

        if (history.length === 0) {
            historyList.innerHTML = '<p class="empty-state">No recent routes</p>';
            return;
        }

        historyList.innerHTML = history.slice(0, 5).map(item => `
            <div class="history-item">
                <div class="history-item-title">${item.endAddress || 'Unknown destination'}</div>
                <div class="history-item-meta">
                    ${(item.distance / 1000).toFixed(2)} km • Risk: ${item.riskScore} • ${new Date(item.createdAt).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load history:', error);
        // Don't redirect on history load failure
    }
}

// Load All Verified Danger Zones on Map
async function loadAllDangerZones() {
    if (!map || !dangerZoneLayer) {
        console.warn('Map or danger zone layer not initialized');
        return;
    }

    try {
        console.log('Loading all verified danger zones...');
        
        // Fetch all verified danger zones
        const response = await apiCall('/danger-zones/all');
        
        if (response && response.data && response.data.zones) {
            const zones = response.data.zones;
            console.log(`Loaded ${zones.length} verified danger zones`);
            
            // Display zones on map
            displayDangerZones(zones);
            
            showNotification(`Loaded ${zones.length} verified danger zones`, 'success');
        } else {
            console.warn('No danger zones returned from API');
        }
    } catch (error) {
        console.error('Failed to load danger zones:', error);
        // Don't show error to user, zones will load when routes are calculated
    }
}

// Show Loading
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// Show Notification
function showNotification(message, type = 'info') {
    // Simple notification - can be enhanced with a toast library
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // You can implement a toast notification here
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 84px;
        right: 20px;
        padding: 16px 20px;
        background: rgba(10, 14, 26, 0.98);
        border: 1px solid ${colors[type]};
        border-radius: 8px;
        color: white;
        font-size: 14px;
        z-index: 3000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        backdrop-filter: blur(20px);
        max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// Setup Location Autocomplete with API
function setupLocationAutocomplete() {
    // Setup autocomplete for destination input
    setupAutocompleteForInput('destInput');
    
    // Setup autocomplete for start input
    setupAutocompleteForInput('startInput');
}

function setupAutocompleteForInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.id = `${inputId}Suggestions`;
    suggestionsDiv.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(10, 14, 26, 0.98);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-top: none;
        border-radius: 0 0 8px 8px;
        max-height: 400px;
        overflow-y: auto;
        z-index: 1000;
        display: none;
        backdrop-filter: blur(20px);
    `;
    
    // Make parent relative for positioning
    const parent = input.closest('.input-with-button') || input.parentElement;
    parent.style.position = 'relative';
    parent.appendChild(suggestionsDiv);

    let inputAutocompleteTimeout = null;

    input.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        
        // Clear previous timeout
        if (inputAutocompleteTimeout) {
            clearTimeout(inputAutocompleteTimeout);
        }
        
        if (query.length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        // Show loading
        suggestionsDiv.innerHTML = '<div style="padding: 12px 16px; color: #94A3B8;">Searching...</div>';
        suggestionsDiv.style.display = 'block';

        // Debounce API calls
        inputAutocompleteTimeout = setTimeout(async () => {
            try {
                const response = await apiCall(`/autocomplete?query=${encodeURIComponent(query)}&limit=10`);
                const suggestions = response.data.suggestions || [];

                if (suggestions.length === 0) {
                    suggestionsDiv.innerHTML = '<div style="padding: 12px 16px; color: #94A3B8;">No locations found</div>';
                    return;
                }

                suggestionsDiv.innerHTML = suggestions.map(loc => `
                    <div class="location-suggestion" 
                         data-address="${loc.address.replace(/"/g, '&quot;')}"
                         data-lat="${loc.latitude}"
                         data-lng="${loc.longitude}"
                         style="
                        padding: 12px 16px;
                        cursor: pointer;
                        border-bottom: 1px solid rgba(139, 92, 246, 0.1);
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(139, 92, 246, 0.1)'" 
                       onmouseout="this.style.background='transparent'">
                        <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">${loc.name}</div>
                        <div style="font-size: 12px; color: #94A3B8;">
                            <span style="text-transform: capitalize; color: #8B5CF6;">${loc.type || loc.category}</span> • ${loc.address}
                        </div>
                    </div>
                `).join('');

                // Add click handlers
                suggestionsDiv.querySelectorAll('.location-suggestion').forEach(item => {
                    item.addEventListener('click', () => {
                        input.value = item.dataset.address;
                        input.dataset.lat = item.dataset.lat;
                        input.dataset.lng = item.dataset.lng;
                        suggestionsDiv.style.display = 'none';
                        
                        // If this is start input, mark as manual entry
                        if (inputId === 'startInput') {
                            usingGPS = false;
                            updateLocationStatus('Manual location selected', 'success');
                        }
                    });
                });

            } catch (error) {
                console.error('Autocomplete error:', error);
                suggestionsDiv.innerHTML = '<div style="padding: 12px 16px; color: #EF4444;">Failed to load suggestions</div>';
            }
        }, 300); // 300ms debounce
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
}

// Event Listeners
document.getElementById('findRoutesBtn').addEventListener('click', findRoutes);

document.getElementById('useLocationBtn').addEventListener('click', useMyLocation);

// Theme toggle buttons
document.getElementById('brightThemeBtn').addEventListener('click', () => {
    toggleMapTheme('bright');
});

document.getElementById('darkThemeBtn').addEventListener('click', () => {
    toggleMapTheme('dark');
});

// Travel mode selection
document.querySelectorAll('.travel-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        document.querySelectorAll('.travel-mode-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Update travel mode
        travelMode = btn.dataset.mode;
        
        // Update hint text
        const modeNames = {
            'foot-walking': 'Walking mode selected',
            'cycling-regular': 'Cycling mode selected',
            'driving-car': 'Driving mode selected'
        };
        
        document.getElementById('travelModeHint').textContent = modeNames[travelMode];
        
        showNotification(`Travel mode changed to ${btn.querySelector('span').textContent}`, 'success');
    });
});

// Set default active mode
document.querySelector('.travel-mode-btn[data-mode="foot-walking"]').classList.add('active');

document.getElementById('startInput').addEventListener('input', () => {
    // When user types manually, disable GPS mode
    const startInput = document.getElementById('startInput');
    if (startInput.value && !startInput.value.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
        usingGPS = false;
        updateLocationStatus('Manual input mode', 'info');
    }
});

document.getElementById('startInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        findRoutes();
    }
});

document.getElementById('destInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        findRoutes();
    }
});

document.getElementById('locateBtn').addEventListener('click', () => {
    if (currentPosition && userMarker) {
        map.setView([currentPosition.latitude, currentPosition.longitude], 15);
    }
});

document.getElementById('reportBtn').addEventListener('click', () => {
    document.getElementById('reportModal').style.display = 'flex';
});

document.getElementById('closeReportModal').addEventListener('click', () => {
    document.getElementById('reportModal').style.display = 'none';
});

document.getElementById('submitReportBtn').addEventListener('click', async () => {
    if (!currentPosition) {
        showNotification('Location not available', 'error');
        return;
    }

    const severity = document.getElementById('reportSeverity').value;
    const category = document.getElementById('reportCategory').value;
    const description = document.getElementById('reportDescription').value.trim();

    try {
        await apiCall('/danger-zones', {
            method: 'POST',
            body: JSON.stringify({
                latitude: currentPosition.latitude,
                longitude: currentPosition.longitude,
                severity,
                category,
                description
            })
        });

        showNotification('Danger zone reported successfully', 'success');
        document.getElementById('reportModal').style.display = 'none';
        document.getElementById('reportDescription').value = '';
    } catch (error) {
        showNotification(error.message || 'Failed to report danger zone', 'error');
    }
});

document.getElementById('closePanel').addEventListener('click', () => {
    document.getElementById('intelligencePanel').style.display = 'none';
});

document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('active');
});

document.getElementById('closeSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('active');
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing SafeTrace...');
    
    // Check authentication
    const token = getToken();
    if (!token) {
        console.error('No authentication token found');
        
        // Show error in map container
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #94A3B8;">
                    <svg viewBox="0 0 24 24" fill="none" style="width: 64px; height: 64px; margin-bottom: 16px; color: #EF4444;">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h3 style="font-size: 20px; margin-bottom: 8px; color: #fff;">Authentication Required</h3>
                    <p style="margin-bottom: 24px;">Please login to use SafeTrace</p>
                    <a href="/onboarding.html" style="padding: 12px 24px; background: linear-gradient(135deg, #8B5CF6, #06B6D4); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Go to Login
                    </a>
                </div>
            `;
        }
        return;
    }
    
    // Check if map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found!');
        return;
    }
    
    console.log('Map container found, initializing map...');
    initMap();
    loadRouteHistory();
    loadAllDangerZones(); // Load verified danger zones on map
    setupLocationAutocomplete();
    
    // Mobile-specific enhancements
    if (window.innerWidth <= 768) {
        initMobileEnhancements();
    }
});

// Mobile Enhancements
function initMobileEnhancements() {
    console.log('Initializing mobile enhancements...');
    
    // Bottom sheet for intelligence panel
    setupBottomSheet();
    
    // Swipeable route cards
    setupSwipeableRoutes();
    
    // Pull to refresh
    setupPullToRefresh();
    
    // Haptic feedback simulation
    setupHapticFeedback();
    
    // Gesture controls
    setupGestureControls();
}

// Bottom Sheet Intelligence Panel
function setupBottomSheet() {
    const panel = document.getElementById('intelligencePanel');
    if (!panel) return;
    
    const header = panel.querySelector('.panel-header');
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    header.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
        panel.style.transition = 'none';
    });
    
    header.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 0) {
            panel.style.transform = `translateY(${diff}px)`;
        }
    });
    
    header.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        panel.style.transition = 'transform 0.3s ease';
        
        const diff = currentY - startY;
        if (diff > 100) {
            panel.classList.add('minimized');
            panel.style.transform = '';
        } else if (diff < -50) {
            panel.classList.remove('minimized');
            panel.style.transform = '';
        } else {
            panel.style.transform = '';
        }
    });
    
    // Tap to toggle
    header.addEventListener('click', () => {
        panel.classList.toggle('minimized');
    });
}

// Swipeable Route Cards
function setupSwipeableRoutes() {
    const routesList = document.getElementById('routesList');
    if (!routesList) return;
    
    let isScrolling = false;
    let startX = 0;
    let scrollLeft = 0;
    
    routesList.addEventListener('touchstart', (e) => {
        isScrolling = true;
        startX = e.touches[0].pageX - routesList.offsetLeft;
        scrollLeft = routesList.scrollLeft;
    });
    
    routesList.addEventListener('touchmove', (e) => {
        if (!isScrolling) return;
        e.preventDefault();
        const x = e.touches[0].pageX - routesList.offsetLeft;
        const walk = (x - startX) * 2;
        routesList.scrollLeft = scrollLeft - walk;
    });
    
    routesList.addEventListener('touchend', () => {
        isScrolling = false;
    });
    
    // Snap to nearest card
    routesList.addEventListener('scroll', debounce(() => {
        const cards = routesList.querySelectorAll('.route-card');
        const scrollPosition = routesList.scrollLeft;
        const cardWidth = cards[0]?.offsetWidth || 0;
        const gap = 12;
        const nearestIndex = Math.round(scrollPosition / (cardWidth + gap));
        
        if (cards[nearestIndex]) {
            cards[nearestIndex].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
        }
    }, 100));
}

// Pull to Refresh
function setupPullToRefresh() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    let startY = 0;
    let isPulling = false;
    
    sidebar.addEventListener('touchstart', (e) => {
        if (sidebar.scrollTop === 0) {
            startY = e.touches[0].clientY;
            isPulling = true;
        }
    });
    
    sidebar.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 80 && sidebar.scrollTop === 0) {
            showNotification('Release to refresh', 'info');
        }
    });
    
    sidebar.addEventListener('touchend', (e) => {
        if (!isPulling) return;
        isPulling = false;
        
        const currentY = e.changedTouches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 80 && sidebar.scrollTop === 0) {
            loadRouteHistory();
            showNotification('Refreshed', 'success');
        }
    });
}

// Haptic Feedback Simulation
function setupHapticFeedback() {
    // Vibrate on button press (if supported)
    const buttons = document.querySelectorAll('.btn-primary, .control-btn, .route-card, .quick-action-btn');
    
    buttons.forEach(button => {
        button.addEventListener('touchstart', () => {
            if ('vibrate' in navigator) {
                navigator.vibrate(10); // 10ms vibration
            }
        }, { passive: true }); // Mark as passive for better performance
    });
}

// Gesture Controls
function setupGestureControls() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    let touchStartX = 0;
    let touchStartY = 0;
    
    mapContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true }); // Mark as passive
    
    mapContainer.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        
        // Swipe from left edge to open sidebar
        if (touchStartX < 50 && diffX > 100 && Math.abs(diffY) < 50) {
            document.getElementById('sidebar').classList.add('active');
        }
        
        // Swipe from right to close sidebar
        if (touchStartX > window.innerWidth - 50 && diffX < -100 && Math.abs(diffY) < 50) {
            document.getElementById('sidebar').classList.remove('active');
        }
    }, { passive: true }); // Mark as passive
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
    if (updateTimer) {
        clearInterval(updateTimer);
    }
});


// ═══════════════════════════════════════════════════════════════════════════
// DANGER ZONE PROXIMITY DETECTION & ALERTS
// ═══════════════════════════════════════════════════════════════════════════

let allDangerZones = [];
let userCurrentLocation = null;
let proximityCheckInterval = null;
let alertedZones = new Set(); // Track which zones we've already alerted for

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// Check if user is near any danger zones
function checkDangerZoneProximity() {
    if (!userCurrentLocation || allDangerZones.length === 0) return;

    const { lat, lng } = userCurrentLocation;
    const alertThreshold = 500; // Alert when within 500 meters

    for (const zone of allDangerZones) {
        const distance = calculateDistance(lat, lng, zone.latitude, zone.longitude);
        const zoneRadius = zone.radius_meters || 200;
        
        // Check if within alert threshold or inside zone
        if (distance <= (zoneRadius + alertThreshold)) {
            // Only alert once per zone per session
            if (!alertedZones.has(zone.id)) {
                alertedZones.add(zone.id);
                showDangerZoneAlert(zone, distance);
                break; // Show one alert at a time
            }
        } else {
            // If user moves away, allow re-alerting if they come back
            if (distance > (zoneRadius + alertThreshold + 200)) {
                alertedZones.delete(zone.id);
            }
        }
    }
}

// Show danger zone alert modal
function showDangerZoneAlert(zone, distance) {
    const modal = document.getElementById('dangerZoneAlertModal');
    if (!modal) return;

    // Populate modal with zone information
    document.getElementById('dangerZoneName').textContent = zone.place_name || zone.placeName || 'Unknown Location';
    
    // Risk level badge
    const riskBadge = document.getElementById('dangerZoneRiskBadge');
    const riskLevel = (zone.risk_level || zone.riskLevel || 'medium').toLowerCase();
    riskBadge.textContent = riskLevel.toUpperCase();
    riskBadge.className = `risk-badge ${riskLevel}`;
    
    // Category
    const categoryMap = {
        'vehicular_fatality_zone': 'Vehicular Fatality Zone',
        'freight_collision_zone': 'Freight Collision Zone',
        'pedestrian_accident_zone': 'Pedestrian Accident Zone',
        'crime_hotspot': 'Crime Hotspot',
        'theft': 'Theft Area',
        'harassment': 'Harassment Zone',
        'general': 'General Danger'
    };
    document.getElementById('dangerZoneCategory').textContent = categoryMap[zone.category] || zone.category || 'General';
    
    // Distance
    const distanceText = distance < 1000 
        ? `${Math.round(distance)} meters away`
        : `${(distance / 1000).toFixed(1)} km away`;
    document.getElementById('dangerZoneDistance').textContent = distanceText;
    
    // Description
    document.getElementById('dangerZoneDescription').textContent = 
        zone.description || 'This area has been identified as a high-risk zone. Exercise caution when traveling through this area.';
    
    // Active hours
    document.getElementById('dangerZoneActiveHours').textContent = 
        zone.active_hours || zone.activeHours || '24/7';
    
    // Update recommendations based on risk level
    const recommendations = document.getElementById('dangerZoneRecommendations');
    let recommendationsList = [];
    
    if (riskLevel === 'critical') {
        recommendationsList = [
            '🚨 Avoid this area if possible - find an alternative route',
            '📱 Keep emergency contacts readily accessible',
            '👥 Travel in groups if you must pass through',
            '🚗 Use a vehicle instead of walking',
            '⚡ Stay on main roads and avoid shortcuts'
        ];
    } else if (riskLevel === 'high') {
        recommendationsList = [
            '⚠️ Exercise extreme caution in this area',
            '👀 Stay alert and aware of your surroundings',
            '📱 Keep your phone charged and accessible',
            '🌙 Avoid traveling through this area at night',
            '👥 Consider traveling with others'
        ];
    } else if (riskLevel === 'medium') {
        recommendationsList = [
            '👀 Stay alert and aware of your surroundings',
            '💡 Stick to well-lit and populated areas',
            '📱 Keep your phone accessible',
            '🚶 Avoid isolated areas and shortcuts'
        ];
    } else {
        recommendationsList = [
            '👀 Stay aware of your surroundings',
            '💡 Stick to main roads when possible',
            '📱 Keep your phone accessible',
            '🚶 Exercise normal caution'
        ];
    }
    
    recommendations.innerHTML = recommendationsList.map(rec => `<li>${rec}</li>`).join('');
    
    // Update alert title based on distance
    const alertTitle = document.getElementById('dangerZoneAlertTitle');
    const alertSubtitle = document.getElementById('dangerZoneAlertSubtitle');
    
    if (distance < zone.radius_meters) {
        alertTitle.textContent = '🚨 You Are In A Danger Zone';
        alertSubtitle.textContent = 'Exercise extreme caution';
    } else if (distance < 200) {
        alertTitle.textContent = '⚠️ Danger Zone Ahead';
        alertSubtitle.textContent = 'You are approaching a high-risk area';
    } else {
        alertTitle.textContent = '⚠️ Danger Zone Nearby';
        alertSubtitle.textContent = 'A high-risk area is in your vicinity';
    }
    
    // Show modal
    modal.style.display = 'flex';
    
    // Play alert sound (optional)
    playAlertSound();
}

// Play loud alert sound for danger zones
function playAlertSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create a more urgent, louder alert sound
        // Play three beeps in succession
        const times = [0, 0.3, 0.6]; // Three beeps
        
        times.forEach((startTime) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Higher frequency for urgency
            oscillator.frequency.value = 1200;
            oscillator.type = 'square'; // Square wave for more piercing sound
            
            // Louder volume
            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime + startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + 0.2);
            
            oscillator.start(audioContext.currentTime + startTime);
            oscillator.stop(audioContext.currentTime + startTime + 0.2);
        });
        
        // Add a final longer beep for emphasis
        setTimeout(() => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 1000;
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        }, 800);
        
    } catch (error) {
        // Silently fail if audio not supported
        console.warn('Audio alert not supported:', error);
    }
}

// Close danger zone alert
document.getElementById('closeDangerZoneAlert')?.addEventListener('click', () => {
    document.getElementById('dangerZoneAlertModal').style.display = 'none';
});

document.getElementById('continueAnyway')?.addEventListener('click', () => {
    document.getElementById('dangerZoneAlertModal').style.display = 'none';
});

document.getElementById('viewAlternativeRoute')?.addEventListener('click', () => {
    document.getElementById('dangerZoneAlertModal').style.display = 'none';
    // Trigger route recalculation with danger zone avoidance
    if (routes && routes.length > 1) {
        // Select the safest route
        const safestRoute = routes.reduce((prev, current) => 
            (prev.dangerZoneCount < current.dangerZoneCount) ? prev : current
        );
        selectRoute(routes.indexOf(safestRoute));
        showNotification('Switched to safer route', 'success');
    } else {
        showNotification('No alternative routes available', 'info');
    }
});

// Start proximity monitoring when user location is available
function startProximityMonitoring() {
    if (proximityCheckInterval) {
        clearInterval(proximityCheckInterval);
    }
    
    // Check every 10 seconds
    proximityCheckInterval = setInterval(checkDangerZoneProximity, 10000);
    
    // Also check immediately
    checkDangerZoneProximity();
}

// Update user location and check proximity
function updateUserLocation(lat, lng) {
    userCurrentLocation = { lat, lng };
    checkDangerZoneProximity();
}

// Store danger zones when loaded
const originalDisplayDangerZones = displayDangerZones;
displayDangerZones = function(zones) {
    allDangerZones = zones || [];
    originalDisplayDangerZones(zones);
    
    // Start monitoring if we have user location
    if (userCurrentLocation) {
        checkDangerZoneProximity();
    }
};

// Watch user location continuously
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            updateUserLocation(position.coords.latitude, position.coords.longitude);
            
            // Start monitoring if not already started
            if (!proximityCheckInterval) {
                startProximityMonitoring();
            }
        },
        (error) => {
            console.error('Location watch error:', error);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 5000
        }
    );
}
