const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const SilentRoomReport = require('../models/SilentRoomReport');
const SilentRoomService = require('../services/silentRoomService');

// ─── GET Reports for Moderation ───────────────────────────────────────────────
router.get('/moderation', protect, adminOnly, async (req, res) => {
    try {
        const reports = await SilentRoomService.getReportsForModeration();

        res.json({
            success: true,
            data: reports,
            count: reports.length,
        });
    } catch (error) {
        console.error('Moderation fetch error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reports' });
    }
});

// ─── POST Moderate Report ─────────────────────────────────────────────────────
router.post('/moderate/:reportId', protect, adminOnly, async (req, res) => {
    try {
        const { action, reason } = req.body; // 'approve', 'remove', 'flag'

        const report = await SilentRoomReport.findOne({ reportId: req.params.reportId });

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        switch (action) {
            case 'approve':
                report.status = 'active';
                report.flags.count = 0;
                report.flags.users = [];
                break;
            case 'remove':
                report.status = 'removed';
                break;
            case 'flag':
                report.status = 'flagged';
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        await report.save();

        res.json({
            success: true,
            message: `Report ${action}d successfully`,
            data: {
                reportId: report.reportId,
                status: report.status,
            },
        });
    } catch (error) {
        console.error('Moderation error:', error);
        res.status(500).json({ success: false, message: 'Failed to moderate report' });
    }
});

// ─── GET Analytics Dashboard ──────────────────────────────────────────────────
router.get('/analytics', protect, adminOnly, async (req, res) => {
    try {
        const { latitude, longitude, radius } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Location required' });
        }

        const analytics = await SilentRoomService.getAreaAnalytics(
            parseFloat(latitude),
            parseFloat(longitude),
            parseInt(radius) || 5000
        );

        res.json({ success: true, data: analytics });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
});

// ─── GET Trending Reports ─────────────────────────────────────────────────────
router.get('/trending', protect, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const reports = await SilentRoomService.getTrendingReports(limit);

        res.json({ success: true, data: reports });
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trending reports' });
    }
});

// ─── GET High Risk Reports ────────────────────────────────────────────────────
router.get('/high-risk', protect, async (req, res) => {
    try {
        const minRiskScore = parseInt(req.query.minRiskScore) || 70;
        const limit = parseInt(req.query.limit) || 20;

        const reports = await SilentRoomService.getReportsByRiskLevel(minRiskScore, limit);

        res.json({ success: true, data: reports });
    } catch (error) {
        console.error('High risk fetch error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch high risk reports' });
    }
});

// ─── POST Resolve Report ──────────────────────────────────────────────────────
router.post('/resolve/:reportId', protect, async (req, res) => {
    try {
        const report = await SilentRoomService.resolveReport(
            req.params.reportId,
            req.user._id
        );

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        res.json({
            success: true,
            message: 'Report marked as resolved',
            data: {
                reportId: report.reportId,
                status: report.status,
                resolvedAt: report.resolvedAt,
            },
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        console.error('Resolve error:', error);
        res.status(500).json({ success: false, message: 'Failed to resolve report' });
    }
});

// ─── GET User Report History ──────────────────────────────────────────────────
router.get('/user/:userId/reports', protect, async (req, res) => {
    try {
        // Users can only view their own reports unless admin
        if (req.user._id.toString() !== req.params.userId && !req.user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await SilentRoomService.getUserReports(req.params.userId, page, limit);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('User reports error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user reports' });
    }
});

// ─── GET Report Engagement Metrics ────────────────────────────────────────────
router.get('/metrics/:reportId', protect, async (req, res) => {
    try {
        const metrics = await SilentRoomService.getEngagementMetrics(req.params.reportId);

        if (!metrics) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        res.json({ success: true, data: metrics });
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch metrics' });
    }
});

// ─── GET SafeTrace Integration Data ───────────────────────────────────────────
router.get('/safetrace/:reportId', protect, async (req, res) => {
    try {
        const data = await SilentRoomService.getSafeTraceData(req.params.reportId);

        if (!data) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('SafeTrace data error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch SafeTrace data' });
    }
});

module.exports = router;
