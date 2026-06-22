#!/usr/bin/env python3
import os, zipfile, uuid, datetime, html, re
from parse import sections

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
ASSETS = os.path.join(HERE, "assets")
OUT = os.path.join(HERE, "dist", "The-Trader-and-the-Nafs.epub")
UID = "urn:uuid:" + str(uuid.uuid4())
DATE = datetime.date.today().isoformat()
YEAR = datetime.date.today().year

CSS = """
@font-face{font-family:'Garamond';src:url('fonts/EBGaramond-Regular.ttf');font-weight:400;font-style:normal;}
@font-face{font-family:'Garamond';src:url('fonts/EBGaramond-Italic.ttf');font-weight:400;font-style:italic;}
@font-face{font-family:'Garamond';src:url('fonts/EBGaramond-Bold.ttf');font-weight:700;font-style:normal;}
@font-face{font-family:'Garamond';src:url('fonts/EBGaramond-BoldItalic.ttf');font-weight:700;font-style:italic;}
@font-face{font-family:'Sans';src:url('fonts/Inter-Medium.ttf');font-weight:500;}
@font-face{font-family:'SansSb';src:url('fonts/Inter-SemiBold.ttf');font-weight:600;}

html{font-family:'Garamond',Georgia,serif;color:#22262c;}
body{margin:0 6%;font-size:1em;line-height:1.55;text-align:justify;-webkit-hyphens:auto;hyphens:auto;background:#faf8f3;}
p{margin:0;text-indent:1.2em;}
p.opening,h1+p,h2+p,h3+p{text-indent:0;}
em{font-style:italic;}strong{font-weight:700;}
a{color:#9c7c3c;text-decoration:none;}

hr.brk{border:0;margin:1.4em 0;text-align:center;}
hr.brk:after{content:'\\2042';color:#9c7c3c;font-size:1.2em;letter-spacing:.4em;}

/* cover */
.coverpage{margin:0;padding:0;text-align:center;}
.coverpage img{max-width:100%;height:100%;}

/* title page */
.title{ text-align:center;margin-top:18%;}
.title .star{color:#9c7c3c;font-size:2em;}
.title h1{font-weight:700;font-size:2.5em;line-height:1.05;margin:.6em 0 0;}
.title .and{display:block;font-weight:400;font-size:.42em;color:#5d6066;letter-spacing:.05em;margin:.3em 0;}
.title .nafs{display:block;color:#9c7c3c;font-size:1.5em;margin:.1em 0;}
.title .sub{font-style:italic;font-size:1.1em;color:#5d6066;margin:1.4em auto 0;max-width:80%;line-height:1.4;}
.title .auth{font-family:'SansSb';letter-spacing:.18em;text-transform:uppercase;font-size:1em;margin-top:2.4em;color:#22262c;}
.title .role{font-family:'Sans';letter-spacing:.14em;text-transform:uppercase;font-size:.72em;color:#5d6066;margin-top:.5em;}

.copyright{font-family:'Sans';font-size:.78em;color:#5d6066;line-height:1.7;margin-top:30%;}
.copyright p{text-indent:0;margin:.4em 0;text-align:left;}

.epigraph{text-align:center;margin-top:40%;}
.epigraph .verse{font-style:italic;font-size:1.25em;line-height:1.5;max-width:85%;margin:0 auto;}
.epigraph .src{font-family:'Sans';letter-spacing:.14em;text-transform:uppercase;font-size:.72em;color:#9c7c3c;margin-top:1.6em;}

/* contents */
nav#toc h1,.foreword h1{font-family:'SansSb';text-transform:uppercase;letter-spacing:.2em;font-size:1.1em;text-align:center;margin:1.5em 0 1.4em;}
nav#toc ol{list-style:none;margin:0;padding:0;}
nav#toc li{margin:.35em 0;}
nav#toc li.pt{font-family:'SansSb';text-transform:uppercase;letter-spacing:.14em;font-size:.8em;color:#9c7c3c;margin:1.2em 0 .3em;}
nav#toc a{font-size:1em;color:#22262c;}

/* part divider */
.part{text-align:center;margin-top:30%;page-break-before:always;}
.part .pnum{font-family:'SansSb';letter-spacing:.32em;text-transform:uppercase;font-size:.9em;color:#9c7c3c;}
.part .pline{width:46px;height:1px;background:#ccbfa6;margin:1.4em auto;}
.part h1{font-weight:700;font-size:1.9em;line-height:1.15;text-transform:uppercase;letter-spacing:.02em;margin:0 auto;max-width:85%;}
.part .orn{color:#9c7c3c;font-size:1.1em;margin:1.6em 0 1.2em;}
.part .intro{text-align:left;margin:0 auto;max-width:92%;font-size:.95em;}
.part .intro p{margin:.6em 0;}

/* chapter */
.chapter{page-break-before:always;}
.chapter .chnum{font-family:'SansSb';letter-spacing:.26em;text-transform:uppercase;font-size:.78em;color:#9c7c3c;text-align:center;margin:2em 0 .5em;}
.chapter h1{font-weight:700;font-size:1.7em;line-height:1.15;text-align:center;margin:0 auto;max-width:90%;}
.chapter .cline{width:40px;height:1px;background:#9c7c3c;opacity:.7;margin:1em auto 1.8em;}
p.opening:first-letter{font-weight:700;color:#9c7c3c;float:left;font-size:3.1em;line-height:.8;padding:.02em .08em 0 0;}

h3.sec-reflect,h3.sec-train{font-family:'SansSb';text-transform:uppercase;letter-spacing:.16em;font-size:.82em;color:#9c7c3c;margin:1.8em 0 .6em;padding-top:.8em;border-top:1px solid #ccbfa6;}
h3.sec-h3{font-weight:700;font-size:1.15em;margin:1.3em 0 .4em;}
ol,ul{margin:.6em 0 1em;padding-left:1.3em;text-align:left;}
li{margin:.35em 0;text-indent:0;line-height:1.45;}

blockquote{margin:1.3em auto;padding:.7em 1em;text-align:center;border-top:1px solid #9c7c3c;border-bottom:1px solid #9c7c3c;line-height:1.5;}
blockquote p{text-indent:0;margin:.25em 0;}

table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:.82em;line-height:1.4;}
th,td{border:1px solid #ccbfa6;padding:.4em .55em;text-align:left;vertical-align:top;text-indent:0;}
th{font-family:'SansSb';text-transform:uppercase;letter-spacing:.05em;font-size:.82em;color:#9c7c3c;}
td p,th p{text-indent:0;margin:0;}

.foreword h1{font-style:normal;}
.foreword .ttl{font-style:italic;font-weight:400;font-size:1.5em;text-align:center;margin:1.5em 0 1.2em;font-family:'Garamond';text-transform:none;letter-spacing:0;}
"""

def xhtml(title, body, cls="", extra_head=""):
    return f'''<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><meta charset="utf-8"/><title>{html.escape(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>{extra_head}</head>
<body class="{cls}">{body}</body></html>'''

def build():
    secs = sections()
    files = {}  # path -> bytes/str

    files["mimetype"] = "application/epub+zip"
    files["META-INF/container.xml"] = '''<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'''

    O = "OEBPS/"
    files[O+"style.css"] = CSS
    for f in os.listdir(FONTS):
        if f.endswith(".ttf"):
            files[O+"fonts/"+f] = open(os.path.join(FONTS,f),"rb").read()
    files[O+"images/cover.jpg"] = open(os.path.join(ASSETS,"cover.jpg"),"rb").read()
    # bundle OFL license texts for the embedded fonts (license compliance)
    for lic in ("OFL-EBGaramond.txt","OFL-Inter.txt"):
        src=os.path.join(FONTS,"_src",lic)
        if os.path.exists(src):
            files[O+"fonts/"+lic]=open(src,encoding="utf-8").read()

    # cover page
    files[O+"cover.xhtml"] = xhtml("Cover",
        '<div class="coverpage"><img src="images/cover.jpg" alt="Cover"/></div>', "coverpage")
    # title page
    files[O+"titlepage.xhtml"] = xhtml("Title",
        '<div class="title"><div class="star">&#10038;</div>'
        '<h1>THE TRADER<span class="and">AND THE</span><span class="nafs">NAFS</span></h1>'
        '<div class="sub">Why You Keep Breaking Your Rules — and How Islam Teaches You to Master Yourself</div>'
        '<div class="auth">Abrihym Aobad</div><div class="role">Founder of Niyyah</div></div>')
    # copyright
    files[O+"copyright.xhtml"] = xhtml("Copyright",
        f'<div class="copyright"><p>THE TRADER AND THE NAFS</p>'
        f'<p>Why You Keep Breaking Your Rules — and How Islam Teaches You to Master Yourself</p><p>&#160;</p>'
        f'<p>Copyright &#169; {YEAR} Abrihym Aobad. All rights reserved.</p>'
        f'<p>No part of this book may be reproduced or transmitted in any form without the prior written permission of the author, except for brief quotations in reviews.</p><p>&#160;</p>'
        f'<p>This book is a work of guidance and reflection, not financial advice. Trading carries the risk of loss. The traders described are composites; identifying details have been changed.</p>'
        f'<p>Qur&#8217;anic meanings are rendered in English; hadith are cited to their primary collections.</p><p>&#160;</p>'
        f'<p>Founder of Niyyah &#160;&#183;&#160; First Digital Edition</p></div>')
    # epigraph
    files[O+"epigraph.xhtml"] = xhtml("Epigraph",
        '<div class="epigraph"><div class="verse">&#8220;And I do not absolve my own self. Indeed the self is a persistent commander of evil — except those my Lord has mercy upon.&#8221;</div>'
        '<div class="src">Qur&#8217;an 12:53</div></div>')
    # foreword
    fw = next(s for s in secs if s["type"]=="foreword")
    files[O+"foreword.xhtml"] = xhtml(fw["title"],
        f'<section class="foreword"><h1 class="ttl">{html.escape(fw["title"])}</h1>{fw["html"]}</section>', "")

    # parts + chapters
    spine_main = []
    nav_items = []
    for s in secs:
        if s["type"]=="part":
            n = s["part"].split()[-1]
            fn = f"part{n}.xhtml"
            body = (f'<section class="part" id="part{n}"><div class="pnum">{s["part"]}</div>'
                    f'<div class="pline"></div><h1>{html.escape(s["title"])}</h1>'
                    f'<div class="orn">&#10038;</div><div class="intro">{s["html"]}</div></section>')
            files[O+fn] = xhtml(s["title"], body)
            spine_main.append(fn)
            nav_items.append(("pt", s["part"]+" · "+s["title"], fn))
        elif s["type"]=="chapter":
            num = s["num"].split()[-1]
            fn = f"ch{num}.xhtml"
            body = (f'<section class="chapter" id="ch{num}"><div class="chnum">{html.escape(s["num"])}</div>'
                    f'<h1>{html.escape(s["title"])}</h1><div class="cline"></div>{s["html"]}</section>')
            files[O+fn] = xhtml(f'{s["num"]}: {s["title"]}', body)
            spine_main.append(fn)
            nav_items.append(("ch", f'{s["num"]}.  {s["title"]}', fn))

    # nav.xhtml (visible contents + epub nav) — parts group their chapters in a nested <ol>
    toc_li = ['<li><a href="foreword.xhtml">A Note Before You Begin</a></li>']
    open_group = False
    for kind,label,fn in nav_items:
        if kind=="pt":
            if open_group: toc_li.append('</ol></li>')
            toc_li.append(f'<li class="pt"><span>{html.escape(label)}</span><ol>')
            open_group = True
        else:
            toc_li.append(f'<li><a href="{fn}">{html.escape(label)}</a></li>')
    if open_group: toc_li.append('</ol></li>')
    nav_body = ('<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>'
                + "".join(toc_li) + '</ol></nav>'
                '<nav epub:type="landmarks" hidden="hidden"><ol>'
                '<li><a epub:type="toc" href="nav.xhtml">Contents</a></li>'
                '<li><a epub:type="bodymatter" href="ch1.xhtml">Begin Reading</a></li>'
                '<li><a epub:type="cover" href="cover.xhtml">Cover</a></li></ol></nav>')
    files[O+"nav.xhtml"] = xhtml("Contents", nav_body)

    # manifest
    manifest = []
    manifest.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
    manifest.append('<item id="cover-img" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>')
    manifest.append('<item id="css" href="style.css" media-type="text/css"/>')
    fontid=0
    for f in sorted(files):
        if f.endswith(".ttf"):
            fontid+=1
            manifest.append(f'<item id="font{fontid}" href="{f[len(O):]}" media-type="font/ttf"/>')
    licid=0
    for f in sorted(files):
        if f.endswith(".txt"):
            licid+=1
            manifest.append(f'<item id="lic{licid}" href="{f[len(O):]}" media-type="text/plain"/>')
    pagefiles = ["cover.xhtml","titlepage.xhtml","copyright.xhtml","epigraph.xhtml","nav.xhtml","foreword.xhtml"]+spine_main
    for pf in pagefiles:
        if pf=="nav.xhtml": continue
        pid = pf.replace(".xhtml","").replace(".","_")
        manifest.append(f'<item id="{pid}" href="{pf}" media-type="application/xhtml+xml"/>')

    spine = ['<itemref idref="cover_x" linear="yes"/>'] if False else []
    spine_order = ["cover","titlepage","copyright","epigraph","nav","foreword"]+[p.replace(".xhtml","") for p in spine_main]
    spine_xml = "".join(f'<itemref idref="{sid}"/>' for sid in spine_order)

    opf = f'''<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">{UID}</dc:identifier>
<dc:title>The Trader and the Nafs</dc:title>
<dc:creator>Abrihym Aobad</dc:creator>
<dc:language>en</dc:language>
<dc:publisher>Niyyah</dc:publisher>
<dc:date>{DATE}</dc:date>
<dc:description>Why You Keep Breaking Your Rules — and How Islam Teaches You to Master Yourself. A book on Islamic psychology and trading self-mastery.</dc:description>
<meta property="dcterms:modified">{datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}</meta>
<meta name="cover" content="cover-img"/>
</metadata>
<manifest>
{chr(10).join(manifest)}
</manifest>
<spine>
{spine_xml}
</spine>
</package>'''
    files[O+"content.opf"] = opf

    # write zip
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT): os.remove(OUT)
    with zipfile.ZipFile(OUT,"w") as z:
        # mimetype first, stored
        z.writestr("mimetype", files.pop("mimetype"), compress_type=zipfile.ZIP_STORED)
        for path, data in files.items():
            if isinstance(data,str): data=data.encode("utf-8")
            z.writestr(path, data, compress_type=zipfile.ZIP_DEFLATED)
    print("EPUB written:", OUT, os.path.getsize(OUT), "bytes")

if __name__=="__main__":
    build()
