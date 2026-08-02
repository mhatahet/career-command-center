/* ============================================================================
   Reading — books, articles, papers and blog posts
   ----------------------------------------------------------------------------
   Two to three books per quarter is a throughput commitment, not a wish. The six
   flagged as core interview resources are the audit's Part 7 list; everything
   else earns its place by the competency it serves.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { BarChart, seriesColor } from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
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
  Tooltip,
} from '../components/ui'
import { formatDate, formatHours, startOfQuarter } from '../lib/dates'
import { useRoute, useScrollToAnchor } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { ID, Priority, ReadingItem, ReadingKind } from '../lib/types'

const KIND_LABEL: Record<ReadingKind, string> = {
  book: 'Book',
  article: 'Article',
  paper: 'Paper',
  'blog-post': 'Blog post',
}

const KIND_ICON: Record<ReadingKind, string> = {
  book: '📕',
  article: '📄',
  paper: '🔬',
  'blog-post': '✏️',
}

const STATUS_TONE = {
  wishlist: 'neutral',
  reading: 'info',
  finished: 'success',
  abandoned: 'danger',
  reference: 'warning',
} as const

const PRIORITY_TONE = { critical: 'danger', high: 'warning', medium: 'neutral', low: 'neutral' } as const

type Filter = 'all' | 'reading' | 'wishlist' | 'finished' | 'core'

export function Reading() {
  const { data, derived, patch } = useStore()
  const route = useRoute()

  const [filter, setFilter] = useState<Filter>('all')
  const [kindFilter, setKindFilter] = useState<ReadingKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<ID | null>(route.anchor ?? null)

  useScrollToAnchor(route.anchor)

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 }

    return data.books
      .filter((item) => {
        if (kindFilter !== 'all' && item.kind !== kindFilter) return false
        if (filter === 'core' && !item.isCoreInterviewResource) return false
        if (filter === 'reading' && item.status !== 'reading') return false
        if (filter === 'wishlist' && item.status !== 'wishlist') return false
        if (filter === 'finished' && item.status !== 'finished') return false
        if (!q) return true
        return `${item.title} ${item.author} ${item.notes} ${item.keyTakeaways.join(' ')}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => {
        // In-progress first, then queue, then everything else.
        const rank = (item: ReadingItem) =>
          item.status === 'reading' ? 0 : item.status === 'wishlist' ? 1 : 2
        return (
          rank(a) - rank(b) ||
          priorityRank[a.priority] - priorityRank[b.priority] ||
          a.title.localeCompare(b.title)
        )
      })
  }, [data.books, filter, kindFilter, query])

  const open = openId ? data.books.find((b) => b.id === openId) : undefined

  const updateItem = (itemId: ID, producer: (item: ReadingItem) => ReadingItem, label: string) => {
    patch('books', (list) => list.map((b) => (b.id === itemId ? producer(b) : b)), label)
  }

  /** Setting pages read derives progress, so the two can never disagree. */
  const setPagesRead = (item: ReadingItem, pages: number) => {
    const total = item.pagesTotal ?? 0
    const clamped = Math.max(0, total > 0 ? Math.min(total, pages) : pages)
    updateItem(
      item.id,
      (b) => ({
        ...b,
        pagesRead: clamped,
        progress: total > 0 ? Math.round((clamped / total) * 100) : b.progress,
        status: total > 0 && clamped >= total ? 'finished' : clamped > 0 ? 'reading' : b.status,
        completedAt: total > 0 && clamped >= total ? (b.completedAt ?? derived.today) : b.completedAt,
      }),
      'update pages read',
    )
  }

  const addItem = () => {
    const item: ReadingItem = {
      id: newId('bk'),
      title: 'New title',
      author: '',
      kind: 'book',
      status: 'wishlist',
      progress: 0,
      estimatedHours: 8,
      actualHours: 0,
      keyTakeaways: [],
      highlights: [],
      notes: '',
      skillIds: [],
      isCoreInterviewResource: false,
      priority: 'medium',
      xp: 100,
      order: data.books.length,
    }
    patch('books', (list) => [item, ...list], 'add reading item')
    setOpenId(item.id)
  }

  /* --------------------------------------------------------------- stats -- */

  const stats = useMemo(() => {
    const books = data.books.filter((b) => b.kind === 'book')
    const core = books.filter((b) => b.isCoreInterviewResource)
    return {
      books: books.length,
      finished: books.filter((b) => b.status === 'finished').length,
      reading: books.filter((b) => b.status === 'reading').length,
      coreFinished: core.filter((b) => b.status === 'finished').length,
      coreTotal: core.length,
      hours: data.books.reduce((sum, b) => sum + b.actualHours, 0),
      plannedHours: data.books.reduce((sum, b) => sum + b.estimatedHours, 0),
      takeaways: data.books.reduce((sum, b) => sum + b.keyTakeaways.length, 0),
      highlights: data.books.reduce((sum, b) => sum + b.highlights.length, 0),
    }
  }, [data.books])

  /** The audit's cadence: 2–3 books per quarter. */
  const quarterStart = startOfQuarter(derived.today)
  const finishedThisQuarter = data.books.filter(
    (b) => b.kind === 'book' && b.completedAt && b.completedAt >= quarterStart,
  ).length

  const bySkill = useMemo(() => {
    const map = new Map<ID, number>()
    for (const item of data.books) {
      for (const skillId of item.skillIds) map.set(skillId, (map.get(skillId) ?? 0) + 1)
    }
    const names = new Map(data.skills.map((s) => [s.id, s.name]))
    return [...map.entries()]
      .map(([skillId, count], i) => ({
        label: names.get(skillId) ?? skillId,
        value: count,
        color: seriesColor(i),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [data.books, data.skills])

  const skillNames = useMemo(() => new Map(data.skills.map((s) => [s.id, s.name])), [data.skills])

  return (
    <div className="page">
      <PageHeader
        title="Reading"
        lede="Books, articles and research papers, each tied to the competency it serves. The six marked core are the interview resources named in the audit — those are the ones that show up in a loop."
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search titles, authors, takeaways…" size="sm" />
            <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={addItem}>
              Add
            </Button>
          </>
        }
      />

      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Books finished"
              value={`${stats.finished} / ${stats.books}`}
              size="lg"
              tone={stats.finished >= 6 ? 'success' : undefined}
              meta={`${stats.reading} in progress`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Core interview six"
              value={`${stats.coreFinished} / ${stats.coreTotal}`}
              size="lg"
              tone={stats.coreFinished === stats.coreTotal ? 'success' : 'warning'}
              help="Decode and Conquer, Cracking the PM Interview, Inspired, Escaping the Build Trap, Continuous Discovery Habits, Lean Analytics. The audit's Part 7 list, verbatim."
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar
                value={(stats.coreFinished / Math.max(1, stats.coreTotal)) * 100}
                size="xs"
                tone={stats.coreFinished === stats.coreTotal ? 'success' : undefined}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="This quarter"
              value={`${finishedThisQuarter} / 3`}
              size="lg"
              tone={finishedThisQuarter >= 2 ? 'success' : 'warning'}
              help="The audit's cadence is 2–3 books per quarter across the full 24 months — roughly 20 books."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Hours read"
              value={Math.round(stats.hours)}
              unit="h"
              size="lg"
              meta={`${Math.round(stats.plannedHours)}h in the queue`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Takeaways captured"
              value={stats.takeaways}
              size="lg"
              meta={`${stats.highlights} highlights`}
              help="Notes as decision rules, not summaries. A takeaway you cannot act on is a sentence you will never reread."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Total items"
              value={data.books.length}
              size="lg"
              meta={`${data.books.filter((b) => b.kind !== 'book').length} articles & papers`}
            />
          </CardBody>
        </Card>
      </div>

      <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: data.books.length },
            { value: 'reading', label: 'Reading', count: data.books.filter((b) => b.status === 'reading').length },
            { value: 'core', label: 'Core six', count: data.books.filter((b) => b.isCoreInterviewResource).length },
            { value: 'wishlist', label: 'Queue', count: data.books.filter((b) => b.status === 'wishlist').length },
            { value: 'finished', label: 'Finished', count: data.books.filter((b) => b.status === 'finished').length },
          ]}
        />
        <Segmented
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: 'all', label: 'All kinds' },
            ...(Object.keys(KIND_LABEL) as ReadingKind[])
              .filter((k) => data.books.some((b) => b.kind === k))
              .map((k) => ({
                value: k,
                label: KIND_LABEL[k],
                count: data.books.filter((b) => b.kind === k).length,
              })),
          ]}
        />
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <Card>
          <EmptyState icon="📖" title="Nothing here" body="Adjust the filters or add something to read." />
        </Card>
      ) : (
        <div className="grid grid--auto">
          {items.map((item) => (
            <Card key={item.id} id={item.id} onClick={() => setOpenId(item.id)}>
              <CardBody>
                <div className="col" style={{ gap: 'var(--space-3)' }}>
                  <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{KIND_ICON[item.kind]}</span>
                    <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                      <span
                        className="text-sm clamp-2"
                        style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}
                      >
                        {item.title}
                      </span>
                      <span className="text-2xs text-quaternary truncate">{item.author || '—'}</span>
                    </div>
                    {item.progress > 0 && item.progress < 100 ? (
                      <Ring value={item.progress} size={38} thickness={4} display={item.progress} valueSize={10} />
                    ) : null}
                  </div>

                  <div className="row row--wrap" style={{ gap: 4 }}>
                    <Badge tone={STATUS_TONE[item.status]} dot>
                      {item.status}
                    </Badge>
                    {item.isCoreInterviewResource ? <Badge tone="accent">core</Badge> : null}
                    {item.priority === 'critical' || item.priority === 'high' ? (
                      <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                    ) : null}
                    {item.rating ? <Badge tone="neutral">{'★'.repeat(item.rating)}</Badge> : null}
                  </div>

                  {item.status === 'reading' ? <ProgressBar value={item.progress} size="sm" live /> : null}

                  <p
                    className="text-2xs text-tertiary clamp-3"
                    style={{ lineHeight: 'var(--leading-snug)', minHeight: 42 }}
                  >
                    {item.notes || 'No note on why this is on the list.'}
                  </p>

                  <div className="row row--between">
                    <div className="row row--wrap" style={{ gap: 4 }}>
                      {item.skillIds.slice(0, 2).map((skillId) => (
                        <span key={skillId} className="text-2xs text-quaternary">
                          {skillNames.get(skillId)}
                        </span>
                      ))}
                    </div>
                    <span className="text-2xs tnum text-quaternary">
                      {item.pagesTotal ? `${item.pagesRead ?? 0}/${item.pagesTotal}p · ` : ''}
                      {formatHours(item.estimatedHours)}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Reading by competency */}
      {bySkill.length > 0 ? (
        <Card>
          <CardHeader
            title="Reading by competency"
            subtitle="Which gaps your reading list is actually addressing"
            help="If your must-fix competencies have no books against them, the reading list is not serving the plan."
          />
          <CardBody>
            <BarChart data={bySkill} horizontal formatValue={(v) => `${v} item${v === 1 ? '' : 's'}`} />
          </CardBody>
        </Card>
      ) : null}

      {/* Detail drawer */}
      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={720}
          title={
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <span>{KIND_ICON[open.kind]}</span>
              <InlineEdit
                value={open.title}
                onCommit={(next) => updateItem(open.id, (b) => ({ ...b, title: next }), 'rename item')}
                ariaLabel="Title"
              />
            </span>
          }
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              <InlineEdit
                value={open.author}
                placeholder="Author"
                onCommit={(next) => updateItem(open.id, (b) => ({ ...b, author: next }), 'edit author')}
                ariaLabel="Author"
              />
              <Badge tone={STATUS_TONE[open.status]}>{open.status}</Badge>
              {open.isCoreInterviewResource ? <Badge tone="accent">core interview resource</Badge> : null}
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  patch('books', (list) => list.filter((b) => b.id !== open.id), 'delete reading item')
                  setOpenId(null)
                }}
                label="Delete"
                size="md"
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {open.status !== 'finished' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Icon name="check" size={13} />}
                    onClick={() =>
                      updateItem(
                        open.id,
                        (b) => ({
                          ...b,
                          status: 'finished',
                          progress: 100,
                          pagesRead: b.pagesTotal ?? b.pagesRead,
                          actualHours: b.actualHours > 0 ? b.actualHours : b.estimatedHours,
                          completedAt: derived.today,
                        }),
                        'finish reading',
                      )
                    }
                  >
                    Mark finished
                  </Button>
                ) : (
                  <Badge tone="success" size="lg">
                    Finished {formatDate(open.completedAt)} · +{open.xp} XP
                  </Badge>
                )}
                <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>
            </>
          }
        >
          {/* Progress */}
          <div className="col" style={{ gap: 'var(--space-3)' }}>
            <div className="row row--between">
              <span className="section-title">Progress</span>
              <span className="text-sm tnum">{open.progress}%</span>
            </div>
            <ProgressBar value={open.progress} size="lg" tone={open.progress >= 100 ? 'success' : undefined} />
            {open.pagesTotal ? (
              <div className="row row--wrap" style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                <div className="field" style={{ maxWidth: 130 }}>
                  <span className="field__label">Pages read</span>
                  <input
                    className="input input--sm input--num"
                    type="number"
                    min={0}
                    max={open.pagesTotal}
                    value={open.pagesRead ?? 0}
                    onChange={(e) => setPagesRead(open, Number(e.target.value) || 0)}
                  />
                </div>
                <span className="text-xs text-quaternary" style={{ paddingBottom: 7 }}>
                  of {open.pagesTotal}
                </span>
                <div className="row" style={{ gap: 4, paddingBottom: 2 }}>
                  {[10, 25, 50].map((step) => (
                    <Button
                      key={step}
                      variant="ghost"
                      size="sm"
                      onClick={() => setPagesRead(open, (open.pagesRead ?? 0) + step)}
                    >
                      +{step}p
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="field" style={{ maxWidth: 160 }}>
                <span className="field__label">Progress %</span>
                <input
                  className="input input--sm input--num"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={open.progress}
                  onChange={(e) =>
                    updateItem(
                      open.id,
                      (b) => ({ ...b, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }),
                      'edit progress',
                    )
                  }
                />
              </div>
            )}
          </div>

          <hr className="divider" />

          {/* Fields */}
          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Kind</span>
              <Select
                value={open.kind}
                size="sm"
                options={(Object.keys(KIND_LABEL) as ReadingKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                onChange={(next) => updateItem(open.id, (b) => ({ ...b, kind: next }), 'change kind')}
              />
            </div>
            <div className="field">
              <span className="field__label">Status</span>
              <Select
                value={open.status}
                size="sm"
                options={[
                  { value: 'wishlist', label: 'Queue' },
                  { value: 'reading', label: 'Reading' },
                  { value: 'finished', label: 'Finished' },
                  { value: 'reference', label: 'Reference' },
                  { value: 'abandoned', label: 'Abandoned' },
                ]}
                onChange={(next) =>
                  updateItem(
                    open.id,
                    (b) => ({
                      ...b,
                      status: next,
                      startedAt: next === 'reading' ? (b.startedAt ?? derived.today) : b.startedAt,
                    }),
                    'change status',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Priority</span>
              <Select
                value={open.priority}
                size="sm"
                options={[
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
                onChange={(next) => updateItem(open.id, (b) => ({ ...b, priority: next as Priority }), 'change priority')}
              />
            </div>
            <div className="field">
              <span className="field__label">Rating</span>
              <Select
                value={String(open.rating ?? 0)}
                size="sm"
                options={[
                  { value: '0', label: 'Unrated' },
                  { value: '1', label: '★' },
                  { value: '2', label: '★★' },
                  { value: '3', label: '★★★' },
                  { value: '4', label: '★★★★' },
                  { value: '5', label: '★★★★★' },
                ]}
                onChange={(next) =>
                  updateItem(
                    open.id,
                    (b) => ({
                      ...b,
                      rating: Number(next) === 0 ? undefined : (Number(next) as ReadingItem['rating']),
                    }),
                    'rate item',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Total pages</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                value={open.pagesTotal ?? 0}
                onChange={(e) =>
                  updateItem(open.id, (b) => ({ ...b, pagesTotal: Number(e.target.value) || undefined }), 'edit page count')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Estimated hours</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                step={0.5}
                value={open.estimatedHours}
                onChange={(e) =>
                  updateItem(open.id, (b) => ({ ...b, estimatedHours: Number(e.target.value) || 0 }), 'edit estimate')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Actual hours</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                step={0.5}
                value={open.actualHours}
                onChange={(e) =>
                  updateItem(open.id, (b) => ({ ...b, actualHours: Number(e.target.value) || 0 }), 'edit actual hours')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Core interview resource</span>
              <div className="row" style={{ height: 26, alignItems: 'center' }}>
                <Tooltip content="Flags this as one of the audit's named interview resources. Tracked separately on the summary row.">
                  <span style={{ display: 'inline-flex' }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={open.isCoreInterviewResource}
                      onChange={(e) =>
                        updateItem(
                          open.id,
                          (b) => ({ ...b, isCoreInterviewResource: e.target.checked }),
                          'toggle core resource',
                        )
                      }
                      aria-label="Core interview resource"
                    />
                  </span>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="field">
            <span className="field__label">URL</span>
            <Input
              value={open.url ?? ''}
              size="sm"
              placeholder="https://…"
              onChange={(next) => updateItem(open.id, (b) => ({ ...b, url: next || undefined }), 'edit url')}
            />
          </div>

          {/* Competencies */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">Competencies this serves</span>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {data.skills.map((skill) => {
                const selected = open.skillIds.includes(skill.id)
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() =>
                      updateItem(
                        open.id,
                        (b) => ({
                          ...b,
                          skillIds: selected ? b.skillIds.filter((id) => id !== skill.id) : [...b.skillIds, skill.id],
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

          {/* Why it is on the list */}
          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">
              Why this is on the list
              <HelpDot>
                Every item should earn its place. If you cannot say why, it belongs on the abandoned pile.
              </HelpDot>
            </span>
            <InlineEdit
              value={open.notes}
              multiline
              placeholder="What are you hoping to get from this?"
              onCommit={(next) => updateItem(open.id, (b) => ({ ...b, notes: next }), 'edit notes')}
              ariaLabel="Notes"
            />
          </div>

          {/* Takeaways */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <div className="row row--between">
              <span className="section-title">
                Key takeaways
                <HelpDot>
                  Write these as decision rules you could act on, not as summaries of what the author said.
                </HelpDot>
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={12} />}
                onClick={() =>
                  updateItem(open.id, (b) => ({ ...b, keyTakeaways: [...b.keyTakeaways, 'New takeaway'] }), 'add takeaway')
                }
              >
                Add
              </Button>
            </div>
            {open.keyTakeaways.length === 0 ? (
              <span className="text-xs text-quaternary">No takeaways yet.</span>
            ) : (
              open.keyTakeaways.map((takeaway, index) => (
                <div key={`${takeaway}-${index}`} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent-text)', fontSize: 10, marginTop: 4 }}>◆</span>
                  <span className="text-sm text-secondary grow">
                    <InlineEdit
                      value={takeaway}
                      onCommit={(next) =>
                        updateItem(
                          open.id,
                          (b) => ({
                            ...b,
                            keyTakeaways: next
                              ? b.keyTakeaways.map((t, i) => (i === index ? next : t))
                              : b.keyTakeaways.filter((_, i) => i !== index),
                          }),
                          'edit takeaway',
                        )
                      }
                      ariaLabel="Takeaway"
                    />
                  </span>
                  <IconButton
                    title="Remove"
                    tone="danger"
                    onClick={() =>
                      updateItem(
                        open.id,
                        (b) => ({ ...b, keyTakeaways: b.keyTakeaways.filter((_, i) => i !== index) }),
                        'delete takeaway',
                      )
                    }
                  >
                    <Icon name="x" size={11} />
                  </IconButton>
                </div>
              ))
            )}
          </div>

          {/* Highlights */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <div className="row row--between">
              <span className="section-title">Highlights</span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={12} />}
                onClick={() =>
                  updateItem(
                    open.id,
                    (b) => ({ ...b, highlights: [...b.highlights, { id: newId('hl'), text: '', page: '' }] }),
                    'add highlight',
                  )
                }
              >
                Add
              </Button>
            </div>
            {open.highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="col"
                style={{
                  gap: 4,
                  padding: 'var(--space-3)',
                  background: 'var(--bg-inset)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '2px solid var(--warning)',
                }}
              >
                <span className="text-sm text-secondary" style={{ fontStyle: 'italic' }}>
                  <InlineEdit
                    value={highlight.text}
                    multiline
                    placeholder="Paste the passage…"
                    onCommit={(next) =>
                      updateItem(
                        open.id,
                        (b) => ({
                          ...b,
                          highlights: b.highlights.map((h) => (h.id === highlight.id ? { ...h, text: next } : h)),
                        }),
                        'edit highlight',
                      )
                    }
                    ariaLabel="Highlight text"
                  />
                </span>
                <div className="row row--between">
                  <span className="text-2xs text-quaternary">
                    p.{' '}
                    <InlineEdit
                      value={highlight.page ?? ''}
                      placeholder="—"
                      onCommit={(next) =>
                        updateItem(
                          open.id,
                          (b) => ({
                            ...b,
                            highlights: b.highlights.map((h) => (h.id === highlight.id ? { ...h, page: next } : h)),
                          }),
                          'edit highlight page',
                        )
                      }
                      ariaLabel="Page"
                    />
                  </span>
                  <IconButton
                    title="Remove highlight"
                    tone="danger"
                    onClick={() =>
                      updateItem(
                        open.id,
                        (b) => ({ ...b, highlights: b.highlights.filter((h) => h.id !== highlight.id) }),
                        'delete highlight',
                      )
                    }
                  >
                    <Icon name="x" size={11} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
