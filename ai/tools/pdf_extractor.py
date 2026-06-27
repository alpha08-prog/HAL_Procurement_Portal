"""
PDF extraction engine for HAL procurement notes.

Responsibilities (this file only):
  - Open a PDF with PyMuPDF and yield raw text (full doc or per-page).
  - Apply a caller-supplied pattern map to that text and return a JSON-ready dict.
  - Extract structured tables (routing table, vendor lists) via PyMuPDF table API.
  - Persist the result dict to a JSON file.

What this file does NOT do:
  - Define any stage-specific patterns  → see tools/patterns/
  - Parse .docx files                   → see tools/docx_extractor.py (future)
  - Compute any financial value         → deterministic rule engine (future)
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _read_pages(pdf_path: str) -> list[str]:
    """Return a list of raw text strings, one per page."""
    doc = fitz.open(pdf_path)
    pages = [page.get_text() for page in doc]
    doc.close()
    return pages


def _full_text(pages: list[str]) -> str:
    """Concatenate all page texts with a newline separator."""
    return "\n".join(pages)


def _apply_single_pattern(text: str, spec: dict | str) -> Any:
    """
    Apply one pattern spec to text.

    spec variants
    -------------
    str  → treated as { "pattern": spec, "group": 1, "multi": False }
    dict keys:
        pattern (str)   — required
        group   (int)   — capture group index, default 1
        multi   (bool)  — if True return list of all matches, default False
        flags   (int)   — re flags, default re.IGNORECASE | re.DOTALL
    """
    if isinstance(spec, str):
        spec = {"pattern": spec}

    pattern = spec["pattern"]
    group = spec.get("group", 1)
    multi = spec.get("multi", False)
    flags = spec.get("flags", re.IGNORECASE | re.DOTALL)

    if multi:
        raw = re.findall(pattern, text, flags)
        # findall returns strings when there is exactly one group, else tuples
        if raw and isinstance(raw[0], tuple):
            return [m[group - 1].strip() for m in raw]
        return [m.strip() for m in raw]

    match = re.search(pattern, text, flags)
    if not match:
        return None
    try:
        return match.group(group).strip()
    except IndexError:
        return match.group(0).strip()


# ---------------------------------------------------------------------------
# Table extraction
# ---------------------------------------------------------------------------

def extract_tables(pdf_path: str) -> list[list[list[str]]]:
    """
    Extract all tables from all pages using PyMuPDF's built-in table finder.

    Returns a list (one entry per page) of lists (one entry per table on that
    page) of rows, where each row is a list of cell strings.

    Pages with no detected tables contribute an empty list.
    """
    doc = fitz.open(pdf_path)
    result: list[list[list[list[str]]]] = []

    for page in doc:
        page_tables: list[list[list[str]]] = []
        tabs = page.find_tables()
        for tab in tabs:
            rows = []
            for row in tab.extract():
                rows.append([str(cell).strip() if cell is not None else "" for cell in row])
            page_tables.append(rows)
        result.append(page_tables)

    doc.close()
    return result


def extract_routing_table(pdf_path: str) -> list[dict]:
    """
    Extract the HAL routing/noting table from Page 1.

    Expected columns: Sr.No | Note | Name | Desig | Dept | Division | Date
    Falls back to regex line-parsing if PyMuPDF table detection misses it.

    Returns a list of dicts, one per routing row.
    """
    page_tables = extract_tables(pdf_path)

    # Try PyMuPDF table detection on page 0 first
    if page_tables and page_tables[0]:
        for table in page_tables[0]:
            # Identify the routing table by its header row
            header = [c.lower() for c in table[0]] if table else []
            if any("note" in h for h in header) and any("desig" in h or "name" in h for h in header):
                keys = ["sr_no", "note", "name", "designation", "dept", "division", "date"]
                rows = []
                for row in table[1:]:
                    # skip completely empty rows
                    if not any(row):
                        continue
                    padded = row + [""] * (len(keys) - len(row))
                    rows.append(dict(zip(keys, padded[:len(keys)])))
                return rows

    # Fallback: regex-based parsing on full text
    doc = fitz.open(pdf_path)
    text = doc[0].get_text()
    doc.close()

    # Pattern: line starting with a digit, then N+digit note ID, then date at end
    row_pattern = re.compile(
        r"(\d+)\s+(N\d+)\s+(.+?)\s{2,}(.+?)\s{2,}(.+?)\s{2,}(.+?)\s{2,}(\d{2}/\d{2}/\d{4})",
        re.IGNORECASE,
    )
    rows = []
    for m in row_pattern.finditer(text):
        rows.append({
            "sr_no":       m.group(1).strip(),
            "note":        m.group(2).strip(),
            "name":        m.group(3).strip(),
            "designation": m.group(4).strip(),
            "dept":        m.group(5).strip(),
            "division":    m.group(6).strip(),
            "date":        m.group(7).strip(),
        })
    return rows


# ---------------------------------------------------------------------------
# Notes (N1, N2 … N14) extraction
# ---------------------------------------------------------------------------

def extract_notes(pdf_path: str) -> list[dict]:
    """
    Extract the sequential approval notes (Note 1, Note 2 …) from the PDF.

    Each note dict contains:
        note_number  (int)
        content      (str)  — body text before the signatory line
        signatory    (str)
        designation  (str)
        division     (str)
        date         (str)
        transaction_id (str | None)
    """
    pages = _read_pages(pdf_path)
    text = _full_text(pages)

    # Split on "Note <n>" markers
    segments = re.split(r"\bNote\s+(\d+)\b", text, flags=re.IGNORECASE)
    # segments = [pre_text, "1", body1, "2", body2, ...]

    notes: list[dict] = []
    i = 1
    while i < len(segments) - 1:
        note_num = int(segments[i])
        body = segments[i + 1]

        # Transaction ID
        tid_match = re.search(
            r"Transaction ID:\s*([0-9A-Fa-f]{4}-[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9A-Fa-f]+)",
            body,
        )

        # Signatory block: NAME\nDESIGNATION,DIVISION\nDate:...
        sig_match = re.search(
            r"([A-Z][A-Z\s\.]+)\n([^,\n]+),([^\n]+)\nDate:([^\n]+)",
            body.strip(),
        )

        # Content = everything before the signatory
        content = body
        if sig_match:
            content = body[: sig_match.start()].strip()

        notes.append({
            "note_number":    note_num,
            "content":        content.strip(),
            "signatory":      sig_match.group(1).strip() if sig_match else None,
            "designation":    sig_match.group(2).strip() if sig_match else None,
            "division":       sig_match.group(3).strip() if sig_match else None,
            "date":           sig_match.group(4).strip() if sig_match else None,
            "transaction_id": tid_match.group(1) if tid_match else None,
        })
        i += 2

    return notes


# ---------------------------------------------------------------------------
# Core public API
# ---------------------------------------------------------------------------

def extract_from_pdf(pdf_path: str, patterns: dict) -> dict:
    """
    Extract structured data from a PDF using caller-supplied regex patterns.

    Parameters
    ----------
    pdf_path : str
        Absolute or relative path to the PDF.
    patterns : dict
        Maps output field names to pattern specs.
        Each spec is either:
          - a raw regex string  → captures group 1, single match
          - a dict with keys:
              pattern (str)   required
              group   (int)   default 1
              multi   (bool)  default False  — return list of all matches
              flags   (int)   default re.IGNORECASE | re.DOTALL

    Returns
    -------
    dict
        {
          "_source": filename,
          "_raw_char_count": int,
          "<field>": <matched value or None or []>,
          ...
          "routing_table": [...],   always included
          "notes": [...],           always included
        }
    """
    pages = _read_pages(pdf_path)
    text = _full_text(pages)

    result: dict[str, Any] = {
        "_source": Path(pdf_path).name,
        "_raw_char_count": len(text),
        "_page_count": len(pages),
    }

    for field, spec in patterns.items():
        result[field] = _apply_single_pattern(text, spec)

    result["routing_table"] = extract_routing_table(pdf_path)
    result["notes"] = extract_notes(pdf_path)

    return result


def extract_from_pdf_to_json(pdf_path: str, patterns: dict, output_path: str) -> dict:
    """
    Run extract_from_pdf and persist the result to *output_path* as JSON.

    Returns the same dict that was written so callers can use it immediately.
    """
    data = extract_from_pdf(pdf_path, patterns)
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return data
