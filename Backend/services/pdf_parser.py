import io
from typing import Any

import pdfplumber

from services.ai_parser import extract_with_ai
from services.regex_parser import extract_with_regex, is_valid


class PDFParsingError(Exception):
    """Raised when PDF text extraction fails."""



def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract plain text from a PDF file as one large string."""
    if not file_bytes:
        raise PDFParsingError("The uploaded PDF is empty.")

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            page_text_chunks = []
            for page in pdf.pages:
                # extract_text() can return None if no text is detected.
                page_text_chunks.append(page.extract_text() or "")

        full_text = "\n".join(page_text_chunks).strip()
        if not full_text:
            raise PDFParsingError("No readable text found in the PDF.")

        return full_text

    except PDFParsingError:
        raise
    except Exception as exc:
        raise PDFParsingError(f"Could not parse PDF: {exc}") from exc


def parse_pdf(text: str) -> list[dict[str, Any]]:
    """Parse transactions using regex first, then fallback to AI if needed."""
    print("Using regex parsing")

    # Step 1: Fast local extraction with deterministic regex rules.
    regex_transactions = extract_with_regex(text)
    print(f"Regex extracted {len(regex_transactions)} transactions")

    # Step 2: If regex output is sufficiently complete, return it directly.
    if is_valid(regex_transactions):
        return regex_transactions

    # Step 3: Fallback to AI parser for messy/unstructured statements.
    print("Using AI fallback")
    return extract_with_ai(text)
