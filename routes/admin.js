/**
 * Admin Dashboard Routes
 * Comprehensive admin panel for SafeNex platform management
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isAdmin, verifyAdminPassword } = require('../middleware/admin');
const store = require('../store/db');

// Apply authentication and admin check to all routes
router.use(protect);
router.use(isAdmin);

/**
 * GET /api/admin/verify-password
 * Verify admin password for dashboard access
 */
router.post('/verify-password', async (req, res, next) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password required'
            });
        }

        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(403).json({
                success: false,
                message: 'Invalid password'
            });
        }

        res.json({
            success: true,
            message: 'Password verified'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await store.getAdminStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/users
 * Get all users with pagination
 */
router.get('/users', async (req, res, next) => {
    try {
        const { page = 1, limit = 50, verified, search } = req.query;
        
        const users = await store.getAllUsers({
            page: parseInt(page),
            limit: parseInt(limit),
            verified: verified !== undefined ? verified === 'true' : undefined,
            search
        });

        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/users/:userId
 * Get detailed user information
 */
router.get('/users/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        const user = await store.getUserById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's activity
        const activity = await store.getUserActivity(userId, 50);
        
        // Get user's SOS sessions
        const sosSessions = await store.getSOSSessions(userId);
        
        // Get user's routes
        const routes = await store.getUserRouteHistory(userId, 20);

        res.json({
            success: true,
            data: {
                user,
                activity,
                sosSessions,
                routes
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/admin/users/:userId/verify
 * Verify or unverify a user
 */
router.put('/users/:userId/verify', verifyAdminPassword, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { verified } = req.body;

        await store.updateUserVerification(userId, verified);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'user_verification_changed',
            `Admin ${verified ? 'verified' : 'unverified'} user ${userId}`,
            { targetUserId: userId, verified },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: `User ${verified ? 'verified' : 'unverified'} successfully`
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/admin/users/:userId/ban
 * Ban or unban a user
 */
router.put('/users/:userId/ban', verifyAdminPassword, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { banned, reason } = req.body;

        await store.updateUserBanStatus(userId, banned, reason);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'user_ban_status_changed',
            `Admin ${banned ? 'banned' : 'unbanned'} user ${userId}${reason ? ': ' + reason : ''}`,
            { targetUserId: userId, banned, reason },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: `User ${banned ? 'banned' : 'unbanned'} successfully`
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/users/:userId
 * Permanently delete a user
 */
router.delete('/users/:userId', verifyAdminPassword, async (req, res, next) => {
    try {
        const { userId } = req.params;

        await store.deleteUser(userId);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'user_deleted',
            `Admin permanently deleted user ${userId}`,
            { targetUserId: userId },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/danger-zones
 * Get all danger zones
 */
router.get('/danger-zones', async (req, res, next) => {
    try {
        const zones = await store.getAllDangerZones();

        res.json({
            success: true,
            data: zones
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/danger-zones
 * Create a new danger zone
 */
router.post('/danger-zones', verifyAdminPassword, async (req, res, next) => {
    try {
        const zoneData = req.body;

        const result = await store.createDangerZone({
            ...zoneData,
            source: 'admin',
            sourceId: req.user._id
        });

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'danger_zone_created',
            `Admin created danger zone: ${zoneData.placeName}`,
            { zoneId: result.id, placeName: zoneData.placeName, riskLevel: zoneData.riskLevel },
            req.ip,
            req.get('user-agent')
        );

        res.status(201).json({
            success: true,
            data: result,
            message: 'Danger zone created successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/admin/danger-zones/:zoneId
 * Update a danger zone
 */
router.put('/danger-zones/:zoneId', verifyAdminPassword, async (req, res, next) => {
    try {
        const { zoneId } = req.params;
        const updates = req.body;

        await store.updateDangerZone(zoneId, updates);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'danger_zone_updated',
            `Admin updated danger zone ${zoneId}`,
            { zoneId, updates },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'Danger zone updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/danger-zones/:zoneId
 * Delete a danger zone
 */
router.delete('/danger-zones/:zoneId', verifyAdminPassword, async (req, res, next) => {
    try {
        const { zoneId } = req.params;

        await store.deleteDangerZone(zoneId);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'danger_zone_deleted',
            `Admin deleted danger zone ${zoneId}`,
            { zoneId },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'Danger zone deleted successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/silent-room/reports
 * Get all Silent Room reports
 */
router.get('/silent-room/reports', async (req, res, next) => {
    try {
        const { page = 1, limit = 50, status } = req.query;

        const reports = await store.getAllSilentRoomReports({
            page: parseInt(page),
            limit: parseInt(limit),
            status
        });

        res.json({
            success: true,
            data: reports
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/admin/silent-room/reports/:reportId
 * Update report status or delete
 */
router.put('/silent-room/reports/:reportId', verifyAdminPassword, async (req, res, next) => {
    try {
        const { reportId } = req.params;
        const { action, reason } = req.body; // action: 'approve', 'reject', 'delete'

        await store.moderateSilentRoomReport(reportId, action, reason, req.user._id);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'silent_room_moderation',
            `Admin ${action}d Silent Room report ${reportId}${reason ? ': ' + reason : ''}`,
            { reportId, action, reason },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: `Report ${action}d successfully`
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/silent-room/reports/:reportId/respond
 * Send admin response to a post
 */
router.post('/silent-room/reports/:reportId/respond', verifyAdminPassword, async (req, res, next) => {
    try {
        const { reportId } = req.params;
        const { response, status } = req.body;

        if (!response) {
            return res.status(400).json({
                success: false,
                message: 'Response message required'
            });
        }

        await store.addAdminResponseToPost(reportId, response, status, req.user._id);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'admin_response_sent',
            `Admin sent response to Silent Room post ${reportId}`,
            { reportId, status },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'Response sent successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/silent-room/warn
 * Send warning to user about policy violation
 */
router.post('/silent-room/warn', verifyAdminPassword, async (req, res, next) => {
    try {
        const { postId, userId, reason } = req.body;

        if (!postId || !userId || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Post ID, User ID, and reason are required'
            });
        }

        // Add warning as admin response to the post
        const warningMessage = `⚠️ WARNING: ${reason}\n\nPlease review our community guidelines to avoid further action.`;
        await store.addAdminResponseToPost(postId, warningMessage, 'approved', req.user._id);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'user_warned',
            `Admin warned user ${userId} for post ${postId}`,
            { postId, userId, reason },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'Warning sent to user successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/activity-log
 * Get system activity log
 */
router.get('/activity-log', async (req, res, next) => {
    try {
        const { page = 1, limit = 100, userId, action } = req.query;

        const logs = await store.getActivityLogs({
            page: parseInt(page),
            limit: parseInt(limit),
            userId,
            action
        });

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/sos-sessions
 * Get all SOS emergency sessions
 */
router.get('/sos-sessions', async (req, res, next) => {
    try {
        const { page = 1, limit = 100, status, timeFilter } = req.query;

        const sessions = await store.getAllSOSSessions({
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            timeFilter
        });

        res.json({
            success: true,
            data: sessions
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/admin/sos-sessions/:sessionId
 * Get detailed information for a specific SOS session
 */
router.get('/sos-sessions/:sessionId', async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        const session = await store.getSOSSessionDetails(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'SOS session not found'
            });
        }

        res.json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/admin/sos-sessions/:sessionId/resolve
 * Mark an SOS session as resolved
 */
router.put('/sos-sessions/:sessionId/resolve', verifyAdminPassword, async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { notes } = req.body;

        await store.resolveSOSSession(sessionId, notes);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'sos_session_resolved',
            `Admin resolved SOS session ${sessionId}`,
            { sessionId, notes },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'SOS session marked as resolved'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/admin/sos-sessions/:sessionId/false-alarm
 * Mark an SOS session as false alarm
 */
router.put('/sos-sessions/:sessionId/false-alarm', verifyAdminPassword, async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { reason } = req.body;

        await store.markSOSSessionAsFalseAlarm(sessionId, reason);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'sos_session_false_alarm',
            `Admin marked SOS session ${sessionId} as false alarm`,
            { sessionId, reason },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'SOS session marked as false alarm'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/sos-sessions/:sessionId/notes
 * Add admin notes to an SOS session
 */
router.post('/sos-sessions/:sessionId/notes', verifyAdminPassword, async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { notes } = req.body;

        if (!notes) {
            return res.status(400).json({
                success: false,
                message: 'Notes are required'
            });
        }

        await store.addSOSSessionNotes(sessionId, notes, req.user.id);

        // Log activity
        await store.logAdminActivity(
            req.user.id,
            'sos_session_notes_added',
            `Admin added notes to SOS session ${sessionId}`,
            { sessionId },
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'Notes added successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
