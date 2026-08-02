/**
 * The sixteen competencies, with baselines taken verbatim from
 * `current_analysis.txt` Part 1, and the strengths/weaknesses from the
 * per-competency write-ups that follow it.
 *
 * `weight` is the share of the readiness score each competency carries.
 * Weights are NOT uniform: they are set so that the competencies a Tier-1 loop
 * actually screens hardest on — and the ones the audit calls the bottleneck —
 * move the score most. They sum to exactly 1.000.
 */

import { PROGRAMME_START, addDays, id } from './util.mjs'

/**
 * Raw definitions. `w` is the pre-normalised weight (relative importance,
 * 1–10); the exporter normalises so the set sums to 1. Keeping the authored
 * value relative means adding a 17th competency later does not require
 * rebalancing every other number by hand.
 */
const DEFS = [
  {
    name: 'Product Sense',
    category: 'craft',
    baseline: 7.8,
    target: 9.0,
    benchmark: 'Good',
    w: 9,
    tier: 'should-improve',
    confidence: 4,
    what: 'Judgement about what to build and for whom — reading users, framing problems, and choosing between plausible solutions.',
    whyItMatters:
      'The single most-weighted round at Google, Meta and Atlassian. It is where interviewers decide whether you are a builder of features or an owner of outcomes.',
    strengths: [
      'Strong UX reasoning',
      'Strong edge-case thinking',
      'Excellent workflow reasoning',
      'Excellent admin system design',
    ],
    weaknesses: [
      'Market expansion thinking is underdeveloped',
      'Little evidence of user-psychology reasoning',
      'Consumer behaviour is unfamiliar territory',
      'Growth loops rarely appear in your reasoning',
      'Your instinct runs to system correctness, scalability, permissions and architecture — an enterprise PM profile, not a consumer one',
    ],
    plan: [
      'Write 20 structured product critiques (Month 4) using a fixed template: user, job, friction, hypothesis, metric.',
      'For every critique, force one section on user psychology and one on a growth loop.',
      'Study three consumer products end-to-end (Duolingo, Spotify, Instagram) and write down the behavioural mechanic each relies on.',
      'Practise "who is the user we are choosing NOT to serve" on every exercise.',
    ],
  },
  {
    name: 'Product Strategy',
    category: 'strategic',
    baseline: 7.6,
    target: 9.0,
    benchmark: 'Good',
    w: 9,
    tier: 'should-improve',
    confidence: 3,
    what: 'Choosing where a company plays and how it wins — market selection, positioning, moats, and the decision not to build.',
    whyItMatters:
      'Senior and Staff loops test whether you can argue "should this company even build this?" rather than "how should this product evolve?" That gap is the difference between Senior and Mid.',
    strengths: [
      'Well above the average PM on product evolution strategy',
      'Comfortable reasoning about extensibility and platform direction',
    ],
    weaknesses: [
      'Experience is mostly "how should this product evolve?"',
      'Top companies expect "should this company even build this?" — a different altitude',
      'No public strategy artefacts that show market-level reasoning',
    ],
    plan: [
      'Write the "Should Company X enter Market Y?" memo (Month 9) with explicit assumptions, risks and kill criteria.',
      'Produce three pricing and monetisation analyses (Month 9).',
      'Build the marketplace strategy document — deliberately outside B2B operations.',
      'Read Escaping the Build Trap and map each chapter to a decision you have actually made.',
    ],
  },
  {
    name: 'Product Execution',
    category: 'craft',
    baseline: 9.2,
    target: 9.5,
    benchmark: 'Excellent',
    w: 7,
    tier: 'advantage',
    confidence: 5,
    what: 'Turning intent into shipped, correct, well-documented product — specs, edge cases, rollout, and follow-through.',
    whyItMatters:
      'Already at Senior PM level and your strongest area. The work here is not improvement, it is making the strength legible to people who have never seen your internal documents.',
    strengths: [
      'PRDs',
      'Edge cases',
      'UX',
      'Permissions',
      'Workflows',
      'Rollout planning',
      'Documentation',
      'Redesigns',
    ],
    weaknesses: [
      'Excellence is invisible outside your company — none of it is public',
      'Outcomes are not quantified, so execution reads as activity rather than impact',
    ],
    plan: [
      'Convert one real internal redesign into a public case study with the confidential details abstracted.',
      'Attach a number to every shipped initiative: tickets reduced, time saved, activation moved.',
      'Publish two architecture-focused product documents (Month 8).',
    ],
  },
  {
    name: 'UX',
    category: 'craft',
    baseline: 8.8,
    target: 9.2,
    benchmark: 'Excellent',
    w: 6,
    tier: 'advantage',
    confidence: 5,
    what: 'Information architecture, mental models, interaction consistency, and design that survives scale.',
    whyItMatters:
      'A rare strength. Most PMs cannot reason about information architecture at all; Canva, Miro, Notion and Linear screen for exactly this.',
    strengths: [
      'Thinks in information architecture',
      'Thinks in mental models',
      'Consistency discipline',
      'Designs for scale, not for the demo',
    ],
    weaknesses: [
      'No public design artefacts that demonstrate the reasoning',
      'Consumer-grade polish and emotional design are less exercised than enterprise clarity',
    ],
    plan: [
      'Ship the complete redesign of a complex SaaS workflow as portfolio project #1.',
      'Document the IA decisions and the alternatives you rejected — the rejected options are the evidence.',
      'Add before/after screens and a measurable usability claim to every UX artefact.',
    ],
  },
  {
    name: 'Systems Thinking',
    category: 'strategic',
    baseline: 9.5,
    target: 9.7,
    benchmark: 'Exceptional',
    w: 6,
    tier: 'advantage',
    confidence: 5,
    what: 'Seeing dependencies, state transitions, second-order effects and future extensibility rather than isolated features.',
    whyItMatters:
      'Your single biggest competitive advantage, and closer to Staff PM thinking than average Senior PM thinking. Most PMs think feature-first; you think platform-first.',
    strengths: [
      'Sees dependencies naturally',
      'Reasons about state transitions',
      'Designs for future extensibility',
      'Platform thinking rather than feature thinking',
    ],
    weaknesses: [
      'Extremely rare and extremely hard to see from the outside — the advantage is currently unverifiable by a recruiter',
    ],
    plan: [
      'Make the thinking visible: publish system diagrams alongside every case study.',
      'Write one teardown that reconstructs a well-known product\'s data model from the outside (Linear or Stripe Dashboard).',
      'Use the phrase "second-order effect" with a concrete example in every mock interview.',
    ],
  },
  {
    name: 'Technical Depth',
    category: 'technical',
    baseline: 7.5,
    target: 8.8,
    benchmark: 'Good',
    w: 7,
    tier: 'should-improve',
    confidence: 3,
    what: 'Enough fluency in systems, APIs and data to make architecture tradeoffs with engineers rather than around them.',
    whyItMatters:
      'Sufficient to work effectively with engineers today. Google expects deeper fluency, and Stripe and GitLab interview on API and platform reasoning directly.',
    strengths: [
      'Works effectively with engineering',
      'Comfortable with permissions and workflow architecture',
    ],
    weaknesses: [
      'Distributed systems',
      'APIs',
      'Data architecture',
      'Cloud tradeoffs',
      'ML pipelines',
      'Infrastructure',
    ],
    plan: [
      'Complete the system-design month (Month 8) and publish two architecture-focused documents.',
      'Design an API from scratch: resources, versioning, pagination, idempotency, error taxonomy.',
      'Read Designing Data-Intensive Applications chapters 1–6 and write the tradeoff notes.',
      'Build one thing that touches a real queue, a real cache and a real database.',
    ],
  },
  {
    name: 'Metrics',
    category: 'analytical',
    baseline: 6.8,
    target: 9.0,
    benchmark: 'Below target',
    w: 10,
    tier: 'must-fix',
    confidence: 2,
    what: 'Constructing a metric tree — north star, inputs, leading indicators, guardrails — and defending it.',
    whyItMatters:
      'One of the biggest weaknesses. Your documentation is excellent; your metric thinking is not equally visible. Every Tier-1 loop has a dedicated metrics round.',
    strengths: ['Excellent documentation habits to build the metric definitions on top of'],
    weaknesses: [
      'Metric thinking is not visible in your artefacts',
      'No demonstrated north-star → input → leading-indicator → guardrail chain',
      'Long-term and second-order metric effects rarely discussed',
    ],
    plan: [
      'Build 5 KPI frameworks in Month 1, one per product you know well.',
      'For each, write the full chain: North Star → Inputs → Leading indicators → Experiment metrics → Business metrics → Guardrails → Long-term effects.',
      'Add a metrics section to every existing portfolio artefact retroactively.',
      'Read Lean Analytics and map its stages onto your current product.',
    ],
  },
  {
    name: 'Analytics',
    category: 'analytical',
    baseline: 6.5,
    target: 9.0,
    benchmark: 'Below target',
    w: 10,
    tier: 'must-fix',
    confidence: 2,
    what: 'Getting answers out of data yourself — SQL, product analytics tools, cohorts, funnels, retention.',
    whyItMatters:
      'The audit names data-informed product decision making as your highest-value skill, and this is the missing half of it. SQL is called non-negotiable.',
    strengths: ['Strong analytical reasoning once the data is in front of you'],
    weaknesses: [
      'SQL',
      'Amplitude',
      'Mixpanel',
      'Looker',
      'Tableau',
      'BigQuery',
      'No public analysis anyone can inspect',
    ],
    plan: [
      'Month 1: 30 SQL exercises. SQLBolt, then Mode Analytics SQL tutorial, then 50 interview-grade questions.',
      'Month 2: analyse a public dataset in Amplitude or Mixpanel and publish the case study.',
      'Build the funnel + retention + cohort analysis case study with metric recommendations.',
      'Get to the point where you can write a window function without looking it up.',
    ],
  },
  {
    name: 'Experimentation',
    category: 'analytical',
    baseline: 6.2,
    target: 8.8,
    benchmark: 'Weak',
    w: 9,
    tier: 'must-fix',
    confidence: 2,
    what: 'Designing and reading experiments — hypotheses, power, significance, causal inference, staged rollout.',
    whyItMatters:
      'The largest single gap in the audit. Top PMs discuss A/B testing, statistical power and confidence intervals continuously; this is described as mostly absent.',
    strengths: ['Rollout planning experience gives a foundation to build experiment design on'],
    weaknesses: [
      'A/B testing',
      'Causal inference',
      'Statistical power',
      'Experiment design',
      'Confidence intervals',
      'Feature-flag rollout strategy',
    ],
    plan: [
      'Month 3: design 10 complete A/B test plans — hypothesis, metric, MDE, sample size, duration, guardrails, decision rule.',
      'Learn to compute sample size and minimum detectable effect by hand before using a calculator.',
      'Read Trustworthy Online Controlled Experiments, parts I and II.',
      'Run one real experiment at work, however small, and write up what the data actually said.',
    ],
  },
  {
    name: 'Communication',
    category: 'human',
    baseline: 8.2,
    target: 9.2,
    benchmark: 'Strong',
    w: 6,
    tier: 'should-improve',
    confidence: 4,
    what: 'Written and verbal clarity, and the ability to move a specific audience to a specific decision.',
    whyItMatters:
      'Strong already, especially written. Executive storytelling is the named gap — the ability to compress a quarter of work into three slides a VP will act on.',
    strengths: ['Strong written communication', 'Documentation clarity'],
    weaknesses: [
      'Executive storytelling',
      'Verbal compression under time pressure',
      'Narrative structure in high-stakes presentations',
    ],
    plan: [
      'Write one long-form article every month for 24 months — non-negotiable cadence.',
      'Practise the 3-slide executive update: situation, decision needed, recommendation.',
      'Record yourself answering interview questions and cut every answer to 90 seconds.',
      'Build the behavioural story library early (Month 11) and refine it monthly.',
    ],
  },
  {
    name: 'Leadership',
    category: 'human',
    baseline: 8.4,
    target: 9.2,
    benchmark: 'Strong',
    w: 6,
    tier: 'should-improve',
    confidence: 4,
    what: 'Setting direction and raising the standard of people who do not report to you.',
    whyItMatters:
      'Strong on initiative and process. The missing signal for Senior and above is having led other PMs, or set direction others followed.',
    strengths: [
      'Leading initiatives',
      'Process creation',
      'Documentation standards',
      'Cross-functional ownership',
      'Repeatedly moves outside the job description — hiring managers notice this',
    ],
    weaknesses: [
      'Has not led other PMs',
      'No mentorship track record on paper',
      'Influence outside the company is unproven',
    ],
    plan: [
      'Mentor one junior PM or aspiring PM formally and write down what you taught.',
      'Own a cross-team standard end-to-end and document the adoption curve.',
      'Build public authority through writing — leadership at a distance is what the brand work buys you.',
    ],
  },
  {
    name: 'Stakeholder Management',
    category: 'human',
    baseline: 8.8,
    target: 9.2,
    benchmark: 'Excellent',
    w: 5,
    tier: 'advantage',
    confidence: 5,
    what: 'Holding engineering, design, business, operations and customers in productive tension.',
    whyItMatters:
      'Excellent. This is the competency that makes a Senior PM safe to hire, and yours is already there.',
    strengths: [
      'Balances engineering, design, business, operations and customers comfortably',
      'Credible with operational stakeholders',
    ],
    weaknesses: ['Executive-level stakeholder work is less exercised than peer-level'],
    plan: [
      'Turn two stakeholder situations into STAR stories with a measurable outcome.',
      'Practise the "disagreed with a senior stakeholder" question until it is boring.',
    ],
  },
  {
    name: 'Product Discovery',
    category: 'craft',
    baseline: 7.4,
    target: 9.0,
    benchmark: 'Good',
    w: 8,
    tier: 'should-improve',
    confidence: 3,
    what: 'Continuous contact with users — interviews, jobs-to-be-done, opportunity trees, assumption testing.',
    whyItMatters:
      'Good, but the evidence is thin. Discovery is the round where interviewers find out whether your roadmap comes from users or from stakeholders.',
    strengths: ['Good instinct for problem framing', 'Strong at edge-case discovery within a known domain'],
    weaknesses: [
      'Customer interviews',
      'Jobs-to-be-done',
      'Opportunity solution trees',
      'Continuous discovery habits',
    ],
    plan: [
      'Run 10 customer interviews and publish the synthesis — anonymised.',
      'Read Continuous Discovery Habits and build one real opportunity solution tree.',
      'Adopt a weekly interview cadence at work, even 20 minutes.',
      'Write the assumption map for one live initiative before building it.',
    ],
  },
  {
    name: 'Prioritization',
    category: 'strategic',
    baseline: 8.6,
    target: 9.2,
    benchmark: 'Excellent',
    w: 5,
    tier: 'advantage',
    confidence: 5,
    what: 'Sequencing work under real constraints, and being able to defend what you cut.',
    whyItMatters:
      'Strong, especially in complex operational systems. This makes the execution round straightforward for you.',
    strengths: ['Strong in complex operational systems', 'Comfortable defending tradeoffs'],
    weaknesses: [
      'Prioritisation under revenue pressure is less exercised than under operational pressure',
    ],
    plan: [
      'Add an explicit "what we cut and why" section to every portfolio artefact.',
      'Practise prioritisation questions where the constraint is money rather than engineering time.',
    ],
  },
  {
    name: 'AI Product Knowledge',
    category: 'technical',
    baseline: 7.7,
    target: 9.0,
    benchmark: 'Good',
    w: 8,
    tier: 'should-improve',
    confidence: 3,
    what: 'Shipping LLM-backed product: retrieval, prompting architecture, evaluation, cost, safety, and AI-specific UX.',
    whyItMatters:
      'Better than average already, and the fastest-appreciating asset on this list. An AI Copilot PRD with real evaluation metrics is the second-highest-ROI portfolio project in the audit.',
    strengths: [
      'Above-average baseline understanding',
      'EdTech and AI-education background is an unusual, credible foundation',
    ],
    weaknesses: [
      'LLM evaluation',
      'Retrieval',
      'Prompting architecture',
      'AI safety',
      'Cost optimisation',
      'AI UX patterns',
    ],
    plan: [
      'Month 5: build one AI-powered product prototype end-to-end.',
      'Write the AI Copilot PRD covering retrieval, prompts, evaluation, rollout and metrics.',
      'Build a real eval set — 50 labelled cases with a scoring rubric, not vibes.',
      'Model the unit economics: cost per query, cache hit rate, latency budget.',
    ],
  },
  {
    name: 'Business Thinking',
    category: 'strategic',
    baseline: 8.0,
    target: 9.0,
    benchmark: 'Strong',
    w: 8,
    tier: 'should-improve',
    confidence: 3,
    what: 'Connecting product decisions to revenue, retention, margin and expansion.',
    whyItMatters:
      'Good, and it improves dramatically the moment you work with pricing, growth and retention directly. Quantified business impact is one of the three must-fix items.',
    strengths: ['Solid commercial instinct', 'Understands operational cost structures'],
    weaknesses: [
      'Pricing',
      'Growth',
      'Product-led growth',
      'Retention mechanics',
      'Expansion revenue',
      'Revenue models',
      'Financial modelling',
    ],
    plan: [
      'Quantify every significant outcome from your current role: ARR influenced, retention, activation, churn, tickets, engineering time saved.',
      'Month 9: write three pricing strategy analyses.',
      'Month 10: build a growth-loop case study.',
      'Build one simple SaaS financial model — MRR, churn, CAC, payback, LTV.',
    ],
  },
]

/**
 * A modest amount of real progress since PROGRAMME_START (one month in), so the
 * dashboard, trends and spider chart are meaningful on first run rather than
 * a grid of zeros. Reset from Settings → Data to return every score to baseline.
 */
const EARLY_GAINS = {
  'Analytics': 0.6,
  'Metrics': 0.4,
  'Experimentation': 0.2,
  'Product Sense': 0.1,
  'Business Thinking': 0.1,
}

export function buildSkills() {
  const totalW = DEFS.reduce((sum, d) => sum + d.w, 0)

  return DEFS.map((d) => {
    const gain = EARLY_GAINS[d.name] ?? 0
    const current = Math.round((d.baseline + gain) * 10) / 10

    // Three history points: programme start, mid-month, today. Enough to draw a
    // trend without inventing progress that never happened.
    const history = [
      { date: PROGRAMME_START, score: d.baseline },
      {
        date: addDays(PROGRAMME_START, 14),
        score: Math.round((d.baseline + gain * 0.45) * 10) / 10,
      },
      { date: addDays(PROGRAMME_START, 29), score: current },
    ]

    return {
      id: id('sk', d.name),
      name: d.name,
      what: d.what,
      whyItMatters: d.whyItMatters,
      category: d.category,
      baselineScore: d.baseline,
      currentScore: current,
      targetScore: d.target,
      benchmark: d.benchmark,
      weight: Math.round((d.w / totalW) * 10000) / 10000,
      tier: d.tier,
      confidence: d.confidence,
      strengths: d.strengths,
      weaknesses: d.weaknesses,
      evidence: [],
      improvementPlan: d.plan,
      relatedBookIds: [],
      relatedCourseIds: [],
      relatedProjectIds: [],
      relatedQuestionIds: [],
      history,
    }
  })
}

/** Name → id, so other seed authors can cross-reference without hardcoding slugs. */
export const SKILL_IDS = Object.fromEntries(DEFS.map((d) => [d.name, id('sk', d.name)]))

/** The audit's Part 2 list, surfaced as its own panel. */
export const COMPETITIVE_ADVANTAGES = [
  {
    id: 'adv_systems-thinking',
    title: 'Systems Thinking',
    detail:
      'Extremely rare. Many PMs think feature-first; you think platform-first. Closer to Staff PM thinking than average Senior PM thinking.',
    skill: 'Systems Thinking',
  },
  {
    id: 'adv_enterprise-saas',
    title: 'Enterprise SaaS Depth',
    detail:
      'B2B SaaS, logistics, retail tech, ERP, field service and workflow software. Already competitive for many mid-size global SaaS companies with operational products.',
    skill: 'Product Execution',
  },
  {
    id: 'adv_documentation',
    title: 'Product Documentation',
    detail:
      'Among the strongest in the audit. Good documentation scales organisations, and large companies value it explicitly.',
    skill: 'Communication',
  },
  {
    id: 'adv_complex-workflow',
    title: 'Complex Enterprise UX',
    detail:
      'Permissions, workflow, offline, inventory, retail execution and admin dashboards. This is genuinely difficult work that most PMs never touch.',
    skill: 'UX',
  },
  {
    id: 'adv_educational-product',
    title: 'Educational Product Design',
    detail:
      'Engineering + EdTech + Product + Curriculum + AI education. Few PMs have all five, and the combination is memorable.',
    skill: 'AI Product Knowledge',
  },
  {
    id: 'adv_ownership',
    title: 'Cross-functional Ownership',
    detail:
      'You repeatedly move outside your job description. Hiring managers notice this, and it is the cheapest signal to make legible.',
    skill: 'Leadership',
  },
]

/** Part 3, grouped by remediation tier. Rendered on the Readiness and Skills pages. */
export const GAP_REGISTER = {
  'must-fix': [
    { id: 'gap_sql', title: 'SQL', detail: 'Non-negotiable.', skill: 'Analytics' },
    {
      id: 'gap_product-analytics',
      title: 'Product Analytics',
      detail: 'Mixpanel, Amplitude, GA4, Looker, Mode.',
      skill: 'Analytics',
    },
    {
      id: 'gap_experimentation',
      title: 'Experimentation',
      detail: 'Need hands-on experimentation, not theory.',
      skill: 'Experimentation',
    },
    {
      id: 'gap_public-portfolio',
      title: 'Public Product Portfolio',
      detail: 'Almost nonexistent today.',
      skill: 'Product Execution',
    },
    {
      id: 'gap_international-brand',
      title: 'International Personal Brand',
      detail: 'Outside your network, almost nobody knows you.',
      skill: 'Communication',
    },
    {
      id: 'gap_quantified-impact',
      title: 'Quantified Business Impact',
      detail:
        'Need outcomes like ARR influenced, retention improved, activation increased, churn reduced, support tickets reduced, engineering time saved.',
      skill: 'Business Thinking',
    },
  ],
  'should-improve': [
    { id: 'gap_exec-storytelling', title: 'Executive Storytelling', detail: 'Executive presentations.', skill: 'Communication' },
    { id: 'gap_financial-modeling', title: 'Financial Modeling', detail: 'MBA-adjacent commercial fluency.', skill: 'Business Thinking' },
    { id: 'gap_ai-evaluation', title: 'AI Product Evaluation', detail: 'Eval sets, rubrics, offline and online measurement.', skill: 'AI Product Knowledge' },
    { id: 'gap_growth', title: 'Growth', detail: 'Loops, activation, retention levers.', skill: 'Business Thinking' },
    { id: 'gap_consumer', title: 'Consumer Products', detail: 'User psychology and behavioural mechanics.', skill: 'Product Sense' },
    { id: 'gap_marketplace', title: 'Marketplace Dynamics', detail: 'Two-sided supply and demand balance.', skill: 'Product Strategy' },
    { id: 'gap_plg', title: 'Product-Led Growth', detail: 'Self-serve funnels and in-product conversion.', skill: 'Business Thinking' },
    { id: 'gap_api-products', title: 'API Products', detail: 'Design, versioning, developer contracts.', skill: 'Technical Depth' },
    { id: 'gap_developer-products', title: 'Developer Products', detail: 'DX as the primary product surface.', skill: 'Technical Depth' },
    { id: 'gap_platform-thinking', title: 'Platform Thinking', detail: 'Making other teams productive on your surface.', skill: 'Systems Thinking' },
  ],
  'nice-to-have': [
    { id: 'gap_mba-finance', title: 'MBA-level Finance', detail: 'Valuation, unit economics at depth.', skill: 'Business Thinking' },
    { id: 'gap_ml-fundamentals', title: 'Machine Learning Fundamentals', detail: 'Enough to reason about model behaviour.', skill: 'AI Product Knowledge' },
    { id: 'gap_data-science', title: 'Data Science', detail: 'Beyond analytics into modelling.', skill: 'Analytics' },
    { id: 'gap_behavioral-econ', title: 'Behavioral Economics', detail: 'Choice architecture and incentive design.', skill: 'Product Sense' },
  ],
}
