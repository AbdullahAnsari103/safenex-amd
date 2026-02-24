const SilentRoomReport = require('../models/SilentRoomReport');

/**
 * Silent Room Service - Business Logic Layer
 */

class SilentRoomService {
    /**
     * Calculate dynamic risk score for a report
     */
    static async calculateRiskScore(report) {
        const severityWeights = {
            low: 10,
            medium: 30,
            high: 60,
            critical: 90,
        };

        const baseScore = severityWeights[report.severity] || 10;
        const voteScore = Math.min((report.votes.upvotes - report.votes.downvotes) * 2, 30);
        const clusterBonus = report.similarReportsCount * 5;
        const timeDecay = this.getTimeDecayFactor(report.createdAt);
        const verifiedBonus = report.verified ? 10 : 0;

        const totalScore = (baseScore + voteScore + clusterBonus + verifiedBonus) * timeDecay;
        return Math.min(Math.max(Math.round(totalScore), 0), 100);
    }

    /**
     * Get time decay factor for risk scoring
     */
    static getTimeDecayFactor(createdAt) {
        const hoursSinceCreation = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60);
        if (hoursSinceCreation < 24) return 1.0;
        if (hoursSinceCreation < 72) return 0.8;
        if (hoursSinceCreation < 168) return 0.6;
        return 0.4;
    }

    /**
     * Find similar nearby reports for clustering
     */
    static async findSimilarReports(location, category, excludeId = null) {
        const query = {
            'location.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: location.coordinates,
                    },
                    $maxDistance: 1000, // 1km radius
                },
            },
            category,
            status: 'active',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        };

        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        return await SilentRoomReport.find(query).countDocuments();
    }

    /**
     * Check if location is in a high-risk cluster
     */
    static async isHighRiskCluster(location, category) {
        const count = await this.findSimilarReports(location, category);
        return count >= 3;
    }

    /**
     * Get trending reports based on engagement
     */
    static async getTrendingReports(limit = 10) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        return await SilentRoomReport.find({
            status: 'active',
            createdAt: { $gte: oneDayAgo },
        })
            .sort({ 'votes.upvotes': -1, viewCount: -1 })
            .limit(limit)
            .populate('userId', 'name safeNexID verified')
            .lean();
    }

    /**
     * Get reports by risk level
     */
    static async getReportsByRiskLevel(minRiskScore = 70, limit = 20) {
        return await SilentRoomReport.find({
            status: 'active',
            riskScore: { $gte: minRiskScore },
        })
            .sort({ riskScore: -1, createdAt: -1 })
            .limit(limit)
            .populate('userId', 'name safeNexID verified')
            .lean();
    }

    /**
     * Get user's report history
     */
    static async getUserReports(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const reports = await SilentRoomReport.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await SilentRoomReport.countDocuments({ userId });

        return {
            reports,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get reports requiring moderation
     */
    static async getReportsForModeration(threshold = 5) {
        return await SilentRoomReport.find({
            'flags.count': { $gte: threshold },
            status: { $ne: 'removed' },
        })
            .sort({ 'flags.count': -1 })
            .populate('userId', 'name safeNexID verified')
            .lean();
    }

    /**
     * Auto-moderate report based on flags
     */
    static async autoModerate(reportId) {
        const report = await SilentRoomReport.findOne({ reportId });

        if (!report) return null;

        // Auto-flag for review if threshold reached
        if (report.flags.count >= 5 && report.status === 'active') {
            report.status = 'under_review';
            await report.save();
        }

        // Auto-remove if critical threshold reached
        if (report.flags.count >= 10) {
            report.status = 'removed';
            await report.save();
        }

        return report;
    }

    /**
     * Get SafeTrace integration data
     */
    static async getSafeTraceData(reportId) {
        const report = await SilentRoomReport.findOne({ reportId }).lean();

        if (!report) return null;

        return {
            reportId: report.reportId,
            location: report.location,
            severity: report.severity,
            riskScore: report.riskScore,
            category: report.category,
            timestamp: report.createdAt,
            clusterRisk: report.clusterRisk,
            similarReportsCount: report.similarReportsCount,
        };
    }

    /**
     * Update report resolution status
     */
    static async resolveReport(reportId, userId) {
        const report = await SilentRoomReport.findOne({ reportId });

        if (!report) return null;

        // Only owner or admin can resolve
        if (report.userId.toString() !== userId.toString()) {
            throw new Error('Unauthorized');
        }

        report.status = 'resolved';
        report.resolvedAt = new Date();
        await report.save();

        return report;
    }

    /**
     * Get analytics for a specific area
     */
    static async getAreaAnalytics(latitude, longitude, radius = 5000) {
        const reports = await SilentRoomReport.find({
            'location.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                    $maxDistance: radius,
                },
            },
            status: 'active',
        }).lean();

        const analytics = {
            totalReports: reports.length,
            bySeverity: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0,
            },
            byCategory: {},
            averageRiskScore: 0,
            highRiskAreas: 0,
        };

        let totalRiskScore = 0;

        reports.forEach(report => {
            analytics.bySeverity[report.severity]++;
            analytics.byCategory[report.category] = (analytics.byCategory[report.category] || 0) + 1;
            totalRiskScore += report.riskScore;
            if (report.riskScore >= 70) analytics.highRiskAreas++;
        });

        analytics.averageRiskScore = reports.length > 0 
            ? Math.round(totalRiskScore / reports.length) 
            : 0;

        return analytics;
    }

    /**
     * Detect suspicious activity patterns
     */
    static async detectSuspiciousActivity(userId) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Check for spam (too many reports in short time)
        const recentReports = await SilentRoomReport.countDocuments({
            userId,
            createdAt: { $gte: oneDayAgo },
        });

        if (recentReports > 20) {
            return {
                suspicious: true,
                reason: 'Excessive posting',
                count: recentReports,
            };
        }

        // Check for duplicate content
        const reports = await SilentRoomReport.find({
            userId,
            createdAt: { $gte: oneDayAgo },
        }).select('title description').lean();

        const titles = reports.map(r => r.title);
        const uniqueTitles = new Set(titles);

        if (titles.length > 5 && uniqueTitles.size < titles.length * 0.5) {
            return {
                suspicious: true,
                reason: 'Duplicate content detected',
                count: titles.length - uniqueTitles.size,
            };
        }

        return { suspicious: false };
    }

    /**
     * Get report engagement metrics
     */
    static async getEngagementMetrics(reportId) {
        const report = await SilentRoomReport.findOne({ reportId }).lean();

        if (!report) return null;

        const totalVotes = report.votes.upvotes + report.votes.downvotes;
        const engagementRate = report.viewCount > 0 
            ? ((totalVotes + report.comments.length) / report.viewCount) * 100 
            : 0;

        return {
            views: report.viewCount,
            upvotes: report.votes.upvotes,
            downvotes: report.votes.downvotes,
            comments: report.comments.length,
            likes: report.likes.count,
            engagementRate: Math.round(engagementRate * 100) / 100,
            riskScore: report.riskScore,
        };
    }
}

module.exports = SilentRoomService;
