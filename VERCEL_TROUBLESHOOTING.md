# 🔧 Vercel Deployment Troubleshooting

## ✅ Changes Made to Fix Deployment

### 1. Created Serverless Function Wrapper
- **File**: `api/index.js`
- **Purpose**: Wraps Express app for Vercel's serverless environment
- **What it does**: Exports the Express app as a Vercel serverless function

### 2. Updated vercel.json
- **Changed**: Build source from `server.js` to `api/index.js`
- **Routes**: All requests now route to `/api/index.js`
- **Why**: Vercel requires functions to be in the `api/` directory

### 3. Modified server.js
- **Added**: Check for `VERCEL` environment variable
- **Behavior**: 
  - On Vercel: Exports app without starting server (Vercel handles this)
  - Locally: Starts server normally on specified PORT

### 4. Fixed File Upload Path
- **File**: `middleware/upload.js`
- **Changed**: Upload directory to `/tmp` on Vercel
- **Why**: Vercel's filesystem is read-only except for `/tmp`
- **Local**: Still uses `./uploads` directory

### 5. Added .vercelignore
- **Purpose**: Excludes unnecessary files from deployment
- **Reduces**: Build size and deployment time

## 🚀 How to Redeploy

### Option 1: Automatic (Recommended)
Vercel automatically redeploys when you push to GitHub:
```bash
git push origin main
```

### Option 2: Manual Redeploy
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Deployments" tab
4. Click "..." on latest deployment
5. Click "Redeploy"

## 🐛 Common Issues & Solutions

### Issue 1: "FUNCTION_INVOCATION_FAILED"
**Cause**: Missing environment variables or database connection issues

**Solution**:
1. Check all environment variables are added in Vercel
2. Verify Turso database credentials
3. Check Vercel function logs for specific error

**How to check logs**:
```bash
vercel logs <your-deployment-url>
```

Or in Vercel Dashboard → Deployments → Click deployment → View Function Logs

### Issue 2: "Module not found" errors
**Cause**: Missing dependencies in package.json

**Solution**:
1. Ensure all dependencies are in `package.json` (not devDependencies)
2. Run `npm install` locally to verify
3. Commit and push changes

### Issue 3: File upload fails
**Cause**: Trying to write to read-only filesystem

**Solution**:
✅ Already fixed! Upload middleware now uses `/tmp` directory on Vercel

**Note**: Files in `/tmp` are temporary and deleted after function execution. For permanent storage, consider:
- Vercel Blob Storage
- AWS S3
- Cloudinary

### Issue 4: Database connection timeout
**Cause**: Turso connection issues or wrong credentials

**Solution**:
1. Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel
2. Check Turso dashboard for database status
3. Test connection locally first:
```bash
node -e "require('dotenv').config(); require('./store/db').initDB().then(() => console.log('Connected!')).catch(console.error)"
```

### Issue 5: CORS errors
**Cause**: `ALLOWED_ORIGINS` not set correctly

**Solution**:
1. Get your Vercel deployment URL (e.g., `https://safenex-abc123.vercel.app`)
2. Update `ALLOWED_ORIGINS` environment variable in Vercel
3. Redeploy

### Issue 6: API routes return 404
**Cause**: Incorrect routing in vercel.json

**Solution**:
✅ Already fixed! All routes now properly redirect to `/api/index.js`

### Issue 7: Socket.IO not working
**Cause**: Vercel serverless functions don't support WebSocket connections

**Solution**:
Socket.IO will fall back to HTTP long-polling automatically. For better performance:
- Use Vercel's Edge Functions (if available)
- Or deploy Socket.IO separately (e.g., Railway, Render)
- Or use Vercel's real-time features

## 📊 Checking Deployment Status

### View Build Logs
1. Go to Vercel Dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Click on the deployment
5. View "Building" logs

### View Function Logs
1. In deployment details
2. Click "View Function Logs"
3. See real-time errors and console.log outputs

### Test Endpoints
After deployment, test these endpoints:

```bash
# Health check
curl https://your-app.vercel.app/

# API test
curl https://your-app.vercel.app/api/dashboard

# Check if static files load
curl https://your-app.vercel.app/landing.html
```

## 🔍 Debugging Steps

### Step 1: Check Build Logs
Look for:
- ❌ npm install errors
- ❌ Missing dependencies
- ❌ Build configuration issues

### Step 2: Check Function Logs
Look for:
- ❌ Runtime errors
- ❌ Database connection errors
- ❌ Missing environment variables

### Step 3: Test Locally
```bash
# Set VERCEL=1 to simulate Vercel environment
set VERCEL=1
npm start
```

### Step 4: Verify Environment Variables
In Vercel Dashboard → Settings → Environment Variables:
- ✅ All 17 variables added
- ✅ Selected for Production, Preview, Development
- ✅ No typos in variable names
- ✅ Values are correct

## 🎯 Performance Optimization

### 1. Cold Start Optimization
Vercel functions have "cold starts" (first request is slower). To minimize:
- Keep dependencies minimal
- Use faster Gemini model (gemini-2.5-flash)
- Enable Vercel's Edge Functions if needed

### 2. Function Size
Current function size should be < 50MB. If larger:
- Remove unused dependencies
- Use .vercelignore to exclude files
- Consider splitting into multiple functions

### 3. Database Connection Pooling
Turso handles connection pooling automatically, but:
- Don't create new connections per request
- Reuse the initialized client (already done in `store/db.js`)

## 📞 Getting Help

### Vercel Support
- Docs: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions
- Status: https://www.vercel-status.com/

### Check Vercel Status
If deployment fails unexpectedly, check: https://www.vercel-status.com/

### Debug Command
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Pull environment variables
vercel env pull

# Test locally with Vercel environment
vercel dev
```

## ✅ Deployment Checklist

Before deploying, ensure:
- [ ] All environment variables added in Vercel
- [ ] Database initialized (run init scripts)
- [ ] Latest code pushed to GitHub
- [ ] No sensitive data in code
- [ ] Dependencies up to date
- [ ] Local testing passed

After deployment:
- [ ] Test all main features
- [ ] Check function logs for errors
- [ ] Update ALLOWED_ORIGINS with actual URL
- [ ] Test file uploads
- [ ] Test database operations
- [ ] Test AI features (Gemini)
- [ ] Test routing (SafeTrace)

---

**Last Updated**: February 2026
**Vercel Version**: 2
**Status**: ✅ Deployment issues fixed
