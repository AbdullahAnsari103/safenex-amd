const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import database initialization
const { initDB } = require('../store/db');

// Import routes
const authRoutes = require('../routes/auth');
const dashboardRoutes = require('../routes/dashboard');
const sosRoutes = require('../routes/sos');
const safetraceRoutes = require('../routes/safetrace');
const silentroomRoutes = require('../routes/silentroom-new');
const adminRoutes = require('../routes/admin');
const verifyRoutes = require('../routes/verify');
const activityRoutes = require('../routes/activity');

// Import middleware
const { notFound, errorHandler } = require('../middleware/errorHandler');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// Serve static files
app.use(express.static('../public'));

// Initialize database
initDB().catch(err => {
    console.error('Failed to initialize database:', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/safetrace', safetraceRoutes);
app.use('/api/silentroom', silentroomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/activity', activityRoutes);

// Root route
app.get('/', (req, res) => {
    res.redirect('/landing.html');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Export Express app as Firebase Cloud Function
exports.api = functions.https.onRequest(app);
