# SafeTrace Routing Guide

## Overview
SafeTrace uses a dual-provider routing system for maximum reliability and coverage:

1. **Primary**: OpenRouteService (free, open-source)
2. **Fallback**: Mapbox Directions API (better India coverage)

## Why Two Providers?

OpenRouteService has excellent global coverage but limited road data in some regions, particularly India. When OpenRouteService cannot find a route, SafeTrace automatically falls back to Mapbox, which has comprehensive India coverage.

## Setup Instructions

### 1. OpenRouteService (Required)
Already configured in your `.env` file. Free tier includes:
- 2,000 requests/day
- No credit card required
- Sign up at: https://openrouteservice.org/dev/#/signup

### 2. Mapbox API (Recommended for India)

#### Get API Key:
1. Go to [Mapbox Account](https://account.mapbox.com/)
2. Sign up for free (no credit card required)
3. Go to "Access tokens"
4. Create a new token or use the default public token
5. Copy the access token

#### Add to Environment:
```bash
MAPBOX_API_KEY=your_mapbox_access_token_here
```

#### Pricing (as of 2026):
- **Free tier**: 100,000 requests/month (permanent)
- **No credit card required** for free tier
- **After free tier**: $0.60 per 1,000 requests
- **Recommendation**: Free tier is sufficient for most apps

#### Secure Your API Key:
1. In Mapbox Account → Access tokens
2. Click your token → "Edit token"
3. Add URL restrictions (optional)
4. Set token scopes (only enable "Directions API")
5. Save

## How It Works

```
User requests route
    ↓
Try OpenRouteService
    ↓
Success? → Return route
    ↓
Failed (404/no route)?
    ↓
Try Mapbox (if configured)
    ↓
Success? → Return route
    ↓
Failed? → Show error message
```

## Error Messages

### "No route found between these locations"
- **Cause**: OpenRouteService doesn't have road data for this area
- **Solution**: 
  - Add Mapbox API key (recommended - 100k free requests/month)
  - Try different locations
  - Try different travel mode (walk/bike/car)

### "Both routing services could not find a path"
- **Cause**: Neither provider can find a route
- **Possible reasons**:
  - Locations are on different islands/continents
  - No roads connect the locations
  - Locations are in restricted areas
- **Solution**: Verify locations are accessible and connected

### "Mapbox API access denied"
- **Cause**: API key not configured or invalid
- **Solution**: Check API key in `.env` file and verify it's valid at account.mapbox.com

## Testing

Test the routing system with these Mumbai locations:

```javascript
// Test 1: Short route (should work with OpenRouteService)
From: "Gateway of India, Mumbai"
To: "Colaba Causeway, Mumbai"

// Test 2: Longer route (may need Google Maps fallback)
From: "Chhatrapati Shivaji Terminus, Mumbai"
To: "Bandra-Worli Sea Link, Mumbai"

// Test 3: Cross-city route (likely needs Google Maps)
From: "Mumbai Airport"
To: "Navi Mumbai"
```

## Monitoring

Check server logs for routing provider usage:
```
OpenRouteService response structure: {...}  // Primary provider
OpenRouteService failed, trying Mapbox fallback...  // Fallback triggered
Mapbox returned X route(s)  // Fallback success
```

## Cost Optimization

1. **OpenRouteService handles most requests** (free, 2k/day)
2. **Mapbox only used when needed** (free, 100k/month)
3. **Route caching** reduces API calls (30s TTL)
4. **Both providers have generous free tiers** - no billing needed for most apps

## Troubleshooting

### Routes not found in India
→ Add Mapbox API key (100k free requests/month, no credit card)

### "API rate limit exceeded"
→ Wait a few minutes or upgrade API plan

### "Request timed out"
→ Check internet connection, try again

### Routes avoid danger zones but still show warnings
→ This is expected - routes avoid Critical/High zones but may pass near Medium/Low zones

## Future Improvements

- [ ] Add Mapbox as third fallback option
- [ ] Implement smarter provider selection based on region
- [ ] Add route quality scoring
- [ ] Cache routes for longer (1 hour) for popular routes
