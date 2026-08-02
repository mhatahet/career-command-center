/**
 * Networking, LinkedIn and job applications.
 *
 * Target companies and tiers are Part 8 verbatim. The compensation table is
 * Part 9 verbatim, stored as numbers so it can be charted.
 * The LinkedIn positioning, headline, About themes and weekly cadence are Part 6.
 */

import { SKILL_IDS as S } from './skills.mjs'
import { PROGRAMME_START, SEED_TODAY, addDays, id, monthStart, rng, round } from './util.mjs'

/* --------------------------------------------------------- target list ---- */

const TIER_1 = [
  ['Google', 'L5 PM. Demands exceptional evidence in strategy, metrics, experimentation and scale. Expects deeper technical fluency than you currently demonstrate.', 62],
  ['Microsoft', 'Senior PM. The most reachable Tier 1 for an enterprise SaaS profile — your systems and workflow depth maps directly onto their portfolio.', 74],
  ['Atlassian', 'Senior PM. Strong thematic fit: workflow software, complex permissions, enterprise admin. Interviews hard on craft and on writing.', 78],
  ['Shopify', 'Senior PM. High bar on commercial thinking and speed. Merchant-operations parallels your retail-execution background.', 66],
  ['Stripe', 'PM. Interviews on API and platform reasoning directly. Highest technical bar on this list; also the strongest writing culture.', 58],
  ['Canva', 'Senior PM. Consumer-adjacent craft and design sensibility. Your UX 8.8 helps; the consumer gap hurts.', 64],
  ['Miro', 'Senior PM. Collaboration and canvas products. Systems thinking is directly relevant to their extensibility platform.', 70],
]

const TIER_2 = [
  ['GitLab', 'All-remote, radically transparent, and documentation is a first-class artefact. Possibly the single best cultural fit on the entire list.', 88],
  ['GitHub', 'Developer products at scale. Requires the technical-depth work, but the platform thinking transfers cleanly.', 80],
  ['MongoDB', 'Developer and data infrastructure. Strong fit once the data-architecture gap closes.', 76],
  ['Datadog', 'Observability. Complex enterprise UX with genuinely high information density — squarely your strength.', 82],
  ['Okta', 'Identity and permissions. Your permissions and workflow depth is unusually directly relevant here.', 85],
  ['Elastic', 'Search and observability, all-remote. Technical products with enterprise buyers.', 78],
  ['Intercom', 'Customer communication with a serious AI product line. Good match for the AI PM work in month 5.', 80],
  ['Zapier', 'All-remote, workflow automation. Integration and workflow thinking is exactly your systems background.', 86],
  ['monday.com', 'Work OS. Workflow, permissions, admin surfaces — near-identical problem space to your current role.', 84],
  ['HubSpot', 'CRM platform. Strong PLG motion, which is a gap you would close on the job.', 76],
  ['Cloudflare', 'Infrastructure and developer products. Highest technical bar in Tier 2.', 68],
]

const TIER_3 = [
  ['Remote B2B SaaS (Series B–D)', 'Stepping stone that supplies international experience and quantified impact for the next application round.', 90],
  ['ERP / Logistics vendors', 'Direct domain match. Fastest route to a senior title with international scope.', 88],
  ['Field operations / Supply chain tech', 'Your exact background. Likely to interview well with minimal preparation.', 92],
  ['CRM / HR tech', 'Adjacent workflow software with transferable systems thinking.', 82],
  ['Retail execution vendors', 'Precisely your current domain. Strong immediate fit, lower long-term ceiling.', 90],
  ['Regional unicorns expanding globally', 'International exposure without relocation. Good bridge role.', 84],
]

function buildTargetCompanies() {
  const rows = [
    ...TIER_1.map(([name, note, fit]) => ({ name, note, fit, tier: 1 })),
    ...TIER_2.map(([name, note, fit]) => ({ name, note, fit, tier: 2 })),
    ...TIER_3.map(([name, note, fit]) => ({ name, note, fit, tier: 3 })),
  ]
  return rows.map((r) => ({
    id: id('co', r.name),
    name: r.name,
    tier: r.tier,
    note: r.note,
    fit: r.fit,
    // Watch the strongest fits in each tier by default.
    watching: r.fit >= 80,
  }))
}

/* ---------------------------------------------------- compensation ------- */

/** Part 9, verbatim. Illustrative — actual compensation varies significantly. */
const COMPENSATION = [
  { region: 'Jordan', todayLow: 30000, todayHigh: 50000, targetLow: 50000, targetHigh: 80000 },
  { region: 'GCC', todayLow: 60000, todayHigh: 100000, targetLow: 100000, targetHigh: 180000 },
  { region: 'Europe', todayLow: 80000, todayHigh: 130000, targetLow: 130000, targetHigh: 200000 },
  { region: 'UK', todayLow: 90000, todayHigh: 150000, targetLow: 150000, targetHigh: 250000 },
  { region: 'Canada', todayLow: 110000, todayHigh: 170000, targetLow: 170000, targetHigh: 260000 },
  { region: 'USA', todayLow: 150000, todayHigh: 220000, targetLow: 250000, targetHigh: 450000 },
  { region: 'Fully Remote', todayLow: 80000, todayHigh: 180000, targetLow: 180000, targetHigh: 300000 },
]

export function buildApplications() {
  return {
    // Applications begin in month 12 by design — the audit is explicit that
    // applying before you are interview-ready wastes referrals.
    applications: [],
    targetCompanies: buildTargetCompanies(),
    compensation: COMPENSATION,
  }
}

/* ---------------------------------------------------------- networking --- */

const CONTACTS = [
  ['Layla Haddad', 'monday.com', 'Group Product Manager', 'pm-leader', 'in-conversation', 4, 2,
    'Send the analytics case study when it publishes; she offered to review it.', 12,
    'Met through a Jordanian PM community. Genuinely helpful, fast replier. The single warmest lead on the list.'],
  ['Daniel Ríos', 'GitLab', 'Senior Product Manager', 'pm-leader', 'reached-out', 3, 2,
    'Follow up on the handbook question — he suggested a 30-minute call.', 19,
    'All-remote experience and very open about GitLab\'s hiring loop. Ask about the async-writing assessment.'],
  ['Priya Raman', 'Atlassian', 'Principal Product Manager', 'pm-leader', 'reached-out', 2, 1,
    'Comment thoughtfully on her posts for a month before asking for anything.', 22,
    'Writes about permissions architecture. Highest-value potential referral in Tier 1 — do not rush it.'],
  ['Marcus Webb', 'Independent', 'Technical Recruiter (B2B SaaS)', 'recruiter', 'in-conversation', 3, 2,
    'Send the updated resume once the quantified bullets are done.', 15,
    'Places senior PMs into European remote roles. Blunt, useful feedback on positioning.'],
  ['Sofia Almeida', 'Intercom', 'Product Lead, AI', 'pm-leader', 'to-reach-out', 1, 2,
    'Reach out after the month-5 AI prototype exists — approach with the artefact, not the ask.', null,
    'AI product evaluation is her specialty. Do not contact until you have something to show.'],
  ['Ahmad Nasser', 'Zapier', 'Product Manager', 'peer', 'warm', 4, 3,
    'Set up the fortnightly mock interview rotation.', 8,
    'Agreed to be a regular mock partner. Strong on execution rounds.'],
  ['Elena Kovač', 'Datadog', 'Director of Product', 'hiring-manager', 'to-reach-out', 1, 2,
    'Needs a warm introduction — ask Layla whether she knows anyone in common.', null,
    'Runs a team squarely in your domain. Cold outreach would be wasted; find the path in.'],
  ['James Okonkwo', 'Former colleague', 'Engineering Manager', 'mentor', 'warm', 5, null,
    'Ask him to review both architecture documents in month 8.', 5,
    'Will give honest technical critique. Use him as the quality gate on technical artefacts.'],
  ['Nadia Farouk', 'Okta', 'Senior Product Manager', 'pm-leader', 'to-reach-out', 1, 2,
    'Connect after publishing the permissions case study — that artefact is the introduction.', null,
    'Identity and permissions. The single most relevant person on this list to your actual expertise.'],
  ['Tom Bergström', 'Independent', 'PM Career Coach', 'mentor', 'reached-out', 2, null,
    'Book the first session for after the month-3 milestone.', 20,
    'Specialises in international transitions from smaller markets. Worth paying for.'],
  ['Grace Liu', 'Miro', 'Product Manager, Platform', 'pm-leader', 'to-reach-out', 1, 1,
    'Comment on her extensibility posts first; approach in month 7 with the teardown.', null,
    'Platform and extensibility — the direct overlap with your systems thinking.'],
  ['Omar Khalil', 'Local SaaS startup', 'VP Product', 'mentor', 'warm', 4, 3,
    'Monthly catch-up. Ask him to pressure-test the strategy memo in month 9.', 11,
    'Knows your work. Best source of a credible reference and of blunt feedback.'],
]

const EVENTS = [
  ['Mind the Product Global', 'conference', 3, 'Remote / London', 'considering',
    'Meet three PMs from Tier 2 companies and have one substantive conversation about their hiring loop.',
    'Strong speaker list. Worth attending remotely at minimum.'],
  ['ProductCon', 'conference', 5, 'Remote', 'considering',
    'Two connections in AI product roles.', 'Free remote tier. Low cost, moderate value.'],
  ['Local PM Meetup — Amman', 'meetup', 1, 'Amman', 'registered',
    'Present the metric-tree framework. Speaking is worth more than attending.',
    'Speaking slot available. Take it — presenting builds the brand faster than networking does.'],
  ['Reforge Summit', 'conference', 8, 'Remote', 'considering',
    'Growth and PLG content — both on the should-improve list.', 'Assess against cost.'],
  ['Enterprise UX Conference', 'conference', 11, 'Remote / Amsterdam', 'considering',
    'Your domain. Aim for a speaking submission rather than a ticket.',
    'Submit a talk on the workflow redesign once the case study is published.'],
]

export function buildNetworking() {
  const contacts = CONTACTS.map(([name, company, role, kind, status, strength, tier, nextAction, lastContactDaysAgo, notes]) => {
    const lastContact =
      lastContactDaysAgo === null ? undefined : addDays(SEED_TODAY, -lastContactDaysAgo)

    const touchpoints = lastContact
      ? [
          {
            id: `${id('ct', name)}_tp1`,
            date: lastContact,
            kind: status === 'warm' || status === 'in-conversation' ? 'call' : 'message',
            note:
              status === 'warm' || status === 'in-conversation'
                ? 'Real conversation. Established what they care about and what I could offer.'
                : 'Personalised connection request with a specific reference to their work.',
          },
        ]
      : []

    return {
      id: id('ct', name),
      name,
      company,
      role,
      kind,
      status,
      relationshipStrength: strength,
      linkedinUrl: undefined,
      email: undefined,
      nextAction,
      // Next action due a week out from the last contact, or soon if never contacted.
      nextActionDate: lastContact ? addDays(lastContact, 10) : addDays(SEED_TODAY, 5),
      lastContact,
      touchpoints,
      couldRefer: strength >= 3 && tier !== null,
      targetCompanyTier: tier ?? undefined,
      notes,
    }
  })

  const events = EVENTS.map(([name, kind, month, location, status, goal, notes]) => ({
    id: id('ev', name),
    name,
    kind,
    date: addDays(monthStart(month), 14),
    location,
    status,
    url: undefined,
    goal,
    outcomes: notes,
    contactsMade: 0,
    cost: undefined,
  }))

  return { contacts, events }
}

/* ------------------------------------------------------------ linkedin --- */

const IDEAS = [
  ['The metric tree I wish I had built two years ago', 'Lead with the dashboard nobody opened', 'Systems over features', 'deep-dive', 'drafting', ['Metrics']],
  ['Permissions are a product, not a setting', 'Why RBAC always breaks at scale', 'Complex enterprise product design', 'article', 'idea', ['UX', 'Systems Thinking']],
  ['Three things I got wrong about offline-first design', 'Conflict resolution is a product decision', 'Lessons from real product work', 'short-post', 'idea', ['Systems Thinking']],
  ['What SQL taught me about my own product thinking', 'I had been asking questions I could not answer', 'Lessons from real product work', 'short-post', 'idea', ['Analytics']],
  ['Reading a product\'s data model from the outside', 'Linear teardown', 'Systems over features', 'teardown', 'idea', ['Systems Thinking', 'Product Sense']],
  ['The exception that was the same exception nine times', 'Workflow redesign story', 'Complex enterprise product design', 'deep-dive', 'idea', ['UX']],
  ['Evaluating an LLM feature without vibes', '50 cases, four dimensions, one rubric', 'AI in enterprise software', 'deep-dive', 'idea', ['AI Product Knowledge']],
  ['Why your enterprise product needs fewer settings', 'Configurability is a tax on everyone', 'Product quality and maintainability', 'short-post', 'idea', ['UX', 'Product Sense']],
  ['The guardrail metric nobody set', 'A growth win that cost more than it made', 'Systems over features', 'short-post', 'idea', ['Metrics', 'Experimentation']],
  ['Documentation is a scaling mechanism, not overhead', 'What changed when we standardised PRDs', 'Product quality and maintainability', 'article', 'idea', ['Communication', 'Leadership']],
  ['AI in enterprise software: what actually ships', 'Retrieval quality beats model choice', 'AI in enterprise software', 'deep-dive', 'idea', ['AI Product Knowledge']],
  ['I stopped estimating and started sizing risk', 'A change in how I plan', 'Lessons from real product work', 'short-post', 'idea', ['Product Execution']],
]

export function buildLinkedIn() {
  const random = rng(20260701)

  // Weekly snapshots since programme start, showing the effect of consistent
  // engagement from a realistic starting point.
  const snapshots = []
  let followers = 1180
  let connections = 940
  for (let week = 0; week <= 4; week += 1) {
    const date = addDays(PROGRAMME_START, week * 7)
    if (week > 0) {
      followers += Math.round(18 + random() * 22)
      connections += Math.round(16 + random() * 10)
    }
    snapshots.push({
      date,
      followers,
      connections,
      impressions: week === 0 ? 620 : Math.round(1400 + random() * 2600),
      profileViews: week === 0 ? 24 : Math.round(38 + random() * 70),
      searchAppearances: week === 0 ? 11 : Math.round(18 + random() * 32),
      posts: week === 0 ? 0 : Math.round(1 + random() * 2),
      comments: week === 0 ? 2 : Math.round(12 + random() * 16),
    })
  }

  const ideas = IDEAS.map(([title, angle, theme, format, status, skills], index) => ({
    id: id('idea', title),
    title,
    angle,
    theme,
    format,
    status,
    scheduledFor: status === 'drafting' ? addDays(SEED_TODAY, 4) : undefined,
    publishedAt: undefined,
    url: undefined,
    impressions: undefined,
    reactions: undefined,
    comments: undefined,
    skillIds: skills.map((s) => S[s]).filter(Boolean),
    order: index,
  }))

  // Monthly targets for the first 12 months, ramping as the habit compounds.
  const monthlyGoals = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    return {
      month: monthStart(month).slice(0, 7),
      followers: 1180 + month * 180,
      posts: month >= 7 ? 12 : 6,
      comments: month >= 7 ? 100 : 50,
      connections: 940 + month * 80,
    }
  })

  return {
    // Part 6, verbatim.
    positioning:
      'Enterprise SaaS Product Manager specializing in complex workflows, UX systems, AI-enabled products, and scalable product execution.',
    headline:
      'Senior Product Manager | B2B SaaS | Enterprise UX | AI Products | Product Strategy | Systems Thinking',
    aboutThemes: [
      'Systems over features.',
      'Complex enterprise product design.',
      'Product quality and maintainability.',
      'AI in enterprise software.',
      'Lessons from real product work.',
    ],
    weeklyCadence: [
      { label: 'Deep-dive article', target: 1, unit: 'per week' },
      { label: 'Shorter posts (lessons, frameworks, observations)', target: 2, unit: 'per week' },
      { label: 'Thoughtful comments on posts by recognised PMs', target: 25, unit: 'per week' },
      { label: 'Personalised connection requests to PMs, Directors, recruiters', target: 10, unit: 'per week' },
    ],
    snapshots,
    ideas,
    monthlyGoals,
  }
}

export { round }
