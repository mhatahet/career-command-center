/* ============================================================================
   Interview Preparation
   ----------------------------------------------------------------------------
   Nine tracks, one question bank, one mock log. The audit prescribes two mocks
   per week from month 10 through 24 — roughly 120 — and warns that applying
   before you are interview-ready wastes referrals. This page is what makes the
   difference between "I have practised" and "my scores are trending up".
   ========================================================================= */

import { useMemo, useState } from 'react'

import { BarChart, LineChart, seriesColor } from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  DeleteButton,
  Drawer,
  EmptyState,
  HelpDot,
  Icon,
  IconButton,
  InlineEdit,
  Input,
  ProgressBar,
  Ring,
  Segmented,
  Select,
  Stat,
  Tabs,
  Tooltip,
} from '../components/ui'
import { formatDate, formatRelative } from '../lib/dates'
import { useRoute, useScrollToAnchor } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { Confidence, Difficulty, ID, InterviewQuestion, InterviewTrack, MockInterview } from '../lib/types'

/** The nine tracks named in Part 7 of the audit, with why each one matters here. */
const TRACKS: { value: InterviewTrack; label: string; note: string }[] = [
  { value: 'product-sense', label: 'Product Sense', note: 'The most-weighted round. Where interviewers decide if you own outcomes or ship features.' },
  { value: 'execution', label: 'Execution', note: 'Your strongest area at 9.2. Should be a straightforward pass — lead with a real example.' },
  { value: 'strategy', label: 'Strategy', note: 'Tests altitude: "should this company build this?" rather than "how should this evolve?"' },
  { value: 'metrics', label: 'Metrics', note: 'One of your two weakest rounds at 6.8. Run the full metric-tree chain every time.' },
  { value: 'analytics', label: 'Analytics', note: 'Your weakest at 6.5. Expect live SQL. Speed is the gap, not comprehension.' },
  { value: 'estimation', label: 'Estimation', note: 'The cheapest round to make reliable. Two independent paths, then reconcile out loud.' },
  { value: 'leadership', label: 'Leadership', note: 'Strong at 8.4. The missing signal is having led other PMs.' },
  { value: 'behavioral', label: 'Behavioral', note: 'STAR. Every Result needs a number in it — "it went well" is not a result.' },
  { value: 'system-design', label: 'System Design', note: 'Where Systems Thinking 9.5 should be visible. Stripe and GitLab interview on this directly.' },
]

const TRACK_LABEL = Object.fromEntries(TRACKS.map((t) => [t.value, t.label])) as Record<InterviewTrack, string>

const CONFIDENCE_LABEL = ['', 'No idea', 'Shaky', 'Passable', 'Solid', 'Bulletproof']

type Tab = InterviewTrack | 'all' | 'mocks'

export function InterviewPrep() {
  const { data, derived, update } = useStore()
  const route = useRoute()

  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unpractised' | 'weak' | 'starred'>('all')
  const [openId, setOpenId] = useState<ID | null>(route.anchor ?? null)
  const [openMockId, setOpenMockId] = useState<ID | null>(null)

  useScrollToAnchor(route.anchor)

  const { questions, mocks } = data.interviews

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return questions
      .filter((question) => {
        if (tab !== 'all' && tab !== 'mocks' && question.track !== tab) return false
        if (filter === 'unpractised' && question.practiceCount > 0) return false
        if (filter === 'weak' && question.confidence > 2) return false
        if (filter === 'starred' && !question.starred) return false
        if (!q) return true
        return `${question.prompt} ${question.company ?? ''} ${question.framework ?? ''} ${question.notes}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => {
        // Weakest and least-practised first — that is where the marginal point is.
        return a.confidence - b.confidence || a.practiceCount - b.practiceCount || b.difficulty - a.difficulty
      })
  }, [filter, query, questions, tab])

  const open = openId ? questions.find((q) => q.id === openId) : undefined
  const openMock = openMockId ? mocks.find((m) => m.id === openMockId) : undefined

  const updateQuestion = (questionId: ID, producer: (question: InterviewQuestion) => InterviewQuestion, label: string) => {
    update(
      (draft) => ({
        ...draft,
        interviews: {
          ...draft.interviews,
          questions: draft.interviews.questions.map((q) => (q.id === questionId ? producer(q) : q)),
        },
      }),
      ['interviews'],
      label,
    )
  }

  /** Logging an attempt records the score and bumps the practice count. */
  const logAttempt = (question: InterviewQuestion, score: number) => {
    updateQuestion(
      question.id,
      (q) => ({
        ...q,
        practiceCount: q.practiceCount + 1,
        lastAttempt: derived.today,
        score,
        scoreHistory: [...q.scoreHistory.filter((h) => h.date !== derived.today), { date: derived.today, score }].sort(
          (a, b) => (a.date < b.date ? -1 : 1),
        ),
        // Confidence tracks the score: 8+ is solid, 6+ is passable.
        confidence: (score >= 9 ? 5 : score >= 8 ? 4 : score >= 6 ? 3 : score >= 4 ? 2 : 1) as Confidence,
      }),
      'log attempt',
    )
  }

  const addQuestion = () => {
    const question: InterviewQuestion = {
      id: newId('q'),
      prompt: 'New question',
      track: tab !== 'all' && tab !== 'mocks' ? tab : 'product-sense',
      difficulty: 3,
      practiceCount: 0,
      confidence: 1,
      scoreHistory: [],
      notes: '',
      feedback: '',
      idealAnswer: '',
      skillIds: [],
      starred: false,
    }
    update(
      (draft) => ({
        ...draft,
        interviews: { ...draft.interviews, questions: [question, ...draft.interviews.questions] },
      }),
      ['interviews'],
      'add question',
    )
    setOpenId(question.id)
  }

  const addMock = () => {
    const mock: MockInterview = {
      id: newId('mock'),
      date: derived.today,
      track: 'product-sense',
      partner: '',
      durationMinutes: 45,
      score: 6,
      strengths: '',
      improvements: '',
      questionIds: [],
      notes: '',
    }
    update(
      (draft) => ({ ...draft, interviews: { ...draft.interviews, mocks: [mock, ...draft.interviews.mocks] } }),
      ['interviews'],
      'log mock interview',
    )
    setOpenMockId(mock.id)
    setTab('mocks')
  }

  const updateMock = (mockId: ID, producer: (mock: MockInterview) => MockInterview, label: string) => {
    update(
      (draft) => ({
        ...draft,
        interviews: { ...draft.interviews, mocks: draft.interviews.mocks.map((m) => (m.id === mockId ? producer(m) : m)) },
      }),
      ['interviews'],
      label,
    )
  }

  /* --------------------------------------------------------------- stats -- */

  const stats = useMemo(() => {
    const practised = questions.filter((q) => q.practiceCount > 0)
    const scored = questions.filter((q) => typeof q.score === 'number')
    const mockScored = mocks.filter((m) => m.score > 0)
    // Cadence is 2/week from month 10; expected total to date.
    const expectedMocks = Math.max(0, (derived.timeline.currentMonth - 9) * 8)
    return {
      total: questions.length,
      practised: practised.length,
      attempts: questions.reduce((sum, q) => sum + q.practiceCount, 0),
      avgScore: scored.length > 0 ? scored.reduce((sum, q) => sum + (q.score ?? 0), 0) / scored.length : 0,
      weak: questions.filter((q) => q.confidence <= 2).length,
      mocks: mocks.length,
      expectedMocks,
      avgMockScore: mockScored.length > 0 ? mockScored.reduce((sum, m) => sum + m.score, 0) / mockScored.length : 0,
      mockMinutes: mocks.reduce((sum, m) => sum + m.durationMinutes, 0),
    }
  }, [derived.timeline.currentMonth, mocks, questions])

  /** Per-track readiness: average confidence, coverage and score. */
  const byTrack = useMemo(
    () =>
      TRACKS.map((track) => {
        const inTrack = questions.filter((q) => q.track === track.value)
        const practised = inTrack.filter((q) => q.practiceCount > 0)
        const scored = inTrack.filter((q) => typeof q.score === 'number')
        const trackMocks = mocks.filter((m) => m.track === track.value)
        return {
          ...track,
          total: inTrack.length,
          practised: practised.length,
          coverage: inTrack.length > 0 ? (practised.length / inTrack.length) * 100 : 0,
          avgConfidence:
            inTrack.length > 0 ? inTrack.reduce((sum, q) => sum + q.confidence, 0) / inTrack.length : 0,
          avgScore: scored.length > 0 ? scored.reduce((sum, q) => sum + (q.score ?? 0), 0) / scored.length : 0,
          mocks: trackMocks.length,
        }
      }),
    [mocks, questions],
  )

  /** Mock score trend, chronological. */
  const mockTrend = useMemo(
    () =>
      [...mocks]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => ({ x: m.date, y: m.score })),
    [mocks],
  )

  const skillNames = useMemo(() => new Map(data.skills.map((s) => [s.id, s.name])), [data.skills])

  return (
    <div className="page">
      <PageHeader
        title="Interview Preparation"
        lede="Nine tracks, one bank, one mock log. The audit prescribes two mocks per week from month 10 to 24 — roughly 120 — and lists applying before you are interview-ready as one of the three biggest mistakes PMs make. Referrals are finite; being sharp protects them."
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search questions…" size="sm" />
            <Button variant="secondary" size="sm" icon={<Icon name="plus" size={13} />} onClick={addMock}>
              Log mock
            </Button>
            <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={addQuestion}>
              Add question
            </Button>
          </>
        }
      />

      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Mock interviews"
              value={stats.mocks}
              size="lg"
              tone={stats.mocks >= stats.expectedMocks ? 'success' : 'warning'}
              meta={
                derived.timeline.currentMonth >= 10
                  ? `${stats.expectedMocks} expected by now`
                  : 'Cadence starts month 10'
              }
              help="Two per week from month 10 through 24. Starting earlier is free and calibrates your scores before it matters."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Average mock score"
              value={stats.avgMockScore > 0 ? stats.avgMockScore.toFixed(1) : '—'}
              unit={stats.avgMockScore > 0 ? '/10' : undefined}
              size="lg"
              tone={stats.avgMockScore >= 8 ? 'success' : stats.avgMockScore >= 6 ? undefined : 'warning'}
              help="A consistent 8 across tracks is interview-ready. The audit's quarterly checkpoint is a measurable improvement in this number."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Bank coverage"
              value={`${stats.practised} / ${stats.total}`}
              size="lg"
              meta={`${stats.attempts} total attempts`}
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar value={(stats.practised / Math.max(1, stats.total)) * 100} size="xs" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Low-confidence questions"
              value={stats.weak}
              size="lg"
              tone={stats.weak > stats.total / 2 ? 'warning' : undefined}
              help="Confidence 1–2. These are the questions that will surface in a real loop precisely because you have avoided them."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Practice time"
              value={Math.round(stats.mockMinutes / 60)}
              unit="h"
              size="lg"
              meta={`${stats.mockMinutes} minutes of mocks`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Interview pillar"
              value={derived.readiness.pillars.find((p) => p.key === 'interview')?.score.toFixed(0) ?? '—'}
              unit="/100"
              size="lg"
              tone="accent"
              help="12% of the readiness score: mock volume, average score and coverage across the nine tracks."
            />
          </CardBody>
        </Card>
      </div>

      {/* Track readiness */}
      <Card>
        <CardHeader
          title="Readiness by track"
          subtitle="Where the marginal point of preparation is worth most"
          help="Over-index on Metrics and Analytics. Those are your two weakest competencies, and a point gained in a weak round is worth more than a point in a strong one."
        />
        <CardBody className="card__body--none">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Track</th>
                  <th>Why it matters</th>
                  <th className="num">Questions</th>
                  <th style={{ width: 110 }}>Coverage</th>
                  <th className="num">Avg confidence</th>
                  <th className="num">Avg score</th>
                  <th className="num">Mocks</th>
                </tr>
              </thead>
              <tbody>
                {byTrack.map((track) => (
                  <tr key={track.value} style={{ cursor: 'pointer' }} onClick={() => setTab(track.value)}>
                    <td className="strong">{track.label}</td>
                    <td style={{ maxWidth: 380 }} className="text-xs">
                      {track.note}
                    </td>
                    <td className="num">{track.total}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <ProgressBar
                          value={track.coverage}
                          size="sm"
                          tone={track.coverage >= 80 ? 'success' : track.coverage > 0 ? undefined : 'danger'}
                        />
                        <span className="text-2xs tnum text-quaternary shrink-0">{Math.round(track.coverage)}%</span>
                      </div>
                    </td>
                    <td className="num">
                      <Badge
                        tone={track.avgConfidence >= 4 ? 'success' : track.avgConfidence >= 2.5 ? 'warning' : 'danger'}
                      >
                        {track.avgConfidence.toFixed(1)}
                      </Badge>
                    </td>
                    <td className="num">{track.avgScore > 0 ? track.avgScore.toFixed(1) : '—'}</td>
                    <td className="num">{track.mocks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All questions', count: questions.length },
          ...TRACKS.map((t) => ({
            value: t.value,
            label: t.label,
            count: questions.filter((q) => q.track === t.value).length,
          })),
          { value: 'mocks', label: 'Mock log', count: mocks.length },
        ]}
      />

      {/* ------------------------------------------------------- mock log -- */}
      {tab === 'mocks' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          {mockTrend.length > 1 ? (
            <Card>
              <CardHeader
                title="Mock score trend"
                subtitle={`${mockTrend[0].y} → ${mockTrend[mockTrend.length - 1].y} across ${mockTrend.length} mocks`}
                help="The dashed line is 8/10 — the level at which performance reads as reliable rather than occasional."
              />
              <CardBody>
                <LineChart
                  series={[{ label: 'Mock score', color: 'var(--accent)', points: mockTrend, fill: true }]}
                  height={200}
                  yMin={0}
                  yMax={10}
                  referenceY={8}
                  referenceLabel="Interview-ready"
                  formatX={(x) => formatDate(x)}
                  formatY={(y) => y.toFixed(0)}
                />
              </CardBody>
            </Card>
          ) : null}

          {mocks.length === 0 ? (
            <Card>
              <EmptyState
                icon="🎤"
                title="No mocks logged"
                body="Two per week from month 10. Book the first one now — the audit is explicit that applying before you are ready wastes referrals."
                action={
                  <Button variant="primary" size="sm" onClick={addMock}>
                    Log a mock
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card>
              <CardBody className="card__body--none">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Track</th>
                        <th>Partner</th>
                        <th className="num">Score</th>
                        <th className="num">Minutes</th>
                        <th>What to fix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...mocks]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((mock) => (
                          <tr key={mock.id} style={{ cursor: 'pointer' }} onClick={() => setOpenMockId(mock.id)}>
                            <td className="num">{formatDate(mock.date)}</td>
                            <td className="strong">{TRACK_LABEL[mock.track]}</td>
                            <td>{mock.partner || '—'}</td>
                            <td className="num">
                              <Badge tone={mock.score >= 8 ? 'success' : mock.score >= 6 ? 'warning' : 'danger'}>
                                {mock.score}
                              </Badge>
                            </td>
                            <td className="num">{mock.durationMinutes}</td>
                            <td style={{ maxWidth: 420 }} className="text-xs">
                              {mock.improvements || '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
              <CardFooter>
                <span>{mocks.length} mocks logged</span>
                <span className="tnum">{Math.round(stats.mockMinutes / 60)}h of practice</span>
              </CardFooter>
            </Card>
          )}

          {mocks.length > 0 ? (
            <Card>
              <CardHeader
                title="Mocks by track"
                help="An unbalanced distribution is the most common preparation mistake — people practise what they are already good at."
              />
              <CardBody>
                <BarChart
                  data={TRACKS.map((t, i) => ({
                    label: t.label,
                    value: mocks.filter((m) => m.track === t.value).length,
                    color: seriesColor(i),
                  }))}
                  horizontal
                  formatValue={(v) => `${v} mock${v === 1 ? '' : 's'}`}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : (
        /* ----------------------------------------------------- questions -- */
        <>
          <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: filtered.length },
                { value: 'unpractised', label: 'Never practised' },
                { value: 'weak', label: 'Low confidence' },
                { value: 'starred', label: 'Starred' },
              ]}
            />
            {tab !== 'all' ? (
              <span className="text-xs text-tertiary" style={{ maxWidth: '60ch' }}>
                {TRACKS.find((t) => t.value === tab)?.note}
              </span>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState icon="🎤" title="No questions match" body="Adjust the filters or add one." />
            </Card>
          ) : (
            <div className="col" style={{ gap: 'var(--space-2)' }}>
              {filtered.map((question) => (
                <Card key={question.id} id={question.id} onClick={() => setOpenId(question.id)}>
                  <CardBody className="card__body--tight">
                    <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                      <Ring
                        value={(question.confidence / 5) * 100}
                        size={40}
                        thickness={4}
                        display={question.confidence}
                        valueSize={12}
                        tone={question.confidence >= 4 ? 'success' : question.confidence >= 3 ? undefined : 'warning'}
                      />

                      <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
                        <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
                          <Badge tone="neutral">{TRACK_LABEL[question.track]}</Badge>
                          {question.company ? <Badge tone="accent">{question.company}</Badge> : null}
                          {question.starred ? <Badge tone="warning">★</Badge> : null}
                          <Tooltip content={`Difficulty ${question.difficulty} of 5`}>
                            <span className="text-2xs text-quaternary">
                              {'●'.repeat(question.difficulty)}
                              <span style={{ opacity: 0.3 }}>{'●'.repeat(5 - question.difficulty)}</span>
                            </span>
                          </Tooltip>
                          {question.framework ? (
                            <span className="text-2xs text-quaternary">{question.framework}</span>
                          ) : null}
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {question.prompt}
                        </span>
                        <span className="text-2xs text-quaternary">
                          Practised {question.practiceCount}×
                          {question.lastAttempt ? ` · last ${formatRelative(question.lastAttempt, derived.today)}` : ' · never'}
                          {question.score !== undefined ? ` · scored ${question.score}/10` : ''}
                        </span>
                      </div>

                      <div className="row shrink-0" style={{ gap: 4 }}>
                        <Tooltip content="Log a quick attempt without opening the detail">
                          <div className="row" style={{ gap: 2 }}>
                            {[5, 7, 9].map((score) => (
                              <Button
                                key={score}
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  logAttempt(question, score)
                                }}
                              >
                                {score}
                              </Button>
                            ))}
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* -------------------------------------------------- question drawer */}
      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={720}
          title={
            <InlineEdit
              value={open.prompt}
              multiline
              onCommit={(next) => updateQuestion(open.id, (q) => ({ ...q, prompt: next }), 'edit question')}
              ariaLabel="Question prompt"
            />
          }
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              <Badge tone="neutral">{TRACK_LABEL[open.track]}</Badge>
              {open.company ? <Badge tone="accent">{open.company}</Badge> : null}
              <span>
                practised {open.practiceCount}× · confidence {open.confidence}/5 ({CONFIDENCE_LABEL[open.confidence]})
              </span>
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  update(
                    (draft) => ({
                      ...draft,
                      interviews: {
                        ...draft.interviews,
                        questions: draft.interviews.questions.filter((q) => q.id !== open.id),
                      },
                    }),
                    ['interviews'],
                    'delete question',
                  )
                  setOpenId(null)
                }}
                label="Delete question"
                size="md"
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                <IconButton
                  title={open.starred ? 'Unstar' : 'Star for focused practice'}
                  active={open.starred}
                  onClick={() => updateQuestion(open.id, (q) => ({ ...q, starred: !q.starred }), 'toggle star')}
                >
                  <Icon name="star" size={14} />
                </IconButton>
                <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>
            </>
          }
        >
          {/* Log an attempt */}
          <Card variant="inset">
            <CardBody className="card__body--tight">
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                <span className="section-title">
                  Log an attempt
                  <HelpDot>
                    Score your own answer out of 10 immediately after answering out loud. Confidence follows
                    the score automatically, so the ranking on the list page stays honest.
                  </HelpDot>
                </span>
                <div className="row row--wrap" style={{ gap: 4 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <Button
                      key={score}
                      variant={open.score === score ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => logAttempt(open, score)}
                    >
                      {score}
                    </Button>
                  ))}
                </div>
                {open.scoreHistory.length > 1 ? (
                  <LineChart
                    series={[
                      {
                        label: 'Score',
                        color: 'var(--accent)',
                        points: open.scoreHistory.map((h) => ({ x: h.date, y: h.score })),
                        fill: true,
                      },
                    ]}
                    height={110}
                    yMin={0}
                    yMax={10}
                    referenceY={8}
                    formatX={(x) => formatDate(x)}
                    formatY={(y) => y.toFixed(0)}
                  />
                ) : null}
              </div>
            </CardBody>
          </Card>

          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Track</span>
              <Select
                value={open.track}
                size="sm"
                options={TRACKS.map((t) => ({ value: t.value, label: t.label }))}
                onChange={(next) => updateQuestion(open.id, (q) => ({ ...q, track: next }), 'change track')}
              />
            </div>
            <div className="field">
              <span className="field__label">Difficulty</span>
              <Select
                value={String(open.difficulty)}
                size="sm"
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
                onChange={(next) =>
                  updateQuestion(open.id, (q) => ({ ...q, difficulty: Number(next) as Difficulty }), 'change difficulty')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Confidence</span>
              <Select
                value={String(open.confidence)}
                size="sm"
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${CONFIDENCE_LABEL[n]}` }))}
                onChange={(next) =>
                  updateQuestion(open.id, (q) => ({ ...q, confidence: Number(next) as Confidence }), 'change confidence')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Company</span>
              <Input
                value={open.company ?? ''}
                size="sm"
                placeholder="Asked at…"
                onChange={(next) => updateQuestion(open.id, (q) => ({ ...q, company: next || undefined }), 'edit company')}
              />
            </div>
            <div className="field">
              <span className="field__label">Framework</span>
              <Input
                value={open.framework ?? ''}
                size="sm"
                placeholder="CIRCLES, STAR, metric tree…"
                onChange={(next) =>
                  updateQuestion(open.id, (q) => ({ ...q, framework: next || undefined }), 'edit framework')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Video practice URL</span>
              <Input
                value={open.videoPracticeUrl ?? ''}
                size="sm"
                placeholder="Recording of your answer"
                onChange={(next) =>
                  updateQuestion(open.id, (q) => ({ ...q, videoPracticeUrl: next || undefined }), 'edit video url')
                }
              />
            </div>
          </div>

          <hr className="divider" />

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">
              Ideal answer
              <HelpDot>
                The shape of a strong answer, not the words. Rehearsing words produces a recital;
                rehearsing structure produces an answer that survives a follow-up question.
              </HelpDot>
            </span>
            <InlineEdit
              value={open.idealAnswer}
              multiline
              placeholder="The structure of a strong answer…"
              onCommit={(next) => updateQuestion(open.id, (q) => ({ ...q, idealAnswer: next }), 'edit ideal answer')}
              ariaLabel="Ideal answer"
            />
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">Your notes</span>
            <InlineEdit
              value={open.notes}
              multiline
              placeholder="What you tried, what worked, what you keep forgetting…"
              onCommit={(next) => updateQuestion(open.id, (q) => ({ ...q, notes: next }), 'edit notes')}
              ariaLabel="Notes"
            />
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">
              Feedback received
              <HelpDot>Feedback from a partner is worth more than your own score. Repetition across mocks is the signal.</HelpDot>
            </span>
            <InlineEdit
              value={open.feedback}
              multiline
              placeholder="What your mock partner actually said…"
              onCommit={(next) => updateQuestion(open.id, (q) => ({ ...q, feedback: next }), 'edit feedback')}
              ariaLabel="Feedback"
            />
          </div>

          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">Competencies tested</span>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {data.skills.map((skill) => {
                const selected = open.skillIds.includes(skill.id)
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() =>
                      updateQuestion(
                        open.id,
                        (q) => ({
                          ...q,
                          skillIds: selected ? q.skillIds.filter((id) => id !== skill.id) : [...q.skillIds, skill.id],
                        }),
                        'tag competency',
                      )
                    }
                    style={{ display: 'inline-flex' }}
                  >
                    <Badge tone={selected ? 'accent' : 'neutral'}>{skill.name}</Badge>
                  </button>
                )
              })}
            </div>
            {open.skillIds.length > 0 ? (
              <span className="text-2xs text-quaternary">
                {open.skillIds.map((id) => skillNames.get(id)).join(' · ')}
              </span>
            ) : null}
          </div>
        </Drawer>
      ) : null}

      {/* ------------------------------------------------------ mock drawer */}
      {openMock ? (
        <Drawer
          open
          onClose={() => setOpenMockId(null)}
          width={640}
          title={`Mock — ${TRACK_LABEL[openMock.track]}`}
          subtitle={`${formatDate(openMock.date, { year: true })} · ${openMock.durationMinutes} minutes · scored ${openMock.score}/10`}
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  update(
                    (draft) => ({
                      ...draft,
                      interviews: {
                        ...draft.interviews,
                        mocks: draft.interviews.mocks.filter((m) => m.id !== openMock.id),
                      },
                    }),
                    ['interviews'],
                    'delete mock',
                  )
                  setOpenMockId(null)
                }}
                label="Delete mock"
                size="md"
              />
              <Button variant="secondary" size="sm" onClick={() => setOpenMockId(null)}>
                Close
              </Button>
            </>
          }
        >
          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Date</span>
              <input
                className="input input--sm"
                type="date"
                value={openMock.date}
                onChange={(e) => updateMock(openMock.id, (m) => ({ ...m, date: e.target.value }), 'edit mock date')}
              />
            </div>
            <div className="field">
              <span className="field__label">Track</span>
              <Select
                value={openMock.track}
                size="sm"
                options={TRACKS.map((t) => ({ value: t.value, label: t.label }))}
                onChange={(next) => updateMock(openMock.id, (m) => ({ ...m, track: next }), 'change mock track')}
              />
            </div>
            <div className="field">
              <span className="field__label">Partner</span>
              <Input
                value={openMock.partner}
                size="sm"
                placeholder="Who ran it"
                onChange={(next) => updateMock(openMock.id, (m) => ({ ...m, partner: next }), 'edit partner')}
              />
            </div>
            <div className="field">
              <span className="field__label">Duration (minutes)</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                step={5}
                value={openMock.durationMinutes}
                onChange={(e) =>
                  updateMock(openMock.id, (m) => ({ ...m, durationMinutes: Number(e.target.value) || 0 }), 'edit duration')
                }
              />
            </div>
          </div>

          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">
              Score
              <HelpDot>Use the same rubric every time, or the trend means nothing. 8 is the interview-ready bar.</HelpDot>
            </span>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <Button
                  key={score}
                  variant={openMock.score === score ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updateMock(openMock.id, (m) => ({ ...m, score }), 'score mock')}
                >
                  {score}
                </Button>
              ))}
            </div>
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title" style={{ color: 'var(--success-text)' }}>
              What went well — keep doing this
            </span>
            <InlineEdit
              value={openMock.strengths}
              multiline
              placeholder="One thing to keep."
              onCommit={(next) => updateMock(openMock.id, (m) => ({ ...m, strengths: next }), 'edit strengths')}
              ariaLabel="Strengths"
            />
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title" style={{ color: 'var(--warning-text)' }}>
              What to change — one thing
            </span>
            <InlineEdit
              value={openMock.improvements}
              multiline
              placeholder="One specific change for next time. A list of five is a list of none."
              onCommit={(next) => updateMock(openMock.id, (m) => ({ ...m, improvements: next }), 'edit improvements')}
              ariaLabel="Improvements"
            />
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">Notes</span>
            <InlineEdit
              value={openMock.notes}
              multiline
              placeholder="Questions asked, anything worth remembering…"
              onCommit={(next) => updateMock(openMock.id, (m) => ({ ...m, notes: next }), 'edit mock notes')}
              ariaLabel="Mock notes"
            />
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
