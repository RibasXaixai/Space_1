from enum import Enum

from pydantic import BaseModel


class RecommendationFeedbackChoice(str, Enum):
    liked = "liked"
    disliked = "disliked"


class RecommendationFeedbackIn(BaseModel):
    feedback: RecommendationFeedbackChoice


class RecommendationFavoriteIn(BaseModel):
    favorite: bool
