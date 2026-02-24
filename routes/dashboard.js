const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const store = require('../store/db');

router.get('/', protect, async (req, res, next) => {
    try {
        const user = await store.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                verified: user.verified,
                safeNexID: user.safeNexID || null,
                documentType: user.documentType || null,
                extractedName: user.extractedName || null,
                documentNumber: user.documentNumber || null,
                qrCodeURL: user.qrCodePath || null,
                verifiedAt: user.verifiedAt || null,
                memberSince: user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
