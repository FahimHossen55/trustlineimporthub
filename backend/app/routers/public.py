"""Public, read-only endpoints (no login)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Category, Flyer, Product
from ..serializers import flyer_out, public_product_out

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Product.category_id, func.count(Product.id))
            .where(Product.is_active.is_(True))
            .group_by(Product.category_id)
        ).all()
    )
    cats = db.scalars(select(Category).order_by(Category.name)).all()
    return [{"id": c.id, "name": c.name, "icon": c.icon, "product_count": counts.get(c.id, 0)} for c in cats]


@router.get("/flyers")
def list_flyers(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Flyer).where(Flyer.is_active.is_(True)).order_by(Flyer.sort_order, Flyer.id)
    ).all()
    return [flyer_out(f) for f in rows]


@router.get("/products")
def list_products(
    db: Session = Depends(get_db),
    search: str = Query("", max_length=100),
    category: int | None = None,
    availability: str | None = Query(None, pattern="^(in_stock|low_stock|out_of_stock|upcoming|available)$"),
    featured: bool | None = None,
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|name)$"),
    limit: int = Query(60, ge=1, le=200),
):
    q = select(Product).options(selectinload(Product.images), selectinload(Product.category)).where(
        Product.is_active.is_(True)
    )
    if search.strip():
        like = f"%{search.strip()}%"
        q = q.where(or_(Product.name.ilike(like), Product.brand.ilike(like), Product.short_description.ilike(like)))
    if category:
        q = q.where(Product.category_id == category)
    if availability == "available":
        q = q.where(Product.availability.in_(["in_stock", "low_stock"]))
    elif availability:
        q = q.where(Product.availability == availability)
    if featured is not None:
        q = q.where(Product.is_featured.is_(featured))

    order = {
        "newest": Product.created_at.desc(),
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "name": Product.name.asc(),
    }[sort]
    q = q.order_by(order).limit(limit)
    return [public_product_out(p) for p in db.scalars(q).all()]


@router.get("/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p or not p.is_active:
        raise HTTPException(404, "Product not found")
    p.views += 1
    db.commit()
    db.refresh(p)
    return public_product_out(p)
