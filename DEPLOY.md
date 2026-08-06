# Deploying with Supabase + Vercel

This turns the app from "JSON files on one machine" into "a real Postgres
database, reachable from anywhere, behind a login." Read
[`src/lib/persistence.ts`](src/lib/persistence.ts) first if you want the full
picture of how the adapters fit together — this doc is just the setup steps.

**Before you start:** read the Privacy section in [`README.md`](README.md).
This app carries real personal data (job search, contacts, journal). None of
that changes here — it just moves from `data/*.json` to a Supabase table that
only your one authenticated account can read.

---

## 1. Create the Supabase project

1. [supabase.com](https://supabase.com) → **New project**. Free tier, no
   card required. Pick any region; note the database password it generates
   (you likely won't need it again, but save it somewhere).
2. Wait for provisioning (~2 minutes).

## 2. Create the table

1. In the Supabase dashboard: **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and
   **Run**.
3. This creates one table, `data_files` — one row per current `data/*.json`
   collection — with Row-Level Security restricting all access to
   authenticated requests. Re-running the script is safe.

## 3. Create your account

This app has **no public sign-up** on purpose — it's a single-user dashboard,
not a SaaS.

1. **Authentication → Users → Add user**.
2. Enter your email and a password. Toggle **Auto Confirm User** on (so you
   don't need an inbound email flow just to log in the first time).
3. That's the only account you need.

## 4. Get your API keys

**Project Settings → API**:

| Value | Where it's used |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL` |
| `anon` `public` key | `VITE_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` — **local migration only, never deployed** |

The anon key is safe to ship to the browser — it has no power on its own,
access is enforced by the RLS policies from step 2. The service-role key
bypasses RLS entirely; it exists only so the one-time migration script can
write without an interactive login, and it must never be set in Vercel or
committed to git.

## 5. Configure locally and migrate your existing data

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

npm install               # pulls in @supabase/supabase-js
npm run migrate:supabase  # pushes every data/*.json file into data_files
```

You should see one `✓` line per file. Re-running this script later re-syncs
whatever is currently in `data/` — see the important caveat below before you
do that.

## 6. Verify it locally

`npm run dev` always uses the file bridge (it's dev-server middleware, see
`tooling/json-file-bridge.ts`), so it won't exercise the Supabase path. To
actually test the deployed behavior locally:

```bash
npm run build
npm run preview
```

Open the preview URL — you should hit the login screen from `src/lib/auth.tsx`,
sign in with the account from step 3, and see your migrated data.

## 7. Deploy to Vercel

1. Push this repo to GitHub if it isn't already (it can stay **private** —
   Vercel's free tier deploys private repos fine).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
   Vercel reads [`vercel.json`](vercel.json) and auto-detects the Vite build;
   no server-side rewrite rules are needed since routing is hash-based
   (`#/...`).
3. **Project Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   Do **not** add `SUPABASE_SERVICE_ROLE_KEY` here — it has no reason to exist
   outside your local `.env.local`.
4. Deploy. You now have a real URL, backed by a real database, behind a login.

---

## The one thing to understand before you use both

Once Supabase is configured, `npm run dev` (file bridge → `data/*.json`) and
the deployed app (Supabase) are **two independent copies of your data.**
Editing in one does not update the other. Pick one as your actual working
copy going forward:

- **Deployed is primary (recommended once this is live):** stop treating
  `data/*.json` as live data. It becomes a point-in-time backup from the day
  you migrated. Use Settings → Data → Download backup periodically from the
  deployed app if you want a git-trackable history again.
- **Local dev is primary:** re-run `npm run migrate:supabase` whenever you
  want the deployed copy to catch up. It's a one-way, full overwrite in that
  direction — it does not merge.

There's no automatic sync between the two, by design — the same reasoning
that kept this app to two runtime dependencies for two years applies to not
building a bidirectional sync engine for a single-user tool.
