"""Convert ORM objects into API dicts."""
from .models import Flyer, Product


def img_url(name: str) -> str:
    return f"/uploads/{name}"


def product_out(p: Product) -> dict:
    images = [{"id": i.id, "url": img_url(i.filename), "is_cover": i.is_cover} for i in p.images]
    cover = next((i["url"] for i in images if i["is_cover"]), images[0]["url"] if images else None)
    return {
        "id": p.id, "name": p.name, "brand": p.brand, "origin": p.origin,
        "short_description": p.short_description, "description": p.description, "specs": p.specs,
        "unit": p.unit, "price": p.price, "old_price": p.old_price, "show_price": p.show_price,
        "moq": p.moq, "availability": p.availability, "expected_arrival": p.expected_arrival,
        "is_featured": p.is_featured, "is_active": p.is_active, "views": p.views,
        "category_id": p.category_id, "category_name": p.category.name if p.category else None,
        "cover": cover, "images": images,
        "created_at": p.created_at, "updated_at": p.updated_at, "price_updated_at": p.price_updated_at,
    }


def public_product_out(p: Product) -> dict:
    d = product_out(p)
    if not p.show_price:
        d["price"] = None
        d["old_price"] = None
    d.pop("views", None)
    d.pop("is_active", None)
    return d


def flyer_out(f: Flyer) -> dict:
    return {
        "id": f.id, "title": f.title, "subtitle": f.subtitle, "image_url": img_url(f.image),
        "link": f.link, "is_active": f.is_active, "sort_order": f.sort_order,
    }
