from __future__ import annotations

import re

UNSAFE_CHARS_RE = re.compile(r"[\x00-\x1f\x7f<>{}$`|\\]")
EMAIL_EXTRA_RE = re.compile(r"[\s\"']")


def sanitize_email(value: str) -> str:
    email = str(value or "").strip().lower()
    email = UNSAFE_CHARS_RE.sub("", email)
    email = EMAIL_EXTRA_RE.sub("", email)[:254]

    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise ValueError("Please provide a valid email address.")

    return email


def sanitize_location(value: str, *, field_name: str = "Location") -> str:
    cleaned = " ".join(str(value or "").split())
    cleaned = UNSAFE_CHARS_RE.sub("", cleaned)[:120]

    if not cleaned:
        raise ValueError(f"{field_name} is required.")

    return cleaned


def sanitize_optional_location(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = " ".join(str(value).split())
    if not cleaned:
        return None

    return sanitize_location(cleaned)
