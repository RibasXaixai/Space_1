from fastapi import APIRouter, HTTPException
from app.services.recommendation_service import RecommendationService
from app.schemas.phase2 import (
    RecommendationsGenerateRequest,
    RecommendationsGenerateResponse,
    RecommendationRefreshDayRequest,
    RecommendationRefreshDayResponse,
    RecommendationSchema,
)

router = APIRouter()

# Initialize recommendation service
try:
    recommendation_service = RecommendationService()
except Exception as e:
    print(f"Warning: Failed to initialize RecommendationService: {str(e)}")
    recommendation_service = None


@router.post("/generate", response_model=RecommendationsGenerateResponse)
def generate_recommendations(request: RecommendationsGenerateRequest):
    """
    Generate outfit recommendations based on clothing data and weather forecast using rule-based logic.

    Final MVP flow: rule-based outfit selection plus viability warnings.
    """
    # Validate that service is available
    if not recommendation_service:
        raise HTTPException(
            status_code=503,
            detail="Recommendation service is not available. Please try again later."
        )
    
    # Generate recommendations using the service
    result = recommendation_service.generate_recommendations(
        clothing_data=request.clothing_data,
        weather_forecast=request.weather_forecast,
        location=request.location,
    )
    
    # Convert result to recommendation schemas
    recommendations = [
        RecommendationSchema(**rec) for rec in result["recommendations"]
    ]

    warnings = result.get("warnings", [])

    return RecommendationsGenerateResponse(
        success=True,
        recommendations=recommendations,
        warnings=warnings,
        message=f"Successfully generated 5-day outfit recommendations for {request.location} based on your wardrobe and weather forecast.",
    )


@router.post("/refresh-day", response_model=RecommendationRefreshDayResponse)
def refresh_recommendation_day(request: RecommendationRefreshDayRequest):
    """Regenerate recommendation for one specific day using the same wardrobe and forecast."""
    if not recommendation_service:
        raise HTTPException(
            status_code=503,
            detail="Recommendation service is not available. Please try again later.",
        )

    try:
        refreshed = recommendation_service.refresh_recommendation_for_day(
            day=request.day,
            clothing_data=request.clothing_data,
            weather_forecast=request.weather_forecast,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return RecommendationRefreshDayResponse(
        success=True,
        recommendation=RecommendationSchema(**refreshed),
        message=f"Successfully refreshed recommendation for day {request.day}.",
    )
