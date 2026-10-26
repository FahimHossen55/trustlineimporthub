# 🚀 Production Deployment Guide: 100% Free Stack

Deploy **Trust Line Import HUB** with high availability, persistent database, CDN image hosting, and 24/7 uptime without spending any money:

| Component | Provider | Tier / Cost | What it does |
|---|---|---|---|
| **Website + API** | [Render](https://render.com) | Free | Hosts FastAPI backend + Vanilla frontend |
| **Database** | [Supabase](https://supabase.com) | Free | Serverless PostgreSQL with Session Pooling |
| **Media & Images** | [Cloudinary](https://cloudinary.com) | Free (25GB) | High-speed global CDN for product & flyer images |
| **Keep-Awake** | [UptimeRobot](https://uptimerobot.com) | Free | Pings `/health` & `/health/db` every 5 mins to prevent idle spin-down |

---

## Step 1: Create Supabase PostgreSQL Database (2 minutes)

1. Go to [supabase.com](https://supabase.com) and create a free project named `trustline`.
2. Save your database password.
3. Under **Connect** → **Direct** → **Session pooler** (port 5432), copy the connection string:
   ```text
   postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
   *(Keep this string handy for Render DATABASE_URL).*

---

## Step 2: Get Cloudinary API URL (2 minutes)

1. Go to [cloudinary.com](https://cloudinary.com) and create a free account.
2. Go to your **Dashboard**.
3. Under **Product Environment Credentials**, copy your **API Environment variable**:
   ```text
   cloudinary://<api_key>:<api_secret>@<cloud_name>
   ```
   *(Keep this string handy for Step 3).*

---

## Step 3: Deploy to Render (3 minutes)

### Option A: Using the Render Blueprint (`render.yaml` - Recommended)
1. Push your repository to GitHub / GitLab:
   ```bash
   git add .
   git commit -m "Configure production deployment with Neon, Cloudinary, and UptimeRobot"
   git push origin main
   ```
2. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Blueprint**.
3. Select your `Trust line Import HUB` repository.
4. Render will read `render.yaml` automatically and prompt you for the environment variables:
   - `DATABASE_URL`: Paste your Neon connection string from Step 1.
   - `CLOUDINARY_URL`: Paste your Cloudinary API string from Step 2.
   - `ADMIN_PASSWORD`: Enter your secure admin password (or leave blank to use the default `Shahin@2026!`).
5. Click **Apply**. Render will automatically build, apply migrations, create the admin account, and deploy your site!

### Option B: Manual Web Service Setup on Render
If you prefer manual setup:
1. On Render, click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name:** `trustline-import-hub`
   - **Region:** Ohio, Oregon, or Frankfurt (choose matching or near Neon region)
   - **Branch:** `main`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. Add **Environment Variables**:
   - `DATABASE_URL`: `postgresql://neondb_owner:xxxx@ep-xxxx.neon.tech/neondb?sslmode=require`
   - `CLOUDINARY_URL`: `cloudinary://<api_key>:<api_secret>@<cloud_name>`
   - `CLOUDINARY_FOLDER`: `trustline`
   - `COOKIE_SECURE`: `true`
   - `TOKEN_EXPIRE_MINUTES`: `120`
   - `ADMIN_USERNAME`: `shahin`
   - `ADMIN_PASSWORD`: `YourStrongAdminPassword!`
5. Under **Health Check Path**, enter: `/health`
6. Click **Deploy Web Service**.

---

## Step 4: Seed Demo Data into Neon & Cloudinary (Optional, 1 minute)

The app automatically initializes all database tables and the admin account on first startup!

If you also want to load the 4 sample products and 4 banner flyers into Neon and Cloudinary:
1. In your local terminal, run `seed.py` pointing to your Neon database and Cloudinary:
   ```bash
   cd backend
   # Linux/macOS or Git Bash:
   DATABASE_URL="your-neon-database-url" CLOUDINARY_URL="your-cloudinary-url" python seed.py

   # Windows PowerShell:
   $env:DATABASE_URL="your-neon-database-url"
   $env:CLOUDINARY_URL="your-cloudinary-url"
   python seed.py
   ```
2. Or open the **Shell** tab on your Render dashboard and run:
   ```bash
   cd backend && python seed.py
   ```

---

## Step 5: Keep Awake with UptimeRobot (100% Free 24/7)

Render's free tier spins down after 15 minutes of inactivity. UptimeRobot pings the server to ensure zero cold-start delay.

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account.
2. Click **+ Add New Monitor**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Trust Line Import HUB`
   - **URL (or IP):** `https://your-service-name.onrender.com/health` (replace with your actual Render URL)
   - **Monitoring Interval:** `5 minutes` or `10 minutes` (under 15 minutes prevents spin-down!)
3. Click **Create Monitor**.

🎉 **Your website is now permanently awake, backed by serverless PostgreSQL, with CDN images, running 100% free!**
