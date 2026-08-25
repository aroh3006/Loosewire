"""Parser for Express style JavaScript / TypeScript code.

Finds route registrations (app.post(...), router.get(...), etc.) with an
inline handler, plus plain function declarations, and extracts their body
by brace matching. This is a heuristic scanner, not a real JS parser: it is
good enough to locate a handler body and its line range, which is all the
rules need.
"""

import re

from backend.parsers.base import CodeBlock, SourceFile

ROUTE_CALL_RE = re.compile(
    r"(?P<obj>[A-Za-z_$][A-Za-z0-9_$]*)\.(?P<verb>get|post|put|patch|delete)\s*\(\s*"
    r"['\"](?P<path>[^'\"]+)['\"]"
)
FUNCTION_DECL_RE = re.compile(
    r"^\s*(?:export\s+)?(?:async\s+)?function\s+(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*\("
)
CONST_ARROW_RE = re.compile(
    r"^\s*(?:export\s+)?const\s+(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>"
)
EXPORTS_FUNC_RE = re.compile(
    r"^\s*(?:module\.)?exports\.(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?function"
)


def _find_matching_brace(text: str, open_pos: int) -> int:
    """Given the index of an opening '{' in text, return the index of its
    matching '}', tracking string literals so braces inside strings do not
    throw off the count."""
    depth = 0
    i = open_pos
    n = len(text)
    in_string: str | None = None
    while i < n:
        c = text[i]
        if in_string:
            if c == "\\":
                i += 2
                continue
            if c == in_string:
                in_string = None
        elif c in "'\"`":
            in_string = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return n - 1


def _line_offsets(lines: list[str]) -> list[int]:
    """Cumulative character offset of the start of each line in the
    newline-joined text, for mapping a char index back to a line number."""
    offsets = []
    total = 0
    for line in lines:
        offsets.append(total)
        total += len(line) + 1
    return offsets


def _pos_to_line(offsets: list[int], pos: int) -> int:
    lo, hi = 0, len(offsets) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if offsets[mid] <= pos:
            lo = mid
        else:
            hi = mid - 1
    return lo + 1  # 1-indexed


def _block_from_brace(
    source: SourceFile,
    text: str,
    offsets: list[int],
    open_pos: int,
    kind: str,
    name: str,
    http_method: str | None,
    route_path: str | None,
) -> CodeBlock | None:
    if open_pos < 0 or open_pos >= len(text) or text[open_pos] != "{":
        return None
    close_pos = _find_matching_brace(text, open_pos)
    start_line = _pos_to_line(offsets, open_pos)
    end_line = _pos_to_line(offsets, close_pos)
    body_lines = [(ln, source.lines[ln - 1]) for ln in range(start_line, end_line + 1)]
    return CodeBlock(
        file=source.path,
        framework="node",
        kind=kind,
        name=name,
        http_method=http_method,
        route_path=route_path,
        start_line=start_line,
        end_line=end_line,
        lines=body_lines,
    )


def parse(source: SourceFile) -> list[CodeBlock]:
    text = source.text
    offsets = _line_offsets(source.lines)
    blocks: list[CodeBlock] = []

    for m in ROUTE_CALL_RE.finditer(text):
        brace_pos = text.find("{", m.end())
        arrow_pos = text.find("=>", m.end())
        if brace_pos == -1:
            continue
        if arrow_pos != -1 and arrow_pos < brace_pos:
            # (req, res) => { ... }, brace_pos already points past the arrow, fine
            pass
        # bail if the next non-whitespace after the match is a bare identifier
        # (handler passed by reference, e.g. app.post('/x', handlerName)) with
        # no function/arrow before the next statement terminator
        between = text[m.end():brace_pos]
        if "function" not in between and "=>" not in between and between.count("(") == 0:
            # heuristically still allow short param lists like ", (req,res) =>"
            if "=>" not in text[m.end():brace_pos + 2]:
                continue
        block = _block_from_brace(
            source, text, offsets, brace_pos, "route", "",
            m.group("verb").upper(), m.group("path"),
        )
        if block:
            blocks.append(block)

    for i, line in enumerate(source.lines):
        name = None
        fm = FUNCTION_DECL_RE.match(line)
        cm = CONST_ARROW_RE.match(line)
        em = EXPORTS_FUNC_RE.match(line)
        if fm:
            name = fm.group("name")
        elif cm:
            name = cm.group("name")
        elif em:
            name = em.group("name")
        if not name:
            continue
        line_start_offset = offsets[i]
        brace_pos = text.find("{", line_start_offset)
        if brace_pos == -1:
            continue
        block = _block_from_brace(source, text, offsets, brace_pos, "function", name, None, None)
        if block:
            blocks.append(block)

    return blocks
