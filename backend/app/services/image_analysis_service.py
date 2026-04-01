import base64
import json
from pathlib import Path
from typing import Any

from openai import OpenAI
from openai.error import OpenAIError

from app.core.config import settings

client = OpenAI(api_key=settings.openai_api_key)

DEFAULT_ANALYSIS = {
    "category": "unknown",
    "color": "unknown",
    "style": "basic",
    "warmth_level": "medium",
    "weather_suitability": "general",
    "notes": "No AI metadata available.",
}


def _clean_text_value(value: Any, default: str) -> str:
    if not isinstance(value, str):
        return default
    normalized = value.strip()
    return normalized if normalized else default


def _extract_json(text: str) -> dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return {}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}


def analyze_clothing_image(image_path: Path) -> dict[str, str]:
    if not settings.openai_api_key:
        return DEFAULT_ANALYSIS.copy()

    if not image_path.exists():
        return DEFAULT_ANALYSIS.copy()

    try:
        raw_bytes = image_path.read_bytes()
        encoded_image = base64.b64encode(raw_bytes).decode("utf-8")
        image_data = f"data:image/jpeg;base64,{encoded_image}"

        prompt = (
            "You are a clothing assistant. Analyze the clothing item from the image data and "
            "return a JSON object with the exact keys: category, color, style, warmth_level, weather_suitability, notes."
        )

        response = client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {"type": "input_text", "text": "Image data provided as base64."},
                        {"type": "input_image", "image_url": image_data},
                    ],
                }
            ],
            temperature=0.2,
            max_output_tokens=250,
        )

        raw_text = getattr(response, "output_text", None)
        if not raw_text:
            outputs = getattr(response, "output", [])
            raw_text = ""
            for item in outputs:
                for content_item in item.get("content", []):
                    if content_item.get("type") == "output_text":
                        raw_text += content_item.get("text", "")

        metadata = _extract_json(raw_text or "")
        return {
            "category": _clean_text_value(metadata.get("category"), DEFAULT_ANALYSIS["category"]),
            "color": _clean_text_value(metadata.get("color"), DEFAULT_ANALYSIS["color"]),
            "style": _clean_text_value(metadata.get("style"), DEFAULT_ANALYSIS["style"]),
            "warmth_level": _clean_text_value(metadata.get("warmth_level"), DEFAULT_ANALYSIS["warmth_level"]),
            "weather_suitability": _clean_text_value(metadata.get("weather_suitability"), DEFAULT_ANALYSIS["weather_suitability"]),
            "notes": _clean_text_value(metadata.get("notes"), DEFAULT_ANALYSIS["notes"]),
        }
    except (OpenAIError, ValueError, json.JSONDecodeError):
        return DEFAULT_ANALYSIS.copy()
