#!/usr/bin/env python3
"""Verify that sw.js precaches every app file (docs/spec/06-pwa-release.md §2.4).

ASSETS must list ./, index.html, manifest.webmanifest, icons, every file under css/ and every file under js/
except js/vendor/ (vendor files are immutable and listed in IMMUTABLE_ASSETS by tools/hash_assets.py).

Usage:
    python3 tools/check_sw_assets.py          # exit 1 and print differences when out of date
    python3 tools/check_sw_assets.py --fix    # rewrite the ASSETS block in sw.js
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SW = os.path.join(ROOT, "sw.js")
ASSETS_BLOCK = re.compile(r"(// <assets>\n)(.*?)(// </assets>)", re.S)
IMMUTABLE_BLOCK = re.compile(r"// <immutable-assets>\n(.*?)// </immutable-assets>", re.S)
ENTRY = re.compile(r"'(\./[^']*)'")


def expected_assets():
    files = ["./", "./index.html", "./manifest.webmanifest"]
    for folder in ("css", "js", "icons"):
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, folder)):
            dirnames.sort()
            rel_dir = os.path.relpath(dirpath, ROOT).replace(os.sep, "/")
            if rel_dir.startswith("js/vendor"):
                continue
            for name in sorted(filenames):
                if name.startswith("."):
                    continue
                files.append(f"./{rel_dir}/{name}")
    return files


def main():
    fix = "--fix" in sys.argv
    source = open(SW, encoding="utf-8").read()
    block = ASSETS_BLOCK.search(source)
    if not block:
        print("sw.js: ASSETS markers (// <assets> … // </assets>) not found")
        return 1
    listed = ENTRY.findall(block.group(2))
    expected = expected_assets()
    missing = [f for f in expected if f not in listed]
    extra = [f for f in listed if f not in expected]

    immutable = IMMUTABLE_BLOCK.search(source)
    broken_immutable = []
    if immutable:
        for path in ENTRY.findall(immutable.group(1)):
            if not os.path.isfile(os.path.join(ROOT, path[2:])):
                broken_immutable.append(path)

    if fix:
        body = "const ASSETS = [\n" + "".join(f"  '{f}',\n" for f in expected) + "];\n"
        source = ASSETS_BLOCK.sub(lambda m: m.group(1) + body + m.group(3), source)
        open(SW, "w", encoding="utf-8").write(source)
        print(f"sw.js: ASSETS rewritten ({len(expected)} entries)")
        missing, extra = [], []

    for f in missing:
        print(f"missing from ASSETS: {f}")
    for f in extra:
        print(f"listed in ASSETS but not found: {f}")
    for f in broken_immutable:
        print(f"IMMUTABLE_ASSETS entry not found: {f}")
    if missing or extra or broken_immutable:
        print("Run: python3 tools/check_sw_assets.py --fix  (and tools/hash_assets.py for immutable files)")
        return 1
    print(f"sw.js: ASSETS ok ({len(listed if not fix else expected)} entries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
