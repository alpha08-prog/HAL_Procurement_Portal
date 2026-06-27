"""
Regex pattern map for F1 — Provisioning Note (PDF).

Usage
-----
from tools.patterns.f1_patterns import F1_PATTERNS
from tools.pdf_extractor import extract_from_pdf

data = extract_from_pdf("path/to/F1.pdf", F1_PATTERNS)

Each key maps to a field in the output JSON (case object).
Pattern spec format: see pdf_extractor.py docstring.

Field groups
------------
  meta          — file header fields (IDs, dates, status)
  requisition   — CAR/MPR details and DOP clause
  item          — what is being procured
  financials    — monetary amounts found in the note
  attachments   — enclosure references (A1, A2, E-1 …)
"""

import re

F1_PATTERNS: dict = {

    # ── Meta ────────────────────────────────────────────────────────────────
    "file_id": r"File ID:\s*#?(\d+)",

    "reference_no": r"Reference No:\s*([\w/]+)",

    "date_of_opening": r"Date of Opening:\s*(\d{2}/\d{2}/\d{4})",

    # Subject may wrap to the next line before "File Status"
    "subject": {
        "pattern": r"Subject:\s*(.+?)(?:File Status|$)",
        "group": 1,
        "flags": re.IGNORECASE | re.DOTALL,
    },

    "file_status": r"File Status:\s*(\w+)",

    "print_id": r"Print ID:\s*(\d+)",

    "print_date": r"Print Date:\s*([^\n]+)",

    # ── Requisition ─────────────────────────────────────────────────────────
    # Matches: "CAR No. CAR/25/229 dated 17 July 2025"
    "car_no": r"CAR No\.?\s*((?:CAR|MPR|SPR|CPR)/[\w/]+)",

    "car_date": r"CAR No\.?\s*(?:CAR|MPR|SPR|CPR)/[\w/]+\s+dated\s+(\d+\s+\w+\s+\d{4})",

    # Matches: "Annexure III B, Sl No 1a"
    "dop_clause": r"DoP Clause\s+([^\n\.]+)",

    # ── Item ────────────────────────────────────────────────────────────────
    # Extract the item name from the subject (everything before the comma / BE)
    "item_description": r"PROCUREMENT OF\s+(.+?)(?:,\s*BE|\s+BE\s|\n)",

    # Budget year e.g. "BE 2025-26"
    "budget_year": r"\bBE\s+(\d{4}-\d{2,4})\b",

    "budget_type": r"\b(Capital Budget|Revenue Budget|CAPEX|OPEX)\b",

    # CAPEX dashboard entry reference
    "capex_sl_no": r"CAPEX dashboard.*?sl\.\s*no\.\s*(\d+)",

    # ── Financials ──────────────────────────────────────────────────────────
    # All rupee amounts in the document (Indian comma format e.g. 15,94,065 or 1,594,065)
    "amount_figures": {
        "pattern": r"Rs\.?\s*([\d,]+)/-",
        "group": 1,
        "multi": True,
    },

    # Amount in words (e.g. "Rupees Fifteen Lakh …")
    "amount_in_words": {
        "pattern": r"\(Rupees\s+([^)]+)\)",
        "group": 1,
        "multi": True,
    },

    # ── Attachments / Enclosures ────────────────────────────────────────────
    # Captures references like A1, A2, E-1, E-2, (A1), (E1) etc.
    "enclosures": {
        "pattern": r"\b(?:attached?\s+at\s+|attached?\s+as\s+)?\(?((?:A|E)-?\d+)\)?",
        "group": 1,
        "multi": True,
    },

    # Tender / GEM references inside the note
    "gem_reference": r"GeM\s+[\w/-]+",

    # ── Approval ────────────────────────────────────────────────────────────
    "final_approval": r"(Approved|Rejected|Pending)\s*/",

    "transaction_ids": {
        "pattern": r"Transaction ID:\s*([0-9A-Fa-f]{4}-[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9A-Fa-f]+)",
        "group": 1,
        "multi": True,
    },
}
