import base64
import json
from pathlib import Path
from typing import Optional
import os

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


class OpenAIService:
    """Service for integrating with OpenAI Vision API."""

    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        
        if OpenAI is None:
            raise ImportError("openai package is required. Install with: pip install openai")
        
        self.client = OpenAI(api_key=api_key)
        # Use a vision-capable model by default. Can be overridden via OPENAI_MODEL.
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def analyze_clothing_image(self, file_path: str) -> Optional[dict]:
        """
        Analyze a clothing image using OpenAI Vision API.
        
        Args:
            file_path: Local path to the clothing image file
            
        Returns:
            Dictionary with structured clothing metadata, or None if analysis fails
        """
        try:
            # Validate file exists
            if not Path(file_path).exists():
                return None

            # Read and encode image
            with open(file_path, "rb") as f:
                image_data = f.read()
            
            base64_image = base64.b64encode(image_data).decode("utf-8")

            # Determine image media type
            suffix = Path(file_path).suffix.lower()
            media_type_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp",
            }
            media_type = media_type_map.get(suffix, "image/jpeg")

            # Create message with vision
            response = self.client.chat.completions.create(
                model=self.model,
                temperature=0,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a strict clothing image analyzer. Return only valid JSON with the requested keys.",
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{media_type};base64,{base64_image}"
                                },
                            },
                            {
                                "type": "text",
                                "text": """Analyze the MAIN visible clothing item in this photo and return a JSON object with the following fields:
{
    "category": "Type of clothing (e.g., T-Shirt, Jeans, Jacket, Sweater, Dress, etc.)",
    "color": "Primary color of the item",
    "style": "Style category (Casual, Formal, Smart Casual, Athletic, Vintage, Modern, Streetwear, or Classic)",
    "warmth_level": "How warm the item is (Light, Medium, or Heavy)",
    "weather_suitability": "Best weather for this item (Spring/Summer, Fall/Winter, All-Weather, VariableSeason, or Indoor)",
    "notes": "A brief, helpful note about this clothing item (1-2 sentences)"
}

Rules:
- Focus only on the garment itself, ignore background and lighting artifacts.
- If uncertain, choose the closest reasonable clothing value.
- Return ONLY valid JSON with double quotes and no markdown.
- Do not include explanations outside JSON.

Be concise and accurate."""
                            }
                        ],
                    }
                ],
            )

            # Parse response
            response_text = response.choices[0].message.content or ""

            # Handle occasional markdown-wrapped responses (```json ... ```)
            cleaned = response_text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`")
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:].strip()

            if "{" in cleaned and "}" in cleaned:
                cleaned = cleaned[cleaned.find("{") : cleaned.rfind("}") + 1]

            analysis = json.loads(cleaned)
            
            return analysis

        except json.JSONDecodeError as e:
            print(f"Failed to parse OpenAI response as JSON: {e}")
            return None
        except FileNotFoundError:
            print(f"Image file not found: {file_path}")
            return None
        except Exception as e:
            print(f"OpenAI analysis error: {str(e)}")
            return None
