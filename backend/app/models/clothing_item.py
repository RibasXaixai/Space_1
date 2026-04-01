from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    image_url = Column(String(500), nullable=False)
    category = Column(String(120), nullable=True)
    color = Column(String(80), nullable=True)
    style = Column(String(120), nullable=True)
    warmth_level = Column(String(80), nullable=True)
    weather_suitability = Column(String(120), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", backref="clothing_items")
