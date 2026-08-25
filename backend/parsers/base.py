"""Framework-agnostic representation that every parser produces.

Detection rules only ever look at CodeBlock and SourceFile objects. A parser's
job is to turn one language/framework's syntax into these two shapes. Adding
support for a new framework means writing a new parser module that returns
the same shapes, not touching any rule.
"""

from dataclasses import dataclass, field


@dataclass
class SourceFile:
    path: str          # path relative to the scan root
    lines: list[str]    # 0-indexed list of raw source lines, no trailing newline
    framework: str       # "python" | "node" | "unknown"

    @property
    def text(self) -> str:
        return "\n".join(self.lines)


@dataclass
class CodeBlock:
    """A function or route handler body, with enough context for a rule to
    decide whether it looks like an order-completion path, a webhook
    handler, and so on."""

    file: str
    framework: str
    kind: str              # "route" | "function"
    name: str               # function name, or "" for anonymous handlers
    http_method: str | None  # "GET" | "POST" | ... | None for plain functions
    route_path: str | None   # the URL path string for routes, else None
    start_line: int          # 1-indexed line of the def/handler start
    end_line: int             # 1-indexed line of the last line in the body
    lines: list[tuple[int, str]] = field(default_factory=list)  # (lineno, text)

    @property
    def body_text(self) -> str:
        return "\n".join(text for _, text in self.lines)

    @property
    def header_text(self) -> str:
        """name + route path, used for matching against role patterns like
        'order completion' or 'webhook handler'."""
        parts = [self.name or "", self.route_path or ""]
        return " ".join(p for p in parts if p)
