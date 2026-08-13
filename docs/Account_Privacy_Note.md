# Account privacy note — DRAFT for Ben

**Status: DRAFT, not published, not linked anywhere.** This is the plain-language
privacy note owed under `docs/Data_Custody_Decision.md` Q3's "smaller sibling" —
the one that gates **any** self-serve signup in **either** tier, including Ben's
own school. It is deliberately not the school agreement; that is Q3 proper and is
a different, longer document with a different audience.

**Two parts below.** Part 1 is the note itself, written to be read by a rebbi and
ready to become a page once approved. Part 2 is **not for publication** — it is
what still needs your answer, what I could not verify, and the judgment calls I
made that you may want to overrule.

Everything in Part 1 was checked against the code or the settled docs. **The six
blanks were decided by Ben on 2026-08-13 and are filled in** (see Part 2, section
A, for each decision and its rationale); the only remaining placeholder is the
publication date. `privacy@menchmark.app` is live, forwarding to Ben's Gmail
(Cloudflare Email Routing, set up and delivery-tested 2026-08-13).

---
---

# Part 1 — the note

## Your Menchmark account, and what happens to your information

Menchmark asks you to sign in. This page explains exactly what that means: what
is kept about you, where your class's information actually lives, who can see it,
and how to have it removed. It is written to be read once, in full, in a few
minutes.

If anything here is unclear, ask — **privacy@menchmark.app**. A privacy note you
have to interpret is not doing its job.

### What we keep about you

When you sign in, Menchmark stores a small record about **you**:

- your **email address**, as given by Google when you sign in
- your **name**, as given by Google
- **which school**, if any, your account belongs to
- **when the account was created**, and **when you last signed in**

That is the whole list. There is no password — signing in goes through Google, so
Menchmark never sees, stores, or could reveal one.

**Signing in with Google means Google knows you use Menchmark**, the same way it
knows about any other site you sign into with it. Menchmark does not receive your
Google password, your contacts, your other email, or anything in your Google
account beyond your name and email address.

### Where your class's information lives — this depends on your school

This is the part that differs between rebbeim, and it is the part worth reading
carefully.

**If your school uses Menchmark together with us**, your class's information —
your boys' names, their points, attendance, homework, notes — is stored on
Menchmark's servers, so it is safe if a device is lost and reaches you on any
device you sign in on. **Your school can see it**, which is the point of a school
account, and the next section says precisely who.

**If you signed up on your own, without a school**, your class's information
**stays on your own computer** and in **your own Google Drive**, and does not come
to us at all. Not names, not scores, not photos, not notes. What we keep about
you is the short list in the section above, and nothing else. The backup written
to your Drive is **yours** — in your account, in a folder you can open, delete, or
move like any other file. Menchmark can only see the backup files it created
itself; it cannot read the rest of your Drive.

### Who can see your class

Being honest about this matters more than making it sound reassuring.

**If your school uses Menchmark together with us:**

- **Your menahel or administrator can see the Class Book** — attendance,
  homework, and recognition. That is deliberate: it is the oversight a school
  account is for.
- **The Teacher's Book stays private.** Your own notes are not visible to your
  administration unless **you** choose to share a specific item or the whole
  book. Private notes stop being honest the moment they are read by default.
- **Menchmark's administrator can open your account to help you.** When you
  report a problem, he can look at what you are actually seeing rather than
  guessing from an email. **Every such session is recorded, and your own
  settings show when your account was last opened for support** — it never
  happens without a trace you can see.
- **Other rebbeim cannot see your class.** This is enforced by the server, not
  by the screen — the request simply fails, so no mistake in the app can expose
  one class to another rebbi.

**If you signed up on your own:** nobody at Menchmark can see your class, because
no copy of it exists on our side. We can see **that** your account exists and when
you last signed in — nothing more. It also means **we cannot recover your class
for you** if you lose the device and have no backup, which is exactly why
Menchmark keeps reminding you to keep one.

### What we never do

- **We never sell your information, and we never share it for advertising.**
- **We do not track you.** Menchmark has no analytics, no advertising code, and
  no third-party tracking of any kind — not on the app, not on the website. This
  is a plain fact about the code, not an intention.
- **We do not email you** except about Menchmark itself.
- **We do not use your class's information to build anything else.**

### The two places information leaves the app, so you know about both

- **If you connect a Google Sheet** (the older backup method), your class's
  information is written to **your own** Sheet in **your own** Google account.
- **If you use the automatic text import** to fetch pesukim or mishnayos,
  Menchmark sends **only the text request** — which parsha, which perakim — to
  an outside text service. **No student information is ever included**, and the
  feature is optional.

### Removing your account

**Ask at privacy@menchmark.app and your account record will be deleted within
30 days.** You do not have to give a reason.

Two things worth being clear about, because people are often surprised by them
afterwards:

- **If you signed up on your own**, deleting your account removes the short
  record described above. It does **not** touch your class — that is on your own
  computer and in your own Drive, and stays there until you remove it yourself.
- **If your school uses Menchmark together with us**, your class's information
  belongs to the school, so a request to delete **class** information goes
  through the school rather than through you alone. Your own account record is
  still yours to remove at any time.

You can also ask for a copy of everything held about you, at the same address.

### If something goes wrong

If information is ever exposed in a way it should not be, **we will tell the
people affected, and the school, within 72 hours of learning of it** — rather
than hope it goes unnoticed.

### Where this information is kept

Your account record, and class information for school accounts, is kept on
Google's servers **in the United States** using Google Firebase.

### Children's information

For schools using Menchmark together with us, your boys' information is held
**on the school's behalf**, under the agreement between Menchmark and the
school. If you are a menahel or administrator and want that agreement, ask at
**privacy@menchmark.app**.

### Changes to this page

If this changes in a way that affects what is kept about you or who can see it,
you will be told in the app rather than only on this page.

*Last updated: [DATE ON PUBLICATION]*

---
---

# Part 2 — NOT FOR PUBLICATION: what this draft needs from you

## A. The six blanks — ALL DECIDED by Ben, 2026-08-13. Part 1 is filled in.

1. **Contact email: `privacy@menchmark.app`.** A dedicated address, not a
   personal one, so it survives the day someone else answers it.
   **The address is live and tested as of 2026-08-13:** a Cloudflare Email
   Routing rule forwards it to Ben's Gmail, alongside the existing berel@ /
   feedback@ / beta@ / support@ rules, and a test message was delivered
   successfully. Nothing remains on this item.
2. **Deletion window: 30 days.** The ordinary answer, easy to honor given the
   record is one document, with margin for a person to reliably act.
3. **Legal identity: an entity will be formed before launch.** None exists
   today. The note stays "Menchmark" throughout (correct either way), and Q3's
   school agreement waits on the entity — it names the party a school agrees
   with, so it cannot be finalized first.
4. **View-as: logged AND shown to the rebbi.** Every view-as session is
   recorded server-side (a `viewAsLog` collection), and the rebbi's own
   settings show when his account was last opened for support. The note's
   sentence now promises this, which makes it a **build requirement for the
   Firebase rebuild** — carry it into the step-1 data-model session. Server-side
   logging is today's industry baseline (SOC 2 expects it); the visible
   settings line is the trust tier above it. Consent-gated access (the ed-tech
   gold standard) can still be added later without breaking this promise.
5. **Breach notification: 72 hours.** The standard commitment. Q3's school
   agreement must use the same number — decided once here, reuse it there.
6. **Firestore region: `nam5` (US multi-region).** Highest durability, still
   plainly "in the United States" for the note. Set this at project creation —
   it is effectively permanent afterwards.

## B. Three judgment calls I made that you may want to reverse

**1. I disclosed the AI text import, despite Positioning §5.** That rule says to
say "automatic" rather than naming AI in rebbi-facing copy, and this note follows
it in wording — it says "automatic text import" and "an outside text service,"
never "AI." But it **does** disclose that text leaves the app to a third party,
because a privacy note that hides a data flow behind a softer word is not a
privacy note. I believe this respects both the rule and the point of the
document, but you should confirm, and if you agree it may be worth recording as a
noted exception in `Positioning.md` so nobody "fixes" it later.

**2. I described the tiers without ever using the words "tier 1" and "tier 2."**
A rebbi does not know he is in a tier, and telling him he is in the second one is
a bad first impression of a product he just joined. The note says "if your school
uses Menchmark together with us" and "if you signed up on your own." This costs
nothing in precision and reads far better. Internal docs keep the tier language.

**3. I stated the tier-2 downside out loud** — that we cannot recover your class
for you. It is the honest counterweight to "your data never leaves your device,"
and a rebbi who discovers it only after losing a device is a rebbi who was misled
by omission. It also does real work for you: it is the strongest argument the
backup nudge has.

## C. What I verified rather than assumed

- **No analytics or telemetry anywhere.** Checked `app.html`, `index.html`,
  `intro.html`, `quick-start.html`, `setup.html`, `beta.html` and `sw.js` for
  Google Analytics, Tag Manager, Plausible, Mixpanel, Sentry, PostHog and Fathom
  — **zero matches in all seven files.** This is why the note states it as a fact
  about the code. **If anything is ever added, this sentence must change first.**
- **The AI proxy receives only the prompt.** `app.html:16034` posts
  `{prompt: promptText}` and nothing else — no roster, no scores, no identifiers.
- **The account record's fields** are exactly as listed in
  `Universal_SignIn_Proposal.md` (email, display name, tier, `schoolId`,
  created-at). **I added "when you last signed in"** because the settled scope
  includes a superadmin activity overview showing "who's active, who hasn't
  touched it since the invite," which cannot work without storing it. If that
  overview is cut, remove the line.
- **`drive.file` scope** means the app can only see files it created — which is
  why the note can promise it cannot read the rest of your Drive.
- **Admin sees the Class Book, Teacher's Book private unless shared**, from the
  settled "Gradebook visibility for admin" decision.

## D. What I did not do, on purpose

- **No `privacy.html` page.** This is user-facing copy of the kind that is hard
  to walk back once published, so the wording gets your approval before it gets
  a URL. When it does ship it needs a link from Help → About, from the sign-in
  screen itself (before the button, not after), and from `index.html`'s footer.
- **No Q3 school agreement.** Different audience, different document, and it is
  explicitly the one question the custody decision left with you rather than
  giving a recommendation.
- **Nothing about students or parents reading this.** The audience is the rebbi
  signing in. A student-facing or parent-facing notice is a separate question and
  belongs with Q3.
