/**
 * SafeTrace Service - Production-Ready Risk-Aware Navigation
 * 
 * This service handles:
 * - Route fetching from OpenRouteService API
 * - Risk score calculation based on danger zones
 * - Route comparison and optimization
 * - Intelligent caching and performance optimization
 */

const axios = require('axios');
const polyline = require('@mapbox/polyline');
const { getDangerZonesAlongRoute, getVerifiedDangerZonesAlongRoute } = require('../store/db');

const OPENROUTE_API_KEY = process.env.OPENROUTE_API_KEY;
const OPENROUTE_BASE_URL = 'https://api.openrouteservice.org/v2';
const GEOCODE_BASE_URL = 'https://api.openrouteservice.org/geocode';

// Cache for geocoding results (1 hour TTL)
const geocodeCache = new Map();
const GEOCODE_CACHE_TTL = 60 * 60 * 1000;

// Cache for routes (30 seconds TTL for testing, increase in production)
const routeCache = new Map();
const ROUTE_CACHE_TTL = 30 * 1000; // 30 seconds

// Clear cache periodically to prevent stale data
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of routeCache.entries()) {
        if (now - value.timestamp > ROUTE_CACHE_TTL) {
            routeCache.delete(key);
        }
    }
    for (const [key, value] of geocodeCache.entries()) {
        if (now - value.timestamp > GEOCODE_CACHE_TTL) {
            geocodeCache.delete(key);
        }
    }
}, 60 * 1000); // Clean every minute

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Retry helper function with exponential backoff
 */
async function retryWithBackoff(fn, retries = MAX_RETRIES, delay = RETRY_DELAY) {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) {
            throw error;
        }
        
        // Check if error is retryable (timeout, network error, 5xx)
        const isRetryable = 
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNABORTED' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ECONNRESET' ||
            (error.response && error.response.status >= 500);
        
        if (!isRetryable) {
            throw error;
        }
        
        console.log(`Request failed, retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff
        return retryWithBackoff(fn, retries - 1, delay * 2);
    }
}
// Severity weights for risk calculation
const SEVERITY_WEIGHTS = {
    low: 1,
    medium: 3,
    high: 7,
    critical: 15
};

// Category risk multipliers
const CATEGORY_MULTIPLIERS = {
    crime: 1.5,
    accident: 1.2,
    harassment: 1.4,
    theft: 1.3,
    assault: 1.8,
    general: 1.0
};

/**
 * Geocode an address to coordinates using Nominatim (OpenStreetMap) as fallback
 */
async function geocodeAddress(address) {
    // Check cache
    const cacheKey = address.toLowerCase().trim();
    const cached = geocodeCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_TTL) {
        return cached.data;
    }

    // Try OpenRouteService first with retry logic
    try {
        const result = await retryWithBackoff(async () => {
            const response = await axios.get(`${GEOCODE_BASE_URL}/search`, {
                params: {
                    api_key: OPENROUTE_API_KEY,
                    text: address,
                    size: 1
                },
                headers: {
                    'Accept': 'application/json'
                },
                timeout: 15000 // 15 seconds timeout
            });

            if (response.data.features && response.data.features.length > 0) {
                const feature = response.data.features[0];
                return {
                    latitude: feature.geometry.coordinates[1],
                    longitude: feature.geometry.coordinates[0],
                    address: feature.properties.label
                };
            }
            throw new Error('No results found');
        });

        // Cache result
        geocodeCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });

        return result;
    } catch (error) {
        console.warn('OpenRouteService geocoding failed, trying Nominatim fallback:', error.message);
    }

    // Fallback to Nominatim (OpenStreetMap) - has ALL locations worldwide
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: address,
                format: 'json',
                limit: 10, // Get top 10 results for better filtering
                addressdetails: 1,
                // Bias results towards India/Mumbai area
                countrycodes: 'in', // Limit to India
                bounded: 0,
                viewbox: '72.7,19.3,73.0,18.9' // Mumbai bounding box (west,north,east,south)
            },
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'SafeNex-SafeTrace/1.0' // Required by Nominatim
            },
            timeout: 30000 // Increased to 30 seconds
        });

        if (response.data && response.data.length > 0) {
            console.log(`Nominatim returned ${response.data.length} results for "${address}"`);
            
            // Mumbai center coordinates for distance validation
            const MUMBAI_CENTER_LAT = 19.0760;
            const MUMBAI_CENTER_LNG = 72.8777;
            const MAX_DISTANCE_FROM_MUMBAI = 100000; // 100km radius from Mumbai center
            
            // Filter and score results
            const scoredResults = response.data.map(loc => {
                const lat = parseFloat(loc.lat);
                const lng = parseFloat(loc.lon);
                const displayName = loc.display_name.toLowerCase();
                
                // Calculate distance from Mumbai center
                const distanceFromMumbai = calculateDistance(lat, lng, MUMBAI_CENTER_LAT, MUMBAI_CENTER_LNG);
                
                let score = 0;
                
                // Highest priority: Results within Mumbai bounding box
                if (lat >= 18.8 && lat <= 19.3 && lng >= 72.7 && lng <= 73.1) {
                    score += 1000;
                }
                
                // High priority: Results mentioning Mumbai
                if (displayName.includes('mumbai')) {
                    score += 500;
                }
                
                // Medium priority: Results in Maharashtra
                if (displayName.includes('maharashtra')) {
                    score += 200;
                }
                
                // Distance penalty: Closer to Mumbai center is better
                score -= distanceFromMumbai / 1000; // Subtract km distance
                
                // Importance score from Nominatim (higher is better)
                if (loc.importance) {
                    score += loc.importance * 100;
                }
                
                return {
                    ...loc,
                    lat,
                    lng,
                    distanceFromMumbai,
                    score
                };
            });
            
            // Sort by score (highest first)
            scoredResults.sort((a, b) => b.score - a.score);
            
            // Log top 3 results for debugging
            console.log('Top 3 geocoding results:');
            scoredResults.slice(0, 3).forEach((loc, i) => {
                console.log(`  ${i + 1}. ${loc.display_name}`);
                console.log(`     Coords: [${loc.lat}, ${loc.lng}], Distance from Mumbai: ${(loc.distanceFromMumbai/1000).toFixed(1)}km, Score: ${loc.score.toFixed(1)}`);
            });
            
            // Select best result
            const bestResult = scoredResults[0];
            
            // Validate: Reject if too far from Mumbai (likely wrong location)
            if (bestResult.distanceFromMumbai > MAX_DISTANCE_FROM_MUMBAI) {
                console.warn(`Best result is ${(bestResult.distanceFromMumbai/1000).toFixed(1)}km from Mumbai, likely incorrect`);
                
                // Try to find a closer alternative
                const closerResult = scoredResults.find(loc => loc.distanceFromMumbai <= MAX_DISTANCE_FROM_MUMBAI);
                
                if (closerResult) {
                    console.log(`Using closer alternative: ${closerResult.display_name}`);
                    const result = {
                        latitude: closerResult.lat,
                        longitude: closerResult.lng,
                        address: closerResult.display_name
                    };
                    
                    geocodeCache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                    
                    return result;
                } else {
                    throw new Error(`Location "${address}" appears to be outside the Mumbai area. Please verify the address or try a different search term.`);
                }
            }
            
            const result = {
                latitude: bestResult.lat,
                longitude: bestResult.lng,
                address: bestResult.display_name
            };

            console.log('Selected geocoding result:', result);

            // Cache result
            geocodeCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;
        }

        throw new Error('Address not found');
    } catch (error) {
        console.error('Geocoding error:', error.message);
        
        if (error.response?.status === 404) {
            throw new Error('Address not found. Please try a different search term.');
        } else if (error.response?.status === 429) {
            throw new Error('Too many requests. Please try again in a moment.');
        }
        
        throw new Error(`Failed to geocode address: ${error.message}`);
    }
}

/**
 * Reverse geocode coordinates to address
 */
async function reverseGeocode(latitude, longitude) {
    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    const cached = geocodeCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_TTL) {
        return cached.data;
    }

    try {
        const response = await axios.get(`${GEOCODE_BASE_URL}/reverse`, {
            params: {
                api_key: OPENROUTE_API_KEY,
                'point.lon': longitude,
                'point.lat': latitude,
                size: 1
            },
            headers: {
                'Accept': 'application/json'
            },
            timeout: 30000 // Increased to 30 seconds
        });

        if (response.data.features && response.data.features.length > 0) {
            const address = response.data.features[0].properties.label;
            
            geocodeCache.set(cacheKey, {
                data: address,
                timestamp: Date.now()
            });

            return address;
        }

        return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    } catch (error) {
        console.error('Reverse geocoding error:', error.message);
        return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }
}

/**
 * Fetch multiple route alternatives from OpenRouteService
 * @param {string} profile - Travel mode: 'foot-walking', 'cycling-regular', 'driving-car'
 */
async function fetchRoutes(startLat, startLng, endLat, endLng, profile = 'foot-walking', alternatives = 3, avoidAreas = []) {
    if (!OPENROUTE_API_KEY) {
        throw new Error('OpenRouteService API key not configured');
    }

    // Check cache first - include travel mode AND avoidance areas in cache key
    const avoidKey = avoidAreas.length > 0 ? `-avoid${avoidAreas.length}` : '';
    const cacheKey = `${startLat.toFixed(5)},${startLng.toFixed(5)}-${endLat.toFixed(5)},${endLng.toFixed(5)}-${profile}${avoidKey}`;
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ROUTE_CACHE_TTL) {
        console.log(`Returning cached routes for ${profile} (cache key: ${cacheKey})`);
        return cached.data;
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    // Check distance before making API call
    const distance = calculateDistance(startLat, startLng, endLat, endLng);
    const distanceKm = distance / 1000;
    
    // Distance limits vary by profile
    const distanceLimits = {
        'foot-walking': 150,
        'cycling-regular': 300,
        'driving-car': 6000
    };
    
    const maxDistance = distanceLimits[profile] || 150;
    
    if (distanceKm > maxDistance) {
        throw new Error(`Destination is too far (${distanceKm.toFixed(1)}km). ${profile} routes are limited to ${maxDistance}km.`);
    }
    
    // Warn if distance is very long
    if (distanceKm > 50 && profile === 'foot-walking') {
        console.warn(`Long distance walking route requested: ${distanceKm.toFixed(1)}km`);
    }

    // Build request body with optimized alternative routes configuration
    const requestBody = {
        coordinates: [
            [startLng, startLat],
            [endLng, endLat]
        ],
        alternative_routes: {
            target_count: Math.max(alternatives, 3), // Request at least 3 alternatives
            weight_factor: 1.6, // Increased from 1.4 for more diverse routes
            share_factor: 0.5   // Decreased from 0.6 to allow more different routes
        },
        elevation: false,
        instructions: true,
        preference: 'recommended',
        geometry_simplify: false,
        continue_straight: false,
        // Request extra routes to ensure we get alternatives
        extra_info: ['waytype', 'steepness']
    };

    console.log(`Fetching routes from [${startLat}, ${startLng}] to [${endLat}, ${endLng}] for ${profile}`);

    // Add avoidance areas if provided (for danger zones)
    if (avoidAreas && avoidAreas.length > 0) {
        requestBody.options = {
            avoid_polygons: {
                type: 'Polygon',
                coordinates: avoidAreas
            }
        };
        console.log(`Avoiding ${avoidAreas.length} danger zone areas`);
    }

    const endpoint = `${OPENROUTE_BASE_URL}/directions/${profile}`;

    try {
        const response = await retryWithBackoff(async () => {
            return await axios.post(
                endpoint,
                requestBody,
                {
                    headers: {
                        'Authorization': OPENROUTE_API_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
                    },
                    timeout: 45000 // 45 seconds timeout (reduced from 60s for faster retries)
                }
            );
        });

        if (!response.data.routes || response.data.routes.length === 0) {
            throw new Error('No routes found');
        }

        console.log('OpenRouteService response structure:', {
            hasRoutes: !!response.data.routes,
            routeCount: response.data.routes?.length,
            firstRouteKeys: response.data.routes?.[0] ? Object.keys(response.data.routes[0]) : [],
            profile: profile,
            requestedAlternatives: alternatives
        });

        const routes = response.data.routes.map((route, index) => {
            console.log(`Processing route ${index} for ${profile}:`, {
                hasGeometry: !!route.geometry,
                geometryType: typeof route.geometry,
                hasSummary: !!route.summary,
                hasSegments: !!route.segments,
                distance: route.summary?.distance,
                duration: route.summary?.duration
            });

            // OpenRouteService returns geometry as encoded polyline string by default
            let coordinates;
            
            if (route.geometry) {
                // Check if it's an encoded polyline string
                if (typeof route.geometry === 'string') {
                    console.log(`Route ${index}: Decoding polyline geometry`);
                    try {
                        // Decode the polyline - returns [[lat, lng], [lat, lng], ...]
                        const decoded = polyline.decode(route.geometry);
                        // Convert to [lng, lat] format for consistency
                        coordinates = decoded.map(coord => [coord[1], coord[0]]);
                        console.log(`Route ${index}: Decoded ${coordinates.length} coordinates`);
                    } catch (decodeError) {
                        console.error('Failed to decode polyline:', decodeError);
                        throw new Error('Failed to decode route geometry');
                    }
                } 
                // Check if it's GeoJSON format with coordinates array
                else if (typeof route.geometry === 'object' && route.geometry.coordinates) {
                    coordinates = route.geometry.coordinates;
                    console.log(`Route ${index}: Using GeoJSON coordinates (${coordinates.length} points)`);
                } 
                // Unknown format
                else {
                    console.error('Unknown geometry format:', route.geometry);
                    throw new Error('Unknown geometry format in route response');
                }
            } else {
                console.error('No geometry found in route');
                throw new Error('Route has no geometry data');
            }

            if (!coordinates || coordinates.length === 0) {
                throw new Error('Route has empty coordinates array');
            }

            const processedRoute = {
                id: `route_${index}`,
                coordinates: coordinates,
                distance: route.summary.distance, // meters
                duration: route.summary.duration, // seconds
                instructions: route.segments?.[0]?.steps?.map(step => ({
                    instruction: step.instruction,
                    distance: step.distance,
                    duration: step.duration,
                    type: step.type
                })) || []
            };

            console.log(`Route ${index} processed:`, {
                distance: processedRoute.distance,
                duration: processedRoute.duration,
                durationMin: Math.round(processedRoute.duration / 60)
            });

            return processedRoute;
        });

        // If we only got 1 route but requested more, try to get alternatives with different preferences
        // This happens often when avoidance areas are used
        if (routes.length < 3 && alternatives > 1) {
            console.log(`Only ${routes.length} route(s) returned, attempting to fetch alternatives with different preferences...`);
            
            try {
                // Try with 'shortest' preference for a different route
                const shortestRequest = {
                    ...requestBody,
                    preference: 'shortest',
                    alternative_routes: undefined // Remove alternative_routes for single route request
                };
                
                const shortestResponse = await retryWithBackoff(async () => {
                    return await axios.post(endpoint, shortestRequest, {
                        headers: {
                            'Authorization': OPENROUTE_API_KEY,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
                        },
                        timeout: 45000
                    });
                });

                if (shortestResponse.data.routes && shortestResponse.data.routes.length > 0) {
                    const shortestRoute = shortestResponse.data.routes[0];
                    
                    // Check if it's different from existing routes (1% threshold)
                    const distanceDiff = Math.abs(shortestRoute.summary.distance - routes[0].distance);
                    const isDifferent = distanceDiff > routes[0].distance * 0.01; // Reduced to 1%
                    
                    console.log(`Shortest route: ${shortestRoute.summary.distance}m, difference: ${distanceDiff}m (${(distanceDiff/routes[0].distance*100).toFixed(1)}%), isDifferent: ${isDifferent}`);
                    
                    if (isDifferent) {
                        let coordinates;
                        if (typeof shortestRoute.geometry === 'string') {
                            const decoded = polyline.decode(shortestRoute.geometry);
                            coordinates = decoded.map(coord => [coord[1], coord[0]]);
                        } else if (shortestRoute.geometry.coordinates) {
                            coordinates = shortestRoute.geometry.coordinates;
                        }

                        if (coordinates && coordinates.length > 0) {
                            routes.push({
                                id: `route_${routes.length}`,
                                coordinates: coordinates,
                                distance: shortestRoute.summary.distance,
                                duration: shortestRoute.summary.duration,
                                instructions: shortestRoute.segments?.[0]?.steps?.map(step => ({
                                    instruction: step.instruction,
                                    distance: step.distance,
                                    duration: step.duration,
                                    type: step.type
                                })) || []
                            });
                            console.log('Added shortest route as alternative');
                        }
                    } else {
                        console.log('Shortest route too similar, skipping');
                    }
                }
            } catch (altError) {
                console.warn('Failed to fetch shortest route alternative:', altError.message);
            }

            // Try with 'fastest' preference if we still need more routes
            if (routes.length < alternatives) {
                try {
                    const fastestRequest = {
                        ...requestBody,
                        preference: 'fastest',
                        alternative_routes: undefined
                    };
                    
                    const fastestResponse = await retryWithBackoff(async () => {
                        return await axios.post(endpoint, fastestRequest, {
                            headers: {
                                'Authorization': OPENROUTE_API_KEY,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
                            },
                            timeout: 45000
                        });
                    });

                    if (fastestResponse.data.routes && fastestResponse.data.routes.length > 0) {
                        const fastestRoute = fastestResponse.data.routes[0];
                        
                        // Check if different from existing routes (1% threshold)
                        const isDifferent = routes.every(r => {
                            const distanceDiff = Math.abs(fastestRoute.summary.distance - r.distance);
                            const percentDiff = (distanceDiff / r.distance) * 100;
                            console.log(`Fastest route vs route ${r.id}: ${fastestRoute.summary.distance}m vs ${r.distance}m, diff: ${percentDiff.toFixed(1)}%`);
                            return distanceDiff > r.distance * 0.01; // Reduced to 1%
                        });

                        console.log(`Fastest route isDifferent: ${isDifferent}`);

                        if (isDifferent) {
                            let coordinates;
                            if (typeof fastestRoute.geometry === 'string') {
                                const decoded = polyline.decode(fastestRoute.geometry);
                                coordinates = decoded.map(coord => [coord[1], coord[0]]);
                            } else if (fastestRoute.geometry.coordinates) {
                                coordinates = fastestRoute.geometry.coordinates;
                            }

                            if (coordinates && coordinates.length > 0) {
                                routes.push({
                                    id: `route_${routes.length}`,
                                    coordinates: coordinates,
                                    distance: fastestRoute.summary.distance,
                                    duration: fastestRoute.summary.duration,
                                    instructions: fastestRoute.segments?.[0]?.steps?.map(step => ({
                                        instruction: step.instruction,
                                        distance: step.distance,
                                        duration: step.duration,
                                        type: step.type
                                    })) || []
                                });
                                console.log('Added fastest route as alternative');
                            }
                        }
                    }
                } catch (altError) {
                    console.warn('Failed to fetch fastest route alternative:', altError.message);
                }
            }

            // If we still only have 1 route and had avoidance areas, try without avoidance
            if (routes.length < 2 && avoidAreas.length > 0) {
                console.log('Trying to get alternative route without danger zone avoidance...');
                console.log('Using coordinates:', {
                    start: [startLng, startLat],
                    end: [endLng, endLat]
                });
                
                try {
                    const noAvoidRequest = {
                        coordinates: [
                            [startLng, startLat],  // Explicitly use original coordinates
                            [endLng, endLat]
                        ],
                        alternative_routes: {
                            target_count: 2,
                            weight_factor: 1.6,
                            share_factor: 0.5
                        },
                        elevation: false,
                        instructions: true,
                        preference: 'recommended',
                        geometry_simplify: false,
                        continue_straight: false
                        // No avoidance areas
                    };

                    const noAvoidResponse = await retryWithBackoff(async () => {
                        return await axios.post(endpoint, noAvoidRequest, {
                            headers: {
                                'Authorization': OPENROUTE_API_KEY,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
                            },
                            timeout: 45000
                        });
                    });

                    if (noAvoidResponse.data.routes && noAvoidResponse.data.routes.length > 0) {
                        console.log(`Received ${noAvoidResponse.data.routes.length} routes without avoidance`);
                        
                        for (const altRoute of noAvoidResponse.data.routes) {
                            // Check if different from existing routes (1% threshold)
                            const isDifferent = routes.every(r => {
                                const distanceDiff = Math.abs(altRoute.summary.distance - r.distance);
                                const percentDiff = (distanceDiff / r.distance) * 100;
                                console.log(`No-avoid route vs route ${r.id}: ${altRoute.summary.distance}m vs ${r.distance}m, diff: ${percentDiff.toFixed(1)}%`);
                                return distanceDiff > r.distance * 0.01; // Reduced to 1%
                            });

                            console.log(`No-avoid route isDifferent: ${isDifferent}`);

                            if (isDifferent) {
                                let coordinates;
                                if (typeof altRoute.geometry === 'string') {
                                    const decoded = polyline.decode(altRoute.geometry);
                                    coordinates = decoded.map(coord => [coord[1], coord[0]]);
                                } else if (altRoute.geometry.coordinates) {
                                    coordinates = altRoute.geometry.coordinates;
                                }

                                if (coordinates && coordinates.length > 0) {
                                    routes.push({
                                        id: `route_${routes.length}`,
                                        coordinates: coordinates,
                                        distance: altRoute.summary.distance,
                                        duration: altRoute.summary.duration,
                                        instructions: altRoute.segments?.[0]?.steps?.map(step => ({
                                            instruction: step.instruction,
                                            distance: step.distance,
                                            duration: step.duration,
                                            type: step.type
                                        })) || []
                                    });
                                    console.log('Added alternative route without avoidance');
                                    
                                    // Stop after adding 2 alternatives
                                    if (routes.length >= 3) break;
                                }
                            }
                        }
                    }
                } catch (altError) {
                    console.warn('Failed to fetch routes without avoidance:', altError.message);
                }
            }
        }

        console.log(`Final route count: ${routes.length} routes`);

        // Cache the results with detailed logging
        console.log(`Caching routes with key: ${cacheKey}`);
        console.log(`Routes go from [${startLat}, ${startLng}] to [${endLat}, ${endLng}]`);
        
        routeCache.set(cacheKey, {
            data: routes,
            timestamp: Date.now(),
            // Store metadata for debugging
            metadata: {
                start: [startLat, startLng],
                end: [endLat, endLng],
                profile: profile
            }
        });

        return routes;
    } catch (error) {
        console.error('Route fetching error:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            throw new Error('Invalid API key configuration');
        } else if (error.response?.status === 429) {
            throw new Error('API rate limit exceeded. Please try again in a few minutes.');
        } else if (error.response?.status === 404) {
            const errorMsg = error.response?.data?.error?.message || '';
            if (errorMsg.includes('Route could not be found')) {
                throw new Error('No route found between these locations. The area may not have road data, or the points are not accessible by the selected travel mode. Try different locations or travel mode.');
            }
            throw new Error('Route not found. Please try different locations.');
        } else if (error.response?.status === 400) {
            const errorMsg = error.response?.data?.error?.message || '';
            if (errorMsg.includes('distance must not be greater than')) {
                throw new Error('Destination is too far for walking routes. Please choose a closer location (within 150km).');
            }
            throw new Error('Invalid route request. Please check your start and end locations.');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            throw new Error('Request timed out. The routing service may be slow or unavailable. Please try again in a moment.');
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
            throw new Error('Network error. Please check your internet connection and try again.');
        }
        
        throw new Error(`Failed to fetch routes: ${error.message}`);
    }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
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

/**
 * Calculate risk score for a route based on danger zones
 */
function calculateRouteRisk(route, dangerZones) {
    if (!dangerZones || dangerZones.length === 0) {
        return {
            totalRisk: 0,
            riskLevel: 'safe',
            affectedZones: [],
            riskFactors: []
        };
    }

    let totalRisk = 0;
    const affectedZones = [];
    const riskFactors = [];

    // Check each point on the route against danger zones
    for (const coord of route.coordinates) {
        const [lng, lat] = coord;

        for (const zone of dangerZones) {
            const distance = calculateDistance(lat, lng, zone.latitude, zone.longitude);

            // Check if route point is within danger zone radius
            if (distance <= zone.radius) {
                const baseWeight = SEVERITY_WEIGHTS[zone.severity] || 1;
                const categoryMultiplier = CATEGORY_MULTIPLIERS[zone.category] || 1;
                
                // Calculate decay based on age (older reports have less weight)
                const ageInDays = (Date.now() - new Date(zone.lastReported).getTime()) / (1000 * 60 * 60 * 24);
                const decayFactor = Math.max(0.3, 1 - (ageInDays / 90)); // Decay over 90 days, minimum 30%
                
                // Calculate recency boost (recent reports get more weight)
                const recencyBoost = ageInDays < 7 ? 1.5 : ageInDays < 30 ? 1.2 : 1.0;
                
                // Calculate report count boost (multiple reports increase weight)
                const reportBoost = Math.min(2.0, 1 + (zone.reportCount - 1) * 0.1);
                
                // Calculate proximity factor (closer = higher risk)
                const proximityFactor = 1 - (distance / zone.radius);
                
                const riskContribution = baseWeight * categoryMultiplier * decayFactor * 
                                       recencyBoost * reportBoost * proximityFactor;

                totalRisk += riskContribution;

                // Track unique affected zones
                if (!affectedZones.find(z => z.id === zone.id)) {
                    affectedZones.push({
                        id: zone.id,
                        severity: zone.severity,
                        category: zone.category,
                        description: zone.description,
                        distance: Math.round(distance),
                        reportCount: zone.reportCount,
                        lastReported: zone.lastReported
                    });
                }
            }
        }
    }

    // Normalize risk score (0-100 scale)
    const normalizedRisk = Math.min(100, Math.round(totalRisk));

    // Determine risk level
    let riskLevel;
    if (normalizedRisk === 0) riskLevel = 'safe';
    else if (normalizedRisk < 20) riskLevel = 'low';
    else if (normalizedRisk < 50) riskLevel = 'medium';
    else if (normalizedRisk < 80) riskLevel = 'high';
    else riskLevel = 'critical';

    // Generate risk factors explanation
    if (affectedZones.length > 0) {
        const severityCounts = affectedZones.reduce((acc, zone) => {
            acc[zone.severity] = (acc[zone.severity] || 0) + 1;
            return acc;
        }, {});

        for (const [severity, count] of Object.entries(severityCounts)) {
            riskFactors.push(`${count} ${severity} risk zone${count > 1 ? 's' : ''}`);
        }

        const recentZones = affectedZones.filter(z => {
            const ageInDays = (Date.now() - new Date(z.lastReported).getTime()) / (1000 * 60 * 60 * 24);
            return ageInDays < 7;
        });

        if (recentZones.length > 0) {
            riskFactors.push(`${recentZones.length} recent report${recentZones.length > 1 ? 's' : ''} (last 7 days)`);
        }
    }

    return {
        totalRisk: normalizedRisk,
        riskLevel,
        affectedZones: affectedZones.slice(0, 5), // Top 5 zones
        riskFactors
    };
}

/**
 * Enhanced risk calculation with verified danger zones and time-based penalties
 */
function calculateRouteRiskWithVerifiedZones(route, userDangerZones, verifiedDangerZones) {
    let totalRisk = 0;
    const affectedZones = [];
    const riskFactors = [];
    const currentHour = new Date().getHours();

    // Process user-reported danger zones (existing logic)
    for (const coord of route.coordinates) {
        const [lng, lat] = coord;

        // Check user-reported zones
        for (const zone of userDangerZones) {
            const distance = calculateDistance(lat, lng, zone.latitude, zone.longitude);

            if (distance <= zone.radius) {
                const baseWeight = SEVERITY_WEIGHTS[zone.severity] || 1;
                const categoryMultiplier = CATEGORY_MULTIPLIERS[zone.category] || 1;
                
                const ageInDays = (Date.now() - new Date(zone.lastReported).getTime()) / (1000 * 60 * 60 * 24);
                const decayFactor = Math.max(0.3, 1 - (ageInDays / 90));
                const recencyBoost = ageInDays < 7 ? 1.5 : ageInDays < 30 ? 1.2 : 1.0;
                const reportBoost = Math.min(2.0, 1 + (zone.reportCount - 1) * 0.1);
                const proximityFactor = 1 - (distance / zone.radius);
                
                const riskContribution = baseWeight * categoryMultiplier * decayFactor * 
                                       recencyBoost * reportBoost * proximityFactor;

                totalRisk += riskContribution;

                if (!affectedZones.find(z => z.id === zone.id)) {
                    affectedZones.push({
                        id: zone.id,
                        severity: zone.severity,
                        category: zone.category,
                        description: zone.description,
                        distance: Math.round(distance),
                        reportCount: zone.reportCount,
                        lastReported: zone.lastReported,
                        type: 'user-reported'
                    });
                }
            }
        }

        // Check verified danger zones with enhanced penalties
        for (const zone of verifiedDangerZones) {
            const distance = calculateDistance(lat, lng, zone.latitude, zone.longitude);

            if (distance <= zone.radius) {
                // Base severity weight from database (already calibrated)
                const baseWeight = zone.severityWeight;
                
                // Check if current time falls within active hours
                const isActiveNow = isWithinActiveHours(currentHour, zone.activeHours);
                const activeHoursMultiplier = isActiveNow ? 1.8 : 1.0; // 80% penalty increase during active hours
                
                // Proximity factor (geofence-based)
                const proximityFactor = 1 - (distance / zone.radius);
                
                // Verified zones get a credibility boost
                const verificationBoost = 1.5;
                
                // Calculate final risk contribution
                const riskContribution = baseWeight * activeHoursMultiplier * proximityFactor * verificationBoost * 10;

                totalRisk += riskContribution;

                if (!affectedZones.find(z => z.id === `verified-${zone.id}`)) {
                    affectedZones.push({
                        id: `verified-${zone.id}`,
                        severity: zone.riskLevel.toLowerCase(),
                        category: zone.category,
                        description: zone.description || zone.placeName,
                        placeName: zone.placeName,
                        distance: Math.round(distance),
                        activeHours: zone.activeHours,
                        isActiveNow: isActiveNow,
                        source: zone.source,
                        type: 'verified'
                    });
                }
            }
        }
    }

    // Normalize risk score (0-100 scale)
    const normalizedRisk = Math.min(100, Math.round(totalRisk));

    // Determine risk level
    let riskLevel;
    if (normalizedRisk === 0) riskLevel = 'safe';
    else if (normalizedRisk < 20) riskLevel = 'low';
    else if (normalizedRisk < 50) riskLevel = 'medium';
    else if (normalizedRisk < 80) riskLevel = 'high';
    else riskLevel = 'critical';

    // Generate risk factors explanation
    if (affectedZones.length > 0) {
        const verifiedCount = affectedZones.filter(z => z.type === 'verified').length;
        const userCount = affectedZones.filter(z => z.type === 'user-reported').length;
        
        if (verifiedCount > 0) {
            riskFactors.push(`${verifiedCount} verified danger zone${verifiedCount > 1 ? 's' : ''}`);
        }
        
        if (userCount > 0) {
            riskFactors.push(`${userCount} user-reported zone${userCount > 1 ? 's' : ''}`);
        }

        const activeNow = affectedZones.filter(z => z.isActiveNow);
        if (activeNow.length > 0) {
            riskFactors.push(`${activeNow.length} zone${activeNow.length > 1 ? 's' : ''} active now`);
        }

        const criticalZones = affectedZones.filter(z => z.severity === 'critical');
        if (criticalZones.length > 0) {
            riskFactors.push(`${criticalZones.length} critical risk zone${criticalZones.length > 1 ? 's' : ''}`);
        }
    }

    return {
        totalRisk: normalizedRisk,
        riskLevel,
        affectedZones: affectedZones.slice(0, 10), // Top 10 zones
        riskFactors
    };
}

/**
 * Check if current hour falls within active hours range
 * @param {number} currentHour - Current hour (0-23)
 * @param {string} activeHours - Format: "HH:MM-HH:MM" or "HH:MM-HH:MM,HH:MM-HH:MM"
 */
function isWithinActiveHours(currentHour, activeHours) {
    if (!activeHours || activeHours === '00:00-23:59') {
        return true; // Always active
    }

    const ranges = activeHours.split(',');
    
    for (const range of ranges) {
        const [start, end] = range.trim().split('-');
        const [startHour] = start.split(':').map(Number);
        const [endHour] = end.split(':').map(Number);

        // Handle overnight ranges (e.g., 21:00-06:00)
        if (startHour > endHour) {
            if (currentHour >= startHour || currentHour < endHour) {
                return true;
            }
        } else {
            if (currentHour >= startHour && currentHour < endHour) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Get optimized routes with risk analysis
 * @param {string} profile - Travel mode: 'foot-walking', 'cycling-regular', 'driving-car'
 */
async function getOptimizedRoutes(startLat, startLng, endLat, endLng, profile = 'foot-walking') {
    // First, get critical danger zones to avoid
    const boundingBox = [
        [startLng, startLat],
        [endLng, endLat]
    ];
    
    // Fetch verified danger zones in the area
    const verifiedZonesPreview = await getVerifiedDangerZonesAlongRoute(boundingBox, 2.0);
    
    // Create avoidance polygons for critical zones only
    const avoidAreas = verifiedZonesPreview
        .filter(zone => zone.riskLevel === 'Critical' || zone.riskLevel === 'High')
        .map(zone => {
            // Create a square polygon around the danger zone
            const radiusInDegrees = zone.radius / 111320; // Convert meters to degrees (approximate)
            return [
                [zone.longitude - radiusInDegrees, zone.latitude - radiusInDegrees],
                [zone.longitude + radiusInDegrees, zone.latitude - radiusInDegrees],
                [zone.longitude + radiusInDegrees, zone.latitude + radiusInDegrees],
                [zone.longitude - radiusInDegrees, zone.latitude + radiusInDegrees],
                [zone.longitude - radiusInDegrees, zone.latitude - radiusInDegrees] // Close the polygon
            ];
        })
        .slice(0, 20); // Limit to 20 avoidance areas to prevent API overload

    console.log(`Found ${verifiedZonesPreview.length} verified zones, avoiding ${avoidAreas.length} critical/high risk areas`);

    // Fetch multiple route alternatives with avoidance
    const routes = await fetchRoutes(startLat, startLng, endLat, endLng, profile, 3, avoidAreas);

    // Validate routes
    if (!routes || routes.length === 0) {
        throw new Error('No routes found');
    }

    // Get danger zones along all routes
    const allCoordinates = routes
        .filter(r => r && r.coordinates && Array.isArray(r.coordinates))
        .flatMap(r => r.coordinates);
    
    console.log('Total coordinates for danger zone check:', allCoordinates.length);
    
    // Fetch both user-reported and verified danger zones
    const [userDangerZones, verifiedDangerZones] = await Promise.all([
        getDangerZonesAlongRoute(allCoordinates, 0.5),
        getVerifiedDangerZonesAlongRoute(allCoordinates, 0.5)
    ]);

    console.log(`Found ${userDangerZones.length} user-reported zones and ${verifiedDangerZones.length} verified zones`);

    // Calculate risk for each route with both zone types
    const analyzedRoutes = routes.map(route => {
        const riskAnalysis = calculateRouteRiskWithVerifiedZones(route, userDangerZones, verifiedDangerZones);
        
        // Format duration based on travel mode
        let durationMin = Math.round(route.duration / 60);
        let durationDisplay = durationMin;
        
        // For longer durations, show hours
        if (durationMin >= 60) {
            const hours = Math.floor(durationMin / 60);
            const mins = durationMin % 60;
            durationDisplay = `${hours}h ${mins}m`;
        } else {
            durationDisplay = `${durationMin} min`;
        }
        
        return {
            ...route,
            risk: riskAnalysis,
            distanceKm: (route.distance / 1000).toFixed(2),
            durationMin: durationMin,
            durationDisplay: durationDisplay,
            dangerZoneCount: riskAnalysis.affectedZones.length,
            travelMode: profile
        };
    });

    // Sort by multiple criteria for best recommendation:
    // 1. Fewest danger zones (primary)
    // 2. Lowest risk score (secondary)
    // 3. Shortest distance (tertiary)
    analyzedRoutes.sort((a, b) => {
        // First priority: fewer danger zones
        if (a.dangerZoneCount !== b.dangerZoneCount) {
            return a.dangerZoneCount - b.dangerZoneCount;
        }
        // Second priority: lower risk score
        if (a.risk.totalRisk !== b.risk.totalRisk) {
            return a.risk.totalRisk - b.risk.totalRisk;
        }
        // Third priority: shorter distance
        return a.distance - b.distance;
    });

    // Mark the safest route (fewest danger zones + lowest risk)
    if (analyzedRoutes.length > 0) {
        analyzedRoutes[0].recommended = true;
    }

    // Combine all danger zones for map display
    const allDangerZones = [
        ...userDangerZones.map(zone => ({
            id: zone.id,
            latitude: zone.latitude,
            longitude: zone.longitude,
            radius: zone.radius,
            severity: zone.severity,
            category: zone.category,
            description: zone.description,
            reportCount: zone.reportCount,
            lastReported: zone.lastReported,
            type: 'user-reported'
        })),
        ...verifiedDangerZones.map(zone => ({
            id: `verified-${zone.id}`,
            latitude: zone.latitude,
            longitude: zone.longitude,
            radius: zone.radius,
            severity: zone.riskLevel.toLowerCase(),
            category: zone.category,
            description: zone.description || zone.placeName,
            placeName: zone.placeName,
            activeHours: zone.activeHours,
            severityWeight: zone.severityWeight,
            source: zone.source,
            type: 'verified'
        }))
    ];

    return {
        routes: analyzedRoutes,
        dangerZones: allDangerZones,
        metadata: {
            totalRoutes: analyzedRoutes.length,
            totalDangerZones: allDangerZones.length,
            userReportedZones: userDangerZones.length,
            verifiedZones: verifiedDangerZones.length,
            safestRoute: analyzedRoutes[0]?.id,
            avoidedAreas: avoidAreas.length,
            travelMode: profile,
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Check if user has deviated from route
 */
function hasDeviatedFromRoute(currentLat, currentLng, routeCoordinates, thresholdMeters = 50) {
    let minDistance = Infinity;

    for (const coord of routeCoordinates) {
        const [lng, lat] = coord;
        const distance = calculateDistance(currentLat, currentLng, lat, lng);
        
        if (distance < minDistance) {
            minDistance = distance;
        }

        // Early exit if within threshold
        if (minDistance <= thresholdMeters) {
            return false;
        }
    }

    return minDistance > thresholdMeters;
}

/**
 * Get remaining route from current position
 */
function getRemainingRoute(currentLat, currentLng, routeCoordinates) {
    let closestIndex = 0;
    let minDistance = Infinity;

    // Find closest point on route
    for (let i = 0; i < routeCoordinates.length; i++) {
        const [lng, lat] = routeCoordinates[i];
        const distance = calculateDistance(currentLat, currentLng, lat, lng);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    // Return remaining coordinates from closest point
    return routeCoordinates.slice(closestIndex);
}

module.exports = {
    geocodeAddress,
    reverseGeocode,
    fetchRoutes,
    getOptimizedRoutes,
    calculateRouteRisk,
    calculateRouteRiskWithVerifiedZones,
    hasDeviatedFromRoute,
    getRemainingRoute,
    calculateDistance
};
