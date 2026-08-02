# Career Command Center

A personal operating system for the 24-month plan in `current_analysis.txt` — the
executive career audit that benchmarks you against Tier-1 product roles and sets out
what closing the gap actually requires.

Every score, target, KPI, project and warning in this app traces back to that
document. Nothing here is invented filler.

```bash
npm install
npm run seed     # writes the 18 JSON files into data/ (skips any that exist)
npm run dev      # http://localhost:5273
```

> ## ⚠ Privacy — this repository must stay private
>
> `data/` and `current_analysis.txt` are committed on purpose, so the repo doubles
> as version history for real progress. That means it contains:
>
> - the candid audit, including which roles you are **not** yet competitive for
> - `data/networking.json` — **named real people** with private notes about them
> - `data/journal.json` — personal reflections
> - `data/profile.json` — salary bands and positioning
> - `data/skills.json` — self-assessed weaknesses
>
> Making this public would work directly against the professional brand the plan
> is trying to build, and would expose third parties who never consented. Note
> that public pushes are irreversible in practice — forks, clones and search
> caches survive deletion.
>
> **To make it public**, first strip the personal data: add `data/` and
> `current_analysis.txt` to `.gitignore`, then purge them from history (they stay
> in old commits otherwise). A fresh repo from a clean tree is usually simpler.
> Anyone cloning can run `npm run seed` to generate their own copy.

---

## The one idea worth understanding

The audit's central finding is not that you lack capability. It is that you lack
**proof**:

> Large companies hire demonstrated impact—not capability.

So the readiness score is deliberately **not** an average of your sixteen competency
scores. That number is 79 today, and it would be a flattering, useless headline.
Instead the score blends four pillars:

| Pillar         | Weight | What it measures                                              |
| -------------- | -----: | ------------------------------------------------------------- |
| **Competency** |    55% | Weighted skill scores — what you can do                        |
| **Evidence**   |    25% | Published artefacts, articles, quantified outcomes — the proof |
| **Interview**  |    12% | Mock volume, average score, coverage across the nine tracks    |
| **Presence**   |     8% | Relationship strength, referrals secured, public reach         |

That puts you at **48** rather than 79 — the honest reading of "already competitive
for mid-size SaaS, not yet competitive for Tier 1." It also means the number moves
fastest when you *publish something*, which is exactly the behaviour the audit is
trying to produce.

The formula lives in [`src/lib/derive.ts`](src/lib/derive.ts) (`PILLAR_WEIGHTS`) and is
mirrored in [`tooling/seed/analytics.mjs`](tooling/seed/analytics.mjs) so historical
snapshots sit on the same scale. Change both together.

---

## Where your data lives

Eighteen JSON files in [`data/`](data/). No server, no database, no account.

The app reaches them through one of three adapters, tried in order — see
[`src/lib/persistence.ts`](src/lib/persistence.ts):

1. **JSON file bridge** *(what you get with `npm run dev`)*
   A ~150-line Vite middleware ([`tooling/json-file-bridge.ts`](tooling/json-file-bridge.ts))
   that reads and writes `data/*.json` directly. No prompts, no configuration. It
   holds no business logic and no state — it is a file bridge, not an API.
   Writes are atomic (temp file + rename), so a crash mid-save cannot truncate a
   good file.

2. **File System Access API** *(for a built, statically-hosted copy)*
   Grant access to the `data` folder once from Settings → Data. The handle is kept
   in IndexedDB and writes are automatic from then on. Chromium browsers only.

3. **localStorage** *(always active, as a mirror)*
   Written to on every save regardless of which adapter is primary. If a disk write
   fails, the work still survives a reload.

Saves are **per-file and debounced** — editing a task rewrites `roadmap.json` alone,
and two rapid edits collapse into one write. The sidebar footer and the topbar both
show pending-write state; `⌘S` / `Ctrl+S` flushes immediately.

Settings → Data also has one-file backup and restore, and lists exactly which files
have unsaved changes.

---

## What is in here

| Section              | What it answers                                                                 |
| -------------------- | ------------------------------------------------------------------------------- |
| **Dashboard**        | Where am I, how far have I come, what should I do next                           |
| **Learning Path**    | The 24 months as a tree: 24 chapters → 57 missions → 180 tasks → 655 subtasks     |
| **Career Roadmap**   | Timeline, dependencies, monthly load vs capacity, compensation bands             |
| **Skills**           | The sixteen competencies: scores, evidence, weak areas, improvement plans        |
| **Readiness**        | The score decomposed — four pillars, every driver, where the missing points are  |
| **Reading**          | Books, articles, papers; the six core interview resources tracked separately     |
| **Courses**          | Ranked by ROI *per hour*; flags any course with no artefact attached             |
| **Portfolio**        | The seven highest-ROI projects, each with the full eleven-section narrative      |
| **Case Studies / AI Projects** | Focused views of the same collection                                   |
| **Writing**          | The one-article-a-month cadence, as a board and as a burn-up                     |
| **Interview Prep**   | 56-question bank across nine tracks, plus the mock log and score trend           |
| **Networking**       | Contacts by relationship strength, what is due, events                           |
| **LinkedIn**         | Growth, weekly cadence, content calendar, positioning                            |
| **Applications**     | Pipeline by stage, targets by tier, referral rate as the headline metric         |
| **Analytics**        | Hours, velocity, consistency, burndown, skill growth, projected completion       |
| **Highest Leverage** | The 80/20 table, sortable; the ignore list; the time budgets                     |
| **Achievements**     | 54 achievements and 8 progressive badges, all unlocked by evidence               |
| **Progress**         | Weekly / monthly / quarterly KPIs with counters and period roll-over             |
| **Journal**          | Daily, weekly, monthly and quarterly prompts — the audit's review questions      |

A few deliberate choices worth knowing about:

- **Ticking a task logs its hours.** Completing work on the Dashboard or in the
  Learning Path writes to the activity log in the *same* update, which is what keeps
  streaks, the heat map and velocity honest without a separate time-logging ritual —
  and means one `⌘Z` undoes the whole thing rather than half of it.
- **Achievements are computed, not stored.** A declarative rules engine evaluates
  them against derived stats, so adding one is a data change, not a code change.
  Once earned they stay earned.
- **Applications start in month 12.** That is not an oversight. Applying before you
  are interview-ready is one of the three biggest mistakes in the audit, because
  referrals are finite.
- **The audit's warnings are in the product.** The 80/20 page carries the ignore
  list; the Courses page flags certificates with nothing to show for them; the
  LinkedIn page has a "what not to post" panel.

---

## Keyboard

| Key | Action |
| --- | ------ |
| `⌘K` / `Ctrl K`, or `/` | Command palette — search sections, skills, projects, chapters, contacts |
| `g` then `d` `l` `r` `s` `p` `w` `i` `n` `a` `h` `j` | Jump to a section |
| `⌘S` / `Ctrl S` | Save pending changes now |
| `⌘Z` / `Ctrl Z` | Undo (40 levels) |
| `t` | Toggle light / dark |
| `[` | Collapse the sidebar |
| `Shift E` | Download a backup |
| `?` | Shortcut reference |

Full list in Settings.

---

## Regenerating data

```bash
npm run seed              # create only files that don't exist — safe, non-destructive
npm run reseed            # overwrite everything — destroys logged progress
node tooling/seed/index.mjs --only=skills --force   # regenerate one file
```

The seed is authored as JavaScript in [`tooling/seed/`](tooling/seed/) rather than as
raw JSON so cross-references stay consistent and dates derive from a single
`PROGRAMME_START`. It is deterministic: re-running produces byte-identical files, so
a reseed is a diffable operation.

**Take a backup before `reseed`** (Settings → Data → Download backup).

### Starting from zero

The seed ships with one month of realistic progress from `2026-07-01`, so the
charts, streaks and trends are meaningful on first run rather than a grid of zeros.
To start clean instead, set your own `startDate` in Settings → Profile, then clear
the collections you want empty — or edit `PROGRAMME_START` in
[`tooling/seed/util.mjs`](tooling/seed/util.mjs) and run `npm run reseed`.

---

## Stack

React 18 · TypeScript · Vite. Two runtime dependencies — `react` and `react-dom`.

Charts are hand-rolled SVG ([`src/components/charts/`](src/components/charts/)): the
whole set is smaller than a charting library, every mark inherits design tokens so it
theme-switches for free, and there is no second theming system to keep in sync.
Routing is 60 lines of hash-based navigation, so a built copy works from any static
host with no rewrite rules.

```
src/
  lib/         types · persistence · store · derive · dates · router · nav
  components/  ui/ (primitives) · charts/ · layout/ (shell, palette, toasts)
  pages/       one file per section
  styles/      tokens.css · global.css
tooling/
  json-file-bridge.ts   dev-server file bridge
  seed/                 the data generator
data/                   your 18 JSON files
```

Design tokens live in [`src/styles/tokens.css`](src/styles/tokens.css). Both themes
define the same variable names, so no component ever branches on theme.

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc -b && vite build
```

Pages are code-split, so opening the app pulls the shell plus the Dashboard and
nothing else.

---

## Honest limitations

- **The competency scores are self-assessed.** The baselines come from the audit; the
  current values are whatever you set. The score is only as honest as you are — the
  Evidence column exists to keep you accountable to it.
- **The forecast is a straight-line extrapolation** of your readiness trend. The
  evidence pillar moves in steps when artefacts ship, not smoothly, so treat it as
  directional.
- **Compensation figures are illustrative**, quoted from Part 9 of the audit. Actual
  numbers vary enormously by company, level, equity and market.
- **No sync.** One machine, one folder. Use backup/restore or put `data/` in git if
  you want history — the files are pretty-printed specifically so they diff well.
