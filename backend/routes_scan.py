import os
import shutil
import tempfile

from fastapi import APIRouter, HTTPException, UploadFile

from backend.apk import DecompileError, JadxNotAvailable, decompile_apk
from backend.config import MAX_UPLOAD_BYTES
from backend.extract import ExtractionError, extract_zip
from backend.models import ScanReport
from backend.scan_orchestrator import scan_directory

router = APIRouter()


@router.post("/api/scan", response_model=ScanReport)
async def scan_upload(file: UploadFile) -> ScanReport:
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".zip", ".apk"):
        raise HTTPException(status_code=400, detail="upload a .zip of your project or a .apk file")

    work_dir = tempfile.mkdtemp(prefix="loosewire_")
    upload_path = os.path.join(work_dir, filename)
    try:
        size = 0
        with open(upload_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="file too large")
                out.write(chunk)

        scan_root = os.path.join(work_dir, "extracted")
        os.makedirs(scan_root, exist_ok=True)

        if ext == ".zip":
            try:
                extract_zip(upload_path, scan_root)
            except ExtractionError as exc:
                raise HTTPException(status_code=400, detail=str(exc))
        else:
            try:
                decompile_apk(upload_path, scan_root)
            except JadxNotAvailable:
                raise HTTPException(
                    status_code=503,
                    detail="APK scanning requires jadx to be installed on the server; it is not available",
                )
            except DecompileError as exc:
                raise HTTPException(status_code=400, detail=f"could not decompile APK: {exc}")

        return scan_directory(scan_root)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
