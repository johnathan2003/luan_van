from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.cart import Cart
from app.models.product import Product

router = APIRouter()


@router.get("")
@router.get("/me")
def get_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Cart).filter(Cart.user_id == current_user.user_id).all()
    total = sum(float(item.product.price) * item.quantity for item in items if item.product)
    return {
        "items": [
            {
                "cart_id": item.cart_id,
                "product_id": item.product_id,
                "product_name": item.product.product_name if item.product else None,
                "product_image": (item.product.image_urls[0] if item.product.image_urls else None) if item.product else None,
                "price": str(item.product.price) if item.product else "0",
                "quantity": item.quantity,
                "shop_id": item.product.shop_id if item.product else None,
                "shop_name": (item.product.shop.shop_name if item.product.shop else None) if item.product else None,
                "stock_quantity": item.product.stock_quantity if item.product else 0,
            }
            for item in items
        ],
        "total": total,
        "item_count": len(items),
    }


@router.post("/items", status_code=201)
def add_to_cart(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)

    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    product = db.query(Product).filter(
        Product.product_id == product_id,
        Product.status == "active",
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock_quantity < quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    existing = db.query(Cart).filter(
        Cart.user_id == current_user.user_id,
        Cart.product_id == product_id,
    ).first()

    if existing:
        existing.quantity += quantity
        db.commit()
        db.refresh(existing)
        cart_item = existing
    else:
        cart_item = Cart(user_id=current_user.user_id, product_id=product_id, quantity=quantity)
        db.add(cart_item)
        db.commit()
        db.refresh(cart_item)

    return {"message": "Added to cart", "cart_id": cart_item.cart_id, "quantity": cart_item.quantity}


@router.put("/items/{item_id}")
def update_cart_item(item_id: int, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quantity = data.get("quantity")
    item = db.query(Cart).filter(Cart.cart_id == item_id, Cart.user_id == current_user.user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    if quantity <= 0:
        db.delete(item)
        db.commit()
        return {"message": "Item removed"}
    item.quantity = quantity
    db.commit()
    return {"message": "Cart updated", "cart_id": item.cart_id, "quantity": item.quantity}


@router.delete("/items/{item_id}")
def remove_cart_item(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Cart).filter(Cart.cart_id == item_id, Cart.user_id == current_user.user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item removed from cart"}


@router.delete("")
@router.delete("/clear")
def clear_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Cart).filter(Cart.user_id == current_user.user_id).delete()
    db.commit()
    return {"message": "Cart cleared"}
