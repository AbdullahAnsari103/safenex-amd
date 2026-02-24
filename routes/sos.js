const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const store = require('../store/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// GET /api/sos/config - Get user's SOS configuration
router.get('/config', protect, async (req, res, next) => {
    try {
        const config = await store.getSOSConfig(req.user._id);

        // Log activity: User accessed SOS configuration
        await store.logActivity(
            req.user._id,
            'sos_accessed',
            'Accessed Nexa AI SOS emergency system to review or configure settings.'
        );

        res.status(200).json({
            success: true,
            config: config || {
                primaryContact: '',
                secondaryContact: '',
                messageTemplate: "🚨 EMERGENCY ALERT 🚨\nI need help! My current location is {{location}}.\nBattery: {{battery}}\nTime: {{timestamp}}\nPlease send help immediately.",
                safeWords: ['help', 'emergency', 'danger'],
                voiceActivationEnabled: false,
                liveBeaconEnabled: false,
                beaconUpdateInterval: 60,
                batteryLevelEnabled: true,
                timestampEnabled: true,
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/sos/config - Save user's SOS configuration
router.post('/config', protect, async (req, res, next) => {
    try {
        const {
            primaryContact,
            secondaryContact,
            messageTemplate,
            safeWords,
            voiceActivationEnabled,
            liveBeaconEnabled,
            beaconUpdateInterval,
            batteryLevelEnabled,
            timestampEnabled,
        } = req.body;

        const config = {
            primaryContact: primaryContact || '',
            secondaryContact: secondaryContact || '',
            messageTemplate: messageTemplate || '',
            safeWords: Array.isArray(safeWords) ? safeWords : ['help', 'emergency', 'danger'],
            voiceActivationEnabled: !!voiceActivationEnabled,
            liveBeaconEnabled: !!liveBeaconEnabled,
            beaconUpdateInterval: beaconUpdateInterval || 60,
            batteryLevelEnabled: batteryLevelEnabled !== false,
            timestampEnabled: timestampEnabled !== false,
        };

        await store.saveSOSConfig(req.user._id, config);

        // Log activity: User configured SOS
        await store.logActivity(
            req.user._id,
            'sos_configured',
            `Emergency contacts configured. Primary: ${primaryContact ? '✓' : '✗'}, Secondary: ${secondaryContact ? '✓' : '✗'}. System ready for emergency response.`,
            { primaryContact: !!primaryContact, secondaryContact: !!secondaryContact }
        );

        res.status(200).json({
            success: true,
            message: 'SOS configuration saved successfully.',
            config,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/sos/session - Save emergency session
router.post('/session', protect, async (req, res, next) => {
    try {
        const {
            sessionId,
            triggeredBy,
            startTime,
            endTime,
            events,
            location,
        } = req.body;

        const session = {
            userId: req.user._id,
            sessionId,
            triggeredBy,
            startTime: new Date(startTime),
            endTime: endTime ? new Date(endTime) : null,
            events: JSON.stringify(events || []),
            location: location ? JSON.stringify(location) : null,
        };

        await store.saveSOSSession(session);

        // Log activity: Emergency SOS activated
        const locationDesc = location 
            ? `Location tracked: ${location.trail?.length || 1} GPS point(s). ${location.isStationary ? `User stationary for ${location.stationaryDuration} min.` : 'User moving.'}`
            : 'Location unavailable';
        
        await store.logActivity(
            req.user._id,
            'sos_activated',
            `🚨 Emergency protocol activated via keyword "${triggeredBy}". ${locationDesc} Emergency contacts notified via WhatsApp.`,
            { 
                triggeredBy, 
                locationPoints: location?.trail?.length || 0,
                isStationary: location?.isStationary || false,
                direction: location?.direction || 'Unknown'
            }
        );

        res.status(200).json({
            success: true,
            message: 'Emergency session saved.',
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/sos/sessions - Get user's emergency session history
router.get('/sessions', protect, async (req, res, next) => {
    try {
        const sessions = await store.getSOSSessions(req.user._id);

        res.status(200).json({
            success: true,
            sessions: sessions.map(s => ({
                ...s,
                events: s.events ? JSON.parse(s.events) : [],
                location: s.location ? JSON.parse(s.location) : null,
            })),
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/sos/chat - Chat with Gemini AI (Optimized for Speed)
router.post('/chat', protect, async (req, res, next) => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Message is required.',
            });
        }

        // Use fastest model with optimized settings for Nexa AI
        const modelName = process.env.GEMINI_MODEL_NEXA || 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                temperature: 0.9, // Higher for more natural, varied responses
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024, // Allow longer responses when needed
                candidateCount: 1
            }
        });

        // Natural conversational prompt - clean, simple responses
        const systemPrompt = `You are Nexa AI, a friendly and helpful personal safety assistant. 

Your communication style:
- Write in natural, flowing paragraphs
- NO markdown formatting (no **, no *, no #, no bullet points)
- NO numbered lists unless specifically asked
- Keep responses conversational and easy to read
- Use simple, clear language
- Break up long responses with natural paragraph breaks
- Write like you're texting a friend

Your personality:
- Warm, friendly, and conversational
- Helpful and knowledgeable
- Supportive but casual
- Natural and relatable

Special capabilities:
- You're part of SafeNex, a personal safety platform
- You can help with safety advice, emergency situations, and general questions
- If someone seems to be in danger or mentions an emergency, gently remind them they can type "help", "emergency", or "danger" to activate emergency protocols

Important rules:
- NEVER use markdown formatting (**, *, #, etc.)
- NEVER use numbered or bulleted lists unless specifically requested
- Write in natural paragraphs like a normal conversation
- Keep it simple and clean
- Be conversational, not formal
- Only mention emergency features if the conversation is actually about emergencies or danger`;

        const fullPrompt = `${systemPrompt}\n\nUser: ${message.trim()}\n\nNexa AI:`;

        // Generate response with timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI timeout')), 8000) // Increased to 8 seconds
        );

        const aiPromise = model.generateContent(fullPrompt)
            .then(result => {
                let text = result.response.text().trim();
                // Clean up any markdown formatting that slipped through
                text = text.replace(/\*\*/g, ''); // Remove bold markers
                text = text.replace(/\*/g, ''); // Remove italic markers
                text = text.replace(/^#+\s/gm, ''); // Remove headers
                text = text.replace(/^[-•]\s/gm, ''); // Remove bullet points
                return text;
            });

        const aiResponse = await Promise.race([aiPromise, timeoutPromise]);

        res.status(200).json({
            success: true,
            response: aiResponse,
        });
    } catch (error) {
        console.error('[SOS Chat Error]', error.message);
        
        // Natural fallback responses
        const quickResponses = [
            'I\'m here to chat and help with anything you need. What\'s on your mind?',
            'Hey! I\'m having a bit of trouble connecting right now, but I\'m here to help. What can I do for you?',
            'Hi there! How can I assist you today?',
            'I\'m listening! Feel free to ask me anything.',
            'Hello! I\'m Nexa AI, your personal safety assistant. How can I help you today?'
        ];
        
        const fallbackResponse = quickResponses[Math.floor(Math.random() * quickResponses.length)];
        
        res.status(200).json({
            success: true,
            response: fallbackResponse,
        });
    }
});

module.exports = router;
