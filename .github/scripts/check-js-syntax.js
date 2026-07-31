// Parses each <script> block in app.html on its own, catching exactly the
// class of bug that took the live app down on 2026-07-31: a merge conflict
// resolution that left invalid JS in one script block, which stops that
// entire block — and everything after it — from running.
const fs = require("fs");
const vm = require("vm");

const blocks = [...fs.readFileSync("app.html", "utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let bad = 0;
blocks.forEach((b, i) => {
  try { new vm.Script(b); }
  catch (e) { bad++; console.log("SYNTAX ERROR in script #" + (i + 1) + ": " + e.message); }
});

if (bad) {
  console.log("FAIL");
  process.exit(1);
}
console.log("JS OK — " + blocks.length + " script blocks parsed");
