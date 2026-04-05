# pyright: reportMissingImports=false, reportMissingModuleSource=false
from __future__ import annotations

import base64
import mimetypes
import re
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Sequence

import requests
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

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

        pdf_attachment = self._build_pdf_attachment(
            location,
            weather_forecast,
            recommendations,
            warnings or [],
            wardrobe_items or [],
        )
        if not pdf_attachment:
            raise ValueError("We could not generate the attached PDF plan right now. Please try again.")

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
                {},
            ),
            "text": self._build_text_email(location, weather_forecast, recommendations, warnings or []),
            "attachments": [pdf_attachment],
        }

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
        safe_location = escape(self._clean_email_text(location, "your trip"))
        cleaned_warnings = [self._clean_email_text(item) for item in warnings]
        cleaned_warnings = [item for item in cleaned_warnings if item]
        summary_html = self._build_summary_section_html(recommendations, wardrobe_items, cleaned_warnings)

        warnings_html = ""
        if cleaned_warnings:
            warning_items = "".join(f"<li>{escape(item)}</li>" for item in cleaned_warnings)
            warnings_html = f"""
            <div style='border:1px solid #fde68a;border-radius:16px;padding:16px;background:#fffbeb;margin-top:16px;'>
              <p style='margin:0 0 8px;font-weight:700;color:#92400e;'>Helpful notes</p>
              <ul style='margin:0;padding-left:18px;color:#78350f;'>{warning_items}</ul>
            </div>
            """

        return f"""
        <!DOCTYPE html>
        <html>
          <body style='margin:0;padding:0;background:#f8fafc;'>
            <div style='display:none;max-height:0;overflow:hidden;opacity:0;'>
              Your 5-day wardrobe plan for {safe_location} is ready. See full week on the attached PDF file.
            </div>
            <div style='font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;'>
              <div style='max-width:720px;margin:0 auto;background:white;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;'>
                <div style='padding:24px;background:linear-gradient(135deg,#0f766e,#2563eb);color:#ffffff;'>
                  <p style='margin:0;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#e0f2fe;'>Amazing Wardrobe Planner</p>
                  <h1 style='margin:8px 0 10px;font-size:28px;'>Your 5-Day Wardrobe Plan ✨</h1>
                  <p style='margin:0 0 10px;color:#eff6ff;'>Here is your saved outfit summary for <strong>{safe_location}</strong>.</p>
                  <span style='display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.22);font-size:12px;font-weight:700;'>Open the attached PDF for the full visual plan</span>
                </div>
                <div style='padding:24px;'>
                  <p style='margin:0 0 12px;color:#334155;'>We kept this email short and clean so it is easy to scan quickly.</p>
                  {summary_html}
                  <div style='border:1px solid #dbeafe;border-radius:16px;padding:16px;background:#f8fbff;margin-top:16px;'>
                    <p style='margin:0 0 8px;font-weight:700;color:#1d4ed8;'>See full week on the attached PDF file</p>
                    <ul style='margin:0;padding-left:18px;color:#334155;'>
                      <li>All 5 day-by-day outfit suggestions</li>
                      <li>Weather details and warnings</li>
                      <li>Wardrobe item images and wardrobe IDs</li>
                    </ul>
                  </div>
                  {warnings_html}
                  <p style='margin:18px 0 0;color:#64748b;font-size:12px;'>Generated by Amazing Wardrobe Planner.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
        """

    def _build_summary_section_html(
        self,
        recommendations: Sequence[RecommendationSchema],
        wardrobe_items: Sequence[SendPlanWardrobeItemSchema],
        warnings: Sequence[str],
    ) -> str:
        return f"""
        <table role='presentation' width='100%' style='margin:0 0 16px;border-spacing:0;border-collapse:separate;'>
          <tr>
            <td style='width:33.33%;padding:0 8px 8px 0;'>
              <div style='border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;'>
                <p style='margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;'>Planned days</p>
                <p style='margin:0;font-size:24px;font-weight:700;color:#0f172a;'>{len(recommendations)}</p>
              </div>
            </td>
            <td style='width:33.33%;padding:0 8px 8px 0;'>
              <div style='border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;'>
                <p style='margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;'>Wardrobe items</p>
                <p style='margin:0;font-size:24px;font-weight:700;color:#0f172a;'>{len(wardrobe_items)}</p>
              </div>
            </td>
            <td style='width:33.33%;padding:0 0 8px;'>
              <div style='border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc;'>
                <p style='margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;'>Helpful notes</p>
                <p style='margin:0;font-size:24px;font-weight:700;color:#0f172a;'>{len(warnings)}</p>
              </div>
            </td>
          </tr>
        </table>
        """

    def _build_weather_overview_html(
        self,
        weather_forecast: Sequence[WeatherForecastSchema],
    ) -> str:
        if not weather_forecast:
            return ""

        cells = []
        for day in weather_forecast:
            condition_text = escape(self._clean_email_text(day.condition, "Weather update"))
            cells.append(
                f"""
                <td style='padding:0 8px 8px 0;vertical-align:top;'>
                  <div style='border:1px solid #dbeafe;border-radius:14px;padding:12px;background:#f8fbff;min-width:108px;'>
                    <p style='margin:0 0 4px;font-size:11px;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;'>Day {day.day}</p>
                    <p style='margin:0 0 4px;font-size:13px;font-weight:700;color:#0f172a;'>{escape(day.date)}</p>
                    <p style='margin:0 0 6px;font-size:12px;color:#334155;'>{condition_text}</p>
                    <p style='margin:0;font-size:12px;color:#475569;'>🌡️ {day.temperature}°C • 🌧️ {day.chance_of_rain}%</p>
                  </div>
                </td>
                """
            )

        return f"""
        <div style='margin:0 0 16px;'>
          <p style='margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;'>Week at a glance</p>
          <table role='presentation' width='100%' style='border-spacing:0;border-collapse:separate;'>
            <tr>{''.join(cells)}</tr>
          </table>
        </div>
        """

    def _format_confidence_percent(self, value: float | int | None) -> int:
        try:
            numeric = float(value or 0)
        except (TypeError, ValueError):
            return 0

        if numeric <= 1:
            numeric *= 100

        return max(0, min(100, int(round(numeric))))

    def _build_pdf_attachment(
        self,
        location: str,
        weather_forecast: Sequence[WeatherForecastSchema],
        recommendations: Sequence[RecommendationSchema],
        warnings: Sequence[str],
        wardrobe_items: Sequence[SendPlanWardrobeItemSchema],
    ) -> dict | None:
        pdf_bytes = self._build_plan_pdf_bytes(location, weather_forecast, recommendations, warnings, wardrobe_items)
        if not pdf_bytes:
            return None

        safe_location = self._clean_email_text(location, "wardrobe-plan").lower()
        slug = re.sub(r"[^a-z0-9]+", "-", safe_location).strip("-") or "wardrobe-plan"
        return {
            "filename": f"wardrobe-plan-{slug}.pdf",
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
            "contentType": "application/pdf",
        }

    def _build_plan_pdf_bytes(
        self,
        location: str,
        weather_forecast: Sequence[WeatherForecastSchema],
        recommendations: Sequence[RecommendationSchema],
        warnings: Sequence[str],
        wardrobe_items: Sequence[SendPlanWardrobeItemSchema],
    ) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=0.55 * inch,
            rightMargin=0.55 * inch,
            topMargin=0.6 * inch,
            bottomMargin=0.6 * inch,
        )

        styles = getSampleStyleSheet()
        overline_style = ParagraphStyle(
            "PdfOverline",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#2563eb"),
            spaceAfter=4,
        )
        title_style = ParagraphStyle(
            "PdfTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=6,
        )
        subtitle_style = ParagraphStyle(
            "PdfSubtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#475569"),
            spaceAfter=8,
        )
        body_style = ParagraphStyle(
            "PdfBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
            spaceAfter=6,
        )
        section_style = ParagraphStyle(
            "PdfSection",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=6,
            spaceBefore=8,
        )
        day_header_style = ParagraphStyle(
            "PdfDayHeader",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=8,
        )
        note_style = ParagraphStyle(
            "PdfNote",
            parent=body_style,
            textColor=colors.HexColor("#92400e"),
        )

        forecast_by_day = {day.day: day for day in weather_forecast}
        wardrobe_by_id = {item.id: item for item in wardrobe_items}

        story: list = [
            Paragraph("Amazing Wardrobe Planner", overline_style),
            Paragraph("Your 5-Day Visual Plan", title_style),
            Paragraph(
                f"Location: <b>{escape(self._clean_email_text(location, 'your trip'))}</b>",
                subtitle_style,
            ),
            Paragraph(
                "This PDF gives you a polished, day-by-day view of the week ahead, with weather context, outfit reasoning, and visual wardrobe references.",
                body_style,
            ),
            Spacer(1, 0.12 * inch),
        ]

        summary_table = Table(
            [[
                f"Planned days\n{len(recommendations)}",
                f"Wardrobe items\n{len(wardrobe_items)}",
                f"Helpful notes\n{len([w for w in warnings if self._clean_email_text(w)])}",
            ]],
            colWidths=[2.25 * inch, 2.25 * inch, 2.25 * inch],
        )
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#dbeafe")),
                    ("INNERGRID", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
                    ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 11),
                    ("LEADING", (0, 0), (-1, -1), 15),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ]
            )
        )
        story.extend([summary_table, Spacer(1, 0.16 * inch)])

        if weather_forecast:
            story.append(Paragraph("Weather forecast for the week", section_style))
            story.append(
                Paragraph(
                    "Use this forecast summary to understand how each outfit was chosen for the coming days.",
                    body_style,
                )
            )
            forecast_rows = [["Day", "Date", "Condition", "Temp", "Rain", "Humidity", "Wind"]]
            for day in weather_forecast:
                forecast_rows.append([
                    f"Day {day.day}",
                    self._clean_email_text(day.date, "-"),
                    self._clean_email_text(day.condition, "Weather update"),
                    f"{day.temperature}°C",
                    f"{day.chance_of_rain}%",
                    f"{day.humidity}%",
                    f"{day.wind_kph} kph",
                ])

            forecast_table = Table(
                forecast_rows,
                colWidths=[0.7 * inch, 1.05 * inch, 2.0 * inch, 0.7 * inch, 0.7 * inch, 0.8 * inch, 0.9 * inch],
                repeatRows=1,
            )
            forecast_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0f2fe")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("LEADING", (0, 0), (-1, -1), 11),
                        ("GRID", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
                        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.extend([forecast_table, Spacer(1, 0.16 * inch)])

        cleaned_warnings = [self._clean_email_text(warning) for warning in warnings]
        cleaned_warnings = [warning for warning in cleaned_warnings if warning]
        if cleaned_warnings:
            story.append(Paragraph("Helpful notes", section_style))
            for warning in cleaned_warnings:
                story.append(Paragraph(f"• {escape(warning)}", body_style))
            story.append(Spacer(1, 0.08 * inch))

        story.append(
            Paragraph(
                "The following pages show one outfit recommendation per day, including the selected wardrobe items and the reason each look matches the forecast.",
                body_style,
            )
        )

        for rec in recommendations:
            story.append(PageBreak())
            story.append(
                Paragraph(
                    f"Day {rec.day} — {escape(self._clean_email_text(rec.date, f'Day {rec.day}'))}",
                    day_header_style,
                )
            )

            forecast = forecast_by_day.get(rec.day)
            if forecast:
                condition_text = escape(self._clean_email_text(forecast.condition, "Weather update"))
                story.append(
                    Paragraph(
                        f"Weather: {forecast.temperature}°C, {condition_text}, rain {forecast.chance_of_rain}%, humidity {forecast.humidity}%, wind {forecast.wind_kph} kph",
                        body_style,
                    )
                )
            elif rec.weather_match:
                story.append(Paragraph(f"Weather: {escape(self._clean_email_text(rec.weather_match))}", body_style))

            story.append(
                Paragraph(
                    f"<b>Plan:</b> {escape(self._clean_email_text(rec.outfit_description, 'Your outfit is ready.'))}",
                    body_style,
                )
            )
            if rec.weather_match:
                story.append(
                    Paragraph(
                        f"<b>Why it works:</b> {escape(self._clean_email_text(rec.weather_match))}",
                        body_style,
                    )
                )

            confidence_percent = self._format_confidence_percent(getattr(rec, "confidence", 0))
            source_label = self._clean_email_text(getattr(rec, "recommendation_source", "rule-based"), "rule-based")
            story.append(
                Paragraph(
                    f"<b>Source:</b> {escape(source_label)} • <b>Confidence:</b> {confidence_percent}%",
                    body_style,
                )
            )

            day_warning = self._clean_email_text(rec.day_warning or "", "")
            if day_warning:
                story.append(Paragraph(f"<b>Note:</b> {escape(day_warning)}", note_style))

            selected_items = [
                wardrobe_by_id[item_id]
                for item_id in getattr(rec, "selected_item_ids", []) or []
                if item_id in wardrobe_by_id
            ]
            if not selected_items and rec.clothing_items:
                selected_items = self._match_items_for_labels(wardrobe_items, rec.clothing_items)

            item_cards = []
            labels = list(rec.clothing_items or ["Wardrobe item"])
            for index, label in enumerate(labels):
                item = selected_items[index] if index < len(selected_items) else None
                item_cards.append(self._build_pdf_item_card(item, label))

            if item_cards:
                rows = []
                for index in range(0, len(item_cards), 2):
                    row = item_cards[index:index + 2]
                    if len(row) < 2:
                        row.append("")
                    rows.append(row)
                cards_table = Table(rows, colWidths=[3.3 * inch, 3.3 * inch])
                cards_table.setStyle(
                    TableStyle(
                        [
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 0),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                        ]
                    )
                )
                story.extend([Spacer(1, 0.06 * inch), cards_table, Spacer(1, 0.08 * inch)])

        doc.build(story)
        return buffer.getvalue()

    def _build_pdf_item_card(
        self,
        item: SendPlanWardrobeItemSchema | None,
        fallback_label: str,
    ) -> Table:
        styles = getSampleStyleSheet()
        item_title_style = ParagraphStyle(
            "PdfItemTitle",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=3,
        )
        item_meta_style = ParagraphStyle(
            "PdfItemMeta",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#475569"),
            spaceAfter=2,
        )

        display_name = self._clean_email_text(item.category if item else fallback_label, "Wardrobe item")
        content = []
        image_flowable = self._build_pdf_image_flowable(item)
        if image_flowable:
            content.append(image_flowable)
        else:
            content.append(
                Paragraph(
                    f"<para alignment='center'><font size='22'>{self._emoji_for_item(display_name)}</font></para>",
                    item_title_style,
                )
            )

        content.append(Spacer(1, 0.08 * inch))
        content.append(Paragraph(escape(display_name), item_title_style))

        if item:
            display_item_id = self._get_wardrobe_display_id(item.id)
            if display_item_id:
                content.append(Paragraph(f"Wardrobe ID: {escape(display_item_id)}", item_meta_style))
            content.append(Paragraph(f"Color: {escape(self._clean_email_text(item.color, 'Unknown'))}", item_meta_style))
            content.append(Paragraph(f"Gender: {escape(self._clean_email_text(item.gender, 'Unisex'))}", item_meta_style))
        else:
            content.append(Paragraph("Image not available in PDF.", item_meta_style))

        card = Table([[content]], colWidths=[3.05 * inch])
        card.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
                    ("ROUNDEDCORNERS", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
        return card

    def _build_pdf_image_flowable(
        self,
        item: SendPlanWardrobeItemSchema | None,
    ) -> Image | None:
        if item is None:
            return None

        image_bytes = self._load_item_image_bytes(item)
        if not image_bytes:
            return None

        try:
            with PILImage.open(BytesIO(image_bytes)) as source_image:
                if source_image.mode not in ("RGB", "RGBA"):
                    source_image = source_image.convert("RGB")
                width, height = source_image.size
                output = BytesIO()
                source_image.save(output, format="PNG")
                output.seek(0)

            max_width = 2.7 * inch
            max_height = 1.5 * inch
            scale = min(max_width / max(width, 1), max_height / max(height, 1), 1)
            flowable = Image(output, width=width * scale, height=height * scale)
            flowable.hAlign = "CENTER"
            return flowable
        except Exception:
            return None

    def _load_item_image_bytes(
        self,
        item: SendPlanWardrobeItemSchema,
    ) -> bytes | None:
        raw_value = (getattr(item, "image_data_url", None) or "").strip()
        if raw_value:
            match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", raw_value, flags=re.DOTALL)
            encoded_content = match.group(2) if match else raw_value
            encoded_content = re.sub(r"\s+", "", encoded_content)
            try:
                return base64.b64decode(encoded_content)
            except Exception:
                return None

        if not item.file_path:
            return None

        backend_root = Path(__file__).resolve().parents[2]
        normalized = item.file_path.replace("\\", "/").lstrip("/")
        image_path = backend_root / normalized
        if not image_path.exists() or not image_path.is_file():
            return None

        try:
            return image_path.read_bytes()
        except Exception:
            return None

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
        safe_location = self._clean_email_text(location, "your trip")
        cleaned_warnings = [self._clean_email_text(warning) for warning in warnings]
        cleaned_warnings = [warning for warning in cleaned_warnings if warning]

        lines = [
            "Amazing Wardrobe Planner",
            "Your 5-Day Wardrobe Plan",
            f"Location: {safe_location}",
            f"Planned days: {len(recommendations)}",
            "",
            "This email keeps the summary short and clean.",
            "See full week on the attached PDF file.",
            "",
            "The attached PDF includes:",
            "- All 5 outfit days",
            "- Weather details and warnings",
            "- Wardrobe item images and wardrobe IDs",
        ]

        if cleaned_warnings:
            lines.append("")
            lines.append("Helpful notes:")
            lines.extend([f"- {warning}" for warning in cleaned_warnings])

        return "\n".join(lines).strip()
