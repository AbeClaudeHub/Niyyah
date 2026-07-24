/* Niyyah — shared document-to-PNG renderer.
   Draws directly onto a <canvas> with fillText/strokes — never drawImage of
   an SVG/foreignObject. That SVG-rasterization technique taints the canvas
   in Chrome (SecurityError on toDataURL) even for same-origin, script-free
   content, so it can't be used here. Pure 2D drawing primitives never taint
   the canvas, which is what makes this reliable.

   Used by the contract, the check-in paper, and the check-out paper, so all
   three share one drawing engine and one visual register. Each caller gets
   a fresh builder via DocRender.createBuilder(), pushes content with its
   helpers, then calls DocRender.renderAndDownload(builder, filename). */

const DocRender = (function(){
  const W = 1080, M = 72;
  const contentW = W - M * 2;
  const COLOR = {
    bg: "#0c0a08", paper: "#151109", border: "rgba(201,163,95,.4)",
    borderSoft: "rgba(242,237,225,.14)",
    cream: "#f2ede1", muted: "#b7c2b9", muted2: "#8a9188",
    gold: "#c9a35f", goldHi: "#e8cd93",
  };
  const SERIF = `Georgia, 'Times New Roman', serif`;
  const SANS = `Arial, Helvetica, sans-serif`;

  function wrapLines(ctx, text, maxWidth){
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for(const w of words){
      const test = line ? line + " " + w : w;
      if(line && ctx.measureText(test).width > maxWidth){
        lines.push(line);
        line = w;
      }else{
        line = test;
      }
    }
    if(line) lines.push(line);
    return lines;
  }
  function spacedWidth(ctx, text, spacing){
    let w = 0;
    for(const ch of text) w += ctx.measureText(ch).width + spacing;
    return w - spacing;
  }
  function drawSpaced(ctx, text, x, y, spacing, align){
    let startX = x;
    if(align === "center") startX = x - spacedWidth(ctx, text, spacing) / 2;
    let cx = startX;
    for(const ch of text){ ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  }

  function createBuilder(){
    const ops = [];
    const yRef = { v: 0 };
    const push = fn => ops.push(fn);

    function heading(text, font, color, gapBefore, gapAfter, align){
      push((ctx, measuring) => {
        ctx.font = font;
        yRef.v += gapBefore;
        if(!measuring){
          ctx.fillStyle = color;
          ctx.textAlign = align || "left";
          ctx.fillText(text, align === "center" ? W / 2 : M, yRef.v);
          ctx.textAlign = "left";
        }
        yRef.v += gapAfter;
      });
    }
    function kicker(text, color, align){
      push((ctx, measuring) => {
        ctx.font = `700 18px ${SANS}`;
        yRef.v += 26;
        if(!measuring){
          ctx.fillStyle = color;
          drawSpaced(ctx, text.toUpperCase(), align === "center" ? W / 2 : M, yRef.v, 4, align);
        }
        yRef.v += 18;
      });
    }
    function paragraph(text, opts){
      opts = opts || {};
      const font = opts.font || `300 27px ${SERIF}`;
      const color = opts.color || COLOR.muted;
      const lineHeight = opts.lineHeight || 36;
      const align = opts.align || "left";
      push((ctx, measuring) => {
        ctx.font = font;
        const lines = wrapLines(ctx, text, opts.maxWidth || contentW);
        for(const line of lines){
          yRef.v += lineHeight;
          if(!measuring){
            ctx.fillStyle = color;
            ctx.textAlign = align;
            ctx.fillText(line, align === "center" ? W / 2 : M, yRef.v);
            ctx.textAlign = "left";
          }
        }
        yRef.v += opts.gapAfter != null ? opts.gapAfter : 14;
      });
    }
    function sectionLabel(text){
      push((ctx, measuring) => {
        ctx.font = `700 19px ${SANS}`;
        yRef.v += 44;
        if(!measuring){
          ctx.fillStyle = COLOR.gold;
          drawSpaced(ctx, text.toUpperCase(), M, yRef.v, 3);
        }
        yRef.v += 20;
      });
    }
    function divider(gapBefore, gapAfter, style){
      gapBefore = gapBefore == null ? 30 : gapBefore;
      gapAfter = gapAfter == null ? 30 : gapAfter;
      push((ctx, measuring) => {
        yRef.v += gapBefore;
        if(!measuring){
          ctx.strokeStyle = style || COLOR.border;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(M, yRef.v); ctx.lineTo(W - M, yRef.v); ctx.stroke();
        }
        yRef.v += gapAfter;
      });
    }
    /* A label/value row with a divider under it — used for grade lines and
       any other "text on the left, short answer on the right" row. Wraps
       the label onto multiple lines if it's long (rule text echoed back). */
    function gradeLine(label, rightText){
      rightText = rightText == null ? "1–5" : rightText;
      push((ctx, measuring) => {
        ctx.font = `300 24px ${SANS}`;
        const lines = wrapLines(ctx, label, contentW - 90);
        lines.forEach((line, i) => {
          yRef.v += 34;
          if(!measuring){
            ctx.fillStyle = COLOR.cream;
            ctx.textAlign = "left";
            ctx.fillText(line, M, yRef.v);
            if(i === 0){
              ctx.fillStyle = COLOR.muted2;
              ctx.textAlign = "right";
              ctx.fillText(rightText, W - M, yRef.v);
            }
            ctx.textAlign = "left";
          }
        });
        yRef.v += 10;
        if(!measuring){
          ctx.strokeStyle = COLOR.borderSoft;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(M, yRef.v); ctx.lineTo(W - M, yRef.v); ctx.stroke();
        }
        yRef.v += 14;
      });
    }
    function signatureLine(name, dateText){
      push((ctx, measuring) => {
        ctx.font = `italic 300 34px ${SERIF}`;
        yRef.v += 46;
        if(!measuring){
          ctx.fillStyle = COLOR.cream;
          ctx.textAlign = "left";
          ctx.fillText(name, M, yRef.v);
          ctx.font = `300 20px ${SANS}`;
          ctx.fillStyle = COLOR.muted2;
          ctx.textAlign = "right";
          ctx.fillText(dateText, W - M, yRef.v);
          ctx.textAlign = "left";
        }
      });
    }
    function custom(fn){ push(fn); }

    return { ops, yRef, heading, kicker, paragraph, sectionLabel, divider, gradeLine, signatureLine, custom };
  }

  function renderAndDownload(builder, filename){
    const measureCanvas = document.createElement("canvas");
    const mctx = measureCanvas.getContext("2d");
    builder.yRef.v = M;
    for(const op of builder.ops) op(mctx, true);
    const totalHeight = Math.ceil(builder.yRef.v + M);

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = totalHeight * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, W, totalHeight);
    ctx.fillStyle = COLOR.paper;
    ctx.fillRect(0, 0, W, totalHeight);
    ctx.strokeStyle = COLOR.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, totalHeight - 1);
    ctx.textBaseline = "alphabetic";

    builder.yRef.v = M;
    for(const op of builder.ops) op(ctx, false);

    try{
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.download = filename;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    }catch(err){
      console.warn("PNG export failed:", err);
      alert("Couldn't generate the image in this browser. Try again, or screenshot this page.");
      return false;
    }
  }

  return { W, M, contentW, COLOR, SERIF, SANS, createBuilder, renderAndDownload };
})();
