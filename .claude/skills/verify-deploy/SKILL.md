---
name: verify-deploy
description: Verify a merge actually reached the live site at menchmark.app. Use after a PR merges, or whenever asked whether a fix is live — the deploy has silently served a stale build for days while every check was green, and a naive check returns a false negative if run too soon.
---

# Verifying a deploy reached menchmark.app

**Live site:** `menchmark.app`, served by a **Cloudflare Pages project** built
from `main` — *not* GitHub Pages. GitHub Pages is still enabled and also builds
from `main`, so `greenfrog367566.github.io/yeshiva-points-scanner` resolves and
serves the same content, but it is **not** what rebbeim use.

## Timing

Merging to `main` reaches `menchmark.app` on its own. It takes **about a
minute**: measured on the #155 merge, GitHub Pages rebuilt 38 seconds after the
merge commit and `menchmark.app` was serving the new content inside two minutes.
Fast, but *not* instant — don't promise a rebbi a fix has landed until you have
loaded the page and seen it.

## Why this check exists

**The deploy has failed silently before, and this is the thing to actually worry
about.** The Cloudflare project was once disconnected from the repo and kept
serving its last build for days — `main` was healthy, GitHub Pages was current,
every check was green, and rebbeim were running a build from 13 merges earlier.
Nothing in this repo reports that state. **After a merge that matters, verify
against the live site rather than assuming.**

## The check

```bash
# does the deployed app actually contain the thing you just merged?
# grep -c, never grep -o: -c prints a number either way, so a miss is a visible
# 0. -o prints nothing at all on a miss, and silent failure reads as success.
curl -s https://menchmark.app/app.html | grep -c 'someIdentifierFromYourChange'
```

## WAIT A MINUTE FIRST, AND RE-RUN BEFORE CONCLUDING ANYTHING

A `0` from that command is ambiguous three ways — *not deployed yet*, *deploy
stalled*, and *you checked too fast* all look identical, and the last one is the
common case. This has already caught someone: a check run about a minute after
the #155 merge returned `0`, and the same command a minute later returned `10`.

The result only means something read against the merge timestamp, so get that
first and give it a minute before believing a zero:

```bash
gh pr view <n> --json mergedAt
```

## After a release

`sw.js` serves HTML network-first, so once a deploy is out it reaches installed
users immediately; bump `CACHE_VERSION` in `sw.js` on a release to purge the
stale *offline* copy.
