/* Niyyah — compact, URL-safe encode/decode for the personal daily-page
   link. Everything happens client-side; the hash fragment is never sent
   to a server, so this is the only "sync" mechanism the site needs.

   Links come in two formats:
     - "z:" + base64url(deflate-raw(JSON))  — compressed, the default when
       the browser has CompressionStream. Roughly half the length.
     - base64url(JSON)                      — legacy. Still produced when
       compression is unavailable, and always accepted on decode, so links
       pinned before compression existed keep working forever.
   encode() and decode() are async either way. */

const DailyLink = (function(){
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

  async function deflateToUrlSafe(str){
    const stream = new Blob([new TextEncoder().encode(str)]).stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = "";
    for(let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return toUrlSafe(btoa(bin));
  }
  async function inflateFromUrlSafe(s){
    const bin = atob(fromUrlSafe(s));
    const bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new TextDecoder().decode(await new Response(stream).arrayBuffer());
  }

  async function encode(obj){
    const json = JSON.stringify(obj);
    const legacy = toUrlSafe(toUnicodeB64(json));
    if(typeof CompressionStream === "undefined") return legacy;
    try{
      const packed = "z:" + await deflateToUrlSafe(json);
      return packed.length < legacy.length ? packed : legacy;
    }catch(_){
      return legacy;
    }
  }
  async function decode(str){
    if(str.slice(0, 2) === "z:") return JSON.parse(await inflateFromUrlSafe(str.slice(2)));
    return JSON.parse(fromUnicodeB64(fromUrlSafe(str)));
  }
  return { encode, decode };
})();
