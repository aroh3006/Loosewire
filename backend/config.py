"""Shared constants: severity levels and the cost model used by the evaluation report."""

SEVERITY_CRITICAL = "critical"
SEVERITY_HIGH = "high"
SEVERITY_MEDIUM = "medium"
SEVERITY_LOW = "low"

CONFIDENCE_HIGH = "high"
CONFIDENCE_MEDIUM = "medium"
CONFIDENCE_LOW = "low"

# Placeholder cost figures used to turn precision/recall into a rough dollar
# estimate on the metrics page. These are not measured, they are stated
# assumptions so the estimate can be judged and adjusted.
#
# FALSE_POSITIVE_COST_USD: time for a developer to open a flagged line,
# decide it is not actually a bug, and close it out. Assumed 15 minutes
# at a loaded rate of $100/hour.
FALSE_POSITIVE_COST_USD = 25.0

# FALSE_NEGATIVE_COST_USD: expected fraud loss from a payment bug that
# ships unnoticed and gets exploited before anyone catches it. This is a
# deliberately conservative placeholder, real exposure varies enormously
# by transaction volume and is impossible to state as one number.
FALSE_NEGATIVE_COST_USD = 500.0

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
