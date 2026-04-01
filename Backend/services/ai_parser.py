import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
import requests


class AIParsingError(Exception):
    """Raised when AI parsing returns invalid data."""



def _strip_markdown_code_fences(text: str) -> str:
    """Remove ```json ... ``` wrappers if the model adds them."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    return cleaned.strip()



def _normalize_transaction(item: dict[str, Any], index: int) -> dict[str, Any]:
    """Validate and normalize one transaction object from the AI output."""
    required_fields = ["date", "description", "amount", "type"]
    missing_fields = [field for field in required_fields if field not in item]
    if missing_fields:
        raise AIParsingError(
            f"Transaction #{index} is missing fields: {', '.join(missing_fields)}"
        )

    try:
        date_value = datetime.strptime(str(item["date"]), "%Y-%m-%d").date()
    except ValueError as exc:
        raise AIParsingError(
            f"Transaction #{index} has invalid date format. Expected YYYY-MM-DD."
        ) from exc

    description_value = str(item["description"]).strip()
    if not description_value:
        raise AIParsingError(f"Transaction #{index} has empty description.")

    try:
        amount_value = float(item["amount"])
    except (TypeError, ValueError) as exc:
        raise AIParsingError(f"Transaction #{index} has invalid amount.") from exc

    type_value = str(item["type"]).strip().lower()
    if type_value not in {"debit", "credit"}:
        raise AIParsingError(
            f"Transaction #{index} has invalid type. Use only debit or credit."
        )

    return {
        "date": date_value,
        "description": description_value,
        "amount": amount_value,
        "type": type_value,
    }



def parse_transactions_with_ai(extracted_text: str) -> list[dict[str, Any]]:
    """Call Gemini API and return normalized transaction objects."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    load_dotenv(dotenv_path=env_path)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise AIParsingError(
            f"GEMINI_API_KEY is missing. Add it to {env_path}."
        )

    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    api_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        f"?key={api_key}"
    )

    prompt = f"""
You are a transaction extraction engine.

Extract all financial transactions from the given statement text.
Return ONLY a JSON array (no markdown, no explanation).

Each transaction must have:
- date: YYYY-MM-DD
- description: merchant/person name
- amount: number only (no currency symbol)
- type: debit or credit

Rules:
- If wording indicates 'Paid to', classify as debit.
- If wording indicates 'Received from', classify as credit.
- Use the most likely value when formatting is messy.
- Do not include any fields besides date, description, amount, type.

Statement text:
{extracted_text}
""".strip()

    try:
        response = requests.post(
            api_url,
            json={
                "system_instruction": {
                    "parts": [
                        {"text": "You output strict JSON arrays only."},
                    ]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}],
                    }
                ],
                "generationConfig": {
                    "temperature": 0,
                },
            },
            timeout=60,
        )

        if response.status_code != 200:
            raise AIParsingError(
                f"Gemini API error: {response.status_code} - {response.text}"
            )

        result = response.json()
        candidates = result.get("candidates", [])
        if not candidates:
            raise AIParsingError("Gemini returned no candidates.")

        parts = candidates[0].get("content", {}).get("parts", [])
        raw_content = "\n".join(part.get("text", "") for part in parts).strip()
        if not raw_content:
            raise AIParsingError("Gemini returned empty response content.")

        json_text = _strip_markdown_code_fences(raw_content)

        parsed = json.loads(json_text)
        if not isinstance(parsed, list):
            raise AIParsingError("AI response is not a JSON array.")

        normalized_transactions = []
        for idx, item in enumerate(parsed, start=1):
            if not isinstance(item, dict):
                raise AIParsingError(f"Transaction #{idx} is not a JSON object.")
            normalized_transactions.append(_normalize_transaction(item, idx))

        return normalized_transactions

    except requests.exceptions.ConnectionError as exc:
        raise AIParsingError(
            "Cannot connect to Gemini API. Check your internet connection."
        ) from exc
    except requests.exceptions.Timeout as exc:
        raise AIParsingError("Gemini request timed out. Try again.") from exc
    except json.JSONDecodeError as exc:
        raise AIParsingError("AI response is not valid JSON.") from exc
    except AIParsingError:
        raise
    except Exception as exc:
        raise AIParsingError(f"Failed to parse transactions with AI: {exc}") from exc


def extract_with_ai(text: str) -> list[dict[str, Any]]:
    """Compatibility wrapper for AI-based transaction extraction."""
    return parse_transactions_with_ai(text)
