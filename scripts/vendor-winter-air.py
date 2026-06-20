#!/usr/bin/env python3
"""Vendor winter-air for Windows (reserved aux.rs path) and patch module path."""

from __future__ import annotations

import io
import re
import tarfile
import urllib.request
from pathlib import Path

CRATE = "winter-air"
VERSION = "0.13.1"
ROOT = Path(__file__).resolve().parents[1]
VENDOR_DIR = ROOT / "vendor" / f"{CRATE}-{VERSION}"


def download_crate() -> bytes:
    url = f"https://crates.io/api/v1/crates/{CRATE}/{VERSION}/download"
    print(f"Downloading {url}")
    with urllib.request.urlopen(url) as resp:
        return resp.read()


def extract_crate(data: bytes) -> None:
    if VENDOR_DIR.exists():
        import shutil

        shutil.rmtree(VENDOR_DIR)

    prefix = f"{CRATE}-{VERSION}/"
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for member in tar.getmembers():
            if not member.name.startswith(prefix):
                continue
            rel = member.name[len(prefix) :]
            if not rel:
                continue

            target = VENDOR_DIR / rel
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue

            content = tar.extractfile(member)
            if content is None:
                continue

            raw = content.read()
            if rel.replace("\\", "/") == "src/air/aux.rs":
                target = VENDOR_DIR / "src" / "air" / "auxiliary.rs"
                print("Renamed src/air/aux.rs -> auxiliary.rs")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)


def patch_mod_rs() -> None:
    mod_rs = VENDOR_DIR / "src" / "air" / "mod.rs"
    text = mod_rs.read_text(encoding="utf-8")
    if "#[path = \"auxiliary.rs\"]" in text:
        print("mod.rs already patched")
        return

    text = re.sub(
        r"^mod aux;",
        '#[path = "auxiliary.rs"]\nmod aux;',
        text,
        count=1,
        flags=re.MULTILINE,
    )
    mod_rs.write_text(text, encoding="utf-8")
    print("Patched src/air/mod.rs")


def main() -> None:
    data = download_crate()
    extract_crate(data)
    patch_mod_rs()
    print(f"Vendored to {VENDOR_DIR}")


if __name__ == "__main__":
    main()