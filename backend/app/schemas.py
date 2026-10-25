from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Availability = Literal["in_stock", "low_stock", "out_of_stock", "upcoming"]


def _strip(v):
    return v.strip() if isinstance(v, str) else v


# ---------- Auth ----------
class LoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class OwnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    username: str
    full_name: str


# ---------- Category ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    icon: str = Field(default="🩺", max_length=8)
    _s = field_validator("name", "icon")(_strip)


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    icon: str
    product_count: int = 0


# ---------- Product ----------
class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    url: str
    is_cover: bool


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    brand: str = Field(default="", max_length=80)
    origin: str = Field(default="", max_length=60)
    short_description: str = Field(default="", max_length=300)
    description: str = Field(default="", max_length=8000)
    specs: str = Field(default="", max_length=4000)
    unit: str = Field(default="piece", max_length=40)
    price: float | None = Field(default=None, ge=0, le=100_000_000)
    old_price: float | None = Field(default=None, ge=0, le=100_000_000)
    show_price: bool = True
    moq: int = Field(default=1, ge=1, le=1_000_000)
    availability: Availability = "in_stock"
    expected_arrival: str = Field(default="", max_length=60)
    is_featured: bool = False
    is_active: bool = True
    category_id: int | None = None

    _s = field_validator("name", "brand", "origin", "short_description", "unit", "expected_arrival")(_strip)


class QuickUpdateIn(BaseModel):
    price: float | None = Field(default=None, ge=0, le=100_000_000)
    availability: Availability | None = None
    clear_price: bool = False


class ProductOut(BaseModel):
    id: int
    name: str
    brand: str
    origin: str
    short_description: str
    description: str
    specs: str
    unit: str
    price: float | None
    old_price: float | None
    show_price: bool
    moq: int
    availability: str
    expected_arrival: str
    is_featured: bool
    is_active: bool
    views: int
    category_id: int | None
    category_name: str | None
    cover: str | None
    images: list[ImageOut]
    created_at: datetime
    updated_at: datetime
    price_updated_at: datetime


# ---------- Flyer ----------
class FlyerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    subtitle: str
    image_url: str
    link: str
    is_active: bool
    sort_order: int
