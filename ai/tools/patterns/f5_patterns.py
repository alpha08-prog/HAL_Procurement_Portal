import re
from .common import HEADER, ACCEPTED, REJECTED, CUR

F5_PATTERNS = {**HEADER,
    "pb_accepted": ACCEPTED,
    "pb_rejected": REJECTED,
    "l1_vendor": {"pattern": r"(M/s\.?\s*[\w\s./&]+?)\.?,?\s*(?:Kanpur)?,?\s*is the lowest bidder", "group": 1, "flags": re.IGNORECASE},
    "l1_price": r"total landed value is\s*" + CUR + r"([\d,]+(?:\.\d+)?)",
    "price_variance_pct": r"\(?\+?\)?\s*([\d.]+)\s*%\s*higher",
    "lpp_contract": r"(GEM-\d+)",
    "lpp_price": r"approved estimat\w*\s*of\s*" + CUR + r"([\d,]+(?:\.\d+)?)",
    "ra_status": r"(none of (?:the )?two bidders participated in RA|none of the bidder participated in RA)",
    "budget_estimate": r"Budget estimate is\s*" + CUR + r"([\d,]+(?:\.\d+)?)",
}
