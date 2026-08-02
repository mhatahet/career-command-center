/* ============================================================================
   Highest Leverage — the 80/20 page
   ----------------------------------------------------------------------------
   Part 11 of the audit, verbatim and sortable. Every activity ranked by career
   impact, hours, difficulty, time-to-results and long-term ROI — plus the
   explicit ignore list, the time budgets, the one-year sequence, and the three
   mistakes. This is the page to open when a week has five spare hours and no
   obvious answer about where they should go.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { BarChart, DonutChart, seriesColor } from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  HelpDot,
  Icon,
  ProgressBar,
  Segmented,
  Stat,
  Tooltip,
} from '../components/ui'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import type { LeverageAction, TaskArea } from '../lib/types'

const ROI_TONE = { 'Very High': 'success', High: 'accent', Medium: 'neutral', Low: 'neutral' } as const

const AREA_ROUTE: Partial<Record<TaskArea, string>> = {
  portfolio: '/portfolio',
  analytics: '/skills',
  interview: '/interview-prep',
  writing: '/writing',
  networking: '/networking',
  ai: '/ai-projects',
  admin: '/skills',
  applications: '/applications',
  sql: '/skills',
  linkedin: '/linkedin',
  reading: '/reading',
  course: '/courses',
  experimentation: '/skills',
}

type Sort = 'leverage' | 'impact' | 'quick-wins' | 'hardest' | 'longest' | 'fastest-results'

const SORT_LABEL: Record<Sort, string> = {
  leverage: 'Highest ROI',
  impact: 'Highest career impact',
  'quick-wins': 'Quick wins',
  hardest: 'Hardest',
  longest: 'Longest',
  'fastest-results': 'Fastest results',
}

export function Leverage() {
  const { data, derived } = useStore()
  const [sort, setSort] = useState<Sort>('leverage')
  const [budget, setBudget] = useState<number>(data.profile.weeklyHourTarget)

  const { actions, antiPatterns, timeBudgets, oneYearSequence, mistakes, startDoing, stopDoing, ifIWereResponsible } =
    data.leverage

  /** Impact per hour is the definition of leverage. Ongoing work scores highest. */
  const withLeverage = useMemo(
    () =>
      actions.map((action) => ({
        ...action,
        // Ongoing items have no fixed hour cost, so they get the top score by
        // construction — which is correct, and is why the audit lists them.
        leverage: action.isOngoing ? Infinity : action.impact / Math.max(1, action.hours ?? 1),
      })),
    [actions],
  )

  const sorted = useMemo(() => {
    const rows = [...withLeverage]
    switch (sort) {
      case 'impact':
        return rows.sort((a, b) => b.impact - a.impact || a.difficulty - b.difficulty)
      case 'quick-wins':
        // Low hours, low difficulty, decent impact.
        return rows.sort(
          (a, b) =>
            (a.hours ?? 0) + a.difficulty * 12 - ((b.hours ?? 0) + b.difficulty * 12) || b.impact - a.impact,
        )
      case 'hardest':
        return rows.sort((a, b) => b.difficulty - a.difficulty || (b.hours ?? 0) - (a.hours ?? 0))
      case 'longest':
        return rows.sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0))
      case 'fastest-results':
        return rows.sort((a, b) => a.timeToResultsMonths - b.timeToResultsMonths || b.impact - a.impact)
      case 'leverage':
      default:
        return rows.sort((a, b) => b.leverage - a.leverage || b.impact - a.impact)
    }
  }, [sort, withLeverage])

  /** The nearest authored time budget at or below the chosen hours. */
  const activeBudget = useMemo(() => {
    const eligible = [...timeBudgets].sort((a, b) => a.hoursPerWeek - b.hoursPerWeek)
    let chosen = eligible[0]
    for (const candidate of eligible) if (candidate.hoursPerWeek <= budget) chosen = candidate
    return chosen
  }, [budget, timeBudgets])

  const totals = useMemo(() => {
    const fixed = actions.filter((a) => !a.isOngoing)
    return {
      hours: fixed.reduce((sum, a) => sum + (a.hours ?? 0), 0),
      ongoing: actions.filter((a) => a.isOngoing).length,
      veryHigh: actions.filter((a) => a.longTermRoi === 'Very High').length,
      avgImpact: actions.length > 0 ? actions.reduce((sum, a) => sum + a.impact, 0) / actions.length : 0,
    }
  }, [actions])

  /** How the chosen budget divides across areas. */
  const allocationMix = useMemo(() => {
    const map = new Map<string, number>()
    for (const allocation of activeBudget?.allocations ?? []) {
      map.set(allocation.area, (map.get(allocation.area) ?? 0) + (allocation.hours ?? 0))
    }
    return [...map.entries()]
      .map(([area, value], i) => ({ label: area, value, color: seriesColor(i) }))
      .sort((a, b) => b.value - a.value)
  }, [activeBudget])

  /** What the user's actual hours look like against the recommended allocation. */
  const actualVsPlan = useMemo(() => {
    const totalActual = derived.hours.byArea.reduce((sum, row) => sum + row.hours, 0)
    const planTotal = allocationMix.reduce((sum, row) => sum + row.value, 0)
    return allocationMix.map((row) => {
      const actual = derived.hours.byArea.find((a) => a.area === row.label)?.hours ?? 0
      return {
        area: row.label,
        planShare: planTotal > 0 ? (row.value / planTotal) * 100 : 0,
        actualShare: totalActual > 0 ? (actual / totalActual) * 100 : 0,
        color: row.color,
      }
    })
  }, [allocationMix, derived.hours.byArea])

  return (
    <div className="page">
      <PageHeader
        title="Highest Leverage"
        lede="Part 11 of the audit, sortable. Seven actions produce roughly eighty per cent of the result — and five explicitly produce none. When a week has spare hours and no obvious answer, this is the page that decides."
        actions={
          <Segmented
            value={sort}
            onChange={setSort}
            options={(Object.keys(SORT_LABEL) as Sort[]).map((s) => ({ value: s, label: SORT_LABEL[s] }))}
          />
        }
      />

      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="High-leverage actions"
              value={actions.length}
              size="lg"
              meta={`${totals.ongoing} ongoing · ${totals.veryHigh} very high ROI`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Total fixed hours"
              value={Math.round(totals.hours)}
              unit="h"
              size="lg"
              help="Sum of the one-off actions in the audit's table. The two ongoing items — quantifying impact and strategic networking — carry no fixed hour cost, which is what makes them so efficient."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Average career impact"
              value={totals.avgImpact.toFixed(1)}
              unit="/10"
              size="lg"
              tone="accent"
              help="These are the top 20% of activities by design. Nothing on this list scores below 9."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="At your current pace"
              value={
                derived.hours.weeklyVelocity > 0
                  ? Math.round(totals.hours / derived.hours.weeklyVelocity)
                  : '—'
              }
              unit={derived.hours.weeklyVelocity > 0 ? ' wk' : undefined}
              size="lg"
              meta={`${derived.hours.weeklyVelocity}h/week`}
              help="Weeks to complete every fixed-hour action on this list at your recent velocity. Ongoing work runs alongside."
            />
          </CardBody>
        </Card>
      </div>

      {/* The table */}
      <Card>
        <CardHeader
          title="Top 20% of actions producing ~80% of results"
          subtitle={`Sorted by ${SORT_LABEL[sort].toLowerCase()}`}
          help="Impact, hours, difficulty, results-visible and long-term ROI are the audit's own columns. The Leverage column is impact per hour — the ranking that actually tells you what to do next."
        />
        <CardBody className="card__body--none">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }}>Action</th>
                  <th className="num">
                    Impact
                    <HelpDot>Career impact, 1–10, straight from the audit's table.</HelpDot>
                  </th>
                  <th className="num">Hours</th>
                  <th className="num">
                    Difficulty
                    <HelpDot>1–10. High difficulty is not a reason to skip an item — it is a reason to schedule it properly.</HelpDot>
                  </th>
                  <th>Results visible</th>
                  <th>Long-term ROI</th>
                  <th className="num">
                    Leverage
                    <HelpDot>Impact per hour. Ongoing items score highest because they cost no incremental time.</HelpDot>
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((action) => (
                  <tr key={action.id}>
                    <td className="strong">
                      <div className="col" style={{ gap: 3 }}>
                        <span>{action.action}</span>
                        <span className="text-2xs text-tertiary" style={{ fontWeight: 'var(--weight-normal)', maxWidth: '62ch' }}>
                          {action.rationale}
                        </span>
                      </div>
                    </td>
                    <td className="num">
                      <Badge tone={action.impact >= 10 ? 'success' : 'accent'}>{action.impact}</Badge>
                    </td>
                    <td className="num">{action.isOngoing ? <span className="text-quaternary">ongoing</span> : action.hours}</td>
                    <td className="num">
                      <Tooltip content={`${action.difficulty} of 10`}>
                        <span className="text-2xs">
                          {'▮'.repeat(Math.round(action.difficulty / 2))}
                          <span style={{ opacity: 0.25 }}>{'▮'.repeat(5 - Math.round(action.difficulty / 2))}</span>
                        </span>
                      </Tooltip>
                    </td>
                    <td className="text-xs">{action.timeToResults}</td>
                    <td>
                      <Badge tone={ROI_TONE[action.longTermRoi]}>{action.longTermRoi}</Badge>
                    </td>
                    <td className="num">
                      {action.isOngoing ? (
                        <Tooltip content="No fixed hour cost — the work is already happening, it just is not written down.">
                          <span style={{ color: 'var(--success-text)', fontWeight: 'var(--weight-semibold)' }}>∞</span>
                        </Tooltip>
                      ) : (
                        (action.leverage as number).toFixed(3)
                      )}
                    </td>
                    <td>
                      {AREA_ROUTE[action.category] ? (
                        <Button variant="ghost" size="sm" onClick={() => navigate(AREA_ROUTE[action.category]!)}>
                          Open
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
        <CardFooter>
          <span>{sorted.length} actions</span>
          <span className="tnum">{Math.round(totals.hours)}h of fixed work plus ongoing commitments</span>
        </CardFooter>
      </Card>

      {/* Impact vs effort */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Impact against effort"
            subtitle="Where each action sits"
            help="Top-left is the sweet spot: high impact, low hours. Nothing here is low impact — the whole list is the top 20% — so the axis that matters is effort."
          />
          <CardBody>
            <ImpactEffortPlot actions={withLeverage} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Hours by action" help="Where the 690 hours of one-off work actually goes." />
          <CardBody>
            <BarChart
              data={actions
                .filter((a) => !a.isOngoing)
                .sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0))
                .map((a, i) => ({
                  label: a.action.length > 34 ? `${a.action.slice(0, 32)}…` : a.action,
                  value: a.hours ?? 0,
                  color: seriesColor(i),
                }))}
              horizontal
              formatValue={(v) => `${Math.round(v)}h`}
            />
          </CardBody>
        </Card>
      </div>

      {/* Time budget */}
      <Card>
        <CardHeader
          title="If you have N hours this week"
          subtitle="The audit's own allocations"
          help="Choose the honest number, not the aspirational one. A five-hour week executed beats a twenty-hour week planned."
          actions={
            <Segmented
              value={String(budget)}
              onChange={(next) => setBudget(Number(next))}
              options={timeBudgets.map((b) => ({ value: String(b.hoursPerWeek), label: `${b.hoursPerWeek}h` }))}
            />
          }
        />
        <CardBody>
          <div className="grid grid--auto-lg">
            <div className="col span-2" style={{ gap: 'var(--space-3)' }}>
              <span className="section-title">
                {activeBudget?.hoursPerWeek}h/week allocation
                <span className="text-quaternary" style={{ marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                  · {activeBudget?.allocations.length} commitments
                </span>
              </span>
              {activeBudget?.allocations.map((allocation, index) => (
                <div key={`${allocation.label}-${index}`} className="col" style={{ gap: 4 }}>
                  <div className="row row--between">
                    <span className="row text-sm" style={{ gap: 6, minWidth: 0 }}>
                      <span
                        className="chart-legend__swatch"
                        style={{
                          background: seriesColor(index),
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          flexShrink: 0,
                        }}
                      />
                      <span className="truncate text-secondary">{allocation.label}</span>
                    </span>
                    <span className="text-xs tnum text-tertiary shrink-0">
                      {allocation.hours}h
                      {AREA_ROUTE[allocation.area] ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(AREA_ROUTE[allocation.area]!)}
                          className="shrink-0"
                        >
                          <Icon name="arrowRight" size={11} />
                        </Button>
                      ) : null}
                    </span>
                  </div>
                  <ProgressBar
                    value={
                      activeBudget.hoursPerWeek > 0
                        ? ((allocation.hours ?? 0) / activeBudget.hoursPerWeek) * 100
                        : 0
                    }
                    size="sm"
                  />
                </div>
              ))}
            </div>

            <div className="col" style={{ gap: 'var(--space-4)' }}>
              <div className="col" style={{ gap: 'var(--space-2)', alignItems: 'center' }}>
                <DonutChart
                  data={allocationMix}
                  size={144}
                  thickness={20}
                  centerValue={activeBudget?.hoursPerWeek ?? 0}
                  centerLabel="h/week"
                />
              </div>

              <hr className="divider" />

              <div className="col" style={{ gap: 'var(--space-2)' }}>
                <span className="section-title">
                  Plan vs your actual mix
                  <HelpDot>
                    Recommended share against where your logged hours have actually gone. A large mismatch is
                    the most likely explanation for a stalled readiness score.
                  </HelpDot>
                </span>
                {actualVsPlan.map((row) => (
                  <div key={row.area} className="col" style={{ gap: 3 }}>
                    <div className="row row--between text-2xs">
                      <span className="text-secondary">{row.area}</span>
                      <span className="tnum text-quaternary">
                        plan {row.planShare.toFixed(0)}% · actual {row.actualShare.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ position: 'relative', height: 5, background: 'var(--track)', borderRadius: 999 }}>
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: `${Math.min(100, row.actualShare)}%`,
                          background: row.color,
                          borderRadius: 999,
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          left: `${Math.min(100, row.planShare)}%`,
                          top: -2,
                          bottom: -2,
                          width: 2,
                          background: 'var(--text-secondary)',
                          borderRadius: 1,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Anti-patterns */}
      <Card>
        <CardHeader
          title="Low-ROI activities to ignore"
          subtitle="The audit's explicit ignore list"
          help="Time is zero-sum. Every hour spent here is an hour not spent on the table above — which is what makes these actively harmful rather than merely neutral."
        />
        <CardBody className="card__body--none">
          <div className="col">
            {antiPatterns.map((pattern, index) => (
              <div
                key={pattern.id}
                style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }}>
                    <Icon name="x" size={15} />
                  </span>
                  <div className="col" style={{ gap: 3 }}>
                    <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                      {pattern.action}
                    </span>
                    <span className="text-xs text-tertiary" style={{ lineHeight: 'var(--leading-normal)' }}>
                      {pattern.why}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Sequence + mistakes */}
      <div className="grid grid--auto-lg">
        <Card>
          <CardHeader
            title="One-year sequence"
            subtitle="Order is the instruction"
            help="Working out of order is the most common way this plan fails. Analytics before portfolio because the portfolio is more credible with data in it; portfolio before applications because applications without evidence waste referrals."
          />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-4)' }}>
              {oneYearSequence.map((step) => {
                const isCurrent = derived.timeline.currentMonth <= step.step * 2
                return (
                  <div key={step.step} className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 'var(--radius-full)',
                        background: isCurrent ? 'var(--accent)' : 'var(--bg-inset)',
                        border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-default)'}`,
                        color: isCurrent ? '#fff' : 'var(--text-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--text-2xs)',
                        fontWeight: 'var(--weight-bold)',
                        flexShrink: 0,
                      }}
                    >
                      {step.step}
                    </span>
                    <div className="col" style={{ gap: 2 }}>
                      <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                        {step.label}
                      </span>
                      <span className="text-xs text-tertiary">{step.detail}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="The three biggest mistakes"
            subtitle="Worth rereading monthly"
            help="These are not generic warnings — each one maps to a specific finding in your own audit."
          />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-5)' }}>
              {mistakes.map((mistake, index) => (
                <div key={mistake.title} className="col" style={{ gap: 5 }}>
                  <div className="row" style={{ gap: 'var(--space-2)' }}>
                    <Badge tone="danger">{index + 1}</Badge>
                    <span className="text-sm" style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                      {mistake.title}
                    </span>
                  </div>
                  <p className="text-xs text-secondary" style={{ lineHeight: 'var(--leading-normal)', paddingLeft: 28 }}>
                    {mistake.detail}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Start / stop */}
      <div className="grid grid--auto-lg">
        <Card>
          <CardHeader title="Start doing" subtitle="Top 10 actions to begin immediately" />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-2)' }}>
              {startDoing.map((item, index) => (
                <div key={item} className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                  <span className="text-2xs tnum text-quaternary" style={{ width: 16, textAlign: 'right', paddingTop: 2 }}>
                    {index + 1}
                  </span>
                  <span style={{ color: 'var(--success)', fontSize: 11, paddingTop: 2 }}>✓</span>
                  <span className="text-sm text-secondary">{item}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stop doing" subtitle="Top 10 actions to stop" />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-2)' }}>
              {stopDoing.map((item, index) => (
                <div key={item} className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                  <span className="text-2xs tnum text-quaternary" style={{ width: 16, textAlign: 'right', paddingTop: 2 }}>
                    {index + 1}
                  </span>
                  <span style={{ color: 'var(--danger)', fontSize: 11, paddingTop: 2 }}>✕</span>
                  <span className="text-sm text-secondary">{item}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* If I were responsible */}
      <Card variant="accent">
        <CardHeader
          title="If I were responsible for getting you hired"
          subtitle="The audit's seven-step plan, in order"
          help="This is the whole programme compressed into seven sentences. When the dashboard feels like too much, this is the version to follow."
        />
        <CardBody>
          <div className="grid grid--auto" style={{ gap: 'var(--space-4)' }}>
            {ifIWereResponsible.map((step, index) => (
              <div key={step} className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <span
                  className="tnum"
                  style={{
                    fontSize: 'var(--text-xl)',
                    fontWeight: 'var(--weight-bold)',
                    color: 'var(--accent-text)',
                    lineHeight: 1,
                    flexShrink: 0,
                    opacity: 0.7,
                  }}
                >
                  {index + 1}
                </span>
                <span className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </CardBody>
        <CardFooter>
          <span>Bottleneck: {data.profile.bottleneck.slice(0, 120)}…</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/readiness')}>
            Readiness breakdown
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------- impact vs effort -- */

/**
 * Scatter of impact against hours. Hand-rolled rather than a chart component
 * because the labels need to sit beside the points, which a generic scatter
 * cannot do without a collision-avoidance pass.
 */
function ImpactEffortPlot({ actions }: { actions: (LeverageAction & { leverage: number })[] }) {
  const width = 640
  const height = 300
  const padding = { top: 16, right: 16, bottom: 34, left: 40 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const maxHours = Math.max(...actions.map((a) => a.hours ?? 0), 200)
  const xAt = (hours: number | null) =>
    // Ongoing work sits at the origin: it costs no incremental hours.
    padding.left + ((hours ?? 0) / maxHours) * plotW
  const yAt = (impact: number) => padding.top + plotH - ((impact - 8) / 2.2) * plotH

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} style={{ height }} preserveAspectRatio="none" role="img">
        {/* Quadrant shading: top-left is the sweet spot. */}
        <rect
          x={padding.left}
          y={padding.top}
          width={plotW / 2}
          height={plotH / 2}
          fill="var(--success)"
          opacity={0.05}
        />

        <g className="chart__grid">
          {[8, 8.5, 9, 9.5, 10].map((impact) => (
            <g key={impact}>
              <line x1={padding.left} y1={yAt(impact)} x2={width - padding.right} y2={yAt(impact)} />
              <text className="chart__label" x={padding.left - 6} y={yAt(impact) + 3} textAnchor="end">
                {impact}
              </text>
            </g>
          ))}
          {[0, 50, 100, 150, 200].map((hours) => (
            <g key={hours}>
              <line x1={xAt(hours)} y1={padding.top} x2={xAt(hours)} y2={padding.top + plotH} />
              <text className="chart__label" x={xAt(hours)} y={height - 16} textAnchor="middle">
                {hours}h
              </text>
            </g>
          ))}
        </g>

        <text className="chart__label chart__label--axis" x={padding.left} y={height - 3}>
          Hours required →
        </text>
        <text
          className="chart__label chart__label--axis"
          x={6}
          y={padding.top + 4}
          transform={`rotate(-90 6 ${padding.top + 4})`}
        >
          ← Career impact
        </text>

        {actions.map((action, index) => {
          const cx = xAt(action.hours)
          const cy = yAt(action.impact)
          // Nudge labels so short-hour points do not collide with the y-axis.
          const anchor = cx > width / 2 ? 'end' : 'start'
          const dx = cx > width / 2 ? -10 : 10
          const label = action.action.length > 30 ? `${action.action.slice(0, 28)}…` : action.action

          return (
            <g key={action.id}>
              <circle
                cx={cx}
                cy={cy}
                r={action.isOngoing ? 8 : 6}
                fill={action.longTermRoi === 'Very High' ? 'var(--success)' : seriesColor(index)}
                stroke="var(--bg-base)"
                strokeWidth={2}
                opacity={0.92}
              />
              <text className="chart__label" x={cx + dx} y={cy + 3} textAnchor={anchor}>
                {label}
                {action.isOngoing ? ' (ongoing)' : ''}
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ marginTop: 'var(--space-3)' }}>
        <div className="chart-legend">
          <span className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: 'var(--success)' }} />
            Very high long-term ROI
          </span>
          <span className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: 'var(--success)', opacity: 0.25 }} />
            Sweet spot: high impact, low hours
          </span>
        </div>
      </div>
    </div>
  )
}
