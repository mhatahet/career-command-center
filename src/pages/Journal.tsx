/* ============================================================================
   Journal
   ----------------------------------------------------------------------------
   Daily reflections, weekly reviews, monthly retrospectives and quarterly
   checkpoints. Reflection is what converts hours into learning — and the audit's
   review questions only work if the answers are written down somewhere they can
   be reread.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { ActivityCalendar, BarChart, HeatLegend, LineChart } from '../components/charts'
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
  Segmented,
  Select,
  Stat,
  Tooltip,
} from '../components/ui'
import { formatDate, formatHours, formatRelative } from '../lib/dates'
import { newId, useStore } from '../lib/store'
import type { ID, JournalEntry } from '../lib/types'

const KIND_LABEL: Record<JournalEntry['kind'], string> = {
  daily: 'Daily',
  weekly: 'Weekly review',
  monthly: 'Monthly retrospective',
  quarterly: 'Quarterly checkpoint',
}

const KIND_TONE = { daily: 'neutral', weekly: 'info', monthly: 'accent', quarterly: 'success' } as const

const MOOD_ICONS = ['', '😞', '😕', '😐', '🙂', '😄']
const ENERGY_LABELS = ['', 'Depleted', 'Low', 'Steady', 'Good', 'Excellent']

export function Journal() {
  const { data, derived, update } = useStore()
  const [kindFilter, setKindFilter] = useState<JournalEntry['kind'] | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<ID | null>(null)

  const { entries, prompts } = data.journal

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter((entry) => {
        if (kindFilter !== 'all' && entry.kind !== kindFilter) return false
        if (!q) return true
        const haystack = [
          ...Object.values(entry.answers),
          ...entry.wins,
          ...entry.blockers,
          ...entry.tags,
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [entries, kindFilter, query])

  const open = openId ? entries.find((e) => e.id === openId) : undefined

  const updateEntry = (entryId: ID, producer: (entry: JournalEntry) => JournalEntry, label: string) => {
    update(
      (draft) => ({
        ...draft,
        journal: { ...draft.journal, entries: draft.journal.entries.map((e) => (e.id === entryId ? producer(e) : e)) },
      }),
      ['journal'],
      label,
    )
  }

  const addEntry = (kind: JournalEntry['kind']) => {
    // Reuse today's entry of the same kind rather than creating a duplicate.
    const existing = entries.find((e) => e.date === derived.today && e.kind === kind)
    if (existing) {
      setOpenId(existing.id)
      return
    }

    const entry: JournalEntry = {
      id: newId('jr'),
      date: derived.today,
      kind,
      mood: 3,
      energy: 3,
      answers: {},
      hoursLogged: data.analytics.activity.find((a) => a.date === derived.today)?.hours,
      wins: [],
      blockers: [],
      tags: [],
      createdAt: new Date().toISOString(),
    }
    update(
      (draft) => ({ ...draft, journal: { ...draft.journal, entries: [entry, ...draft.journal.entries] } }),
      ['journal'],
      `add ${kind} entry`,
    )
    setOpenId(entry.id)
  }

  /* --------------------------------------------------------------- stats -- */

  const stats = useMemo(() => {
    const moods = entries.filter((e) => typeof e.mood === 'number')
    const withAnswers = entries.filter((e) => Object.values(e.answers).some((a) => a.trim()))
    return {
      total: entries.length,
      daily: entries.filter((e) => e.kind === 'daily').length,
      weekly: entries.filter((e) => e.kind === 'weekly').length,
      monthly: entries.filter((e) => e.kind === 'monthly').length,
      quarterly: entries.filter((e) => e.kind === 'quarterly').length,
      avgMood: moods.length > 0 ? moods.reduce((sum, e) => sum + (e.mood ?? 0), 0) / moods.length : 0,
      wins: entries.reduce((sum, e) => sum + e.wins.length, 0),
      blockers: entries.reduce((sum, e) => sum + e.blockers.length, 0),
      answered: withAnswers.length,
      words: entries.reduce(
        (sum, e) => sum + Object.values(e.answers).join(' ').trim().split(/\s+/).filter(Boolean).length,
        0,
      ),
    }
  }, [entries])

  const journalMap = useMemo(
    () =>
      new Map(
        entries.map((e) => [
          e.date,
          {
            hours: e.hoursLogged ?? 1,
            note: `${KIND_LABEL[e.kind]}${e.mood ? ` · mood ${e.mood}/5` : ''}`,
            tasks: e.wins.length,
          },
        ]),
      ),
    [entries],
  )

  const moodTrend = useMemo(
    () =>
      entries
        .filter((e) => typeof e.mood === 'number')
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ x: e.date, y: e.mood ?? 0 })),
    [entries],
  )

  const energyTrend = useMemo(
    () =>
      entries
        .filter((e) => typeof e.energy === 'number')
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ x: e.date, y: e.energy ?? 0 })),
    [entries],
  )

  /** Most-used tags, so recurring themes surface. */
  const tagCloud = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) for (const tag of entry.tags) map.set(tag, (map.get(tag) ?? 0) + 1)
    return [...map.entries()].sort(([, a], [, b]) => b - a).slice(0, 20)
  }, [entries])

  /** Recurring blockers — the ones worth actually fixing. */
  const blockerCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) {
      for (const blocker of entry.blockers) {
        const key = blocker.toLowerCase().slice(0, 40)
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
    return [...map.entries()]
      .filter(([, count]) => count >= 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([label, value]) => ({ label, value, color: value > 1 ? 'var(--danger)' : 'var(--warning)' }))
  }, [entries])

  const promptsFor = (kind: JournalEntry['kind']) => prompts.filter((p) => p.kind === kind)

  return (
    <div className="page">
      <PageHeader
        title="Journal"
        lede="Reflection is what turns hours into learning. The weekly and quarterly prompts are the audit's own review questions — written down, they become a record of what actually changed rather than an impression of a busy year."
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search entries…" size="sm" />
            <Segmented
              value={kindFilter}
              onChange={setKindFilter}
              options={[
                { value: 'all', label: 'All', count: stats.total },
                { value: 'daily', label: 'Daily', count: stats.daily },
                { value: 'weekly', label: 'Weekly', count: stats.weekly },
                { value: 'monthly', label: 'Monthly', count: stats.monthly },
                { value: 'quarterly', label: 'Quarterly', count: stats.quarterly },
              ]}
            />
          </>
        }
      />

      {/* Quick add */}
      <Card variant="accent">
        <CardBody className="card__body--tight">
          <div className="row row--wrap row--between" style={{ gap: 'var(--space-3)' }}>
            <div className="col" style={{ gap: 2 }}>
              <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                Write today's entry
              </span>
              <span className="text-2xs text-quaternary">
                {formatDate(derived.today, { year: true })} ·{' '}
                {entries.some((e) => e.date === derived.today)
                  ? 'you have already written today'
                  : 'nothing written yet today'}
              </span>
            </div>
            <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
              {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map((kind) => (
                <Button
                  key={kind}
                  variant={kind === 'daily' ? 'primary' : 'secondary'}
                  size="sm"
                  icon={<Icon name="plus" size={12} />}
                  onClick={() => addEntry(kind)}
                >
                  {KIND_LABEL[kind]}
                </Button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Stats */}
      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="Entries" value={stats.total} size="lg" meta={`${stats.answered} with answers`} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Reviews completed"
              value={stats.weekly + stats.monthly + stats.quarterly}
              size="lg"
              meta={`${stats.weekly}w · ${stats.monthly}m · ${stats.quarterly}q`}
              help="The audit prescribes weekly reviews, monthly retrospectives and quarterly checkpoints. These are the entries that change decisions."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Average mood"
              value={stats.avgMood > 0 ? `${MOOD_ICONS[Math.round(stats.avgMood)]} ${stats.avgMood.toFixed(1)}` : '—'}
              size="lg"
              help="Worth tracking because a sustained dip usually precedes a dropped streak by a week or two."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="Wins logged" value={stats.wins} size="lg" tone="success" />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Blockers logged"
              value={stats.blockers}
              size="lg"
              tone={stats.blockers > stats.wins ? 'warning' : 'neutral'}
              help="A blocker named precisely enough becomes a task. One that recurs three times is a system problem, not a bad week."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="Words written" value={stats.words.toLocaleString()} size="lg" />
          </CardBody>
        </Card>
      </div>

      {/* Calendar + trends */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Journalling calendar"
            subtitle={`${entries.length} entries`}
            help="Every square is a day you wrote something. Consistency here correlates tightly with consistency everywhere else."
            actions={<HeatLegend />}
          />
          <CardBody>
            <ActivityCalendar
              data={journalMap}
              endDate={derived.today}
              weeks={26}
              weekStartsOn={data.settings.weekStartsOn}
              formatTip={(date, value) => [
                { label: 'Entry', value: value ? (value.note ?? 'written') : 'none' },
                { label: 'Wins', value: value ? String(value.tasks ?? 0) : '0' },
                { label: 'Date', value: date },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mood and energy" help="Two lines on a five-point scale. The gap between them usually says more than either one alone." />
          <CardBody>
            {moodTrend.length > 1 ? (
              <LineChart
                series={[
                  { label: 'Mood', color: 'var(--accent)', points: moodTrend, fill: true },
                  { label: 'Energy', color: 'var(--viz-4)', points: energyTrend },
                ]}
                height={190}
                yMin={1}
                yMax={5}
                yTicks={4}
                formatX={(x) => formatDate(x)}
                formatY={(y) => y.toFixed(0)}
              />
            ) : (
              <span className="text-xs text-quaternary">Log a couple of entries to see the trend.</span>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recurring blockers */}
      {blockerCounts.length > 0 ? (
        <Card>
          <CardHeader
            title="Recurring blockers"
            subtitle="What keeps getting in the way"
            help="Red bars have appeared more than once. A blocker that recurs is not bad luck — it is a system that needs changing."
          />
          <CardBody>
            <BarChart data={blockerCounts} horizontal formatValue={(v) => `${v}×`} />
          </CardBody>
        </Card>
      ) : null}

      {/* Tags */}
      {tagCloud.length > 0 ? (
        <Card>
          <CardHeader title="Tags" help="Click a tag to filter entries by it." />
          <CardBody>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {tagCloud.map(([tag, count]) => (
                <button key={tag} type="button" onClick={() => setQuery(tag)} style={{ display: 'inline-flex' }}>
                  <Badge tone={query === tag ? 'accent' : 'neutral'} size="lg">
                    #{tag} · {count}
                  </Badge>
                </button>
              ))}
              {query ? (
                <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                  Clear
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Entries */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon="📔"
            title={entries.length === 0 ? 'No entries yet' : 'Nothing matches'}
            body={
              entries.length === 0
                ? 'Start with a daily entry: what did I learn, what blocked me, what should improve, what did I ship.'
                : 'Adjust the filter or clear the search.'
            }
            action={
              <Button variant="primary" size="sm" onClick={() => addEntry('daily')}>
                Write today's entry
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          {filtered.map((entry) => {
            const answered = Object.entries(entry.answers).filter(([, value]) => value.trim())
            const entryPrompts = promptsFor(entry.kind)
            return (
              <Card key={entry.id} onClick={() => setOpenId(entry.id)}>
                <CardBody>
                  <div className="col" style={{ gap: 'var(--space-3)' }}>
                    <div className="row row--between row--wrap" style={{ gap: 'var(--space-2)' }}>
                      <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
                        <Badge tone={KIND_TONE[entry.kind]}>{KIND_LABEL[entry.kind]}</Badge>
                        <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                          {formatDate(entry.date, { year: true })}
                        </span>
                        <span className="text-2xs text-quaternary">{formatRelative(entry.date, derived.today)}</span>
                        {entry.hoursLogged ? (
                          <span className="text-2xs text-quaternary">· {formatHours(entry.hoursLogged)} logged</span>
                        ) : null}
                      </div>
                      <div className="row" style={{ gap: 'var(--space-2)' }}>
                        {entry.mood ? (
                          <Tooltip content={`Mood ${entry.mood}/5`}>
                            <span style={{ fontSize: 15 }}>{MOOD_ICONS[entry.mood]}</span>
                          </Tooltip>
                        ) : null}
                        {entry.energy ? (
                          <Tooltip content={`Energy: ${ENERGY_LABELS[entry.energy]}`}>
                            <Badge tone="neutral">⚡ {entry.energy}</Badge>
                          </Tooltip>
                        ) : null}
                        <span className="text-2xs tnum text-quaternary">
                          {answered.length}/{entryPrompts.length} answered
                        </span>
                      </div>
                    </div>

                    {answered.slice(0, 2).map(([key, value]) => {
                      const prompt = prompts.find((p) => p.id === key)
                      return (
                        <div key={key} className="col" style={{ gap: 2 }}>
                          <span className="text-2xs text-quaternary">{prompt?.question ?? key}</span>
                          <p className="text-sm text-secondary clamp-2" style={{ lineHeight: 'var(--leading-normal)' }}>
                            {value}
                          </p>
                        </div>
                      )
                    })}

                    {(entry.wins.length > 0 || entry.blockers.length > 0 || entry.tags.length > 0) && (
                      <div className="row row--wrap" style={{ gap: 4 }}>
                        {entry.wins.slice(0, 3).map((win, i) => (
                          <Badge key={`${win}-${i}`} tone="success">
                            ✓ {win.length > 34 ? `${win.slice(0, 32)}…` : win}
                          </Badge>
                        ))}
                        {entry.blockers.slice(0, 2).map((blocker, i) => (
                          <Badge key={`${blocker}-${i}`} tone="warning">
                            ○ {blocker.length > 34 ? `${blocker.slice(0, 32)}…` : blocker}
                          </Badge>
                        ))}
                        {entry.tags.map((tag) => (
                          <Badge key={tag} tone="neutral">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {/* Entry drawer */}
      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={760}
          title={`${KIND_LABEL[open.kind]} — ${formatDate(open.date, { year: true })}`}
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              {open.mood ? <span>{MOOD_ICONS[open.mood]} mood {open.mood}/5</span> : null}
              {open.energy ? <span>· ⚡ {ENERGY_LABELS[open.energy]}</span> : null}
              {open.hoursLogged ? <span>· {formatHours(open.hoursLogged)} logged</span> : null}
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  update(
                    (draft) => ({
                      ...draft,
                      journal: { ...draft.journal, entries: draft.journal.entries.filter((e) => e.id !== open.id) },
                    }),
                    ['journal'],
                    'delete entry',
                  )
                  setOpenId(null)
                }}
                label="Delete entry"
                size="md"
              />
              <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </>
          }
        >
          {/* Meta */}
          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Kind</span>
              <Select
                value={open.kind}
                size="sm"
                options={(Object.keys(KIND_LABEL) as JournalEntry['kind'][]).map((k) => ({
                  value: k,
                  label: KIND_LABEL[k],
                }))}
                onChange={(next) => updateEntry(open.id, (e) => ({ ...e, kind: next }), 'change entry kind')}
              />
            </div>
            <div className="field">
              <span className="field__label">Date</span>
              <input
                className="input input--sm"
                type="date"
                value={open.date}
                onChange={(e) => updateEntry(open.id, (entry) => ({ ...entry, date: e.target.value }), 'edit entry date')}
              />
            </div>
            <div className="field">
              <span className="field__label">Mood</span>
              <Select
                value={String(open.mood ?? 3)}
                size="sm"
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${MOOD_ICONS[n]} ${n}` }))}
                onChange={(next) =>
                  updateEntry(open.id, (e) => ({ ...e, mood: Number(next) as JournalEntry['mood'] }), 'edit mood')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Energy</span>
              <Select
                value={String(open.energy ?? 3)}
                size="sm"
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${ENERGY_LABELS[n]}` }))}
                onChange={(next) =>
                  updateEntry(open.id, (e) => ({ ...e, energy: Number(next) as JournalEntry['energy'] }), 'edit energy')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Hours logged</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                step={0.5}
                value={open.hoursLogged ?? 0}
                onChange={(e) =>
                  updateEntry(open.id, (entry) => ({ ...entry, hoursLogged: Number(e.target.value) || undefined }), 'edit hours')
                }
              />
            </div>
          </div>

          <hr className="divider" />

          {/* Prompts */}
          <div className="col" style={{ gap: 'var(--space-5)' }}>
            <span className="section-title">
              {KIND_LABEL[open.kind]} prompts
              <HelpDot>
                {open.kind === 'daily'
                  ? 'The four daily questions. Keep the answers short and specific — one thing learned beats a paragraph of summary.'
                  : 'These are the audit\'s own review questions. Answer them honestly; the value is in noticing patterns across periods.'}
              </HelpDot>
            </span>

            {promptsFor(open.kind).map((prompt) => (
              <div key={prompt.id} className="col" style={{ gap: 5 }}>
                <span className="text-sm" style={{ color: 'var(--accent-text)', fontWeight: 'var(--weight-medium)' }}>
                  {prompt.question}
                </span>
                {prompt.helper ? <span className="text-2xs text-quaternary">{prompt.helper}</span> : null}
                <InlineEdit
                  value={open.answers[prompt.id] ?? ''}
                  multiline
                  placeholder="Click to write…"
                  onCommit={(next) =>
                    updateEntry(
                      open.id,
                      (e) => ({ ...e, answers: { ...e.answers, [prompt.id]: next } }),
                      'edit journal answer',
                    )
                  }
                  ariaLabel={prompt.question}
                />
              </div>
            ))}
          </div>

          <hr className="divider" />

          {/* Wins */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <div className="row row--between">
              <span className="section-title" style={{ color: 'var(--success-text)' }}>
                Wins
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={12} />}
                onClick={() => updateEntry(open.id, (e) => ({ ...e, wins: [...e.wins, 'New win'] }), 'add win')}
              >
                Add
              </Button>
            </div>
            {open.wins.length === 0 ? (
              <span className="text-xs text-quaternary">Nothing logged. Even a small one counts.</span>
            ) : (
              open.wins.map((win, index) => (
                <div key={`${win}-${index}`} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--success)', fontSize: 11, marginTop: 3 }}>✓</span>
                  <span className="text-sm text-secondary grow">
                    <InlineEdit
                      value={win}
                      onCommit={(next) =>
                        updateEntry(
                          open.id,
                          (e) => ({
                            ...e,
                            wins: next ? e.wins.map((w, i) => (i === index ? next : w)) : e.wins.filter((_, i) => i !== index),
                          }),
                          'edit win',
                        )
                      }
                      ariaLabel="Win"
                    />
                  </span>
                  <IconButton
                    title="Remove"
                    tone="danger"
                    onClick={() =>
                      updateEntry(open.id, (e) => ({ ...e, wins: e.wins.filter((_, i) => i !== index) }), 'delete win')
                    }
                  >
                    <Icon name="x" size={11} />
                  </IconButton>
                </div>
              ))
            )}
          </div>

          {/* Blockers */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <div className="row row--between">
              <span className="section-title" style={{ color: 'var(--warning-text)' }}>
                Blockers
                <HelpDot>
                  Name each one precisely enough that it becomes actionable. "Tired" is not a blocker;
                  "evenings are unreliable, mornings are not" is.
                </HelpDot>
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={12} />}
                onClick={() => updateEntry(open.id, (e) => ({ ...e, blockers: [...e.blockers, 'New blocker'] }), 'add blocker')}
              >
                Add
              </Button>
            </div>
            {open.blockers.length === 0 ? (
              <span className="text-xs text-quaternary">Nothing blocking.</span>
            ) : (
              open.blockers.map((blocker, index) => (
                <div key={`${blocker}-${index}`} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--warning)', fontSize: 11, marginTop: 3 }}>○</span>
                  <span className="text-sm text-secondary grow">
                    <InlineEdit
                      value={blocker}
                      onCommit={(next) =>
                        updateEntry(
                          open.id,
                          (e) => ({
                            ...e,
                            blockers: next
                              ? e.blockers.map((b, i) => (i === index ? next : b))
                              : e.blockers.filter((_, i) => i !== index),
                          }),
                          'edit blocker',
                        )
                      }
                      ariaLabel="Blocker"
                    />
                  </span>
                  <IconButton
                    title="Remove"
                    tone="danger"
                    onClick={() =>
                      updateEntry(open.id, (e) => ({ ...e, blockers: e.blockers.filter((_, i) => i !== index) }), 'delete blocker')
                    }
                  >
                    <Icon name="x" size={11} />
                  </IconButton>
                </div>
              ))
            )}
          </div>

          {/* Tags */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <div className="row row--between">
              <span className="section-title">Tags</span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={12} />}
                onClick={() => updateEntry(open.id, (e) => ({ ...e, tags: [...e.tags, 'tag'] }), 'add tag')}
              >
                Add
              </Button>
            </div>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {open.tags.map((tag, index) => (
                <span key={`${tag}-${index}`} className="row" style={{ gap: 2 }}>
                  <Badge tone="accent">
                    <InlineEdit
                      value={tag}
                      onCommit={(next) =>
                        updateEntry(
                          open.id,
                          (e) => ({
                            ...e,
                            tags: next ? e.tags.map((t, i) => (i === index ? next : t)) : e.tags.filter((_, i) => i !== index),
                          }),
                          'edit tag',
                        )
                      }
                      ariaLabel="Tag"
                    />
                  </Badge>
                  <IconButton
                    title="Remove tag"
                    tone="danger"
                    onClick={() =>
                      updateEntry(open.id, (e) => ({ ...e, tags: e.tags.filter((_, i) => i !== index) }), 'delete tag')
                    }
                  >
                    <Icon name="x" size={10} />
                  </IconButton>
                </span>
              ))}
            </div>
          </div>
        </Drawer>
      ) : null}

      <Card variant="inset">
        <CardFooter>
          <span>
            {stats.total} entries · {stats.words.toLocaleString()} words
          </span>
          <span className="tnum">
            {stats.wins} wins · {stats.blockers} blockers
          </span>
        </CardFooter>
      </Card>
    </div>
  )
}
