from .common import HEADER, ACCEPTED, REJECTED, UDYAM, NIC

F3_PATTERNS = {**HEADER,
    "tec_accepted_bidders": ACCEPTED,
    "emd_rejected": REJECTED,
    "udyam_nos": UDYAM,
    "nic_categories": NIC,
}
