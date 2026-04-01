import re
from typing import Any


# Matches Google Pay date format: "01 Feb, 2026", "1 Feb, 2026", "01Feb,2026", "01Feb2026", etc.
# Also handles no-space variants due to PDF extraction
DATE_PATTERN = re.compile(
    r"\d{1,2}\s*[A-Za-z]{3,9}\s*,?\s*\d{4}",
    re.IGNORECASE,
)

# Matches transaction patterns with NO spaces (as PDF extraction provides)
# Matches: "PaidtoPOOJAGOGIA"  or "ReceivedfromChetanMadaan"
# Ensures we don't capture metadata by checking it's followed by date+amount pattern
TRANSACTION_PATTERN = re.compile(
    r"(?P<prefix>Paidto|Receivedfrom)"
    r"(?P<description>[A-Z][A-Za-z\s]{1,90}?)"  # Name/merchant 
    r"(?=[\r\n]+\d{2}[A-Za-z]{3}|₹)",  # Lookahead: must have date or ₹ nearby
    re.IGNORECASE,
)

# Standalone amount pattern to find amounts after transaction
AMOUNT_PATTERN = re.compile(
    r"₹\s*(?P<amount>[\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)


def _normalize_text(text: str) -> str:
    """Normalize whitespace but preserve structure for matching."""
    # Replace multiple newlines/spaces with single space for matching
    text = re.sub(r"\n\s*\n", "\n", text)  # Keep paragraph breaks
    return text.strip()


def _extract_date_before(text: str, position: int) -> str:
    """Extract the most recent date before the given position in text."""
    window = text[max(0, position - 200):position]
    dates = DATE_PATTERN.findall(window)
    return dates[-1].strip() if dates else ""


def _extract_next_amount(text: str, position: int) -> tuple[float | None, int]:
    """Find the next amount after position and return (amount, end_position)."""
    search_region = text[position:position + 300]
    match = AMOUNT_PATTERN.search(search_region)
    if match:
        raw_amount = match.group("amount")
        amount = float(raw_amount.replace(",", ""))
        return amount, position + match.end()
    return None, position


def _clean_description(description: str) -> str:
    """Normalize and clean description text by adding spaces between camelCase words."""
    cleaned = re.sub(r"\s+", " ", description.strip())
    # Remove trailing metadata suffixes
    cleaned = re.sub(
        r"\s+(UPI|Transaction|ID|Paid|by|State|Bank|India|SBI|WO|SH).*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    # Add spaces between camelCase: "ChetanMadaan" → "Chetan Madaan"
    cleaned = re.sub(r'([a-z])([A-Z])', r'\1 \2', cleaned)
    return cleaned.strip(" -:\t")


def extract_with_regex(text: str) -> list[dict[str, Any]]:
    """
    Extract transactions from Google Pay statement text.
    Handles PDF text with spaces removed (PDFPlumber extraction).
    Matches "Paidto..." or "Receivedfrom..." followed by ₹amount.
    """
    if not text:
        return []

    transactions: list[dict[str, Any]] = []
    normalized = _normalize_text(text)

    # Find all transaction initiators (Paidto / Receivedfrom, case-insensitive)
    for match in TRANSACTION_PATTERN.finditer(normalized):
        prefix = match.group("prefix").strip().lower()
        # Handle both "Paidto" and "Paid to" variants
        tx_type = "debit" if prefix.startswith("paid") else "credit"

        raw_description = match.group("description").strip()
        description_value = _clean_description(raw_description)

        # Skip empty descriptions
        if not description_value or len(description_value.split()) < 1:
            continue

        # Extract the date before this transaction
        date_value = _extract_date_before(normalized, match.start())

        # Extract the amount after this transaction match
        amount_value, _ = _extract_next_amount(normalized, match.end())

        # Only add if we have a valid amount
        if amount_value is not None and amount_value > 0:
            transactions.append(
                {
                    "date": date_value,
                    "description": description_value,
                    "amount": amount_value,
                    "type": tx_type,
                }
            )

    return transactions


def is_valid(transactions: list[dict[str, Any]]) -> bool:
    """Validate that extracted transactions are complete and sufficient."""
    if len(transactions) < 5:
        return False

    required_fields = {"date", "description", "amount", "type"}
    for tx in transactions:
        if not required_fields.issubset(tx.keys()):
            return False
        if not tx["date"] or not tx["description"] or tx["amount"] is None or not tx["type"]:
            return False

    return True




def is_valid(transactions: list[dict[str, Any]]) -> bool:
    """Validate that extracted transactions are complete and sufficient."""
    if len(transactions) < 5:
        return False

    required_fields = {"date", "description", "amount", "type"}
    for tx in transactions:
        if not required_fields.issubset(tx.keys()):
            return False
        if not tx["date"] or not tx["description"] or tx["amount"] is None or not tx["type"]:
            return False

    return True
