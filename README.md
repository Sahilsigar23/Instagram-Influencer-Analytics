Primaspot Influencer Analytics
================================

Fullstack web app that displays an Instagram influencer profile with engagement analytics, recent posts and reels, and lightweight media analysis (keywords, vibe, and quality).

Stack
-----
- Backend: FastAPI, SQLModel/SQLite (async), OpenCV, Pillow, NumPy, Apify
- Frontend: React + Vite + TypeScript, TailwindCSS, Recharts

Quick Start
-----------

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv .venv
```

3. Activate virtual environment:
- **Windows PowerShell**: `.\.venv\Scripts\Activate.ps1`
- **Windows CMD**: `.venv\Scripts\activate.bat`
- **Linux/Mac**: `source .venv/bin/activate`

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. **Configure Apify API Token** (Required for real Instagram data):
   - Create a free account at [Apify Console](https://console.apify.com/)
   - Get your API token from [Account → Integrations](https://console.apify.com/account/integrations)
   - Open `backend/.env` file
   - Replace `your_apify_token_here` with your actual token:
     ```
     APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxx
     ```

6. Start the backend server:
```bash
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`.

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Visit `http://localhost:5173` to view the application.

Using the Application
--------------------

### Fetching Real Instagram Data with Apify

1. **Get Apify Token**: 
   - Sign up at [Apify](https://console.apify.com/)
   - Get your API token from the integrations page
   - Add it to `backend/.env`

2. **Fetch Data**:
   - Enter an Instagram username (e.g., `cristiano`, `leomessi`, `therock`)
   - Click "Load" to see existing data or sample data
   - Click "🔄 Fetch from Apify" to scrape fresh data from Instagram
   - Wait for the scraping to complete (may take 30-60 seconds)
   - The app will automatically reload with real data

3. **Analyze Posts**:
   - Click "Analyze" button on any post to extract keywords, vibe, and quality metrics
   - The analysis uses OpenCV for image processing

Endpoints
---------
- `GET /health` - Health check
- `GET /influencers/{username}` - Get profile with posts and reels
- `POST /analyze/post/{post_id}` - Run image analysis on a post
- `POST /fetch-apify/{username}` - Fetch fresh data from Instagram via Apify
- `POST /seed/{username}` - Seed sample posts and reels

Features Implemented
-------------------
✅ Profile Information (name, username, followers, following, posts count)
✅ Engagement Analytics (average likes, comments, engagement rate)
✅ Recent Posts (with images, captions, likes, comments)
✅ Recent Reels (with thumbnails, views, likes, comments)
✅ Image Analysis (keywords, vibe classification, quality indicators)
✅ Charts & Visualizations (likes vs comments, post categories, demographics)
✅ Real-time Instagram Scraping via Apify
✅ Responsive UI with dark theme

Technical Details
----------------

### Data Flow
1. User enters Instagram username
2. Frontend calls `/fetch-apify/{username}` endpoint
3. Backend uses Apify client to scrape Instagram profile and posts
4. Data is stored in SQLite database
5. Frontend displays the scraped data with analytics

### Apify Actors Used
- `apify/instagram-profile-scraper` - Scrapes profile information
- `apify/instagram-post-scraper` - Scrapes posts with detailed metrics

### Image Processing
- Uses OpenCV and PIL for image analysis
- Extracts color-based keywords (warm, bright, minimal, busy)
- Classifies vibe based on brightness and saturation
- Calculates quality indicators using Laplacian variance

Assumptions
-----------
- Apify free tier provides limited scraping credits
- Image and video analyses are heuristic and designed for demonstration
- Demographics are currently simulated (can be enhanced with follower analysis)
- Video analysis for reels is a placeholder (can be implemented with video processing libraries)

Next Steps / Enhancements
-------------------------
- [ ] Implement actual video processing for reels (object detection, scene classification)
- [ ] Add ML-based image tagging using pre-trained models
- [ ] Implement real audience demographics inference from follower data
- [ ] Add scheduled refresh jobs for automated data updates
- [ ] Implement sentiment analysis on comments
- [ ] Add trend analysis over time
- [ ] Create content recommendations based on engagement patterns
