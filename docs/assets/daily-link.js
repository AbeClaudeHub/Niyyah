/* Niyyah — compact, URL-safe encode/decode for the personal daily-page
   link. Everything happens client-side; the hash fragment is never sent
   to a server, so this is the only "sync" mechanism the site needs.

   Link formats, newest first — decode accepts all of them forever:
     "d:" + base64url(deflate-raw(fields, preset dictionary))
           Fields are name/hard/daily/recovery/deed/leaving joined by \x1F.
           The preset dictionary below makes rules written from the
           contract page's own suggestions compress to almost nothing.
           Needs pako (vendored, loaded before this file).
     "z:" + base64url(deflate-raw(JSON))  — no dictionary, no pako needed.
     base64url(JSON)                      — the original format.
   encode() returns the shortest format this browser can produce; it and
   decode() are async. */

const DailyLink = (function(){
  /* FROZEN v1 dictionary. Links already pinned in members' rooms decode
     against exactly these bytes — NEVER edit, reorder, or "sync" this list
     with the contract page's suggestions. If the suggestions change, add a
     new format prefix with a new dictionary instead. */
  const DICT_V1 = [
    "I will never add to a losing position.",
    "I will never increase my size after a winning trade without a written reason.",
    "I will never move a profit target further away once price is near it.",
    "I will set a daily profit cap and stop trading the moment I hit it, win or lose.",
    "I will check my size against my written plan out loud before every entry.",
    "I will write down my target before the trade and not touch it once the trade is live.",
    "After two losses, I am done. I close the platform and I do not reopen it.",
    "After a big win, I trade the next day at my normal size, not my excited size.",
    "After any day I break my size rule, I trade half size for the next three days.",
    "I will never close a valid trade before my planned exit out of fear alone.",
    "I will never skip a setup that meets every rule I've written.",
    "I will never reduce my size below my plan just because I'm nervous.",
    "I will take the first valid setup of the day without waiting for a confirmation I didn't ask for.",
    "I will state my stop and target out loud before I enter, so the trade has a shape before it has a feeling.",
    "I will place my full planned size on every valid setup, not a smaller 'test' size.",
    "After a loss, I take the next valid setup at full planned size, not reduced size.",
    "After a scary day, I review the trades on paper before I decide anything about tomorrow.",
    "After three trades I hesitated on, I stop for the day rather than force a fourth.",
    "I will never enter a trade before my setup fully confirms.",
    "I will never take a trade outside my written strategy out of boredom.",
    "I will never open a new position within five minutes of closing one out of restlessness.",
    "I will read my entry checklist out loud before every trade, no exceptions.",
    "I will set a maximum number of trades for the day and stop the moment I hit it.",
    "I will wait for my setup's confirmation candle to fully close before I touch the entry button.",
    "After a loss, I wait a full fifteen minutes before I look at another chart.",
    "After I catch myself entering early, I close the trade and write down what I felt right before the click.",
    "After a day where I overtraded, the next day's maximum is cut in half.",
    "I will exit at my stop loss every time it is hit, without moving it.",
    "I will never add to a losing trade to avoid admitting I was wrong.",
    "I will never take a setup with 'my own tweak' when the plan already had one.",
    "I will write what the trade actually did, not what I meant it to do, every single day.",
    "I will take every setup exactly as my plan wrote it, with no personal tweak.",
    "I will ask one person to check my process weekly, and listen without defending it.",
    "After a loss, I write the honest reason in one sentence before I take another trade.",
    "After I catch myself defending a bad trade, I stop trading for the rest of the session.",
    "After being shown a real mistake, I say 'you're right' before I say anything else.",
    "I will never skip my journal, even on the days I don't want to look at it.",
    "I will never decide the plan is broken based on one bad week.",
    "I will never trade without doing my deed clause first.",
    "I will take one trade a day exactly to plan, regardless of mood.",
    "I will complete the daily review even on the days I don't want to look at it.",
    "I will message my witness before I make any decision about quitting.",
    "After a losing week, I bring it to my witness before I decide anything about quitting.",
    "After a day I wanted to skip, I still open the platform and write one honest line.",
    "After three red days in a row, I take the next day off on purpose, not out of hopelessness.",
    "I will pray every prayer on time, not just when it's convenient.",
    "I will read a page of Qur'an daily, even one page.",
    "I will say istighfar before my first trade of the day.",
    "I will leave backbiting, even when everyone else in the room is doing it.",
    "I will leave doom-scrolling trading Twitter after a loss.",
    "I will leave music in the car on the way to trade.",
  ].join("\n");

  const FIELDS = ["n", "h", "d", "r", "de", "le"];
  const SEP = "\x1F";

  function toUnicodeB64(str){
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
  }
  function fromUnicodeB64(b64){
    return decodeURIComponent(atob(b64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
  }
  function toUrlSafe(b64){ return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function fromUrlSafe(s){
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while(s.length % 4) s += "=";
    return s;
  }
  function bytesToUrlSafe(bytes){
    let bin = "";
    for(let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return toUrlSafe(btoa(bin));
  }
  function urlSafeToBytes(s){
    const bin = atob(fromUrlSafe(s));
    const bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function dictEncode(obj){
    const packed = FIELDS.map(k => String(obj[k] == null ? "" : obj[k]).replace(/\x1F/g, " ")).join(SEP);
    const bytes = pako.deflateRaw(new TextEncoder().encode(packed), {
      level: 9, dictionary: new TextEncoder().encode(DICT_V1),
    });
    return "d:" + bytesToUrlSafe(bytes);
  }
  function dictDecode(s){
    const out = pako.inflateRaw(urlSafeToBytes(s), {
      dictionary: new TextEncoder().encode(DICT_V1),
    });
    const parts = new TextDecoder().decode(out).split(SEP);
    const obj = {};
    FIELDS.forEach((k, i) => { obj[k] = parts[i] || ""; });
    return obj;
  }

  async function deflateToUrlSafe(str){
    const stream = new Blob([new TextEncoder().encode(str)]).stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    return bytesToUrlSafe(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  async function inflateFromUrlSafe(s){
    const stream = new Blob([urlSafeToBytes(s)]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new TextDecoder().decode(await new Response(stream).arrayBuffer());
  }

  async function encode(obj){
    const json = JSON.stringify(obj);
    const legacy = toUrlSafe(toUnicodeB64(json));
    let best = legacy;
    if(typeof CompressionStream !== "undefined"){
      try{
        const z = "z:" + await deflateToUrlSafe(json);
        if(z.length < best.length) best = z;
      }catch(_){}
    }
    if(typeof pako !== "undefined"){
      try{
        const d = dictEncode(obj);
        if(d.length < best.length) best = d;
      }catch(_){}
    }
    return best;
  }
  async function decode(str){
    if(str.slice(0, 2) === "d:") return dictDecode(str.slice(2));
    if(str.slice(0, 2) === "z:") return JSON.parse(await inflateFromUrlSafe(str.slice(2)));
    return JSON.parse(fromUnicodeB64(fromUrlSafe(str)));
  }
  return { encode, decode };
})();
