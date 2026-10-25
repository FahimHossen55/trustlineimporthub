"""Owner-only management endpoints. Every route requires a valid session."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..images import delete_image, save_image
from ..models import Category, Flyer, Product, ProductImage
from ..schemas import CategoryIn, ProductIn, QuickUpdateIn
from ..security import get_current_owner
from ..serializers import flyer_out, product_out

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_owner)])

MAX_IMAGES_PER_PRODUCT = 10


def _get_product(db: Session, pid: int) -> Product:
    p = db.get(Product, pid)
    if not p:
        raise HTTPException(404, "Product not found")
    return p


def _check_category(db: Session, cid: int | None):
    if cid is not None and not db.get(Category, cid):
        raise HTTPException(400, "Category does not exist")


# ---------------- Dashboard ----------------
@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    def count(*where):
        return db.scalar(select(func.count(Product.id)).where(*where)) or 0

    top = db.scalars(select(Product).order_by(Product.views.desc()).limit(5)).all()
    return {
        "total": count(),
        "in_stock": count(Product.availability == "in_stock"),
        "low_stock": count(Product.availability == "low_stock"),
        "out_of_stock": count(Product.availability == "out_of_stock"),
        "upcoming": count(Product.availability == "upcoming"),
        "flyers": db.scalar(select(func.count(Flyer.id))) or 0,
        "categories": db.scalar(select(func.count(Category.id))) or 0,
        "top_viewed": [{"id": p.id, "name": p.name, "views": p.views} for p in top],
    }


# ---------------- Products ----------------
@router.get("/products")
def admin_products(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.category))
        .order_by(Product.updated_at.desc())
    ).all()
    return [product_out(p) for p in rows]


@router.get("/products/{pid}")
def admin_product(pid: int, db: Session = Depends(get_db)):
    return product_out(_get_product(db, pid))


@router.post("/products", status_code=201)
def create_product(data: ProductIn, db: Session = Depends(get_db)):
    _check_category(db, data.category_id)
    p = Product(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return product_out(p)


@router.put("/products/{pid}")
def update_product(pid: int, data: ProductIn, db: Session = Depends(get_db)):
    p = _get_product(db, pid)
    _check_category(db, data.category_id)
    if data.price != p.price:
        p.price_updated_at = datetime.now(timezone.utc)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return product_out(p)


@router.patch("/products/{pid}/quick")
def quick_update(pid: int, data: QuickUpdateIn, db: Session = Depends(get_db)):
    """Inline price / availability update from the product table."""
    p = _get_product(db, pid)
    if data.clear_price:
        p.price = None
        p.price_updated_at = datetime.now(timezone.utc)
    elif data.price is not None and data.price != p.price:
        p.price = data.price
        p.price_updated_at = datetime.now(timezone.utc)
    if data.availability:
        p.availability = data.availability
    db.commit()
    db.refresh(p)
    return product_out(p)


@router.delete("/products/{pid}")
def delete_product(pid: int, db: Session = Depends(get_db)):
    p = _get_product(db, pid)
    files = [i.filename for i in p.images]
    db.delete(p)
    db.commit()
    for f in files:
        delete_image(f)
    return {"ok": True}


# ---------------- Product images ----------------
@router.post("/products/{pid}/images")
async def upload_images(pid: int, files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    p = _get_product(db, pid)
    if len(p.images) + len(files) > MAX_IMAGES_PER_PRODUCT:
        raise HTTPException(400, f"Maximum {MAX_IMAGES_PER_PRODUCT} images per product")
    has_cover = any(i.is_cover for i in p.images)
    start = len(p.images)
    for n, f in enumerate(files):
        name = await save_image(f, "product")
        db.add(ProductImage(product_id=p.id, filename=name, sort_order=start + n,
                            is_cover=(not has_cover and n == 0)))
    db.commit()
    db.refresh(p)
    return product_out(p)


@router.patch("/images/{iid}/cover")
def set_cover(iid: int, db: Session = Depends(get_db)):
    img = db.get(ProductImage, iid)
    if not img:
        raise HTTPException(404, "Image not found")
    for other in img.product.images:
        other.is_cover = other.id == img.id
    db.commit()
    db.refresh(img.product)
    return product_out(img.product)


@router.delete("/images/{iid}")
def remove_image(iid: int, db: Session = Depends(get_db)):
    img = db.get(ProductImage, iid)
    if not img:
        raise HTTPException(404, "Image not found")
    product, was_cover, fname = img.product, img.is_cover, img.filename
    db.delete(img)
    db.flush()
    db.refresh(product)
    if was_cover and product.images:
        product.images[0].is_cover = True
    db.commit()
    delete_image(fname)
    db.refresh(product)
    return product_out(product)


# ---------------- Categories ----------------
@router.post("/categories", status_code=201)
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    if db.scalar(select(Category).where(func.lower(Category.name) == data.name.lower())):
        raise HTTPException(400, "Category already exists")
    c = Category(name=data.name, icon=data.icon or "🩺")
    db.add(c)
    db.commit()
    return {"id": c.id, "name": c.name, "icon": c.icon}


@router.put("/categories/{cid}")
def update_category(cid: int, data: CategoryIn, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "Category not found")
    c.name, c.icon = data.name, data.icon or "🩺"
    db.commit()
    return {"id": c.id, "name": c.name, "icon": c.icon}


@router.delete("/categories/{cid}")
def delete_category(cid: int, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "Category not found")
    for p in c.products:
        p.category_id = None
    db.delete(c)
    db.commit()
    return {"ok": True}


# ---------------- Flyers ----------------
def _clean(s: str, n: int) -> str:
    return (s or "").strip()[:n]


def _check_link(link: str) -> str:
    link = _clean(link, 300)
    if link and not (link.startswith("https://") or link.startswith("http://") or link.startswith("/") or link.startswith("#")):
        raise HTTPException(400, "Link must start with https://, / or #")
    return link


@router.get("/flyers")
def admin_flyers(db: Session = Depends(get_db)):
    return [flyer_out(f) for f in db.scalars(select(Flyer).order_by(Flyer.sort_order, Flyer.id)).all()]


@router.post("/flyers", status_code=201)
async def create_flyer(
    image: UploadFile = File(...),
    title: str = Form(""),
    subtitle: str = Form(""),
    link: str = Form(""),
    is_active: bool = Form(True),
    sort_order: int = Form(0),
    db: Session = Depends(get_db),
):
    name = await save_image(image, "flyer")
    f = Flyer(title=_clean(title, 120), subtitle=_clean(subtitle, 250), link=_check_link(link),
              image=name, is_active=is_active, sort_order=sort_order)
    db.add(f)
    db.commit()
    return flyer_out(f)


@router.put("/flyers/{fid}")
async def update_flyer(
    fid: int,
    title: str = Form(""),
    subtitle: str = Form(""),
    link: str = Form(""),
    is_active: bool = Form(True),
    sort_order: int = Form(0),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    f = db.get(Flyer, fid)
    if not f:
        raise HTTPException(404, "Flyer not found")
    old = None
    if image is not None and image.filename:
        old = f.image
        f.image = await save_image(image, "flyer")
    f.title, f.subtitle, f.link = _clean(title, 120), _clean(subtitle, 250), _check_link(link)
    f.is_active, f.sort_order = is_active, sort_order
    db.commit()
    delete_image(old)
    return flyer_out(f)


@router.delete("/flyers/{fid}")
def delete_flyer(fid: int, db: Session = Depends(get_db)):
    f = db.get(Flyer, fid)
    if not f:
        raise HTTPException(404, "Flyer not found")
    name = f.image
    db.delete(f)
    db.commit()
    delete_image(name)
    return {"ok": True}
