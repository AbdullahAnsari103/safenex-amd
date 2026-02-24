const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const store = require('../store/db');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide name, email, and password.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
        }

        const user = await store.createUser({ name, email, password });
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            token,
            user: { 
                _id: user._id,
                id: user._id, 
                name: user.name, 
                email: user.email, 
                verified: user.verified 
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password.' });
        }

        const user = await store.findByEmail(email);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isMatch = await store.comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const token = generateToken(user._id);

        // Log login activity
        try {
            await store.logAdminActivity(
                user._id,
                'login',
                `User logged in: ${user.email}`,
                { email: user.email },
                req.ip,
                req.get('user-agent')
            );
        } catch (logError) {
            console.error('Failed to log login activity:', logError);
            // Don't fail login if logging fails
        }

        res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                _id: user._id,
                id: user._id,
                name: user.name,
                email: user.email,
                verified: user.verified,
                safeNexID: user.safeNexID,
                qrCodePath: user.qrCodePath,
            },
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
