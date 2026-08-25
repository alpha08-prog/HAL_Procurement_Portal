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
# Routing chain (routing table + note bodies, merged and cleaned)
# ---------------------------------------------------------------------------

def scrub_watermark(cell: str) -> str:
    """Strip the print-ID digits that bleed into routing-table cells.

    Every page of a HAL eFile print carries its Print ID as a watermark
    ("9110638885943600561202517217122"), and PyMuPDF's table reader interleaves those
    digits with the real text:

        "9 5 8 8 HIRALAL KESHI"            -> "HIRALAL KESHI"
        "2 2 1 18/07/2025"                 -> "18/07/2025"
        "7 1 2 7 AIRCRAFT OVERHAUL 1 DIV"  -> "AIRCRAFT OVERHAUL DIV"
        "8 3 6 N10"                        -> "N10"

    Only lone single digits are dropped, and only from cells that hold more than one
    token -- so a legitimate single-digit cell (Sr.No "1".."9") is left alone, and
    dates, note ids and multi-digit serials survive intact.
    """
    tokens = str(cell or "").split()
    if len(tokens) <= 1:
        return " ".join(tokens)
    kept = [t for t in tokens if not (len(t) == 1 and t.isdigit())]
    return " ".join(kept) if kept else " ".join(tokens)


def _two_factor_ids(text: str) -> set[str]:
    """Transaction ids whose hop was marked "(Two-Factor Authenticated)".

    The marker sits between the signatory's date and that hop's Transaction ID. The
    look-back is bounded by the *previous* Transaction ID, otherwise a 2FA hop leaks
    its marker onto the hop that follows it.
    """
    out = set()
    marks = list(re.finditer(r"Transaction ID:\s*([0-9A-Fa-f-]+)", text))
    for i, m in enumerate(marks):
        start = marks[i - 1].end() if i else 0
        if re.search(r"two[\s-]*factor", text[start:m.start()], re.IGNORECASE):
            out.add(m.group(1))
    return out


def _clean_remark(s: str, print_id: str | None) -> str:
    """A hop's remark with the page furniture taken out.

    Note bodies that straddle a page break pick up the Print ID watermark and a
    "Page n of m" line; neither is part of what the officer wrote.
    """
    t = " ".join(str(s or "").split())
    if print_id:
        t = t.replace(print_id, " ")
    t = re.sub(r"\b\d{25,}\b", " ", t)                 # the watermark, wherever it lands
    t = re.sub(r"Page\s+\d+\s+of\s+\d+", " ", t, flags=re.IGNORECASE)
    return " ".join(t.split())


def extract_routing_chain(pdf_path: str) -> list[dict]:
    """The approval chain a HAL eFile note prints on itself, as one clean list.

    Merges the two views the document gives of the same hops. Who each hop was is taken
    from the page-1 routing table -- it is the only place the *department* appears, its
    columns come out clean once the watermark is scrubbed, and its dates are already
    DD/MM/YYYY. What each hop said comes from the note bodies -- the only place the
    remark, the per-hop transaction id and the 2FA marker appear.

    Taking names from the table also sidesteps extract_notes()' signatory regex, which
    on N10 starts its match at the trailing "CFA" of the previous sentence.

    One dict per hop:
        note, seq, name, designation, dept, division, date, comment, txn_id, two_factor

    On the F1 Provisioning Note this yields all 14 hops, N1..N14.
    """
    table = [{k: scrub_watermark(v) for k, v in row.items()}
             for row in extract_routing_table(pdf_path)]
    by_note = {}
    for row in table:
        key = row.get("note", "").strip().upper()
        if re.fullmatch(r"N\d+", key):
            by_note[key] = row

    text = _full_text(_read_pages(pdf_path))
    tfa = _two_factor_ids(text)
    pid = re.search(r"Print ID:\s*(\d+)", text)
    print_id = pid.group(1) if pid else None

    def _one_line(s):
        return " ".join(str(s or "").split())

    chain = []
    for note in extract_notes(pdf_path):
        key = f"N{note['note_number']}"
        row = by_note.get(key, {})
        chain.append({
            "note": key,
            "seq": int(note["note_number"]),
            "name": _one_line(row.get("name") or note.get("signatory")),
            "designation": _one_line(row.get("designation") or note.get("designation")),
            "dept": _one_line(row.get("dept")),
            "division": _one_line(row.get("division") or note.get("division")),
            "date": _one_line(row.get("date") or note.get("date")),
            "comment": _clean_remark(note.get("content"), print_id),
            "txn_id": note.get("transaction_id"),
            "two_factor": note.get("transaction_id") in tfa,
        })
    return chain


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
