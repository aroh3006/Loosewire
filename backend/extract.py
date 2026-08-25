"""Safe extraction of an uploaded zip into a fresh temp directory, with a
guard against zip-slip (entries that try to write outside the target dir).
"""

import os
import zipfile


class ExtractionError(Exception):
    pass


def extract_zip(zip_path: str, dest_dir: str) -> None:
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            member_path = os.path.normpath(os.path.join(dest_dir, member.filename))
            if not member_path.startswith(os.path.normpath(dest_dir) + os.sep) and member_path != os.path.normpath(dest_dir):
                raise ExtractionError(f"unsafe path in archive: {member.filename}")
        zf.extractall(dest_dir)
