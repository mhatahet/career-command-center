/**
 * Interview preparation: a question bank across the nine tracks named in
 * `current_analysis.txt` Part 7, plus the mock-interview log.
 *
 * Every question carries an `idealAnswer` sketch and a `framework`, because a
 * question bank without the shape of a good answer is just a list of things to
 * feel bad about.
 */

import { SKILL_IDS as S } from './skills.mjs'
import { PROGRAMME_START, addDays, seqId } from './util.mjs'

/** [prompt, difficulty, company?, framework, idealAnswer, skills[]] */
const BANK = {
  'product-sense': [
    ['Design a product that helps warehouse workers pick orders faster.', 3, 'Amazon', 'CIRCLES',
      'Comprehend the situation (throughput vs accuracy tradeoff), list users (picker, supervisor, planner), pick the picker, list their jobs, cut to the top pain (walking distance and search time), three solutions, pick one, define success (units picked/hour with an error-rate guardrail).',
      ['Product Sense', 'UX']],
    ['How would you improve Google Maps for someone who has just moved to a new city?', 3, 'Google', 'CIRCLES',
      'Anchor on the newcomer job: building a mental model of a place, not navigating a known route. Solution space is orientation and discovery, not routing.',
      ['Product Sense']],
    ['Your favourite product is losing to a competitor. What do you do?', 4, null, 'Diagnose → Hypothesise → Act',
      'Segment the loss (which users, which use case, new vs existing). Distinguish a product gap from a distribution gap — they have completely different responses.',
      ['Product Sense', 'Product Strategy']],
    ['Design a feature that makes Slack better for a 50,000-person company.', 4, 'Slack', 'CIRCLES',
      'At that size the problem inverts: the constraint is finding signal, not sending messages. Design for discovery and information decay, not communication.',
      ['Product Sense', 'Systems Thinking']],
    ['How would you design an admin dashboard for a field-service company?', 2, null, 'CIRCLES',
      'Your home territory — use it to show depth. Roles, permissions, offline states, exception handling. Lead with the mental model, not the screens.',
      ['UX', 'Systems Thinking']],
    ['Pick a product you think is badly designed and fix it.', 3, null, 'Critique template',
      'Name the user and job first. Be specific about the friction and how you would measure it. Say what you would deliberately not fix.',
      ['Product Sense', 'UX']],
    ['Design a product for people learning a new language.', 3, 'Duolingo', 'CIRCLES',
      'Deliberately a consumer question — the audit\'s named blind spot. Lead with the behavioural mechanic (streaks, variable reward, endowed progress) before any feature.',
      ['Product Sense']],
    ['How would you improve onboarding for a complex B2B product?', 3, null, 'Funnel + JTBD',
      'Time-to-first-value is the metric. In B2B the buyer and the user differ, so onboarding has two audiences with different definitions of value.',
      ['Product Sense', 'Product Discovery']],
  ],
  execution: [
    ['You are two weeks from launch and QA finds a critical bug. What do you do?', 3, null, 'Assess → Options → Decide → Communicate',
      'Assess severity and blast radius, generate three options (delay, ship with mitigation, cut scope), state the recommendation with its cost, communicate before you are asked.',
      ['Product Execution', 'Stakeholder Management']],
    ['How do you decide what goes into an MVP?', 2, null, 'Riskiest assumption first',
      'The MVP tests the riskiest assumption, it is not a smaller version of the product. Say explicitly what you are learning and what would make you stop.',
      ['Product Execution', 'Prioritization']],
    ['Engineering says the feature will take three times longer than estimated. How do you respond?', 3, null, 'Understand → Reframe → Sequence',
      'Understand where the estimate changed, separate essential complexity from accidental, then look for a smaller version that tests the same assumption.',
      ['Product Execution', 'Stakeholder Management']],
    ['Walk me through how you would roll out a risky change to 10 million users.', 4, 'Google', 'Staged rollout',
      'Internal → 1% → 5% → 25% → 100%, with guardrail metrics and a pre-agreed rollback trigger at each stage. Name the metric that halts the rollout.',
      ['Product Execution', 'Experimentation']],
    ['How do you write a PRD that engineers actually read?', 2, null, 'Structure',
      'Problem and decision at the top, open questions visible, and the edge cases enumerated rather than implied. Your genuine strength — lead with a real example.',
      ['Product Execution', 'Communication']],
    ['A stakeholder keeps adding scope. How do you handle it?', 3, null, 'Make the tradeoff visible',
      'Never refuse; price it. "Yes, and that moves the date by two weeks" converts an argument into a decision they have to own.',
      ['Stakeholder Management', 'Prioritization']],
  ],
  strategy: [
    ['Should Google enter the project-management software market?', 5, 'Google', 'Market entry',
      'Where would we win, what would have to be true, what does it cost us in focus, and what is the kill criterion. Reach an actual recommendation.',
      ['Product Strategy', 'Business Thinking']],
    ['How would you think about Stripe expanding into a new financial product?', 5, 'Stripe', 'Adjacency',
      'Adjacency in capability vs adjacency in customer. Stripe\'s moat is developer trust and integration depth — evaluate whether the new product compounds it.',
      ['Product Strategy']],
    ['Our competitor just launched at half our price. What is our strategy?', 4, null, 'Positioning',
      'Do not reflexively match. Segment on willingness to pay, understand what they cut to reach that price, and decide whether to defend, ignore, or reposition.',
      ['Product Strategy', 'Business Thinking']],
    ['How do you decide whether to build, buy or partner?', 4, null, 'Core vs context',
      'Build what is core to the differentiation; buy or partner for context. The test is whether being best in the world at this changes whether customers choose you.',
      ['Product Strategy']],
    ['What is your three-year vision for a product you know well?', 4, null, 'Vision → Strategy → Roadmap',
      'A vision is a description of the world, not a feature list. Then the strategy that gets there, then the first two quarters. Most candidates only do the third.',
      ['Product Strategy', 'Communication']],
    ['Should we go upmarket to enterprise or down to SMB?', 4, null, 'Motion fit',
      'The answer is determined by which motion your product and org can actually execute. Enterprise changes the product, the sales model and the support cost together.',
      ['Product Strategy', 'Business Thinking']],
  ],
  metrics: [
    ['What is the north star metric for a B2B workflow product, and why?', 3, null, 'Metric tree',
      'Run the full chain from the audit: north star → inputs → leading indicators → experiment metrics → business metrics → guardrails → long-term effects.',
      ['Metrics']],
    ['Daily active users dropped 8% week over week. Diagnose it.', 4, null, 'Segment → Isolate → Verify',
      'First rule out instrumentation. Then segment by platform, geography, cohort and version until the drop localises. Never guess before segmenting.',
      ['Metrics', 'Analytics']],
    ['How would you measure the success of a search feature?', 3, 'Google', 'Metric tree',
      'Success is task completion, not engagement. More searches per session is often a failure signal. Name that inversion explicitly.',
      ['Metrics']],
    ['Define activation for a product like Notion.', 3, 'Notion', 'Activation',
      'Find the behaviour that correlates with week-four retention, then define activation as reaching it. Show the correlation, do not assert it.',
      ['Metrics', 'Analytics']],
    ['What guardrail metrics would you set for a growth experiment?', 4, null, 'Guardrails',
      'Protect the thing the primary metric can cannibalise: unsubscribe rate, support volume, latency, downstream retention.',
      ['Metrics', 'Experimentation']],
    ['Your north star is going up but revenue is flat. What is happening?', 4, null, 'Decomposition',
      'The north star is not causally connected to revenue, or the gain is in a segment that does not pay. Decompose by segment.',
      ['Metrics', 'Business Thinking']],
    ['How do you measure something that takes a year to show up?', 4, null, 'Leading indicators',
      'Find a leading indicator with an established relationship to the long-term outcome, and be honest about the strength of that relationship.',
      ['Metrics']],
  ],
  analytics: [
    ['Write a SQL query to find the D7 retention rate by signup cohort.', 4, null, 'SQL',
      'Self-join or window function on the events table, cohort by signup week, count distinct users active in day 7 over cohort size. Say the plan before typing.',
      ['Analytics']],
    ['Write a query to find users who did A but not B within 30 days.', 3, null, 'SQL',
      'LEFT JOIN with a NULL check, or NOT EXISTS. Watch the time window boundary and be explicit about inclusive/exclusive.',
      ['Analytics']],
    ['How would you find the biggest drop-off in a five-step funnel?', 3, null, 'SQL + funnel',
      'Ordered event sequence, count distinct users per step, then the step-to-step conversion. Segment before concluding.',
      ['Analytics']],
    ['A dashboard shows conversion up 40% overnight. What do you check first?', 3, null, 'Data quality',
      'Instrumentation, always. Tracking change, deploy, bot traffic, timezone boundary, duplicate events. Believe the pipeline last.',
      ['Analytics']],
    ['Explain the difference between a cohort analysis and a funnel analysis.', 2, null, 'Concepts',
      'Funnels measure a sequence within a session or window; cohorts measure a group over time. They answer different questions and are constantly confused.',
      ['Analytics']],
    ['How would you use a window function to find each user\'s first purchase?', 3, null, 'SQL',
      'ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY purchased_at), filter to 1. Know why this beats a self-join on MIN.',
      ['Analytics']],
  ],
  estimation: [
    ['How many PMs are there in the world?', 3, null, 'Top-down + bottom-up',
      'Two independent paths — global knowledge-worker population, and software companies × PMs per company — then reconcile the gap out loud.',
      ['Business Thinking']],
    ['Estimate the annual revenue of Slack.', 4, null, 'Bottom-up',
      'Paid seats × ARPU, sanity-checked against known enterprise counts. State every assumption as you make it.',
      ['Business Thinking']],
    ['How much storage does YouTube need per day?', 4, 'Google', 'Bottom-up',
      'Hours uploaded per minute × bitrate × transcoding multiplier. The transcoding multiplier is the part people forget.',
      ['Technical Depth', 'Business Thinking']],
    ['Estimate the market size for AI writing tools.', 4, null, 'TAM/SAM/SOM',
      'Knowledge workers × willingness to pay × addressable fraction. Be explicit that TAM is a story and SOM is a plan.',
      ['Business Thinking', 'Product Strategy']],
    ['How many support tickets would a 10,000-seat enterprise generate monthly?', 3, null, 'Bottom-up',
      'Your domain. Seats × active fraction × tickets per active user, adjusted for product maturity. Use real numbers you know.',
      ['Business Thinking']],
  ],
  leadership: [
    ['Tell me about a time you led without authority.', 3, null, 'STAR',
      'The audit says you repeatedly move outside your job description. Pick the strongest instance and put a number in the result.',
      ['Leadership']],
    ['How do you handle an engineer who disagrees with the roadmap?', 3, null, 'STAR',
      'Separate the disagreement about facts from the disagreement about priority. Engineers are usually right about the first.',
      ['Leadership', 'Stakeholder Management']],
    ['Describe a process you created that others adopted.', 3, null, 'STAR',
      'Your documentation-standards work. Result must include adoption — how many teams, over what period.',
      ['Leadership']],
    ['How would you onboard a junior PM?', 3, null, 'Structure',
      'Thirty/sixty/ninety with explicit competency milestones. Addresses the "has not led PMs" gap directly.',
      ['Leadership']],
    ['Tell me about a time you had to deliver bad news to leadership.', 4, null, 'STAR',
      'Early, with options, and owning the part that was yours. The recovery is the story, not the failure.',
      ['Leadership', 'Communication']],
  ],
  behavioral: [
    ['Tell me about your biggest professional failure.', 4, null, 'DIGS / STAR',
      'A real failure with a real cost, and a specific behaviour change afterwards that you can point to. Not a disguised success.',
      ['Communication']],
    ['Describe a time you changed your mind based on data.', 3, null, 'STAR',
      'Doubles as evidence against the "avoids analytics" weakness. Choose an example where the data contradicted your instinct.',
      ['Communication', 'Analytics']],
    ['Tell me about a conflict with a stakeholder.', 3, null, 'STAR',
      'Stakeholder Management is your 8.8. Show the disagreement and the mechanism that resolved it, not just that it ended well.',
      ['Stakeholder Management']],
    ['Why do you want to leave your current role?', 2, null, 'Forward-looking',
      'Scale and scope, framed as what you want to learn next. Never a complaint about the current employer.',
      ['Communication']],
    ['What is your greatest weakness?', 3, null, 'Honest + remediated',
      'Analytics and experimentation, with the specific work you have done about it. The remediation is what makes the answer land.',
      ['Communication']],
    ['Tell me about a decision you made with insufficient data.', 3, null, 'STAR',
      'What you did to reduce the uncertainty cheaply, what you decided, and what you set up to learn quickly if you were wrong.',
      ['Communication', 'Product Sense']],
    ['Why this company?', 2, null, 'Specificity',
      'Something only true of them. Requires actual research, and interviewers can tell within one sentence whether you did it.',
      ['Communication']],
  ],
  'system-design': [
    ['Design the data model for a project-management tool.', 4, 'Atlassian', 'Entities → Relations → Constraints',
      'Entities, relationships, and the constraints that make the product opinionated. Your Systems Thinking 9.5 should be visible here.',
      ['Systems Thinking', 'Technical Depth']],
    ['How would you design an API for a payments product?', 5, 'Stripe', 'API design',
      'Resource model, idempotency keys, versioning, error taxonomy, pagination, webhooks. Idempotency is the answer they are listening for.',
      ['Technical Depth', 'Systems Thinking']],
    ['Design a notification system that does not annoy users.', 4, null, 'System + product',
      'Both a delivery architecture and a preference model. The interesting design is the aggregation and rate-limiting logic.',
      ['Systems Thinking', 'UX']],
    ['How would you architect a multi-tenant SaaS product?', 5, null, 'Tenancy models',
      'Shared schema vs schema-per-tenant vs database-per-tenant, and how the choice determines what you can promise enterprises.',
      ['Technical Depth', 'Systems Thinking']],
    ['Design an offline-capable mobile app for field workers.', 4, null, 'Sync architecture',
      'Your actual domain. Conflict resolution strategy is the hard part — say what you do when two workers edit the same record offline.',
      ['Systems Thinking', 'Technical Depth']],
    ['How would you design a feature-flag and experimentation platform?', 5, null, 'Platform design',
      'Assignment, consistency, overlapping experiments, metric pipeline. Directly relevant to closing the experimentation gap.',
      ['Experimentation', 'Technical Depth']],
  ],
}

export function buildInterviews() {
  const questions = []
  let n = 0

  for (const [track, rows] of Object.entries(BANK)) {
    for (const [prompt, difficulty, company, framework, idealAnswer, skills] of rows) {
      n += 1

      // A handful practised in month 1 so the confidence chart has real data.
      const practised = n % 7 === 0
      const scores = practised
        ? [{ date: addDays(PROGRAMME_START, 10 + (n % 15)), score: 5 + (n % 3) }]
        : []

      questions.push({
        id: seqId('q_', n),
        prompt,
        track,
        difficulty,
        company: company ?? undefined,
        practiceCount: practised ? 1 : 0,
        lastAttempt: practised ? scores[0].date : undefined,
        confidence: practised ? 3 : difficulty >= 4 ? 1 : 2,
        score: practised ? scores[0].score : undefined,
        scoreHistory: scores,
        notes: '',
        feedback: '',
        idealAnswer,
        framework,
        videoPracticeUrl: undefined,
        skillIds: skills.map((s) => S[s]).filter(Boolean),
        starred: difficulty >= 4 && ['metrics', 'analytics', 'strategy'].includes(track),
      })
    }
  }

  // Two real mocks in month one — the cadence properly begins in month 10, but
  // starting early is free and calibrates the scores.
  const mocks = [
    {
      id: 'mock_001',
      date: addDays(PROGRAMME_START, 18),
      track: 'metrics',
      partner: 'Peer PM (B2B SaaS)',
      durationMinutes: 45,
      score: 5,
      strengths: 'Structured the metric tree cleanly and defended the north star choice.',
      improvements:
        'Could not define activation without hedging, and did not name a single guardrail unprompted. Guardrails should be automatic.',
      questionIds: [],
      notes: 'Confirms the audit: metric thinking exists but is not fluent yet.',
    },
    {
      id: 'mock_002',
      date: addDays(PROGRAMME_START, 25),
      track: 'analytics',
      partner: 'Data analyst friend',
      durationMinutes: 40,
      score: 6,
      strengths: 'Wrote a working retention query. Explained the plan before typing, which read well.',
      improvements:
        'Needed a hint on the window function. Speed is the gap, not comprehension — drill until it is automatic.',
      questionIds: [],
      notes: 'Up one point on the SQL portion versus two weeks ago. The drilling is working.',
    },
  ]

  return { questions, mocks }
}
