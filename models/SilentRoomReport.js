const mongoose = require('mongoose');

const SilentRoomReportSchema = new mongoose.Schema(
    {
        reportId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['incident', 'unsafe_area', 'discussion'],
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000,
        },
        category: {
            type: String,
            enum: [
                'violent_crime',
                'theft',
                'harassment',
                'surveillance',
                'suspicious_activity',
                'traffic',
                'environmental',
                'infrastructure',
                'general',
                'other'
            ],
            default: 'general',
            index: true,
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'low',
            index: true,
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number],
                required: true,
                index: '2dsphere',
            },
            address: {
                type: String,
                required: true,
            },
            city: String,
            country: String,
        },
        images: [{
            url: String,
            uploadedAt: Date,
        }],
        anonymous: {
            type: Boolean,
            default: false,
        },
        votes: {
            upvotes: {
                type: Number,
                default: 0,
            },
            downvotes: {
                type: Number,
                default: 0,
            },
            voters: [{
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                vote: {
                    type: String,
                    enum: ['up', 'down'],
                },
                votedAt: {
                    type: Date,
                    default: Date.now,
                },
            }],
        },
        likes: {
            count: {
                type: Number,
                default: 0,
            },
            users: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            }],
        },
        comments: [{
            commentId: String,
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            text: String,
            createdAt: {
                type: Date,
                default: Date.now,
            },
            edited: {
                type: Boolean,
                default: false,
            },
        }],
        riskScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
            index: true,
        },
        viewCount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['active', 'under_review', 'resolved', 'flagged', 'removed'],
            default: 'active',
            index: true,
        },
        flags: {
            count: {
                type: Number,
                default: 0,
            },
            users: [{
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                reason: String,
                flaggedAt: {
                    type: Date,
                    default: Date.now,
                },
            }],
        },
        verified: {
            type: Boolean,
            default: false,
        },
        similarReportsCount: {
            type: Number,
            default: 0,
        },
        clusterRisk: {
            type: Boolean,
            default: false,
        },
        resolvedAt: Date,
        editableUntil: Date,
    },
    {
        timestamps: true,
    }
);

// Index for geospatial queries
SilentRoomReportSchema.index({ 'location.coordinates': '2dsphere' });

// Compound indexes for efficient queries
SilentRoomReportSchema.index({ type: 1, status: 1, createdAt: -1 });
SilentRoomReportSchema.index({ riskScore: -1, createdAt: -1 });
SilentRoomReportSchema.index({ userId: 1, createdAt: -1 });

// Calculate risk score before saving
SilentRoomReportSchema.pre('save', function(next) {
    if (this.isModified('votes') || this.isModified('severity') || this.isModified('similarReportsCount')) {
        this.riskScore = this.calculateRiskScore();
    }
    next();
});

// Risk score calculation method
SilentRoomReportSchema.methods.calculateRiskScore = function() {
    const severityWeights = {
        low: 10,
        medium: 30,
        high: 60,
        critical: 90,
    };

    const baseScore = severityWeights[this.severity] || 10;
    const voteScore = Math.min((this.votes.upvotes - this.votes.downvotes) * 2, 30);
    const clusterBonus = this.similarReportsCount * 5;
    const timeDecay = this.getTimeDecayFactor();
    const verifiedBonus = this.verified ? 10 : 0;

    const totalScore = (baseScore + voteScore + clusterBonus + verifiedBonus) * timeDecay;
    return Math.min(Math.max(Math.round(totalScore), 0), 100);
};

// Time decay factor (older reports lose weight)
SilentRoomReportSchema.methods.getTimeDecayFactor = function() {
    const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
    if (hoursSinceCreation < 24) return 1.0;
    if (hoursSinceCreation < 72) return 0.8;
    if (hoursSinceCreation < 168) return 0.6;
    return 0.4;
};

module.exports = mongoose.model('SilentRoomReport', SilentRoomReportSchema);
