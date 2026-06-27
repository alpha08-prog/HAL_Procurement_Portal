import re
from .common import HEADER

F4_PATTERNS = {**HEADER,
    "tec_accepted_final": {"pattern": r"accepted only \w+ offers?\s*namely from\s*(.+?)\s*and has rejected", "group": 1, "flags": re.IGNORECASE | re.DOTALL},
    "tec_rejected_final": {"pattern": r"([A-Z][A-Za-z]+(?:\s+[A-Za-z&]+){0,4})\s*-\s*Not complied", "group": 1, "multi": True, "flags": re.MULTILINE},
    "spec_non_compliance": {"pattern": r"Not complied specification[^\n]*?sl no-?\s*([\d, ]+\d)", "group": 1, "multi": True, "flags": re.IGNORECASE},
    "pm_clause": r"Purchase manual clause\s*([\d.]+)",
}
