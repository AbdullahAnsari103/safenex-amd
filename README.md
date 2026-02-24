# 🛡️ SafeNex - Complete Safety Platform

SafeNex is a comprehensive safety and security platform designed to protect users through AI-powered emergency response, intelligent route planning, and anonymous community support.

![SafeNex](https://img.shields.io/badge/SafeNex-v1.0.0-green)
![Node.js](https://img.shields.io/badge/Node.js-18.x-brightgreen)
![Express](https://img.shields.io/badge/Express-4.18-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🌟 Features

### 🚨 Nexa AI SOS
- **AI-Powered Emergency Assistant** with Gemini 2.0 Flash
- **Voice-to-Text** emergency communication
- **Smart Keyword Detection** (help, emergency, danger, sos)
- **GPS Location Tracking** with movement trail
- **WhatsApp Integration** for emergency contacts
- **Stationary Detection** alerts

### 🗺️ SafeTrace - Intelligent Route Planning
- **Multi-Modal Routing** (Walking, Cycling, Driving)
- **Verified Danger Zone Database** (20+ zones in Mumbai)
- **Real-Time Risk Assessment** with color-coded routes
- **Danger Zone Avoidance** using geofencing
- **Gemini AI Route Analysis** with safety tips
- **Turn-by-Turn Navigation** with step-by-step guidance
- **Proximity Alerts** when approaching danger zones

### 💬 Silent Room - Anonymous Support
- **Anonymous Posting** with auto-generated usernames
- **Community Support** for sensitive topics
- **Report System** with auto-flagging (3+ reports)
- **Admin Moderation** with user warnings
- **Real-Time Updates** with Socket.io

### 👤 User Features
- **QR Code Verification** system
- **Document Verification** with Gemini AI
- **Trust Score** calculation
- **SafeNex ID** generation
- **Activity Tracking**

### 🔐 Admin Panel
- **User Management** with online status
- **Emergency Alerts Dashboard** with real-time SOS sessions
- **Danger Zone Management** (CRUD operations)
- **Silent Room Moderation** with flagged posts
- **System Health Monitoring** (6 systems tracked)
- **Statistics & Analytics**

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or higher
- Turso (LibSQL) database account
- Gemini API keys
- OpenRouteService API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/AbdullahAnsari103/SAFENEX-.git
cd SAFENEX-
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Initialize database**
```bash
node scripts/init-verified-danger-zones-turso.js
```

5. **Start the server**
```bash
npm start
```

Visit `http://localhost:5000`

## 📦 Deployment

### Vercel (Recommended)
See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed instructions.

Quick deploy:
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy!

### Other Platforms
- **Heroku**: Use `Procfile` (included)
- **Railway**: Auto-detected
- **Render**: Use `npm start`

## 🔧 Configuration

### Environment Variables

Required variables (see `.env.example`):

```env
# Security
JWT_SECRET=your_jwt_secret

# Database
TURSO_DATABASE_URL=your_database_url
TURSO_AUTH_TOKEN=your_auth_token

# AI Services
GEMINI_API_KEY=your_gemini_key
GEMINI_API_KEY_SAFETRACE=your_safetrace_key
GEMINI_MODEL=gemini-2.0-flash-exp

# Navigation
OPENROUTE_API_KEY=your_openroute_key

# CORS
ALLOWED_ORIGINS=http://localhost:5000
```

## 🗄️ Database Schema

### Users Table
- User authentication and profile
- Document verification status
- SafeNex ID and QR codes
- Activity tracking

### SOS Sessions Table
- Emergency session tracking
- Location data with trails
- Contact information
- Session events timeline

### Verified Danger Zones Table
- 20+ verified danger zones in Mumbai
- Risk levels (Critical, High, Medium, Low)
- Active hours and categories
- Geofencing data

### Silent Room Tables
- Anonymous posts
- Reports and flagging system
- User warnings

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Turso (LibSQL)** - Serverless database
- **Socket.io** - Real-time communication

### AI & APIs
- **Google Gemini 2.0 Flash** - AI assistant & analysis
- **OpenRouteService** - Route planning
- **Pelias Geocoding** - Address search

### Frontend
- **Vanilla JavaScript** - No framework overhead
- **Leaflet.js** - Interactive maps
- **Socket.io Client** - Real-time updates

### Security
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **express-rate-limit** - Rate limiting
- **CORS** - Cross-origin protection

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/dashboard` - User dashboard

### SOS
- `POST /api/sos/session` - Create emergency session
- `POST /api/sos/chat` - AI chat
- `GET /api/sos/config` - Get SOS configuration

### SafeTrace
- `POST /api/safetrace/routes` - Calculate routes
- `GET /api/safetrace/danger-zones/all` - Get all danger zones
- `POST /api/safetrace/report` - Report danger zone

### Silent Room
- `GET /api/silentroom/posts` - Get posts
- `POST /api/silentroom/posts` - Create post
- `POST /api/silentroom/post/:id/report` - Report post

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/sos-sessions` - Get SOS sessions
- `GET /api/admin/danger-zones` - Manage danger zones

## 🔒 Security

### Implemented Measures
- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ Rate limiting (100 requests/15 min)
- ✅ CORS protection
- ✅ Input validation
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection
- ✅ Environment variable encryption

### Best Practices
- Never commit `.env` files
- Regenerate API keys regularly
- Use strong JWT secrets
- Enable HTTPS in production
- Monitor API usage

## 📱 Features in Detail

### Nexa AI SOS
The AI-powered emergency assistant uses Gemini 2.0 Flash to:
- Understand natural language emergency requests
- Detect emergency keywords automatically
- Provide calm, helpful responses
- Track user location with 3-point GPS trail
- Calculate movement direction
- Detect if user is stationary (potential danger)
- Send detailed emergency alerts via WhatsApp

### SafeTrace Route Planning
Intelligent route planning with safety as priority:
- Fetches 3 alternative routes per travel mode
- Calculates risk scores based on danger zones
- Sorts routes by: Fewest danger zones → Lowest risk → Shortest distance
- Provides Gemini AI analysis with safety tips
- Shows turn-by-turn navigation
- Alerts when approaching danger zones
- Supports walking, cycling, and driving modes

### Silent Room
Anonymous community support platform:
- Auto-generated usernames (e.g., "Anonymous Panda")
- No personal information required
- Community-driven moderation (report system)
- Admin oversight with warning system
- Real-time post updates

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Abdullah Ansari**
- GitHub: [@AbdullahAnsari103](https://github.com/AbdullahAnsari103)
- Email: abdullahansari01618@gmail.com

## 🙏 Acknowledgments

- Google Gemini AI for intelligent assistance
- OpenRouteService for routing capabilities
- Turso for serverless database
- Mumbai Traffic Police for danger zone data
- BMC for safety information

## 📞 Support

For support, email abdullahansari01618@gmail.com or open an issue on GitHub.

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] More cities support
- [ ] Live location sharing
- [ ] Emergency services integration
- [ ] Multi-language support
- [ ] Offline mode
- [ ] Voice commands
- [ ] Wearable device integration

---

**Made with ❤️ for a safer world**
