/* ============================================================================
   Progress — the KPI board
   ----------------------------------------------------------------------------
   Part 10 of the audit, made countable. Weekly, monthly and quarterly KPIs with
   a counter each, plus the review questions that turn a number into a decision.
   Periods roll over automatically, and the previous period is archived rather
   than overwritten.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { BarChart, seriesColor } from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  DeleteButton,
  EmptyState,
  Icon,
  IconButton,
  InlineEdit,
  ProgressBar,
  Ring,
  Segmented,
  Select,
  Stat,
  Tooltip,
} from '../components/ui'
import { endOfQuarter, endOfWeek, formatDate, startOfQuarter, startOfWeek } from '../lib/dates'
import { periodKey } from '../lib/derive'
import { navigate } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { Goal, TaskArea } from '../lib/types'

const CADENCE_LABEL = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
} as const

const SOURCE_LABEL = {
  'weekly-kpi': 'Weekly KPI',
  'monthly-kpi': 'Monthly KPI',
  'quarterly-kpi': 'Quarterly KPI',
  throughput: 'Throughput commitment',
  custom: 'Custom',
} as const

const AREA_ROUTE: Partial<Record<TaskArea, string>> = {
  sql: '/skills',
  analytics: '/skills',
  experimentation: '/skills',
  portfolio: '/portfolio',
  writing: '/writing',
  networking: '/networking',
  interview: '/interview-prep',
  reading: '/reading',
  course: '/courses',
  ai: '/ai-projects',
  applications: '/applications',
  linkedin: '/linkedin',
  admin: '/settings',
}

type Cadence = Goal['cadence']

export function Progress() {
  const { data, derived, patch } = useStore()
  const [cadence, setCadence] = useState<Cadence | 'all'>('weekly')
  const [showInactive, setShowInactive] = useState(false)

  const weekStartsOn = data.settings.weekStartsOn

  const goals = useMemo(() => {
    return data.goals
      .filter((goal) => {
        if (!showInactive && !goal.active) return false
        if (cadence !== 'all' && goal.cadence !== cadence) return false
        return true
      })
      .sort((a, b) => {
        // Behind first — the point of the page is what needs attention.
        const ratio = (g: Goal) => (g.target > 0 ? g.current / g.target : 1)
        return ratio(a) - ratio(b) || a.order - b.order
      })
  }, [cadence, data.goals, showInactive])

  const updateGoal = (goalId: string, producer: (goal: Goal) => Goal, label: string) => {
    patch('goals', (list) => list.map((g) => (g.id === goalId ? producer(g) : g)), label)
  }

  const bump = (goal: Goal, delta: number) => {
    updateGoal(goal.id, (g) => ({ ...g, current: Math.max(0, g.current + delta) }), delta > 0 ? 'log progress' : 'undo progress')
  }

  /**
   * Roll a cadence over: archive the current period's value into history and
   * reset the counter. Deliberately explicit rather than automatic — the user
   * decides when a week is over, and archiving silently would lose the record.
   */
  const rollOver = (target: Cadence) => {
    const key = periodKey(target, derived.today, weekStartsOn)
    patch(
      'goals',
      (list) =>
        list.map((goal) =>
          goal.cadence === target
            ? { ...goal, history: { ...goal.history, [key]: goal.current }, current: 0 }
            : goal,
        ),
      `roll over ${target} goals`,
    )
  }

  const addGoal = () => {
    const goal: Goal = {
      id: newId('gl'),
      title: 'New goal',
      description: '',
      cadence: cadence === 'all' ? 'weekly' : cadence,
      target: 1,
      unit: 'items',
      current: 0,
      area: 'admin',
      history: {},
      active: true,
      order: data.goals.length,
      source: 'custom',
    }
    patch('goals', (list) => [...list, goal], 'add goal')
  }

  /* --------------------------------------------------------------- stats -- */

  const summary = useMemo(() => {
    const forCadence = (target: Cadence) => {
      const list = data.goals.filter((g) => g.active && g.cadence === target)
      const hit = list.filter((g) => g.current >= g.target).length
      const pct =
        list.length > 0
          ? (list.reduce((sum, g) => sum + Math.min(1, g.target > 0 ? g.current / g.target : 0), 0) / list.length) * 100
          : 0
      return { total: list.length, hit, pct }
    }
    return {
      weekly: forCadence('weekly'),
      monthly: forCadence('monthly'),
      quarterly: forCadence('quarterly'),
      yearly: forCadence('yearly'),
    }
  }, [data.goals])

  /** Historical hit rate per cadence, from the archived periods. */
  const history = useMemo(() => {
    const map = new Map<string, { hit: number; total: number }>()
    for (const goal of data.goals) {
      for (const [period, value] of Object.entries(goal.history)) {
        const bucket = map.get(period) ?? { hit: 0, total: 0 }
        bucket.total += 1
        if (value >= goal.target) bucket.hit += 1
        map.set(period, bucket)
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, bucket], i) => ({
        label: period.length > 8 ? formatDate(period) : period,
        value: bucket.total > 0 ? Math.round((bucket.hit / bucket.total) * 100) : 0,
        sublabel: `${bucket.hit} of ${bucket.total} hit`,
        color: seriesColor(i),
      }))
  }, [data.goals])

  const currentPeriodLabel = useMemo(() => {
    switch (cadence) {
      case 'weekly':
        return `${formatDate(startOfWeek(derived.today, weekStartsOn))} – ${formatDate(endOfWeek(derived.today, weekStartsOn))}`
      case 'monthly':
        return derived.today.slice(0, 7)
      case 'quarterly':
        return `${formatDate(startOfQuarter(derived.today))} – ${formatDate(endOfQuarter(derived.today))}`
      case 'yearly':
        return derived.today.slice(0, 4)
      default:
        return 'All cadences'
    }
  }, [cadence, derived.today, weekStartsOn])

  /* -------------------------------------------------------- review prompts */

  const reviewPrompts = useMemo(
    () => data.journal.prompts.filter((p) => p.kind === 'weekly' || p.kind === 'quarterly'),
    [data.journal.prompts],
  )

  return (
    <div className="page">
      <PageHeader
        title="Progress"
        lede="The audit's Part 10 execution dashboard, made countable. Weekly cadence is what actually predicts the outcome — the monthly and quarterly numbers are consequences of it."
        actions={
          <>
            <Segmented
              value={cadence}
              onChange={setCadence}
              options={[
                { value: 'weekly', label: 'Weekly', count: summary.weekly.total },
                { value: 'monthly', label: 'Monthly', count: summary.monthly.total },
                { value: 'quarterly', label: 'Quarterly', count: summary.quarterly.total },
                { value: 'yearly', label: 'Yearly', count: summary.yearly.total },
                { value: 'all', label: 'All' },
              ]}
            />
            <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={addGoal}>
              Add goal
            </Button>
          </>
        }
      />

      {/* Period rings */}
      <div className="grid grid--auto-sm">
        {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((target) => {
          const row = summary[target]
          return (
            <Card key={target}>
              <CardBody className="card__body--tight">
                <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
                  <Ring
                    value={row.pct}
                    size={56}
                    thickness={5}
                    display={Math.round(row.pct)}
                    valueSize={15}
                    tone={row.pct >= 80 ? 'success' : row.pct >= 40 ? undefined : 'warning'}
                  />
                  <div className="col grow" style={{ gap: 1 }}>
                    <span className="text-2xs text-tertiary" style={{ textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
                      {CADENCE_LABEL[target]}
                    </span>
                    <span className="text-sm tnum" style={{ fontWeight: 'var(--weight-semibold)' }}>
                      {row.hit} / {row.total} hit
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          )
        })}
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Streak"
              value={`${derived.streak.current}d`}
              size="lg"
              tone={derived.streak.atRisk ? 'warning' : 'success'}
              meta={`best ${derived.streak.longest}d`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Hours this week"
              value={derived.hours.thisWeek.toFixed(1)}
              unit="h"
              size="lg"
              tone={derived.hours.thisWeek >= data.profile.weeklyHourTarget ? 'success' : 'warning'}
              meta={`target ${data.profile.weeklyHourTarget}h`}
            />
          </CardBody>
        </Card>
      </div>

      {/* Goals */}
      <Card>
        <CardHeader
          title={cadence === 'all' ? 'All goals' : `${CADENCE_LABEL[cadence as Cadence]} KPIs`}
          subtitle={currentPeriodLabel}
          help="Sorted so whatever is furthest behind appears first. Use the +/− buttons to log progress as it happens — waiting until the end of the week means guessing."
          actions={
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <Button variant="ghost" size="sm" onClick={() => setShowInactive((v) => !v)}>
                {showInactive ? 'Hide inactive' : 'Show inactive'}
              </Button>
              {cadence !== 'all' ? (
                <Tooltip content={`Archive this ${cadence} period's numbers into history and reset every counter to zero.`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icon name="refresh" size={13} />}
                    onClick={() => rollOver(cadence as Cadence)}
                  >
                    Roll over period
                  </Button>
                </Tooltip>
              ) : null}
            </div>
          }
        />
        <CardBody className="card__body--none">
          {goals.length === 0 ? (
            <EmptyState icon="🎯" title="No goals here" body="Change the cadence filter or add a goal." />
          ) : (
            <div className="col">
              {goals.map((goal, index) => {
                const pct = goal.target > 0 ? (goal.current / goal.target) * 100 : 0
                const hit = goal.current >= goal.target
                const route = AREA_ROUTE[goal.area]

                return (
                  <div
                    key={goal.id}
                    style={{
                      padding: 'var(--space-4) var(--space-5)',
                      borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                      opacity: goal.active ? 1 : 0.5,
                    }}
                  >
                    <div className="row row--wrap" style={{ gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                      <div className="col grow" style={{ gap: 5, minWidth: 220 }}>
                        <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
                          <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                            <InlineEdit
                              value={goal.title}
                              onCommit={(next) => updateGoal(goal.id, (g) => ({ ...g, title: next }), 'rename goal')}
                              ariaLabel="Goal title"
                            />
                          </span>
                          <Badge tone={hit ? 'success' : 'neutral'}>{CADENCE_LABEL[goal.cadence]}</Badge>
                          <Tooltip content={SOURCE_LABEL[goal.source]}>
                            <Badge tone={goal.source === 'custom' ? 'neutral' : 'accent'}>
                              {goal.source === 'custom' ? 'custom' : 'audit'}
                            </Badge>
                          </Tooltip>
                          {hit ? <Badge tone="success">✓ hit</Badge> : null}
                        </div>
                        <span className="text-xs text-tertiary" style={{ lineHeight: 'var(--leading-normal)' }}>
                          {goal.description}
                        </span>
                      </div>

                      <div className="col shrink-0" style={{ gap: 6, width: 220 }}>
                        <div className="row row--between">
                          <span className="text-xs tnum" style={{ fontWeight: 'var(--weight-semibold)' }}>
                            {goal.current} <span className="text-quaternary">/ {goal.target}</span>{' '}
                            <span className="text-quaternary" style={{ fontWeight: 'var(--weight-normal)' }}>
                              {goal.unit}
                            </span>
                          </span>
                          <span className="text-2xs tnum text-quaternary">{Math.round(pct)}%</span>
                        </div>
                        <ProgressBar value={pct} size="md" tone={hit ? 'success' : pct >= 50 ? undefined : 'warning'} />
                      </div>

                      <div className="row shrink-0" style={{ gap: 4 }}>
                        <IconButton title="Decrease" onClick={() => bump(goal, -1)}>
                          −
                        </IconButton>
                        <IconButton title="Increase" onClick={() => bump(goal, 1)}>
                          +
                        </IconButton>
                        {goal.target >= 5 ? (
                          <Button variant="ghost" size="sm" onClick={() => bump(goal, 5)}>
                            +5
                          </Button>
                        ) : null}
                        {route ? (
                          <Button variant="ghost" size="sm" onClick={() => navigate(route)}>
                            <Icon name="arrowRight" size={12} />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* Inline editors, kept out of the way until needed */}
                    <details style={{ marginTop: 'var(--space-2)' }}>
                      <summary
                        className="text-2xs text-quaternary"
                        style={{ cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}
                      >
                        Edit target, cadence and area
                      </summary>
                      <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                        <div className="field">
                          <span className="field__label">Target</span>
                          <input
                            className="input input--sm input--num"
                            type="number"
                            min={0}
                            value={goal.target}
                            onChange={(e) =>
                              updateGoal(goal.id, (g) => ({ ...g, target: Math.max(0, Number(e.target.value) || 0) }), 'edit target')
                            }
                          />
                        </div>
                        <div className="field">
                          <span className="field__label">Unit</span>
                          <input
                            className="input input--sm"
                            value={goal.unit}
                            onChange={(e) => updateGoal(goal.id, (g) => ({ ...g, unit: e.target.value }), 'edit unit')}
                          />
                        </div>
                        <div className="field">
                          <span className="field__label">Cadence</span>
                          <Select
                            value={goal.cadence}
                            size="sm"
                            options={(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => ({
                              value: c,
                              label: CADENCE_LABEL[c],
                            }))}
                            onChange={(next) => updateGoal(goal.id, (g) => ({ ...g, cadence: next }), 'change cadence')}
                          />
                        </div>
                        <div className="field">
                          <span className="field__label">Area</span>
                          <Select
                            value={goal.area}
                            size="sm"
                            options={(Object.keys(AREA_ROUTE) as TaskArea[]).map((a) => ({ value: a, label: a }))}
                            onChange={(next) => updateGoal(goal.id, (g) => ({ ...g, area: next }), 'change area')}
                          />
                        </div>
                        <div className="field">
                          <span className="field__label">Active</span>
                          <div className="row" style={{ height: 26, alignItems: 'center', gap: 'var(--space-3)' }}>
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={goal.active}
                              onChange={(e) => updateGoal(goal.id, (g) => ({ ...g, active: e.target.checked }), 'toggle active')}
                              aria-label="Active"
                            />
                            <DeleteButton
                              onDelete={() => patch('goals', (list) => list.filter((g) => g.id !== goal.id), 'delete goal')}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="field" style={{ marginTop: 'var(--space-3)' }}>
                        <span className="field__label">Description</span>
                        <InlineEdit
                          value={goal.description}
                          multiline
                          placeholder="Why this KPI exists…"
                          onCommit={(next) => updateGoal(goal.id, (g) => ({ ...g, description: next }), 'edit description')}
                          ariaLabel="Goal description"
                        />
                      </div>
                      {Object.keys(goal.history).length > 0 ? (
                        <div className="col" style={{ gap: 4, marginTop: 'var(--space-3)' }}>
                          <span className="section-title">History</span>
                          <div className="row row--wrap" style={{ gap: 4 }}>
                            {Object.entries(goal.history)
                              .sort(([a], [b]) => b.localeCompare(a))
                              .slice(0, 12)
                              .map(([period, value]) => (
                                <Tooltip key={period} content={`${period}: ${value} of ${goal.target}`}>
                                  <Badge tone={value >= goal.target ? 'success' : 'warning'}>
                                    {value}/{goal.target}
                                  </Badge>
                                </Tooltip>
                              ))}
                          </div>
                        </div>
                      ) : null}
                    </details>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
        <CardFooter>
          <span>
            {goals.filter((g) => g.current >= g.target).length} of {goals.length} hit this period
          </span>
          <span className="tnum">
            {data.goals.filter((g) => g.source !== 'custom').length} from the audit ·{' '}
            {data.goals.filter((g) => g.source === 'custom').length} custom
          </span>
        </CardFooter>
      </Card>

      {/* Historical hit rate */}
      {history.length > 0 ? (
        <Card>
          <CardHeader
            title="Historical hit rate"
            subtitle="Share of goals met, per archived period"
            help="Only periods you have explicitly rolled over appear here. Consistency across periods matters more than any single strong week."
          />
          <CardBody>
            <BarChart data={history} height={180} target={80} formatValue={(v) => `${Math.round(v)}%`} />
          </CardBody>
        </Card>
      ) : null}

      {/* Review questions */}
      <Card variant="inset">
        <CardHeader
          title="Review questions"
          subtitle="From Part 10 of the audit"
          help="Ask these at every weekly and quarterly review. The answers belong in the Journal, where they accumulate into a record you can actually reread."
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate('/journal')} icon={<Icon name="arrowRight" size={13} />}>
              Open journal
            </Button>
          }
        />
        <CardBody>
          <div className="grid grid--auto" style={{ gap: 'var(--space-4)' }}>
            {reviewPrompts.map((prompt) => (
              <div key={prompt.id} className="col" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                  <Badge tone={prompt.kind === 'quarterly' ? 'accent' : 'neutral'}>{prompt.kind}</Badge>
                </div>
                <span className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 'var(--leading-normal)' }}>
                  {prompt.question}
                </span>
                {prompt.helper ? <span className="text-2xs text-tertiary">{prompt.helper}</span> : null}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Success metrics */}
      <Card>
        <CardHeader
          title="Success metrics"
          subtitle="What “done” looks like at the end of 24 months"
          help="The audit's own definition of success. Everything on this dashboard exists to move these six numbers."
        />
        <CardBody className="card__body--none">
          <div className="col">
            {[
              {
                label: '6–8 high-quality public portfolio artefacts',
                current: data.portfolio.filter((p) => p.publishStatus === 'published').length,
                target: 7,
                route: '/portfolio',
              },
              {
                label: 'Strong SQL and analytics proficiency',
                current: Number((data.skills.find((s) => s.name === 'Analytics')?.currentScore ?? 0).toFixed(1)),
                target: 9,
                route: '/skills',
                unit: '/10',
              },
              {
                label: 'Consistent interview performance',
                current: Number(
                  (data.interviews.mocks.length > 0
                    ? data.interviews.mocks.reduce((sum, m) => sum + m.score, 0) / data.interviews.mocks.length
                    : 0
                  ).toFixed(1),
                ),
                target: 8,
                route: '/interview-prep',
                unit: '/10',
              },
              {
                label: 'Active international network',
                current: data.networking.contacts.filter((c) => c.relationshipStrength >= 3).length,
                target: 60,
                route: '/networking',
              },
              {
                label: 'Referrals from target companies',
                current: data.applications.applications.filter((a) => a.hasReferral).length,
                target: 5,
                route: '/applications',
              },
              {
                label: 'Interview invitations from Tier 1 or Tier 2 employers',
                current: data.applications.applications.filter(
                  (a) =>
                    a.companyTier <= 2 &&
                    ['recruiter-screen', 'hiring-manager', 'take-home', 'onsite-loop', 'offer'].includes(a.stage),
                ).length,
                target: 3,
                route: '/applications',
              },
            ].map((metric, index) => {
              const pct = metric.target > 0 ? (metric.current / metric.target) * 100 : 0
              const hit = metric.current >= metric.target
              return (
                <div
                  key={metric.label}
                  className="row row--wrap"
                  style={{
                    gap: 'var(--space-4)',
                    padding: 'var(--space-4) var(--space-5)',
                    borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                    alignItems: 'center',
                  }}
                >
                  <span className="text-sm grow" style={{ minWidth: 200, color: 'var(--text-primary)' }}>
                    {metric.label}
                  </span>
                  <span className="text-sm tnum shrink-0" style={{ width: 90, textAlign: 'right' }}>
                    {metric.current}
                    <span className="text-quaternary">
                      {' '}
                      / {metric.target}
                      {metric.unit ?? ''}
                    </span>
                  </span>
                  <div className="shrink-0" style={{ width: 160 }}>
                    <ProgressBar value={pct} size="md" tone={hit ? 'success' : pct >= 50 ? undefined : 'warning'} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(metric.route)} className="shrink-0">
                    <Icon name="arrowRight" size={12} />
                  </Button>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
