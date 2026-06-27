from .common import HEADER

F7_PATTERNS = {**HEADER,
    "proposal_id": r"[Pp]roposal\s+([A-Z]{2,}\w*\d+)",
    "initiator": r"Initiator:\s*([^,]+?),",
    "initiator_desig": r"Initiator:[^,]+,\s*([^.]+?)\.",
    "fca_name": r"FCA:\s*([^,]+?),",
    "fca_designation": r"FCA:[^,]+,\s*([^.]+?)\.",
    "cfa_name": r"(?<!F)CFA:\s*([^,]+?),",
    "cfa_designation": r"(?<!F)CFA:[^,]+,\s*([^.]+?)\.",
    "dop_level": r"DOP:\s*(\(ANNEXURE[^.]+?)\.\s",
    "final_value": r"Proposed Value:\s*([\d,]+)",
}
