"""Load demo data (categories, the 4 sample products and 4 flyers).

Usage (from the backend folder):  python seed.py
Safe to run only once - it skips if products already exist.
"""
import asyncio
import io
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import func, select

from app.database import Base, SessionLocal, engine
from app.images import save_image
from app.models import Category, Flyer, Product, ProductImage

ROOT = Path(__file__).resolve().parent.parent
PRODUCTS_DIR = ROOT / "Products"
FLYERS_DIR = ROOT / "image"

CATEGORIES = [
    ("Diagnostic Devices", "🩺"),
    ("Hospital Furniture", "🛏️"),
    ("Physiotherapy & Rehab", "🦵"),
    ("Medical Consumables", "🧤"),
    ("Monitoring Equipment", "📈"),
]

PRODUCTS = [
    dict(
        img="product2.jpg", category="Diagnostic Devices",
        name="ERA Dual Check 2-in-1 (Blood Glucose + BP Monitor)", brand="ERA", origin="China",
        short_description="Advanced multifunction monitor – blood glucose and blood pressure in one rechargeable device.",
        description="ERA Dual Check is a unique 2-in-1 monitor that measures blood glucose and blood pressure "
                    "with a single compact unit. Large bright display, rechargeable with USB cable, portable and "
                    "easy to carry. Ideal for pharmacies, clinics and home-care distributors.",
        specs="Functions: Blood Glucose, Blood Pressure, Pulse\nPower: Rechargeable (USB)\nDisplay: Large LED\n"
              "In the box: Monitor, Cuff, Test strips, Lancets, Manual",
        unit="unit", price=3850, old_price=4200, moq=10, availability="in_stock", is_featured=True,
    ),
    dict(
        img="product4.jpg", category="Monitoring Equipment",
        name="Omron HEM-7121J Upper Arm BP Monitor", brand="Omron", origin="Japan / Vietnam",
        short_description="Clinically validated upper-arm blood pressure monitor with IntelliSense technology.",
        description="The world's No.1 BP monitor brand. HEM-7121J offers accurate, comfortable readings with "
                    "Omron IntelliSense, cuff wrapping guide and irregular heartbeat detection. CE 0197 certified.",
        specs="Model: HEM-7121J\nCuff: 22–32 cm (HEM-CR24)\nMemory: 30 readings\nCertification: CE 0197\n"
              "Warranty: 2+1 years",
        unit="unit", price=3450, moq=10, availability="low_stock", is_featured=True,
    ),
    dict(
        img="product1.jpg", category="Physiotherapy & Rehab",
        name="Arm & Leg Pedal Exerciser with LCD", brand="Generic", origin="China",
        short_description="Compact variable-resistance pedal exerciser for elderly and rehab patients.",
        description="Low-impact arm and leg exerciser perfect for seniors, physiotherapy centers and home rehab. "
                    "Adjustable resistance knob, built-in LCD display for time/count/calories, anti-slip feet "
                    "and foldable chrome steel frame.",
        specs="Resistance: Adjustable knob\nDisplay: LCD (time, count, calories)\nFrame: Chrome-plated steel\n"
              "Feet: Anti-slip\nFoldable: Yes",
        unit="piece", price=2650, moq=5, availability="in_stock", is_featured=True,
    ),
    dict(
        img="product3.jpg", category="Hospital Furniture",
        name="Stainless Steel Gynecological Examination Bed", brand="Trust Line", origin="China",
        short_description="Heavy-duty SS examination bed with adjustable backrest, leg supports and wheels.",
        description="Durable stainless-steel gynecology / obstetric examination table with thick PU-leather "
                    "cushions, adjustable backrest, leg rests, side handles and lockable castor wheels. "
                    "Next shipment arriving soon – pre-order now to reserve your quantity.",
        specs="Frame: Stainless steel\nUpholstery: PU leather, high-density foam\nBackrest: Adjustable\n"
              "Wheels: Lockable castors",
        unit="piece", price=26500, moq=2, availability="upcoming", expected_arrival="December 2026",
        is_featured=False,
    ),
]

FLYERS = [
    ("flayer1.jpg", "Trusted Medical Imports", "Wholesale medical devices at the best price in Bangladesh"),
    ("flayer2.jpg", "Bulk Orders Welcome", "Special rates for pharmacies, clinics & hospitals"),
    ("flayer3.jpg", "Genuine Brands Only", "Omron, ERA and more – 100% authentic products"),
    ("flayer4.jpg", "Order on WhatsApp", "Quick response from Shahin Perveg – 01684822605"),
]


def as_upload(path: Path) -> UploadFile:
    return UploadFile(filename=path.name, file=io.BytesIO(path.read_bytes()))


async def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.scalar(select(func.count(Product.id))):
            print("Products already exist – seed skipped.")
            return
        cats = {}
        for name, icon in CATEGORIES:
            c = db.scalar(select(Category).where(Category.name == name)) or Category(name=name, icon=icon)
            db.add(c)
            cats[name] = c
        db.flush()

        for d in PRODUCTS:
            d = dict(d)
            img, cat = d.pop("img"), d.pop("category")
            p = Product(**d, category_id=cats[cat].id)
            db.add(p)
            db.flush()
            if (PRODUCTS_DIR / img).exists():
                name = await save_image(as_upload(PRODUCTS_DIR / img), "product")
                db.add(ProductImage(product_id=p.id, filename=name, is_cover=True))

        for i, (img, title, sub) in enumerate(FLYERS):
            if (FLYERS_DIR / img).exists():
                name = await save_image(as_upload(FLYERS_DIR / img), "flyer")
                db.add(Flyer(title=title, subtitle=sub, image=name, sort_order=i, link="#products"))

        db.commit()
        print("[OK] Demo data loaded: categories, 4 products, 4 flyers.")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
