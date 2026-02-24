/**
 * Admin Authentication Middleware
 * Restricts access to admin-only routes
 */

const isAdmin = (req, res, next) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user email matches admin email
        const adminEmail = process.env.ADMIN_EMAIL;
        
        if (req.user.email !== adminEmail) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        // User is admin, proceed
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

/**
 * Verify admin password for sensitive operations
 */
const verifyAdminPassword = (req, res, next) => {
    try {
        const { adminPassword } = req.body;
        
        if (!adminPassword) {
            return res.status(400).json({
                success: false,
                message: 'Admin password required'
            });
        }

        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(403).json({
                success: false,
                message: 'Invalid admin password'
            });
        }

        next();
    } catch (error) {
        console.error('Admin password verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = {
    isAdmin,
    verifyAdminPassword
};
