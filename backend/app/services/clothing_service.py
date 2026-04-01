import shutil
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.clothing_item import ClothingItem

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_upload_file(upload_file) -> str:
    filename = f"{uuid4().hex}_{Path(upload_file.filename).name}"
    destination = UPLOAD_DIR / filename
    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return f"/uploads/{filename}"


def create_clothing_item(db: Session, user_id: int, data: dict) -> ClothingItem:
    item = ClothingItem(user_id=user_id, **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_clothing_items(db: Session, user_id: int) -> list[ClothingItem]:
    return (
        db.query(ClothingItem)
        .filter(ClothingItem.user_id == user_id)
        .order_by(ClothingItem.created_at.desc())
        .all()
    )


def get_clothing_item(db: Session, user_id: int, item_id: int) -> ClothingItem | None:
    return (
        db.query(ClothingItem)
        .filter(ClothingItem.user_id == user_id, ClothingItem.id == item_id)
        .first()
    )


def update_clothing_item(db: Session, item: ClothingItem, updates: dict) -> ClothingItem:
    for field, value in updates.items():
        setattr(item, field, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_clothing_item(db: Session, item: ClothingItem) -> None:
    db.delete(item)
    db.commit()
