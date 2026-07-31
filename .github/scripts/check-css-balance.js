// Brace balance is informational only — app.html's baseline gap is non-zero
// (braces inside content strings, not real imbalance) and shifts legitimately
// with unrelated content changes, so it isn't a reliable pass/fail signal here.
//
// Comment-delimiter balance IS a hard gate: a stray */ or an unclosed /*
// silently drops the rest of the stylesheet with no error anywhere else —
// brace balance is blind to it, and so is the JS syntax check, so this is
// the only thing that catches it.
const fs = require("fs");

const t = fs.readFileSync("app.html", "utf8");
const s = t.slice(t.indexOf("<style"), t.lastIndexOf("</style>"));

const o = (s.match(/{/g) || []).length;
const c = (s.match(/}/g) || []).length;
console.log("CSS braces: " + o + " open / " + c + " close (gap " + (o - c) + ", informational only)");

const co = (s.match(/\/\*/g) || []).length;
const cc = (s.match(/\*\//g) || []).length;
console.log("CSS comments: " + co + " open / " + cc + " close — " + (co === cc ? "balanced" : "UNBALANCED"));

if (co !== cc) {
  console.log("FAIL — unbalanced CSS comment delimiters");
  process.exit(1);
}
