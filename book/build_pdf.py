#!/usr/bin/env python3
import os, datetime
from parse import sections
from weasyprint import HTML

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
ASSETS = os.path.join(HERE, "assets")
YEAR = datetime.date.today().year

def furl(p): return "file://" + os.path.join(FONTS, p)

CSS = f"""
@font-face {{ font-family:'Garamond'; src:url('{furl("EBGaramond-Regular.ttf")}'); font-weight:400; font-style:normal; }}
@font-face {{ font-family:'Garamond'; src:url('{furl("EBGaramond-Italic.ttf")}'); font-weight:400; font-style:italic; }}
@font-face {{ font-family:'Garamond'; src:url('{furl("EBGaramond-Bold.ttf")}'); font-weight:700; font-style:normal; }}
@font-face {{ font-family:'Garamond'; src:url('{furl("EBGaramond-BoldItalic.ttf")}'); font-weight:700; font-style:italic; }}
@font-face {{ font-family:'Sans'; src:url('{furl("Inter-Medium.ttf")}'); font-weight:500; }}
@font-face {{ font-family:'SansSb'; src:url('{furl("Inter-SemiBold.ttf")}'); font-weight:600; }}

:root {{ --ink:#22262c; --soft:#5d6066; --gold:#9c7c3c; --rule:#ccbfa6; --cream:#faf8f3; }}

@page {{
  size: 5.5in 8.5in; margin: 0.85in 0.72in 0.9in 0.72in;
  background: var(--cream);
  @bottom-center {{ content: counter(page); font-family:'Sans'; font-size:8.5pt; color:var(--soft); margin-top:6pt; }}
}}
@page :first {{ @bottom-center {{ content: none; }} }}
@page front {{ @bottom-center {{ content: none; }} }}
@page chapter {{
  @top-center {{ content: string(runhead); font-family:'Sans'; font-size:7.5pt; letter-spacing:.12em;
                 text-transform:uppercase; color:var(--soft); margin-bottom:10pt; }}
  @bottom-center {{ content: counter(page); font-family:'Sans'; font-size:8.5pt; color:var(--soft); }}
}}

html {{ font-family:'Garamond'; color:var(--ink); }}
body {{ margin:0; font-size:11pt; line-height:1.52; text-align:justify; hyphens:auto; }}
p {{ margin:0; text-indent:1.15em; orphans:2; widows:2; }}
p.opening, h2 + p, h3 + p, .nofirst {{ text-indent:0; }}
em {{ font-style:italic; }} strong {{ font-weight:700; }}

/* ---- ornamental scene break ---- */
hr.brk {{ border:0; margin:1.3em 0; text-align:center; }}
hr.brk::after {{ content:'\\2042'; color:var(--gold); font-size:13pt; letter-spacing:.4em; }}

/* ---- front matter pages ---- */
.page {{ page: front; page-break-after:always; }}
.center {{ text-align:center; }}
.titlepage {{ display:flex; flex-direction:column; justify-content:center; height:7in; text-align:center; }}
.titlepage .star {{ color:var(--gold); font-size:26pt; }}
.titlepage h1 {{ font-family:'Garamond'; font-weight:700; font-size:34pt; line-height:1.05; margin:.5in 0 0; letter-spacing:.01em; }}
.titlepage .nafs {{ color:var(--gold); font-size:54pt; display:block; margin:.08in 0; }}
.titlepage .sub {{ font-style:italic; font-size:13pt; color:var(--soft); margin:.35in auto 0; max-width:4in; line-height:1.4; }}
.titlepage .auth {{ font-family:'SansSb'; letter-spacing:.18em; text-transform:uppercase; font-size:12pt; margin-top:.7in; }}
.titlepage .role {{ font-family:'Sans'; letter-spacing:.14em; text-transform:uppercase; font-size:8.5pt; color:var(--soft); margin-top:6pt; }}

.copyright {{ page:front; page-break-after:always; font-family:'Sans'; font-size:8.5pt; color:var(--soft);
              line-height:1.7; height:7in; display:flex; flex-direction:column; justify-content:flex-end; text-align:left; }}
.copyright p {{ text-indent:0; margin:.2em 0; }}

.epigraph {{ page:front; page-break-after:always; height:7in; display:flex; flex-direction:column;
             justify-content:center; text-align:center; }}
.epigraph .verse {{ font-style:italic; font-size:15pt; line-height:1.5; max-width:3.6in; margin:0 auto; }}
.epigraph .src {{ font-family:'Sans'; letter-spacing:.14em; text-transform:uppercase; font-size:8.5pt;
                  color:var(--gold); margin-top:.4in; }}

/* ---- table of contents ---- */
.toc {{ page:front; page-break-after:always; }}
.toc h2 {{ font-family:'SansSb'; text-transform:uppercase; letter-spacing:.22em; font-size:12pt;
           text-align:center; color:var(--ink); margin:0 0 .5in; font-weight:600; }}
.toc .pt {{ font-family:'SansSb'; text-transform:uppercase; letter-spacing:.16em; font-size:9pt;
            color:var(--gold); margin:.28in 0 .08in; }}
.toc a {{ display:block; text-decoration:none; color:var(--ink); font-size:10.5pt; margin:.07in 0; }}
.toc a::after {{ content: leader('.\\2009') target-counter(attr(href), page);
                 font-family:'Sans'; font-size:8.5pt; color:var(--soft); }}

/* ---- part divider ---- */
.part {{ page:front; page-break-before:right; page-break-after:always; text-align:center;
         display:flex; flex-direction:column; justify-content:center; height:6.6in; }}
.part .pnum {{ font-family:'SansSb'; letter-spacing:.34em; text-transform:uppercase; font-size:11pt; color:var(--gold); }}
.part .pline {{ width:46px; height:1px; background:var(--rule); margin:.28in auto; }}
.part h2 {{ font-family:'Garamond'; font-weight:700; font-size:26pt; line-height:1.12; margin:0 auto; max-width:3.6in; text-transform:uppercase; letter-spacing:.02em; }}
.part .intro {{ text-align:left; margin:.55in auto 0; max-width:3.5in; font-size:10.5pt; line-height:1.5; color:#33373d; }}
.part .intro p {{ text-indent:0; margin:.55em 0; }}
.part .intro p + p {{ text-indent:1.1em; }}
.part .intro hr.brk {{ margin:.7em 0; }}

/* ---- chapter ---- */
.chapter {{ page:chapter; page-break-before:always; }}
.chapter .chnum {{ font-family:'SansSb'; letter-spacing:.28em;
                   text-transform:uppercase; font-size:9pt; color:var(--gold); text-align:center; margin:.3in 0 .12in; }}
.chapter h2 {{ font-family:'Garamond'; font-weight:700; font-size:22pt; line-height:1.15; text-align:center;
               margin:0 auto .1in; max-width:3.9in; }}
.chapter .cline {{ width:40px; height:1px; background:var(--gold); margin:.16in auto .42in; opacity:.7; }}
.chapter h2 {{ string-set: runhead content(text); }}

p.opening::first-letter {{
  font-family:'Garamond'; font-weight:700; color:var(--gold);
  float:left; font-size:3.05em; line-height:.78; padding:.02em .07em 0 0; margin-top:.02em;
}}

/* ---- reflect / train ---- */
h3.sec-reflect, h3.sec-train {{
  font-family:'SansSb'; text-transform:uppercase; letter-spacing:.18em; font-size:9.5pt;
  color:var(--gold); margin:1.5em 0 .5em; padding-top:.7em; border-top:1px solid var(--rule); page-break-after:avoid;
}}
h3.sec-h3 {{ font-family:'Garamond'; font-weight:700; font-size:13pt; margin:1.3em 0 .4em; }}
ol, ul {{ margin:.5em 0 .8em; padding-left:1.4em; text-align:left; }}
li {{ margin:.32em 0; text-indent:0; line-height:1.45; }}
li::marker {{ color:var(--gold); font-family:'Sans'; font-size:.85em; }}

/* ---- diagram / callout ---- */
blockquote {{ margin:1.2em auto; padding:.7em 1em; max-width:4.5in; text-align:center;
  border-top:1px solid var(--gold); border-bottom:1px solid var(--gold);
  font-size:11pt; line-height:1.5; page-break-inside:avoid; }}
blockquote p {{ text-indent:0; margin:.25em 0; }}

/* ---- tables (frameworks / cards) ---- */
table {{ border-collapse:collapse; width:100%; margin:1.1em 0; font-size:9.5pt;
  line-height:1.4; page-break-inside:avoid; }}
th, td {{ border:1px solid var(--rule); padding:.4em .55em; text-align:left;
  vertical-align:top; text-indent:0; }}
th {{ font-family:'SansSb'; text-transform:uppercase; letter-spacing:.06em;
  font-size:8pt; color:var(--gold); }}
td p, th p {{ text-indent:0; margin:0; }}

.foreword {{ page:front; page-break-before:right; }}
.foreword h2 {{ font-family:'Garamond'; font-style:italic; font-weight:400; font-size:20pt; text-align:center; margin:.3in 0 .4in; }}
"""

def esc(s): return s

def toc_html(secs):
    rows = []
    rows.append('<div class="toc"><h2>Contents</h2>')
    rows.append('<a href="#foreword">A Note Before You Begin</a>')
    for s in secs:
        if s["type"] == "part":
            rows.append(f'<div class="pt">{s["part"]} &nbsp;·&nbsp; {s["title"]}</div>')
        elif s["type"] == "chapter":
            cid = "ch" + s["num"].split()[-1]
            label = f'{s["num"]}. &nbsp;{s["title"]}'
            rows.append(f'<a href="#{cid}">{label}</a>')
    rows.append('</div>')
    return "\n".join(rows)

def body_html(secs):
    parts = []
    # foreword
    fw = next(s for s in secs if s["type"] == "foreword")
    parts.append(f'<section class="foreword" id="foreword"><h2>{fw["title"]}</h2>{fw["html"]}</section>')
    for s in secs:
        if s["type"] == "part":
            pid = "part" + s["part"].split()[-1]
            parts.append(
                f'<section class="part" id="{pid}">'
                f'<div class="pnum">{s["part"]}</div><div class="pline"></div>'
                f'<h2>{s["title"]}</h2><div class="intro">{s["html"]}</div></section>')
        elif s["type"] == "chapter":
            cid = "ch" + s["num"].split()[-1]
            parts.append(
                f'<section class="chapter" id="{cid}">'
                f'<div class="chnum">{s["num"]}</div>'
                f'<h2>{s["title"]}</h2><div class="cline"></div>'
                f'{s["html"]}</section>')
    return "\n".join(parts)

def build():
    secs = sections()
    cover = "file://" + os.path.join(ASSETS, "cover.png")
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="page" style="page:front;height:100%;text-align:center;page-break-after:always;">
  <img src="{cover}" style="width:100%;height:auto;"/>
</div>
<section class="titlepage page">
  <div class="star">&#10038;</div>
  <h1>THE TRADER<br><span style="font-weight:400;font-size:20pt;color:var(--soft);">AND THE</span><span class="nafs">NAFS</span></h1>
  <div class="sub">Why You Keep Breaking Your Rules — and How Islam Teaches You to Master Yourself</div>
  <div class="auth">Abrihym Aobad</div>
  <div class="role">Founder of Niyyah</div>
</section>
<section class="copyright">
  <p>THE TRADER AND THE NAFS</p>
  <p>Why You Keep Breaking Your Rules — and How Islam Teaches You to Master Yourself</p>
  <p>&nbsp;</p>
  <p>Copyright &copy; {YEAR} Abrihym Aobad. All rights reserved.</p>
  <p>No part of this book may be reproduced or transmitted in any form without the prior written permission of the author, except for brief quotations in reviews.</p>
  <p>&nbsp;</p>
  <p>This book is a work of guidance and reflection, not financial advice. Trading carries the risk of loss. The traders described are composites; identifying details have been changed.</p>
  <p>Qur'anic meanings are rendered in English; hadith are cited to their primary collections.</p>
  <p>&nbsp;</p>
  <p>Founder of Niyyah &nbsp;·&nbsp; First Digital Edition</p>
</section>
<section class="epigraph">
  <div class="verse">&ldquo;And I do not absolve my own self. Indeed the self is a persistent commander of evil &mdash; except those my Lord has mercy upon.&rdquo;</div>
  <div class="src">Qur'an 12:53</div>
</section>
{toc_html(secs)}
{body_html(secs)}
</body></html>"""
    out_html = os.path.join(HERE, "_book.html")
    open(out_html, "w", encoding="utf-8").write(html)
    pdf = os.path.join(HERE, "dist", "The-Trader-and-the-Nafs.pdf")
    HTML(string=html, base_url=HERE).write_pdf(pdf)
    print("PDF written:", pdf, os.path.getsize(pdf), "bytes")

if __name__ == "__main__":
    build()
