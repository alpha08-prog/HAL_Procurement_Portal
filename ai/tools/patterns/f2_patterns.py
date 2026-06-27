from .common import HEADER, ACCEPTED, REJECTED, UDYAM, NIC

F2_PATTERNS = {**HEADER,
    "emd_accepted": ACCEPTED,
    "emd_rejected": REJECTED,
    "udyam_nos": UDYAM,
    "nic_categories": NIC,
}
