/**
 * Part 11 — The 80/20 Strategy.
 *
 * The seven high-leverage actions are the audit's table verbatim, including the
 * Impact, Hours, Difficulty, Results-Visible and Long-Term-ROI columns. The
 * anti-patterns are the "Low-ROI Activities to Ignore" list, and the time
 * budgets are the "If You Have N Hours/Week" allocations.
 *
 * `timeToResultsMonths` is derived from the audit's stated range (its midpoint),
 * purely so the table can be sorted by time-to-results.
 */

import { id } from './util.mjs'

/** [action, impact, hours|null, difficulty, timeToResults, months, roi, category, rationale] */
const ACTIONS = [
  [
    'Build 6–8 world-class portfolio case studies',
    10, 200, 8, '3–6 months', 4.5, 'Very High', 'portfolio',
    'The single largest lever. The audit\'s core diagnosis is that your problem is proof, not capability — and a portfolio is proof that survives without you in the room.',
  ],
  [
    'Learn SQL + analytics deeply',
    10, 120, 6, '2–3 months', 2.5, 'Very High', 'analytics',
    'Highest impact per hour on the entire list. SQL is called non-negotiable, Analytics is 6.5/10, and it unblocks the metrics and experimentation work behind it.',
  ],
  [
    'Intensive interview practice',
    10, 150, 8, '2–4 months', 3, 'Very High', 'interview',
    'Protects everything else. Applying before you are interview-ready wastes referrals — the audit lists it as one of the three biggest mistakes PMs make.',
  ],
  [
    'Quantify business impact in current role',
    10, null, 7, '6–12 months', 9, 'Very High', 'admin',
    'Zero marginal hours — the work is already done, the numbers are simply not written down. The audit\'s first instruction if it were responsible for getting you hired.',
  ],
  [
    'Publish monthly long-form product articles',
    9, 100, 6, '3–6 months', 4.5, 'High', 'writing',
    'Fixes discoverability. Outside your network almost nobody knows you, and that is a distribution problem rather than a talent problem.',
  ],
  [
    'Build AI product projects',
    9, 120, 7, '3–6 months', 4.5, 'High', 'ai',
    'The fastest-appreciating asset on the list, and it compounds with your EdTech and AI-education background — an unusual combination few PMs have.',
  ],
  [
    'Strategic networking with PM leaders',
    9, null, 5, '3–9 months', 6, 'High', 'networking',
    'Lowest difficulty of any high-impact action. Referral-backed applications are the audit\'s explicit recommendation over high-volume submissions.',
  ],
]

/** "Low-ROI Activities to Ignore" — shown so the plan says what NOT to do. */
const ANTI_PATTERNS = [
  ['Collecting certificates without demonstrable application',
    'A certificate proves attendance. Employers hire demonstrated impact, so convert every course into a public artefact or skip the course.'],
  ['Publishing generic motivational LinkedIn content',
    'It attracts an audience that cannot hire you, and it dilutes the specific positioning that can.'],
  ['Rewriting your résumé weekly instead of improving experience',
    'The résumé is a rendering of your evidence. Improve the evidence and the résumé writes itself.'],
  ['Applying to hundreds of jobs without referrals or targeted preparation',
    'High volume without referrals converts poorly and burns the pipeline. Fifty targeted, referred applications beat five hundred cold ones.'],
  ['Spending excessive time on productivity tools or note-taking systems',
    'Real risk given the tooling instinct. This dashboard is only worth its build cost if the hours logged in it stay far below the hours logged doing the work.'],
]

/** "If You Have N Hours/Week" — the audit's own allocations. */
const TIME_BUDGETS = [
  {
    hoursPerWeek: 5,
    allocations: [
      { label: 'SQL and analytics', hours: 2, area: 'analytics' },
      { label: 'One portfolio artifact', hours: 1.5, area: 'portfolio' },
      { label: 'One interview case', hours: 1, area: 'interview' },
      { label: 'Networking or LinkedIn', hours: 0.5, area: 'networking' },
    ],
  },
  {
    hoursPerWeek: 10,
    allocations: [
      { label: 'SQL and analytics', hours: 2, area: 'analytics' },
      { label: 'One portfolio artifact', hours: 1.5, area: 'portfolio' },
      { label: 'One interview case', hours: 1, area: 'interview' },
      { label: 'Networking or LinkedIn', hours: 0.5, area: 'networking' },
      { label: 'Mock interview', hours: 1.5, area: 'interview' },
      { label: 'Product teardown', hours: 2, area: 'portfolio' },
      { label: 'AI project progress', hours: 1.5, area: 'ai' },
    ],
  },
  {
    hoursPerWeek: 20,
    allocations: [
      { label: 'SQL and analytics', hours: 2, area: 'analytics' },
      { label: 'One portfolio artifact', hours: 1.5, area: 'portfolio' },
      { label: 'One interview case', hours: 1, area: 'interview' },
      { label: 'Networking or LinkedIn', hours: 0.5, area: 'networking' },
      { label: 'Mock interview', hours: 1.5, area: 'interview' },
      { label: 'Product teardown', hours: 2, area: 'portfolio' },
      { label: 'AI project progress', hours: 1.5, area: 'ai' },
      { label: 'Major portfolio project', hours: 4, area: 'portfolio' },
      { label: 'Open-source contribution', hours: 2, area: 'portfolio' },
      { label: 'Long-form article', hours: 2, area: 'writing' },
      { label: 'Two additional mock interviews', hours: 1.5, area: 'interview' },
      { label: 'Expanded networking', hours: 0.5, area: 'networking' },
    ],
  },
]

export function buildLeverage() {
  return {
    actions: ACTIONS.map(([action, impact, hours, difficulty, timeToResults, months, roi, category, rationale]) => ({
      id: id('lv', action),
      action,
      impact,
      hours,
      isOngoing: hours === null,
      difficulty,
      timeToResults,
      timeToResultsMonths: months,
      longTermRoi: roi,
      category,
      isAntiPattern: false,
      rationale,
      linkedGoalIds: [],
    })),

    antiPatterns: ANTI_PATTERNS.map(([action, why]) => ({ id: id('ap', action), action, why })),

    timeBudgets: TIME_BUDGETS,

    /** The audit's one-year sequence. Order is the instruction. */
    oneYearSequence: [
      { step: 1, label: 'Analytics and SQL', detail: 'Everything else is more credible once this is real. Months 1–3.' },
      { step: 2, label: 'Portfolio with measurable outcomes', detail: 'Proof, with numbers in it. Months 2–6.' },
      { step: 3, label: 'AI product capability', detail: 'The fastest-appreciating differentiator. Month 5.' },
      { step: 4, label: 'Public writing', detail: 'Creates discoverability so opportunities find you. Month 7 onward.' },
      { step: 5, label: 'Interview mastery', detail: 'Protects the opportunities the earlier steps create. Months 10–11.' },
      { step: 6, label: 'Referral-driven applications', detail: 'Only once genuinely ready. Month 12 onward.' },
    ],

    /** The three biggest mistakes PMs make, per the audit. */
    mistakes: [
      {
        title: 'Confusing experience with evidence',
        detail: 'Employers hire demonstrated impact, not years of experience. This is the central diagnosis of your entire audit — the gap is proof, not capability.',
      },
      {
        title: 'Ignoring analytics',
        detail: 'Strategy without data is not credible in top-tier PM interviews. Avoiding analytics because execution feels more comfortable is the specific trap here.',
      },
      {
        title: 'Applying before becoming interview-ready',
        detail: 'Wasting referrals and opportunities before reaching a competitive level. Referrals are finite and largely non-renewable.',
      },
    ],

    /** Top 10 actions to start immediately. */
    startDoing: [
      'Learn SQL to an interview-ready level.',
      'Quantify business impact from your current work.',
      'Publish one flagship portfolio case study.',
      'Build an AI product project with clear evaluation metrics.',
      'Write one in-depth product article every month.',
      'Complete two mock interviews each week.',
      'Develop proficiency with Amplitude, Mixpanel, or equivalent analytics tools.',
      'Network consistently with senior PMs and recruiters.',
      'Prepare a reusable library of behavioral interview stories.',
      'Apply strategically through referrals once your portfolio is ready.',
    ],

    /** Top 10 actions to stop. */
    stopDoing: [
      'Chasing certificates without practical output.',
      'Applying broadly without customization.',
      'Spending excessive time polishing documents instead of creating evidence.',
      'Producing generic LinkedIn content.',
      'Avoiding analytics because execution feels more comfortable.',
      'Treating every feature equally instead of emphasizing measurable outcomes.',
      'Assuming enterprise SaaS experience alone is enough for FAANG.',
      'Delaying public work until it feels "perfect."',
      'Neglecting interview practice until applications start.',
      'Measuring progress by effort instead of observable results.',
    ],

    /** "If I Were Responsible for Getting You Hired" — the seven-step plan. */
    ifIWereResponsible: [
      'Quantify every significant outcome from your current role.',
      'Build a portfolio that demonstrates strategy, execution, analytics, and AI.',
      'Become proficient with SQL and product analytics.',
      'Publish consistently to create discoverability.',
      'Build relationships with PMs at target companies.',
      'Practice interviews until performance is consistently strong.',
      'Pursue targeted, referral-backed applications rather than high-volume submissions.',
    ],
  }
}
