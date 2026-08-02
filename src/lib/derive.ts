/* ============================================================================
   Derived state
   ----------------------------------------------------------------------------
   Everything the dashboard shows that is not stored: readiness, XP, level,
   streaks, progress, velocity, projections, achievement unlocks and
   recommendations.

   Nothing here mutates. One pure function per concept, composed into a single
   `derive()` that the store memoises. That means a number displayed in two
   places can never disagree with itself.
   ========================================================================= */

import {
  addDays,
  daysBetween,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  monthsBetween,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  today as todayISO,
} from './dates'
import type {
  Achievement,
  AchievementCriterion,
  AppData,
  Chapter,
  CountableCollection,
  GapTier,
  ID,
  ISODate,
  Mission,
  PathTask,
  Skill,
  TaskArea,
} from './types'

/* ============================================================================
   Readiness
   ----------------------------------------------------------------------------
   The audit's central finding is that the capability is real but the *proof* is
   missing: "Large companies hire demonstrated impact—not capability."

   A weighted competency average alone would read ~79 at baseline, which is a
   flattering and useless number. So readiness is four pillars:

     Competency  55%  weighted skill scores — what you can do
     Evidence    25%  published artefacts, quantified impact, writing — the proof
     Interview   12%  mock volume, scores, coverage across tracks
     Presence     8%  network strength, referrals, brand reach

   Baseline lands in the high forties, which is the honest reading of "already
   competitive for mid-size SaaS, not yet competitive for Tier 1", and it climbs
   fastest when artefacts actually ship.

   These weights are mirrored in `tooling/seed/analytics.mjs`. Change both.
   ========================================================================= */

export const PILLAR_WEIGHTS = {
  competency: 0.55,
  evidence: 0.25,
  interview: 0.12,
  presence: 0.08,
} as const

export interface Pillar {
  key: keyof typeof PILLAR_WEIGHTS
  label: string
  score: number
  weight: number
  /** Points this pillar contributes to the headline score. */
  contribution: number
  /** Points still available from this pillar. */
  headroom: number
  detail: string
  drivers: { label: string; value: string; done: boolean }[]
}

export interface Readiness {
  score: number
  target: number
  gap: number
  pillars: Pillar[]
  /** Weighted competency component on its own, 0–100. */
  competencyScore: number
  band: { label: string; detail: string; tone: 'danger' | 'warning' | 'info' | 'success' }
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

function ratio(current: number, target: number): number {
  if (target <= 0) return 0
  return clamp((current / target) * 100)
}

function competencyPillar(skills: Skill[]): { score: number; drivers: Pillar['drivers'] } {
  let weighted = 0
  let weightSum = 0
  for (const skill of skills) {
    weighted += (skill.currentScore / 10) * skill.weight
    weightSum += skill.weight
  }
  // Normalise by the real weight sum, so authored weights need not sum to
  // exactly 1 after rounding.
  const score = weightSum > 0 ? (weighted / weightSum) * 100 : 0

  const belowTarget = skills.filter((s) => s.currentScore < s.targetScore)
  const weakest = [...belowTarget].sort(
    (a, b) => (a.targetScore - a.currentScore) * b.weight - (b.targetScore - b.currentScore) * a.weight,
  )

  return {
    score,
    drivers: [
      {
        label: 'Competencies at or above target',
        value: `${skills.length - belowTarget.length} of ${skills.length}`,
        done: belowTarget.length === 0,
      },
      ...weakest.slice(-3).reverse().map((s) => ({
        label: `${s.name} → ${s.targetScore.toFixed(1)}`,
        value: s.currentScore.toFixed(1),
        done: false,
      })),
    ],
  }
}

function evidencePillar(data: AppData): { score: number; drivers: Pillar['drivers'] } {
  const published = data.portfolio.filter((p) => p.publishStatus === 'published')
  const publishedWriting = data.writing.filter((w) => w.status === 'published')
  const quantified = data.skills
    .flatMap((s) => s.evidence)
    .filter((e) => e.kind === 'metric').length

  // The audit's success metric is 6–8 public artefacts, so 7 is full marks here.
  const artefactScore = ratio(published.length, 7)
  // One article a month; a year of cadence reads as an established brand.
  const writingScore = ratio(publishedWriting.length, 12)
  // Six quantified outcomes matches the audit's list: ARR, retention,
  // activation, churn, tickets, engineering time.
  const quantifiedScore = ratio(quantified, 6)

  const score = artefactScore * 0.5 + writingScore * 0.25 + quantifiedScore * 0.25

  return {
    score,
    drivers: [
      { label: 'Published portfolio artefacts', value: `${published.length} / 7`, done: published.length >= 7 },
      { label: 'Published long-form articles', value: `${publishedWriting.length} / 12`, done: publishedWriting.length >= 12 },
      { label: 'Quantified business outcomes', value: `${quantified} / 6`, done: quantified >= 6 },
    ],
  }
}

function interviewPillar(data: AppData): { score: number; drivers: Pillar['drivers'] } {
  const { questions, mocks } = data.interviews

  // The audit prescribes ~120 mocks across months 10–24; 100 is full marks.
  const volumeScore = ratio(mocks.length, 100)

  const scored = mocks.filter((m) => m.score > 0)
  const avgScore = scored.length ? scored.reduce((s, m) => s + m.score, 0) / scored.length : 0
  // A consistent 8/10 across mocks is interview-ready.
  const qualityScore = ratio(avgScore, 8)

  const practised = questions.filter((q) => q.practiceCount > 0)
  const coverageScore = ratio(practised.length, Math.max(1, questions.length))

  const score = volumeScore * 0.3 + qualityScore * 0.45 + coverageScore * 0.25

  return {
    score,
    drivers: [
      { label: 'Mock interviews completed', value: `${mocks.length} / 100`, done: mocks.length >= 100 },
      { label: 'Average mock score', value: scored.length ? `${avgScore.toFixed(1)} / 8.0` : '—', done: avgScore >= 8 },
      { label: 'Question bank practised', value: `${practised.length} / ${questions.length}`, done: practised.length >= questions.length },
    ],
  }
}

function presencePillar(data: AppData): { score: number; drivers: Pillar['drivers'] } {
  const contacts = data.networking.contacts
  const strong = contacts.filter((c) => c.relationshipStrength >= 3)
  const referrals = data.applications.applications.filter((a) => a.hasReferral).length
  const latest = data.linkedin.snapshots.at(-1)
  const followers = latest?.followers ?? 0

  const networkScore = ratio(strong.length, 60)
  // Five referrals from target companies is an explicit audit success metric.
  const referralScore = ratio(referrals, 5)
  const reachScore = ratio(followers, 5000)

  const score = networkScore * 0.4 + referralScore * 0.35 + reachScore * 0.25

  return {
    score,
    drivers: [
      { label: 'Strong relationships (3+)', value: `${strong.length} / 60`, done: strong.length >= 60 },
      { label: 'Referrals secured', value: `${referrals} / 5`, done: referrals >= 5 },
      { label: 'LinkedIn followers', value: `${followers.toLocaleString()} / 5,000`, done: followers >= 5000 },
    ],
  }
}

const BANDS: { min: number; label: string; detail: string; tone: Readiness['band']['tone'] }[] = [
  { min: 90, label: 'Tier 1 ready', detail: 'Competitive for Google, Stripe, Atlassian, Canva and Microsoft senior loops.', tone: 'success' },
  { min: 80, label: 'Top 10% ready', detail: 'Competitive across Tier 2. Tier 1 is realistic with a strong referral.', tone: 'success' },
  { min: 70, label: 'Strong candidate', detail: 'Interview-ready for most Tier 2 companies. Keep pushing evidence and mock volume.', tone: 'info' },
  { min: 60, label: 'Emerging', detail: 'Solid foundation. The portfolio and interview pillars are what move the number now.', tone: 'info' },
  { min: 45, label: 'Building proof', detail: 'Capability is real; the evidence is not public yet. This is exactly the audit\'s diagnosis.', tone: 'warning' },
  { min: 0, label: 'Foundation', detail: 'Early in the programme. Focus on the must-fix competencies first.', tone: 'danger' },
]

export function computeReadiness(data: AppData): Readiness {
  const competency = competencyPillar(data.skills)
  const evidence = evidencePillar(data)
  const interview = interviewPillar(data)
  const presence = presencePillar(data)

  const raw = [
    { key: 'competency' as const, label: 'Competency', detail: 'Weighted skill scores across the sixteen competencies. What you can do.', ...competency },
    { key: 'evidence' as const, label: 'Evidence', detail: 'Published artefacts, articles and quantified outcomes. The proof the audit says is missing.', ...evidence },
    { key: 'interview' as const, label: 'Interview', detail: 'Mock volume, average score and coverage across the nine tracks.', ...interview },
    { key: 'presence' as const, label: 'Presence', detail: 'Relationship strength, referrals secured and public reach.', ...presence },
  ]

  const pillars: Pillar[] = raw.map((p) => {
    const weight = PILLAR_WEIGHTS[p.key]
    const score = clamp(p.score)
    return {
      key: p.key,
      label: p.label,
      score: Math.round(score * 10) / 10,
      weight,
      contribution: Math.round(score * weight * 10) / 10,
      headroom: Math.round((100 - score) * weight * 10) / 10,
      detail: p.detail,
      drivers: p.drivers,
    }
  })

  const score = Math.round(pillars.reduce((sum, p) => sum + p.contribution, 0) * 10) / 10
  const band = BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]

  return {
    score,
    target: 90,
    gap: Math.round((90 - score) * 10) / 10,
    pillars,
    competencyScore: Math.round(clamp(competency.score) * 10) / 10,
    band,
  }
}

/* ============================================================================
   XP and levels
   ----------------------------------------------------------------------------
   XP is earned from completed work, never from opening the app. The curve is
   quadratic so early levels arrive quickly and later ones mean something:

       xpForLevel(n) = 250 * n * (n - 1) / 2  ... cumulative
       level 2 at 250, level 5 at 2,500, level 10 at 11,250, level 25 at 75,000
   ========================================================================= */

const XP_BASE = 250

export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0
  return (XP_BASE * (level - 1) * level) / 2
}

export function levelFromXp(xp: number): { level: number; into: number; span: number; pct: number } {
  let level = 1
  while (cumulativeXpForLevel(level + 1) <= xp && level < 200) level += 1
  const floor = cumulativeXpForLevel(level)
  const ceiling = cumulativeXpForLevel(level + 1)
  const span = ceiling - floor
  const into = xp - floor
  return { level, into, span, pct: span > 0 ? (into / span) * 100 : 100 }
}

export interface XpBreakdown {
  total: number
  fromTasks: number
  fromMissions: number
  fromAchievements: number
  fromActivity: number
  level: number
  intoLevel: number
  levelSpan: number
  levelPct: number
  toNextLevel: number
}

export function computeXp(data: AppData, unlocked: Set<ID>): XpBreakdown {
  let fromTasks = 0
  let fromMissions = 0

  for (const chapter of data.roadmap.chapters) {
    for (const mission of chapter.missions) {
      for (const task of mission.tasks) {
        if (task.status === 'done') fromTasks += task.xp
      }
      if (mission.status === 'done') fromMissions += mission.xpBonus
    }
  }

  // Free-standing tasks, portfolio, writing, books and courses all pay out.
  for (const task of data.tasks) if (task.status === 'done') fromTasks += task.xp
  for (const project of data.portfolio) if (project.publishStatus === 'published') fromTasks += project.xp
  for (const piece of data.writing) if (piece.status === 'published') fromTasks += piece.xp
  for (const book of data.books) if (book.status === 'finished') fromTasks += book.xp
  for (const course of data.courses) if (course.status === 'done') fromTasks += course.xp

  const fromAchievements = data.achievements.achievements
    .filter((a) => unlocked.has(a.id))
    .reduce((sum, a) => sum + a.xp, 0)

  // Historical XP from the activity log, for days worked before a task existed
  // to attach it to. Only counted for days with no completed tasks, so logged
  // hours are never double-paid.
  const fromActivity = data.analytics.activity
    .filter((a) => a.tasksCompleted === 0)
    .reduce((sum, a) => sum + a.xp, 0)

  const total = fromTasks + fromMissions + fromAchievements + fromActivity
  const { level, into, span, pct } = levelFromXp(total)

  return {
    total,
    fromTasks,
    fromMissions,
    fromAchievements,
    fromActivity,
    level,
    intoLevel: into,
    levelSpan: span,
    levelPct: pct,
    toNextLevel: span - into,
  }
}

/* ============================================================================
   Streaks
   ========================================================================= */

export interface StreakInfo {
  current: number
  longest: number
  /** True when today has activity logged. */
  activeToday: boolean
  /** True when the streak survives only if today gets logged. */
  atRisk: boolean
  lastActiveDate?: ISODate
  totalDaysActive: number
}

export function computeStreaks(data: AppData, today: ISODate): StreakInfo {
  const dates = [...new Set(data.analytics.activity.filter((a) => a.hours > 0).map((a) => a.date))].sort()
  if (dates.length === 0) {
    return { current: 0, longest: 0, activeToday: false, atRisk: false, totalDaysActive: 0 }
  }

  // Longest run of consecutive days anywhere in the history.
  let longest = 1
  let run = 1
  for (let i = 1; i < dates.length; i += 1) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  const last = dates[dates.length - 1]
  const sinceLast = daysBetween(last, today)
  const activeToday = sinceLast === 0

  // A streak stays alive through yesterday: it is only broken once a full day
  // has passed with nothing logged.
  let current = 0
  if (sinceLast <= 1) {
    current = 1
    for (let i = dates.length - 1; i > 0; i -= 1) {
      if (daysBetween(dates[i - 1], dates[i]) === 1) current += 1
      else break
    }
  }

  return {
    current,
    longest: Math.max(longest, current),
    activeToday,
    atRisk: current > 0 && !activeToday,
    lastActiveDate: last,
    totalDaysActive: dates.length,
  }
}

/* ============================================================================
   Progress
   ========================================================================= */

export interface TaskProgress {
  total: number
  done: number
  inProgress: number
  pct: number
}

export function chapterProgress(chapter: Chapter): TaskProgress {
  const tasks = chapter.missions.flatMap((m) => m.tasks)
  return taskProgress(tasks)
}

export function missionProgress(mission: Mission): TaskProgress {
  return taskProgress(mission.tasks)
}

export function taskProgress(tasks: PathTask[]): TaskProgress {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length

  // Partial credit for work in flight, measured by subtasks so the bar moves as
  // the work moves rather than jumping at the end.
  const partial = tasks
    .filter((t) => t.status === 'in-progress')
    .reduce((sum, t) => {
      if (t.subtasks.length === 0) return sum + 0.5
      return sum + t.subtasks.filter((s) => s.done).length / t.subtasks.length
    }, 0)

  return {
    total,
    done,
    inProgress,
    pct: total > 0 ? ((done + partial) / total) * 100 : 0,
  }
}

export function taskCompletion(task: PathTask): number {
  if (task.status === 'done') return 100
  if (task.status === 'not-started' || task.status === 'dropped') return 0
  if (task.subtasks.length === 0) return 50
  return (task.subtasks.filter((s) => s.done).length / task.subtasks.length) * 100
}

/* ============================================================================
   Timeline position
   ========================================================================= */

export interface TimelinePosition {
  /** 1-based programme month the user is currently in. */
  currentMonth: number
  currentQuarter: number
  totalMonths: number
  daysElapsed: number
  daysRemaining: number
  daysTotal: number
  /** Share of the programme's calendar that has passed, 0–100. */
  timePct: number
  endDate: ISODate
  currentChapter?: Chapter
  /** Positive when work completed is ahead of calendar elapsed. */
  paceDelta: number
}

export function computeTimeline(data: AppData, today: ISODate): TimelinePosition {
  const { startDate, horizonMonths } = data.profile
  const monthsIn = Math.max(0, monthsBetween(startDate, today))
  const currentMonth = Math.min(horizonMonths, monthsIn + 1)

  const endDate = addDays(startDate, 0)
  const end = (() => {
    const d = new Date(`${startDate}T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + horizonMonths)
    return d.toISOString().slice(0, 10)
  })()
  void endDate

  const daysTotal = daysBetween(startDate, end)
  const daysElapsed = Math.max(0, daysBetween(startDate, today))
  const daysRemaining = Math.max(0, daysBetween(today, end))
  const timePct = daysTotal > 0 ? clamp((daysElapsed / daysTotal) * 100) : 0

  const currentChapter =
    data.roadmap.chapters.find((c) => c.month === currentMonth) ?? data.roadmap.chapters[0]

  const allTasks = data.roadmap.chapters.flatMap((c) => c.missions.flatMap((m) => m.tasks))
  const workPct = taskProgress(allTasks).pct

  return {
    currentMonth,
    currentQuarter: Math.ceil(currentMonth / 3),
    totalMonths: horizonMonths,
    daysElapsed,
    daysRemaining,
    daysTotal,
    timePct: Math.round(timePct * 10) / 10,
    endDate: end,
    currentChapter,
    paceDelta: Math.round((workPct - timePct) * 10) / 10,
  }
}

/* ============================================================================
   Hours and velocity
   ========================================================================= */

export interface HoursSummary {
  total: number
  thisWeek: number
  lastWeek: number
  thisMonth: number
  thisQuarter: number
  /** Mean hours per active day. */
  perActiveDay: number
  /** Mean hours per week over the last four weeks. */
  weeklyVelocity: number
  bySkill: { skillId: ID; name: string; hours: number; pct: number }[]
  byArea: { area: TaskArea; hours: number; pct: number }[]
}

export function computeHours(data: AppData, today: ISODate, weekStartsOn: 0 | 1): HoursSummary {
  const activity = data.analytics.activity
  const total = activity.reduce((sum, a) => sum + a.hours, 0)

  const weekStart = startOfWeek(today, weekStartsOn)
  const lastWeekStart = addDays(weekStart, -7)
  const monthStart = startOfMonth(today)
  const quarterStart = startOfQuarter(today)

  const sumBetween = (from: ISODate, to: ISODate) =>
    activity.filter((a) => a.date >= from && a.date <= to).reduce((sum, a) => sum + a.hours, 0)

  const thisWeek = sumBetween(weekStart, endOfWeek(today, weekStartsOn))
  const lastWeek = sumBetween(lastWeekStart, addDays(weekStart, -1))
  const thisMonth = sumBetween(monthStart, endOfMonth(today))
  const thisQuarter = sumBetween(quarterStart, endOfQuarter(today))

  const activeDays = activity.filter((a) => a.hours > 0).length
  const fourWeeksAgo = addDays(weekStart, -21)
  const recent = sumBetween(fourWeeksAgo, today)

  const skillTotals = new Map<ID, number>()
  const areaTotals = new Map<TaskArea, number>()
  for (const day of activity) {
    for (const [skillId, hours] of Object.entries(day.bySkill)) {
      skillTotals.set(skillId, (skillTotals.get(skillId) ?? 0) + hours)
    }
    for (const [area, hours] of Object.entries(day.byArea)) {
      areaTotals.set(area as TaskArea, (areaTotals.get(area as TaskArea) ?? 0) + (hours ?? 0))
    }
  }

  const skillNames = new Map(data.skills.map((s) => [s.id, s.name]))
  const skillSum = [...skillTotals.values()].reduce((a, b) => a + b, 0)
  const areaSum = [...areaTotals.values()].reduce((a, b) => a + b, 0)

  return {
    total: Math.round(total * 10) / 10,
    thisWeek: Math.round(thisWeek * 10) / 10,
    lastWeek: Math.round(lastWeek * 10) / 10,
    thisMonth: Math.round(thisMonth * 10) / 10,
    thisQuarter: Math.round(thisQuarter * 10) / 10,
    perActiveDay: activeDays > 0 ? Math.round((total / activeDays) * 10) / 10 : 0,
    weeklyVelocity: Math.round((recent / 4) * 10) / 10,
    bySkill: [...skillTotals.entries()]
      .map(([skillId, hours]) => ({
        skillId,
        name: skillNames.get(skillId) ?? skillId,
        hours: Math.round(hours * 10) / 10,
        pct: skillSum > 0 ? (hours / skillSum) * 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours),
    byArea: [...areaTotals.entries()]
      .map(([area, hours]) => ({
        area,
        hours: Math.round(hours * 10) / 10,
        pct: areaSum > 0 ? (hours / areaSum) * 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours),
  }
}

/* ============================================================================
   Projection
   ========================================================================= */

export interface Projection {
  /** Total estimated hours across every roadmap task. */
  totalHours: number
  hoursRemaining: number
  /** Weeks to finish at the recent velocity. */
  weeksAtCurrentPace: number | null
  projectedCompletion: ISODate | null
  /** Weeks to finish at the user's stated weekly target. */
  weeksAtTargetPace: number
  targetCompletion: ISODate
  /** Readiness projected forward to the programme end date. */
  readinessForecast: number
  onTrack: boolean
}

export function computeProjection(
  data: AppData,
  hours: HoursSummary,
  timeline: TimelinePosition,
  readiness: Readiness,
  today: ISODate,
): Projection {
  const allTasks = data.roadmap.chapters.flatMap((c) => c.missions.flatMap((m) => m.tasks))
  const totalHours = allTasks.reduce((sum, t) => sum + t.estimatedHours, 0)
  const doneHours = allTasks
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + t.estimatedHours, 0)
  const hoursRemaining = Math.max(0, totalHours - doneHours)

  const velocity = hours.weeklyVelocity
  const weeksAtCurrentPace = velocity > 0.5 ? Math.ceil(hoursRemaining / velocity) : null
  const projectedCompletion = weeksAtCurrentPace ? addDays(today, weeksAtCurrentPace * 7) : null

  const targetVelocity = Math.max(1, data.profile.weeklyHourTarget)
  const weeksAtTargetPace = Math.ceil(hoursRemaining / targetVelocity)
  const targetCompletion = addDays(today, weeksAtTargetPace * 7)

  // Linear extrapolation of the readiness trend across the remaining horizon.
  const history = data.analytics.readinessHistory
  let forecast = readiness.score
  if (history.length >= 2) {
    const first = history[0]
    const last = history[history.length - 1]
    const span = Math.max(1, daysBetween(first.date, last.date))
    const perDay = (last.score - first.score) / span
    forecast = clamp(readiness.score + perDay * timeline.daysRemaining)
  }

  return {
    totalHours: Math.round(totalHours),
    hoursRemaining: Math.round(hoursRemaining),
    weeksAtCurrentPace,
    projectedCompletion,
    weeksAtTargetPace,
    targetCompletion,
    readinessForecast: Math.round(forecast * 10) / 10,
    onTrack: projectedCompletion !== null && projectedCompletion <= timeline.endDate,
  }
}

/* ============================================================================
   Achievement rules engine
   ========================================================================= */

export interface AchievementState {
  unlocked: Set<ID>
  /** Progress toward each locked achievement, 0–100. */
  progress: Map<ID, { current: number; target: number; pct: number }>
  /** Newly satisfied this evaluation — drives the celebration. */
  newlyUnlocked: Achievement[]
}

function countCollection(data: AppData, collection: CountableCollection, filter?: string): number {
  switch (collection) {
    case 'published-case-studies':
      return data.portfolio.filter(
        (p) => p.publishStatus === 'published' && (p.kind === 'case-study' || p.kind === 'redesign'),
      ).length
    case 'published-portfolio':
      return data.portfolio.filter((p) => p.publishStatus === 'published').length
    case 'published-writing':
      return data.writing.filter((w) => w.status === 'published').length
    case 'finished-books':
      return data.books.filter(
        (b) => b.kind === 'book' && b.status === 'finished' && (filter !== 'core' || b.isCoreInterviewResource),
      ).length
    case 'completed-courses':
      return data.courses.filter((c) => c.status === 'done').length
    case 'mock-interviews':
      return data.interviews.mocks.length
    case 'questions-practiced':
      return data.interviews.questions.filter((q) => q.practiceCount > 0).length
    case 'contacts':
      return data.networking.contacts.length
    case 'referrals':
      return data.applications.applications.filter((a) => a.hasReferral).length
    case 'applications':
      return data.applications.applications.filter((a) => a.stage !== 'researching').length
    case 'teardowns':
      return data.portfolio.filter((p) => p.kind === 'teardown' && p.publishStatus === 'published').length
    case 'ai-projects':
      return data.portfolio.filter((p) => p.kind === 'ai-project' && p.completion >= 100).length
    case 'completed-tasks':
      return (
        data.roadmap.chapters
          .flatMap((c) => c.missions.flatMap((m) => m.tasks))
          .filter((t) => t.status === 'done').length + data.tasks.filter((t) => t.status === 'done').length
      )
    case 'journal-entries':
      return data.journal.entries.length
    default:
      return 0
  }
}

/** Returns current value and the threshold for any criterion. */
function evaluateCriterion(
  criterion: AchievementCriterion,
  data: AppData,
  context: { hours: number; xp: number; level: number; streak: number; readiness: number },
): { current: number; target: number } {
  switch (criterion.type) {
    case 'total-hours':
      return { current: context.hours, target: criterion.value }
    case 'total-xp':
      return { current: context.xp, target: criterion.value }
    case 'level':
      return { current: context.level, target: criterion.value }
    case 'streak-days':
      return { current: context.streak, target: criterion.value }
    case 'readiness':
      return { current: context.readiness, target: criterion.value }
    case 'skill-score': {
      const skill = data.skills.find((s) => s.id === criterion.skillId)
      return { current: skill?.currentScore ?? 0, target: criterion.value }
    }
    case 'count':
      return { current: countCollection(data, criterion.collection, criterion.filter), target: criterion.value }
    case 'chapter-complete': {
      const chapter = data.roadmap.chapters.find((c) => c.month === criterion.month)
      return { current: chapter ? chapterProgress(chapter).pct : 0, target: 100 }
    }
    case 'all-chapters-in-quarter': {
      const chapters = data.roadmap.chapters.filter((c) => c.quarter === criterion.quarter)
      if (chapters.length === 0) return { current: 0, target: 100 }
      const avg = chapters.reduce((sum, c) => sum + chapterProgress(c).pct, 0) / chapters.length
      return { current: avg, target: 100 }
    }
    case 'manual':
    default:
      // Manual achievements are unlocked by the user, never by the engine.
      return { current: 0, target: 1 }
  }
}

export function evaluateAchievements(
  data: AppData,
  context: { hours: number; xp: number; level: number; streak: number; readiness: number },
): AchievementState {
  const unlocked = new Set<ID>()
  const progress = new Map<ID, { current: number; target: number; pct: number }>()
  const newlyUnlocked: Achievement[] = []

  for (const achievement of data.achievements.achievements) {
    const wasUnlocked = Boolean(achievement.unlockedAt)

    if (achievement.criterion.type === 'manual') {
      // Manual achievements are purely user-driven.
      if (wasUnlocked) unlocked.add(achievement.id)
      progress.set(achievement.id, { current: wasUnlocked ? 1 : 0, target: 1, pct: wasUnlocked ? 100 : 0 })
      continue
    }

    const { current, target } = evaluateCriterion(achievement.criterion, data, context)
    const satisfied = current >= target

    // Once earned, an achievement stays earned — undoing a task should not
    // revoke a badge the user genuinely reached.
    if (satisfied || wasUnlocked) unlocked.add(achievement.id)
    if (satisfied && !wasUnlocked) newlyUnlocked.push(achievement)

    progress.set(achievement.id, {
      current: Math.round(current * 10) / 10,
      target,
      pct: clamp((current / Math.max(target, 0.0001)) * 100),
    })
  }

  return { unlocked, progress, newlyUnlocked }
}

/** Badge level reached, given the same context. */
export function evaluateBadges(
  data: AppData,
  context: { hours: number; xp: number; level: number; streak: number; readiness: number },
) {
  return data.achievements.badges.map((badge) => {
    const { current } = evaluateCriterion(badge.criterion, data, context)
    let levelIndex = -1
    for (let i = 0; i < badge.levels.length; i += 1) {
      if (current >= badge.levels[i].threshold) levelIndex = i
    }
    const next = badge.levels[levelIndex + 1]
    const floor = levelIndex >= 0 ? badge.levels[levelIndex].threshold : 0
    return {
      badge,
      current: Math.round(current * 10) / 10,
      levelIndex,
      levelLabel: levelIndex >= 0 ? badge.levels[levelIndex].label : 'Locked',
      next,
      pctToNext: next ? clamp(((current - floor) / (next.threshold - floor)) * 100) : 100,
      maxed: !next,
    }
  })
}

/* ============================================================================
   Recommendations
   ----------------------------------------------------------------------------
   Ranked by expected readiness gain per hour, so the top of the list is always
   the highest-leverage next action rather than the noisiest one.
   ========================================================================= */

export interface Recommendation {
  id: string
  title: string
  reason: string
  actions: string[]
  /** Estimated readiness points gained. */
  expectedGain: number
  estimatedHours: number
  /** Readiness points per hour — the actual ranking key. */
  leverage: number
  urgency: 'critical' | 'high' | 'medium'
  route: string
  routeLabel: string
  tier?: GapTier
}

export function computeRecommendations(
  data: AppData,
  readiness: Readiness,
  timeline: TimelinePosition,
  hours: HoursSummary,
): Recommendation[] {
  const out: Recommendation[] = []
  const skillById = new Map(data.skills.map((s) => [s.id, s]))

  /* --- Must-fix competencies with the largest weighted gap ---------------- */
  const mustFix = data.skills
    .filter((s) => s.tier === 'must-fix' && s.currentScore < s.targetScore)
    .map((s) => ({
      skill: s,
      // Points of headline readiness recovered by closing this skill's gap.
      gain:
        ((s.targetScore - s.currentScore) / 10) *
        (s.weight / data.skills.reduce((sum, x) => sum + x.weight, 0)) *
        100 *
        PILLAR_WEIGHTS.competency,
    }))
    .sort((a, b) => b.gain - a.gain)

  for (const { skill, gain } of mustFix.slice(0, 3)) {
    const estHours = Math.round((skill.targetScore - skill.currentScore) * 22)
    out.push({
      id: `rec_skill_${skill.id}`,
      title: `Raise ${skill.name} from ${skill.currentScore.toFixed(1)} to ${skill.targetScore.toFixed(1)}`,
      reason: `${skill.name} is a must-fix competency at ${skill.currentScore.toFixed(1)}/10 and carries ${(skill.weight * 100).toFixed(0)}% of the competency weight. ${skill.whyItMatters}`,
      actions: skill.improvementPlan.slice(0, 3),
      expectedGain: Math.round(gain * 10) / 10,
      estimatedHours: estHours,
      leverage: gain / Math.max(1, estHours),
      urgency: 'critical',
      route: `/skills#${skill.id}`,
      routeLabel: 'Open skill',
      tier: 'must-fix',
    })
  }

  /* --- Publish something: the evidence pillar is the biggest headroom ----- */
  const evidencePillar = readiness.pillars.find((p) => p.key === 'evidence')
  const publishable = data.portfolio
    .filter((p) => p.publishStatus !== 'published' && p.completion > 0)
    .sort((a, b) => b.completion - a.completion)
  const nextArtefact =
    publishable[0] ?? [...data.portfolio].filter((p) => p.publishStatus !== 'published').sort((a, b) => a.roiRank - b.roiRank)[0]

  if (nextArtefact && evidencePillar) {
    const remainingHours = Math.max(1, nextArtefact.estimatedHours - nextArtefact.actualHours)
    // Each of the seven target artefacts is worth 1/7 of the artefact sub-score,
    // which is half the evidence pillar.
    const gain = (100 / 7) * 0.5 * PILLAR_WEIGHTS.evidence
    out.push({
      id: `rec_publish_${nextArtefact.id}`,
      title: `Publish "${nextArtefact.title}"`,
      reason: `Evidence is your weakest pillar at ${evidencePillar.score.toFixed(0)}/100, with ${evidencePillar.headroom.toFixed(1)} readiness points still available from it. This is ROI rank #${nextArtefact.roiRank} in the audit's portfolio list, and it is ${nextArtefact.completion}% done.`,
      actions: [
        nextArtefact.completion > 0 ? 'Finish the remaining sections' : 'Start with problem framing and user evidence',
        'Add the metrics section — no artefact ships without one',
        'Publish, then share it directly with five relevant people',
      ],
      expectedGain: Math.round(gain * 10) / 10,
      estimatedHours: Math.round(remainingHours),
      leverage: gain / remainingHours,
      urgency: 'critical',
      route: '/portfolio',
      routeLabel: 'Open portfolio',
    })
  }

  /* --- Quantify impact: zero marginal hours, high gain -------------------- */
  const quantified = data.skills.flatMap((s) => s.evidence).filter((e) => e.kind === 'metric').length
  if (quantified < 6) {
    const gain = ((6 - quantified) / 6) * 100 * 0.25 * PILLAR_WEIGHTS.evidence
    out.push({
      id: 'rec_quantify',
      title: `Quantify ${6 - quantified} more outcomes from your current role`,
      reason:
        'The audit\'s first instruction if it were responsible for getting you hired, and it costs almost no marginal hours — the work is already done, the numbers simply are not written down.',
      actions: [
        'Pick initiatives you genuinely owned',
        'Find or estimate: ARR influenced, retention, activation, churn, tickets, engineering time saved',
        'Add each as metric evidence against the relevant competency',
      ],
      expectedGain: Math.round(gain * 10) / 10,
      estimatedHours: 5,
      leverage: gain / 5,
      urgency: 'critical',
      route: '/skills',
      routeLabel: 'Add evidence',
    })
  }

  /* --- Current chapter, if it is behind the calendar ---------------------- */
  if (timeline.currentChapter) {
    const chapter = timeline.currentChapter
    const progress = chapterProgress(chapter)
    if (progress.pct < 90) {
      const openTasks = chapter.missions
        .flatMap((m) => m.tasks)
        .filter((t) => t.status !== 'done')
      const remainingHours = openTasks.reduce((sum, t) => sum + t.estimatedHours, 0)
      out.push({
        id: `rec_chapter_${chapter.id}`,
        title: `Finish Month ${chapter.month}: ${chapter.title}`,
        reason: `You are ${progress.pct.toFixed(0)}% through the current chapter with ${openTasks.length} tasks open. Target output: ${chapter.measurableOutput}`,
        actions: openTasks.slice(0, 3).map((t) => t.title),
        expectedGain: 2.5,
        estimatedHours: Math.round(remainingHours),
        leverage: 2.5 / Math.max(1, remainingHours),
        urgency: progress.pct < 50 ? 'high' : 'medium',
        route: '/learning-path',
        routeLabel: 'Open learning path',
      })
    }
  }

  /* --- Interview pillar: mock volume ------------------------------------- */
  const interviewPillar = readiness.pillars.find((p) => p.key === 'interview')
  const mockCount = data.interviews.mocks.length
  // The cadence formally begins in month 10 but starting early is free.
  const expectedMocks = Math.max(0, (timeline.currentMonth - 9) * 8)
  if (interviewPillar && (mockCount < expectedMocks || timeline.currentMonth >= 9)) {
    const behind = Math.max(0, expectedMocks - mockCount)
    const gain = (8 / 100) * 100 * 0.3 * PILLAR_WEIGHTS.interview
    out.push({
      id: 'rec_mocks',
      title: behind > 0 ? `Catch up ${behind} mock interviews` : 'Run 8 mock interviews this month',
      reason:
        behind > 0
          ? `You are ${behind} mocks behind the two-per-week cadence the audit prescribes from month 10. Applying before you are interview-ready wastes referrals — one of the three biggest mistakes in the audit.`
          : 'Two mock interviews per week from month 10 to 24 is roughly 120 mocks. Volume plus recorded feedback is what makes performance reliable rather than variable.',
      actions: [
        'Book two mocks for this week now, not later',
        'Over-index on metrics and analytics — your weakest tracks',
        'Record every one and score it against the same rubric',
      ],
      expectedGain: Math.round(gain * 10) / 10,
      estimatedHours: 12,
      leverage: gain / 12,
      urgency: timeline.currentMonth >= 10 ? 'critical' : 'medium',
      route: '/interview-prep',
      routeLabel: 'Open interview prep',
    })
  }

  /* --- Writing cadence --------------------------------------------------- */
  const published = data.writing.filter((w) => w.status === 'published').length
  if (published < timeline.currentMonth) {
    const behind = timeline.currentMonth - published
    const gain = (1 / 12) * 100 * 0.25 * PILLAR_WEIGHTS.evidence
    out.push({
      id: 'rec_writing',
      title: behind > 1 ? `Publish an article — you are ${behind} behind` : 'Publish this month\'s long-form article',
      reason:
        'One long-form article per month for 24 months is a throughput commitment, not a nice-to-have. Outside your network almost nobody knows you, and that is a distribution problem rather than a talent problem.',
      actions: [
        'Pick the draft closest to finished',
        'Cut it to the single strongest idea',
        'Publish, then post the most surprising finding on LinkedIn',
      ],
      expectedGain: Math.round(gain * 10) / 10,
      estimatedHours: 6,
      leverage: gain / 6,
      urgency: behind > 2 ? 'high' : 'medium',
      route: '/writing',
      routeLabel: 'Open writing',
    })
  }

  /* --- Networking: referrals are the conversion lever -------------------- */
  const referrals = data.applications.applications.filter((a) => a.hasReferral).length
  const warmContacts = data.networking.contacts.filter((c) => c.relationshipStrength >= 3).length
  if (referrals < 5 && timeline.currentMonth >= 6) {
    const gain = ((5 - referrals) / 5) * 100 * 0.35 * PILLAR_WEIGHTS.presence
    out.push({
      id: 'rec_referrals',
      title: `Convert warm contacts into referrals (${referrals} of 5)`,
      reason: `You have ${warmContacts} relationships at strength 3 or above. Referral-backed applications are the audit's explicit recommendation over high-volume submissions, and five referrals from target companies is a stated success metric.`,
      actions: [
        'Review contacts with a next action overdue',
        'Ask specifically, and make it easy to say yes',
        'Lead with an artefact rather than a request',
      ],
      expectedGain: Math.round(gain * 10) / 10,
      estimatedHours: 8,
      leverage: gain / 8,
      urgency: timeline.currentMonth >= 11 ? 'high' : 'medium',
      route: '/networking',
      routeLabel: 'Open networking',
    })
  }

  /* --- Capacity warning -------------------------------------------------- */
  if (hours.weeklyVelocity > 0 && hours.weeklyVelocity < data.profile.weeklyHourTarget * 0.6) {
    out.push({
      id: 'rec_capacity',
      title: `Velocity is ${hours.weeklyVelocity.toFixed(1)}h/week against a ${data.profile.weeklyHourTarget}h target`,
      reason:
        'At this pace the roadmap does not finish inside the horizon. Either protect the hours or reduce the plan deliberately — the audit\'s five-hour allocation exists precisely for weeks like this.',
      actions: [
        'Check the 5h/week allocation on the Leverage page',
        'Cut the lowest-ROI commitment rather than doing everything badly',
        'Block the two non-negotiable days in a calendar',
      ],
      expectedGain: 0,
      estimatedHours: 1,
      leverage: 0.001,
      urgency: 'high',
      route: '/leverage',
      routeLabel: 'Open 80/20',
    })
  }

  void skillById

  // Rank by readiness points per hour: the definition of leverage.
  return out.sort((a, b) => b.leverage - a.leverage)
}

/* ============================================================================
   Goal periods
   ========================================================================= */

export function periodKey(cadence: 'weekly' | 'monthly' | 'quarterly' | 'yearly', date: ISODate, weekStartsOn: 0 | 1): string {
  switch (cadence) {
    case 'weekly':
      return startOfWeek(date, weekStartsOn)
    case 'monthly':
      return date.slice(0, 7)
    case 'quarterly':
      return `${date.slice(0, 4)}-Q${Math.floor(Number(date.slice(5, 7)) / 3.001) + 1}`
    case 'yearly':
    default:
      return date.slice(0, 4)
  }
}

/* ============================================================================
   Composed snapshot
   ========================================================================= */

export interface Derived {
  today: ISODate
  readiness: Readiness
  xp: XpBreakdown
  streak: StreakInfo
  timeline: TimelinePosition
  hours: HoursSummary
  projection: Projection
  achievements: AchievementState
  badges: ReturnType<typeof evaluateBadges>
  recommendations: Recommendation[]
  /** Overall roadmap task completion. */
  roadmapProgress: TaskProgress
  weekProgress: { done: number; total: number; pct: number }
  monthProgress: { done: number; total: number; pct: number }
  quarterProgress: { done: number; total: number; pct: number }
  latestAchievement?: Achievement
}

export function derive(data: AppData, now: ISODate = todayISO()): Derived {
  const weekStartsOn = data.settings.weekStartsOn ?? 1

  const readiness = computeReadiness(data)
  const streak = computeStreaks(data, now)
  const timeline = computeTimeline(data, now)
  const hours = computeHours(data, now, weekStartsOn)

  // Achievements need XP and XP needs achievements, so evaluate once without
  // achievement XP, then re-evaluate with it. Two passes converge because
  // achievement XP only ever increases the total.
  const firstPass = computeXp(data, new Set())
  const achievements = evaluateAchievements(data, {
    hours: hours.total,
    xp: firstPass.total,
    level: firstPass.level,
    streak: streak.longest,
    readiness: readiness.score,
  })
  const xp = computeXp(data, achievements.unlocked)
  const badges = evaluateBadges(data, {
    hours: hours.total,
    xp: xp.total,
    level: xp.level,
    streak: streak.longest,
    readiness: readiness.score,
  })

  const projection = computeProjection(data, hours, timeline, readiness, now)
  const recommendations = computeRecommendations(data, readiness, timeline, hours)

  const allRoadmapTasks = data.roadmap.chapters.flatMap((c) => c.missions.flatMap((m) => m.tasks))
  const roadmapProgress = taskProgress(allRoadmapTasks)

  /* --- Goal-period progress: share of active goals hit this period -------- */
  const goalsFor = (cadence: 'weekly' | 'monthly' | 'quarterly') => {
    const goals = data.goals.filter((g) => g.active && g.cadence === cadence)
    const done = goals.filter((g) => g.current >= g.target).length
    const pct = goals.length
      ? (goals.reduce((sum, g) => sum + Math.min(1, g.target > 0 ? g.current / g.target : 0), 0) / goals.length) * 100
      : 0
    return { done, total: goals.length, pct }
  }

  const unlockedList = data.achievements.achievements
    .filter((a) => a.unlockedAt)
    .sort((a, b) => (a.unlockedAt! < b.unlockedAt! ? 1 : -1))

  return {
    today: now,
    readiness,
    xp,
    streak,
    timeline,
    hours,
    projection,
    achievements,
    badges,
    recommendations,
    roadmapProgress,
    weekProgress: goalsFor('weekly'),
    monthProgress: goalsFor('monthly'),
    quarterProgress: goalsFor('quarterly'),
    latestAchievement: unlockedList[0],
  }
}
