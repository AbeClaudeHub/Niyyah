#!/usr/bin/env python3
"""Parse the manuscript markdown files into a structured content model."""
import os, re, glob
import markdown

MS = os.path.join(os.path.dirname(__file__), "..", "manuscript")

def md_body(text):
    html = markdown.markdown(text.strip(), extensions=["extra", "sane_lists"])
    # ornamental scene breaks
    html = html.replace("<hr />", '<hr class="brk"/>').replace("<hr>", '<hr class="brk"/>')
    # tag Reflect/Train h3 headings
    def h3(m):
        label = m.group(1)
        cls = "sec-reflect" if label.lower().startswith("reflect") else (
              "sec-train" if label.lower().startswith("train") else "sec-h3")
        return f'<h3 class="{cls}">{label}</h3>'
    html = re.sub(r'<h3>(.*?)</h3>', h3, html, flags=re.S)
    return html

def first_para_dropcap(html):
    """Add drop-cap class to the first <p> in a chapter body."""
    return re.sub(r'<p>', '<p class="opening">', html, count=1)

def sections():
    out = []
    files = sorted(glob.glob(os.path.join(MS, "*.md")))
    for f in files:
        name = os.path.basename(f)
        if name in ("TABLE-OF-CONTENTS.md", "README.md"):
            continue
        raw = open(f, encoding="utf-8").read()
        if name.startswith("00-front"):
            # extract the "A Note Before You Begin" foreword
            note = raw.split("## A Note Before You Begin", 1)[1]
            out.append({"type": "foreword", "title": "A Note Before You Begin",
                        "html": md_body(note)})
        elif "part" in name and "opener" in name:
            # "# PART I" then "# TITLE" then intro
            m = re.match(r'\s*#\s*(PART [IVX]+)\s*\n+#\s*(.+?)\n(.*)', raw, flags=re.S)
            part, title, body = m.group(1), m.group(2).strip(), m.group(3)
            out.append({"type": "part", "part": part, "title": title,
                        "html": md_body(body)})
        else:
            # chapter: "## Chapter N" then "# Title" then body
            m = re.match(r'\s*##\s*(.+?)\s*\n+#\s*(.+?)\n(.*)', raw, flags=re.S)
            chnum, title, body = m.group(1).strip(), m.group(2).strip(), m.group(3)
            out.append({"type": "chapter", "num": chnum, "title": title,
                        "html": first_para_dropcap(md_body(body))})
    return out

if __name__ == "__main__":
    for s in sections():
        print(s["type"], "|", s.get("part",""), "|", s.get("num",""), "|", s["title"][:50])
