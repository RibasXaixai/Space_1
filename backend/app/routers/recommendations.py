from fastapi import APIRouter, HTTPException, Request
from app.core.config import settings
from app.core.rate_limit import RateLimitRule, rate_limiter
from app.services.email_service import EmailService
from app.services.recommendation_service import RecommendationService
from app.schemas.phase2 import (
    RecommendationsGenerateRequest,
    RecommendationsGenerateResponse,
    RecommendationRefreshDayRequest,
    RecommendationRefreshDayResponse,
    RecommendationRefreshWeekRequest,
    RecommendationRefreshWeekResponse,
    RecommendationSchema,
    SendPlanEmailRequest,
    SendPlanEmailResponse,
)

router = APIRouter()

# Initialize recommendation service
try:
    recommendation_service = RecommendationService()
except Exception as e:
    print(f"Warning: Failed to initialize RecommendationService: {str(e)}")
    recommendation_service = None

try:
    email_service = EmailService()
except Exception as e:
    print(f"Warning: Failed to initialize EmailService: {str(e)}")
    email_service = None

recommendation_rate_limit_rule = RateLimitRule(
    name="recommendation-generation",
    requests=settings.openai_recommendation_rate_limit,
    window_seconds=settings.openai_rate_limit_window_seconds,
)


@router.post("/generate", response_model=RecommendationsGenerateResponse)
def generate_recommendations(request: RecommendationsGenerateRequest, http_request: Request):
    rate_limiter.enforce(http_request, recommendation_rate_limit_rule)
    """
    Generate outfit recommendations based on clothing data and weather forecast.

    Uses AI-first generation per day with automatic fallback to rule-based logic.
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
def refresh_recommendation_day(request: RecommendationRefreshDayRequest, http_request: Request):
    """Regenerate recommendation for one specific day using the same wardrobe and forecast."""
    rate_limiter.enforce(http_request, recommendation_rate_limit_rule)
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


@router.post("/refresh-week", response_model=RecommendationRefreshWeekResponse)
def refresh_recommendation_week(request: RecommendationRefreshWeekRequest, http_request: Request):
    """Regenerate the entire 5-day week, avoiding the currently shown outfits when possible."""
    rate_limiter.enforce(http_request, recommendation_rate_limit_rule)
    if not recommendation_service:
        raise HTTPException(
            status_code=503,
            detail="Recommendation service is not available. Please try again later.",
        )

    try:
        refreshed = recommendation_service.refresh_recommendations_for_week(
            clothing_data=request.clothing_data,
            weather_forecast=request.weather_forecast,
            location=request.location,
            current_recommendations=request.current_recommendations,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return RecommendationRefreshWeekResponse(
        success=True,
        recommendations=[RecommendationSchema(**rec) for rec in refreshed["recommendations"]],
        warnings=refreshed.get("warnings", []),
        message="Successfully refreshed the full 5-day wardrobe plan.",
    )


@router.post("/email-plan", response_model=SendPlanEmailResponse)
def send_plan_email(request: SendPlanEmailRequest):
    """Send the current 5-day wardrobe plan to the user's email."""
    if not email_service:
        raise HTTPException(
            status_code=503,
            detail="Email service is not available. Please try again later.",
        )

    try:
        email_service.send_plan_email(
            recipient_email=request.email,
            location=request.location,
            weather_forecast=request.weather_forecast,
            recommendations=request.recommendations,
            warnings=request.warnings,
            wardrobe_items=request.wardrobe_items,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send the email: {exc}") from exc

    return SendPlanEmailResponse(
        success=True,
        message=f"Your 5-day wardrobe plan was sent to {request.email}.",
    )
