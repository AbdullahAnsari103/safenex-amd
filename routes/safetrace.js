/**
 * SafeTrace API Routes - Production-Ready Risk-Aware Navigation
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    geocodeAddress,
    reverseGeocode,
    getOptimizedRoutes,
    hasDeviatedFromRoute,
    getRemainingRoute
} = require('../services/safeTraceService');
const {
    analyzeRouteWithAI,
    generateNavigationGuidance,
    generateQuickSafetySummary
} = require('../services/geminiRouteAnalysis');
const {
    upsertDangerZone,
    getDangerZones,
    getAllVerifiedDangerZones,
    saveRouteHistory,
    getUserRouteHistory,
    markRouteCompleted,
    cleanupExpiredZones
} = require('../store/db');

// Helper function
function getTravelModeName(mode) {
    const names = {
        'foot-walking': 'Walking',
        'cycling-regular': 'Cycling',
        'driving-car': 'Driving'
    };
    return names[mode] || mode;
}

/**
 * POST /api/safetrace/geocode
 * Geocode an address to coordinates
 */
router.post('/geocode', protect, async (req, res, next) => {
    try {
        const { address, returnMultiple = false } = req.body;

        if (!address || typeof address !== 'string' || address.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid address is required'
            });
        }

        const result = await geocodeAddress(address.trim(), returnMultiple);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/safetrace/autocomplete
 * Get location suggestions for autocomplete (uses Nominatim)
 * Returns results from all of India
 */
router.get('/autocomplete', protect, async (req, res, next) => {
    try {
        const { query, limit = 10 } = req.query;

        if (!query || query.trim().length < 2) {
            return res.json({
                success: true,
                data: { suggestions: [] }
            });
        }

        // Use Nominatim for autocomplete - has ALL locations
        const axios = require('axios');
        
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: query,
                format: 'json',
                limit: Math.min(parseInt(limit), 15),
                addressdetails: 1,
                countrycodes: 'in', // Limit to India
                'accept-language': 'en'
            },
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'SafeNex-SafeTrace/1.0'
            },
            timeout: 5000
        });

        const suggestions = response.data
            .slice(0, Math.min(parseInt(limit), 10))
            .map(item => ({
                name: item.display_name.split(',')[0],
                address: item.display_name,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                type: item.type,
                category: item.class
            }));

        res.json({
            success: true,
            data: { suggestions }
        });
    } catch (error) {
        console.error('Autocomplete error:', error.message);
        res.json({
            success: true,
            data: { suggestions: [] }
        });
    }
});

/**
 * POST /api/safetrace/reverse-geocode
 * Reverse geocode coordinates to address
 */
router.post('/reverse-geocode', protect, async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Valid latitude and longitude are required'
            });
        }

        const address = await reverseGeocode(latitude, longitude);

        res.json({
            success: true,
            data: { address }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/safetrace/routes
 * Get optimized routes with risk analysis and AI insights
 */
router.post('/routes', protect, async (req, res, next) => {
    try {
        const { startLat, startLng, endLat, endLng, travelMode = 'foot-walking', startAddress, endAddress } = req.body;

        // Validate coordinates
        if (
            typeof startLat !== 'number' || typeof startLng !== 'number' ||
            typeof endLat !== 'number' || typeof endLng !== 'number'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Valid start and end coordinates are required'
            });
        }

        // Validate coordinate ranges
        if (
            startLat < -90 || startLat > 90 || endLat < -90 || endLat > 90 ||
            startLng < -180 || startLng > 180 || endLng < -180 || endLng > 180
        ) {
            return res.status(400).json({
                success: false,
                message: 'Coordinates out of valid range'
            });
        }

        // Validate travel mode
        const validModes = ['foot-walking', 'cycling-regular', 'driving-car'];
        if (!validModes.includes(travelMode)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid travel mode. Must be one of: ' + validModes.join(', ')
            });
        }

        const result = await getOptimizedRoutes(startLat, startLng, endLat, endLng, travelMode);

        console.log('=== ROUTE CALCULATION DEBUG ===');
        console.log('Start coordinates:', { lat: startLat, lng: startLng });
        console.log('End coordinates:', { lat: endLat, lng: endLng });
        console.log('Start address:', startAddress);
        console.log('End address:', endAddress);
        console.log('Travel mode:', travelMode);
        console.log(`Routes calculated for ${travelMode}:`, {
            routeCount: result.routes.length,
            distances: result.routes.map(r => r.distanceKm),
            durations: result.routes.map(r => r.durationMin)
        });
        
        // CRITICAL VALIDATION: Verify routes actually end at intended destination
        const validatedRoutes = [];
        for (const route of result.routes) {
            if (!route.coordinates || route.coordinates.length === 0) {
                console.warn('Route has no coordinates, skipping');
                continue;
            }
            
            // Get route end point
            const routeEnd = route.coordinates[route.coordinates.length - 1];
            const routeEndLat = routeEnd[1]; // [lng, lat] format
            const routeEndLng = routeEnd[0];
            
            // Calculate distance from intended destination
            const { calculateDistance } = require('../services/safeTraceService');
            const endDistance = calculateDistance(routeEndLat, routeEndLng, endLat, endLng);
            const endDistanceKm = endDistance / 1000;
            
            console.log(`Route ${route.id} validation:`, {
                routeEnds: { lat: routeEndLat, lng: routeEndLng },
                intendedEnd: { lat: endLat, lng: endLng },
                distanceFromIntended: endDistanceKm.toFixed(3) + ' km'
            });
            
            // Route must end within 500 meters of intended destination
            if (endDistanceKm > 0.5) {
                console.error(`REJECTED: Route ${route.id} ends ${endDistanceKm.toFixed(2)}km from intended destination`);
                continue;
            }
            
            validatedRoutes.push(route);
        }
        
        if (validatedRoutes.length === 0) {
            console.error('CRITICAL: All routes rejected - none reach intended destination');
            return res.status(400).json({
                success: false,
                message: 'No valid routes found that reach your intended destination. Please try a more specific address or nearby landmark.'
            });
        }
        
        // Update result with only validated routes
        result.routes = validatedRoutes;
        console.log(`Validated ${validatedRoutes.length} of ${result.routes.length} routes`);
        console.log('===============================');

        // Generate AI analysis for the recommended route (optional - graceful degradation)
        if (result.routes && result.routes.length > 0) {
            const recommendedRoute = result.routes.find(r => r.recommended) || result.routes[0];
            
            console.log('Attempting to generate AI insights for recommended route...');
            
            try {
                // Generate AI insights in parallel with timeout (15 seconds)
                const aiPromises = Promise.race([
                    Promise.all([
                        analyzeRouteWithAI({
                            route: recommendedRoute,
                            dangerZones: result.dangerZones,
                            travelMode: travelMode,
                            startAddress: startAddress,
                            endAddress: endAddress
                        }),
                        generateNavigationGuidance({
                            route: recommendedRoute,
                            travelMode: travelMode,
                            instructions: recommendedRoute.instructions
                        })
                    ]),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 15000))
                ]);

                const [aiAnalysis, navigationGuidance] = await aiPromises;

                console.log('AI insights generated:', {
                    analysisSuccess: aiAnalysis.success,
                    hasInsights: aiAnalysis.keyInsights?.length > 0,
                    hasTips: aiAnalysis.safetyTips?.length > 0,
                    guidanceSuccess: navigationGuidance.success,
                    stepCount: navigationGuidance.steps?.length || 0
                });

                // Attach AI insights to the recommended route
                recommendedRoute.aiInsights = aiAnalysis;
                recommendedRoute.navigationGuidance = navigationGuidance;
            } catch (error) {
                console.warn('AI generation failed or timed out:', error.message);
                // Provide fallback insights
                recommendedRoute.aiInsights = {
                    success: false,
                    analysis: `This ${getTravelModeName(travelMode).toLowerCase()} route is ${recommendedRoute.distanceKm} km with ${recommendedRoute.risk.riskLevel} risk level.`,
                    keyInsights: [],
                    safetyTips: []
                };
                recommendedRoute.navigationGuidance = {
                    success: false,
                    steps: []
                };
            }
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/safetrace/check-deviation
 * Check if user has deviated from route
 */
router.post('/check-deviation', protect, async (req, res, next) => {
    try {
        const { currentLat, currentLng, routeCoordinates, threshold = 50 } = req.body;

        if (
            typeof currentLat !== 'number' || typeof currentLng !== 'number' ||
            !Array.isArray(routeCoordinates) || routeCoordinates.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Valid current position and route coordinates are required'
            });
        }

        const deviated = hasDeviatedFromRoute(currentLat, currentLng, routeCoordinates, threshold);
        const remainingRoute = deviated ? null : getRemainingRoute(currentLat, currentLng, routeCoordinates);

        res.json({
            success: true,
            data: {
                deviated,
                remainingRoute,
                message: deviated ? 'User has deviated from route' : 'User is on route'
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/safetrace/danger-zones
 * Get danger zones within bounding box
 */
router.get('/danger-zones', protect, async (req, res, next) => {
    try {
        const { minLat, maxLat, minLng, maxLng } = req.query;

        if (!minLat || !maxLat || !minLng || !maxLng) {
            return res.status(400).json({
                success: false,
                message: 'Bounding box coordinates are required'
            });
        }

        const bounds = {
            minLat: parseFloat(minLat),
            maxLat: parseFloat(maxLat),
            minLng: parseFloat(minLng),
            maxLng: parseFloat(maxLng)
        };

        const zones = await getDangerZones(bounds);

        res.json({
            success: true,
            data: {
                zones,
                count: zones.length
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/safetrace/danger-zones
 * Report a new danger zone (admin or verified users)
 */
router.post('/danger-zones', protect, async (req, res, next) => {
    try {
        const {
            latitude,
            longitude,
            radius = 100,
            severity,
            category,
            description
        } = req.body;

        // Validate required fields
        if (
            typeof latitude !== 'number' || typeof longitude !== 'number' ||
            !severity || !category
        ) {
            return res.status(400).json({
                success: false,
                message: 'Latitude, longitude, severity, and category are required'
            });
        }

        // Validate severity
        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(severity)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid severity level'
            });
        }

        const result = await upsertDangerZone({
            latitude,
            longitude,
            radius,
            severity,
            category,
            description,
            source: 'user_report',
            sourceId: req.user._id,
            metadata: {
                reportedBy: req.user.name,
                userVerified: req.user.verified
            }
        });

        res.status(201).json({
            success: true,
            data: result,
            message: 'Danger zone reported successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/safetrace/history
 * Save route to history
 */
router.post('/history', protect, async (req, res, next) => {
    try {
        const {
            startLat,
            startLng,
            endLat,
            endLng,
            startAddress,
            endAddress,
            selectedRoute,
            riskScore,
            distance,
            duration
        } = req.body;

        if (
            typeof startLat !== 'number' || typeof startLng !== 'number' ||
            typeof endLat !== 'number' || typeof endLng !== 'number' ||
            !selectedRoute || typeof riskScore !== 'number' ||
            typeof distance !== 'number' || typeof duration !== 'number'
        ) {
            return res.status(400).json({
                success: false,
                message: 'All route parameters are required'
            });
        }

        const result = await saveRouteHistory({
            userId: req.user._id,
            startLat,
            startLng,
            endLat,
            endLng,
            startAddress,
            endAddress,
            selectedRoute,
            riskScore,
            distance,
            duration
        });

        res.status(201).json({
            success: true,
            data: result,
            message: 'Route saved to history'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/safetrace/history
 * Get user route history
 */
router.get('/history', protect, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const history = await getUserRouteHistory(req.user._id, limit);

        res.json({
            success: true,
            data: {
                history,
                count: history.length
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/safetrace/history/:routeId/complete
 * Mark route as completed
 */
router.put('/history/:routeId/complete', protect, async (req, res, next) => {
    try {
        const { routeId } = req.params;

        await markRouteCompleted(routeId, req.user._id);

        res.json({
            success: true,
            message: 'Route marked as completed'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/safetrace/cleanup
 * Cleanup expired danger zones (admin only - can be called by cron job)
 */
router.post('/cleanup', async (req, res, next) => {
    try {
        // In production, this should be protected with admin auth or API key
        const result = await cleanupExpiredZones();

        res.json({
            success: true,
            data: result,
            message: `Cleaned up ${result.deleted} expired zones`
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/safetrace/danger-zones/all
 * Get all active verified danger zones for map display
 */
router.get('/danger-zones/all', protect, async (req, res, next) => {
    try {
        const { getAllVerifiedDangerZones } = require('../store/db');
        const zones = await getAllVerifiedDangerZones();

        res.json({
            success: true,
            data: {
                zones: zones.map(zone => ({
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
                    type: 'verified'
                })),
                count: zones.length
            }
        });
    } catch (error) {
        console.error('Error fetching all danger zones:', error);
        next(error);
    }
});

module.exports = router;
