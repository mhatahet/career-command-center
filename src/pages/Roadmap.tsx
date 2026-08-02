/* ============================================================================
   Career Roadmap
   ----------------------------------------------------------------------------
   The 24 months as a timeline rather than a tree. Answers "when does what
   happen, what does it depend on, and what does each month actually produce" —
   the Learning Path answers "what do I do today".
   ========================================================================= */

import { useMemo, useState } from 'react'

import { BarChart, StackedBarChart, seriesColor } from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  HelpDot,
  InlineEdit,
  ProgressBar,
  Ring,
  Segmented,
  Stat,
  Tooltip,
} from '../components/ui'
import { formatMonthShort, formatMonthYear } from '../lib/dates'
import { chapterProgress } from '../lib/derive'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import type { Chapter, ID } from '../lib/types'

type View = 'timeline' | 'table' | 'load'

const ROI_TONE = { 'very-high': 'success', high: 'accent', medium: 'neutral', low: 'neutral' } as const

export function Roadmap() {
  const { data, derived, update } = useStore()
  const [view, setView] = useState<View>('timeline')
  const [quarterFilter, setQuarterFilter] = useState<number | 'all'>('all')

  const chapters = useMemo(
    () =>
      data.roadmap.chapters.filter((c) => quarterFilter === 'all' || c.quarter === quarterFilter),
    [data.roadmap.chapters, quarterFilter],
  )

  const updateChapter = (chapterId: ID, producer: (chapter: Chapter) => Chapter, label: string) => {
    update(
      (draft) => ({
        ...draft,
        roadmap: {
          ...draft.roadmap,
          chapters: draft.roadmap.chapters.map((c) => (c.id === chapterId ? producer(c) : c)),
        },
      }),
      ['roadmap'],
      label,
    )
  }

  /* --------------------------------------------------------- aggregates -- */

  const quarters = useMemo(() => {
    const map = new Map<number, { chapters: Chapter[]; pct: number; hours: number }>()
    for (const chapter of data.roadmap.chapters) {
      const bucket = map.get(chapter.quarter) ?? { chapters: [], pct: 0, hours: 0 }
      bucket.chapters.push(chapter)
      map.set(chapter.quarter, bucket)
    }
    for (const [, bucket] of map) {
      bucket.pct = bucket.chapters.reduce((sum, c) => sum + chapterProgress(c).pct, 0) / bucket.chapters.length
      bucket.hours = bucket.chapters.reduce((sum, c) => sum + c.estimatedHours, 0)
    }
    return [...map.entries()].sort(([a], [b]) => a - b)
  }, [data.roadmap.chapters])

  /** Estimated hours per month, so the plan's load is visible before it hurts. */
  const loadByMonth = useMemo(
    () =>
      data.roadmap.chapters.map((chapter) => ({
        label: `M${chapter.month}`,
        value: chapter.estimatedHours,
        sublabel: chapter.title,
        color:
          chapter.month === derived.timeline.currentMonth
            ? 'var(--accent)'
            : chapter.estimatedHours > data.profile.weeklyHourTarget * 4.3
              ? 'var(--warning)'
              : 'var(--viz-2)',
      })),
    [data.roadmap.chapters, derived.timeline.currentMonth, data.profile.weeklyHourTarget],
  )

  const monthlyCapacity = Math.round(data.profile.weeklyHourTarget * 4.345)

  /** Hours per month split by competency category. */
  const loadByCategory = useMemo(() => {
    const categoryOf = new Map(data.skills.map((s) => [s.id, s.category]))
    const categories = ['analytical', 'craft', 'strategic', 'technical', 'human'] as const

    return data.roadmap.chapters.map((chapter) => {
      const values: Record<string, number> = {}
      for (const mission of chapter.missions) {
        for (const task of mission.tasks) {
          if (task.skillIds.length === 0) {
            values.other = (values.other ?? 0) + task.estimatedHours
            continue
          }
          const per = task.estimatedHours / task.skillIds.length
          for (const skillId of task.skillIds) {
            const category = categoryOf.get(skillId) ?? 'other'
            values[category] = (values[category] ?? 0) + per
          }
        }
      }
      void categories
      return { label: `M${chapter.month}`, values }
    })
  }, [data.roadmap.chapters, data.skills])

  const categoryKeys = [
    { key: 'analytical', label: 'Analytical', color: seriesColor(1) },
    { key: 'craft', label: 'Craft', color: seriesColor(0) },
    { key: 'strategic', label: 'Strategic', color: seriesColor(5) },
    { key: 'technical', label: 'Technical', color: seriesColor(6) },
    { key: 'human', label: 'Human', color: seriesColor(2) },
    { key: 'other', label: 'Unassigned', color: 'var(--text-quaternary)' },
  ]

  const totalHours = data.roadmap.chapters.reduce((sum, c) => sum + c.estimatedHours, 0)

  return (
    <div className="page">
      <PageHeader
        title="Career Roadmap"
        lede={`Twenty-four months, ${data.roadmap.chapters.length} chapters, ${Math.round(totalHours)} estimated hours. Each month has one focus and one measurable output, taken directly from the audit — so a month is either delivered or it is not.`}
        actions={
          <>
            <Segmented
              value={quarterFilter === 'all' ? 'all' : String(quarterFilter)}
              onChange={(next) => setQuarterFilter(next === 'all' ? 'all' : Number(next))}
              options={[
                { value: 'all', label: 'All' },
                ...quarters.map(([quarter]) => ({ value: String(quarter), label: `Q${quarter}` })),
              ]}
            />
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'timeline', label: 'Timeline' },
                { value: 'table', label: 'Table' },
                { value: 'load', label: 'Load' },
              ]}
            />
          </>
        }
      />

      {/* Phase strip */}
      <Card variant="inset">
        <CardBody className="card__body--tight">
          <div className="col" style={{ gap: 'var(--space-3)' }}>
            <div className="row row--between">
              <span className="section-title">
                Programme phases
                <HelpDot>
                  The audit's sequence is deliberate: analytics before portfolio, portfolio before
                  writing, writing before interviews, interviews before applications. Working out of
                  order is the most common way this plan fails.
                </HelpDot>
              </span>
              <span className="text-2xs text-quaternary">
                Month {derived.timeline.currentMonth} · {derived.timeline.daysRemaining} days remaining
              </span>
            </div>

            {/* Proportional phase bar */}
            <div className="row" style={{ gap: 3, height: 32 }}>
              {data.roadmap.phases.map((phase) => {
                const span = phase.months[1] - phase.months[0] + 1
                const inPhase = data.roadmap.chapters.filter(
                  (c) => c.month >= phase.months[0] && c.month <= phase.months[1],
                )
                const pct =
                  inPhase.length > 0
                    ? inPhase.reduce((sum, c) => sum + chapterProgress(c).pct, 0) / inPhase.length
                    : 0
                const active =
                  derived.timeline.currentMonth >= phase.months[0] &&
                  derived.timeline.currentMonth <= phase.months[1]

                return (
                  <Tooltip
                    key={phase.id}
                    title={`${phase.label} — months ${phase.months[0]}–${phase.months[1]}`}
                    content={`${phase.theme}. ${Math.round(pct)}% complete.`}
                  >
                    <div
                      style={{
                        flex: span,
                        height: '100%',
                        borderRadius: 'var(--radius-sm)',
                        background: `var(--${phase.colorToken})`,
                        opacity: active ? 1 : 0.42,
                        position: 'relative',
                        overflow: 'hidden',
                        border: active ? '1px solid var(--text-primary)' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 8,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.35)',
                          left: `${pct}%`,
                        }}
                      />
                      <span
                        className="text-2xs truncate"
                        style={{ color: '#fff', fontWeight: 'var(--weight-semibold)', position: 'relative', zIndex: 1 }}
                      >
                        {phase.label}
                      </span>
                    </div>
                  </Tooltip>
                )
              })}
            </div>

            <div className="row row--wrap" style={{ gap: 'var(--space-4)' }}>
              {quarters.map(([quarter, bucket]) => (
                <div key={quarter} className="row" style={{ gap: 'var(--space-2)' }}>
                  <Ring
                    value={bucket.pct}
                    size={34}
                    thickness={3.5}
                    display={Math.round(bucket.pct)}
                    valueSize={9}
                    tone={bucket.pct >= 100 ? 'success' : undefined}
                  />
                  <div className="col" style={{ gap: 0 }}>
                    <span className="text-xs" style={{ fontWeight: 'var(--weight-medium)' }}>
                      Q{quarter}
                    </span>
                    <span className="text-2xs tnum text-quaternary">{Math.round(bucket.hours)}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Throughput commitments */}
      <Card>
        <CardHeader
          title="Throughput commitments"
          subtitle="These run across all 24 months, alongside every chapter"
          help="From Part 4 of the audit. These are the commitments that compound — and the ones most often quietly dropped when a month gets busy."
        />
        <CardBody className="card__body--none">
          <div className="grid grid--auto" style={{ gap: 0 }}>
            {data.roadmap.throughput.map((item, index) => (
              <div
                key={item.id}
                style={{
                  padding: 'var(--space-4)',
                  borderLeft: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <div className="col" style={{ gap: 5 }}>
                  <div className="row" style={{ gap: 'var(--space-2)' }}>
                    <Badge tone="accent">{item.cadence}</Badge>
                  </div>
                  <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                    {item.label}
                  </span>
                  <span className="text-2xs text-tertiary" style={{ lineHeight: 'var(--leading-snug)' }}>
                    {item.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ------------------------------------------------------- timeline -- */}
      {view === 'timeline' ? (
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          {chapters.map((chapter) => {
            const progress = chapterProgress(chapter)
            const isCurrent = chapter.month === derived.timeline.currentMonth
            const isPast = chapter.month < derived.timeline.currentMonth
            const complete = progress.pct >= 100
            const overCapacity = chapter.estimatedHours > monthlyCapacity

            return (
              <Card key={chapter.id} variant={isCurrent ? 'accent' : 'default'}>
                <CardBody>
                  <div className="row" style={{ gap: 'var(--space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Month marker */}
                    <div className="col shrink-0" style={{ alignItems: 'center', gap: 6, width: 66 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 'var(--radius-lg)',
                          background: complete
                            ? 'var(--success-subtle)'
                            : isCurrent
                              ? 'var(--accent)'
                              : 'var(--bg-inset)',
                          border: `1px solid ${complete ? 'var(--success-border)' : isCurrent ? 'var(--accent)' : 'var(--border-default)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isCurrent ? '#fff' : complete ? 'var(--success-text)' : 'var(--text-secondary)',
                        }}
                      >
                        <span className="text-2xs" style={{ opacity: 0.8, lineHeight: 1 }}>
                          M
                        </span>
                        <span
                          className="tnum"
                          style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', lineHeight: 1.1 }}
                        >
                          {chapter.month}
                        </span>
                      </div>
                      <span className="text-2xs text-quaternary" style={{ textAlign: 'center' }}>
                        {formatMonthShort(chapter.startDate)}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="col grow" style={{ gap: 'var(--space-3)', minWidth: 240 }}>
                      <div className="row row--between row--wrap" style={{ gap: 'var(--space-2)' }}>
                        <div className="col" style={{ gap: 3, minWidth: 0 }}>
                          <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' }}>
                              <InlineEdit
                                value={chapter.title}
                                onCommit={(next) => updateChapter(chapter.id, (c) => ({ ...c, title: next }), 'rename chapter')}
                                ariaLabel="Chapter title"
                              />
                            </span>
                            {isCurrent ? <Badge tone="accent" dot>Current</Badge> : null}
                            {complete ? <Badge tone="success">Complete</Badge> : null}
                            {isPast && !complete ? <Badge tone="warning">Behind</Badge> : null}
                            <Badge tone={ROI_TONE[chapter.expectedRoi]}>
                              ROI {chapter.expectedRoi.replace('-', ' ')}
                            </Badge>
                          </div>
                          <span className="text-xs text-tertiary">
                            Focus: {chapter.focus} · Q{chapter.quarter} · {chapter.estimatedHours}h estimated
                            {overCapacity ? (
                              <Tooltip
                                content={`This month plans ${chapter.estimatedHours}h against your ${monthlyCapacity}h monthly capacity at ${data.profile.weeklyHourTarget}h/week. Either raise the target or plan to carry work forward.`}
                              >
                                <span style={{ color: 'var(--warning-text)' }}> · over capacity</span>
                              </Tooltip>
                            ) : null}
                          </span>
                        </div>

                        <div className="row shrink-0" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                          <div className="col" style={{ width: 120, gap: 4 }}>
                            <div className="row row--between text-2xs">
                              <span className="text-quaternary">
                                {progress.done}/{progress.total}
                              </span>
                              <span className="tnum text-quaternary">{Math.round(progress.pct)}%</span>
                            </div>
                            <ProgressBar value={progress.pct} size="sm" tone={complete ? 'success' : undefined} />
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/learning-path#${chapter.id}`)}>
                            Open
                          </Button>
                        </div>
                      </div>

                      {/* Measurable output */}
                      <div
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          background: 'var(--bg-inset)',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: '2px solid var(--accent)',
                        }}
                      >
                        <span className="text-2xs text-quaternary" style={{ display: 'block' }}>
                          Measurable output
                        </span>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          <InlineEdit
                            value={chapter.measurableOutput}
                            onCommit={(next) =>
                              updateChapter(chapter.id, (c) => ({ ...c, measurableOutput: next }), 'edit output')
                            }
                            ariaLabel="Measurable output"
                          />
                        </span>
                      </div>

                      {/* Missions + commitments */}
                      <div className="grid grid--auto" style={{ gap: 'var(--space-4)' }}>
                        <div className="col" style={{ gap: 5 }}>
                          <span className="section-title">Missions</span>
                          {chapter.missions.map((mission) => (
                            <span key={mission.id} className="text-xs text-secondary truncate">
                              · {mission.title}
                            </span>
                          ))}
                        </div>

                        <div className="col" style={{ gap: 5 }}>
                          <span className="section-title">Target outcomes</span>
                          {chapter.targetOutcomes.map((outcome) => (
                            <span key={outcome} className="text-xs text-secondary">
                              ◆ {outcome}
                            </span>
                          ))}
                        </div>

                        <div className="col" style={{ gap: 5 }}>
                          <span className="section-title">Commitments</span>
                          <span className="text-xs text-secondary">
                            <strong className="text-quaternary">Writing: </strong>
                            {chapter.commitments.writing}
                          </span>
                          <span className="text-xs text-secondary">
                            <strong className="text-quaternary">Applications: </strong>
                            {chapter.commitments.applications}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : null}

      {/* ---------------------------------------------------------- table -- */}
      {view === 'table' ? (
        <Card>
          <CardHeader
            title="All chapters"
            subtitle="Every month, its output, and what it depends on"
            help="Click any row to open it in the Learning Path."
          />
          <CardBody className="card__body--none">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="num">M</th>
                    <th>Chapter</th>
                    <th>Focus</th>
                    <th>Measurable output</th>
                    <th className="num">Q</th>
                    <th className="num">Hours</th>
                    <th className="num">Diff.</th>
                    <th>ROI</th>
                    <th style={{ width: 110 }}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {chapters.map((chapter) => {
                    const progress = chapterProgress(chapter)
                    const isCurrent = chapter.month === derived.timeline.currentMonth
                    return (
                      <tr
                        key={chapter.id}
                        style={{
                          cursor: 'pointer',
                          background: isCurrent ? 'var(--bg-selected)' : undefined,
                        }}
                        onClick={() => navigate(`/learning-path#${chapter.id}`)}
                      >
                        <td className="num strong">{chapter.month}</td>
                        <td className="strong">{chapter.title}</td>
                        <td>{chapter.focus}</td>
                        <td style={{ maxWidth: 320 }}>{chapter.measurableOutput}</td>
                        <td className="num">{chapter.quarter}</td>
                        <td className="num">{chapter.estimatedHours}</td>
                        <td className="num">{chapter.difficulty}</td>
                        <td>
                          <Badge tone={ROI_TONE[chapter.expectedRoi]}>{chapter.expectedRoi.replace('-', ' ')}</Badge>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <ProgressBar value={progress.pct} size="sm" tone={progress.pct >= 100 ? 'success' : undefined} />
                            <span className="text-2xs tnum text-quaternary shrink-0">{Math.round(progress.pct)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
          <CardFooter>
            <span>{chapters.length} chapters</span>
            <span className="tnum">{Math.round(chapters.reduce((sum, c) => sum + c.estimatedHours, 0))}h total</span>
          </CardFooter>
        </Card>
      ) : null}

      {/* ----------------------------------------------------------- load -- */}
      {view === 'load' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="grid grid--auto-sm">
            <Card>
              <CardBody className="card__body--tight">
                <Stat
                  label="Total planned hours"
                  value={Math.round(totalHours)}
                  unit="h"
                  size="lg"
                  help="Sum of every task estimate across all 24 months. The audit's 80/20 table totals roughly 690 hours of one-off work, so a fuller plan is expected."
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody className="card__body--tight">
                <Stat
                  label="Monthly capacity"
                  value={monthlyCapacity}
                  unit="h"
                  size="lg"
                  meta={`at ${data.profile.weeklyHourTarget}h/week`}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody className="card__body--tight">
                <Stat
                  label="Months over capacity"
                  value={data.roadmap.chapters.filter((c) => c.estimatedHours > monthlyCapacity).length}
                  size="lg"
                  tone={
                    data.roadmap.chapters.filter((c) => c.estimatedHours > monthlyCapacity).length > 6
                      ? 'warning'
                      : 'neutral'
                  }
                  help="Months planning more hours than your stated capacity. A few is fine — the work carries forward. Many means the plan needs cutting or the target needs raising."
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody className="card__body--tight">
                <Stat
                  label="Required weekly pace"
                  value={(totalHours / (data.profile.horizonMonths * 4.345)).toFixed(1)}
                  unit="h/wk"
                  size="lg"
                  tone={totalHours / (data.profile.horizonMonths * 4.345) > data.profile.weeklyHourTarget ? 'warning' : 'success'}
                  meta="to finish the whole plan in 24 months"
                />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Planned hours by month"
              subtitle={`Dashed line is your ${monthlyCapacity}h monthly capacity`}
              help="Amber bars exceed capacity. The first months are deliberately dense — SQL and analytics are the highest-ROI work in the whole programme and everything downstream depends on them."
            />
            <CardBody>
              <BarChart data={loadByMonth} height={220} target={monthlyCapacity} formatValue={(v) => `${Math.round(v)}h`} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Hours by competency category"
              subtitle="What each month actually develops"
              help="Analytical work dominates the early months by design — that is where the must-fix gaps are. Later months shift toward craft and strategic work as the portfolio and interview phases arrive."
            />
            <CardBody>
              <StackedBarChart data={loadByCategory} keys={categoryKeys} height={240} formatValue={(v) => `${Math.round(v)}h`} />
              <div style={{ marginTop: 'var(--space-4)' }}>
                <div className="chart-legend">
                  {categoryKeys.map((key) => (
                    <span key={key.key} className="chart-legend__item">
                      <span className="chart-legend__swatch" style={{ background: key.color }} />
                      {key.label}
                    </span>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Compensation progression" subtitle="Part 9 of the audit — illustrative" help="Actual compensation varies significantly by company, level, equity, location and market conditions. This is context for target-setting, not a forecast." />
            <CardBody className="card__body--none">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Region</th>
                      <th className="num">Today</th>
                      <th className="num">5-year target</th>
                      <th style={{ width: 220 }}>Range</th>
                      <th className="num">Uplift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.applications.compensation.map((row) => {
                      const maxAll = Math.max(...data.applications.compensation.map((r) => r.targetHigh))
                      const uplift = Math.round(
                        ((row.targetLow + row.targetHigh) / (row.todayLow + row.todayHigh) - 1) * 100,
                      )
                      return (
                        <tr key={row.region}>
                          <td className="strong">{row.region}</td>
                          <td className="num">
                            ${Math.round(row.todayLow / 1000)}k–${Math.round(row.todayHigh / 1000)}k
                          </td>
                          <td className="num">
                            ${Math.round(row.targetLow / 1000)}k–${Math.round(row.targetHigh / 1000)}k
                          </td>
                          <td>
                            <div style={{ position: 'relative', height: 8, background: 'var(--track)', borderRadius: 999 }}>
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${(row.todayLow / maxAll) * 100}%`,
                                  width: `${((row.todayHigh - row.todayLow) / maxAll) * 100}%`,
                                  top: 0,
                                  bottom: 0,
                                  background: 'var(--text-quaternary)',
                                  borderRadius: 999,
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${(row.targetLow / maxAll) * 100}%`,
                                  width: `${((row.targetHigh - row.targetLow) / maxAll) * 100}%`,
                                  top: 0,
                                  bottom: 0,
                                  background: 'var(--accent)',
                                  borderRadius: 999,
                                  opacity: 0.85,
                                }}
                              />
                            </div>
                          </td>
                          <td className="num">
                            <span style={{ color: 'var(--success-text)' }}>+{uplift}%</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
            <CardFooter>
              <div className="chart-legend">
                <span className="chart-legend__item">
                  <span className="chart-legend__swatch" style={{ background: 'var(--text-quaternary)' }} />
                  Today
                </span>
                <span className="chart-legend__item">
                  <span className="chart-legend__swatch" style={{ background: 'var(--accent)' }} />
                  5-year target
                </span>
              </div>
              <span>Programme ends {formatMonthYear(derived.timeline.endDate)}</span>
            </CardFooter>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
