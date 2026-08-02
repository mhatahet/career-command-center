/**
 * The 24-month roadmap, expanded from `current_analysis.txt` Part 4 into a
 * learning tree: Chapter (month) → Mission → Task → Subtask.
 *
 * The audit gives a focus and a measurable output per month. Everything below
 * that level is the concrete work needed to actually hit the stated output, so
 * that every month has a defensible definition of done rather than a theme.
 *
 * Authored with a compact DSL — `m()` for missions, `t()` for tasks — because
 * the shape repeats and the content should stay readable in review.
 */

import { SKILL_IDS as S } from './skills.mjs'
import { monthEnd, monthStart, seqId, slug } from './util.mjs'

/* --------------------------------------------------------------------- DSL */

/** Task. `h` = estimated hours, `d` = difficulty 1–5, `sk` = skill names. */
function t(title, h, d, sk, subtasks = [], opts = {}) {
  return {
    title,
    hours: h,
    difficulty: d,
    skills: sk,
    subtasks,
    resources: opts.resources ?? [],
    description: opts.description ?? '',
    deps: opts.deps ?? [],
  }
}

function m(title, summary, rationale, reflectionPrompt, tasks, opts = {}) {
  return { title, summary, rationale, reflectionPrompt, tasks, achievement: opts.achievement }
}

/* ---------------------------------------------------------------- chapters */

const CHAPTERS = [
  /* ===================================================== MONTH 1 ======== */
  {
    month: 1,
    title: 'SQL & Product Metrics',
    focus: 'SQL + Product Metrics',
    output: '30 SQL exercises, 5 KPI frameworks',
    difficulty: 3,
    roi: 'very-high',
    outcomes: [
      'Write a window function without looking it up',
      'Five complete metric trees you can defend in an interview',
      'The word "non-negotiable" no longer applies to your SQL',
    ],
    commitments: {
      writing: 'One long-form article: "The metric tree I wish I had built two years ago"',
      networking: '20 relevant connections/week; 5 real conversations',
      interviewPractice: '1 written case + 1 estimation exercise per week',
      portfolio: 'Set up the portfolio site shell and publish an about page',
      applications: 'None — deliberately. Do not burn referrals before you are ready.',
    },
    missions: [
      m(
        'Learn SQL to interview standard',
        'Go from reading SQL to writing it under time pressure.',
        'The audit calls SQL non-negotiable and puts Analytics at 6.5/10 — the joint-lowest score with the highest weight. Nothing else on this roadmap unblocks as much.',
        'Which SQL construct still makes you hesitate, and what will you drill this week to fix it?',
        [
          t(
            'Complete SQLBolt end to end',
            6,
            2,
            ['Analytics'],
            [
              'Lessons 1–6: SELECT, WHERE, ORDER BY, LIMIT',
              'Lessons 7–12: JOINs and NULL handling',
              'Lessons 13–18: INSERT, UPDATE, DELETE, schema',
              'Redo every exercise without hints',
            ],
            { resources: [{ label: 'SQLBolt', url: 'https://sqlbolt.com' }] },
          ),
          t(
            'Complete the Mode Analytics SQL tutorial',
            10,
            3,
            ['Analytics'],
            [
              'Basic SQL module',
              'Intermediate SQL: aggregation and CASE',
              'Advanced SQL: window functions',
              'Advanced SQL: performance tuning',
              'Work the Mode case studies with real data',
            ],
            { resources: [{ label: 'Mode SQL Tutorial', url: 'https://mode.com/sql-tutorial/' }] },
          ),
          t(
            'Solve 50 interview-grade SQL questions',
            18,
            4,
            ['Analytics'],
            [
              'Questions 1–10: aggregation and grouping',
              'Questions 11–20: multi-table joins',
              'Questions 21–30: window functions and ranking',
              'Questions 31–40: cohort and retention queries',
              'Questions 41–50: funnels and time-series',
              'Re-solve the 10 you got wrong, from scratch',
            ],
            {
              resources: [
                { label: 'StrataScratch', url: 'https://www.stratascratch.com' },
                { label: 'DataLemur SQL', url: 'https://datalemur.com/questions' },
              ],
              description:
                'Target: any question answered in under 8 minutes, out loud, explaining the plan before typing.',
            },
          ),
          t('Write the SQL pattern reference you will actually reuse', 3, 2, ['Analytics'], [
            'Retention query template',
            'Funnel query template',
            'Cohort query template',
            'Rolling-window query template',
          ]),
          t('Build one dashboard from your own queries', 6, 3, ['Analytics', 'Metrics'], [
            'Pick a public dataset',
            'Write 6 queries that answer real product questions',
            'Assemble into a single dashboard view',
            'Write the "so what" paragraph under each chart',
          ]),
        ],
        { achievement: 'ach_sql-intermediate' },
      ),
      m(
        'Build 5 KPI frameworks',
        'Construct and defend complete metric trees for five products you know.',
        'Metrics sits at 6.8/10. The audit is explicit: your documentation is excellent but your metric thinking is not equally visible. A metric tree is the artefact that makes it visible.',
        'Which of your five trees would collapse first under an interviewer\'s "why that north star?"',
        [
          t(
            'Learn the metric-tree structure cold',
            4,
            2,
            ['Metrics'],
            [
              'North Star',
              'Input metrics',
              'Leading indicators',
              'Experiment metrics',
              'Business metrics',
              'Guardrails',
              'Long-term effects',
            ],
            {
              description:
                'This exact chain is quoted in the audit. Learn it as a checklist you can run in an interview without thinking.',
            },
          ),
          t('Framework 1 — your current product', 3, 3, ['Metrics', 'Business Thinking'], [
            'Define the north star and defend it in one paragraph',
            'Three input metrics with owners',
            'Two guardrails',
            'One long-term effect you would watch for 12 months',
          ]),
          t('Framework 2 — a B2B SaaS workflow tool (Linear or Asana)', 3, 3, ['Metrics'], [
            'North star and rationale',
            'Activation definition',
            'Retention definition and window',
            'Guardrails',
          ]),
          t('Framework 3 — a marketplace (Airbnb or Uber Eats)', 3, 4, ['Metrics', 'Product Strategy'], [
            'Balance supply and demand metrics',
            'Liquidity metric',
            'Guardrails against one side degrading',
          ]),
          t('Framework 4 — a consumer subscription (Spotify or Duolingo)', 3, 3, ['Metrics', 'Product Sense'], [
            'Engagement metric that is not vanity',
            'Habit / streak mechanic and its metric',
            'Churn leading indicators',
          ]),
          t('Framework 5 — an AI product (a copilot of your choosing)', 3, 4, ['Metrics', 'AI Product Knowledge'], [
            'Quality metric and how it is measured',
            'Cost per interaction',
            'Trust and safety guardrails',
            'Deflection or time-saved business metric',
          ]),
        ],
        { achievement: 'ach_metrics-architect' },
      ),
      m(
        'Set the operating system up',
        'Put the habits and instrumentation in place before the hard months arrive.',
        'The audit\'s biggest listed mistake is measuring progress by effort instead of observable results. This mission makes results observable from day one.',
        'What did you plan this month that you did not do, and was the plan wrong or the week?',
        [
          t('Define your weekly operating cadence', 2, 1, ['Prioritization'], [
            'Block the hours in a calendar, not in your head',
            'Choose the two days that are non-negotiable',
            'Decide what gets dropped when the week goes wrong',
          ]),
          t('Quantify three outcomes from your current role', 5, 4, ['Business Thinking'], [
            'Pick three initiatives you actually owned',
            'Find or estimate the number for each',
            'Write each as one sentence with the number in it',
            'Sanity-check each with someone who was there',
          ], {
            description:
              'The audit\'s first instruction if it were responsible for getting you hired. Do it now while the details are fresh, not in month 12.',
          }),
          t('Stand up the portfolio site shell', 4, 2, ['Product Execution'], [
            'Domain and hosting',
            'About page with the positioning statement',
            'Empty case-study template you will reuse six times',
          ]),
        ],
      ),
    ],
  },

  /* ===================================================== MONTH 2 ======== */
  {
    month: 2,
    title: 'Product Analytics in Anger',
    focus: 'Amplitude / Mixpanel',
    output: 'Analyze a public dataset and publish 1 case study',
    difficulty: 3,
    roi: 'very-high',
    outcomes: [
      'Fluent in one product-analytics tool, competent in a second',
      'One published analytics case study anyone can read',
      'A funnel, a retention curve and a cohort table you built yourself',
    ],
    commitments: {
      writing: 'The analytics case study itself, published publicly',
      networking: '20 connections/week; 2 conversations with data-adjacent PMs',
      interviewPractice: '1 metrics case + 1 estimation exercise per week',
      portfolio: 'Publish portfolio artefact #1 (the analytics case study)',
      applications: 'None yet',
    },
    missions: [
      m(
        'Get fluent in a product-analytics tool',
        'Learn Amplitude or Mixpanel properly, not by clicking around.',
        'The audit lists Mixpanel, Amplitude, GA4, Looker and Mode as missing evidence. Tool fluency is table stakes; the interview question is "walk me through how you would find out".',
        'Could you answer a retention question live, in the tool, while someone watches?',
        [
          t('Complete Amplitude Academy core path', 6, 2, ['Analytics'], [
            'Events, properties and taxonomy',
            'Segmentation',
            'Funnels',
            'Retention and cohorts',
            'Dashboards and notebooks',
          ], { resources: [{ label: 'Amplitude Academy', url: 'https://academy.amplitude.com' }] }),
          t('Rebuild the same three analyses in Mixpanel', 4, 3, ['Analytics'], [
            'Funnel',
            'Retention',
            'Cohort comparison',
            'Note where the two tools disagree and why',
          ]),
          t('Design an event taxonomy from scratch', 4, 4, ['Analytics', 'Systems Thinking'], [
            'Naming convention with a written rule',
            'Event and property schema',
            'What you deliberately do not track',
            'Migration plan for an existing bad taxonomy',
          ], {
            description:
              'Systems Thinking is your 9.5. Applied to analytics instrumentation it becomes a differentiator rather than a separate strength.',
          }),
        ],
      ),
      m(
        'Publish the analytics case study',
        'Funnel analysis, retention, cohort analysis and metric recommendations, in public.',
        'Portfolio project #5 in the audit\'s ROI ranking, and the fastest way to convert Analytics 6.5 into visible evidence.',
        'Does the case study end with a decision, or does it end with charts?',
        [
          t('Choose the dataset and frame the question', 3, 3, ['Analytics', 'Product Sense'], [
            'Pick a public product dataset',
            'Write the one business question the analysis answers',
            'State your hypothesis before you look',
          ]),
          t('Run the funnel analysis', 5, 3, ['Analytics'], [
            'Define the steps and the window',
            'Compute conversion at each step',
            'Segment by at least two dimensions',
            'Identify the single biggest drop',
          ]),
          t('Run retention and cohort analysis', 6, 4, ['Analytics'], [
            'Classic retention curve',
            'Cohort table by signup week',
            'Find the retention plateau',
            'Identify one behaviour correlated with retained users',
          ]),
          t('Write the metric recommendations', 4, 4, ['Metrics', 'Business Thinking'], [
            'Three recommendations, each with an expected effect size',
            'What you would instrument next',
            'What would falsify your conclusion',
          ]),
          t('Publish and promote it', 3, 2, ['Communication'], [
            'Publish on the portfolio site',
            'LinkedIn post with the single most surprising finding',
            'Send it to three people whose opinion you respect',
          ]),
        ],
        { achievement: 'ach_analytics-explorer' },
      ),
    ],
  },

  /* ===================================================== MONTH 3 ======== */
  {
    month: 3,
    title: 'Experimentation',
    focus: 'Experimentation',
    output: 'Design 10 A/B test plans',
    difficulty: 4,
    roi: 'very-high',
    outcomes: [
      'Compute sample size and MDE by hand',
      'Ten complete, critique-proof test plans',
      'One real experiment run and written up',
    ],
    commitments: {
      writing: 'One long-form article: "Ten experiments I designed and what each would have taught us"',
      networking: '20 connections/week; connect with 3 experimentation platform PMs',
      interviewPractice: '2 metrics cases per week — this is the round you are weakest in',
      portfolio: 'Add the experiment design library as artefact #2',
      applications: 'None yet',
    },
    missions: [
      m(
        'Learn experimentation properly',
        'Statistical foundations first, tooling second.',
        'Experimentation is 6.2/10 — the lowest score in the audit and described as a large gap. Top PMs discuss power and confidence intervals continuously.',
        'Can you explain a p-value to a sceptical engineer without hedging?',
        [
          t('Read Trustworthy Online Controlled Experiments, parts I–II', 12, 4, ['Experimentation'], [
            'Chapters 1–4: fundamentals',
            'Chapters 5–8: statistics behind the tests',
            'Take notes as decision rules, not summaries',
          ]),
          t('Learn to compute power, sample size and MDE by hand', 6, 5, ['Experimentation', 'Analytics'], [
            'Sample size for a proportion metric',
            'Minimum detectable effect from a fixed sample',
            'Effect of baseline rate on required n',
            'Why peeking inflates false positives',
            'Redo all four without notes',
          ], {
            description:
              'Doing this by hand once is what separates "I have read about A/B tests" from "I design them".',
          }),
          t('Study the failure modes', 5, 4, ['Experimentation'], [
            'Sample ratio mismatch',
            'Novelty and primacy effects',
            'Multiple comparisons',
            'Simpson\'s paradox',
            'Network effects and interference',
          ]),
        ],
      ),
      m(
        'Design 10 A/B test plans',
        'Ten complete plans, each defensible under cross-examination.',
        'The audit\'s measurable output for month 3. Ten plans also become a portfolio artefact and a bank of interview answers.',
        'Which of the ten would you actually bet money on, and why that one?',
        [
          t('Build the reusable test-plan template', 2, 2, ['Experimentation'], [
            'Hypothesis in if/then/because form',
            'Primary metric and why it is the primary',
            'MDE and sample size',
            'Duration and traffic allocation',
            'Guardrail metrics',
            'Decision rule written before launch',
          ]),
          t('Plans 1–3: onboarding and activation', 5, 3, ['Experimentation', 'Product Sense'], [
            'Plan 1: signup friction reduction',
            'Plan 2: onboarding checklist',
            'Plan 3: time-to-first-value',
          ]),
          t('Plans 4–6: monetisation and pricing', 5, 4, ['Experimentation', 'Business Thinking'], [
            'Plan 4: paywall placement',
            'Plan 5: pricing page structure',
            'Plan 6: trial length',
          ]),
          t('Plans 7–8: retention and re-engagement', 4, 4, ['Experimentation'], [
            'Plan 7: notification cadence with a guardrail on unsubscribes',
            'Plan 8: dormant-user reactivation',
          ]),
          t('Plans 9–10: AI feature rollout', 4, 5, ['Experimentation', 'AI Product Knowledge'], [
            'Plan 9: AI suggestion acceptance rate',
            'Plan 10: model swap with a quality guardrail',
          ]),
          t('Have all ten critiqued', 3, 3, ['Experimentation', 'Communication'], [
            'Find someone who runs experiments for a living',
            'Get written critique on at least three plans',
            'Revise and record what you got wrong',
          ]),
        ],
        { achievement: 'ach_experiment-designer' },
      ),
      m(
        'Run one real experiment',
        'However small. The point is the write-up.',
        'Hands-on experimentation is a must-fix item. Reading about it does not close the gap.',
        'What did the data say that you did not expect?',
        [
          t('Find and ship a real test at work', 8, 4, ['Experimentation', 'Stakeholder Management'], [
            'Identify a low-risk candidate',
            'Get engineering buy-in',
            'Pre-register the hypothesis and decision rule',
            'Ship it',
          ]),
          t('Analyse and write it up honestly', 4, 4, ['Experimentation', 'Communication'], [
            'Read the result against the pre-registered rule',
            'State the confidence interval, not just the point estimate',
            'Write what you would do differently',
          ]),
        ],
      ),
    ],
  },

  /* ===================================================== MONTH 4 ======== */
  {
    month: 4,
    title: 'Product Sense',
    focus: 'Product Sense',
    output: '20 product critiques',
    difficulty: 3,
    roi: 'high',
    outcomes: [
      'Twenty critiques with a repeatable structure',
      'Comfort reasoning about consumer products and user psychology',
      'A product-sense answer you can give cold in 20 minutes',
    ],
    commitments: {
      writing: 'One long-form article: the best three critiques, edited together',
      networking: '20 connections/week; 5 conversations',
      interviewPractice: '2 product-sense cases per week',
      portfolio: 'Publish the critique series as a running artefact',
      applications: 'None yet',
    },
    missions: [
      m(
        'Build a critique engine',
        'A fixed structure so quality does not depend on mood.',
        'Product Sense is 7.8 with a specific diagnosis: you think about system correctness where FAANG PMs think about market expansion, user psychology, consumer behaviour and growth loops. The template forces the missing half.',
        'Which critique taught you something about users rather than about systems?',
        [
          t('Design the critique template', 3, 2, ['Product Sense'], [
            'Who is the user and what job are they doing',
            'What friction exists and how would you know',
            'One hypothesis with a metric',
            'A section you are forced to fill in on user psychology',
            'A section you are forced to fill in on the growth loop',
            'What you would deliberately not build',
          ]),
          t('Critiques 1–5: enterprise products you know well', 6, 2, ['Product Sense', 'UX'], [
            'Jira', 'Salesforce', 'SAP or an ERP you have used', 'Zendesk', 'Workday',
          ]),
          t('Critiques 6–10: developer and workflow tools', 6, 3, ['Product Sense', 'Technical Depth'], [
            'Linear', 'GitHub', 'Vercel', 'Notion', 'Slack',
          ]),
          t('Critiques 11–15: consumer products (the uncomfortable ones)', 7, 4, ['Product Sense'], [
            'Duolingo', 'Spotify', 'Instagram', 'TikTok', 'Strava',
          ], {
            description:
              'Deliberately outside your comfort zone. For each one, name the behavioural mechanic before you name a feature.',
          }),
          t('Critiques 16–20: marketplaces and fintech', 6, 4, ['Product Sense', 'Product Strategy'], [
            'Airbnb', 'Uber Eats', 'Stripe Dashboard', 'Revolut', 'Etsy',
          ]),
        ],
        { achievement: 'ach_product-sense-20' },
      ),
      m(
        'Close the user-psychology gap',
        'Learn the vocabulary you are missing.',
        'The audit names user psychology, consumer behaviour and growth loops as the specific blind spots. They are learnable in a month.',
        'Which behavioural principle explains something you previously called "users being irrational"?',
        [
          t('Read Hooked and extract the mechanics', 5, 2, ['Product Sense'], [
            'Trigger, action, variable reward, investment',
            'Map the loop onto three products you use daily',
          ]),
          t('Study growth loops as a formal object', 5, 3, ['Product Sense', 'Business Thinking'], [
            'Viral loop', 'Content loop', 'Paid loop', 'Sales loop',
            'Draw the loop for two products, with the leaks marked',
          ]),
          t('Learn the behavioural-economics shortlist', 4, 3, ['Product Sense'], [
            'Loss aversion', 'Anchoring', 'Default effect', 'Endowed progress', 'Social proof',
          ]),
        ],
      ),
    ],
  },

  /* ===================================================== MONTH 5 ======== */
  {
    month: 5,
    title: 'AI Product Management',
    focus: 'AI PM',
    output: 'Build 1 AI-powered product prototype',
    difficulty: 4,
    roi: 'very-high',
    outcomes: [
      'A working AI prototype with a real evaluation set',
      'An AI Copilot PRD covering retrieval, prompts, eval, rollout and metrics',
      'Defensible unit economics for an AI feature',
    ],
    commitments: {
      writing: 'One long-form article: "How I evaluated an LLM feature without vibes"',
      networking: '20 connections/week; 3 AI PMs specifically',
      interviewPractice: '2 cases per week, one of them AI-flavoured',
      portfolio: 'The AI prototype + PRD becomes artefact #3',
      applications: 'None yet',
    },
    missions: [
      m(
        'Build the prototype',
        'Something that works, that you can demo in three minutes.',
        'AI Product Knowledge is 7.7 — above average but the fastest-appreciating skill on the list. A working prototype is worth more than any course certificate.',
        'What broke that you did not anticipate, and what does that tell you about shipping AI?',
        [
          t('Scope an AI product worth building', 4, 3, ['AI Product Knowledge', 'Product Sense'], [
            'Pick a problem where AI is genuinely the right tool',
            'Write the one-sentence value proposition',
            'Define what "good output" means, concretely',
          ]),
          t('Build the retrieval layer', 8, 4, ['AI Product Knowledge', 'Technical Depth'], [
            'Chunking strategy and why',
            'Embeddings and vector store',
            'Retrieval quality check',
            'Handle the no-relevant-context case',
          ]),
          t('Design the prompting architecture', 6, 4, ['AI Product Knowledge'], [
            'System prompt with explicit constraints',
            'Few-shot examples chosen deliberately',
            'Structured output schema',
            'Failure and refusal handling',
          ]),
          t('Ship a usable interface', 8, 3, ['AI Product Knowledge', 'UX'], [
            'Streaming responses',
            'Show the sources',
            'Make the uncertainty visible',
            'A correction path when it is wrong',
          ], {
            description:
              'AI UX is on the audit\'s gap list. The interface is where trust is won or lost.',
          }),
        ],
        { achievement: 'ach_ai-builder' },
      ),
      m(
        'Evaluate it like a professional',
        'A real eval set with a scoring rubric.',
        'LLM evaluation is explicitly listed as missing. This mission is the single most differentiating thing in the month.',
        'What does your eval set fail to catch?',
        [
          t('Build a 50-case labelled eval set', 8, 5, ['AI Product Knowledge', 'Analytics'], [
            'Collect 50 representative inputs',
            'Write the expected output or rubric for each',
            'Include 10 adversarial cases',
            'Include 5 cases where the right answer is "I do not know"',
          ]),
          t('Define the scoring rubric and score a baseline', 5, 4, ['AI Product Knowledge', 'Metrics'], [
            'Dimensions: correctness, groundedness, tone, safety',
            'Score the baseline model',
            'Record the numbers so improvements are provable',
          ]),
          t('Model the unit economics', 4, 4, ['AI Product Knowledge', 'Business Thinking'], [
            'Cost per query at current prompt size',
            'Cache-hit assumptions',
            'Latency budget',
            'What breaks at 100× volume',
          ]),
          t('Write the AI Copilot PRD', 8, 4, ['AI Product Knowledge', 'Product Execution'], [
            'Problem and users',
            'Retrieval design',
            'Prompt architecture',
            'Evaluation plan and current scores',
            'Staged rollout with guardrails',
            'Success metrics and kill criteria',
          ]),
        ],
      ),
    ],
  },

  /* ===================================================== MONTH 6 ======== */
  {
    month: 6,
    title: 'Portfolio Sprint',
    focus: 'Portfolio',
    output: 'Publish 2 complete case studies',
    difficulty: 4,
    roi: 'very-high',
    outcomes: [
      'Two flagship case studies live and shareable',
      'The complex-SaaS-workflow redesign published',
      'A portfolio you would send to a hiring manager without apologising',
    ],
    commitments: {
      writing: 'Both case studies, plus one article on the redesign process',
      networking: '20 connections/week; share the portfolio with 10 people directly',
      interviewPractice: '2 cases per week; start recording yourself',
      portfolio: 'Two complete case studies — the month is the portfolio',
      applications: 'None yet. Portfolio first, applications second.',
    },
    missions: [
      m(
        'Ship the SaaS workflow redesign',
        'The audit\'s highest-ROI portfolio project.',
        'Ranked #1 in Part 5 because it shows systems thinking, UX and execution simultaneously — all three of your strengths, in one artefact, in public.',
        'Does the case study make your systems thinking visible to someone who has never met you?',
        [
          t('Choose the workflow and gather the evidence', 5, 3, ['UX', 'Product Discovery'], [
            'Pick a genuinely complex workflow',
            'Document the current state honestly',
            'Find or construct the user evidence',
          ]),
          t('Do the redesign work', 20, 4, ['UX', 'Systems Thinking'], [
            'Information architecture',
            'State machine for the workflow',
            'Permissions model',
            'Edge cases and error states',
            'High-fidelity screens for the core path',
          ]),
          t('Write the case study', 10, 4, ['Communication', 'Product Execution'], [
            'Problem framing',
            'User insights',
            'The options you rejected and why',
            'Tradeoffs',
            'Success metrics',
            'Risks',
            'Outcomes',
          ], {
            description:
              'The audit lists exactly these emphases for every portfolio project. Use them as headings.',
          }),
          t('Publish it properly', 4, 2, ['Communication'], [
            'Publish on the portfolio site',
            'Write the LinkedIn post that makes people click',
            'Ask three PMs for critique, publicly',
          ]),
        ],
        { achievement: 'ach_first-case-study' },
      ),
      m(
        'Ship case study #2',
        'A second complete artefact, deliberately different in kind.',
        'Two case studies establish a pattern; one looks like an accident. Variety proves range.',
        'Which of the two is stronger, and what does the weaker one need?',
        [
          t('Choose the second artefact for contrast', 2, 2, ['Product Strategy'], [
            'Pick something that shows a different competency',
            'Confirm it does not overlap case study #1',
          ]),
          t('Build and publish it', 18, 4, ['Product Execution', 'Communication'], [
            'Research and framing',
            'Body of work',
            'Metrics section — non-negotiable',
            'Publish',
          ]),
          t('Add a portfolio index that reads well in 30 seconds', 4, 3, ['UX', 'Communication'], [
            'One-line summary per artefact',
            'The competency each one proves',
            'Lead with the strongest',
          ]),
        ],
      ),
    ],
  },

  /* ===================================================== MONTH 7 ======== */
  {
    month: 7,
    title: 'Public Brand',
    focus: 'LinkedIn',
    output: '8 posts, 20 meaningful comments/week',
    difficulty: 2,
    roi: 'high',
    outcomes: [
      'A consistent publishing cadence you can sustain for 18 more months',
      'Recognisable positioning, not generic PM content',
      'First inbound conversations from people you have never met',
    ],
    commitments: {
      writing: '1 deep-dive + 2 shorter posts per week',
      networking: '10 personalised connection requests/week to PMs, Directors and recruiters',
      interviewPractice: '2 cases per week',
      portfolio: 'Repackage existing artefacts into post-sized pieces',
      applications: 'None yet',
    },
    missions: [
      m(
        'Fix the positioning',
        'Say one specific thing, repeatedly.',
        'The audit gives the positioning statement and headline verbatim. Outside your network almost nobody knows you — that is a distribution problem, not a talent problem.',
        'If a recruiter read three of your posts, could they say what you specialise in?',
        [
          t('Rewrite the profile against the audit\'s positioning', 4, 2, ['Communication'], [
            'Headline: Senior Product Manager | B2B SaaS | Enterprise UX | AI Products | Product Strategy | Systems Thinking',
            'About section built on the five themes',
            'Featured section pointing at the portfolio',
            'Experience bullets rewritten with numbers',
          ]),
          t('Build the content pillars', 3, 2, ['Communication', 'Product Strategy'], [
            'Systems over features',
            'Complex enterprise product design',
            'Product quality and maintainability',
            'AI in enterprise software',
            'Lessons from real product work',
          ]),
          t('Fill a 30-idea backlog', 4, 2, ['Communication'], [
            'Ten ideas from work you have already done',
            'Ten from the critiques and teardowns',
            'Ten from things you got wrong',
          ]),
        ],
      ),
      m(
        'Publish 8 posts and comment with substance',
        'Volume with a floor on quality.',
        'The audit specifies 8 posts and 20–30 thoughtful comments per week, and explicitly warns against generic motivational content.',
        'Which post got traction, and was it the one you expected?',
        [
          t('Publish 2 deep-dive articles', 8, 3, ['Communication'], [
            'Article 1: from your strongest case study',
            'Article 2: a framework you actually use',
          ]),
          t('Publish 6 shorter posts', 6, 2, ['Communication'], [
            'Two lessons learned',
            'Two frameworks',
            'Two observations from real work',
          ]),
          t('Comment 20+ times per week, substantively', 6, 2, ['Communication', 'Leadership'], [
            'Build a list of 30 PMs worth engaging with',
            'Week 1', 'Week 2', 'Week 3', 'Week 4',
          ], {
            description:
              'A comment that adds a distinct point is worth more than ten posts nobody reads. This is how you get discovered by people with reach.',
          }),
          t('Review what worked and set the next month\'s cadence', 2, 2, ['Analytics', 'Communication'], [
            'Impressions, profile views, connection quality',
            'Which pillar performed',
            'Adjust the mix',
          ]),
        ],
        { achievement: 'ach_top-writer' },
      ),
    ],
  },

  /* ===================================================== MONTH 8 ======== */
  {
    month: 8,
    title: 'System Design & Technical Depth',
    focus: 'System Design',
    output: '2 architecture-focused product documents',
    difficulty: 5,
    roi: 'high',
    outcomes: [
      'Two architecture documents that engineers respect',
      'Fluency in APIs, data architecture and cloud tradeoffs',
      'Ability to hold a system-design round at Stripe or GitLab',
    ],
    commitments: {
      writing: 'One long-form article on an architecture tradeoff',
      networking: '20 connections/week; 3 platform or infra PMs',
      interviewPractice: '2 cases per week, one technical',
      portfolio: 'Both architecture documents published',
      applications: 'None yet',
    },
    missions: [
      m(
        'Close the technical-depth gap',
        'The six specific areas the audit names.',
        'Technical Depth is 7.5 — enough to work with engineers, not enough for Google. The named gaps are distributed systems, APIs, data architecture, cloud tradeoffs, ML pipelines and infrastructure.',
        'Which tradeoff can you now argue both sides of?',
        [
          t('Read Designing Data-Intensive Applications, chapters 1–6', 14, 5, ['Technical Depth'], [
            'Ch 1–2: reliability, scalability, data models',
            'Ch 3: storage and retrieval',
            'Ch 4: encoding and evolution',
            'Ch 5: replication',
            'Ch 6: partitioning',
            'Write the tradeoff notes as decision rules',
          ]),
          t('Design an API from first principles', 8, 4, ['Technical Depth', 'Systems Thinking'], [
            'Resource model',
            'Versioning strategy',
            'Pagination',
            'Idempotency',
            'Error taxonomy',
            'Rate limiting and quotas',
          ], {
            description:
              'API products and developer products are both on the should-improve list, and Stripe interviews on this directly.',
          }),
          t('Learn the cloud tradeoffs that come up in interviews', 6, 4, ['Technical Depth'], [
            'SQL vs NoSQL, with a real decision',
            'Sync vs async and queues',
            'Caching layers and invalidation',
            'Multi-tenancy models',
          ]),
        ],
      ),
      m(
        'Write 2 architecture-focused product documents',
        'Product documents where the architecture is the product decision.',
        'The audit\'s measurable output for the month, and the artefact that converts Systems Thinking 9.5 into something a stranger can verify.',
        'Would a staff engineer sign off on these?',
        [
          t('Document 1 — platform and extensibility', 12, 5, ['Systems Thinking', 'Technical Depth'], [
            'The extensibility problem',
            'Data model and state transitions',
            'Extension points and their contracts',
            'Migration path from today',
            'What this makes hard later',
          ]),
          t('Document 2 — data architecture for a product surface', 12, 5, ['Technical Depth', 'Analytics'], [
            'Event model',
            'Storage and retention decisions',
            'Real-time vs batch, and why',
            'Cost model',
            'Privacy and access control',
          ]),
          t('Get both reviewed by an engineer', 3, 3, ['Stakeholder Management'], [
            'Find a senior or staff engineer',
            'Written feedback on both',
            'Revise and note what you missed',
          ]),
        ],
        { achievement: 'ach_systems-thinker' },
      ),
    ],
  },

  /* ===================================================== MONTH 9 ======== */
  {
    month: 9,
    title: 'Pricing & Monetisation',
    focus: 'Pricing & Monetization',
    output: 'Write 3 pricing strategy analyses',
    difficulty: 4,
    roi: 'high',
    outcomes: [
      'Three pricing analyses with real numbers',
      'A working SaaS financial model',
      'The product-strategy memo published',
    ],
    commitments: {
      writing: 'One long-form article on a pricing decision',
      networking: '20 connections/week; 2 growth or monetisation PMs',
      interviewPractice: '2 cases per week; add estimation drills',
      portfolio: 'The strategy memo becomes artefact #4',
      applications: 'Begin light research on target companies — no applications yet',
    },
    missions: [
      m(
        'Learn pricing as a discipline',
        'Value, packaging, and the model behind it.',
        'Business Thinking is 8.0 and the audit says it improves dramatically by working with pricing, growth, PLG, retention, expansion and revenue models. Pricing is the fastest entry point.',
        'What price would you set, and what would make you wrong?',
        [
          t('Learn the pricing model taxonomy', 5, 3, ['Business Thinking'], [
            'Seat-based', 'Usage-based', 'Tiered', 'Hybrid', 'Value-based',
            'For each: when it breaks',
          ]),
          t('Build a SaaS financial model', 8, 5, ['Business Thinking', 'Analytics'], [
            'MRR / ARR build-up',
            'Churn and net revenue retention',
            'CAC and payback period',
            'LTV and the LTV:CAC ratio',
            'Sensitivity on the two assumptions that matter most',
          ], {
            description:
              'Financial modelling is on the should-improve list. One real model beats a finance course.',
          }),
          t('Analysis 1 — repackage an existing product\'s pricing', 5, 4, ['Business Thinking', 'Product Strategy'], [
            'Current state and its incentives',
            'Your proposed packaging',
            'Expected effect on expansion revenue',
            'Migration risk for existing customers',
          ]),
          t('Analysis 2 — usage-based pricing for an AI feature', 5, 4, ['Business Thinking', 'AI Product Knowledge'], [
            'Cost floor from the unit economics',
            'Metering unit the customer understands',
            'Margin at three volume tiers',
          ]),
          t('Analysis 3 — PLG entry point and upgrade path', 5, 4, ['Business Thinking'], [
            'Free tier boundary and why there',
            'The moment upgrade becomes obvious',
            'Guardrail against cannibalisation',
          ]),
        ],
      ),
      m(
        'Publish the product strategy memo',
        '"Should Company X enter Market Y?" — assumptions, risks, metrics.',
        'Portfolio project #6 and the direct answer to the audit\'s Product Strategy diagnosis: top companies expect "should this company even build this?"',
        'Did you reach a recommendation, or did you hedge?',
        [
          t('Choose the company and market', 3, 3, ['Product Strategy'], [
            'Pick a real company and a real adjacent market',
            'State the decision being made and by whom',
          ]),
          t('Do the market work', 10, 4, ['Product Strategy', 'Business Thinking'], [
            'Market sizing with stated assumptions',
            'Competitive landscape',
            'Where the company would win, specifically',
            'What would have to be true',
          ]),
          t('Write the memo with a real recommendation', 8, 5, ['Product Strategy', 'Communication'], [
            'Recommendation in the first paragraph',
            'Assumptions, numbered and falsifiable',
            'Risks with mitigations',
            'Success metrics and kill criteria',
            'The strongest counter-argument, addressed',
          ]),
        ],
        { achievement: 'ach_product-strategist' },
      ),
    ],
  },

  /* ===================================================== MONTH 10 ======= */
  {
    month: 10,
    title: 'Growth & Loops',
    focus: 'Growth',
    output: 'Build a growth loop case study',
    difficulty: 4,
    roi: 'high',
    outcomes: [
      'A growth-loop case study with modelled numbers',
      'The teardown series launched',
      'Mock interviews at 2 per week — the cadence that runs to month 24',
    ],
    commitments: {
      writing: 'One long-form article on the growth loop',
      networking: '20 connections/week; find 2 mock-interview partners',
      interviewPractice: '2 mock interviews per week starts now and does not stop',
      portfolio: 'Growth case study + first two teardowns',
      applications: 'Shortlist 50 target companies; do not apply yet',
    },
    missions: [
      m(
        'Build the growth loop case study',
        'Model a loop, find the leaks, propose the fix.',
        'Growth and PLG are both on the should-improve list, and growth loops were named as a Product Sense blind spot. One artefact addresses all three.',
        'Where does your loop actually leak, and how confident are you in that number?',
        [
          t('Pick a product and map its real loop', 5, 4, ['Business Thinking', 'Product Sense'], [
            'Identify the loop type',
            'Draw every step with its conversion rate',
            'Mark the assumptions you cannot verify',
          ]),
          t('Model the loop numerically', 8, 5, ['Analytics', 'Business Thinking'], [
            'Build the spreadsheet',
            'Compute the loop coefficient',
            'Find the step with the highest leverage',
            'Sensitivity analysis',
          ]),
          t('Propose and size three interventions', 6, 4, ['Product Sense', 'Experimentation'], [
            'Three interventions, each with an expected lift',
            'Experiment design for the best one',
            'What you would not do, and why',
          ]),
          t('Publish it', 4, 3, ['Communication'], [
            'Write it up with the model embedded',
            'Publish and promote',
          ]),
        ],
        { achievement: 'ach_growth-analyst' },
      ),
      m(
        'Launch the teardown series',
        'Public product teardowns, on a cadence.',
        'Portfolio project #4. The audit names Slack, Notion, Linear, Figma and Stripe Dashboard specifically. A series compounds in a way single artefacts do not.',
        'Which teardown revealed something you would not have guessed from using the product?',
        [
          t('Design the teardown format', 3, 2, ['Product Sense', 'Communication'], [
            'A repeatable structure',
            'A visual style you can produce quickly',
            'Length ceiling so you actually ship it',
          ]),
          t('Teardown 1 — Linear', 6, 4, ['Product Sense', 'UX', 'Systems Thinking'], [
            'Reconstruct the data model from the outside',
            'The opinionated constraints and what they buy',
            'What you would change',
          ]),
          t('Teardown 2 — Stripe Dashboard', 6, 4, ['Product Sense', 'Technical Depth'], [
            'Information architecture for a complex domain',
            'How they handle progressive disclosure',
            'The developer-product decisions visible in the UI',
          ]),
        ],
      ),
      m(
        'Start the mock interview engine',
        'Two per week, from now until you have an offer.',
        'The audit prescribes 2 mock interviews per week from month 10 through 24. That is roughly 120 mocks. Build the machine now.',
        'What feedback pattern is repeating across your mocks?',
        [
          t('Find three reliable mock partners', 4, 3, ['Leadership', 'Communication'], [
            'One strong on product sense',
            'One strong on metrics and analytics',
            'One strong on behavioural',
          ]),
          t('Build the feedback template', 2, 2, ['Communication'], [
            'Score per dimension out of 10',
            'One thing to keep, one to change',
            'Recorded so you can rewatch',
          ]),
          t('Complete 8 mock interviews', 12, 4, ['Communication', 'Product Sense'], [
            'Week 1: two mocks', 'Week 2: two mocks', 'Week 3: two mocks', 'Week 4: two mocks',
          ]),
        ],
      ),
    ],
  },

  /* ===================================================== MONTH 11 ======= */
  {
    month: 11,
    title: 'Interview Mastery',
    focus: 'Interview Prep',
    output: '25 mock interviews',
    difficulty: 5,
    roi: 'very-high',
    outcomes: [
      '25 mock interviews completed and reviewed',
      'A behavioural story library covering every common prompt',
      'Consistent performance rather than occasional brilliance',
    ],
    commitments: {
      writing: 'One long-form article: what 25 mock interviews taught you',
      networking: '20 connections/week; ask 5 people about their loops',
      interviewPractice: 'This month is the interview practice — 25 mocks',
      portfolio: 'Polish existing artefacts; no new ones',
      applications: 'Prepare the application machinery. Apply next month.',
    },
    missions: [
      m(
        'Build the behavioural story library',
        'A reusable set of STAR stories with numbers in them.',
        'The audit calls for a reusable library of behavioural stories, refined monthly. Doing it once, properly, removes an entire category of interview anxiety.',
        'Which story still lacks a number, and can you find one?',
        [
          t('Inventory your stories', 4, 3, ['Communication', 'Leadership'], [
            'List every significant thing you have owned',
            'Tag each with the competencies it could prove',
            'Find the gaps in coverage',
          ]),
          t('Write 12 STAR stories with quantified results', 10, 4, ['Communication', 'Business Thinking'], [
            'Conflict with a stakeholder',
            'A decision made with insufficient data',
            'A failure and what changed after',
            'Influencing without authority',
            'A prioritisation call you defended',
            'Leading through ambiguity',
            'A time you changed your mind',
            'Shipping under a hard constraint',
            'A technical tradeoff you drove',
            'Improving a process others adopted',
            'Handling underperformance or friction',
            'Your proudest measurable outcome',
          ], {
            description:
              'Every story needs a number in the Result. "It went well" is not a result.',
          }),
          t('Rehearse each to 90 seconds', 6, 3, ['Communication'], [
            'Record all twelve',
            'Cut every one to 90 seconds',
            'Re-record until it sounds unrehearsed',
          ]),
        ],
      ),
      m(
        'Complete 25 mock interviews',
        'Across every track, with scores recorded.',
        'The measurable output for month 11. Volume plus recorded feedback is what turns interview performance from variable to reliable.',
        'What is your lowest-scoring track, and what specifically is going wrong in it?',
        [
          t('Mocks 1–8: product sense and design', 12, 4, ['Product Sense', 'UX'], [
            'Four product-sense mocks',
            'Four product-design mocks',
            'Score every one',
          ]),
          t('Mocks 9–14: metrics and analytics', 9, 5, ['Metrics', 'Analytics'], [
            'Three metrics mocks',
            'Three analytics mocks including live SQL',
          ], {
            description:
              'Your weakest rounds. Over-index here — the marginal point is worth more than in product sense.',
          }),
          t('Mocks 15–19: strategy and estimation', 8, 4, ['Product Strategy', 'Business Thinking'], [
            'Three strategy mocks',
            'Two estimation mocks',
          ]),
          t('Mocks 20–25: behavioural and leadership', 9, 3, ['Leadership', 'Communication'], [
            'Three behavioural mocks',
            'Three leadership mocks',
          ]),
          t('Analyse the feedback for patterns', 4, 4, ['Analytics', 'Communication'], [
            'Tabulate scores by track',
            'Find the repeating criticism',
            'Write the fix and drill it',
          ]),
        ],
        { achievement: 'ach_mock-interview-expert' },
      ),
    ],
  },

  /* ===================================================== MONTH 12 ======= */
  {
    month: 12,
    title: 'First Applications',
    focus: 'Applications',
    output: 'Apply to 50 targeted companies',
    difficulty: 3,
    roi: 'high',
    outcomes: [
      '50 targeted, referral-backed applications',
      'A resume rebuilt around quantified impact',
      'First real interview loops',
    ],
    commitments: {
      writing: 'One long-form article — keep the cadence even now',
      networking: 'Ask for referrals; 20 connections/week continues',
      interviewPractice: '2 mocks per week continues',
      portfolio: 'Final polish before recruiters look at it',
      applications: '50 applications, prioritising referrals over volume',
    },
    missions: [
      m(
        'Rebuild the resume around impact',
        'Every bullet has a number or it does not ship.',
        'The audit\'s third-biggest mistake is confusing experience with evidence: employers hire demonstrated impact, not years. The resume is where that shows up first.',
        'Which bullet is still describing activity rather than outcome?',
        [
          t('Rewrite every bullet with a metric', 6, 4, ['Business Thinking', 'Communication'], [
            'ARR influenced',
            'Retention improved',
            'Activation increased',
            'Churn reduced',
            'Support tickets reduced',
            'Engineering time saved',
          ]),
          t('Tailor three variants', 4, 3, ['Communication'], [
            'Enterprise SaaS variant',
            'Platform / API variant',
            'AI product variant',
          ]),
          t('Get it reviewed by two people who hire PMs', 3, 2, ['Networking'], [
            'One recruiter',
            'One hiring manager',
            'Revise',
          ]),
        ],
      ),
      m(
        'Run 50 targeted applications',
        'Referral first, application second.',
        'The audit is blunt: applying to hundreds of jobs without referrals is on the ignore list. Fifty targeted, referred applications beat five hundred cold ones.',
        'What is your referral rate, and how do you double it next month?',
        [
          t('Build the target list with fit scores', 5, 3, ['Product Strategy'], [
            'Tier 1: Google, Microsoft, Atlassian, Shopify, Stripe, Canva, Miro',
            'Tier 2: GitLab, GitHub, MongoDB, Datadog, Okta, Elastic, Intercom, Zapier, monday.com, HubSpot, Cloudflare',
            'Tier 3: remote B2B SaaS Series B–D, ERP, logistics, field ops, CRM, HR tech, retail execution',
            'Score fit for each',
          ]),
          t('Secure referrals before applying', 10, 4, ['Leadership', 'Communication'], [
            'Map your network onto the target list',
            'Ask 20 people, specifically and politely',
            'Track who said yes',
          ]),
          t('Submit 50 tailored applications', 16, 3, ['Communication'], [
            'Batch 1: 15 Tier 2 and 3 with referrals',
            'Batch 2: 20 Tier 2 and 3',
            'Batch 3: 15 Tier 1',
            'Log every one with the date and channel',
          ], {
            description:
              'Tier 2 and 3 first, deliberately. Practise the loop where the stakes are lower before spending your Tier 1 referrals.',
          }),
          t('Set up the tracking discipline', 3, 2, ['Prioritization'], [
            'Stage per application',
            'Follow-up date for every open thread',
            'Notes after every conversation',
          ]),
        ],
        { achievement: 'ach_career-sprint-complete' },
      ),
    ],
  },
]

/* ---- Months 13–18: strengthen portfolio, interview, networking ---------- */
const MID_PHASE = [
  { month: 13, title: 'Deepen the Portfolio', artifact: 'Marketplace strategy document', skills: ['Product Strategy', 'Business Thinking'] },
  { month: 14, title: 'Analytics at Depth', artifact: 'Advanced analytics case study with causal reasoning', skills: ['Analytics', 'Experimentation'] },
  { month: 15, title: 'Open Source Contribution', artifact: 'Merged contribution to a reputable open-source project', skills: ['Technical Depth', 'Leadership'] },
  { month: 16, title: 'Discovery Practice', artifact: 'Published discovery synthesis from 10 customer interviews', skills: ['Product Discovery', 'Product Sense'] },
  { month: 17, title: 'Executive Communication', artifact: 'Executive-level strategy presentation, recorded', skills: ['Communication', 'Leadership'] },
  { month: 18, title: 'Second AI Project', artifact: 'AI product with a full evaluation harness', skills: ['AI Product Knowledge', 'Metrics'] },
]

/* ---- Months 19–24: intensive applications ------------------------------- */
const LATE_PHASE = [
  { month: 19, title: 'Application Engine', target: 25, theme: 'Systematise the pipeline and push volume with quality' },
  { month: 20, title: 'Referral Offensive', target: 25, theme: 'Convert the network into warm introductions' },
  { month: 21, title: 'Loop Performance', target: 25, theme: 'Turn first-round passes into onsite invitations' },
  { month: 22, title: 'Onsite Readiness', target: 25, theme: 'Full-loop simulations under real time pressure' },
  { month: 23, title: 'Negotiation & Closing', target: 20, theme: 'Multiple processes in parallel; learn to negotiate' },
  { month: 24, title: 'Offer & Decision', target: 15, theme: 'Close, compare, decide' },
]

function buildMidPhaseChapter(spec) {
  return {
    month: spec.month,
    title: spec.title,
    focus: 'Strengthen portfolio, interview, networking',
    output: `1 major artifact: ${spec.artifact}. 2 mocks/week.`,
    difficulty: 4,
    roi: 'high',
    outcomes: [spec.artifact, '8 mock interviews completed', 'One long-form article published'],
    commitments: {
      writing: 'One long-form article',
      networking: '20 connections/week; 5 conversations',
      interviewPractice: '2 mock interviews per week',
      portfolio: spec.artifact,
      applications: 'Continue targeted applications; respond to inbound',
    },
    missions: [
      m(
        `Ship: ${spec.artifact}`,
        'One major artefact this month. Depth over breadth.',
        'Months 13–18 in the audit are a single instruction: one major artifact per month, two mocks per week. The compounding comes from never missing a month.',
        'Is this artefact genuinely better than the last one, or just newer?',
        [
          t('Scope and research', 6, 3, spec.skills, ['Define the question', 'Gather evidence', 'Outline']),
          t('Build the artefact', 16, 4, spec.skills, [
            'Core body of work',
            'Metrics section',
            'Tradeoffs and rejected options',
            'Risks',
          ]),
          t('Publish and promote', 4, 2, ['Communication'], [
            'Publish',
            'LinkedIn post',
            'Share directly with five relevant people',
          ]),
        ],
      ),
      m(
        'Eight mock interviews',
        'Two per week, scored, with the feedback logged.',
        'The cadence is the point. Interview performance decays without practice, and consistency is what the audit measures.',
        'Which score moved this month, and which is stuck?',
        [
          t('Complete 8 mocks across weak tracks', 12, 4, ['Product Sense', 'Metrics', 'Analytics'], [
            'Week 1', 'Week 2', 'Week 3', 'Week 4',
          ]),
          t('Log scores and review the trend', 2, 2, ['Analytics'], ['Update scores', 'Compare to last month']),
        ],
      ),
      m(
        'Keep the brand and network compounding',
        'One article, twenty connections a week, five real conversations.',
        'The throughput commitments run for all 24 months. They only work as a habit.',
        'Did anything inbound arrive this month? What triggered it?',
        [
          t('Publish one long-form article', 6, 3, ['Communication'], ['Draft', 'Edit', 'Publish', 'Promote']),
          t('Add 80 relevant connections', 4, 2, ['Leadership'], ['Week 1: 20', 'Week 2: 20', 'Week 3: 20', 'Week 4: 20']),
          t('Have 20 real conversations', 6, 3, ['Leadership', 'Communication'], [
            'Five per week',
            'Log every one with a next action',
          ]),
        ],
      ),
    ],
  }
}

function buildLatePhaseChapter(spec) {
  return {
    month: spec.month,
    title: spec.title,
    focus: 'Intensive applications',
    output: `${spec.target} targeted applications, referrals, interview preparation`,
    difficulty: 4,
    roi: spec.month <= 21 ? 'very-high' : 'high',
    outcomes: [
      `${spec.target} targeted applications submitted`,
      'Referral rate above 40%',
      '8 mock interviews completed',
    ],
    commitments: {
      writing: 'One long-form article — keep discoverability alive',
      networking: 'Referral requests; 20 connections/week',
      interviewPractice: '2 mocks per week; full-loop simulations from month 22',
      portfolio: 'Maintain; add only what an interview reveals is missing',
      applications: `${spec.target} targeted applications`,
    },
    missions: [
      m(
        spec.theme,
        `${spec.target} applications this month, referral-first.`,
        'Months 19–24 are 100–150 targeted applications with referrals and final interview preparation. The audit is explicit that referral-backed applications beat high-volume submissions.',
        'What is converting, and what is silently failing?',
        [
          t(`Submit ${spec.target} targeted applications`, 12, 3, ['Communication'], [
            'Research and shortlist',
            'Secure referrals where possible',
            'Tailor each application',
            'Log and set follow-ups',
          ]),
          t('Work the referral network', 8, 4, ['Leadership', 'Communication'], [
            'Ten referral asks',
            'Follow up on every open thread',
            'Thank everyone who helped',
          ]),
          t('Run the pipeline review', 3, 3, ['Analytics', 'Prioritization'], [
            'Conversion by stage',
            'Where you are losing',
            'One change to test next month',
          ]),
        ],
      ),
      m(
        'Stay interview-sharp',
        'Two mocks per week, plus loop simulation.',
        'Applying before being interview-ready wastes referrals — the audit\'s third biggest mistake. Staying sharp protects the opportunities the applications create.',
        'Where did you lose points in a real interview this month?',
        [
          t('Complete 8 mock interviews', 12, 4, ['Product Sense', 'Metrics', 'Leadership'], [
            'Week 1', 'Week 2', 'Week 3', 'Week 4',
          ]),
          t('Debrief every real interview within 24 hours', 4, 3, ['Communication', 'Analytics'], [
            'Write down every question asked',
            'Score your own answers',
            'Identify the one thing to fix',
          ]),
        ],
      ),
    ],
  }
}

/* ------------------------------------------------------------- expansion -- */

/**
 * Progress applied to the seed. One month in, Month 1 is largely done — enough
 * that the tree, streak and charts have something real to show without
 * pretending to work that was not done.
 */
const SEED_PROGRESS = {
  // chapter month → { missionIndex: [taskIndex, ...done tasks] }
  1: { 0: [0, 1], 1: [0, 1, 2], 2: [0, 1] },
}

/** Tasks that are underway rather than finished, so the board is not binary. */
const SEED_IN_PROGRESS = {
  1: { 0: [2], 1: [3], 2: [2] },
}

function xpForTask(hours, difficulty) {
  // XP rewards effort and difficulty together, so a hard 2-hour task is worth
  // more than an easy one, but hours still dominate. Rounded to 5 to keep the
  // numbers legible in the UI.
  const raw = hours * 10 + difficulty * 12
  return Math.round(raw / 5) * 5
}

function expandChapter(spec) {
  const monthKey = String(spec.month).padStart(2, '0')
  const chapterId = `ch_m${monthKey}`
  const doneMap = SEED_PROGRESS[spec.month] ?? {}
  const wipMap = SEED_IN_PROGRESS[spec.month] ?? {}

  let taskCounter = 0
  const missions = spec.missions.map((mission, mi) => {
    const doneTasks = new Set(doneMap[mi] ?? [])
    const wipTasks = new Set(wipMap[mi] ?? [])
    const missionId = `ms_m${monthKey}_${mi + 1}`

    const tasks = mission.tasks.map((task, ti) => {
      taskCounter += 1
      const isDone = doneTasks.has(ti)
      const isWip = wipTasks.has(ti)
      const taskId = seqId(`tk_m${monthKey}_`, taskCounter)

      // A task in progress has roughly the first 60% of its subtasks done.
      const subtaskDoneCount = isDone
        ? task.subtasks.length
        : isWip
          ? Math.max(1, Math.floor(task.subtasks.length * 0.6))
          : 0

      return {
        id: taskId,
        title: task.title,
        description: task.description,
        status: isDone ? 'done' : isWip ? 'in-progress' : 'not-started',
        estimatedHours: task.hours,
        actualHours: isDone ? Math.round(task.hours * 1.05 * 10) / 10 : isWip ? Math.round(task.hours * 0.55 * 10) / 10 : 0,
        difficulty: task.difficulty,
        xp: xpForTask(task.hours, task.difficulty),
        subtasks: task.subtasks.map((st, si) => ({
          id: `${taskId}_s${si + 1}`,
          title: st,
          done: si < subtaskDoneCount,
        })),
        skillIds: task.skills.map((n) => S[n]).filter(Boolean),
        resources: task.resources,
        dependencies: task.deps,
        dueDate: monthEnd(spec.month),
        completedAt: isDone ? undefined : undefined,
        notes: '',
        order: ti,
      }
    })

    const allDone = tasks.length > 0 && tasks.every((x) => x.status === 'done')
    const anyStarted = tasks.some((x) => x.status !== 'not-started')

    return {
      id: missionId,
      title: mission.title,
      summary: mission.summary,
      rationale: mission.rationale,
      status: allDone ? 'done' : anyStarted ? 'in-progress' : 'not-started',
      tasks,
      xpBonus: 250,
      achievementId: mission.achievement,
      reflectionPrompt: mission.reflectionPrompt,
      reflection: '',
      order: mi,
    }
  })

  const estimatedHours = missions.reduce(
    (sum, mission) => sum + mission.tasks.reduce((s, x) => s + x.estimatedHours, 0),
    0,
  )

  const allSkillIds = [
    ...new Set(missions.flatMap((mission) => mission.tasks.flatMap((x) => x.skillIds))),
  ]

  return {
    id: chapterId,
    month: spec.month,
    title: spec.title,
    focus: spec.focus,
    measurableOutput: spec.output,
    quarter: Math.ceil(spec.month / 3),
    missions,
    estimatedHours,
    difficulty: spec.difficulty,
    dependencies: spec.month > 1 ? [`ch_m${String(spec.month - 1).padStart(2, '0')}`] : [],
    skillIds: allSkillIds,
    bookIds: [],
    courseIds: [],
    projectIds: [],
    targetOutcomes: spec.outcomes,
    expectedRoi: spec.roi,
    commitments: spec.commitments,
    startDate: monthStart(spec.month),
    endDate: monthEnd(spec.month),
  }
}

export function buildRoadmap() {
  const chapters = [
    ...CHAPTERS.map(expandChapter),
    ...MID_PHASE.map((s) => expandChapter(buildMidPhaseChapter(s))),
    ...LATE_PHASE.map((s) => expandChapter(buildLatePhaseChapter(s))),
  ]

  return {
    chapters,
    throughput: [
      { id: 'th_books', label: 'Read 2–3 books per quarter', detail: 'Non-negotiable input. Notes as decision rules, not summaries.', cadence: 'quarterly' },
      { id: 'th_article', label: 'Publish 1 long-form article per month', detail: 'Discoverability compounds. Twenty-four articles is a body of work.', cadence: 'monthly' },
      { id: 'th_artifact', label: 'Build 1 portfolio artifact per month', detail: 'The audit\'s success metric is 6–8 high-quality public artefacts.', cadence: 'monthly' },
      { id: 'th_mocks', label: 'Conduct 2 mock interviews per week (months 10–24)', detail: 'Roughly 120 mocks. Performance becomes reliable rather than variable.', cadence: 'weekly' },
      { id: 'th_network', label: 'Grow LinkedIn network by ~20 relevant connections per week', detail: 'Around 2,000 relevant connections over the programme.', cadence: 'weekly' },
    ],
    phases: [
      { id: 'ph_foundations', label: 'Foundations', months: [1, 3], theme: 'Close the analytics gap: SQL, product analytics, experimentation', colorToken: 'viz-2' },
      { id: 'ph_craft', label: 'Craft & AI', months: [4, 6], theme: 'Product sense, AI capability, first published portfolio', colorToken: 'viz-6' },
      { id: 'ph_visibility', label: 'Visibility & Depth', months: [7, 9], theme: 'Public brand, technical depth, commercial fluency', colorToken: 'viz-1' },
      { id: 'ph_readiness', label: 'Interview Readiness', months: [10, 12], theme: 'Growth, interview mastery, first targeted applications', colorToken: 'viz-4' },
      { id: 'ph_compound', label: 'Compounding', months: [13, 18], theme: 'One major artefact a month, two mocks a week', colorToken: 'viz-3' },
      { id: 'ph_offer', label: 'Offer Push', months: [19, 24], theme: 'Intensive referral-backed applications and loop performance', colorToken: 'viz-5' },
    ],
  }
}

/** Referenced by the achievements author so mission → achievement links resolve. */
export const MISSION_ACHIEVEMENT_IDS = [
  'ach_sql-intermediate',
  'ach_metrics-architect',
  'ach_analytics-explorer',
  'ach_experiment-designer',
  'ach_product-sense-20',
  'ach_ai-builder',
  'ach_first-case-study',
  'ach_top-writer',
  'ach_systems-thinker',
  'ach_product-strategist',
  'ach_growth-analyst',
  'ach_mock-interview-expert',
  'ach_career-sprint-complete',
]

export { slug }
