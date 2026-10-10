#!/usr/bin/env python3
"""Render ui-inventory.html to PDF with Edge headless, then add one bookmark per screen.

Bookmark title: "<UI Inventory ID> - <screen title>" (the ID is the screen key, shown in the
"id / key" table row and the "key:" identifier line of each card).
Usage: python render-pdf.py [--html PATH] [--out PDF] [--bookmarks-only]
"""
import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

from pypdf import PdfReader, PdfWriter

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
REGISTRY = os.path.abspath(os.environ.get("JOBCORE_SCREEN_REGISTRY") or os.path.join(
    HERE, "..", "..", "..", "..", "app", "apps", "mobile", "src", "screens", "screen-registry.json"))


def load_numbers():
    with open(REGISTRY, "r", encoding="utf-8") as f:
        entries = json.load(f)
    return {e["key"]: int(e["number"]) for e in entries if not e.get("retired") and not e.get("retiredAt")}


def parse_screens(html_path):
    with open(html_path, "r", encoding="utf-8") as f:
        src = f.read()
    pat = re.compile(
        r'<article class="screen-card"[^>]*?data-screen-key="([^"]*)"[^>]*?data-flow-rank="([^"]*)"[^>]*>'
        r'.*?<h2>(.*?)</h2>', re.S)
    screens = []
    for i, m in enumerate(pat.finditer(src)):
        key = html.unescape(m.group(1))
        title = html.unescape(re.sub(r"<[^>]+>", "", m.group(3))).strip()
        screens.append({"key": key, "rank": float(m.group(2)), "title": title, "src": i})
    # in-browser sortBy('flow') is a stable sort on flow rank (generate.mjs sortBy)
    screens.sort(key=lambda s: (s["rank"], s["src"]))
    return screens


def norm(t):
    # long keys/titles wrap mid-token in the PDF, so match on whitespace-free text
    return re.sub(r"\s+", "", t or "")


def map_pages(screens, page_texts, numbers):
    result = []
    prev = 0
    used = set()
    for s in screens:
        key = s["key"]
        k = re.escape(key)
        pats = [re.compile(r"id/key" + k + "kind"),
                re.compile(r"key:" + k + "anchor:")]
        found = None
        for p in range(prev, len(page_texts)):
            t = page_texts[p]
            if any(x.search(t) for x in pats):
                found = p
                break
        if found is None:
            print("ERROR: could not locate screen key '%s' (title '%s') at or after page %d"
                  % (key, s["title"], prev + 1))
            sys.exit(2)
        if found in used:
            print("ERROR: screen key '%s' maps to page %d which another screen already uses"
                  % (key, found + 1))
            sys.exit(3)
        used.add(found)
        prev = found
        result.append(("#%04d %s - %s" % (numbers[key], key, s["title"]), found))
    return result


def bookmark(pdf_in, pdf_out, screens, numbers):
    reader = PdfReader(pdf_in)
    texts = [norm(p.extract_text()) for p in reader.pages]
    marks = map_pages(screens, texts, numbers)
    writer = PdfWriter(clone_from=reader)
    for title, page in marks:
        writer.add_outline_item(title, page)
    if len(writer.outline) != len(screens):
        print("ERROR: outline has %d bookmarks but %d screens; PDF not replaced"
              % (len(writer.outline), len(screens)))
        sys.exit(4)
    with open(pdf_out, "wb") as f:
        writer.write(f)
    return len(texts), marks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", default=os.path.join(HERE, "..", "ui-inventory.html"))
    ap.add_argument("--out", default=os.path.join(HERE, "..", "ui-inventory.pdf"))
    ap.add_argument("--bookmarks-only", action="store_true")
    a = ap.parse_args()
    html_path = os.path.abspath(a.html)
    out = os.path.abspath(a.out)
    outdir = os.path.dirname(out)
    screens = parse_screens(html_path)
    numbers = load_numbers()
    missing = [s["key"] for s in screens if s["key"] not in numbers]
    if missing:
        print("ERROR: screen key(s) with no registry number in %s: %s" % (REGISTRY, ", ".join(missing)))
        sys.exit(5)
    tmp_files = []
    profile = None
    try:
        if a.bookmarks_only:
            raw = out
        else:
            fd, raw = tempfile.mkstemp(suffix=".raw.pdf", dir=outdir)
            os.close(fd)
            tmp_files.append(raw)
            profile = tempfile.mkdtemp(prefix="edge-profile-")
            url = "file:///" + html_path.replace("\\", "/")
            subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                            "--user-data-dir=" + profile, "--print-to-pdf=" + raw, url],
                           timeout=300, check=True)
        fd, tmp_out = tempfile.mkstemp(suffix=".bm.pdf", dir=outdir)
        os.close(fd)
        tmp_files.append(tmp_out)
        pages, marks = bookmark(raw, tmp_out, screens, numbers)
        os.replace(tmp_out, out)
        tmp_files.remove(tmp_out)
        print("screens found: %d" % len(screens))
        print("pdf pages: %d" % pages)
        print("bookmarks added: %d" % len(marks))
        for title, page in marks[:3] + marks[-3:]:
            print("  p%d  %s" % (page + 1, title))
    finally:
        for f in tmp_files:
            if os.path.exists(f):
                os.remove(f)
        if profile:
            shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
