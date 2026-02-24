const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const SilentRoomReport = require('../models/SilentRoomReport');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const {
    sanitizeText,
    filterProfanity,
    validateCoordinates,
    generateReportId,
    validateReportData,
} = require('../utils/silentRoomHelpers');

// ─── GET Feed (Main Feed with Pagination) ─────────────────────────────────────
router.get('/feed', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const type = req.query.type; // 'incident', 'unsafe_area', 'discussion', or undefined for all
        const sortBy = req.query.sortBy || 'recent'; // 'recent', 'risk', 'popular'

        const query = { status: 'active' };
        if (type) query.type = type;

        let sortOptions = {};
        switch (sortBy) {
            case 'risk':
                sortOptions = { riskScore: -1, createdAt: -1 };
                break;
            case 'popular':
                sortOptions = { 'votes.upvotes': -1, viewCount: -1, createdAt: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }

        const reports = await SilentRoomReport.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .populate('userId', 'name safeNexID verified')
            .lean();

        const total = await SilentRoomReport.countDocuments(query);

        // Format response
        const formattedReports = reports.map(report => ({
            reportId: report.reportId,
            type: report.type,
            title: report.title,
            description: report.description,
            category: report.category,
            severity: report.severity,
            location: {
                address: report.location.address,
                city: report.location.city,
                country: report.location.country,
                coordinates: report.location.coordinates,
            },
            author: report.anonymous ? {
                name: 'Anonymous',
                verified: false,
            } : {
                name: report.userId?.name || 'Unknown',
                safeNexID: report.userId?.safeNexID,
                verified: report.userId?.verified || false,
            },
            images: report.images,
            votes: {
                upvotes: report.votes.upvotes,
                downvotes: report.votes.downvotes,
                total: report.votes.upvotes - report.votes.downvotes,
            },
            likes: report.likes.count,
            commentsCount: report.comments.length,
            viewCount: report.viewCount,
            riskScore: report.riskScore,
            clusterRisk: report.clusterRisk,
            similarReportsCount: report.similarReportsCount,
            verified: report.verified,
            timestamp: report.createdAt,
            status: report.status,
        }));

        res.json({
            success: true,
            data: formattedReports,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Feed error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch feed' });
    }
});

// ─── GET Single Report Detail ─────────────────────────────────────────────────
router.get('/report/:reportId', protect, async (req, res) => {
    try {
        const report = await SilentRoomReport.findOne({ reportId: req.params.reportId })
            .populate('userId', 'name safeNexID verified')
            .populate('comments.userId', 'name safeNexID verified')
            .lean();

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        // Increment view count
        await SilentRoomReport.updateOne(
            { reportId: req.params.reportId },
            { $inc: { viewCount: 1 } }
        );

        // Check if current user has voted
        const userVote = report.votes.voters.find(
            v => v.userId.toString() === req.user._id.toString()
        );

        // Check if current user has liked
        const userLiked = report.likes.users.some(
            id => id.toString() === req.user._id.toString()
        );

        const formattedReport = {
            reportId: report.reportId,
            type: report.type,
            title: report.title,
            description: report.description,
            category: report.category,
            severity: report.severity,
            location: report.location,
            author: report.anonymous ? {
                name: 'Anonymous',
                verified: false,
            } : {
                name: report.userId?.name || 'Unknown',
                safeNexID: report.userId?.safeNexID,
                verified: report.userId?.verified || false,
            },
            images: report.images,
            votes: {
                upvotes: report.votes.upvotes,
                downvotes: report.votes.downvotes,
                total: report.votes.upvotes - report.votes.downvotes,
                userVote: userVote?.vote || null,
            },
            likes: {
                count: report.likes.count,
                userLiked,
            },
            comments: report.comments.map(c => ({
                commentId: c.commentId,
                author: {
                    name: c.userId?.name || 'Unknown',
                    safeNexID: c.userId?.safeNexID,
                    verified: c.userId?.verified || false,
                },
                text: c.text,
                createdAt: c.createdAt,
                edited: c.edited,
            })),
            viewCount: report.viewCount + 1,
            riskScore: report.riskScore,
            clusterRisk: report.clusterRisk,
            similarReportsCount: report.similarReportsCount,
            verified: report.verified,
            timestamp: report.createdAt,
            status: report.status,
            isOwner: report.userId?._id.toString() === req.user._id.toString(),
            editableUntil: report.editableUntil,
        };

        res.json({ success: true, data: formattedReport });
    } catch (error) {
        console.error('Report detail error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch report' });
    }
});

// ─── POST Create Report ───────────────────────────────────────────────────────
router.post('/report', protect, upload.array('images', 5), async (req, res) => {
    try {
        const {
            type,
            title,
            description,
            category,
            severity,
            latitude,
            longitude,
            address,
            city,
            country,
            anonymous,
        } = req.body;

        // Validation
        if (!type || !['incident', 'unsafe_area', 'discussion'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid report type' });
        }

        if (!title || title.trim().length < 5) {
            return res.status(400).json({ success: false, message: 'Title must be at least 5 characters' });
        }

        if (!description || description.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Description must be at least 10 characters' });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (!validateCoordinates(lat, lng)) {
            return res.status(400).json({ success: false, message: 'Invalid location coordinates' });
        }

        // Sanitize inputs
        const sanitizedTitle = filterProfanity(sanitizeText(title));
        const sanitizedDescription = filterProfanity(sanitizeText(description));

        // Process uploaded images
        const images = req.files ? req.files.map(file => ({
            url: `/uploads/${file.filename}`,
            uploadedAt: new Date(),
        })) : [];

        // Generate unique report ID
        const reportId = generateReportId();

        // Create report
        const report = new SilentRoomReport({
            reportId,
            userId: req.user._id,
            type,
            title: sanitizedTitle,
            description: sanitizedDescription,
            category: category || 'general',
            severity: severity || 'low',
            location: {
                type: 'Point',
                coordinates: [lng, lat],
                address: sanitizeText(address),
                city: sanitizeText(city),
                country: sanitizeText(country),
            },
            images,
            anonymous: anonymous === 'true' || anonymous === true,
            verified: req.user.verified || false,
            editableUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        });

        // Check for similar nearby reports
        const nearbyReports = await SilentRoomReport.find({
            'location.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat],
                    },
                    $maxDistance: 1000, // 1km radius
                },
            },
            category: report.category,
            status: 'active',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        }).countDocuments();

        report.similarReportsCount = nearbyReports;
        report.clusterRisk = nearbyReports >= 3;

        await report.save();

        res.status(201).json({
            success: true,
            message: 'Report submitted successfully',
            data: {
                reportId: report.reportId,
                location: report.location,
                severity: report.severity,
                riskScore: report.riskScore,
                clusterRisk: report.clusterRisk,
            },
        });
    } catch (error) {
        console.error('Create report error:', error);
        res.status(500).json({ success: false, message: 'Failed to create report' });
    }
});

// ─── POST Vote on Report ──────────────────────────────────────────────────────
router.post('/report/:reportId/vote', protect, async (req, res) => {
    try {
        const { vote } = req.body; // 'up' or 'down'

        if (!['up', 'down'].includes(vote)) {
            return res.status(400).json({ success: false, message: 'Invalid vote type' });
        }

        const report = await SilentRoomReport.findOne({ reportId: req.params.reportId });

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        // Check if user already voted
        const existingVoteIndex = report.votes.voters.findIndex(
            v => v.userId.toString() === req.user._id.toString()
        );

        if (existingVoteIndex !== -1) {
            const existingVote = report.votes.voters[existingVoteIndex].vote;

            // Remove old vote
            if (existingVote === 'up') report.votes.upvotes--;
            else report.votes.downvotes--;

            // If same vote, remove it (toggle)
            if (existingVote === vote) {
                report.votes.voters.splice(existingVoteIndex, 1);
            } else {
                // Change vote
                report.votes.voters[existingVoteIndex].vote = vote;
                report.votes.voters[existingVoteIndex].votedAt = new Date();
                if (vote === 'up') report.votes.upvotes++;
                else report.votes.downvotes++;
            }
        } else {
            // New vote
            report.votes.voters.push({
                userId: req.user._id,
                vote,
                votedAt: new Date(),
            });
            if (vote === 'up') report.votes.upvotes++;
            else report.votes.downvotes++;
        }

        await report.save();

        res.json({
            success: true,
            data: {
                upvotes: report.votes.upvotes,
                downvotes: report.votes.downvotes,
                riskScore: report.riskScore,
            },
        });
    } catch (error) {
        console.error('Vote error:', error);
        res.status(500).json({ success: false, message: 'Failed to vote' });
    }
});

// ─── POST Like Report (for discussions) ───────────────────────────────────────
router.post('/report/:reportId/like', protect, async (req, res) => {
    try {
        const report = await SilentRoomReport.findOne({ reportId: req.params.reportId });

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        const userIndex = report.likes.users.findIndex(
            id => id.toString() === req.user._id.toString()
        );

        if (userIndex !== -1) {
            // Unlike
            report.likes.users.splice(userIndex, 1);
            report.likes.count--;
        } else {
            // Like
            report.likes.users.push(req.user._id);
            report.likes.count++;
        }

        await report.save();

        res.json({
            success: true,
            data: {
                likes: report.likes.count,
                userLiked: userIndex === -1,
            },
        });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ success: false, message: 'Failed to like' });
    }
});

// ─── POST Comment on Report ───────────────────────────────────────────────────
router.post('/report/:reportId/comment', protect, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length < 1) {
            return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
        }

        const sanitizedText = profanityFilter(sanitizeText(text));

        const report = await SilentRoomReport.findOne({ reportId: req.params.reportId });

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        const comment = {
            commentId: uuidv4(),
            userId: req.user._id,
            text: sanitizedText,
            createdAt: new Date(),
            edited: false,
        };

        report.comments.push(comment);
        await report.save();

        const user = await User.findById(req.user._id).select('name safeNexID verified');

        res.status(201).json({
            success: true,
            data: {
                commentId: comment.commentId,
                author: {
                    name: user.name,
                    safeNexID: user.safeNexID,
                    verified: user.verified,
                },
                text: comment.text,
                createdAt: comment.createdAt,
            },
        });
    } catch (error) {
        console.error('Comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to add comment' });
    }
});

// ─── POST Flag Report ─────────────────────────────────────────────────────────
router.post('/report/:reportId/flag', protect, async (req, res) => {
    try {
        const { reason } = req.body;

        const report = await SilentRoomReport.findOne({ reportId: req.params.reportId });

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        // Check if user already flagged
        const alreadyFlagged = report.flags.users.some(
            f => f.userId.toString() === req.user._id.toString()
        );

        if (alreadyFlagged) {
            return res.status(400).json({ success: false, message: 'You have already flagged this report' });
        }

        report.flags.users.push({
            userId: req.user._id,
            reason: sanitizeText(reason),
            flaggedAt: new Date(),
        });
        report.flags.count++;

        // Auto-moderate if threshold reached
        if (report.flags.count >= 5) {
            report.status = 'under_review';
        }

        await report.save();

        res.json({ success: true, message: 'Report flagged successfully' });
    } catch (error) {
        console.error('Flag error:', error);
        res.status(500).json({ success: false, message: 'Failed to flag report' });
    }
});

// ─── GET Nearby Reports ───────────────────────────────────────────────────────
router.get('/nearby', protect, async (req, res) => {
    try {
        const { latitude, longitude, radius = 5000 } = req.query; // radius in meters

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (!validateCoordinates(lat, lng)) {
            return res.status(400).json({ success: false, message: 'Invalid coordinates' });
        }

        const reports = await SilentRoomReport.find({
            'location.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat],
                    },
                    $maxDistance: parseInt(radius),
                },
            },
            status: 'active',
        })
            .limit(50)
            .populate('userId', 'name safeNexID verified')
            .lean();

        const formattedReports = reports.map(report => ({
            reportId: report.reportId,
            type: report.type,
            title: report.title,
            category: report.category,
            severity: report.severity,
            location: report.location,
            riskScore: report.riskScore,
            timestamp: report.createdAt,
        }));

        res.json({ success: true, data: formattedReports });
    } catch (error) {
        console.error('Nearby reports error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch nearby reports' });
    }
});

module.exports = router;
