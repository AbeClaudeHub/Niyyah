/* Niyyah — compact, URL-safe encode/decode for the personal daily-page
   link. Everything happens client-side; the hash fragment is never sent
   to a server, so this is the only "sync" mechanism the site needs. */

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
  function encode(obj){
    return toUrlSafe(toUnicodeB64(JSON.stringify(obj)));
  }
  function decode(str){
    return JSON.parse(fromUnicodeB64(fromUrlSafe(str)));
  }
  return { encode, decode };
})();
