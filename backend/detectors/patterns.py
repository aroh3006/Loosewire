"""Regex patterns shared by more than one rule. Kept separate from both the
parsers (which know nothing about payment semantics) and the rule modules
(which know nothing about Python vs JS syntax) so the vocabulary of what
counts as "looks like a signature check" lives in exactly one place.
"""

import re

# A function/route whose name or path suggests it finalizes an order:
# marks it paid, confirms payment, captures a charge, etc. Matches either a
# compound phrase (mark_order_paid) or a payment noun plus a completion verb
# appearing separately, since route paths often split them across segments
# (e.g. /orders/:id/confirm-payment).
_COMPLETION_COMPOUND_RE = re.compile(
    r"(mark[_\s]?.*paid|complete[_\s]?order|confirm[_\s]?payment|payment[_\s]?success"
    r"|capture[_\s]?payment|finalize[_\s]?order|order[_\s]?(status|complete)|checkout[_\s]?success"
    r"|payment[_\s]?callback|handle[_\s]?payment|process[_\s]?payment|verify[_\s]?order)",
    re.IGNORECASE,
)
_PAYMENT_NOUN_RE = re.compile(r"(order|payment|checkout|charge)", re.IGNORECASE)
_COMPLETION_VERB_RE = re.compile(
    r"(complete|paid|confirm|capture|finaliz|settle|success|process)", re.IGNORECASE
)


class _OrderCompletionMatcher:
    def search(self, text: str) -> bool:
        if _COMPLETION_COMPOUND_RE.search(text):
            return True
        return bool(_PAYMENT_NOUN_RE.search(text) and _COMPLETION_VERB_RE.search(text))


ORDER_COMPLETION_RE = _OrderCompletionMatcher()

# A route or handler that looks like a webhook / async callback endpoint.
WEBHOOK_RE = re.compile(r"(webhook|callback|ipn|notify|events?[_-]?listener)", re.IGNORECASE)

# Anything resembling a signature/HMAC verification call.
VERIFICATION_CALL_RE = re.compile(
    r"(verify[_\s]?signature|verify[_\s]?webhook|hmac|compare_digest|timingsafeequal"
    r"|checksum|signature\s*(is\s*)?valid|verify_hmac|createhmac|constant_time_compare"
    r"|crypto\.verify|verify_payment_signature)",
    re.IGNORECASE,
)

# Reference to a signature-bearing header, used together with
# VERIFICATION_CALL_RE to judge webhook handlers specifically.
SIGNATURE_HEADER_RE = re.compile(
    r"(x-[a-z]*-?signature|['\"]signature['\"]|headers\[.{0,20}signature|get_header.*signature)",
    re.IGNORECASE,
)

# A stored-order lookup: fetching the order record that was created earlier,
# as opposed to trusting whatever the client just sent.
ORDER_LOOKUP_RE = re.compile(
    r"(get_order|find_order|order\.query|order\.objects|orders\[|db\..*order"
    r"|select .* from orders|order_id\s*=\s*.*\bid\b|fetchorder|findbyid)",
    re.IGNORECASE,
)

# A comparison expression that involves an "amount" value.
AMOUNT_COMPARISON_RE = re.compile(
    r"amount[a-z_]*\s*(==|!=|<=|>=|<|>)|(==|!=)\s*[a-z_.\[\]'\"]*amount"
    r"|isclose\([^)]*amount|abs\([^)]*amount",
    re.IGNORECASE,
)
AMOUNT_REFERENCE_RE = re.compile(r"\bamount\b", re.IGNORECASE)

SECRET_NAME_RE = re.compile(
    r"(secret[_-]?key|private[_-]?key|api[_-]?secret|client[_-]?secret|access[_-]?token"
    r"|auth[_-]?token|signing[_-]?key|secret(?![a-z]))",
    re.IGNORECASE,
)
PLACEHOLDER_VALUE_RE = re.compile(
    r"^(your[_-]?|xxx|changeme|placeholder|example|test[_-]?key|dummy|<.*>|\{\{.*\}\}|\$\{)",
    re.IGNORECASE,
)
ENV_LOOKUP_RE = re.compile(
    r"(process\.env|os\.environ|os\.getenv|import\.meta\.env|getenv\()", re.IGNORECASE
)
FRONTEND_PATH_HINT_RE = re.compile(
    r"(^|/)(static|public|frontend|client|www|assets|dist|build|src[/\\]components"
    r"|src[/\\]pages|templates)($|[/\\])",
    re.IGNORECASE,
)


def is_frontend_path(path: str) -> bool:
    return bool(FRONTEND_PATH_HINT_RE.search(path)) or path.endswith((".html", ".htm"))


def looks_like_placeholder(value: str) -> bool:
    return bool(PLACEHOLDER_VALUE_RE.match(value.strip()))


def looks_random(value: str) -> bool:
    """Rough entropy heuristic: long, mixed-case-or-digit, not a real word
    or sentence. Good enough to separate a random token from 'my secret'."""
    v = value.strip()
    if len(v) < 12:
        return False
    if " " in v:
        return False
    has_digit = any(c.isdigit() for c in v)
    has_alpha = any(c.isalpha() for c in v)
    has_mixed_case = any(c.islower() for c in v) and any(c.isupper() for c in v)
    return has_digit and has_alpha and (has_mixed_case or has_digit)
