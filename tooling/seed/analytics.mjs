/**
 * Activity log, readiness history, capacity history, journal and profile.
 *
 * The activity log is the single source of truth for streaks, heat maps,
 * velocity and hours-by-skill. One row per day worked; days off simply do not
 * appear, which is what makes streak calculation honest.
 */

import { SKILL_IDS as S } from './skills.mjs'
import { buildSkills } from './skills.mjs'
import {
  HORIZON_MONTHS,
  PROGRAMME_START,
  SEED_TODAY,
  addDays,
  daysBetween,
  monthStart,
  rng,
  round,
  stampAt,
} from './util.mjs'

/* ------------------------------------------------------------- activity --- */

/**
 * Month one, as actually lived: a strong start, a gap where real life happened,
 * then a recovered streak. Deliberately not a perfect grid — a seed that shows a
 * flawless month teaches the user nothing about what the streak logic means.
 */
export function buildActivity() {
  const random = rng(864213)
  const totalDays = daysBetween(PROGRAMME_START, SEED_TODAY)

  /** Days deliberately left blank: two rest days a week plus a four-day gap. */
  const skipped = new Set([5, 6, 12, 13, 16, 17, 18, 19, 26, 27])

  const areasByPhase = [
    // Week 1–2: SQL foundations
    { areas: { sql: 0.7, reading: 0.2, admin: 0.1 }, skills: { Analytics: 0.7, Metrics: 0.2, 'Business Thinking': 0.1 } },
    // Week 3: metrics frameworks
    { areas: { sql: 0.4, analytics: 0.35, reading: 0.15, writing: 0.1 }, skills: { Analytics: 0.45, Metrics: 0.4, Communication: 0.15 } },
    // Week 4–5: metrics + first outreach + writing
    { areas: { sql: 0.3, analytics: 0.3, writing: 0.15, networking: 0.1, interview: 0.15 }, skills: { Analytics: 0.35, Metrics: 0.3, Communication: 0.2, 'Product Sense': 0.15 } },
  ]

  const rows = []

  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex += 1) {
    if (skipped.has(dayIndex)) continue

    const date = addDays(PROGRAMME_START, dayIndex)
    const phase = dayIndex < 14 ? 0 : dayIndex < 21 ? 1 : 2
    const mix = areasByPhase[phase]

    // 1.2–3.4 hours on a working day, weighted toward the middle.
    const hours = round(1.2 + random() * 1.4 + random() * 0.8, 1)

    const byArea = {}
    for (const [area, share] of Object.entries(mix.areas)) {
      const value = round(hours * share, 2)
      if (value > 0.05) byArea[area] = value
    }

    const bySkill = {}
    for (const [skillName, share] of Object.entries(mix.skills)) {
      const skillId = S[skillName]
      if (!skillId) continue
      const value = round(hours * share, 2)
      if (value > 0.05) bySkill[skillId] = value
    }

    const tasksCompleted = hours > 2.5 ? 3 : hours > 1.8 ? 2 : 1

    rows.push({
      date,
      hours,
      // XP roughly tracks hours, with a completion bonus. The client recomputes
      // XP from real events; this is the historical record for month one.
      xp: Math.round(hours * 45 + tasksCompleted * 25),
      tasksCompleted,
      bySkill,
      byArea,
      note: undefined,
    })
  }

  // Two annotated days, so the note affordance is discoverable.
  const firstDay = rows[0]
  if (firstDay) firstDay.note = 'Day one. SQLBolt lessons 1–6 in a single sitting.'
  const breakthrough = rows.find((r) => r.date === addDays(PROGRAMME_START, 22))
  if (breakthrough) breakthrough.note = 'Wrote a window function without looking it up. First time.'

  return rows
}

/* ------------------------------------------------- readiness history ----- */

/**
 * Weekly readiness snapshots, on the same four-pillar scale the client computes
 * live (see `src/lib/readiness.ts` — PILLAR_WEIGHTS must match).
 *
 * Competency alone would put month one near 79, which badly overstates the
 * position: the audit's central finding is that the capability is real but the
 * *proof* is missing. Blending competency with evidence, interview readiness and
 * market presence produces a score in the high forties — which is the honest
 * reading, and which then climbs steeply as artefacts actually ship.
 */
const PILLAR_WEIGHTS = { competency: 0.55, evidence: 0.25, interview: 0.12, presence: 0.08 }

/**
 * Non-competency pillar values during month one. These barely move across the
 * five snapshots — nothing was published yet — so they are held constant here
 * rather than modelled. The client recomputes all four from live data.
 */
const MONTH_ONE_PILLARS = { evidence: 3, interview: 9, presence: 16 }

export function buildReadinessHistory() {
  const skills = buildSkills()

  function scoreAt(date) {
    const perSkill = {}
    let weighted = 0
    let weightSum = 0

    for (const skill of skills) {
      // Interpolate each skill's history to the requested date.
      const points = skill.history
      let value = points[0].score
      for (const point of points) {
        if (point.date <= date) value = point.score
      }
      perSkill[skill.id] = value
      weighted += (value / 10) * skill.weight
      weightSum += skill.weight
    }

    // Normalise by the actual weight sum so authored weights need not sum to
    // exactly 1.0 after rounding.
    const competency = (weighted / weightSum) * 100

    const composite =
      competency * PILLAR_WEIGHTS.competency +
      MONTH_ONE_PILLARS.evidence * PILLAR_WEIGHTS.evidence +
      MONTH_ONE_PILLARS.interview * PILLAR_WEIGHTS.interview +
      MONTH_ONE_PILLARS.presence * PILLAR_WEIGHTS.presence

    return { score: round(composite, 1), skills: perSkill }
  }

  const dates = [
    PROGRAMME_START,
    addDays(PROGRAMME_START, 7),
    addDays(PROGRAMME_START, 14),
    addDays(PROGRAMME_START, 21),
    addDays(PROGRAMME_START, 29),
  ]

  return dates.map((date) => {
    const { score, skills: perSkill } = scoreAt(date)
    return { date, score, skills: perSkill }
  })
}

/* -------------------------------------------------- capacity history ----- */

export function buildCapacity(activity) {
  // Group logged hours into ISO weeks starting Monday, against a 12h/week plan.
  const weeks = new Map()

  for (const row of activity) {
    const d = new Date(`${row.date}T12:00:00Z`)
    const dow = d.getUTCDay()
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    const weekStart = addDays(row.date, mondayOffset)
    weeks.set(weekStart, round((weeks.get(weekStart) ?? 0) + row.hours, 1))
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, actualHours]) => ({ weekStart, plannedHours: 12, actualHours }))
}

export function buildAnalytics() {
  const activity = buildActivity()
  return {
    activity,
    readinessHistory: buildReadinessHistory(),
    capacityHistory: buildCapacity(activity),
  }
}

/* -------------------------------------------------------------- journal --- */

const PROMPTS = [
  { id: 'learned', question: 'What did I learn?', kind: 'daily', helper: 'One specific thing. "Worked on SQL" is not a thing learned.' },
  { id: 'blocked', question: 'What blocked me?', kind: 'daily', helper: 'Name the blocker precisely enough that it becomes actionable.' },
  { id: 'improve', question: 'What should improve?', kind: 'daily', helper: 'One change for tomorrow, not a list of five.' },
  { id: 'shipped', question: 'What did I ship?', kind: 'daily', helper: 'Something that exists outside your own head.' },

  { id: 'w-outcomes', question: 'What measurable business outcomes can I now demonstrate?', kind: 'weekly', helper: 'From Part 10 of the audit. The answer should grow over 24 months.' },
  { id: 'w-evidence', question: 'What new evidence exists that I can operate at Senior PM level?', kind: 'weekly', helper: 'Evidence, not effort. What could a stranger verify?' },
  { id: 'w-proof-gap', question: 'Which competency still lacks proof?', kind: 'weekly', helper: 'Cross-check against the Skills page. Be honest.' },
  { id: 'w-referrals', question: 'How many referrals and recruiter conversations did I generate?', kind: 'weekly', helper: 'A count, not an impression.' },
  { id: 'w-feedback', question: 'What feedback patterns emerged from interviews?', kind: 'weekly', helper: 'Repetition is the signal. One-off criticism usually is not.' },
  { id: 'w-drop', question: 'What did I plan and not do — and was the plan wrong, or the week?', kind: 'weekly', helper: 'The distinction matters. One means replan; the other means protect the time.' },

  { id: 'm-artifact', question: 'What artefact did I publish this month?', kind: 'monthly', helper: 'The monthly commitment. If nothing, say why without softening it.' },
  { id: 'm-skill', question: 'Which competency score genuinely moved, and what is the evidence?', kind: 'monthly', helper: 'Update the Skills page with the evidence, not just the number.' },
  { id: 'm-leverage', question: 'Did I spend my hours on the highest-leverage work?', kind: 'monthly', helper: 'Compare against the 80/20 page. Effort in the wrong place still counts as zero.' },
  { id: 'm-stop', question: 'What am I doing that the audit told me to stop doing?', kind: 'monthly', helper: 'The stop list is on the Leverage page. Reread it.' },

  { id: 'q-portfolio', question: 'Portfolio review: is this the strongest version of my portfolio?', kind: 'quarterly', helper: 'Quarterly checkpoint. Which artefact is now the weakest link?' },
  { id: 'q-resume', question: 'Resume update: does every bullet carry a number?', kind: 'quarterly', helper: 'Quarterly checkpoint from the audit.' },
  { id: 'q-benchmark', question: 'Mock interview benchmark: what is my score trend by track?', kind: 'quarterly', helper: 'Quarterly checkpoint. Use the same rubric each time or the trend means nothing.' },
  { id: 'q-network', question: 'Networking and referral audit: who moved from cold to warm?', kind: 'quarterly', helper: 'Quarterly checkpoint. Relationship strength, not connection count.' },
  { id: 'q-probability', question: 'Honestly: has my probability of a Tier-1 offer gone up this quarter?', kind: 'quarterly', helper: 'The audit\'s baseline is 65–75% over 24 months, conditional on execution.' },
]

export function buildJournal() {
  const entries = [
    {
      id: 'jr_001',
      date: addDays(PROGRAMME_START, 0),
      kind: 'daily',
      mood: 4,
      energy: 4,
      answers: {
        learned: 'SQLBolt lessons 1–6. Joins are less mysterious than I had allowed myself to believe — I had been avoiding this out of habit, not difficulty.',
        blocked: 'Nothing. The barrier was starting.',
        improve: 'Block the hours in the calendar rather than hoping for them.',
        shipped: 'Nothing yet. That is the honest answer on day one.',
      },
      hoursLogged: 2.6,
      wins: ['Started'],
      blockers: [],
      tags: ['sql', 'month-1'],
      createdAt: stampAt(PROGRAMME_START, 21, 15),
    },
    {
      id: 'jr_002',
      date: addDays(PROGRAMME_START, 6),
      kind: 'weekly',
      mood: 4,
      energy: 3,
      answers: {
        'w-outcomes': 'None yet, but I found three initiatives from the last year where the numbers exist and simply were never written down. That is a week of work, not a year.',
        'w-evidence': 'Nothing public. SQLBolt finished, which is input rather than evidence.',
        'w-proof-gap': 'All of them, publicly. Analytics and Experimentation most acutely — those are the two the audit called must-fix.',
        'w-referrals': 'Zero. Deliberate — nothing to show yet.',
        'w-feedback': 'No interviews yet.',
        'w-drop': 'Planned five days, did four. The plan was right; Thursday was not.',
      },
      hoursLogged: 11.4,
      wins: ['SQLBolt complete', 'Calendar blocks holding'],
      blockers: ['Evenings are less reliable than mornings'],
      tags: ['week-1', 'sql'],
      createdAt: stampAt(addDays(PROGRAMME_START, 6), 20, 0),
    },
    {
      id: 'jr_003',
      date: addDays(PROGRAMME_START, 22),
      kind: 'daily',
      mood: 5,
      energy: 4,
      answers: {
        learned: 'Wrote a window function without looking it up. ROW_NUMBER partitioned by user, ordered by timestamp — it finally reads as a sentence rather than a formula.',
        blocked: 'Lost 20 minutes to a timezone boundary in a retention query. Worth losing.',
        improve: 'Say the query plan out loud before typing it. It works, and it is also what the interview wants.',
        shipped: 'First real dashboard from my own queries. Six charts, each with a "so what" underneath.',
      },
      hoursLogged: 3.1,
      wins: ['Window functions clicked', 'First dashboard from own queries'],
      blockers: [],
      tags: ['sql', 'breakthrough'],
      createdAt: stampAt(addDays(PROGRAMME_START, 22), 22, 10),
    },
    {
      id: 'jr_004',
      date: addDays(PROGRAMME_START, 29),
      kind: 'monthly',
      mood: 4,
      energy: 3,
      answers: {
        'm-artifact': 'Nothing published. Month 1 is inputs by design, but the pattern to watch is whether month 2 also ends with nothing published.',
        'm-skill': 'Analytics 6.5 → 7.1. Evidence: SQLBolt complete, Mode advanced module underway, one dashboard built from my own queries. Metrics 6.8 → 7.2 from three of the five frameworks.',
        'm-leverage': 'Mostly. SQL is the second-highest ROI item on the 80/20 list and it got the majority of the hours. The four-day gap mid-month cost roughly ten hours.',
        'm-stop': 'Nearly built a note-taking system instead of doing the work. Caught it. The audit warns about exactly this and it was uncomfortably accurate.',
      },
      hoursLogged: 58,
      wins: [
        'Analytics up 0.6 in one month',
        'Three of five KPI frameworks done',
        'Two mock interviews completed early',
      ],
      blockers: [
        'The four-day gap in week three',
        'Nothing public yet — the must-fix items stay unfixed until something ships',
      ],
      tags: ['month-1', 'retrospective'],
      createdAt: stampAt(addDays(PROGRAMME_START, 29), 20, 30),
    },
  ]

  return { entries, prompts: PROMPTS }
}

/* -------------------------------------------------------------- profile --- */

export function buildProfile() {
  return {
    name: 'Product Manager',
    currentRole: 'Product Manager',
    currentCompany: 'Enterprise SaaS',
    location: 'Jordan',
    // Part 6, verbatim.
    positioning:
      'Enterprise SaaS Product Manager specializing in complex workflows, UX systems, AI-enabled products, and scalable product execution.',
    headline:
      'Senior Product Manager | B2B SaaS | Enterprise UX | AI Products | Product Strategy | Systems Thinking',
    startDate: PROGRAMME_START,
    horizonMonths: HORIZON_MONTHS,
    careerLevelLabel: 'Product Manager — Top 10–15% locally',
    targetLevelLabel: 'Senior Product Manager — Tier 1 / Tier 2 international',
    // Part 1 executive summary, verbatim.
    benchmark: {
      localPercentile: 'Top 10–15% of Product Managers in Jordan',
      internationalPercentile: 'Top 20–30% among international SaaS PMs',
      notYetCompetitiveFor: [
        'Google L5',
        'Stripe PM',
        'Shopify Senior PM',
        'Atlassian Senior PM',
        'Canva Senior PM',
        'Microsoft Senior PM',
      ],
      alreadyCompetitiveFor: [
        'Mid-size global SaaS with operational products',
        'B2B SaaS',
        'Logistics',
        'Retail tech',
        'ERP',
        'Field service',
        'Workflow software',
      ],
    },
    // Part 11 / Confidence Assessment, verbatim.
    successProbability: {
      low: 65,
      high: 75,
      assumptions: [
        'You remain in a role where you can generate measurable product outcomes.',
        'You build a strong public portfolio and personal brand.',
        'You achieve interview-ready proficiency in analytics and experimentation.',
        'You maintain consistent execution over the full period.',
        'You actively pursue referrals and targeted applications rather than relying solely on online job postings.',
      ],
    },
    weeklyHourTarget: 12,
    bottleneck:
      'Your strongest abilities — systems thinking, enterprise UX, and execution — are not yet backed by equally strong public evidence in analytics, experimentation, and quantified business impact. Closing that gap will have the largest effect on your competitiveness.',
    highestValueSkill:
      'Data-informed product decision making: combining SQL, product analytics, experimentation, and business metrics. This complements your existing strengths rather than replacing them.',
  }
}

export { monthStart }
