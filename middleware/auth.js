const jwt = require('jsonwebtoken');
const store = require('../store/db');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await store.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found.' });
        }

        // Update last active timestamp (async, don't wait)
        store.updateLastActive(decoded.id).catch(err => {
            console.error('Failed to update last active:', err.message);
        });

        // Attach user without password
        req.user = { ...user, password: undefined };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Not authorized. Token invalid or expired.' });
    }
};

const adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized.' });
    }

    // Check if user is admin (you can customize this based on your user model)
    if (!req.user.isAdmin && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }

    next();
};

module.exports = { protect, adminOnly };
