const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Use /tmp directory for Vercel serverless functions
// Vercel's filesystem is read-only except for /tmp
const uploadsDir = process.env.VERCEL === '1' 
    ? path.join(os.tmpdir(), 'uploads')
    : path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname).toLowerCase();
        // Use different prefix based on file type
        const prefix = file.mimetype.startsWith('image/') ? 'img' : 'doc';
        cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, WebP, and PDF files are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
});

module.exports = upload;
