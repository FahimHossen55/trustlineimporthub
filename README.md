# trustlineimporthub

Trust Line Import HUB — B2B Wholesale Medical Equipment & Devices E-Commerce Platform in Bangladesh.

## Tech Stack
- **Backend:** FastAPI, SQLAlchemy, Pydantic, SQLite, Uvicorn, Pillow (image processing), PyJWT, bcrypt
- **Frontend:** Vanilla HTML5, Modern CSS, Responsive Design, JavaScript (ES6+)
- **Integrations:** Direct WhatsApp order dispatch, interactive cart/quote builder, secure admin portal

## Features
- **Public Storefront:** Dynamic product catalog with filters, categories, and search.
- **WhatsApp Direct Ordering:** One-click single item or multi-item bulk order dispatch to WhatsApp.
- **Pre-Order System:** Dedicated section for upcoming shipments with arrival dates.
- **Admin Dashboard:** Manage products, stock status, categories, banners/flyers, and credentials.
- **Image Optimization:** Automatic WebP compression and dimension normalization.

## Getting Started

### 1. Setup Backend
```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Initialize Owner & Demo Data
```bash
python setup_owner.py
python seed.py
```

### 3. Run Development Server
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Access the application in your browser at `http://127.0.0.1:8000` (Admin panel at `/admin.html`).
