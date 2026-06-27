import re
from .common import HEADER, CUR

F6_PATTERNS = {**HEADER,
    "counter_offer_price": r"Total landed Price is\s*" + CUR + r"([\d,]+(?:\.\d+)?)",
    "counter_offer_date": r"on\s*(\d{2}\.\d{2}\.\d{4}),?\s*he sent",
    "savings_amount": r"savings of\s*" + CUR + r"([\d,]+(?:\.\d+)?)",
    "recommended_vendor": {"pattern": r"from\s*(M/s\.?\s*[\w\s./&]+?(?:Limited|Ltd\.?))", "group": 1, "flags": re.IGNORECASE},
    "recommended_qty": r"(\d+)\s*nos",
    "final_price": r"Total landed Price is\s*" + CUR + r"([\d,]+(?:\.\d+)?)",
    "pm_clause": r"PM Clause\s*([\d.]+)",
}
