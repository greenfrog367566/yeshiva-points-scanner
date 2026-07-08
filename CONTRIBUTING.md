# Contributing

Thanks for wanting to improve the app. A few simple rules keep this project from turning into "several good files floating around" again.

## The core rule: nobody edits `main` directly

- `main` is always the stable, official version.
- Every change — yours, Rabbi Steinerman's, or an outside contributor's — goes through a **branch** and a **pull request (PR)**.
- Changes are merged into `main` only after review.

This is what stops one person's update from silently overwriting someone else's work.

## Roles

| Role | Can do |
|---|---|
| Maintainers (you + Rabbi Steinerman) | Review and merge PRs, publish releases, manage branch protection |
| Trusted contributors | Push branches to this repo, open PRs |
| Everyone else | Fork the repo, open PRs from their fork, open issues |

## Workflow

1. **Create a branch** off `main`, named `yourname/short-description`:
   ```
   git checkout -b levi/activity-filters
   ```
2. **Make your changes** in that branch only.
3. **Test locally** — just open `index.html` in a browser and click through the feature you changed. Check that:
   - Existing features still work (Scan, Raffle, QR labels, Sheets sync, Backup/Restore, Settings)
   - Nothing in `localStorage` gets wiped when the app loads
4. **Commit and push** your branch:
   ```
   git add .
   git commit -m "Add activity filters to Scan and QR tabs"
   git push origin levi/activity-filters
   ```
5. **Open a pull request** into `main`. In the description, note:
   - What changed and why
   - Whether the data format changed (see below)
   - How you tested it
6. A maintainer reviews and merges. After merge, delete the branch.

## The most important technical rule: don't break people's saved data

Every teacher's roster, scores, and history live in **their own browser's `localStorage`** (or their own Google Sheet). An app update must never silently erase or corrupt that.

Rules for any change that touches the data structure:

- **Never remove or rename an existing field** without a migration step.
- **Add new fields with safe defaults** so old saved data still loads correctly.
- If you do need to change the shape of stored data, add a version number and a migration function, e.g.:

  ```js
  var DATA_VERSION = 2;

  function migrateData(data) {
    if (!data.version) data.version = 1;

    if (data.version === 1) {
      // add new fields without deleting old data
      data.activityFilters = data.activityFilters || {};
      data.version = 2;
    }

    return data;
  }
  ```

- Run `migrateData()` once on load, before anything else touches `data`.

## Never commit real data

Do not commit, in any PR:
- Real student names, scores, or raffle history
- A real Google Sheet URL
- Any school-identifying information

Use `sample-backup.json` (placeholder/demo data only) if you need a backup file for testing.

## Using AI tools (ChatGPT, Claude, etc.) to write code for this project

Don't hand an AI your whole file and say "improve it." Instead, give it scoped instructions like:

```
I am working in the GitHub repo <repo-name>, on branch levi/activity-filters.

Goal: Add activity filters to the Scan tab and QR Codes tab.

Rules:
- Do not remove existing features.
- Do not change the data format unless necessary.
- If changing the data format, add a migration function per CONTRIBUTING.md.
- Preserve existing localStorage data.
- Show me exactly which files/sections to change.
- Explain how to test it.
```

Ask for a diff/patch rather than a full rewritten file whenever possible — it's much easier to review.

## Reporting bugs / suggesting features

Open a GitHub Issue. Include:
- What you expected to happen
- What actually happened
- Browser and device (e.g. "Chrome on Windows laptop," "Safari on iPad")
- Steps to reproduce, if it's a bug
