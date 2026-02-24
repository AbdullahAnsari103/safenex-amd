const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
    createSilentRoomPost,
    getSilentRoomPosts,
    getSilentRoomPost,
    getTrendingPosts,
    getPostTypeStats,
    incrementPostViews,
    togglePostLike,
    hasUserLikedPost,
    addPostComment,
    getPostComments,
    updateSilentRoomPost,
    deleteSilentRoomPost,
} = require('../store/db');

// ─── GET Feed ─────────────────────────────────────────────────────────────────
router.get('/feed', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Build filters
        const filters = {
            postType: req.query.type || 'all',
            sort: req.query.sort || 'recent',
            userId: req.query.userId || null,
            showPrivate: req.query.showPrivate === 'true',
        };

        // If requesting user's own posts, pass their ID
        if (!filters.userId && req.query.myPosts === 'true') {
            filters.userId = req.user._id;
        }

        const posts = await getSilentRoomPosts(limit, offset, filters);

        // Check which posts current user has liked
        const postsWithLikeStatus = await Promise.all(posts.map(async (post) => {
            const userLiked = await hasUserLikedPost(post.id, req.user._id);
            return { ...post, userLiked };
        }));

        res.json({
            success: true,
            data: postsWithLikeStatus,
            pagination: {
                page,
                limit,
                hasMore: posts.length === limit,
            },
            filters,
        });
    } catch (error) {
        console.error('Feed error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch feed' });
    }
});

// ─── GET Trending Posts ───────────────────────────────────────────────────────
router.get('/trending', protect, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const posts = await getTrendingPosts(limit);

        // Check which posts current user has liked
        const postsWithLikeStatus = await Promise.all(posts.map(async (post) => {
            const userLiked = await hasUserLikedPost(post.id, req.user._id);
            return { ...post, userLiked };
        }));

        res.json({
            success: true,
            data: postsWithLikeStatus,
        });
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trending posts' });
    }
});

// ─── GET Post Type Stats ──────────────────────────────────────────────────────
router.get('/stats', protect, async (req, res) => {
    try {
        const stats = await getPostTypeStats();

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
});

// ─── GET Single Post ──────────────────────────────────────────────────────────
router.get('/post/:postId', protect, async (req, res) => {
    try {
        const post = await getSilentRoomPost(req.params.postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        // Increment view count
        await incrementPostViews(req.params.postId);

        // Get comments
        const comments = await getPostComments(req.params.postId);

        // Check if user liked
        const userLiked = await hasUserLikedPost(req.params.postId, req.user._id);

        res.json({
            success: true,
            data: {
                ...post,
                views: post.views + 1,
                userLiked,
                comments,
            },
        });
    } catch (error) {
        console.error('Post detail error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch post' });
    }
});

// ─── POST Create Post ─────────────────────────────────────────────────────────
router.post('/post', protect, upload.array('images', 5), async (req, res) => {
    try {
        const { message, postType, latitude, longitude, address, anonymous, isPrivate } = req.body;

        // Validation
        if (!message || message.trim().length < 1) {
            return res.status(400).json({ success: false, message: 'Message cannot be empty' });
        }

        if (message.length > 5000) {
            return res.status(400).json({ success: false, message: 'Message too long (max 5000 characters)' });
        }

        // Validate post type
        const validTypes = ['general', 'complaint', 'harassment', 'safety', 'suggestion', 'theft', 'safety_alert', 'lost_found', 'suspicious'];
        const type = validTypes.includes(postType) ? postType : 'general';

        // Process location if provided
        let location = null;
        if (latitude && longitude) {
            location = {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                address: address || `${latitude}, ${longitude}`,
            };
        }

        // Process uploaded images - convert to base64 and store in database
        const fs = require('fs').promises;
        const images = [];
        
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    // Read file and convert to base64
                    const fileBuffer = await fs.readFile(file.path);
                    const base64Data = fileBuffer.toString('base64');
                    const mimeType = file.mimetype;
                    
                    images.push({
                        data: base64Data,
                        mimeType: mimeType,
                        size: file.size,
                        uploadedAt: new Date().toISOString(),
                    });

                    // Delete the temporary file
                    await fs.unlink(file.path).catch(() => {});
                } catch (err) {
                    console.error('Image processing error:', err);
                }
            }
        }

        // Create post
        const post = await createSilentRoomPost({
            userId: req.user._id,
            message: message.trim(),
            postType: type,
            location,
            images,
            anonymous: anonymous === 'true' || anonymous === true,
            isPrivate: isPrivate === 'true' || isPrivate === true, // Private complaints
        });

        // Get user info for real-time broadcast
        const { findById } = require('../store/db');
        const user = await findById(req.user._id);
        
        // Emit real-time event to all connected clients (only if not private)
        if (!post.isPrivate) {
            const io = req.app.get('io');
            if (io) {
                io.to('silentroom').emit('post:created', {
                    ...post,
                    userName: post.anonymous ? 'Anonymous' : user.name,
                    safeNexID: post.anonymous ? null : user.safeNexID,
                    userLiked: false,
                });
            }
        }

        res.status(201).json({
            success: true,
            message: post.isPrivate ? 'Private complaint submitted to admin' : 'Post created successfully',
            data: post,
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ success: false, message: 'Failed to create post' });
    }
});

// ─── POST Like/Unlike ─────────────────────────────────────────────────────────
router.post('/post/:postId/like', protect, async (req, res) => {
    try {
        const result = await togglePostLike(req.params.postId, req.user._id);

        // Get updated post
        const post = await getSilentRoomPost(req.params.postId);

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to('silentroom').emit('post:liked', {
                postId: req.params.postId,
                liked: result.liked,
                likes: post.likes,
                userId: req.user._id,
            });
        }

        res.json({
            success: true,
            data: {
                liked: result.liked,
                likes: post.likes,
            },
        });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ success: false, message: 'Failed to like post' });
    }
});

// ─── POST Comment ─────────────────────────────────────────────────────────────
router.post('/post/:postId/comment', protect, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length < 1) {
            return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
        }

        if (text.length > 1000) {
            return res.status(400).json({ success: false, message: 'Comment too long (max 1000 characters)' });
        }

        const comment = await addPostComment(req.params.postId, req.user._id, text.trim());

        // Get user info
        const { findById } = require('../store/db');
        const user = await findById(req.user._id);

        const commentData = {
            ...comment,
            userName: user.name,
            safeNexID: user.safeNexID,
        };

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to('silentroom').emit('comment:added', {
                postId: req.params.postId,
                comment: commentData,
            });
        }

        res.status(201).json({
            success: true,
            data: commentData,
        });
    } catch (error) {
        console.error('Comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to add comment' });
    }
});

// ─── PUT Edit Post ────────────────────────────────────────────────────────────
router.put('/post/:postId', protect, upload.array('images', 5), async (req, res) => {
    try {
        const { message, postType, latitude, longitude, address, removeLocation } = req.body;

        const updates = {};

        // Update message if provided
        if (message !== undefined) {
            if (message.trim().length < 1) {
                return res.status(400).json({ success: false, message: 'Message cannot be empty' });
            }
            if (message.length > 5000) {
                return res.status(400).json({ success: false, message: 'Message too long (max 5000 characters)' });
            }
            updates.message = message.trim();
        }

        // Update post type if provided
        if (postType !== undefined) {
            const validTypes = ['general', 'theft', 'safety_alert', 'lost_found', 'suspicious'];
            updates.postType = validTypes.includes(postType) ? postType : 'general';
        }

        // Update location if provided or remove it
        if (removeLocation === 'true') {
            updates.location = null;
        } else if (latitude && longitude) {
            updates.location = {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                address: address || `${latitude}, ${longitude}`,
            };
        }

        // Update images if new ones are uploaded - convert to base64
        if (req.files && req.files.length > 0) {
            const fs = require('fs').promises;
            const images = [];
            
            for (const file of req.files) {
                try {
                    // Read file and convert to base64
                    const fileBuffer = await fs.readFile(file.path);
                    const base64Data = fileBuffer.toString('base64');
                    const mimeType = file.mimetype;
                    
                    images.push({
                        data: base64Data,
                        mimeType: mimeType,
                        size: file.size,
                        uploadedAt: new Date().toISOString(),
                    });

                    // Delete the temporary file
                    await fs.unlink(file.path).catch(() => {});
                } catch (err) {
                    console.error('Image processing error:', err);
                }
            }
            
            updates.images = images;
        }

        const updatedPost = await updateSilentRoomPost(req.params.postId, req.user._id, updates);

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to('silentroom').emit('post:updated', {
                postId: req.params.postId,
                post: updatedPost,
            });
        }

        res.json({
            success: true,
            message: 'Post updated successfully',
            data: updatedPost,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return res.status(403).json({ success: false, message: 'You can only edit your own posts' });
        }
        console.error('Edit post error:', error);
        res.status(500).json({ success: false, message: 'Failed to update post' });
    }
});

// ─── DELETE Post ──────────────────────────────────────────────────────────────
router.delete('/post/:postId', protect, async (req, res) => {
    try {
        await deleteSilentRoomPost(req.params.postId, req.user._id);

        // Emit real-time event
        const io = req.app.get('io');
        if (io) {
            io.to('silentroom').emit('post:deleted', {
                postId: req.params.postId,
            });
        }

        res.json({
            success: true,
            message: 'Post deleted successfully',
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return res.status(403).json({ success: false, message: 'You can only delete your own posts' });
        }
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete post' });
    }
});

// ─── POST Report Post ─────────────────────────────────────────────────────────
router.post('/post/:postId/report', protect, async (req, res) => {
    try {
        const { reportSilentRoomPost } = require('../store/db');
        
        await reportSilentRoomPost(req.params.postId, req.user._id);

        res.json({
            success: true,
            message: 'Post reported to admin successfully',
        });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ success: false, message: 'Failed to report post' });
    }
});

module.exports = router;
