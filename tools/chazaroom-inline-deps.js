/* Vendor the two CDN <script src> tags into chazaroom.html, plus the zxing wasm
   the polyfill fetches at runtime.

   NOTE: the replacement MUST go through a replacer function. String.replace
   interprets $$ / $& / $` / $' inside a replacement STRING, and the minified
   polyfill contains emscripten's `e.$$.ptrType` — a plain string replace turned
   that into `e.$.ptrType` and spliced part of the document in, producing code
   that still looked plausible and failed to parse. A function replacer disables
   all $-substitution. This script verifies byte-equality afterwards regardless. */
const fs = require('fs');
const path = require('path');

const ASSETS = process.argv[2];
const TARGET = process.argv[3];

const qrjs = fs.readFileSync(path.join(ASSETS, 'qrcode.min.js'), 'utf8');
const poly = fs.readFileSync(path.join(ASSETS, 'polyfill.min.js'), 'utf8');
const wasm = fs.readFileSync(path.join(ASSETS, 'zxing_reader.wasm'));
const b64 = wasm.toString('base64');

const safe = s => s.split('</script').join('<\\/script');   // never close the tag early

const shim = `
/* ---- offline: the QR engine's wasm lives inside this file ----
   The barcode-detector polyfill fetches zxing_reader.wasm from a CDN the first
   time it decodes, so vendoring its JS alone would still leave the game dead
   without internet — and desktop Windows has no native BarcodeDetector to fall
   back on, so that means not one card is ever read.
   Its own setZXingModuleOverrides hook is unreachable in this build: the IIFE
   ends in })({}), throwing its exports away. So intercept the single fetch it
   makes. Installed before the polyfill loads. Only .wasm URLs are touched —
   every other fetch (the PTZ bridge) passes straight through untouched. */
(function(){
  "use strict";
  var B64="${b64}";
  var bytes=null;
  function wasmBytes(){
    if(!bytes){
      var bin=atob(B64), n=bin.length, u=new Uint8Array(n);
      for(var i=0;i<n;i++) u[i]=bin.charCodeAt(i);
      bytes=u;
    }
    return bytes;
  }
  var realFetch = typeof fetch==="function" ? fetch.bind(window) : null;
  window.fetch = function(input, init){
    var url = typeof input==="string" ? input : (input && input.url) || "";
    if(/\\.wasm(\\?|#|$)/i.test(url)){
      return Promise.resolve(new Response(wasmBytes(), {status:200, headers:{"Content-Type":"application/wasm"}}));
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("fetch unavailable"));
  };
})();
`;

const QR_HDR   = '/* vendored: qrcodejs 1.0.0 — card printing, was cdnjs */\n';
const POLY_HDR = '/* vendored: barcode-detector 3 polyfill — multi-QR detection, was jsdelivr */\n';

let html = fs.readFileSync(TARGET, 'utf8');
const before = html.length;

const cdnRe = /<script src="https:\/\/cdnjs\.cloudflare\.com[^"]*"><\/script>\s*<script src="https:\/\/fastly\.jsdelivr\.net[^"]*"><\/script>/;
if (!cdnRe.test(html)) { console.error('FAIL: CDN script tags not found'); process.exit(1); }

const replacement =
  '<script>' + shim + '</script>\n' +
  '<script>' + QR_HDR + safe(qrjs) + '\n</script>\n' +
  '<script>' + POLY_HDR + safe(poly) + '\n</script>';

html = html.replace(cdnRe, () => replacement);      // function form: no $-substitution
fs.writeFileSync(TARGET, html);

/* ---- verify byte-equality of what actually landed in the file ---- */
const out = fs.readFileSync(TARGET, 'utf8');
const blocks = [...out.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const got = { qr: null, poly: null };
blocks.forEach(b => {
  if (b.startsWith(QR_HDR))   got.qr   = b.slice(QR_HDR.length).replace(/\n$/, '');
  if (b.startsWith(POLY_HDR)) got.poly = b.slice(POLY_HDR.length).replace(/\n$/, '');
});
let ok = true;
[['qrcodejs', got.qr, qrjs], ['polyfill', got.poly, poly]].forEach(([name, a, b]) => {
  const same = a === b;
  if (!same) ok = false;
  console.log((same ? 'OK   ' : 'FAIL ') + name + ': embedded ' + (a ? a.length : 'MISSING') + ' B vs source ' + b.length + ' B');
});
blocks.forEach((b, i) => { try { new Function(b); } catch (e) { ok = false; console.log('FAIL block ' + i + ' does not parse: ' + e.message.slice(0, 80)); } });
console.log('wasm inlined  : ' + wasm.length + ' B -> ' + b64.length + ' B base64');
console.log('chazaroom.html: ' + before + ' -> ' + out.length + ' B');
console.log('<script src>  : ' + (out.match(/<script src=/g) || []).length);
process.exit(ok ? 0 : 1);
