"""APK handling: run jadx to decompile an APK into readable Java source,
then let the normal scan path (looking only for .py/.js today, so this
mainly matters once jadx output includes JS from hybrid/web-view apps)
walk the result. jadx must be installed and on PATH; if it isn't, we
report that plainly instead of pretending the scan covered the APK.
"""

import shutil
import subprocess


class JadxNotAvailable(Exception):
    pass


class DecompileError(Exception):
    pass


def decompile_apk(apk_path: str, out_dir: str, timeout_seconds: int = 180) -> None:
    jadx_bin = shutil.which("jadx")
    if not jadx_bin:
        raise JadxNotAvailable("jadx is not installed or not on PATH")

    result = subprocess.run(
        [jadx_bin, "-d", out_dir, apk_path],
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    if result.returncode != 0:
        raise DecompileError(result.stderr.strip() or "jadx exited with a non-zero status")
