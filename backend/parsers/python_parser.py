"""Parser for Flask / FastAPI style Python code.

Finds function definitions, figures out their body by indentation, and
flags the ones that are route handlers (decorated with something like
@app.route, @app.get, @router.post, @bp.route) so rules can tell a route
apart from a plain helper function.
"""

import re

from backend.parsers.base import CodeBlock, SourceFile

DEF_RE = re.compile(r"^(?P<indent>[ \t]*)def\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\(")

# @app.route("/x", methods=["POST"])  @app.post("/x")  @router.get("/x")
DECORATOR_RE = re.compile(
    r"^[ \t]*@(?P<obj>[A-Za-z_][A-Za-z0-9_]*)\.(?P<verb>route|get|post|put|patch|delete)\s*\("
)
METHODS_KW_RE = re.compile(r"methods\s*=\s*\[([^\]]*)\]")
FIRST_STRING_ARG_RE = re.compile(r"""['"]([^'"]*)['"]""")


def _indent_width(indent: str) -> int:
    return len(indent.expandtabs(4))


def _extract_route_meta(decorator_lines: list[str]) -> tuple[str | None, str | None]:
    """Returns (http_method, route_path) from the decorator lines closest to
    a def, or (None, None) if none of them look like a route decorator."""
    for line in reversed(decorator_lines):
        m = DECORATOR_RE.match(line)
        if not m:
            continue
        verb = m.group("verb")
        path_m = FIRST_STRING_ARG_RE.search(line)
        path = path_m.group(1) if path_m else None
        if verb == "route":
            methods_m = METHODS_KW_RE.search(line)
            if methods_m:
                methods = [x.strip(" '\"") for x in methods_m.group(1).split(",") if x.strip()]
                return (methods[0].upper() if methods else "GET"), path
            return "GET", path
        return verb.upper(), path
    return None, None


def parse(source: SourceFile) -> list[CodeBlock]:
    lines = source.lines
    blocks: list[CodeBlock] = []
    pending_decorators: list[str] = []

    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if line.lstrip().startswith("@"):
            pending_decorators.append(line)
            i += 1
            continue

        m = DEF_RE.match(line)
        if not m:
            if line.strip() and not line.lstrip().startswith("#"):
                pending_decorators = []
            i += 1
            continue

        def_indent = _indent_width(m.group("indent"))
        name = m.group("name")

        # signature may span multiple lines before the trailing colon
        sig_end = i
        while sig_end < n and ":" not in lines[sig_end]:
            sig_end += 1

        start_line = i + 1  # 1-indexed
        body: list[tuple[int, str]] = []
        j = sig_end + 1
        while j < n:
            candidate = lines[j]
            if candidate.strip() == "" or candidate.lstrip().startswith("#"):
                body.append((j + 1, candidate))
                j += 1
                continue
            if _indent_width(candidate[: len(candidate) - len(candidate.lstrip())]) <= def_indent:
                break
            body.append((j + 1, candidate))
            j += 1
        end_line = body[-1][0] if body else start_line

        http_method, route_path = _extract_route_meta(pending_decorators)
        blocks.append(
            CodeBlock(
                file=source.path,
                framework="python",
                kind="route" if http_method else "function",
                name=name,
                http_method=http_method,
                route_path=route_path,
                start_line=start_line,
                end_line=end_line,
                lines=body,
            )
        )

        pending_decorators = []
        i = j

    return blocks
