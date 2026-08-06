#!/usr/bin/env node
/**
 * One-time migration: push the current data/*.json files into Supabase.
 *
 *   npm run migrate:supabase
 *
 * Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (falls back to whatever is already in process.env, so
 * `SUPABASE_SERVICE_ROLE_KEY=... npm run migrate:supabase` also works). The
 * service-role key bypasses Row-Level Security, which is exactly what an
 * unattended migration needs — and exactly why this key must never reach the
 * browser bundle. See .env.example.
 *
 * Safe to re-run: it upserts by `name`, so it always leaves the table
 * matching whatever is on disk in data/ right now. Run `supabase/schema.sql`
 * in the Supabase SQL editor before running this for the first time.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
const DATA_DIR = path.resolve(ROOT, 'data')

/** Minimal .env.local loader — no dotenv dependency needed for one script. */
async function loadDotEnvLocal() {
  let text
  try {
    text = await fs.readFile(path.resolve(ROOT, '.env.local'), 'utf8')
  } catch {
    return // no .env.local — fine, rely on already-exported env vars
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

async function main() {
  await loadDotEnvLocal()

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error(
      'Missing config. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.example) and try again.',
    )
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey)

  const fileNames = (await fs.readdir(DATA_DIR)).filter((n) => n.endsWith('.json'))
  if (fileNames.length === 0) {
    console.error(`No JSON files found in ${DATA_DIR}. Run \`npm run seed\` first.`)
    process.exit(1)
  }

  console.log(`Migrating ${fileNames.length} file(s) from ${path.relative(ROOT, DATA_DIR)}/ to Supabase…\n`)

  const rows = []
  for (const fileName of fileNames) {
    const name = fileName.replace(/\.json$/, '')
    const raw = await fs.readFile(path.join(DATA_DIR, fileName), 'utf8')
    try {
      rows.push({ name, content: JSON.parse(raw), updated_at: new Date().toISOString() })
    } catch (error) {
      console.error(`  ✗ ${fileName}: not valid JSON (${error.message}) — skipped`)
    }
  }

  const { error } = await supabase.from('data_files').upsert(rows, { onConflict: 'name' })
  if (error) {
    console.error(`\nUpsert failed: ${error.message}`)
    console.error('Did you run supabase/schema.sql in the Supabase SQL editor first?')
    process.exit(1)
  }

  for (const row of rows) console.log(`  ✓ ${row.name}`)
  console.log(`\nDone. ${rows.length} file(s) migrated.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
