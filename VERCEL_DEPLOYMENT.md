# 🚀 Vercel Deployment Guide for SafeNex

## Prerequisites

1. ✅ GitHub repository pushed (done)
2. ✅ Vercel account (sign up at https://vercel.com)
3. ✅ New API keys generated (after security incident)

## 📋 Step-by-Step Deployment

### 1. Import Project to Vercel

1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Choose your GitHub repository: `AbdullahAnsari103/SAFENEX-`
4. Click "Import"

### 2. Configure Project Settings

**Framework Preset:** Express (or Node.js)
**Root Directory:** `./` (leave as default)
**Build Command:** Leave empty (not needed for Express)
**Output Directory:** Leave empty
**Install Command:** `npm install`

### 3. Add Environment Variables

Click on "Environment Variables" and add ALL of these:

#### Required Variables:

```
NODE_ENV=production
PORT=5000

JWT_SECRET=<generate-strong-random-secret>

TURSO_DATABASE_URL=<your-turso-database-url>
TURSO_AUTH_TOKEN=<your-turso-auth-token>

GEMINI_API_KEY=<your-new-gemini-api-key>
GEMINI_API_KEY_SAFETRACE=<your-new-gemini-api-key-safetrace>
GEMINI_MODEL=gemini-2.0-flash-exp

OPENROUTE_API_KEY=<your-openroute-api-key>

ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

#### How to Get Values:

**JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**TURSO_DATABASE_URL & TURSO_AUTH_TOKEN:**
- Go to https://turso.tech/
- Create/access your database
- Copy the URL and auth token

**GEMINI_API_KEY (NEW - Don't use old exposed keys!):**
- Go to https://makersuite.google.com/app/apikey
- Create TWO new API keys (one for primary, one for SafeTrace)
- Delete the old exposed keys

**OPENROUTE_API_KEY:**
- Go to https://openrouteservice.org/dev/#/signup
- Sign up and get your API key

**ALLOWED_ORIGINS:**
- After deployment, update this with your actual Vercel URL
- Format: `https://your-project-name.vercel.app`

### 4. Deploy

1. Click "Deploy"
2. Wait for deployment to complete (2-5 minutes)
3. You'll get a URL like: `https://safenex.vercel.app`

### 5. Post-Deployment Configuration

#### Update ALLOWED_ORIGINS
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `ALLOWED_ORIGINS` with your actual Vercel URL
3. Redeploy (Deployments → Click "..." → Redeploy)

#### Initialize Database
Run these scripts to set up your database:

```bash
# Option 1: Run locally (pointing to production DB)
node scripts/init-verified-danger-zones-turso.js

# Option 2: Use Vercel CLI
vercel env pull .env.production
node scripts/init-verified-danger-zones-turso.js
```

#### Test Your Deployment
1. Visit your Vercel URL
2. Test user registration
3. Test all features (SOS, SafeTrace, Silent Room)
4. Check admin panel

### 6. Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Update `ALLOWED_ORIGINS` environment variable
4. Redeploy

## 🔧 Vercel-Specific Configuration

### vercel.json
Already created with:
- Node.js runtime
- Express server routing
- Mumbai region (bom1) for better performance in India

### Environment Variables
All sensitive data is stored in Vercel's encrypted environment variables, NOT in code.

## 🚨 Important Notes

### File Uploads
Vercel has a 4.5MB limit for serverless functions. For file uploads:
- Consider using Vercel Blob Storage
- Or use external storage (AWS S3, Cloudinary)

### Database
- Turso (LibSQL) works perfectly with Vercel
- Connection pooling is handled automatically

### QR Codes
- QR codes are generated on-demand
- Consider storing them in Vercel Blob or external storage for production

## 📊 Monitoring

### Vercel Analytics
1. Go to Vercel Dashboard → Your Project → Analytics
2. Enable Web Analytics (free)
3. Monitor performance and errors

### Logs
View real-time logs:
```bash
vercel logs <your-deployment-url>
```

Or in Vercel Dashboard → Your Project → Deployments → Click deployment → View Function Logs

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to GitHub:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Vercel Dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### Environment Variables Not Working
- Ensure variables are added to "Production" environment
- Redeploy after adding variables
- Check variable names (case-sensitive)

### Database Connection Issues
- Verify Turso credentials
- Check if Turso allows connections from Vercel IPs
- Test connection locally first

### CORS Errors
- Update `ALLOWED_ORIGINS` with your Vercel URL
- Include both `https://your-app.vercel.app` and custom domain
- Redeploy after changes

## 📱 Mobile App Integration

If building a mobile app:
1. Update `ALLOWED_ORIGINS` to include your app's domain
2. Consider using Vercel's Edge Functions for better global performance
3. Enable CORS for mobile app origins

## 🎯 Performance Optimization

### Vercel Edge Network
- Your app is automatically distributed globally
- Static files are cached at the edge
- API responses can be cached with headers

### Recommended Settings
```javascript
// In server.js, add cache headers for static files
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));
```

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- Vercel Community: https://github.com/vercel/vercel/discussions
- SafeNex Issues: https://github.com/AbdullahAnsari103/SAFENEX-/issues

---

**Last Updated:** February 2026
**Vercel Version:** 2
**Node.js Version:** 18.x (recommended)
