---
name: validate
description: Run the pre-commit checks for app.html — JS syntax (per script block), CSS brace-balance and comment-delimiter balance, and migrateData()/load2fix() sync with test-migration.html. Python is not installed and node --check fails on .html files, so use these node-only commands.
---

**Python is NOT installed on this machine, and `node --check app.html` fails on
Node 24** (`ERR_UNKNOWN_FILE_EXTENSION` — it refuses `.html` outright, so it can
never pass and tells you nothing). Use these node-only commands instead; all three
are verified working as of 2026-07-27 on Node v24.18.0.

```bash
# 1. JavaScript syntax check — parses each <script> block on its own.
#    This also sidesteps the old `Win + X` false positive from the embedded
#    Apps Script template.
node -e "
const fs=require('fs'),vm=require('vm');
const blocks=[...fs.readFileSync('app.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let bad=0;
blocks.forEach((b,i)=>{try{new vm.Script(b)}catch(e){bad++;console.log('SYNTAX ERROR in script #'+(i+1)+': '+e.message)}});
console.log(bad?'FAIL':'JS OK — '+blocks.length+' script blocks parsed');
"
```
Expect `JS OK — 3 script blocks parsed`.

```bash
# 2. CSS brace-balance AND comment-delimiter check (if you touched styles)
node -e "
const t=require('fs').readFileSync('app.html','utf8');
const s=t.slice(t.indexOf('<style'),t.lastIndexOf('</style>'));
const o=(s.match(/{/g)||[]).length,c=(s.match(/}/g)||[]).length;
console.log('CSS braces: '+o+' open / '+c+' close (gap '+(o-c)+')');
const co=(s.match(/\/\*/g)||[]).length,cc=(s.match(/\*\//g)||[]).length;
console.log('CSS comments: '+co+' open / '+cc+' close — '+(co===cc?'balanced':'UNBALANCED'));
"
```
**Current baseline gap is `2`** (braces inside content strings, not real
imbalance). A gap that stays 2 is fine; a *change* in the gap after your edit is not.

**Comment delimiters must be exactly equal — there is no baseline offset.**
A stray `*/` (or a `/*` that never closes) **silently kills every rule after it**:
the browser swallows the rest of the stylesheet as an unterminated comment or as
garbage, and the app renders with a chunk of its CSS simply absent. This has
already shipped once as a wrapped, broken scan bar.

It is worth its own check because **nothing else catches it.** Brace balance is
blind to it — a stray `*/` adds no braces, so the gap stays at 2. `node -e` on
the script blocks is blind to it — the CSS isn't JavaScript. Both checks pass,
green, on a stylesheet that is half dead. The failure mode is *visual only*, so
if the edit was CSS-heavy, look at the rendered page as well as the counts.

This is the single most common way to break styles while editing the long
explanatory comments this file is full of: paste a block near an existing `*/`
and it is easy to end up with the prose outside the comment and the terminator
orphaned after it.

```bash
# 3. If you touched migrateData()/load2fix(), confirm test-migration.html matches.
#    Compares normalized (comments + whitespace stripped) — the harness's copies
#    sit at column 0 while app.html's are indented inside the IIFE, so a
#    byte-for-byte diff is always noise.
node -e "
const fs=require('fs');
const grab=(f,n)=>{const t=fs.readFileSync(f,'utf8');const i=t.indexOf('function '+n+'(');
  let d=0,s=t.indexOf('{',i),j=s;
  for(;j<t.length;j++){if(t[j]==='{')d++;else if(t[j]==='}'){d--;if(!d){j++;break}}}
  return t.slice(s,j)};
const norm=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'').replace(/\s+/g,' ').trim();
['migrateData','load2fix'].forEach(n=>{
  const a=norm(grab('app.html',n)),b=norm(grab('test-migration.html',n));
  console.log(n.padEnd(12)+(a===b?'IN SYNC':'DIFFERS — app '+a.length+' chars / harness '+b.length));
});
"
node --check sw.js          # if you touched the service worker (.js — works fine)
```
Then open `test-migration.html` in a browser and confirm every scenario passes — including "Corrupted data".
