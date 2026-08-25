# Loosewire

Loosewire scans checkout integration code for common payment wiring
mistakes. Upload a zip of your project, or an APK. It returns a plain
list of findings: what looks wrong, where it is, and how to fix it.

It reads only the code you give it. It never contacts any live system,
gateway, or third party. It makes no outbound network calls of its own.
Everything it needs comes from the file you upload. That file is deleted
from the server as soon as the scan finishes.

## What it checks for

1. **Missing signature verification**: code that marks an order paid or
   completed without ever checking a signature or HMAC first. Also flags
   payment success handling that only exists in frontend code, with no
   matching server-side check anywhere in the project.
2. **Exposed secret key**: secret-looking values hardcoded into source,
   especially anything that ships to a browser or gets bundled into a
   mobile app.
3. **Missing webhook signature check**: webhook or callback routes that
   trust the payload without verifying a signature header first.
4. **Missing amount validation**: order completion logic that never
   compares the amount being confirmed against the amount stored when the
   order was created.

Each finding includes a rule name, severity, a confidence level (how
directly the pattern matched versus how much the tool had to guess), the
file and line, a plain description, and a one-line fix.

## Running it locally

Requires Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate   # .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Open `http://localhost:8000`. The port can be overridden with the `PORT`
environment variable.

To run the test suite:

```bash
pip install -r requirements-dev.txt
pytest
```

APK scanning needs [jadx](https://github.com/skylot/jadx) installed and on
`PATH`. If it isn't available, the scan endpoint returns a clear error for
`.apk` uploads instead of failing silently. `.zip` uploads are unaffected.

## Architecture

A scan is a straight line from upload to report, with nothing kept
afterward:

```
upload (.zip or .apk)
  -> saved to a fresh temp directory
  -> .zip: extracted directly
     .apk: decompiled with jadx into readable source first
  -> walk the extracted tree, parse each .py/.js/.ts file into
     framework-agnostic CodeBlocks (route handlers and functions,
     with their body and line range)
  -> each of the 4 rule modules runs against every CodeBlock and file
  -> findings are collected, sorted by severity
  -> temp directory is deleted
  -> JSON report returned to the browser
```

The parsing layer and the rule layer are deliberately separate. A parser
(`backend/parsers/python_parser.py`, `backend/parsers/node_parser.py`)
only knows how to turn one language's syntax into a `CodeBlock`: a
function or route with a name, an HTTP method and path if it's a route,
and its line range. A rule (`backend/detectors/*.py`) only knows what a
security-relevant pattern looks like in that generic shape. It has no
idea how any particular framework's syntax works. Adding a third
framework means writing one new parser. It does not touch the rules.

## Metrics page

The metrics page runs the scanner against `fixtures/heldout`, a set of
small sample projects that were never used while building or tuning the
rules. It reports precision, recall, and F1 per rule and combined. This
matters more than a number computed against fixtures the rules were
written to pass. It is a rough measure of how the rules generalize to
code they have not seen.

It also shows a cost estimate. Each false positive is costed at a flat
$25 (assumed developer time to open the flagged line, decide it's not a
real issue, and close it out). Each false negative is costed at a flat
$500 (assumed fraud exposure from a payment bug that ships unnoticed).
Both numbers are stated assumptions, not measured figures, chosen to be
directionally reasonable rather than precise. The page reports the
estimated net value of running the tool versus catching nothing, using
that model.

`fixtures/dev` holds a separate, smaller set of fixtures used only while
building each rule. The test suite in `tests/` checks against that set.
`evaluation/run_evaluation.py` regenerates `evaluation/results.json` from
the held-out set. The metrics endpoint computes the same thing live on
every request rather than serving a stale file.

## Limitations

This is a static, pattern-based scanner, not a real interpreter or a
dataflow analyzer. It has known blind spots:

- **No cross-function tracing.** If a route calls a same-file helper
  function to do its signature check (`if not checkSignature(...)`), and
  that helper's own name doesn't look like a verification call, the tool
  will not follow the call into the helper's body to see the HMAC logic
  inside it. It only looks at the text of the block it already
  identified as the completion path. This is the single biggest source
  of false positives observed on the held-out set.
- **Name and path based, not semantic.** The rules match a route or
  function by name and path patterns (`complete`, `webhook`, `amount`,
  and so on). Code with unconventional naming can slip past detection.
  Unrelated code that happens to share vocabulary (a `/orders/:id` read
  endpoint named suggestively) can get flagged when it shouldn't be.
- **No config or environment resolution.** A secret pulled from a config
  file or a constants module the scanner doesn't parse the contents of
  will not be caught, even if that file is bundled into a shipped
  artifact.
- **APK coverage depends on jadx output quality.** Obfuscated or heavily
  minified APKs may decompile to code the parsers can't make sense of.
  That silently reduces findings rather than raising an explicit warning.
- **Single-file scope.** Verification or amount-comparison logic split
  across multiple files (a signature check in a shared middleware file,
  applied to all routes) is not connected back to the specific route it
  protects.

None of this is invisible in the numbers. The held-out evaluation
includes a fixture built specifically to demonstrate the cross-function
blind spot. It is counted as a false positive rather than excluded.

## Deployment

Runs as a standard FastAPI/uvicorn app. On Render, set the start command
to:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

The app reads the port from the `PORT` environment variable and falls
back to 8000 locally. There is no database and no accounts. There is
nothing else to provision.
