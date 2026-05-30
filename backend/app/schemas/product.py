from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


class CategoryCreate(BaseModel):
    category_name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None


class CategoryResponse(BaseModel):
    category_id: int
    category_name: str
    description: Optional[str]
    icon_url: Optional[str]

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    product_name: str
    description: Optional[str] = None
    price: float
    cost: Optional[float] = None
    stock_quantity: int = 0
    category_id: Optional[int] = None
    image_urls: Optional[List[str]] = []

    @field_validator("price")
    @classmethod
    def price_positive(cls, v):
        if v <= 0:
            raise ValueError("Price must be positive")
        return v

    @field_validator("stock_quantity")
    @classmethod
    def stock_non_negative(cls, v):
        if v < 0:
            raise ValueError("Stock quantity cannot be negative")
        return v


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock_quantity: Optional[int] = None
    category_id: Optional[int] = None
    image_urls: Optional[List[str]] = None


class ProductResponse(BaseModel):
    product_id: int
    shop_id: int
    category_id: Optional[int]
    product_name: str
    description: Optional[str]
    price: str
    stock_quantity: int
    image_urls: Optional[List[str]]
    status: str
    rating: str
    total_reviews: int
    views_count: int
    sales_count: int
    created_at: Optional[datetime]
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    products: List[ProductResponse]
    total: int
    page: int
    pages: int


class DeletionRequestCreate(BaseModel):
    reason: str


class DeletionRequestResponse(BaseModel):
    deletion_req_id: int
    product_id: int
    reason: Optional[str]
    status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ApprovalAction(BaseModel):
    reason: Optional[str] = None
