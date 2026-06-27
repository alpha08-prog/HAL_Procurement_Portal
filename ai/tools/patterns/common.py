import re

CUR = r"(?:INR|Rs\.?|₹)\s*"
ROW = re.IGNORECASE | re.MULTILINE

ACCEPTED = {"pattern": r"^\s*\d+[.)\s]*\|\s*([^|]+?)(?:\s+E\d+)?\s*\|[^\n]*?(?<!Not )Accepted\s*$", "group": 1, "multi": True, "flags": ROW}
REJECTED = {"pattern": r"^\s*\d+[.)\s]*\|\s*([^|]+?)(?:\s+E\d+)?\s*\|[^\n]*?Not\s+Accepted", "group": 1, "multi": True, "flags": ROW}
UDYAM = {"pattern": r"(UDYAM-[A-Z]{2}-\d{2}-\d{7})", "group": 1, "multi": True}
NIC = {"pattern": r"category\s+(\d{4,6})", "group": 1, "multi": True}

HEADER = {
    "item_description": r"Item:\s*([^\n]+)",
    "car_no": r"CAR\s*NO\s*:\s*((?:CAR|MPR|SPR|CPR)/[\w/]+)",
    "car_date": r"CAR\s*NO\s*:[^\n]*?Dt\.?\s*([\d.]+)",
    "mpr_estimate": r"MPR Estimate:\s*" + CUR + r"([\d,]+(?:\.\d+)?)",
    "tender_no": r"(GEM/\d{4}/[A-Z]/\d+)",
    "tender_date": r"GEM/\d{4}/[A-Z]/\d+[^\d]+(\d{2}-\d{2}-\d{4})",
    "tender_enquiry": r"tender enquiry\s*E-?(\d+)",
    "total_bids": r"total of\s*(\d+)\s*bids",
}
