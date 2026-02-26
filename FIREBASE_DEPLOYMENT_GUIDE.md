# Firebase Deployment Guide for SafeNex

## Prerequisites
- Node.js installed (v18 or higher)
- Firebase account
- Firebase CLI installed globally

## Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

## Step 2: Login to Firebase

```bash
firebase login
```

This will open your browser for Google authentication.

## Step 3: Initialize Firebase (Already Done)

The project is already initialized with:
- Project ID: `safenex-9920`
- Hosting configured for `public` directory
- Cloud Functions configured in `functions` directory

## Step 4: Environment Variables

All sensitive credentials are stored in `.env` files:

### Root `.env` (for local development)
- Contains all API keys and credentials
- **NEVER commit this file to Git**

### `functions/.env` (for Firebase Functions)
- Contains all environment variables needed by Cloud Functions
- **NEVER commit this file to Git**

### Firebase Configuration
The following Firebase credentials are stored in `.env`:
```
FIREBASE_API_KEY=AIzaSyCTp89gxW2RfIM4xFv_7gQs7d7HCCm_yt4
FIREBASE_AUTH_DOMAIN=safenex-9920.firebaseapp.com
FIREBASE_PROJECT_ID=safenex-9920
FIREBASE_STORAGE_BUCKET=safenex-9920.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=256877934198
FIREBASE_APP_ID=1:256877934198:web:a7e84c4e25b611fcc21157
FIREBASE_MEASUREMENT_ID=G-56QSVLCDN4
```

## Step 5: Deploy to Firebase

### Option A: Deploy Everything (Hosting + Functions)
```bash
firebase deploy
```

### Option B: Deploy Only Hosting (Static Files)
```bash
firebase deploy --only hosting
```

### Option C: Deploy Only Functions (Backend API)
```bash
firebase deploy --only functions
```

**Note:** Cloud Functions require Firebase Blaze Plan (pay-as-you-go). If you haven't upgraded, you can only deploy hosting.

## Step 6: Verify Deployment

After deployment, your app will be available at:
- **Primary URL**: https://safenex-9920.web.app
- **Alternative URL**: https://safenex-9920.firebaseapp.com

## Important Security Notes

### Files That Should NEVER Be Committed:
- `.env` (root directory)
- `functions/.env`
- `.env.production` (if created)

### Files That Are Safe to Commit:
- `.env.example` (template with placeholders)
- `.env.production.template` (template with placeholders)
- `firebase.json` (configuration)
- `.firebaserc` (project settings)

### Current .gitignore Protection:
```
.env
.env.local
.env.production
functions/.env
```

## Troubleshooting

### Issue: "Permission denied" during deployment
**Solution:** Run `firebase login` again and ensure you're logged in with the correct Google account.

### Issue: Functions deployment fails
**Solution:** 
1. Check if you're on Firebase Blaze Plan
2. Verify `functions/.env` file exists with all required variables
3. Run `cd functions && npm install` to ensure dependencies are installed

### Issue: Hosting deployed but shows blank page
**Solution:**
1. Check browser console for errors
2. Verify all files are in the `public` directory
3. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: API calls failing after deployment
**Solution:**
1. Verify `functions/.env` has all environment variables
2. Check Firebase Console → Functions → Logs for errors
3. Ensure CORS is configured correctly in `functions/index.js`

## Post-Deployment Checklist

- [ ] Hosting deployed successfully
- [ ] Website accessible at https://safenex-9920.web.app
- [ ] All pages load correctly
- [ ] API endpoints working (if functions deployed)
- [ ] Database connections working
- [ ] Authentication working
- [ ] No console errors in browser
- [ ] Mobile responsive design working

## Updating the Deployment

To update your deployed app:

1. Make changes to your code
2. Test locally
3. Commit changes to Git (excluding .env files)
4. Run `firebase deploy` again

Firebase will automatically update your live site.

## Monitoring

View deployment logs and analytics:
- Firebase Console: https://console.firebase.google.com/project/safenex-9920
- Hosting Dashboard: Check traffic and performance
- Functions Dashboard: Monitor API usage and errors (if deployed)

## Cost Considerations

### Free Tier (Spark Plan):
- Hosting: 10 GB storage, 360 MB/day transfer
- No Cloud Functions

### Blaze Plan (Pay-as-you-go):
- Hosting: Same as free tier
- Functions: First 2M invocations free/month
- Typical cost for small apps: $0-5/month

## Support

If you encounter issues:
1. Check Firebase Console logs
2. Review browser console errors
3. Check `firebase-debug.log` file
4. Visit Firebase documentation: https://firebase.google.com/docs
