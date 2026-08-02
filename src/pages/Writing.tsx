/* ============================================================================
   Writing
   ----------------------------------------------------------------------------
   One long-form article per month for 24 months. It is a throughput commitment,
   and the single fix for the audit's blunt diagnosis: "outside your network,
   almost nobody knows you." That is a distribution problem, not a talent one.
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
} from '../components/ui'
import { addMonths, formatDate, formatMonthShort, startOfMonth } from '../lib/dates'
import { useRoute, useScrollToAnchor } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { ID, WritingPiece } from '../lib/types'

const KIND_LABEL: Record<WritingPiece['kind'], string> = {
  article: 'Long-form article',
  'case-study': 'Case study',
  newsletter: 'Newsletter',
  teardown: 'Teardown',
  essay: 'Essay',
}

const KIND_ICON: Record<WritingPiece['kind'], string> = {
  article: '📰',
  'case-study': '📝',
  newsletter: '📧',
  teardown: '🔩',
  essay: '💭',
}

const STATUS_TONE = {
  idea: 'neutral',
  outlining: 'info',
  drafting: 'warning',
  editing: 'accent',
  published: 'success',
} as const

const STATUS_ORDER: WritingPiece['status'][] = ['idea', 'outlining', 'drafting', 'editing', 'published']

export function Writing() {
  const { data, derived, patch } = useStore()
  const route = useRoute()

  const [view, setView] = useState<'board' | 'calendar'>('board')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<ID | null>(route.anchor ?? null)

  useScrollToAnchor(route.anchor)

  const pieces = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.writing
    return data.writing.filter((piece) =>
      `${piece.title} ${piece.outline} ${piece.topics.join(' ')}`.toLowerCase().includes(q),
    )
  }, [data.writing, query])

  const open = openId ? data.writing.find((w) => w.id === openId) : undefined

  const updatePiece = (pieceId: ID, producer: (piece: WritingPiece) => WritingPiece, label: string) => {
    patch('writing', (list) => list.map((w) => (w.id === pieceId ? producer(w) : w)), label)
  }

  const addPiece = () => {
    const piece: WritingPiece = {
      id: newId('wr'),
      title: 'New piece',
      kind: 'article',
      status: 'idea',
      words: 0,
      targetWords: 2000,
      topics: [],
      skillIds: [],
      outline: '',
      draft: '',
      publication: 'Personal site + LinkedIn',
      scheduledFor: addMonths(derived.today, 1),
      xp: 300,
      order: data.writing.length,
    }
    patch('writing', (list) => [piece, ...list], 'add writing piece')
    setOpenId(piece.id)
  }

  /* --------------------------------------------------------------- stats -- */

  const stats = useMemo(() => {
    const published = data.writing.filter((w) => w.status === 'published')
    const words = data.writing.reduce((sum, w) => sum + w.words, 0)
    const publishedWords = published.reduce((sum, w) => sum + w.words, 0)
    // The commitment is one per month since the programme started.
    const expected = derived.timeline.currentMonth
    return {
      published: published.length,
      expected,
      behind: Math.max(0, expected - published.length),
      inFlight: data.writing.filter((w) => w.status === 'drafting' || w.status === 'editing').length,
      words,
      publishedWords,
      views: published.reduce((sum, w) => sum + (w.views ?? 0), 0),
      topics: new Set(data.writing.flatMap((w) => w.topics)).size,
    }
  }, [data.writing, derived.timeline.currentMonth])

  /** Published pieces per month, against the one-per-month commitment. */
  const cadence = useMemo(() => {
    const months: { label: string; value: number; color?: string }[] = []
    for (let i = 0; i < derived.timeline.totalMonths; i += 1) {
      const monthStart = startOfMonth(addMonths(data.profile.startDate, i))
      const monthEnd = startOfMonth(addMonths(data.profile.startDate, i + 1))
      const count = data.writing.filter(
        (w) => w.publishedAt && w.publishedAt >= monthStart && w.publishedAt < monthEnd,
      ).length
      const isPast = monthStart <= derived.today
      months.push({
        label: `M${i + 1}`,
        value: count,
        color: count >= 1 ? 'var(--success)' : isPast ? 'var(--danger)' : 'var(--track)',
      })
    }
    return months
  }, [data.writing, data.profile.startDate, derived.today, derived.timeline.totalMonths])

  /** Cumulative published, against the ideal one-per-month line. */
  const cumulative = useMemo(() => {
    let running = 0
    const actual: { x: string; y: number }[] = []
    const ideal: { x: string; y: number }[] = []
    for (let i = 0; i < derived.timeline.totalMonths; i += 1) {
      const label = `M${i + 1}`
      running += cadence[i]?.value ?? 0
      actual.push({ x: label, y: running })
      ideal.push({ x: label, y: i + 1 })
    }
    return { actual, ideal }
  }, [cadence, derived.timeline.totalMonths])

  const byTopic = useMemo(() => {
    const map = new Map<string, number>()
    for (const piece of data.writing) {
      for (const topic of piece.topics) map.set(topic, (map.get(topic) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([label, value], i) => ({ label, value, color: seriesColor(i) }))
      .sort((a, b) => b.value - a.value)
  }, [data.writing])

  return (
    <div className="page">
      <PageHeader
        title="Writing"
        lede="One long-form article every month for twenty-four months. Twenty-four articles is a body of work; three is a hobby. This is the direct fix for the audit's finding that outside your network, almost nobody knows you."
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search pieces…" size="sm" />
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'board', label: 'Board' },
                { value: 'calendar', label: 'Cadence' },
              ]}
            />
            <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={addPiece}>
              New piece
            </Button>
          </>
        }
      />

      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Published"
              value={`${stats.published} / ${stats.expected}`}
              size="lg"
              tone={stats.behind === 0 ? 'success' : stats.behind > 2 ? 'danger' : 'warning'}
              meta={stats.behind > 0 ? `${stats.behind} behind the cadence` : 'On cadence'}
              help="One article per month since the programme started. The denominator is the current programme month, so it moves whether you write or not."
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar
                value={(stats.published / Math.max(1, stats.expected)) * 100}
                size="xs"
                tone={stats.behind === 0 ? 'success' : 'warning'}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="In flight" value={stats.inFlight} size="lg" meta="Drafting or editing" />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Words written"
              value={stats.words.toLocaleString()}
              size="lg"
              meta={`${stats.publishedWords.toLocaleString()} published`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Topics covered"
              value={stats.topics}
              size="lg"
              help="Breadth matters less than consistency of theme. The audit's five content pillars are the ones to keep returning to."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="Total views" value={stats.views.toLocaleString()} size="lg" meta="Across published pieces" />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Pipeline"
              value={data.writing.length}
              size="lg"
              meta={`${data.writing.filter((w) => w.status === 'idea').length} ideas`}
              help="A full pipeline is what makes the monthly cadence survivable. Twelve ideas is a year of cover."
            />
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------------------ board */}
      {view === 'board' ? (
        <div className="grid grid--5" style={{ gap: 'var(--space-3)', alignItems: 'start' }}>
          {STATUS_ORDER.map((status) => {
            const column = pieces.filter((p) => p.status === status)
            return (
              <Card key={status}>
                <CardHeader
                  title={
                    <span className="row" style={{ gap: 6 }}>
                      <Badge tone={STATUS_TONE[status]} dot>
                        {status}
                      </Badge>
                      <span className="text-2xs text-quaternary tnum">{column.length}</span>
                    </span>
                  }
                />
                <CardBody className="card__body--tight">
                  <div className="col" style={{ gap: 'var(--space-2)' }}>
                    {column.length === 0 ? (
                      <span className="text-2xs text-quaternary" style={{ padding: 'var(--space-2)' }}>
                        Empty
                      </span>
                    ) : (
                      column.map((piece) => {
                        const overdue =
                          piece.scheduledFor && piece.scheduledFor < derived.today && piece.status !== 'published'
                        return (
                          <button
                            key={piece.id}
                            id={piece.id}
                            type="button"
                            onClick={() => setOpenId(piece.id)}
                            className="col"
                            style={{
                              gap: 5,
                              textAlign: 'left',
                              width: '100%',
                              padding: 'var(--space-3)',
                              background: 'var(--bg-inset)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            <div className="row" style={{ gap: 5, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 13, lineHeight: 1.2 }}>{KIND_ICON[piece.kind]}</span>
                              <span
                                className="text-xs clamp-3"
                                style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}
                              >
                                {piece.title}
                              </span>
                            </div>

                            {piece.targetWords > 0 && piece.status !== 'idea' ? (
                              <>
                                <ProgressBar
                                  value={(piece.words / piece.targetWords) * 100}
                                  size="xs"
                                  tone={piece.status === 'published' ? 'success' : undefined}
                                />
                                <span className="text-2xs tnum text-quaternary">
                                  {piece.words.toLocaleString()} / {piece.targetWords.toLocaleString()} words
                                </span>
                              </>
                            ) : null}

                            <div className="row row--wrap" style={{ gap: 3 }}>
                              {piece.topics.slice(0, 2).map((topic) => (
                                <span key={topic} className="text-2xs text-quaternary">
                                  #{topic}
                                </span>
                              ))}
                            </div>

                            {piece.scheduledFor ? (
                              <span
                                className="text-2xs"
                                style={{ color: overdue ? 'var(--danger-text)' : 'var(--text-quaternary)' }}
                              >
                                {piece.status === 'published'
                                  ? `published ${formatDate(piece.publishedAt)}`
                                  : `due ${formatDate(piece.scheduledFor)}`}
                              </span>
                            ) : null}
                          </button>
                        )
                      })
                    )}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : null}

      {/* --------------------------------------------------------- cadence */}
      {view === 'calendar' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <Card>
            <CardHeader
              title="Publishing cadence"
              subtitle="One article per month, for twenty-four months"
              help="Green means the month was hit. Red means a month passed with nothing published. Grey is still ahead of you. Every red bar is a month of compounding you do not get back."
            />
            <CardBody>
              <BarChart data={cadence} height={180} target={1} formatValue={(v) => String(Math.round(v))} />
            </CardBody>
            <CardFooter>
              <span>
                {cadence.filter((m) => m.value >= 1).length} of {derived.timeline.currentMonth} months hit
              </span>
              <span className="tnum">
                {cadence.filter((m) => m.color === 'var(--danger)').length} missed
              </span>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader
              title="Cumulative output"
              subtitle="Against the ideal one-per-month line"
              help="The gap between the two lines is the debt. It never shrinks on its own — catching up means publishing two in a month."
            />
            <CardBody>
              <LineChart
                series={[
                  { label: 'Published', color: 'var(--accent)', points: cumulative.actual, fill: true },
                  { label: 'Commitment', color: 'var(--text-quaternary)', points: cumulative.ideal, dashed: true },
                ]}
                height={220}
                yMin={0}
                formatY={(y) => String(Math.round(y))}
              />
            </CardBody>
          </Card>

          {byTopic.length > 0 ? (
            <Card>
              <CardHeader
                title="Topics covered"
                help="The audit's five About themes: systems over features, complex enterprise product design, product quality and maintainability, AI in enterprise software, lessons from real product work. Returning to the same themes is what builds recognition."
              />
              <CardBody>
                <BarChart data={byTopic} horizontal formatValue={(v) => `${v} piece${v === 1 ? '' : 's'}`} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Schedule" subtitle="Everything with a date, in order" />
            <CardBody className="card__body--none">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Due</th>
                      <th>Piece</th>
                      <th>Kind</th>
                      <th className="num">Words</th>
                      <th style={{ width: 110 }}>Progress</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.writing]
                      .filter((w) => w.scheduledFor)
                      .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
                      .map((piece) => {
                        const overdue =
                          piece.scheduledFor && piece.scheduledFor < derived.today && piece.status !== 'published'
                        return (
                          <tr key={piece.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(piece.id)}>
                            <td className="num" style={{ color: overdue ? 'var(--danger-text)' : undefined }}>
                              {formatMonthShort(piece.scheduledFor!)}
                            </td>
                            <td className="strong">
                              {KIND_ICON[piece.kind]} {piece.title}
                            </td>
                            <td>{KIND_LABEL[piece.kind]}</td>
                            <td className="num">{piece.targetWords.toLocaleString()}</td>
                            <td>
                              <ProgressBar
                                value={piece.targetWords > 0 ? (piece.words / piece.targetWords) * 100 : 0}
                                size="sm"
                                tone={piece.status === 'published' ? 'success' : undefined}
                              />
                            </td>
                            <td>
                              <Badge tone={STATUS_TONE[piece.status]} dot>
                                {piece.status}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {pieces.length === 0 ? (
        <Card>
          <EmptyState
            icon="✍️"
            title="Nothing in the pipeline"
            body="Twelve ideas is a year of cover. Start by turning your best case study into an article."
            action={
              <Button variant="primary" size="sm" onClick={addPiece}>
                New piece
              </Button>
            }
          />
        </Card>
      ) : null}

      {/* Detail drawer */}
      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={780}
          title={
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <span>{KIND_ICON[open.kind]}</span>
              <InlineEdit
                value={open.title}
                onCommit={(next) => updatePiece(open.id, (w) => ({ ...w, title: next }), 'rename piece')}
                ariaLabel="Title"
              />
            </span>
          }
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              <Badge tone={STATUS_TONE[open.status]}>{open.status}</Badge>
              <span>{KIND_LABEL[open.kind]}</span>
              {open.publishedAt ? <span>· published {formatDate(open.publishedAt)}</span> : null}
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  patch('writing', (list) => list.filter((w) => w.id !== open.id), 'delete piece')
                  setOpenId(null)
                }}
                label="Delete piece"
                size="md"
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {open.status !== 'published' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Icon name="check" size={13} />}
                    onClick={() =>
                      updatePiece(
                        open.id,
                        (w) => ({ ...w, status: 'published', publishedAt: derived.today }),
                        'publish piece',
                      )
                    }
                  >
                    Mark published
                  </Button>
                ) : (
                  <Badge tone="success" size="lg">
                    Published · +{open.xp} XP
                  </Badge>
                )}
                <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>
            </>
          }
        >
          {/* Word count */}
          <div className="row" style={{ gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Ring
              value={open.targetWords > 0 ? (open.words / open.targetWords) * 100 : 0}
              size={78}
              thickness={7}
              display={Math.round(open.targetWords > 0 ? (open.words / open.targetWords) * 100 : 0)}
              label="%"
              tone={open.words >= open.targetWords ? 'success' : undefined}
            />
            <div className="col grow" style={{ gap: 'var(--space-3)', minWidth: 200 }}>
              <div className="row row--wrap" style={{ gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                <div className="field" style={{ maxWidth: 120 }}>
                  <span className="field__label">Words</span>
                  <input
                    className="input input--sm input--num"
                    type="number"
                    min={0}
                    step={50}
                    value={open.words}
                    onChange={(e) =>
                      updatePiece(open.id, (w) => ({ ...w, words: Math.max(0, Number(e.target.value) || 0) }), 'edit words')
                    }
                  />
                </div>
                <div className="field" style={{ maxWidth: 120 }}>
                  <span className="field__label">Target</span>
                  <input
                    className="input input--sm input--num"
                    type="number"
                    min={0}
                    step={100}
                    value={open.targetWords}
                    onChange={(e) =>
                      updatePiece(
                        open.id,
                        (w) => ({ ...w, targetWords: Math.max(0, Number(e.target.value) || 0) }),
                        'edit target words',
                      )
                    }
                  />
                </div>
                <div className="row" style={{ gap: 4, paddingBottom: 2 }}>
                  {[100, 250, 500].map((step) => (
                    <Button
                      key={step}
                      variant="ghost"
                      size="sm"
                      onClick={() => updatePiece(open.id, (w) => ({ ...w, words: w.words + step }), 'add words')}
                    >
                      +{step}
                    </Button>
                  ))}
                </div>
              </div>
              <ProgressBar
                value={open.targetWords > 0 ? (open.words / open.targetWords) * 100 : 0}
                size="md"
                tone={open.words >= open.targetWords ? 'success' : undefined}
                live={open.status === 'drafting'}
              />
            </div>
          </div>

          <hr className="divider" />

          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Kind</span>
              <Select
                value={open.kind}
                size="sm"
                options={(Object.keys(KIND_LABEL) as WritingPiece['kind'][]).map((k) => ({
                  value: k,
                  label: KIND_LABEL[k],
                }))}
                onChange={(next) => updatePiece(open.id, (w) => ({ ...w, kind: next }), 'change kind')}
              />
            </div>
            <div className="field">
              <span className="field__label">Status</span>
              <Select
                value={open.status}
                size="sm"
                options={STATUS_ORDER.map((s) => ({ value: s, label: s }))}
                onChange={(next) =>
                  updatePiece(
                    open.id,
                    (w) => ({
                      ...w,
                      status: next,
                      publishedAt: next === 'published' ? (w.publishedAt ?? derived.today) : undefined,
                    }),
                    'change status',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Scheduled for</span>
              <input
                className="input input--sm"
                type="date"
                value={open.scheduledFor ?? ''}
                onChange={(e) =>
                  updatePiece(open.id, (w) => ({ ...w, scheduledFor: e.target.value || undefined }), 'edit schedule')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Views</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                value={open.views ?? 0}
                onChange={(e) =>
                  updatePiece(open.id, (w) => ({ ...w, views: Number(e.target.value) || undefined }), 'edit views')
                }
              />
            </div>
          </div>

          <div className="field">
            <span className="field__label">Published URL</span>
            <Input
              value={open.url ?? ''}
              size="sm"
              placeholder="https://…"
              onChange={(next) => updatePiece(open.id, (w) => ({ ...w, url: next || undefined }), 'edit url')}
            />
          </div>

          <div className="field">
            <span className="field__label">Publication</span>
            <Input
              value={open.publication ?? ''}
              size="sm"
              placeholder="Where this goes"
              onChange={(next) =>
                updatePiece(open.id, (w) => ({ ...w, publication: next || undefined }), 'edit publication')
              }
            />
          </div>

          {/* Topics */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <div className="row row--between">
              <span className="section-title">
                Topics
                <HelpDot>
                  Keep returning to the same few themes. Recognition comes from repetition, not range.
                </HelpDot>
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={12} />}
                onClick={() => updatePiece(open.id, (w) => ({ ...w, topics: [...w.topics, 'New topic'] }), 'add topic')}
              >
                Add
              </Button>
            </div>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {open.topics.map((topic, index) => (
                <span key={`${topic}-${index}`} className="row" style={{ gap: 2 }}>
                  <Badge tone="accent">
                    <InlineEdit
                      value={topic}
                      onCommit={(next) =>
                        updatePiece(
                          open.id,
                          (w) => ({
                            ...w,
                            topics: next
                              ? w.topics.map((t, i) => (i === index ? next : t))
                              : w.topics.filter((_, i) => i !== index),
                          }),
                          'edit topic',
                        )
                      }
                      ariaLabel="Topic"
                    />
                  </Badge>
                  <IconButton
                    title="Remove topic"
                    tone="danger"
                    onClick={() =>
                      updatePiece(open.id, (w) => ({ ...w, topics: w.topics.filter((_, i) => i !== index) }), 'delete topic')
                    }
                  >
                    <Icon name="x" size={10} />
                  </IconButton>
                </span>
              ))}
            </div>
          </div>

          {/* Competencies */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">Competencies this demonstrates</span>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {data.skills.map((skill) => {
                const selected = open.skillIds.includes(skill.id)
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() =>
                      updatePiece(
                        open.id,
                        (w) => ({
                          ...w,
                          skillIds: selected ? w.skillIds.filter((id) => id !== skill.id) : [...w.skillIds, skill.id],
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
          </div>

          <hr className="divider" />

          {/* Outline */}
          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">
              Outline
              <HelpDot>
                Outline first, always. A piece that survives contact with an outline is a piece that survives
                contact with a reader.
              </HelpDot>
            </span>
            <InlineEdit
              value={open.outline}
              multiline
              placeholder="1. The hook&#10;2. The problem&#10;3. What I did&#10;4. What surprised me&#10;5. The takeaway"
              onCommit={(next) => updatePiece(open.id, (w) => ({ ...w, outline: next }), 'edit outline')}
              ariaLabel="Outline"
            />
          </div>

          {/* Draft */}
          <div className="col" style={{ gap: 5 }}>
            <div className="row row--between">
              <span className="section-title">Draft</span>
              <span className="text-2xs text-quaternary tnum">
                {open.draft.trim() ? `${open.draft.trim().split(/\s+/).length} words in this field` : 'empty'}
              </span>
            </div>
            <InlineEdit
              value={open.draft}
              multiline
              placeholder="Write here, or keep the draft elsewhere and just track progress."
              onCommit={(next) =>
                updatePiece(
                  open.id,
                  (w) => ({
                    ...w,
                    draft: next,
                    // Keep the word count honest when the draft lives in this field.
                    words: next.trim() ? next.trim().split(/\s+/).length : w.words,
                  }),
                  'edit draft',
                )
              }
              ariaLabel="Draft"
            />
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
