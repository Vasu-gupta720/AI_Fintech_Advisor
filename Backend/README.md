# AI Personal Finance Advisor - Backend

This backend is built with FastAPI + PostgreSQL + OpenAI.

It accepts a PDF bank statement, extracts text with pdfplumber, uses OpenAI to convert that text into structured transactions, saves them into PostgreSQL, and returns the saved result.

## Project Structure

- `main.py` -> FastAPI app and `/upload-pdf` endpoint
- `database.py` -> SQLAlchemy engine/session setup
- `models.py` -> Transaction table model
- `services/pdf_parser.py` -> PDF text extraction logic
- `services/ai_parser.py` -> OpenAI transaction parsing logic
- `requirements.txt` -> Python dependencies

## 1. Create and Activate Virtual Environment

### Windows PowerShell

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### macOS/Linux

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
```

## 2. Install Dependencies

```bash
pip install -r requirements.txt
```

## 3. Configure Environment Variables

Create a `.env` file inside `Backend`:

```env
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql+psycopg2://username:password@localhost:5432/finance_db
# Optional:
# OPENAI_MODEL=gpt-4o-mini
```

## 4. Ensure PostgreSQL Database Exists

Create database `finance_db` (or any name you used in DATABASE_URL).

## 5. Run the API

```bash
uvicorn main:app --reload
```

API starts at:
- `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

## 6. Test the Upload Endpoint

Use Swagger UI or cURL:

```bash
curl -X POST "http://127.0.0.1:8000/upload-pdf" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_statement.pdf"
```

Expected response format:

```json
{
  "total_transactions": 3,
  "transactions": [
    {
      "id": 1,
      "date": "2026-03-01",
      "description": "Amazon",
      "amount": 1200.0,
      "type": "debit"
    }
  ]
}
```

## Notes

- Invalid/non-PDF files return HTTP 400.
- AI output errors return HTTP 502.
- Database errors return HTTP 500.
- Table creation is automatic on app startup.
