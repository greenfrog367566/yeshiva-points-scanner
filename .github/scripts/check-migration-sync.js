// test-migration.html keeps its own copies of migrateData()/load2fix() that
// must stay logically identical to app.html's. Compares normalized (comments
// and whitespace stripped) since the harness's copies sit at column 0 while
// app.html's are indented inside the IIFE — a byte-for-byte diff is noise.
const fs = require("fs");

function grab(f, n) {
  const t = fs.readFileSync(f, "utf8");
  const i = t.indexOf("function " + n + "(");
  let d = 0, s = t.indexOf("{", i), j = s;
  for (; j < t.length; j++) {
    if (t[j] === "{") d++;
    else if (t[j] === "}") { d--; if (!d) { j++; break; } }
  }
  return t.slice(s, j);
}

function norm(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s+/g, " ").trim();
}

let bad = false;
["migrateData", "load2fix"].forEach(n => {
  const a = norm(grab("app.html", n));
  const b = norm(grab("test-migration.html", n));
  const ok = a === b;
  if (!ok) bad = true;
  console.log(n.padEnd(12) + (ok ? "IN SYNC" : "DIFFERS — app " + a.length + " chars / harness " + b.length));
});

if (bad) process.exit(1);
