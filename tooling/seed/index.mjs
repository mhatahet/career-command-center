#!/usr/bin/env node
/**
 * Seed writer.
 *
 *   npm run seed          write any data/*.json that does not exist yet
 *   npm run seed -- --force   overwrite everything (destroys logged progress)
 *
 * Non-destructive by default, because the whole point of the app is that the
 * JSON files accumulate two years of real work. A reseed must never be able to
 * wipe that by accident.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSkills, COMPETITIVE_ADVANTAGES, GAP_REGISTER } from './skills.mjs'
import { buildRoadmap } from './roadmap.mjs'
import { buildBooks, buildCourses, buildPortfolio, buildWriting } from './content.mjs'
import { buildInterviews } from './interviews.mjs'
import { buildApplications, buildLinkedIn, buildNetworking } from './outreach.mjs'
import { buildAchievements, buildGoals, buildTasks } from './gamification.mjs'
import { buildLeverage } from './leverage.mjs'
import { buildAnalytics, buildJournal, buildProfile } from './analytics.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(here, '../../data')

const force = process.argv.includes('--force')
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]

/** The default dashboard widget order. Referenced by settings. */
const DASHBOARD_LAYOUT = [
  'readiness',
  'level',
  'streak',
  'hours',
  'position',
  'today',
  'sprint',
  'progress-rings',
  'skills-radar',
  'recommendations',
  'milestones',
  'activity',
  'must-fix',
  'portfolio',
  'goals',
  'achievement',
  'companies',
]

function buildSettings() {
  return {
    theme: 'dark',
    accent: 'indigo',
    sidebarCollapsed: false,
    density: 'comfortable',
    autoSave: true,
    showCelebrations: true,
    reduceMotion: false,
    weekStartsOn: 1,
    hiddenSections: [],
    dashboardLayout: DASHBOARD_LAYOUT,
    lastBackupAt: undefined,
  }
}

/**
 * `skills.json` carries the competency rows plus the audit's advantage and gap
 * registers, since all three describe the same assessment and are always read
 * together.
 */
function buildSkillsFile() {
  return {
    skills: buildSkills(),
    competitiveAdvantages: COMPETITIVE_ADVANTAGES,
    gapRegister: GAP_REGISTER,
  }
}

const BUILDERS = {
  profile: buildProfile,
  skills: buildSkillsFile,
  roadmap: buildRoadmap,
  tasks: buildTasks,
  goals: buildGoals,
  portfolio: buildPortfolio,
  books: buildBooks,
  courses: buildCourses,
  interviews: buildInterviews,
  networking: buildNetworking,
  linkedin: buildLinkedIn,
  writing: buildWriting,
  applications: buildApplications,
  achievements: buildAchievements,
  analytics: buildAnalytics,
  journal: buildJournal,
  leverage: buildLeverage,
  settings: buildSettings,
}

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true })

  const written = []
  const skipped = []

  for (const [name, build] of Object.entries(BUILDERS)) {
    if (only && only !== name) continue

    const target = path.join(DATA_DIR, `${name}.json`)
    if (!force && (await exists(target))) {
      skipped.push(name)
      continue
    }

    const data = build()
    await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    written.push(name)
  }

  const label = (list) => list.map((n) => `${n}.json`).join(', ')

  if (written.length) console.log(`✔ wrote  ${written.length} file(s): ${label(written)}`)
  if (skipped.length) {
    console.log(`• kept   ${skipped.length} existing file(s): ${label(skipped)}`)
    console.log('  (pass --force to overwrite — this discards logged progress)')
  }
  if (!written.length && !skipped.length) console.log('Nothing to do.')
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
