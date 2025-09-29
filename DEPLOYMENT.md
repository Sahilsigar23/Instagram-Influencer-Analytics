# Deployment Guide for Render

This guide explains how to deploy the Primaspot Influencer Analytics application to Render.

## Prerequisites

1. A [Render account](https://render.com/) (free tier available)
2. A [GitHub account](https://github.com/) with your repository
3. An [Apify account](https://console.apify.com/) with API token

## Architecture

- **Backend**: Python FastAPI service on Render Web Service
- **Frontend**: React/Vite app on Render Static Site
- **Database**: SQLite (stored in Render's disk storage)

## Step 1: Prepare Your Repository

1. Push your code to GitHub
2. Ensure all files are committed including:
   - `backend/requirements.txt`
   - `backend/.env` (template only, real values will be in Render)
   - `frontend/package.json`
   - `README.md`
   - `DEPLOYMENT.md`

## Step 2: Deploy Backend to Render

### Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +" → "Web Service"**
3. Connect your GitHub repository
4. Configure the service:

**Basic Settings:**
- **Name**: `primaspot-backend` (or your choice)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend`
- **Runtime**: `Python 3`
- **Build Command**:
  ```bash
  pip install -r requirements.txt
  ```
- **Start Command**:
  ```bash
  uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

**Environment Variables:**
Add the following environment variables in Render dashboard:

| Key | Value | Notes |
|-----|-------|-------|
| `APIFY_API_TOKEN` | `your_apify_token_here` | Get from Apify console |
| `FRONTEND_URL` | `https://your-frontend.onrender.com` | Update after frontend deployment |
| `DATABASE_URL` | `sqlite+aiosqlite:///./influencers.db` | SQLite database path |
| `PYTHON_VERSION` | `3.11.0` | Specify Python version |

**Advanced Settings:**
- **Instance Type**: Free (or paid for better performance)
- **Auto-Deploy**: Yes (optional - deploys on git push)

5. Click **"Create Web Service"**
6. Wait for deployment to complete (5-10 minutes)
7. Copy your backend URL: `https://primaspot-backend.onrender.com`

### Note: Render Free Tier Limitations

- Free services spin down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds (cold start)
- Consider paid plan for production use

## Step 3: Deploy Frontend to Render

### Create Static Site

1. Go to Render Dashboard
2. Click **"New +" → "Static Site"**
3. Connect your GitHub repository
4. Configure the site:

**Basic Settings:**
- **Name**: `primaspot-frontend` (or your choice)
- **Region**: Same as backend
- **Branch**: `main`
- **Root Directory**: `frontend`
- **Build Command**:
  ```bash
  npm install && npm run build
  ```
- **Publish Directory**: `dist`

**Environment Variables:**
Add this environment variable:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://primaspot-backend.onrender.com` |

Replace with your actual backend URL from Step 2.

5. Click **"Create Static Site"**
6. Wait for deployment (3-5 minutes)
7. Copy your frontend URL: `https://primaspot-frontend.onrender.com`

## Step 4: Update Backend CORS

1. Go back to your backend service in Render
2. Update the `FRONTEND_URL` environment variable:
   - Set it to your frontend URL from Step 3
3. Click **"Save Changes"** - this will trigger a redeploy

## Step 5: Verify Deployment

1. Visit your frontend URL
2. Enter an Instagram username (e.g., `cristiano`, `leomessi`)
3. Click "🔄 Fetch from Apify" to test real data fetching
4. Verify data loads correctly

## Troubleshooting

### Backend Issues

**500 Internal Server Error:**
- Check Render logs: Go to your web service → "Logs" tab
- Verify all environment variables are set correctly
- Ensure Apify token is valid

**CORS Errors:**
- Verify `FRONTEND_URL` environment variable matches your frontend URL exactly
- Check that frontend is making requests to correct backend URL

**Database Errors:**
- Render free tier doesn't persist files between deploys
- Consider using a persistent database (PostgreSQL) for production
- SQLite works but data resets on each deployment

### Frontend Issues

**API Connection Failed:**
- Verify `VITE_API_URL` in frontend environment variables
- Check backend service is running (not spun down)
- Open browser DevTools → Network tab to debug requests

**Build Failures:**
- Check Node.js version compatibility
- Verify all dependencies in `package.json`
- Review build logs in Render dashboard

### Cold Starts (Free Tier)

If backend is on free tier:
- First request takes 30-60 seconds after inactivity
- Add loading indicator in frontend
- Consider keeping service "warm" with uptime monitors

## Production Recommendations

For production deployment:

1. **Upgrade to Paid Plans:**
   - Backend: Starter plan ($7/month) for always-on service
   - Frontend: Pro plan for custom domains and better performance

2. **Use PostgreSQL:**
   ```bash
   # Update DATABASE_URL to PostgreSQL
   DATABASE_URL=postgresql://user:pass@host/db
   ```

3. **Add Custom Domain:**
   - Backend: api.yourdomain.com
   - Frontend: app.yourdomain.com

4. **Enable HTTPS:**
   - Render provides free SSL certificates

5. **Set up Monitoring:**
   - Use Render's built-in metrics
   - Add external monitoring (UptimeRobot, etc.)

6. **Environment-specific Configs:**
   - Create separate services for staging/production
   - Use branch-specific deployments

## Maintenance

### Update ing Application:
1. Push changes to GitHub
2. Render auto-deploys (if enabled)
3. Monitor logs for any issues

### Checking Logs:
- Backend: Render Dashboard → Web Service → Logs
- Frontend: Render Dashboard → Static Site → Logs

### Managing Environment Variables:
- Update in Render Dashboard → Service → Environment
- Changes trigger automatic redeployment

## Cost Estimate

**Free Tier:**
- Backend Web Service: Free (with limitations)
- Frontend Static Site: Free
- Total: $0/month

**Production Setup:**
- Backend (Starter): $7/month
- Frontend (Pro): $7/month  
- PostgreSQL (Starter): $7/month
- Total: ~$21/month

## Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com/)
- Project Issues: [GitHub Repository](https://github.com/yourusername/primaspot)
