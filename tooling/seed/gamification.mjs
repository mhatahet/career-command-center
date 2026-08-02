/**
 * Achievements, badges, goals and the Today board.
 *
 * Achievement criteria are declarative — the client's rules engine evaluates
 * them against derived stats, so unlocks are computed rather than stored as
 * opinions. Adding an achievement means adding a row here, not writing code.
 *
 * Goals come straight from Part 10 (Weekly / Monthly / Quarterly KPIs) and the
 * throughput commitments in Part 4.
 */

import { SKILL_IDS as S } from './skills.mjs'
import { PROGRAMME_START, SEED_TODAY, addDays, id, stampAt } from './util.mjs'

/* -------------------------------------------------------- achievements --- */

/**
 * [id, name, description, icon, tier, xp, category, criterion]
 *
 * The named achievements from the brief all appear here, plus the ones the
 * roadmap missions reference. Tiers escalate with the difficulty of the proof.
 */
const ACHIEVEMENTS = [
  // ---- Learning ----------------------------------------------------------
  ['ach_first-step', 'First Step', 'Complete your first task. Everything compounds from here.', '🌱', 'bronze', 50, 'learning', { type: 'count', collection: 'completed-tasks', value: 1 }],
  ['ach_sql-beginner', 'SQL Beginner', 'Finish SQLBolt and write your first join from memory.', '🔤', 'bronze', 100, 'analytics', { type: 'skill-score', skillId: S['Analytics'], value: 7.0 }],
  ['ach_sql-intermediate', 'SQL Intermediate', 'Complete 50 interview-grade SQL questions. Window functions without looking them up.', '🧮', 'silver', 300, 'analytics', { type: 'skill-score', skillId: S['Analytics'], value: 8.0 }],
  ['ach_sql-advanced', 'SQL Advanced', 'Analytics at 9.0. SQL is no longer a weakness on any resume you write.', '⚡', 'gold', 600, 'analytics', { type: 'skill-score', skillId: S['Analytics'], value: 9.0 }],
  ['ach_metrics-architect', 'Metrics Architect', 'Build five complete metric trees, north star through guardrails.', '🌳', 'silver', 300, 'analytics', { type: 'skill-score', skillId: S['Metrics'], value: 8.0 }],
  ['ach_analytics-explorer', 'Analytics Explorer', 'Publish an analytics case study with funnel, retention and cohort analysis.', '🔍', 'silver', 350, 'analytics', { type: 'count', collection: 'published-portfolio', value: 1 }],
  ['ach_experiment-designer', 'Experiment Designer', 'Design ten complete A/B test plans and have them critiqued.', '🧪', 'gold', 500, 'analytics', { type: 'skill-score', skillId: S['Experimentation'], value: 8.0 }],
  ['ach_100-hours', '100 Hours Learned', 'One hundred hours of deliberate practice logged.', '💯', 'silver', 250, 'learning', { type: 'total-hours', value: 100 }],
  ['ach_250-hours', '250 Hours Learned', 'Two hundred and fifty hours. This is where competence starts to show.', '🎯', 'gold', 500, 'learning', { type: 'total-hours', value: 250 }],
  ['ach_500-hours', '500 Hours Learned', 'Five hundred hours. Roughly the total the 80/20 table asks for.', '🏔', 'gold', 900, 'learning', { type: 'total-hours', value: 500 }],
  ['ach_1000-hours', '1,000 Hours Learned', 'A thousand hours of deliberate practice. Very few people get here.', '👑', 'platinum', 2000, 'learning', { type: 'total-hours', value: 1000 }],
  ['ach_bookworm', 'Well Read', 'Finish six books. The audit asks for two to three per quarter.', '📚', 'silver', 300, 'learning', { type: 'count', collection: 'finished-books', value: 6 }],
  ['ach_core-six', 'The Core Six', 'Finish all six interview resources named in the audit.', '📖', 'gold', 600, 'interview', { type: 'count', collection: 'finished-books', value: 6, filter: 'core' }],
  ['ach_course-complete', 'Course Complete', 'Finish three courses and convert each into a real artefact.', '🎓', 'silver', 250, 'learning', { type: 'count', collection: 'completed-courses', value: 3 }],

  // ---- Portfolio ---------------------------------------------------------
  ['ach_first-case-study', 'First Case Study', 'Publish your first complete case study. The portfolio stops being hypothetical.', '📄', 'silver', 400, 'portfolio', { type: 'count', collection: 'published-case-studies', value: 1 }],
  ['ach_portfolio-three', 'Portfolio Momentum', 'Three published artefacts. A pattern rather than an accident.', '📁', 'silver', 500, 'portfolio', { type: 'count', collection: 'published-portfolio', value: 3 }],
  ['ach_portfolio-master', 'Portfolio Master', 'Six published artefacts — the audit\'s success metric for a competitive portfolio.', '🗂', 'gold', 1000, 'portfolio', { type: 'count', collection: 'published-portfolio', value: 6 }],
  ['ach_portfolio-eight', 'Portfolio Complete', 'Eight published artefacts. The top of the audit\'s stated range.', '🏛', 'platinum', 1500, 'portfolio', { type: 'count', collection: 'published-portfolio', value: 8 }],
  ['ach_ai-builder', 'AI Builder', 'Ship an AI product with a real evaluation set, not a demo.', '🤖', 'gold', 600, 'portfolio', { type: 'count', collection: 'ai-projects', value: 1 }],
  ['ach_teardown-series', 'Teardown Specialist', 'Publish five product teardowns. A series that compounds.', '🔩', 'gold', 550, 'portfolio', { type: 'count', collection: 'teardowns', value: 5 }],
  ['ach_open-source', 'Open Source Contributor', 'Get a contribution merged into a reputable project.', '🌐', 'silver', 350, 'portfolio', { type: 'count', collection: 'published-portfolio', value: 7 }],
  ['ach_discovery-specialist', 'Discovery Specialist', 'Product Discovery at 8.5. Ten interviews and a real opportunity tree behind it.', '🧭', 'gold', 500, 'portfolio', { type: 'skill-score', skillId: S['Product Discovery'], value: 8.5 }],
  ['ach_systems-thinker', 'Systems Thinker', 'Publish two architecture documents an engineer would sign off on.', '🕸', 'gold', 550, 'portfolio', { type: 'skill-score', skillId: S['Technical Depth'], value: 8.5 }],
  ['ach_product-strategist', 'Product Strategist', 'Product Strategy at 8.8. "Should we build this at all?" is now your natural altitude.', '♟', 'gold', 600, 'portfolio', { type: 'skill-score', skillId: S['Product Strategy'], value: 8.8 }],
  ['ach_growth-analyst', 'Growth Analyst', 'Model a growth loop, find the leak, size the fix.', '📈', 'silver', 400, 'portfolio', { type: 'skill-score', skillId: S['Business Thinking'], value: 8.8 }],
  ['ach_product-sense-20', 'Twenty Critiques', 'Twenty structured product critiques, including the consumer ones.', '👁', 'silver', 400, 'learning', { type: 'skill-score', skillId: S['Product Sense'], value: 8.5 }],

  // ---- Brand -------------------------------------------------------------
  ['ach_first-article', 'Published', 'Publish your first long-form article. Discoverability starts now.', '✍️', 'bronze', 150, 'brand', { type: 'count', collection: 'published-writing', value: 1 }],
  ['ach_top-writer', 'Top Writer', 'Publish six long-form articles. A body of work, not a post.', '🖊', 'gold', 600, 'brand', { type: 'count', collection: 'published-writing', value: 6 }],
  ['ach_writer-24', 'Twenty-Four Articles', 'One article a month for twenty-four months. The full cadence, unbroken.', '📰', 'platinum', 1600, 'brand', { type: 'count', collection: 'published-writing', value: 24 }],
  ['ach_networking-champion', 'Networking Champion', 'A hundred meaningful professional connections.', '🤝', 'gold', 550, 'brand', { type: 'count', collection: 'contacts', value: 100 }],
  ['ach_first-referral', 'First Referral', 'Someone puts their own reputation behind you.', '🎫', 'gold', 500, 'brand', { type: 'count', collection: 'referrals', value: 1 }],
  ['ach_five-referrals', 'Referral Network', 'Five referrals from target companies — an audit success metric.', '🎟', 'platinum', 1200, 'brand', { type: 'count', collection: 'referrals', value: 5 }],

  // ---- Interview ---------------------------------------------------------
  ['ach_first-mock', 'First Mock', 'Complete your first mock interview. It is meant to be uncomfortable.', '🎤', 'bronze', 100, 'interview', { type: 'count', collection: 'mock-interviews', value: 1 }],
  ['ach_mock-interview-expert', 'Mock Interview Expert', 'Twenty-five mock interviews completed and reviewed.', '🎙', 'gold', 700, 'interview', { type: 'count', collection: 'mock-interviews', value: 25 }],
  ['ach_mock-century', 'Mock Century', 'A hundred mock interviews. Performance is now reliable, not lucky.', '🏅', 'platinum', 1800, 'interview', { type: 'count', collection: 'mock-interviews', value: 100 }],
  ['ach_question-bank', 'Question Bank Cleared', 'Practise fifty questions from the bank at least once.', '🗃', 'silver', 350, 'interview', { type: 'count', collection: 'questions-practiced', value: 50 }],
  ['ach_first-application', 'In the Arena', 'Submit your first targeted application.', '📮', 'bronze', 150, 'milestone', { type: 'count', collection: 'applications', value: 1 }],
  ['ach_fifty-applications', 'Fifty Applications', 'Fifty targeted, referral-backed applications.', '📬', 'gold', 700, 'milestone', { type: 'count', collection: 'applications', value: 50 }],

  // ---- Consistency -------------------------------------------------------
  ['ach_streak-7', 'One Week', 'A seven-day streak.', '🔥', 'bronze', 100, 'consistency', { type: 'streak-days', value: 7 }],
  ['ach_streak-30', 'One Month', 'A thirty-day streak. The habit is real now.', '🔥', 'silver', 300, 'consistency', { type: 'streak-days', value: 30 }],
  ['ach_streak-100', 'Hundred Day Streak', 'A hundred consecutive days. This is the thing that actually predicts the outcome.', '☄️', 'gold', 800, 'consistency', { type: 'streak-days', value: 100 }],
  ['ach_streak-365', 'A Full Year', 'Three hundred and sixty-five consecutive days.', '🌟', 'platinum', 2500, 'consistency', { type: 'streak-days', value: 365 }],
  ['ach_journal-30', 'Reflective Practitioner', 'Thirty journal entries. Reflection is what turns hours into learning.', '📔', 'silver', 250, 'consistency', { type: 'count', collection: 'journal-entries', value: 30 }],

  // ---- Milestones --------------------------------------------------------
  ['ach_chapter-1', 'Month One Complete', 'Finish the SQL and metrics chapter. The hardest month is the first one.', '1️⃣', 'silver', 300, 'milestone', { type: 'chapter-complete', month: 1 }],
  ['ach_quarter-1', 'Foundations Laid', 'Complete every chapter in Q1: SQL, analytics, experimentation.', '🧱', 'gold', 700, 'milestone', { type: 'all-chapters-in-quarter', quarter: 1 }],
  ['ach_level-10', 'Level 10', 'Reach level 10.', '⭐', 'silver', 0, 'milestone', { type: 'level', value: 10 }],
  ['ach_level-25', 'Level 25', 'Reach level 25.', '✨', 'gold', 0, 'milestone', { type: 'level', value: 25 }],
  ['ach_level-50', 'Level 50', 'Reach level 50.', '💫', 'platinum', 0, 'milestone', { type: 'level', value: 50 }],
  ['ach_career-sprint-complete', 'Career Sprint Complete', 'Finish the first twelve months of the roadmap.', '🚩', 'gold', 1200, 'milestone', { type: 'chapter-complete', month: 12 }],
  ['ach_halfway', 'Halfway There', 'Twelve months down, twelve to go.', '⏳', 'gold', 800, 'milestone', { type: 'chapter-complete', month: 12 }],
  ['ach_top-10-percent', 'Top 10% Ready', 'Readiness score of 80. Competitive for most Tier 2 companies.', '🥈', 'gold', 1000, 'milestone', { type: 'readiness', value: 80 }],
  ['ach_faang-ready', 'FAANG Ready', 'Readiness score of 90. The Tier 1 bar, on your own evidence.', '🥇', 'platinum', 2500, 'milestone', { type: 'readiness', value: 90 }],
  ['ach_no-weak-scores', 'No Weak Links', 'Every competency at 8.0 or above. Nothing left for an interviewer to find.', '🛡', 'platinum', 2000, 'milestone', { type: 'manual' }],
  ['ach_offer', 'Offer in Hand', 'Receive an offer from a target company. The whole point.', '🎉', 'platinum', 5000, 'milestone', { type: 'manual' }],
]

/** Progressive badges — one row, many levels, so progress is always visible. */
const BADGES = [
  ['bdg_hours', 'Hours Invested', 'Total deliberate practice logged.', '⏱', 'learning',
    [['Novice', 25], ['Apprentice', 100], ['Practitioner', 250], ['Expert', 500], ['Master', 1000]],
    { type: 'total-hours', value: 1000 }],
  ['bdg_streak', 'Consistency', 'Longest unbroken streak of logged work.', '🔥', 'consistency',
    [['Spark', 7], ['Flame', 30], ['Blaze', 60], ['Inferno', 100], ['Eternal', 365]],
    { type: 'streak-days', value: 365 }],
  ['bdg_portfolio', 'Portfolio', 'Published public artefacts.', '🗂', 'portfolio',
    [['First', 1], ['Building', 3], ['Credible', 5], ['Competitive', 6], ['Exceptional', 8]],
    { type: 'count', collection: 'published-portfolio', value: 8 }],
  ['bdg_mocks', 'Interview Reps', 'Mock interviews completed.', '🎤', 'interview',
    [['Starting', 1], ['Warming Up', 10], ['Practised', 25], ['Sharp', 50], ['Relentless', 100]],
    { type: 'count', collection: 'mock-interviews', value: 100 }],
  ['bdg_writing', 'Published Writing', 'Long-form articles published.', '✍️', 'brand',
    [['Debut', 1], ['Regular', 3], ['Prolific', 6], ['Authority', 12], ['Body of Work', 24]],
    { type: 'count', collection: 'published-writing', value: 24 }],
  ['bdg_network', 'Network', 'Meaningful professional connections.', '🤝', 'brand',
    [['Seeded', 10], ['Growing', 30], ['Connected', 60], ['Well Networked', 100], ['Influential', 200]],
    { type: 'count', collection: 'contacts', value: 200 }],
  ['bdg_readiness', 'Career Readiness', 'Overall weighted readiness score.', '🎯', 'milestone',
    [['Emerging', 60], ['Solid', 70], ['Strong', 80], ['Tier-1 Ready', 90], ['Exceptional', 95]],
    { type: 'readiness', value: 95 }],
  ['bdg_books', 'Reading', 'Books finished.', '📚', 'learning',
    [['Started', 1], ['Reading', 3], ['Well Read', 6], ['Scholar', 12], ['Voracious', 20]],
    { type: 'count', collection: 'finished-books', value: 20 }],
]

export function buildAchievements() {
  // Unlocked at seed time: only what the first month's real progress supports.
  // Everything else is computed by the client's rules engine as work is logged.
  const unlockedIds = new Set(['ach_first-step', 'ach_first-mock', 'ach_streak-7', 'ach_sql-beginner'])

  const achievements = ACHIEVEMENTS.map(([aid, name, description, icon, tier, xp, category, criterion]) => ({
    id: aid,
    name,
    description,
    icon,
    tier,
    xp,
    criterion,
    unlockedAt: unlockedIds.has(aid) ? stampAt(addDays(PROGRAMME_START, aid === 'ach_first-step' ? 2 : 12)) : undefined,
    secret: false,
    category,
  }))

  const badges = BADGES.map(([bid, name, description, icon, category, levels, criterion]) => ({
    id: bid,
    name,
    description,
    icon,
    levels: levels.map(([label, threshold]) => ({ label, threshold })),
    criterion,
    category,
  }))

  return { achievements, badges }
}

/* --------------------------------------------------------------- goals --- */

/**
 * Part 10 verbatim, plus the Part 4 throughput commitments.
 * `current` holds this period's progress; `history` holds prior periods.
 */
const GOALS = [
  // Weekly KPIs
  ['5 SQL problems', 'The audit\'s first weekly KPI. Consistency beats intensity — five a week for a year is 260 problems.', 'weekly', 5, 'problems', 'sql', 'weekly-kpi', 4],
  ['1 portfolio artifact update', 'Move one portfolio artefact forward every single week, however slightly.', 'weekly', 1, 'update', 'portfolio', 'weekly-kpi', 1],
  ['1 interview case', 'One written case per week, all the way through to a recommendation.', 'weekly', 1, 'case', 'interview', 'weekly-kpi', 1],
  ['2 mock interviews', 'The core cadence from month 10 onward. Starting early is free.', 'weekly', 2, 'mocks', 'interview', 'weekly-kpi', 1],
  ['3 LinkedIn posts or comments of substance', 'Substance is the operative word — the audit explicitly warns against generic content.', 'weekly', 3, 'contributions', 'linkedin', 'weekly-kpi', 2],
  ['5 networking conversations', 'Conversations, not connection requests. The difference is everything.', 'weekly', 5, 'conversations', 'networking', 'weekly-kpi', 3],
  ['1 estimation exercise', 'Part 7 practice cadence. Estimation is the cheapest round to make reliable.', 'weekly', 1, 'exercise', 'interview', 'throughput', 1],

  // Monthly KPIs
  ['1 published case study', 'The monthly artefact. Twenty-four of these is the whole portfolio.', 'monthly', 1, 'case study', 'portfolio', 'monthly-kpi', 0],
  ['1 product teardown', 'Public teardowns build distribution while proving product sense.', 'monthly', 1, 'teardown', 'portfolio', 'monthly-kpi', 0],
  ['1 new portfolio project', 'One new project started or completed each month.', 'monthly', 1, 'project', 'portfolio', 'monthly-kpi', 1],
  ['20 meaningful new professional connections', 'Roughly five a week. Quality gate: could you say why you connected?', 'monthly', 20, 'connections', 'networking', 'monthly-kpi', 12],
  ['5 tailored job applications', 'Ramping to more later. Tailored is the operative word.', 'monthly', 5, 'applications', 'applications', 'monthly-kpi', 0],
  ['1 long-form article', 'The Part 4 throughput commitment. One a month for twenty-four months.', 'monthly', 1, 'article', 'writing', 'throughput', 0],
  ['1 interview performance review', 'Review your own scores monthly and find the repeating criticism.', 'monthly', 1, 'review', 'interview', 'monthly-kpi', 0],
  ['Refine behavioural stories', 'Part 7 asks for monthly refinement of the behavioural story library.', 'monthly', 1, 'review', 'interview', 'throughput', 0],

  // Quarterly KPIs
  ['3 public artifacts', 'Quarterly output floor. Three per quarter is twenty-four over the programme.', 'quarterly', 3, 'artifacts', 'portfolio', 'quarterly-kpi', 1],
  ['20 mock interviews completed', 'Quarterly total. Sustains the two-per-week cadence.', 'quarterly', 20, 'mocks', 'interview', 'quarterly-kpi', 2],
  ['1 major skill certification or demonstrable project', 'Demonstrable is the qualifier — a certificate alone does not count.', 'quarterly', 1, 'certification', 'course', 'quarterly-kpi', 0],
  ['1 measurable improvement in interview performance', 'The score has to move. Track it, do not assume it.', 'quarterly', 1, 'improvement', 'interview', 'quarterly-kpi', 0],
  ['Read 2–3 books', 'The Part 4 reading cadence.', 'quarterly', 3, 'books', 'reading', 'throughput', 0],
  ['Portfolio review', 'Quarterly checkpoint: is the portfolio still the strongest version of itself?', 'quarterly', 1, 'review', 'portfolio', 'quarterly-kpi', 0],
  ['Resume update with quantified impact', 'Quarterly checkpoint. Every bullet carries a number or it gets rewritten.', 'quarterly', 1, 'update', 'admin', 'quarterly-kpi', 0],
  ['Mock interview benchmark', 'Quarterly checkpoint: score yourself against the same rubric each quarter.', 'quarterly', 1, 'benchmark', 'interview', 'quarterly-kpi', 0],
  ['Networking and referral audit', 'Quarterly checkpoint: how many referrals and recruiter conversations did you generate?', 'quarterly', 1, 'audit', 'networking', 'quarterly-kpi', 0],

  // Yearly
  ['6–8 high-quality public portfolio artifacts', 'The audit\'s headline success metric.', 'yearly', 8, 'artifacts', 'portfolio', 'throughput', 1],
  ['Grow network by 1,000 relevant connections', 'Twenty a week, fifty weeks.', 'yearly', 1000, 'connections', 'networking', 'throughput', 60],
]

export function buildGoals() {
  return GOALS.map(([title, description, cadence, target, unit, area, source, current], index) => ({
    id: id('gl', title),
    title,
    description,
    cadence,
    target,
    unit,
    current,
    area,
    history: {},
    active: true,
    order: index,
    source,
  }))
}

/* --------------------------------------------------------------- tasks --- */

/** The Today board. Seeded with a realistic week's worth of work. */
const TASKS = [
  ['Solve 5 SQL window-function problems', 'high', 'sql', 1.5, 0, 'in-progress', 'daily'],
  ['Draft section 3 of the metric-tree article', 'high', 'writing', 1, 0, 'not-started', null],
  ['Mock interview with Ahmad — execution track', 'high', 'interview', 1, 1, 'not-started', 'weekly'],
  ['Read Lean Analytics chapter 5 (funnels)', 'medium', 'reading', 1, 0, 'not-started', null],
  ['Comment on 5 posts by PMs on the engagement list', 'medium', 'linkedin', 0.5, 0, 'not-started', 'daily'],
  ['Message Layla with the analytics case study outline', 'high', 'networking', 0.25, 1, 'not-started', null],
  ['Finish the KPI framework for the AI copilot', 'critical', 'analytics', 2, 0, 'in-progress', null],
  ['Pick the public dataset for the Month 2 case study', 'critical', 'analytics', 1, 2, 'not-started', null],
  ['Quantify the support-ticket reduction from the Q1 redesign', 'critical', 'admin', 2, 3, 'not-started', null],
  ['Set up the portfolio site case-study template', 'medium', 'portfolio', 1.5, 4, 'not-started', null],
  ['Write one estimation exercise: PMs in the world', 'low', 'interview', 0.5, 5, 'not-started', 'weekly'],
  ['Review and score last week\'s mock recordings', 'medium', 'interview', 0.75, 1, 'not-started', 'weekly'],
]

export function buildTasks() {
  return TASKS.map(([title, priority, area, hours, dayOffset, status, recurring], index) => ({
    id: id('tk', title),
    title,
    status,
    priority,
    area,
    estimatedHours: hours,
    dueDate: addDays(SEED_TODAY, dayOffset),
    scheduledFor: addDays(SEED_TODAY, dayOffset),
    skillIds: [],
    xp: Math.round(hours * 25),
    createdAt: stampAt(addDays(SEED_TODAY, -2), 9, 0),
    completedAt: undefined,
    sourceTaskId: undefined,
    order: index,
    recurring: recurring ?? undefined,
  }))
}
