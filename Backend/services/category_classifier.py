from services.custom_category_model import predict_transaction_category


def _keyword_fallback(description: str, tx_type: str) -> str:
    """Fallback categorization when ML model is not available."""
    text = description.lower()

    if any(word in text for word in ["zomato", "swiggy", "restaurant", "cafe", "food"]):
        return "food"
    if any(word in text for word in ["uber", "ola", "metro", "dmrc", "travel", "bus", "train"]):
        return "travel"
    if any(word in text for word in ["amazon", "flipkart", "myntra", "shopping", "zara"]):
        return "shopping"
    if any(word in text for word in ["electricity", "bill", "recharge", "gas", "water", "broadband"]):
        return "bills"

    if tx_type.lower() == "credit":
        return "income"

    return "other"


def predict_category(description: str, amount: float, tx_type: str) -> str:
    """Predict category using custom model hook, then fallback to keyword rules."""
    custom_prediction = predict_transaction_category(description, amount, tx_type)
    if custom_prediction:
        return str(custom_prediction).strip().lower()

    return _keyword_fallback(description, tx_type)
