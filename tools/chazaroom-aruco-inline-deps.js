/* Vendor js-aruco2's three <script src> CDN tags into chazaroom-aruco-test.html.
   Same pattern as chazaroom-inline-deps.js (see that file for the $-substitution
   trap this also guards against) but simpler: js-aruco2 is plain JS, no WASM
   fetched at runtime, so there's no fetch-intercept shim to install — inlining
   the three files verbatim is the whole job. */
const fs = require('fs');
const path = require('path');

const ASSETS = process.argv[2];
const TARGET = process.argv[3];

const cv = fs.readFileSync(path.join(ASSETS, 'cv.js'), 'utf8');
const aruco = fs.readFileSync(path.join(ASSETS, 'aruco.js'), 'utf8');
const dict = fs.readFileSync(path.join(ASSETS, 'aruco_4x4_1000.js'), 'utf8');

const safe = s => s.split('</script').join('<\\/script');   // never close the tag early

const CV_HDR   = '/* vendored: js-aruco2 2.0.0 src/cv.js — MIT, github.com/damianofalcioni/js-aruco2, was jsDelivr */\n';
const ARUCO_HDR = '/* vendored: js-aruco2 2.0.0 src/aruco.js — MIT, was jsDelivr */\n';
const DICT_HDR = '/* vendored: js-aruco2 2.0.0 src/dictionaries/aruco_4x4_1000.js — MIT, was jsDelivr */\n';

let html = fs.readFileSync(TARGET, 'utf8');
const before = html.length;

const cdnRe = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/js-aruco2@2\.0\.0\/src\/cv\.js"><\/script>\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/js-aruco2@2\.0\.0\/src\/aruco\.js"><\/script>\s*((?:<!--[\s\S]*?-->\s*)?)<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/js-aruco2@2\.0\.0\/src\/dictionaries\/aruco_4x4_1000\.js"><\/script>/;
if (!cdnRe.test(html)) { console.error('FAIL: js-aruco2 CDN script tags not found'); process.exit(1); }

html = html.replace(cdnRe, (match, keptComment) =>
  '<script>' + CV_HDR + safe(cv) + '\n</script>\n' +
  '<script>' + ARUCO_HDR + safe(aruco) + '\n</script>\n' +
  keptComment +
  '<script>' + DICT_HDR + safe(dict) + '\n</script>'
);   // function form: no $-substitution
fs.writeFileSync(TARGET, html);

/* ---- verify byte-equality of what actually landed in the file ---- */
const out = fs.readFileSync(TARGET, 'utf8');
const blocks = [...out.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const got = { cv: null, aruco: null, dict: null };
blocks.forEach(b => {
  if (b.startsWith(CV_HDR))    got.cv    = b.slice(CV_HDR.length).replace(/\n$/, '');
  if (b.startsWith(ARUCO_HDR)) got.aruco = b.slice(ARUCO_HDR.length).replace(/\n$/, '');
  if (b.startsWith(DICT_HDR))  got.dict  = b.slice(DICT_HDR.length).replace(/\n$/, '');
});
let ok = true;
[['cv.js', got.cv, cv], ['aruco.js', got.aruco, aruco], ['aruco_4x4_1000.js', got.dict, dict]].forEach(([name, a, b]) => {
  const same = a === b;
  if (!same) ok = false;
  console.log((same ? 'OK   ' : 'FAIL ') + name + ': embedded ' + (a ? a.length : 'MISSING') + ' B vs source ' + b.length + ' B');
});
blocks.forEach((b, i) => { try { new Function(b); } catch (e) { ok = false; console.log('FAIL block ' + i + ' does not parse: ' + e.message.slice(0, 80)); } });
console.log('chazaroom-aruco-test.html: ' + before + ' -> ' + out.length + ' B');
console.log('<script src>              : ' + (out.match(/<script src=/g) || []).length);
process.exit(ok ? 0 : 1);
