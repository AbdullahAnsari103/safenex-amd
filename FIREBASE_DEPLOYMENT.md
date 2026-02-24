# 🔥 Firebase Deployment Guide for SafeNex

## 📋 Prerequisites

1. ✅ Firebase CLI installed globally
2. ✅ Firebase project created (`voyageai-7t9x7`)
3. ✅ Logged into Firebase CLI
4. ✅ Billing enabled (Cloud Functions require Blaze plan)

## 🚀 Deployment Steps

### Step 1: Install Dependencies

```bash
# Install root dependencies
npm install

# Install functions dependencies
cd functions
npm install
cd ..
```

### Step 2: Set Environment Variables

Firebase Cloud Functions use environment config. Set all your environment variables:

```bash
firebase functions:config:set \
  app.jwt_secret="safenex_dev_secret_change_me" \
  turso.database_url="libsql://safenex-unknown9920.aws-ap-south-1.turso.io" \
  turso.auth_token="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE2MzcwNDUsImlkIjoiMjA5YzNkMWYtZDM5YS00ODUxLWE5ZjMtNWQyZjc0MzIzZDAwIiwicmlkIjoiNGMzNjJlOWUtNGMyYS00MjQyLTk1NWMtZDE2NDRhOTgyNWM4In0.lUYcR3m25ihmi6L6tfWQLy-x4O9x3UoIBJtn7aGpcHqQZwASGHDXzSJYtxq22myhUJkg6kvIKiorOA7PUlr5Cw" \
  gemini.api_key="AIzaSyB_q613NLA66hmrjYDEdv6yZV1lrWmqdEY" \
  gemini.api_key_safetrace="AIzaSyCexJHb5HfQP_U7TphNSTqB0dQhzTpCmWM" \
  gemini.model="gemini-3-flash-preview" \
  gemini.model_nexa="gemini-2.5-flash" \
  openroute.api_key="eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImY2ODMzMTRhYjJjMzQyNjI4YmYxY2JhNTgyMGM5OTY1IiwiaCI6Im11cm11cjY0In0=" \
  admin.email="abdullahansari01618@gmail.com" \
  admin.password="9920867077@Adil" \
  app.allowed_origins="https://safenex-s.web.app,https://safenex-s.firebaseapp.com" \
  app.rate_limit_window_ms="900000" \
  app.rate_limit_max_requests="100" \
  app.log_level="info"
```

**Or set them one by one:**

```bash
firebase functions:config:set app.jwt_secret="safenex_dev_secret_change_me"
firebase functions:config:set turso.database_url="libsql://safenex-unknown9920.aws-ap-south-1.turso.io"
firebase functions:config:set turso.auth_token="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE2MzcwNDUsImlkIjoiMjA5YzNkMWYtZDM5YS00ODUxLWE5ZjMtNWQyZjc0MzIzZDAwIiwicmlkIjoiNGMzNjJlOWUtNGMyYS00MjQyLTk1NWMtZDE2NDRhOTgyNWM4In0.lUYcR3m25ihmi6L6tfWQLy-x4O9x3UoIBJtn7aGpcHqQZwASGHDXzSJYtxq22myhUJkg6kvIKiorOA7PUlr5Cw"
firebase functions:config:set gemini.api_key="AIzaSyB_q613NLA66hmrjYDEdv6yZV1lrWmqdEY"
firebase functions:config:set gemini.api_key_safetrace="AIzaSyCexJHb5HfQP_U7TphNSTqB0dQhzTpCmWM"
firebase functions:config:set gemini.model="gemini-3-flash-preview"
firebase functions:config:set gemini.model_nexa="gemini-2.5-flash"
firebase functions:config:set openroute.api_key="eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImY2ODMzMTRhYjJjMzQyNjI4YmYxY2JhNTgyMGM5OTY1IiwiaCI6Im11cm11cjY0In0="
firebase functions:config:set admin.email="abdullahansari01618@gmail.com"
firebase functions:config:set admin.password="9920867077@Adil"
firebase functions:config:set app.allowed_origins="https://safenex-s.web.app,https://safenex-s.firebaseapp.com"
firebase functions:config:set app.rate_limit_window_ms="900000"
firebase functions:config:set app.rate_limit_max_requests="100"
firebase functions:config:set app.log_level="info"
```

### Step 3: Update Functions Code to Use Firebase Config

The functions need to read from Firebase config instead of process.env. This is already handled in the code.

### Step 4: Deploy to Firebase

```bash
# Deploy everything (hosting + functions)
firebase deploy --only hosting:safenex-s,functions

# Or deploy separately
firebase deploy --only hosting:safenex-s
firebase deploy --only functions
```

### Step 5: Access Your App

After deployment, your app will be available at:
- **Primary**: https://safenex-s.web.app
- **Alternative**: https://safenex-s.firebaseapp.com

## 📊 Firebase Project Structure

```
safenex/
├── public/              # Static files (HTML, CSS, JS, images)
│   ├── landing.html
│   ├── dashboard.html
│   ├── sos-redesign.html
│   └── ...
├── functions/           # Cloud Functions (Backend)
│   ├── index.js        # Main function export
│   └── package.json    # Functions dependencies
├── routes/             # Express routes (used by functions)
├── middleware/         # Express middleware
├── services/           # Business logic
├── store/              # Database operations
├── firebase.json       # Firebase configuration
└── .firebaserc         # Firebase project settings
```

## 🔧 Configuration Files

### firebase.json
- Defines hosting and functions configuration
- Rewrites API calls to Cloud Functions
- Sets cache headers for static files

### .firebaserc
- Links to your Firebase project
- Defines deployment targets

## 💰 Pricing Considerations

### Firebase Hosting (Free Tier)
- ✅ 10 GB storage
- ✅ 360 MB/day transfer
- ✅ Custom domain support

### Cloud Functions (Blaze Plan - Pay as you go)
- 2 million invocations/month FREE
- 400,000 GB-seconds FREE
- 200,000 CPU-seconds FREE
- After free tier: ~$0.40 per million invocations

**Estimated Monthly Cost**: $0-5 for low traffic, $10-30 for moderate traffic

## 🔍 Monitoring & Logs

### View Function Logs
```bash
firebase functions:log
```

### View Specific Function Logs
```bash
firebase functions:log --only api
```

### Firebase Console
Go to: https://console.firebase.google.com/project/voyageai-7t9x7
- Functions → Logs
- Hosting → Usage
- Performance Monitoring

## 🐛 Troubleshooting

### Issue 1: "Billing account not configured"
**Solution**: Enable Blaze plan in Firebase Console
1. Go to Firebase Console
2. Click "Upgrade" in left sidebar
3. Select Blaze (Pay as you go) plan
4. Add payment method

### Issue 2: Functions deployment fails
**Solution**: Check functions logs
```bash
firebase functions:log
```

Common causes:
- Missing dependencies in functions/package.json
- Environment variables not set
- Syntax errors in functions/index.js

### Issue 3: API calls return 404
**Solution**: Check firebase.json rewrites
- Ensure `/api/**` routes to `function: api`
- Redeploy: `firebase deploy --only hosting`

### Issue 4: Environment variables not working
**Solution**: 
1. List current config: `firebase functions:config:get`
2. Set missing variables
3. Redeploy functions: `firebase deploy --only functions`

### Issue 5: CORS errors
**Solution**: Update ALLOWED_ORIGINS
```bash
firebase functions:config:set app.allowed_origins="https://safenex-s.web.app,https://safenex-s.firebaseapp.com"
firebase deploy --only functions
```

## 🔄 Continuous Deployment

### Option 1: GitHub Actions (Recommended)
Create `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: cd functions && npm ci
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: voyageai-7t9x7
          channelId: live
```

### Option 2: Manual Deployment
```bash
git push origin main
firebase deploy
```

## 📱 Custom Domain Setup

1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Enter your domain (e.g., safenex.com)
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (24-48 hours)

## 🎯 Performance Optimization

### 1. Enable Caching
Already configured in firebase.json for static assets

### 2. Use CDN
Firebase Hosting automatically uses Google's CDN

### 3. Optimize Functions
- Keep functions lightweight
- Use connection pooling (already done for Turso)
- Minimize cold starts

### 4. Monitor Performance
Use Firebase Performance Monitoring:
```bash
firebase init performance
```

## 🔒 Security Best Practices

1. ✅ Environment variables stored in Firebase config (not in code)
2. ✅ CORS configured for specific domains
3. ✅ Rate limiting enabled
4. ✅ JWT authentication
5. ✅ Input validation

## 📞 Support

- Firebase Docs: https://firebase.google.com/docs
- Firebase Support: https://firebase.google.com/support
- Community: https://stackoverflow.com/questions/tagged/firebase

## ✅ Post-Deployment Checklist

- [ ] All environment variables set
- [ ] Functions deployed successfully
- [ ] Hosting deployed successfully
- [ ] Test all main features
- [ ] Check function logs for errors
- [ ] Verify database connections
- [ ] Test file uploads
- [ ] Test AI features (Gemini)
- [ ] Test routing (SafeTrace)
- [ ] Monitor costs in Firebase Console

---

**Deployment URL**: https://safenex-s.web.app  
**Firebase Project**: voyageai-7t9x7  
**Last Updated**: February 2026
