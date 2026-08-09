# Menchmark Positioning & Copy Decisions

Settled decisions about how Menchmark describes itself in user-facing copy.
A reference list, not an essay — check it before writing or editing copy.

**Scope — "user-facing copy" means:** `app.html` (UI strings, help/About),
`beta.html`, `index.html`, `intro.html`, `quick-start.html`, `setup.html`, and
`docs/user-guide.md`. Internal docs (`CLAUDE.md`, `README.md`, `CHANGELOG.md`,
the spec docs) are not bound by these rules.

---

## 1. Canonical self-description

> A classroom assistant for Yeshiva and Jewish Day School rebbeim.

The authoritative wording lives in `index.html`'s `<meta name="description">`.
Other surfaces should match it rather than invent their own phrasing.

When listing what the app covers, the settled list is **middos and derech
eretz, attendance, homework, and learning**. Don't claim the Gradebook until
the Gradebook screen ships — Phase 2a landed the data shell only, and
`index.html` still marks it Coming soon.

## 2. "Classroom economy" is not Menchmark's positioning

Never use it as the app's self-description. It frames points and prizes as the
purpose, which is both off-positioning and an undersell.

**Permitted exception:** `index.html`'s Shulchani Mode paragraph ("Run a full
classroom economy — coins, denominations, a store — if that's your style. Or
keep it simple."). There it accurately scopes one optional mode among several
and is immediately qualified. Leave it.

## 3. Say "rebbeim," not "teachers"

In user-facing copy, the audience is rebbeim.

## 4. No licensing or free-forever language in user-facing copy

Pending the licensing/ownership decision, none of the following appear in
user-facing copy:

- "free forever"
- "open source" / "open-source"
- "MIT" / "MIT License" / "MIT Licensed"

**Permitted exception:** `app.html`'s AI text-import prompt instructs the model
to use "a reliable open source such as Sefaria, he.wikisource.org, or
Mechon-Mamre." That is a different sense of the words — an openly available
*text* source, not software licensing. Leave it.

**The repo's `LICENSE` file is a separate question and is deliberately
untouched by this rule.** So are the MIT references in `README.md` and
`CHANGELOG.md`. This rule governs what a rebbi reads in the product, not how
the project is licensed.

Authorship credit ("Built with ❤️ by Rabbi B. Steinerman") and links to the
GitHub repo are kept — nothing about who wrote Menchmark or where it lives is
being hidden.

## 5. Avoid AI framing in rebbi-facing copy

Say **"automatic"** rather than naming AI, machine learning, or models. This
applies to copy a rebbi reads; it does not change what the features do or how
they are described in internal docs.

---

*Recorded 2026-07-27, capturing decisions previously settled only in
conversation. See also CLAUDE.md § DECISION RECORD.*
