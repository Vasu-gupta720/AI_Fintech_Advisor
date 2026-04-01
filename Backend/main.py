from datetime import date, datetime
import hashlib
import re

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Transaction, UploadedStatement
from services.ai_parser import AIParsingError
from services.category_classifier import predict_category
from services.pdf_parser import PDFParsingError, extract_text_from_pdf, parse_pdf

app = FastAPI(title="AI Personal Finance Advisor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure the transactions table exists when the app starts.
Base.metadata.create_all(bind=engine)


def _ensure_user_id_column() -> None:
    """Backfill schema for existing DBs where user_id column was added later."""
    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("transactions")}
    if "user_id" in columns:
        return

    # SQLite-compatible additive migration.
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE transactions "
                "ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT 'default'"
            )
        )


def _ensure_category_column() -> None:
    """Backfill schema for existing DBs where category column was added later."""
    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("transactions")}
    if "category" in columns:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE transactions "
                "ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'other'"
            )
        )


_ensure_user_id_column()
_ensure_category_column()

@app.get("/")
def health_check():
    return {"status": "ok", "message": "API is running"}


@app.get("/transactions/{user_id}")
def get_transactions(user_id: str, db: Session = Depends(get_db)):
    """Fetch all persisted transactions for one user, newest first."""
    rows = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .all()
    )

    return {
        "total_transactions": len(rows),
        "transactions": [
            {
                "id": row.id,
                "user_id": row.user_id,
                "date": row.date.isoformat(),
                "description": row.description,
                "amount": row.amount,
                "type": row.type,
                "category": row.category,
            }
            for row in rows
        ],
    }


@app.post("/upload-pdf")
async def upload_pdf(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a PDF statement, parse transactions, save to DB, and return JSON.
    Uses hybrid approach: regex extraction first, AI fallback if needed.
    """
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required.")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file. Please upload a .pdf file.")

    if file.content_type and file.content_type not in {
        "application/pdf",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="Invalid content type. Expected PDF.")

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")

        # Step 0: Block duplicate statement uploads (same bytes) per user.
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        existing_upload = (
            db.query(UploadedStatement)
            .filter(
                UploadedStatement.user_id == user_id.strip(),
                UploadedStatement.file_hash == file_hash,
            )
            .first()
        )
        if existing_upload:
            raise HTTPException(
                status_code=409,
                detail="This PDF has already been uploaded for this user.",
            )

        # Step 1: Extract raw text from the uploaded PDF.
        extracted_text = extract_text_from_pdf(file_bytes)

        # Step 2: Parse with regex first; fallback to AI when regex output is weak.
        transactions_data = parse_pdf(extracted_text)

        # Step 3: Parse dates and save to database
        saved_rows = []
        for tx in transactions_data:
            # Parse date string to proper date object
            raw_date = tx.get("date", "")
            if isinstance(raw_date, (date, datetime)):
                date_obj = raw_date if isinstance(raw_date, date) else raw_date.date()
            else:
                # Try to parse date strings like "01Feb,2026" or "01 Feb, 2026"
                try:
                    from datetime import datetime as dt
                    date_str = str(raw_date).strip()
                    
                    # Normalize: remove spaces and commas for parsing
                    # "01 Feb, 2026" → "01Feb2026"
                    normalized = date_str.replace(" ", "").replace(",", "")
                    
                    # Try parsing with format: "01Feb2026"
                    date_obj = dt.strptime(normalized, "%d%b%Y").date()
                except (ValueError, AttributeError) as e:
                    print(f"Warning: Could not parse date '{raw_date}', using today's date. Error: {e}")
                    # If parsing fails, use today's date as fallback
                    date_obj = date.today()

            row = Transaction(
                user_id=user_id.strip(),
                date=date_obj,
                description=str(tx.get("description", "")).strip(),
                amount=float(tx.get("amount", 0)),
                type=str(tx.get("type", "")).strip().lower(),
                category=predict_category(
                    str(tx.get("description", "")).strip(),
                    float(tx.get("amount", 0)),
                    str(tx.get("type", "")).strip().lower(),
                ),
            )
            db.add(row)
            saved_rows.append(row)

        db.add(
            UploadedStatement(
                user_id=user_id.strip(),
                file_name=file.filename,
                file_hash=file_hash,
            )
        )

        db.commit()

        # Step 4: Refresh rows to get IDs and return formatted response
        for row in saved_rows:
            db.refresh(row)

        response_transactions = []
        for row in saved_rows:
            response_transactions.append(
                {
                    "id": row.id,
                    "user_id": row.user_id,
                    "date": row.date.isoformat(),
                    "description": row.description,
                    "amount": row.amount,
                    "type": row.type,
                    "category": row.category,
                }
            )

        return {
            "total_transactions": len(response_transactions),
            "transactions": response_transactions,
        }

    except PDFParsingError as exc:
        raise HTTPException(status_code=400, detail=f"PDF parsing error: {exc}") from exc
    except AIParsingError as exc:
        raise HTTPException(status_code=502, detail=f"AI parsing error: {exc}") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected server error: {exc}") from exc
    finally:
        await file.close()
