from sqlalchemy import Column, Date, DateTime, Float, Integer, String, func

from database import Base


class Transaction(Base):
    """Database model for one bank transaction."""

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True, default="default")
    date = Column(Date, nullable=False, index=True)
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String(10), nullable=False)  # debit or credit
    category = Column(String(50), nullable=False, default="other")


class UploadedStatement(Base):
    """Tracks uploaded statement files to prevent duplicate uploads per user."""

    __tablename__ = "uploaded_statements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
