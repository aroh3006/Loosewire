# Loosewire

Loosewire scans checkout integration code for common payment wiring
mistakes. Upload a zip of your project or an APK. It returns a plain list of
findings. Each one says what looks wrong, its exact location and how to fix
it.

It reads only the code you give it. It never contacts any live system,
gateway or third party. It makes no outbound network calls of its own.
Everything it needs comes from the file you upload. That file is deleted
from the server as soon as the scan finishes.

## Try it live

The hosted version runs at **https://loosewire.onrender.com**. Anyone can
open it and scan a project straight away. There is nothing to install. There
is no account to create.

If you want something to upload without digging out a project of your own,
the `examples` folder in this repo holds five ready-made samples. Three are
zipped source projects. One is written correctly and scans clean. The other
two contain real mistakes that between them cover all four checks. The last
two samples are Android APKs, there so you can try the APK path as well as the
zip path. One of those scans clean. The other carries a planted key that the
scanner picks up. The readme inside that folder explains what each one
demonstrates.

The hosted app runs on a free instance that would normally sleep when nobody
is using it. A scheduled health check pings it regularly to keep it awake. In
normal circumstances a visitor should not run into a wake-up delay. That
depends on the scheduled check staying configured correctly. It also depends
on how the free tier behaves at the time. If the instance has gone to sleep
anyway, the first request can take up to a minute. Requests after that are
quick.

## What it checks for

Loosewire runs four checks over the code you upload.

The first looks for missing signature verification. It flags code that marks
an order paid or completed without ever checking a signature or HMAC first.
It also flags payment success handling that only exists in frontend code,
with no matching server-side check anywhere in the project.

The second looks for exposed secret keys. It flags secret-looking values
hardcoded into source. A key sitting in code that ships to a browser or gets
bundled into a mobile app is treated as more serious than the same value in
backend source.

The third looks for missing webhook signature checks. It flags webhook or
callback routes that trust the payload without verifying a signature header
first.

The fourth looks for missing amount validation. It flags order completion
logic that never compares the amount being confirmed against the amount
stored when the order was created.

Each finding names the rule, the severity, the confidence level, the file and
the line. Confidence reflects how directly the pattern matched versus how
much the tool had to guess. Every finding also carries a plain description of
the problem plus a one-line fix.

## Running it locally

Loosewire needs Python 3.11 or newer. The repo pins 3.11.9 in a
`.python-version` file at the root. The hosted deploy reads that same file.

```bash
python -m venv .venv
source .venv/bin/activate   # .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Open `http://localhost:8000`. The port can be overridden with the `PORT`
environment variable.

To run the backend test suite:

```bash
pip install -r requirements-dev.txt
pytest
```

There is one frontend test as well. It runs on plain node with no framework
and no build step:

```bash
node tests/frontend/test_severity_summary.js
```

APK scanning needs [jadx](https://github.com/skylot/jadx) installed and on
`PATH`. If it isn't available, the scan endpoint returns a clear error for
`.apk` uploads instead of failing silently. Zip uploads are unaffected. When
you run Loosewire yourself you need to install jadx to scan an APK.

APK scanning also works on the hosted deployment. That instance runs as a
Docker container with a Java runtime and jadx already installed. You can
upload an APK to the live site without setting anything up yourself.

## Interface

The app is one page with four views, reachable from the sidebar: Scan,
Findings, Metrics and Product Handbook.

Scan is where you upload a file, with a short readout of what stage the scan
is on while it runs. Findings is a split view, with a list of results on the
left and the full detail of whichever one you select on the right. That
detail covers the location, why it matters and the suggested fix. Metrics
shows the numbers described below. Product Handbook is a short in-app guide
explaining the four checks, how to read a finding and how the evaluation
numbers are calculated, written for someone opening the tool with no prior
context.

The interface is dark only. There is no light mode and no theme toggle.

## Working with findings

On the Findings view, each finding can be marked not applicable. It can also
be marked back as applicable again. This is a session only view. It lives in
the browser and resets the moment you refresh the page or run a new scan.

Marking a finding not applicable dims it in the list. It also recomputes the
severity summary above the list right away. The counts there only reflect the
findings you still consider active. This working view never touches the
backend. It never changes the precision, recall and F1 numbers on the Metrics
page. Those numbers come only from the held-out fixture set and stay exactly
as they are, no matter what you mark during a scan.

The Findings view also has a Download report button. It builds a PDF entirely
in the browser, with no backend involved, using a small client-side library
loaded from a CDN. The PDF covers the project name, the scan date, the files
scanned and the frameworks detected. It then lists every active finding with
its severity, confidence, location, description and fix. Findings marked not
applicable are left out of that list. A short note at the top says how many
were excluded.

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
(`backend/parsers/python_parser.py`, `backend/parsers/node_parser.py`) only
knows how to turn one language's syntax into a `CodeBlock`. That is a
function or route with a name, an HTTP method and path if it's a route, plus
its line range. A rule (`backend/detectors/*.py`) only knows what a
security-relevant pattern looks like in that generic shape. It has no idea
how any particular framework's syntax works. Adding a third framework means
writing one new parser. It does not touch the rules.

## Metrics page

The metrics page runs the scanner against `fixtures/heldout`, a set of small
sample projects that were never used while building or tuning the rules. It
reports precision, recall and F1 per rule and combined. This matters more
than a number computed against fixtures the rules were written to pass. It is
a rough measure of how the rules generalize to code they have not seen.

It also shows a cost estimate. Each false positive is costed at a flat $25.
That stands for the developer time taken to open the flagged line, decide it
is not a real issue and close it out. Each false negative is costed at a flat
$500, standing for the fraud exposure from a payment bug that ships
unnoticed. Both numbers are stated assumptions rather than measured figures,
chosen to be directionally reasonable rather than precise. The page reports
the estimated net value of running the tool versus catching nothing, using
that model.

`fixtures/dev` holds a separate, smaller set of fixtures used only while
building each rule. The test suite in `tests/` checks against that set.
`evaluation/run_evaluation.py` regenerates `evaluation/results.json` from the
held-out set. The metrics endpoint computes the same thing live on every
request rather than serving a stale file.

The `examples` folder is not part of any of this. Those projects exist purely
for people trying the live app by hand. Nothing in `examples` feeds the
evaluation numbers.

## Limitations

This is a static, pattern-based scanner, not a real interpreter or a dataflow
analyzer. It has known blind spots.

There is no cross-function tracing. A route might call a same-file helper
function to do its signature check. If that helper's own name doesn't look
like a verification call, the tool will not follow the call into the helper's
body to see the HMAC logic inside it. It only looks at the text of the block
it already identified as the completion path. This is the single biggest
source of false positives observed on the held-out set.

Matching is name and path based rather than semantic. The rules match a route
or function by name and path patterns such as `complete`, `webhook` or
`amount`. Code with unconventional naming can slip past detection. Unrelated
code that happens to share the same vocabulary can get flagged when it
shouldn't be.

There is no config or environment resolution. A secret pulled from a config
file or a constants module the scanner doesn't parse the contents of will not
be caught, even if that file is bundled into a shipped artifact.

APK coverage depends on the quality of the jadx output. Obfuscated or heavily
minified APKs may decompile to code the parsers can't make sense of. That
silently reduces findings rather than raising an explicit warning.

The scope is a single file at a time. Verification or amount-comparison logic
split across multiple files, such as a signature check in a shared middleware
file applied to all routes, is not connected back to the specific route it
protects.

None of this is invisible in the numbers. The held-out evaluation includes a
fixture built specifically to demonstrate the cross-function blind spot. It
is counted as a false positive rather than excluded.

## Deployment

Loosewire runs as a standard FastAPI app under uvicorn. The live instance is
hosted on Render.

The deploy configuration lives in `render.yaml` at the root of this repo
rather than only in the hosting dashboard. That file records the service
type, the Python runtime, the free plan, the region, the build command and
the start command. The service is managed from that file. A change to it is
picked up on the next push to `main`.

The build step installs from `requirements.txt`. The start command is
`uvicorn backend.main:app --host 0.0.0.0 --port $PORT`. The app reads the
port from the `PORT` environment variable. It falls back to 8000 when that
variable is not set.

The Python version is not repeated in `render.yaml`. It comes from the
`.python-version` file. The host reads that file directly.

There is no database. There are no accounts. No environment variables need to
be set by hand for the app to run.
