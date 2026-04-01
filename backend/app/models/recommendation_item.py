from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class RecommendationItem(Base):
    __tablename__ = "recommendation_items"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"), nullable=False, index=True)
    clothing_item_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=False, index=True)
    role = Column(String(60), nullable=False)

    recommendation = relationship("Recommendation", back_populates="items")
    clothing_item = relationship("ClothingItem")
