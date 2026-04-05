from __future__ import annotations

import base64
import mimetypes
import re
from html import escape
from pathlib import Path
from typing import Sequence

import requests

from app.core.config import settings
from app.schemas.phase2 import RecommendationSchema, SendPlanWardrobeItemSchema, WeatherForecastSchema


class EmailService:
    """Very small service that sends the current wardrobe plan through Resend."""

    API_URL = "https://api.resend.com/emails"

    def __init__(self) -> None:
        self.api_key = settings.resend_api_key
        self.email_from = settings.email_from or "onboarding@resend.dev"

    def send_plan_email(
        self,
        recipient_email: str,
        location: str,
        weather_forecast: Sequence[WeatherForecastSchema],
        recommendations: Sequence[RecommendationSchema],
        warnings: Sequence[str] | None = None,
        wardrobe_items: Sequence[SendPlanWardrobeItemSchema] | None = None,
    ) -> dict:
        if not self.api_key:
            raise ValueError("Email sending is not configured yet. Add RESEND_API_KEY to backend/.env first.")

        normalized_email = recipient_email.strip()
        if not normalized_email or "@" not in normalized_email:
            raise ValueError("Please provide a valid email address.")

        if not recommendations:
            raise ValueError("No wardrobe plan is available to send yet.")

        image_cid_by_item_id, attachments = self._build_inline_image_attachments(wardrobe_items or [])

        payload = {
            "from": self.email_from,
            "to": [normalized_email],
            "subject": f"Your Amazing Wardrobe Planner 5-Day Plan for {location}",
            "html": self._build_html_email(
                location,
                weather_forecast,
                recommendations,
                warnings or [],
                wardrobe_items or [],
                image_cid_by_item_id,
            ),
            "text": self._build_text_email(location, weather_forecast, recommendations, warnings or []),
        }

        if attachments:
            payload["attachments"] = attachments

        response = requests.post(
            self.API_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20,
        )

        if response.status_code >= 400:
            try:
                detail = response.json().get("message") or response.json().get("error")
            except Exception:
                detail = response.text
            raise ValueError(f"Resend could not send the email. {detail}")

        return response.json()

    def _build_html_email(
        self,
        location: str,
        weather_forecast: Sequence[WeatherForecastSchema],
        recommendations: Sequence[RecommendationSchema],
        warnings: Sequence[str],
        wardrobe_items: Sequence[SendPlanWardrobeItemSchema],
        image_cid_by_item_id: dict[str, str],
    ) -> str:
        forecast_by_day = {day.day: day for day in weather_forecast}
        wardrobe_by_id = {item.id: item for item in wardrobe_items}
        recommendation_cards = []
        safe_location = escape(self._clean_email_text(location, "your trip"))

        for rec in recommendations:
            forecast = forecast_by_day.get(rec.day)
            if forecast:
                condition_text = self._clean_email_text(forecast.condition, "Weather update")
                weather_line = f"{forecast.date} — {forecast.temperature}°C, {escape(condition_text)}"
            else:
                weather_line = escape(self._clean_email_text(rec.weather_match, "Weather update"))

            description = escape(self._clean_email_text(rec.outfit_description, "Your outfit is ready."))
            warning_text = self._clean_email_text(rec.day_warning or "", "")
            warning_html = (
                f"<p style='margin:8px 0 0;color:#b45309;'><strong>Note:</strong> {escape(warning_text)}</p>"
                if warning_text
                else ""
            )

            selected_items = [
                wardrobe_by_id[item_id]
                for item_id in getattr(rec, "selected_item_ids", []) or []
                if item_id in wardrobe_by_id
            ]
            if not selected_items and rec.clothing_items:
                selected_items = self._match_items_for_labels(wardrobe_items, rec.clothing_items)

            item_cards_html = self._build_item_cards_html(
                selected_items,
                rec.clothing_items,
                image_cid_by_item_id,
            )

            recommendation_cards.append(
                f"""
                <div style='border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:12px;background:#ffffff;'>
                  <p style='margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6366f1;'>Day {rec.day}</p>
                  <h3 style='margin:0 0 8px;font-size:18px;color:#0f172a;'>{weather_line}</h3>
                  <p style='margin:0 0 12px;color:#334155;'>{description}</p>
                  <div style='margin:0 0 8px;'>
                    <p style='margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;'>Items</p>
                    {item_cards_html}
                  </div>
                  {warning_html}
                </div>
                """
            )

        warnings_html = ""
        if warnings:
            cleaned_warnings = [self._clean_email_text(item) for item in warnings]
            warning_items = "".join(f"<li>{escape(item)}</li>" for item in cleaned_warnings if item)
            if warning_items:
                warnings_html = f"""
                <div style='border:1px solid #fde68a;border-radius:16px;padding:16px;background:#fffbeb;margin-bottom:16px;'>
                  <p style='margin:0 0 8px;font-weight:700;color:#92400e;'>Helpful notes</p>
                  <ul style='margin:0;padding-left:18px;color:#78350f;'>{warning_items}</ul>
                </div>
                """

        return f"""
        <!DOCTYPE html>
        <html>
          <body style='margin:0;padding:0;'>
            <div style='font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;'>
              <div style='max-width:720px;margin:0 auto;background:white;border-radius:20px;padding:24px;border:1px solid #e2e8f0;'>
                <p style='margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#7c3aed;'>Amazing Wardrobe Planner</p>
                <h1 style='margin:8px 0 12px;font-size:28px;'>Ready to Slay the Week 😎</h1>
                <p style='margin:0 0 16px;color:#475569;'>Here is your saved 5-day wardrobe plan for <strong>{safe_location}</strong>.</p>
                {warnings_html}
                {''.join(recommendation_cards)}
              </div>
            </div>
          </body>
        </html>
        """

    def _build_item_cards_html(
        self,
        selected_items: Sequence[SendPlanWardrobeItemSchema],
        fallback_items: Sequence[str],
        image_cid_by_item_id: dict[str, str],
    ) -> str:
        items_html: list[str] = []

        for item in selected_items:
            image_html = self._build_item_image_html(item, image_cid_by_item_id)
            clean_category = self._clean_email_text(item.category, "Wardrobe item")
            title = escape(clean_category)
            color = escape(self._clean_email_text(item.color, "Unknown"))
            gender = escape(self._clean_email_text(item.gender, "Unisex"))

            display_item_id = self._get_wardrobe_display_id(item.id)
            item_id_html = (
                f"<p style='margin:0 0 6px;font-size:11px;color:#475569;'><strong>Wardrobe ID:</strong> {escape(display_item_id)}</p>"
                if display_item_id
                else ""
            )

            items_html.append(
                f"""
                <div style='display:inline-block;vertical-align:top;width:140px;margin:0 10px 10px 0;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden;background:#f8fafc;'>
                  {image_html}
                  <div style='padding:10px 10px 12px;'>
                    <p style='margin:0 0 4px;font-size:12px;font-weight:700;color:#0f172a;'>{title}</p>
                    {item_id_html}
                    <p style='margin:0 0 6px;font-size:12px;color:#64748b;'>{color}</p>
                    <span style='display:inline-block;border:1px solid #d8b4fe;background:#f5f3ff;color:#7c3aed;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;'>{gender}</span>
                  </div>
                </div>
                """
            )

        if not items_html:
            for name in fallback_items or ["Wardrobe item"]:
                clean_name = self._clean_email_text(name, "Wardrobe item")
                emoji = self._emoji_for_item(clean_name)
                items_html.append(
                    f"""
                    <div style='display:inline-block;vertical-align:top;width:140px;margin:0 10px 10px 0;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden;background:#f8fafc;'>
                      <div style='height:92px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e0f2fe,#ede9fe);font-size:38px;text-align:center;'>
                        {emoji}
                      </div>
                      <div style='padding:10px 10px 12px;'>
                        <p style='margin:0;font-size:12px;font-weight:700;color:#0f172a;'>{escape(clean_name)}</p>
                      </div>
                    </div>
                    """
                )

        return "".join(items_html)

    def _clean_email_text(self, value: str | None, fallback: str = "") -> str:
        if value is None:
            return fallback

        text = str(value)
        text = re.sub(r"<img\b[^>]*>", " ", text, flags=re.IGNORECASE)
        text = re.sub(r"data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+", "[image]", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text or fallback

    def _get_wardrobe_display_id(self, item_id: str | None) -> str:
        raw_id = self._clean_email_text(item_id, "")
        if not raw_id:
            return ""

        hash_value = 0
        for char in raw_id:
            hash_value = (hash_value * 31 + ord(char)) % 1_000_000

        return str(hash_value).zfill(6)

    def _build_item_image_html(
        self,
        item: SendPlanWardrobeItemSchema,
        image_cid_by_item_id: dict[str, str],
    ) -> str:
        alt_text = escape(self._clean_email_text(item.category, "Wardrobe item"))
        image_cid = image_cid_by_item_id.get(item.id)

        if image_cid:
            return (
                f"<div><img src=\"cid:{image_cid}\" alt=\"{alt_text}\" width=\"140\" height=\"92\" "
                f"style=\"display:block;width:100%;height:92px;object-fit:cover;background:#e2e8f0;\" /></div>"
            )

        return f"<div style='height:92px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e0f2fe,#ede9fe);font-size:38px;text-align:center;'>{self._emoji_for_item(item.category)}</div>"

    def _build_inline_image_attachments(
        self,
        wardrobe_items: Sequence[SendPlanWardrobeItemSchema],
    ) -> tuple[dict[str, str], list[dict]]:
        image_cid_by_item_id: dict[str, str] = {}
        attachments: list[dict] = []
        backend_root = Path(__file__).resolve().parents[2]

        for index, item in enumerate(wardrobe_items, start=1):
            try:
                safe_item_id = re.sub(r"[^a-zA-Z0-9_-]+", "-", getattr(item, "id", str(index))).strip("-") or str(index)
                content_id = f"wardrobe-item-{index}-{safe_item_id}"
                inline_attachment = self._build_inline_attachment_from_data_url(
                    getattr(item, "image_data_url", None),
                    content_id,
                    fallback_filename=f"wardrobe-item-{safe_item_id}.jpg",
                )
                if inline_attachment:
                    attachments.append(inline_attachment)
                    image_cid_by_item_id[item.id] = content_id
                    continue

                if not item.file_path:
                    continue

                normalized = item.file_path.replace("\\", "/").lstrip("/")
                image_path = backend_root / normalized
                if not image_path.exists() or not image_path.is_file():
                    continue

                mime_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
                if not mime_type.startswith("image/"):
                    continue

                encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
                attachments.append(
                    {
                        "filename": image_path.name,
                        "content": encoded,
                        "contentType": mime_type,
                        "contentId": content_id,
                    }
                )
                image_cid_by_item_id[item.id] = content_id
            except Exception:
                continue

        return image_cid_by_item_id, attachments

    def _build_inline_attachment_from_data_url(
        self,
        data_url: str | None,
        content_id: str,
        fallback_filename: str,
    ) -> dict | None:
        raw_value = (data_url or "").strip()
        if not raw_value:
            return None

        match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", raw_value, flags=re.DOTALL)
        if match:
            mime_type = match.group(1)
            encoded_content = re.sub(r"\s+", "", match.group(2))
        else:
            mime_type = mimetypes.guess_type(fallback_filename)[0] or "image/jpeg"
            encoded_content = re.sub(r"\s+", "", raw_value)

        if not mime_type.startswith("image/"):
            return None

        try:
            base64.b64decode(encoded_content, validate=True)
        except Exception:
            return None

        extension = mimetypes.guess_extension(mime_type) or Path(fallback_filename).suffix or ".jpg"
        if extension == ".jpe":
            extension = ".jpg"
        filename = Path(fallback_filename).with_suffix(extension).name

        return {
            "filename": filename,
            "content": encoded_content,
            "contentType": mime_type,
            "contentId": content_id,
        }

    def _match_items_for_labels(
        self,
        wardrobe_items: Sequence[SendPlanWardrobeItemSchema],
        labels: Sequence[str],
    ) -> list[SendPlanWardrobeItemSchema]:
        matches: list[SendPlanWardrobeItemSchema] = []
        used_ids: set[str] = set()

        for label in labels:
            normalized_label = self._normalize_item_label(label)
            if not normalized_label:
                continue

            for item in wardrobe_items:
                if item.id in used_ids:
                    continue
                item_label = self._normalize_item_label(item.category)
                if not item_label:
                    continue
                if item_label == normalized_label or item_label in normalized_label or normalized_label in item_label:
                    matches.append(item)
                    used_ids.add(item.id)
                    break

        return matches

    def _normalize_item_label(self, value: str | None) -> str:
        cleaned = re.sub(r"[^a-z0-9]+", "", (value or "").strip().lower())
        aliases = {
            "tee": "tshirt",
            "tshirt": "tshirt",
            "shirt": "shirt",
            "blouse": "shirt",
            "top": "shirt",
            "jean": "jeans",
            "jeans": "jeans",
            "trouser": "pants",
            "trousers": "pants",
            "pant": "pants",
            "pants": "pants",
            "short": "shorts",
            "shorts": "shorts",
            "hoodie": "hoodie",
            "jacket": "jacket",
            "coat": "jacket",
            "blazer": "jacket",
            "cardigan": "jacket",
            "sweater": "sweater",
            "dress": "dress",
            "skirt": "skirt",
            "shoe": "shoes",
            "shoes": "shoes",
            "sneaker": "shoes",
            "sneakers": "shoes",
            "boot": "shoes",
            "boots": "shoes",
            "sandal": "shoes",
            "sandals": "shoes",
        }

        if cleaned in aliases:
            return aliases[cleaned]

        for key, mapped in aliases.items():
            if key in cleaned:
                return mapped

        return cleaned

    def _emoji_for_item(self, name: str) -> str:
        normalized = (name or "").strip().lower()
        if any(token in normalized for token in ["boot", "shoe", "sneaker", "loafer", "heel", "sandal"]):
            return "🥾"
        if any(token in normalized for token in ["pant", "jean", "trouser", "short", "legging"]):
            return "👖"
        if any(token in normalized for token in ["jacket", "coat", "outerwear", "blazer", "hoodie", "parka"]):
            return "🧥"
        if "dress" in normalized:
            return "👗"
        return "👕"

    def _build_text_email(
        self,
        location: str,
        weather_forecast: Sequence[WeatherForecastSchema],
        recommendations: Sequence[RecommendationSchema],
        warnings: Sequence[str],
    ) -> str:
        forecast_by_day = {day.day: day for day in weather_forecast}
        safe_location = self._clean_email_text(location, "your trip")
        lines = [
            "Amazing Wardrobe Planner",
            "Ready to Slay the Week 😎",
            f"Location: {safe_location}",
            "",
        ]

        cleaned_warnings = [self._clean_email_text(warning) for warning in warnings]
        cleaned_warnings = [warning for warning in cleaned_warnings if warning]
        if cleaned_warnings:
            lines.append("Helpful notes:")
            lines.extend([f"- {warning}" for warning in cleaned_warnings])
            lines.append("")

        for rec in recommendations:
            forecast = forecast_by_day.get(rec.day)
            if forecast:
                condition_text = self._clean_email_text(forecast.condition, "Weather update")
                lines.append(f"Day {rec.day} - {forecast.date} ({forecast.temperature}°C, {condition_text})")
            else:
                lines.append(f"Day {rec.day} - {self._clean_email_text(rec.weather_match, 'Weather update')}")

            lines.append(f"Plan: {self._clean_email_text(rec.outfit_description, 'Your outfit is ready.')}")

            cleaned_items = [self._clean_email_text(item) for item in rec.clothing_items]
            cleaned_items = [item for item in cleaned_items if item]
            if cleaned_items:
                lines.append("Items: " + ", ".join(cleaned_items))

            day_warning = self._clean_email_text(rec.day_warning or "", "")
            if day_warning:
                lines.append(f"Note: {day_warning}")
            lines.append("")

        return "\n".join(lines).strip()
