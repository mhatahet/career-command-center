/* ============================================================================
   Analytics
   ----------------------------------------------------------------------------
   Hours, velocity, consistency, skill growth, burndown and projected completion.
   The audit's tenth "action to stop" is measuring progress by effort instead of
   observable results — so every chart here answers a question about outcomes,
   not about how busy the week felt.
   ========================================================================= */

import { useMemo, useState } from 'react'

import {
  ActivityCalendar,
  BarChart,
  BurndownChart,
  ChartLegend,
  DonutChart,
  HeatLegend,
  LineChart,
  StackedBarChart,
  seriesColor,
} from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  ProgressBar,
  Segmented,
  Stat,
  Tooltip,
} from '../components/ui'
import {
  addDays,
  daysBetween,
  formatDate,
  formatHours,
  formatMonthShort,
  startOfMonth,
  startOfWeek,
} from '../lib/dates'
import { chapterProgress } from '../lib/derive'
import { useStore } from '../lib/store'
import type { TaskArea } from '../lib/types'

const AREA_LABELS: Record<TaskArea, string> = {
  sql: 'SQL',
  analytics: 'Analytics',
  experimentation: 'Experimentation',
  portfolio: 'Portfolio',
  writing: 'Writing',
  networking: 'Networking',
  interview: 'Interview',
  reading: 'Reading',
  course: 'Courses',
  ai: 'AI',
  applications: 'Applications',
  linkedin: 'LinkedIn',
  admin: 'Admin',
}

type Range = '30' | '90' | '180' | 'all'

export function Analytics() {
  const { data, derived } = useStore()
  const { hours, projection, timeline, streak, readiness } = derived
  const [range, setRange] = useState<Range>('90')

  const rangeStart = useMemo(() => {
    if (range === 'all') return data.profile.startDate
    return addDays(derived.today, -Number(range))
  }, [data.profile.startDate, derived.today, range])

  const activity = useMemo(
    () => data.analytics.activity.filter((a) => a.date >= rangeStart).sort((a, b) => a.date.localeCompare(b.date)),
    [data.analytics.activity, rangeStart],
  )

  const activityMap = useMemo(
    () =>
      new Map(
        data.analytics.activity.map((a) => [a.date, { hours: a.hours, note: a.note, tasks: a.tasksCompleted }]),
      ),
    [data.analytics.activity],
  )

  /* --------------------------------------------------------- weekly hours -- */

  const weekly = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of data.analytics.activity) {
      const week = startOfWeek(day.date, data.settings.weekStartsOn)
      map.set(week, Math.round(((map.get(week) ?? 0) + day.hours) * 10) / 10)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, value]) => ({ label: formatDate(week), value, sublabel: `week of ${formatDate(week)}` }))
  }, [data.analytics.activity, data.settings.weekStartsOn])

  /* --------------------------------------------------------- monthly hours - */

  const monthly = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of data.analytics.activity) {
      const month = day.date.slice(0, 7)
      map.set(month, Math.round(((map.get(month) ?? 0) + day.hours) * 10) / 10)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ label: formatMonthShort(`${month}-01`), value }))
  }, [data.analytics.activity])

  /* ----------------------------------------------------------- burndown --- */

  const burndown = useMemo(() => {
    const allTasks = data.roadmap.chapters.flatMap((c) => c.missions.flatMap((m) => m.tasks))
    const totalHours = allTasks.reduce((sum, t) => sum + t.estimatedHours, 0)

    // Actual: remaining hours at the end of each week, based on completions.
    const completions = new Map<string, number>()
    for (const task of allTasks) {
      if (task.status === 'done' && task.completedAt) {
        const week = startOfWeek(task.completedAt, data.settings.weekStartsOn)
        completions.set(week, (completions.get(week) ?? 0) + task.estimatedHours)
      }
    }

    const weeksElapsed = Math.max(1, Math.ceil(daysBetween(data.profile.startDate, derived.today) / 7))
    const totalWeeks = Math.ceil(timeline.daysTotal / 7)

    const actual: { x: string; y: number }[] = []
    let remaining = totalHours
    for (let w = 0; w <= weeksElapsed; w += 1) {
      const weekStart = startOfWeek(addDays(data.profile.startDate, w * 7), data.settings.weekStartsOn)
      remaining -= completions.get(weekStart) ?? 0
      actual.push({ x: `W${w}`, y: Math.max(0, Math.round(remaining)) })
    }

    const ideal: { x: string; y: number }[] = []
    for (let w = 0; w <= totalWeeks; w += 1) {
      ideal.push({ x: `W${w}`, y: Math.max(0, Math.round(totalHours * (1 - w / totalWeeks))) })
    }

    // Projection from the current point at the current velocity.
    const projected: { x: string; y: number }[] = []
    if (hours.weeklyVelocity > 0.5) {
      let value = actual[actual.length - 1]?.y ?? totalHours
      let week = weeksElapsed
      while (value > 0 && week < totalWeeks + 60) {
        projected.push({ x: `W${week}`, y: Math.max(0, Math.round(value)) })
        value -= hours.weeklyVelocity
        week += 1
      }
      projected.push({ x: `W${week}`, y: 0 })
    }

    // Pad the actual and projected series so all three share an x domain.
    const domain = ideal.map((p) => p.x)
    const alignTo = (series: { x: string; y: number }[]) =>
      domain.map((x) => series.find((p) => p.x === x)).filter((p): p is { x: string; y: number } => Boolean(p))

    return { actual: alignTo(actual), ideal, projected: alignTo(projected), totalHours }
  }, [data.profile.startDate, data.roadmap.chapters, data.settings.weekStartsOn, derived.today, hours.weeklyVelocity, timeline.daysTotal])

  /* ------------------------------------------------------ skill growth ---- */

  const skillGrowth = useMemo(() => {
    // One line per must-fix competency — the ones the plan is actually about.
    const focus = data.skills.filter((s) => s.tier === 'must-fix' || s.tier === 'should-improve').slice(0, 6)
    return focus.map((skill, i) => ({
      label: skill.name,
      color: seriesColor(i),
      points: skill.history.map((h) => ({ x: h.date, y: h.score })),
    }))
  }, [data.skills])

  /* ---------------------------------------------------- consistency ------- */

  const consistency = useMemo(() => {
    const totalDays = Math.max(1, daysBetween(data.profile.startDate, derived.today) + 1)
    const activeDays = data.analytics.activity.filter((a) => a.hours > 0).length
    // Longest gap between logged days: the honest measure of whether the habit holds.
    const dates = data.analytics.activity
      .filter((a) => a.hours > 0)
      .map((a) => a.date)
      .sort()
    let longestGap = 0
    for (let i = 1; i < dates.length; i += 1) {
      longestGap = Math.max(longestGap, daysBetween(dates[i - 1], dates[i]) - 1)
    }
    return {
      rate: (activeDays / totalDays) * 100,
      activeDays,
      totalDays,
      longestGap,
    }
  }, [data.analytics.activity, data.profile.startDate, derived.today])

  /* ------------------------------------------------------ area over time -- */

  const areaByMonth = useMemo(() => {
    const map = new Map<string, Record<string, number>>()
    for (const day of data.analytics.activity) {
      const month = day.date.slice(0, 7)
      const bucket = map.get(month) ?? {}
      for (const [area, value] of Object.entries(day.byArea)) {
        bucket[area] = Math.round(((bucket[area] ?? 0) + (value ?? 0)) * 10) / 10
      }
      map.set(month, bucket)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({ label: formatMonthShort(`${month}-01`), values }))
  }, [data.analytics.activity])

  const areaKeys = useMemo(
    () =>
      hours.byArea.slice(0, 8).map((row, i) => ({
        key: row.area,
        label: AREA_LABELS[row.area] ?? row.area,
        color: seriesColor(i),
      })),
    [hours.byArea],
  )

  /* -------------------------------------------------- chapter completion -- */

  const chapterCompletion = useMemo(
    () =>
      data.roadmap.chapters.map((chapter) => ({
        label: `M${chapter.month}`,
        value: Math.round(chapterProgress(chapter).pct),
        sublabel: chapter.title,
        color:
          chapter.month === timeline.currentMonth
            ? 'var(--accent)'
            : chapterProgress(chapter).pct >= 100
              ? 'var(--success)'
              : chapter.month < timeline.currentMonth
                ? 'var(--danger)'
                : 'var(--track)',
      })),
    [data.roadmap.chapters, timeline.currentMonth],
  )

  const capacityHistory = useMemo(
    () =>
      data.analytics.capacityHistory.map((row) => ({
        label: formatDate(row.weekStart),
        values: { actual: row.actualHours, shortfall: Math.max(0, row.plannedHours - row.actualHours) },
      })),
    [data.analytics.capacityHistory],
  )

  if (data.analytics.activity.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Analytics" />
        <Card>
          <EmptyState
            icon="📊"
            title="No activity logged yet"
            body="Complete a task on the Dashboard or in the Learning Path — that logs its hours automatically and every chart here comes alive."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Analytics"
        lede="Effort measured against outcomes. The audit's last “stop doing” item is measuring progress by effort instead of observable results — so hours are here for capacity planning, and everything else answers whether the plan is actually working."
        actions={
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: '30d' },
              { value: '90', label: '90d' },
              { value: '180', label: '6mo' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />

      {/* Headline */}
      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Total hours"
              value={Math.round(hours.total)}
              unit="h"
              size="lg"
              meta={`${hours.perActiveDay}h per active day`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Weekly velocity"
              value={hours.weeklyVelocity}
              unit="h/wk"
              size="lg"
              tone={hours.weeklyVelocity >= data.profile.weeklyHourTarget ? 'success' : 'warning'}
              delta={{ value: Math.round((hours.thisWeek - hours.lastWeek) * 10) / 10, suffix: 'h' }}
              meta={`target ${data.profile.weeklyHourTarget}h`}
              help="Mean over the last four weeks. This is the number the completion projection uses."
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar
                value={(hours.weeklyVelocity / Math.max(1, data.profile.weeklyHourTarget)) * 100}
                size="xs"
                tone={hours.weeklyVelocity >= data.profile.weeklyHourTarget ? 'success' : 'warning'}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Consistency"
              value={Math.round(consistency.rate)}
              unit="%"
              size="lg"
              tone={consistency.rate >= 60 ? 'success' : consistency.rate >= 40 ? undefined : 'warning'}
              meta={`${consistency.activeDays} of ${consistency.totalDays} days`}
              help="Share of days since the programme started with any work logged. Consistency predicts the outcome better than intensity does."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Longest gap"
              value={consistency.longestGap}
              unit="d"
              size="lg"
              tone={consistency.longestGap > 7 ? 'warning' : 'neutral'}
              meta={`current streak ${streak.current}d`}
              help="The longest run of consecutive days with nothing logged. Long gaps are where plans die — and where the recovery habit matters most."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Completion rate"
              value={Math.round(derived.roadmapProgress.pct)}
              unit="%"
              size="lg"
              meta={`${derived.roadmapProgress.done} of ${derived.roadmapProgress.total} tasks`}
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar
                value={derived.roadmapProgress.pct}
                size="xs"
                marker={timeline.timePct}
                tone={timeline.paceDelta >= -5 ? 'success' : 'warning'}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Projected completion"
              value={projection.projectedCompletion ? formatMonthShort(projection.projectedCompletion) : '—'}
              size="lg"
              tone={projection.onTrack ? 'success' : 'warning'}
              meta={
                projection.weeksAtCurrentPace
                  ? `${projection.weeksAtCurrentPace} weeks · ${projection.hoursRemaining}h left`
                  : `${projection.hoursRemaining}h remaining`
              }
              help={`At the ${data.profile.weeklyHourTarget}h/week target this finishes in ${projection.weeksAtTargetPace} weeks (${formatMonthShort(projection.targetCompletion)}). Programme ends ${formatMonthShort(timeline.endDate)}.`}
            />
          </CardBody>
        </Card>
      </div>

      {/* Activity calendar */}
      <Card>
        <CardHeader
          title="Activity calendar"
          subtitle={`${consistency.activeDays} active days · ${streak.longest}-day best streak`}
          help="Outlined squares carry a journal note. Intensity buckets come from your own distribution, so a lighter week still shows contrast rather than a flat grid."
          actions={<HeatLegend />}
        />
        <CardBody>
          <ActivityCalendar
            data={activityMap}
            endDate={derived.today}
            weeks={range === '30' ? 8 : range === '90' ? 16 : range === '180' ? 28 : 53}
            weekStartsOn={data.settings.weekStartsOn}
            formatTip={(_, value) => [
              { label: 'Hours', value: value ? formatHours(value.hours) : '—' },
              { label: 'Tasks', value: value ? String(value.tasks ?? 0) : '0' },
              ...(value?.note ? [{ label: 'Note', value: value.note }] : []),
            ]}
          />
        </CardBody>
      </Card>

      {/* Hours over time */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Weekly hours"
            subtitle={`Against a ${data.profile.weeklyHourTarget}h target`}
            help="The dashed line is your stated weekly target. Consistent under-delivery means either the target or the plan needs changing — the audit's 5h/week allocation exists for exactly that."
          />
          <CardBody>
            <BarChart
              data={weekly}
              height={200}
              target={data.profile.weeklyHourTarget}
              formatValue={(v) => `${Math.round(v)}h`}
              color="var(--viz-2)"
            />
          </CardBody>
          <CardFooter>
            <span>{weekly.length} weeks logged</span>
            <span className="tnum">
              Best week {Math.max(...weekly.map((w) => w.value), 0).toFixed(1)}h · median{' '}
              {weekly.length > 0
                ? [...weekly.map((w) => w.value)].sort((a, b) => a - b)[Math.floor(weekly.length / 2)].toFixed(1)
                : 0}
              h
            </span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title="Hours by area" help="Compare against the audit's time-budget allocation on the Leverage page. Effort in the wrong area still counts as zero." />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
              <DonutChart
                data={hours.byArea.slice(0, 8).map((row, i) => ({
                  label: AREA_LABELS[row.area] ?? row.area,
                  value: row.hours,
                  color: seriesColor(i),
                }))}
                size={150}
                thickness={21}
                centerValue={Math.round(hours.total)}
                centerLabel="hours"
              />
              <div className="col" style={{ gap: 5, width: '100%' }}>
                {hours.byArea.slice(0, 8).map((row, i) => (
                  <div key={row.area} className="row row--between">
                    <span className="row text-xs" style={{ gap: 6, minWidth: 0 }}>
                      <span
                        className="chart-legend__swatch"
                        style={{ background: seriesColor(i), width: 8, height: 8, borderRadius: 2 }}
                      />
                      <span className="truncate text-secondary">{AREA_LABELS[row.area] ?? row.area}</span>
                    </span>
                    <span className="text-xs tnum text-tertiary">
                      {row.hours.toFixed(1)}h <span className="text-quaternary">{row.pct.toFixed(0)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Area mix over time + monthly */}
      <div className="grid grid--auto-lg">
        {areaByMonth.length > 1 ? (
          <Card className="span-2">
            <CardHeader
              title="Where the hours went, month by month"
              subtitle="The mix should shift as the programme phases change"
              help="Analytical work should dominate months 1–3, portfolio work months 4–6, interview and application work from month 10. If the mix never changes, you are not following the sequence."
            />
            <CardBody>
              <StackedBarChart data={areaByMonth} keys={areaKeys} height={220} formatValue={(v) => `${Math.round(v)}h`} />
              <div style={{ marginTop: 'var(--space-4)' }}>
                <ChartLegend items={areaKeys.map((k) => ({ label: k.label, color: k.color }))} />
              </div>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Monthly hours" help="Total logged per calendar month." />
          <CardBody>
            <BarChart data={monthly} height={200} formatValue={(v) => `${Math.round(v)}h`} color="var(--viz-6)" />
          </CardBody>
        </Card>
      </div>

      {/* Burndown */}
      <Card>
        <CardHeader
          title="Burndown"
          subtitle={`${projection.hoursRemaining}h of ${burndown.totalHours}h remaining`}
          help="The dashed grey line is the pace needed to finish inside 24 months. The amber line is where your current velocity actually lands. The gap between them is the decision you need to make."
        />
        <CardBody>
          <BurndownChart
            actual={burndown.actual}
            ideal={burndown.ideal}
            projection={burndown.projected.length > 1 ? burndown.projected : undefined}
            height={260}
            formatY={(v) => `${Math.round(v)}h`}
          />
        </CardBody>
        <CardFooter>
          <span>
            {projection.onTrack ? (
              <Badge tone="success">On track to finish inside the horizon</Badge>
            ) : (
              <Badge tone="warning">
                {projection.weeksAtCurrentPace
                  ? `Finishes ${formatMonthShort(projection.projectedCompletion!)} at the current pace`
                  : 'No velocity yet — log some work'}
              </Badge>
            )}
          </span>
          <span className="tnum">
            Pace vs calendar: {timeline.paceDelta >= 0 ? '+' : ''}
            {timeline.paceDelta} points
          </span>
        </CardFooter>
      </Card>

      {/* Skill growth + readiness */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Skill growth"
            subtitle="Must-fix and should-improve competencies over time"
            help="These are the competencies the plan exists to move. A flat line here after three months of logged hours means the hours are going somewhere else."
          />
          <CardBody>
            {skillGrowth.some((s) => s.points.length > 1) ? (
              <>
                <LineChart
                  series={skillGrowth}
                  height={240}
                  yMin={5}
                  yMax={10}
                  formatX={(x) => formatDate(x)}
                  formatY={(y) => y.toFixed(1)}
                />
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <ChartLegend variant="line" items={skillGrowth.map((s) => ({ label: s.label, color: s.color }))} />
                </div>
              </>
            ) : (
              <EmptyState
                icon="📈"
                title="Not enough score history"
                body="Update a competency score on the Skills page — each change appends a point to its history."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Readiness forecast"
            subtitle={`${readiness.score} today → ${projection.readinessForecast} projected`}
            help="Linear extrapolation of the readiness trend across the remaining days. The evidence pillar moves in steps rather than smoothly, so treat this as directional."
          />
          <CardBody>
            {data.analytics.readinessHistory.length > 1 ? (
              <LineChart
                series={[
                  {
                    label: 'Readiness',
                    color: 'var(--accent)',
                    points: data.analytics.readinessHistory.map((r) => ({ x: r.date, y: r.score })),
                    fill: true,
                  },
                ]}
                height={200}
                yMin={30}
                yMax={100}
                referenceY={90}
                referenceLabel="Tier 1"
                formatX={(x) => formatDate(x)}
                formatY={(y) => String(Math.round(y))}
              />
            ) : (
              <span className="text-xs text-quaternary">Not enough snapshots yet.</span>
            )}
            <div className="col" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              {readiness.pillars.map((pillar) => (
                <div key={pillar.key} className="col" style={{ gap: 3 }}>
                  <div className="row row--between text-xs">
                    <span className="text-secondary">{pillar.label}</span>
                    <span className="tnum text-tertiary">
                      {pillar.score.toFixed(0)} <span className="text-quaternary">/100</span>
                    </span>
                  </div>
                  <ProgressBar
                    value={pillar.score}
                    size="sm"
                    tone={pillar.score >= 70 ? 'success' : pillar.score >= 40 ? undefined : 'warning'}
                  />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Chapter completion + capacity */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Chapter completion"
            subtitle="Every month of the roadmap"
            help="Red bars are months already past that are not complete. Those are the ones the plan quietly carries forward — the debt that makes later months harder."
          />
          <CardBody>
            <BarChart data={chapterCompletion} height={200} target={100} formatValue={(v) => `${Math.round(v)}%`} />
          </CardBody>
          <CardFooter>
            <span>
              {chapterCompletion.filter((c) => c.value >= 100).length} of {chapterCompletion.length} complete
            </span>
            <span className="tnum">
              {chapterCompletion.filter((c) => c.color === 'var(--danger)').length} behind
            </span>
          </CardFooter>
        </Card>

        {capacityHistory.length > 0 ? (
          <Card>
            <CardHeader
              title="Planned vs actual"
              subtitle="Weekly capacity"
              help="The shortfall band shows the hours you intended to work and did not. A persistent band means the plan is aspirational rather than real."
            />
            <CardBody>
              <StackedBarChart
                data={capacityHistory}
                keys={[
                  { key: 'actual', label: 'Logged', color: 'var(--success)' },
                  { key: 'shortfall', label: 'Shortfall', color: 'var(--danger-subtle)' },
                ]}
                height={200}
                formatValue={(v) => `${Math.round(v)}h`}
              />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <ChartLegend
                  items={[
                    { label: 'Logged', color: 'var(--success)' },
                    { label: 'Shortfall against plan', color: 'var(--danger-subtle)' },
                  ]}
                />
              </div>
            </CardBody>
          </Card>
        ) : null}
      </div>

      {/* Hours by skill */}
      {hours.bySkill.length > 0 ? (
        <Card>
          <CardHeader
            title="Hours by competency"
            subtitle="Where the deliberate practice actually went"
            help="Cross-check against the Skills page. Hours against a competency that has not moved means the practice is not deliberate enough."
          />
          <CardBody>
            <BarChart
              data={hours.bySkill.map((row, i) => {
                const skill = data.skills.find((s) => s.id === row.skillId)
                return {
                  label: row.name,
                  value: row.hours,
                  sublabel: skill ? `${skill.currentScore.toFixed(1)} → ${skill.targetScore.toFixed(1)}` : undefined,
                  color: skill?.tier === 'must-fix' ? 'var(--danger)' : seriesColor(i),
                }
              })}
              horizontal
              formatValue={(v) => formatHours(v)}
            />
          </CardBody>
          <CardFooter>
            <Tooltip content="Red bars are must-fix competencies. They should be receiving the most hours.">
              <span>Must-fix competencies shown in red</span>
            </Tooltip>
            <span className="tnum">{formatHours(hours.bySkill.reduce((sum, r) => sum + r.hours, 0))} attributed</span>
          </CardFooter>
        </Card>
      ) : null}

      {/* Recent activity log */}
      <Card>
        <CardHeader
          title="Activity log"
          subtitle={`${activity.length} days in the selected range`}
          help="Every logged day, most recent first. Notes appear from journal entries and from days you annotated."
        />
        <CardBody className="card__body--none">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Hours</th>
                  <th className="num">Tasks</th>
                  <th className="num">XP</th>
                  <th>Areas</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {[...activity].reverse().slice(0, 40).map((day) => (
                  <tr key={day.date}>
                    <td className="num strong">{formatDate(day.date, { year: true })}</td>
                    <td className="num">{day.hours.toFixed(1)}</td>
                    <td className="num">{day.tasksCompleted}</td>
                    <td className="num">{day.xp}</td>
                    <td className="text-xs">
                      {Object.entries(day.byArea)
                        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                        .slice(0, 3)
                        .map(([area, value]) => `${AREA_LABELS[area as TaskArea] ?? area} ${(value ?? 0).toFixed(1)}h`)
                        .join(' · ')}
                    </td>
                    <td className="text-xs" style={{ maxWidth: 320 }}>
                      {day.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
        <CardFooter>
          <span>Showing the most recent {Math.min(40, activity.length)} of {activity.length} days</span>
          <span className="tnum">
            {formatHours(activity.reduce((sum, d) => sum + d.hours, 0))} in range · since{' '}
            {formatDate(startOfMonth(rangeStart), { year: true })}
          </span>
        </CardFooter>
      </Card>
    </div>
  )
}
