/* ============================================================================
   Dashboard
   ----------------------------------------------------------------------------
   Answers three questions above the fold, in this order:
     1. Where am I today?
     2. How far have I progressed?
     3. What should I work on next?

   Everything below that is supporting detail, ordered by how often it changes.
   ========================================================================= */

import { useMemo, useState } from 'react'

import {
  ActivityCalendar,
  ChartLegend,
  DonutChart,
  Gauge,
  HeatLegend,
  LineChart,
  RadarChart,
  seriesColor,
} from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  EmptyState,
  HelpDot,
  Icon,
  IconButton,
  InlineEdit,
  ProgressBar,
  ProgressRow,
  Ring,
  Stat,
  Tooltip,
} from '../components/ui'
import {
  addDays,
  formatCompact,
  formatDate,
  formatHours,
  formatMonthShort,
  formatRelative,
} from '../lib/dates'
import { chapterProgress, missionProgress } from '../lib/derive'
import { addHoursToToday } from '../lib/logging'
import { navigate } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { Task, TaskArea } from '../lib/types'

const AREA_LABELS: Record<TaskArea, string> = {
  sql: 'SQL',
  analytics: 'Analytics',
  experimentation: 'Experimentation',
  portfolio: 'Portfolio',
  writing: 'Writing',
  networking: 'Networking',
  interview: 'Interview',
  reading: 'Reading',
  course: 'Course',
  ai: 'AI',
  applications: 'Applications',
  linkedin: 'LinkedIn',
  admin: 'Admin',
}

export function Dashboard() {
  const { data, derived, update, patch } = useStore()
  const { readiness, xp, streak, timeline, hours, projection, recommendations } = derived

  /* ------------------------------------------------------------- today --- */

  /**
   * Today's list. Ordered by priority only — deliberately *not* by done-ness.
   *
   * Sinking a task the moment it is ticked shifts every row below it under the
   * cursor, which makes working down the list a sequence of mis-clicks. Ticked
   * rows stay put and are struck through instead; they drop out on the next day
   * because the filter only keeps completions from today.
   */
  const todaysTasks = useMemo(() => {
    const relevant = data.tasks.filter(
      (t) =>
        t.status !== 'dropped' &&
        (!t.scheduledFor || t.scheduledFor <= derived.today) &&
        (t.status !== 'done' || t.completedAt?.slice(0, 10) === derived.today),
    )
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const
    return relevant
      .sort((a, b) => rank[a.priority] - rank[b.priority] || a.order - b.order)
      .slice(0, 8)
  }, [data.tasks, derived.today])

  /**
   * Completing a task also logs its hours to today, so the streak, heat map and
   * velocity stay accurate without a separate time-logging ritual.
   *
   * Both effects go through a single `update()` call. Two calls would push two
   * entries onto the undo stack, and one Cmd+Z would then revert only half of
   * what the user just did.
   */
  const toggleTask = (task: Task) => {
    const wasDone = task.status === 'done'

    update(
      (draft) => {
        const tasks = draft.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: (wasDone ? 'not-started' : 'done') as Task['status'],
                completedAt: wasDone ? undefined : new Date().toISOString(),
              }
            : t,
        )

        // Re-opening a task leaves the logged hours alone: the work happened.
        if (wasDone) return { ...draft, tasks }

        const activity = addHoursToToday(draft.analytics.activity, derived.today, {
          hours: task.estimatedHours,
          xp: task.xp,
          area: task.area,
        })

        return { ...draft, tasks, analytics: { ...draft.analytics, activity } }
      },
      wasDone ? ['tasks'] : ['tasks', 'analytics'],
      wasDone ? 'reopen task' : 'complete task',
    )
  }

  const [newTaskTitle, setNewTaskTitle] = useState('')

  const addTask = () => {
    const title = newTaskTitle.trim()
    if (!title) return
    const task: Task = {
      id: newId('tk'),
      title,
      status: 'not-started',
      priority: 'medium',
      area: 'admin',
      estimatedHours: 1,
      dueDate: derived.today,
      scheduledFor: derived.today,
      skillIds: [],
      xp: 25,
      createdAt: new Date().toISOString(),
      order: -1,
      recurring: undefined,
    }
    patch('tasks', (tasks) => [task, ...tasks], 'add task')
    setNewTaskTitle('')
  }

  /* ------------------------------------------------------ current sprint -- */

  const chapter = timeline.currentChapter
  const chapterPct = chapter ? chapterProgress(chapter).pct : 0

  /* -------------------------------------------------------- radar series -- */

  const radarAxes = data.skills.map((s) => s.name)
  const weakAxes = data.skills.filter((s) => s.currentScore < s.targetScore - 0.6).map((s) => s.name)

  /* --------------------------------------------------------- upcoming ----- */

  const upcomingMilestones = useMemo(
    () =>
      data.roadmap.chapters
        .filter((c) => c.month >= timeline.currentMonth)
        .slice(0, 5)
        .map((c) => ({ chapter: c, pct: chapterProgress(c).pct })),
    [data.roadmap.chapters, timeline.currentMonth],
  )

  /* ---------------------------------------------------------- activity ---- */

  const activityMap = useMemo(
    () =>
      new Map(
        data.analytics.activity.map((a) => [a.date, { hours: a.hours, note: a.note, tasks: a.tasksCompleted }]),
      ),
    [data.analytics.activity],
  )

  /* ------------------------------------------------------- domain rollups - */

  const domainProgress = useMemo(() => {
    const byName = (name: string) => data.skills.find((s) => s.name === name)
    const rows = [
      { label: 'SQL & Analytics', skill: byName('Analytics'), route: '/skills' },
      { label: 'Metrics', skill: byName('Metrics'), route: '/skills' },
      { label: 'Experimentation', skill: byName('Experimentation'), route: '/skills' },
      { label: 'AI Product', skill: byName('AI Product Knowledge'), route: '/ai-projects' },
    ]
    return rows.filter((r) => r.skill)
  }, [data.skills])

  const readingProgress = useMemo(() => {
    const books = data.books.filter((b) => b.kind === 'book')
    const finished = books.filter((b) => b.status === 'finished').length
    const reading = books.filter((b) => b.status === 'reading')
    return { finished, total: books.length, reading }
  }, [data.books])

  const latestLinkedIn = data.linkedin.snapshots.at(-1)
  const firstLinkedIn = data.linkedin.snapshots[0]

  const networkingDue = data.networking.contacts.filter(
    (c) => c.nextActionDate && c.nextActionDate <= derived.today,
  )

  const publishedCount = data.portfolio.filter((p) => p.publishStatus === 'published').length
  const activeProjects = data.portfolio
    .filter((p) => p.status === 'in-progress' || (p.completion > 0 && p.publishStatus !== 'published'))
    .sort((a, b) => b.completion - a.completion)

  const mustFixSkills = data.skills
    .filter((s) => s.tier === 'must-fix')
    .sort((a, b) => a.currentScore - b.currentScore)

  const readinessTrend = data.analytics.readinessHistory.map((r) => ({ x: r.date, y: r.score }))

  const hoursByArea = hours.byArea.slice(0, 6).map((a, i) => ({
    label: AREA_LABELS[a.area] ?? a.area,
    value: a.hours,
    color: seriesColor(i),
  }))

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        lede={
          <>
            Month <strong>{timeline.currentMonth}</strong> of {timeline.totalMonths} ·{' '}
            {timeline.daysRemaining} days remaining · {data.profile.targetLevelLabel}.{' '}
            {streak.atRisk
              ? 'Nothing logged today — tick one task to keep the streak alive.'
              : streak.current > 0
                ? `${streak.current}-day streak holding.`
                : 'No active streak. Log any work today to start one.'}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon name="arrowRight" size={13} />}
              onClick={() => navigate('/learning-path')}
            >
              Current sprint
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Icon name="target" size={13} />}
              onClick={() => navigate('/leverage')}
            >
              Highest leverage
            </Button>
          </>
        }
      />

      {/* ==================================================== hero row === */}
      <div className="grid grid--auto-lg">
        {/* Readiness */}
        <Card variant="accent" className="span-2">
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-6)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="col" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
                <Gauge
                  value={readiness.score}
                  target={readiness.target}
                  size={188}
                  segments={[
                    { from: 0, to: 45, color: 'var(--danger)' },
                    { from: 45, to: 70, color: 'var(--warning)' },
                    { from: 70, to: 90, color: 'var(--info)' },
                    { from: 90, to: 100, color: 'var(--success)' },
                  ]}
                >
                  <span
                    className="tnum"
                    style={{
                      fontSize: 'var(--text-4xl)',
                      fontWeight: 'var(--weight-bold)',
                      letterSpacing: 'var(--tracking-tight)',
                      lineHeight: 1,
                    }}
                  >
                    {readiness.score}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-2xs)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--tracking-wider)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    Readiness / 100
                  </span>
                </Gauge>
                <Badge
                  tone={readiness.band.tone === 'danger' ? 'danger' : readiness.band.tone === 'warning' ? 'warning' : readiness.band.tone === 'success' ? 'success' : 'info'}
                  size="lg"
                >
                  {readiness.band.label}
                </Badge>
              </div>

              <div className="col grow" style={{ gap: 'var(--space-3)', minWidth: 220 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 4 }}>
                    Where you are
                    <HelpDot title="How readiness is calculated">
                      Four pillars, weighted: Competency 55%, Evidence 25%, Interview 12%, Presence 8%.
                      <br />
                      <br />
                      A competency average alone would read {readiness.competencyScore} — flattering
                      and useless. The audit's finding is that your capability is real but the{' '}
                      <strong>proof</strong> is missing, so evidence carries real weight and the score
                      climbs fastest when artefacts actually ship.
                    </HelpDot>
                  </div>
                  <div className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                    {readiness.band.detail}
                  </div>
                </div>

                <div className="col" style={{ gap: 'var(--space-2)' }}>
                  {readiness.pillars.map((pillar) => (
                    <Tooltip
                      key={pillar.key}
                      title={`${pillar.label} — ${pillar.score}/100`}
                      content={
                        <>
                          {pillar.detail}
                          <br />
                          <br />
                          Weight <strong>{(pillar.weight * 100).toFixed(0)}%</strong> · contributes{' '}
                          <strong>{pillar.contribution}</strong> points · <strong>{pillar.headroom}</strong>{' '}
                          points still available.
                          <br />
                          <br />
                          {pillar.drivers.map((d) => (
                            <span key={d.label} style={{ display: 'block' }}>
                              {d.done ? '✓' : '○'} {d.label}: <strong>{d.value}</strong>
                            </span>
                          ))}
                        </>
                      }
                    >
                      <div style={{ width: '100%' }}>
                        <ProgressRow
                          label={pillar.label}
                          value={pillar.score}
                          display={`${pillar.score.toFixed(0)}`}
                          tone={pillar.score >= 70 ? 'success' : pillar.score >= 40 ? undefined : 'warning'}
                        />
                      </div>
                    </Tooltip>
                  ))}
                </div>

                <div className="row row--wrap" style={{ gap: 'var(--space-4)', marginTop: 2 }}>
                  <Stat label="Target" value={readiness.target} size="md" />
                  <Stat label="Gap" value={readiness.gap} size="md" tone="warning" />
                  <Stat
                    label="Forecast"
                    value={projection.readinessForecast}
                    size="md"
                    tone={projection.readinessForecast >= 80 ? 'success' : 'accent'}
                    help="Linear extrapolation of your readiness trend across the remaining days. It assumes the current rate of improvement holds — it is a projection, not a promise."
                  />
                </div>

                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => navigate('/readiness')}
                  icon={<Icon name="arrowRight" size={13} />}
                >
                  Full readiness breakdown
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Position + probability */}
        <Card>
          <CardHeader
            title="Position"
            subtitle={data.profile.careerLevelLabel}
            help="Benchmarks quoted directly from the executive career audit."
          />
          <CardBody className="col" >
            <div className="col" style={{ gap: 'var(--space-4)' }}>
              <div className="col" style={{ gap: 'var(--space-1)' }}>
                <span className="text-xs text-tertiary">Locally</span>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  {data.profile.benchmark.localPercentile}
                </span>
              </div>
              <div className="col" style={{ gap: 'var(--space-1)' }}>
                <span className="text-xs text-tertiary">Internationally</span>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  {data.profile.benchmark.internationalPercentile}
                </span>
              </div>

              <hr className="divider" />

              <Stat
                label="Probability of success"
                value={`${data.profile.successProbability.low}–${data.profile.successProbability.high}`}
                unit="%"
                size="lg"
                tone="accent"
                meta={`Senior PM at a top international company within ${data.profile.horizonMonths} months`}
                help={
                  <>
                    The audit's estimate, conditional on five assumptions:
                    <br />
                    <br />
                    {data.profile.successProbability.assumptions.map((a) => (
                      <span key={a} style={{ display: 'block', marginBottom: 4 }}>
                        • {a}
                      </span>
                    ))}
                  </>
                }
              />

              <div className="col" style={{ gap: 'var(--space-2)' }}>
                <span className="text-xs text-tertiary">Not yet competitive for</span>
                <div className="row row--wrap" style={{ gap: 4 }}>
                  {data.profile.benchmark.notYetCompetitiveFor.map((company) => (
                    <Badge key={company} tone="warning">
                      {company}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ================================================== stat strip === */}
      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Level"
              value={xp.level}
              size="lg"
              tone="accent"
              meta={`${formatCompact(xp.toNextLevel)} XP to level ${xp.level + 1}`}
              help={`${xp.total.toLocaleString()} XP total. Tasks ${formatCompact(xp.fromTasks)} · missions ${formatCompact(xp.fromMissions)} · achievements ${formatCompact(xp.fromAchievements)}.`}
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar value={xp.levelPct} size="xs" gradient />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Streak"
              value={streak.current}
              unit="d"
              size="lg"
              tone={streak.atRisk ? 'warning' : streak.current > 0 ? 'success' : 'neutral'}
              meta={
                streak.atRisk
                  ? 'Nothing logged today'
                  : `Longest ${streak.longest}d · ${streak.totalDaysActive} active days`
              }
              help="A streak survives through yesterday and only breaks once a full day passes with nothing logged. Completing a task logs its hours automatically."
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Hours invested"
              value={Math.round(hours.total)}
              unit="h"
              size="lg"
              meta={`${formatHours(hours.thisWeek)} this week · ${hours.weeklyVelocity}h/wk pace`}
              delta={{ value: Math.round((hours.thisWeek - hours.lastWeek) * 10) / 10, suffix: 'h' }}
              help={`Target is ${data.profile.weeklyHourTarget}h/week. The 80/20 table totals roughly 690 hours of one-off work plus ongoing commitments.`}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Days remaining"
              value={timeline.daysRemaining}
              size="lg"
              meta={`Month ${timeline.currentMonth} · Q${timeline.currentQuarter} · ends ${formatDate(timeline.endDate, { year: true })}`}
              help={`${timeline.daysElapsed} of ${timeline.daysTotal} days elapsed (${timeline.timePct}%). Work completed is ${timeline.paceDelta >= 0 ? 'ahead of' : 'behind'} the calendar by ${Math.abs(timeline.paceDelta)} points.`}
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
              label="Portfolio published"
              value={publishedCount}
              unit={` / 7`}
              size="lg"
              tone={publishedCount >= 6 ? 'success' : publishedCount === 0 ? 'danger' : 'warning'}
              meta={
                publishedCount === 0
                  ? 'The must-fix item with the largest headroom'
                  : `${activeProjects.length} in progress`
              }
              help="The audit's success metric is 6–8 high-quality public artefacts. Published portfolio work is half the Evidence pillar."
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Mock interviews"
              value={data.interviews.mocks.length}
              size="lg"
              meta={
                data.interviews.mocks.length > 0
                  ? `Avg ${(data.interviews.mocks.reduce((s, m) => s + m.score, 0) / data.interviews.mocks.length).toFixed(1)}/10`
                  : 'None yet'
              }
              help="Two per week from month 10 through 24 — roughly 120 mocks. Volume plus recorded feedback is what makes performance reliable."
            />
          </CardBody>
        </Card>
      </div>

      {/* ============================= next actions + today + sprint === */}
      <div className="grid grid--auto-lg">
        {/* Recommendations */}
        <Card className="span-2">
          <CardHeader
            title="What to work on next"
            subtitle="Ranked by readiness points gained per hour invested"
            help="Leverage, not volume. Each row estimates the readiness points it would add and the hours it would take, then ranks by the ratio. That is what the audit's 80/20 section actually asks you to optimise."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/leverage')}>
                80/20 table
              </Button>
            }
          />
          <CardBody className="card__body--none">
            {recommendations.length === 0 ? (
              <EmptyState icon="✓" title="Nothing pressing" body="Every pillar is on track. Keep the cadence." />
            ) : (
              <div className="col">
                {recommendations.slice(0, 5).map((rec, i) => (
                  <div
                    key={rec.id}
                    style={{
                      padding: 'var(--space-4) var(--space-5)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="row row--between" style={{ alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                      <div className="col grow" style={{ gap: 5 }}>
                        <div className="row" style={{ gap: 'var(--space-2)' }}>
                          <Badge
                            tone={rec.urgency === 'critical' ? 'danger' : rec.urgency === 'high' ? 'warning' : 'neutral'}
                          >
                            {rec.urgency}
                          </Badge>
                          <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                            {rec.title}
                          </span>
                        </div>
                        <p className="text-xs text-tertiary" style={{ lineHeight: 'var(--leading-normal)' }}>
                          {rec.reason}
                        </p>
                        {rec.actions.length > 0 ? (
                          <ul className="col" style={{ gap: 2, marginTop: 3 }}>
                            {rec.actions.map((action) => (
                              <li key={action} className="text-xs text-secondary" style={{ display: 'flex', gap: 6 }}>
                                <span style={{ color: 'var(--text-quaternary)' }}>→</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="col shrink-0" style={{ alignItems: 'flex-end', gap: 6 }}>
                        {rec.expectedGain > 0 ? (
                          <Tooltip content="Estimated readiness points this would add">
                            <Badge tone="success" size="lg">
                              +{rec.expectedGain}
                            </Badge>
                          </Tooltip>
                        ) : null}
                        <span className="text-2xs text-quaternary tnum">~{rec.estimatedHours}h</span>
                        <Button variant="ghost" size="sm" onClick={() => navigate(rec.route)}>
                          {rec.routeLabel}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Today */}
        <Card>
          <CardHeader
            title="Today"
            subtitle={`${todaysTasks.filter((t) => t.status !== 'done').length} open · ${formatDate(derived.today)}`}
            help="Ticking a task logs its estimated hours to today's activity, which is what keeps your streak, heat map and velocity accurate without a separate time-logging step."
          />
          <CardBody className="card__body--tight">
            <div className="col" style={{ gap: 'var(--space-1)' }}>
              {todaysTasks.map((task) => (
                <div
                  key={task.id}
                  className="row"
                  style={{
                    gap: 'var(--space-3)',
                    padding: '6px var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Checkbox
                    checked={task.status === 'done'}
                    onChange={() => toggleTask(task)}
                    ariaLabel={`Complete ${task.title}`}
                  />
                  <div className="col grow" style={{ gap: 0, minWidth: 0 }}>
                    <span
                      className="text-sm truncate"
                      style={{
                        color: task.status === 'done' ? 'var(--text-quaternary)' : 'var(--text-primary)',
                        textDecoration: task.status === 'done' ? 'line-through' : undefined,
                      }}
                    >
                      {task.title}
                    </span>
                    <span className="text-2xs text-quaternary">
                      {AREA_LABELS[task.area]} · {formatHours(task.estimatedHours)}
                      {task.recurring ? ` · ${task.recurring}` : ''}
                    </span>
                  </div>
                  {task.priority === 'critical' ? <Badge tone="danger">!</Badge> : null}
                </div>
              ))}

              <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <input
                  className="input input--sm"
                  placeholder="Add a task…"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTask()
                  }}
                />
                <IconButton title="Add task" onClick={addTask}>
                  <Icon name="plus" size={14} />
                </IconButton>
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <span>
              {derived.weekProgress.done} of {derived.weekProgress.total} weekly KPIs hit
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
              KPIs
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ================================== sprint + progress rings === */}
      <div className="grid grid--auto-lg">
        {/* Current sprint */}
        {chapter ? (
          <Card className="span-2">
            <CardHeader
              title={`Current sprint — Month ${chapter.month}: ${chapter.title}`}
              subtitle={chapter.measurableOutput}
              help={`Focus: ${chapter.focus}. Expected ROI: ${chapter.expectedRoi.replace('-', ' ')}. Estimated ${chapter.estimatedHours}h.`}
              actions={
                <Button variant="subtle" size="sm" onClick={() => navigate(`/learning-path#${chapter.id}`)}>
                  Open chapter
                </Button>
              }
            />
            <CardBody>
              <div className="col" style={{ gap: 'var(--space-4)' }}>
                <div className="row" style={{ gap: 'var(--space-4)' }}>
                  <Ring
                    value={chapterPct}
                    size={64}
                    thickness={6}
                    tone={chapterPct >= 90 ? 'success' : undefined}
                    display={`${Math.round(chapterPct)}`}
                    label="%"
                  />
                  <div className="col grow" style={{ gap: 'var(--space-2)' }}>
                    {chapter.missions.map((mission) => {
                      const progress = missionProgress(mission)
                      return (
                        <Tooltip key={mission.id} title={mission.title} content={mission.rationale}>
                          <div style={{ width: '100%' }}>
                            <ProgressRow
                              label={mission.title}
                              value={progress.pct}
                              display={`${progress.done}/${progress.total}`}
                              tone={progress.pct >= 100 ? 'success' : undefined}
                            />
                          </div>
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>

                <hr className="divider" />

                <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
                  {chapter.targetOutcomes.map((outcome) => (
                    <div key={outcome} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent-text)', fontSize: 11, marginTop: 2 }}>◆</span>
                      <span className="text-xs text-secondary">{outcome}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {/* Period progress */}
        <Card>
          <CardHeader
            title="Period progress"
            help="Share of the audit's KPI targets met in the current week, month and quarter. Weekly cadence is what actually predicts the outcome."
          />
          <CardBody>
            <div className="row" style={{ justifyContent: 'space-around', gap: 'var(--space-3)' }}>
              {[
                { label: 'Week', progress: derived.weekProgress },
                { label: 'Month', progress: derived.monthProgress },
                { label: 'Quarter', progress: derived.quarterProgress },
              ].map(({ label, progress }) => (
                <div key={label} className="col" style={{ alignItems: 'center', gap: 6 }}>
                  <Ring
                    value={progress.pct}
                    size={72}
                    thickness={6}
                    tone={progress.pct >= 80 ? 'success' : progress.pct >= 40 ? undefined : 'warning'}
                    display={`${Math.round(progress.pct)}`}
                    label="%"
                  />
                  <span className="text-xs text-secondary">{label}</span>
                  <span className="text-2xs text-quaternary tnum">
                    {progress.done}/{progress.total} hit
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
          <CardFooter>
            <span>
              Pace{' '}
              <strong style={{ color: timeline.paceDelta >= 0 ? 'var(--success-text)' : 'var(--warning-text)' }}>
                {timeline.paceDelta >= 0 ? '+' : ''}
                {timeline.paceDelta}
              </strong>{' '}
              vs calendar
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
              Analytics
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ============================== competency + must-fix === */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Competency profile"
            subtitle="Current versus target across all sixteen competencies"
            help="The filled shape is where you are; the dashed outline is where a Tier-1 loop expects you to be. Red labels are more than 0.6 below target. Click any label to open that competency."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/skills')}>
                All skills
              </Button>
            }
          />
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-5)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <RadarChart
                axes={radarAxes}
                weakAxes={weakAxes}
                onAxisClick={(_, index) => navigate(`/skills#${data.skills[index]?.id}`)}
                series={[
                  {
                    label: 'Current',
                    color: 'var(--accent)',
                    values: data.skills.map((s) => s.currentScore),
                    fillOpacity: 0.2,
                  },
                  {
                    label: 'Target',
                    color: 'var(--success)',
                    values: data.skills.map((s) => s.targetScore),
                    fillOpacity: 0.05,
                    dashed: true,
                  },
                  {
                    label: 'Baseline',
                    color: 'var(--text-quaternary)',
                    values: data.skills.map((s) => s.baselineScore),
                    fillOpacity: 0,
                    dashed: true,
                  },
                ]}
                size={352}
              />

              <div className="col" style={{ gap: 'var(--space-4)', minWidth: 200, flex: 1 }}>
                <ChartLegend
                  variant="line"
                  items={[
                    { label: 'Current', color: 'var(--accent)' },
                    { label: 'Target', color: 'var(--success)' },
                    { label: 'Audit baseline', color: 'var(--text-quaternary)' },
                  ]}
                />

                <hr className="divider" />

                <div className="col" style={{ gap: 'var(--space-3)' }}>
                  <span className="section-title">Readiness trend</span>
                  <LineChart
                    series={[{ label: 'Readiness', color: 'var(--accent)', points: readinessTrend, fill: true }]}
                    height={132}
                    yMin={30}
                    yMax={100}
                    referenceY={90}
                    referenceLabel="Tier 1"
                    formatX={(x) => formatDate(x)}
                  />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Must fix */}
        <Card>
          <CardHeader
            title="Must fix"
            subtitle="The audit's non-negotiables"
            help="Part 3 of the audit. These are the competencies where the gap is largest and the weight is highest — they move the readiness score more than anything else on the list."
          />
          <CardBody className="card__body--tight">
            <div className="col" style={{ gap: 'var(--space-3)' }}>
              {mustFixSkills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => navigate(`/skills#${skill.id}`)}
                  className="col"
                  style={{
                    gap: 5,
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div className="row row--between">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {skill.name}
                    </span>
                    <span className="text-xs tnum text-tertiary">
                      {skill.currentScore.toFixed(1)} → {skill.targetScore.toFixed(1)}
                    </span>
                  </div>
                  <ProgressBar
                    value={(skill.currentScore / skill.targetScore) * 100}
                    size="sm"
                    tone={skill.currentScore >= skill.targetScore ? 'success' : 'danger'}
                  />
                  <span className="text-2xs text-quaternary truncate">
                    {skill.weaknesses.slice(0, 3).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          </CardBody>
          <CardFooter>
            <span className="truncate">Bottleneck: analytics, experimentation, quantified impact</span>
          </CardFooter>
        </Card>
      </div>

      {/* ======================== activity + domain progress === */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Activity"
            subtitle={`${derived.hours.total.toFixed(1)}h across ${streak.totalDaysActive} days · ${streak.longest}-day best streak`}
            help="Every square is a day. Outlined squares carry a journal note. Intensity buckets come from your own distribution, so a lighter week still shows contrast."
            actions={<HeatLegend />}
          />
          <CardBody>
            <ActivityCalendar
              data={activityMap}
              endDate={derived.today}
              weeks={26}
              weekStartsOn={data.settings.weekStartsOn}
              formatTip={(_, value) => [
                { label: 'Hours', value: value ? formatHours(value.hours) : '—' },
                { label: 'Tasks', value: value ? String(value.tasks ?? 0) : '0' },
                ...(value?.note ? [{ label: 'Note', value: value.note }] : []),
              ]}
            />
          </CardBody>
          <CardFooter>
            <span>
              Where the hours went
              {hours.byArea.length > 0 ? `: ${AREA_LABELS[hours.byArea[0].area]} leads at ${hours.byArea[0].pct.toFixed(0)}%` : ''}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
              Full analytics
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title="Hours by area" help="Compare against the 80/20 allocation on the Leverage page. Effort in the wrong place still counts as zero." />
          <CardBody>
            {hoursByArea.length === 0 ? (
              <EmptyState icon="○" title="No hours logged yet" body="Complete a task to start the record." />
            ) : (
              <div className="row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
                <DonutChart
                  data={hoursByArea}
                  size={140}
                  thickness={20}
                  centerValue={Math.round(hours.total)}
                  centerLabel="hours"
                />
                <div className="col grow" style={{ gap: 6, minWidth: 130 }}>
                  {hoursByArea.map((row) => (
                    <div key={row.label} className="row row--between" style={{ gap: 'var(--space-2)' }}>
                      <span className="row text-xs" style={{ gap: 6, minWidth: 0 }}>
                        <span
                          className="chart-legend__swatch"
                          style={{ background: row.color, width: 8, height: 8, borderRadius: 2 }}
                        />
                        <span className="truncate text-secondary">{row.label}</span>
                      </span>
                      <span className="text-xs tnum text-tertiary">{row.value.toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ======================== domain rollups row === */}
      <div className="grid grid--auto">
        <Card>
          <CardHeader title="Skill momentum" help="The four competencies the audit ties to the highest-value skill: data-informed product decision making." />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-3)' }}>
              {domainProgress.map((row) => (
                <div key={row.label} className="col" style={{ gap: 4 }}>
                  <div className="row row--between">
                    <span className="text-xs text-secondary">{row.label}</span>
                    <span className="text-xs tnum text-tertiary">
                      {row.skill!.currentScore.toFixed(1)}
                      <span className="text-quaternary"> / {row.skill!.targetScore.toFixed(1)}</span>
                      {row.skill!.currentScore > row.skill!.baselineScore ? (
                        <span className="text-success">
                          {' '}
                          +{(row.skill!.currentScore - row.skill!.baselineScore).toFixed(1)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <ProgressBar
                    value={(row.skill!.currentScore / 10) * 100}
                    size="sm"
                    marker={(row.skill!.targetScore / 10) * 100}
                    tone={row.skill!.currentScore >= row.skill!.targetScore ? 'success' : undefined}
                  />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Reading"
            subtitle={`${readingProgress.finished} of ${readingProgress.total} finished`}
            help="Two to three books per quarter. The six flagged as core interview resources come straight from Part 7 of the audit."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/reading')}>
                Open
              </Button>
            }
          />
          <CardBody>
            {readingProgress.reading.length === 0 ? (
              <EmptyState icon="📖" title="Nothing in progress" body="Pick up one of the six core interview books." />
            ) : (
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                {readingProgress.reading.map((book) => (
                  <div key={book.id} className="col" style={{ gap: 4 }}>
                    <div className="row row--between">
                      <span className="text-xs text-secondary truncate">{book.title}</span>
                      <span className="text-xs tnum text-tertiary">{book.progress}%</span>
                    </div>
                    <ProgressBar value={book.progress} size="sm" live />
                    <span className="text-2xs text-quaternary truncate">{book.author}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="LinkedIn"
            subtitle="Personal brand and reach"
            help="The audit's diagnosis: outside your network almost nobody knows you. That is a distribution problem, not a talent problem."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/linkedin')}>
                Open
              </Button>
            }
          />
          <CardBody>
            {latestLinkedIn ? (
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                <div className="row" style={{ gap: 'var(--space-5)' }}>
                  <Stat
                    label="Followers"
                    value={latestLinkedIn.followers.toLocaleString()}
                    delta={
                      firstLinkedIn
                        ? { value: latestLinkedIn.followers - firstLinkedIn.followers }
                        : undefined
                    }
                  />
                  <Stat label="Connections" value={latestLinkedIn.connections.toLocaleString()} />
                </div>
                <hr className="divider" />
                <div className="col" style={{ gap: 6 }}>
                  {data.linkedin.weeklyCadence.slice(0, 3).map((row) => (
                    <div key={row.label} className="row row--between">
                      <span className="text-xs text-secondary truncate">{row.label}</span>
                      <span className="text-xs tnum text-tertiary shrink-0">
                        {row.target} {row.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon="📣" title="No snapshots yet" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Networking"
            subtitle={`${data.networking.contacts.length} contacts · ${networkingDue.length} action${networkingDue.length === 1 ? '' : 's'} due`}
            help="Referral-backed applications beat high-volume submissions. Five referrals from target companies is an explicit audit success metric."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/networking')}>
                Open
              </Button>
            }
          />
          <CardBody>
            {networkingDue.length === 0 ? (
              <EmptyState icon="✓" title="No actions due" body="Nothing overdue in the network." />
            ) : (
              <div className="col" style={{ gap: 'var(--space-2)' }}>
                {networkingDue.slice(0, 4).map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => navigate(`/networking#${contact.id}`)}
                    className="col"
                    style={{ gap: 2, textAlign: 'left', width: '100%' }}
                  >
                    <div className="row row--between">
                      <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {contact.name}
                      </span>
                      <Badge tone={contact.nextActionDate! < derived.today ? 'danger' : 'warning'}>
                        {formatRelative(contact.nextActionDate)}
                      </Badge>
                    </div>
                    <span className="text-2xs text-quaternary truncate">{contact.nextAction}</span>
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ======================== milestones + portfolio + achievement === */}
      <div className="grid grid--auto-lg">
        <Card>
          <CardHeader
            title="Upcoming milestones"
            help="Each month's measurable output. These are the audit's own targets, not invented ones."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/roadmap')}>
                Roadmap
              </Button>
            }
          />
          <CardBody className="card__body--tight">
            <div className="col" style={{ gap: 'var(--space-3)' }}>
              {upcomingMilestones.map(({ chapter: c, pct }) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/learning-path#${c.id}`)}
                  className="col"
                  style={{ gap: 5, textAlign: 'left', width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}
                >
                  <div className="row row--between">
                    <span className="row text-sm" style={{ gap: 6, minWidth: 0 }}>
                      <Badge tone={c.month === timeline.currentMonth ? 'accent' : 'neutral'}>M{c.month}</Badge>
                      <span className="truncate" style={{ color: 'var(--text-primary)' }}>
                        {c.title}
                      </span>
                    </span>
                    <span className="text-2xs tnum text-quaternary shrink-0">{Math.round(pct)}%</span>
                  </div>
                  <span className="text-2xs text-tertiary clamp-1">{c.measurableOutput}</span>
                  <ProgressBar value={pct} size="xs" tone={pct >= 100 ? 'success' : undefined} />
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Portfolio"
            subtitle={`${publishedCount} published · ${activeProjects.length} in progress`}
            help="Ranked by the audit's own ROI ordering in Part 5. The redesign and the AI copilot are ranked first and second for a reason."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/portfolio')}>
                Open
              </Button>
            }
          />
          <CardBody className="card__body--tight">
            <div className="col" style={{ gap: 'var(--space-3)' }}>
              {(activeProjects.length > 0 ? activeProjects : data.portfolio.slice(0, 4))
                .slice(0, 4)
                .map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => navigate(`/portfolio#${project.id}`)}
                    className="col"
                    style={{ gap: 5, textAlign: 'left', width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}
                  >
                    <div className="row row--between">
                      <span className="row text-sm" style={{ gap: 6, minWidth: 0 }}>
                        <Badge tone="neutral">#{project.roiRank}</Badge>
                        <span className="truncate" style={{ color: 'var(--text-primary)' }}>
                          {project.title}
                        </span>
                      </span>
                      <span className="text-2xs tnum text-quaternary shrink-0">{project.completion}%</span>
                    </div>
                    <ProgressBar
                      value={project.completion}
                      size="xs"
                      tone={project.publishStatus === 'published' ? 'success' : undefined}
                      live={project.status === 'in-progress'}
                    />
                    <span className="text-2xs text-quaternary">
                      Due {formatDate(project.targetDate)} · {project.publishStatus}
                    </span>
                  </button>
                ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Latest achievement"
            help="Achievements unlock from real evidence — hours logged, artefacts published, scores reached — never from opening the app."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/achievements')}>
                All
              </Button>
            }
          />
          <CardBody>
            {derived.latestAchievement ? (
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                <div className="row" style={{ gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 32, lineHeight: 1 }}>{derived.latestAchievement.icon}</span>
                  <div className="col grow" style={{ gap: 2 }}>
                    <span className="text-sm" style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                      {derived.latestAchievement.name}
                    </span>
                    <span className="text-2xs text-quaternary">
                      {formatRelative(derived.latestAchievement.unlockedAt?.slice(0, 10))} ·{' '}
                      {derived.latestAchievement.tier}
                    </span>
                  </div>
                  <Badge tone="accent">+{derived.latestAchievement.xp}</Badge>
                </div>
                <p className="text-xs text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                  {derived.latestAchievement.description}
                </p>

                <hr className="divider" />

                <span className="section-title">Closest to unlocking</span>
                <div className="col" style={{ gap: 'var(--space-2)' }}>
                  {data.achievements.achievements
                    .filter((a) => !derived.achievements.unlocked.has(a.id))
                    .map((a) => ({ a, progress: derived.achievements.progress.get(a.id) }))
                    .filter((row) => row.progress && row.progress.pct > 0 && row.progress.pct < 100)
                    .sort((x, y) => (y.progress!.pct ?? 0) - (x.progress!.pct ?? 0))
                    .slice(0, 3)
                    .map(({ a, progress }) => (
                      <div key={a.id} className="col" style={{ gap: 3 }}>
                        <div className="row row--between">
                          <span className="text-xs text-secondary truncate">
                            {a.icon} {a.name}
                          </span>
                          <span className="text-2xs tnum text-quaternary">
                            {progress!.current}/{progress!.target}
                          </span>
                        </div>
                        <ProgressBar value={progress!.pct} size="xs" />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <EmptyState icon="🏆" title="Nothing unlocked yet" body="Complete your first task to get started." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Target companies"
            subtitle={`${data.applications.targetCompanies.filter((c) => c.watching).length} on the watchlist`}
            help="Fit scores are your own assessment of how well your profile maps onto each company. Tier 2 is where the audit says you are most realistically competitive."
            actions={
              <Button variant="ghost" size="sm" onClick={() => navigate('/applications')}>
                Open
              </Button>
            }
          />
          <CardBody className="card__body--tight">
            <div className="col" style={{ gap: 'var(--space-2)' }}>
              {data.applications.targetCompanies
                .filter((c) => c.watching)
                .sort((a, b) => b.fit - a.fit)
                .slice(0, 7)
                .map((company) => (
                  <div key={company.id} className="row row--between" style={{ gap: 'var(--space-2)' }}>
                    <span className="row text-sm" style={{ gap: 6, minWidth: 0 }}>
                      <Badge tone={company.tier === 1 ? 'danger' : company.tier === 2 ? 'accent' : 'neutral'}>
                        T{company.tier}
                      </Badge>
                      <span className="truncate text-secondary">{company.name}</span>
                    </span>
                    <div className="row shrink-0" style={{ gap: 6, width: 84 }}>
                      <ProgressBar value={company.fit} size="xs" tone={company.fit >= 80 ? 'success' : undefined} />
                      <span className="text-2xs tnum text-quaternary">{company.fit}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ======================== bottleneck === */}
      <Card variant="inset">
        <CardBody>
          <div className="grid grid--auto-lg">
            <div className="col" style={{ gap: 'var(--space-2)' }}>
              <span className="section-title">Biggest bottleneck</span>
              <p className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-relaxed)' }}>
                {data.profile.bottleneck}
              </p>
            </div>
            <div className="col" style={{ gap: 'var(--space-2)' }}>
              <span className="section-title">Highest-value skill</span>
              <p className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-relaxed)' }}>
                {data.profile.highestValueSkill}
              </p>
            </div>
            <div className="col" style={{ gap: 'var(--space-3)' }}>
              <span className="section-title">Projected completion</span>
              <Stat
                label="At current pace"
                value={
                  projection.projectedCompletion
                    ? formatMonthShort(projection.projectedCompletion)
                    : 'No pace yet'
                }
                size="md"
                tone={projection.onTrack ? 'success' : 'warning'}
                meta={
                  projection.weeksAtCurrentPace
                    ? `${projection.weeksAtCurrentPace} weeks · ${projection.hoursRemaining}h remaining`
                    : `${projection.hoursRemaining}h remaining`
                }
                help={`At the ${data.profile.weeklyHourTarget}h/week target this finishes in ${projection.weeksAtTargetPace} weeks (${formatMonthShort(projection.targetCompletion)}). Current velocity is ${hours.weeklyVelocity}h/week.`}
              />
              <InlineEdit
                value={data.profile.weeklyHourTarget}
                numeric
                ariaLabel="Weekly hour target"
                onCommit={(next) => {
                  const parsed = Number(next)
                  if (!Number.isFinite(parsed) || parsed <= 0) return
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, weeklyHourTarget: parsed } }),
                    ['profile'],
                    'weekly hour target',
                  )
                }}
                className="text-xs"
              />
              <span className="text-2xs text-quaternary">Weekly hour target — click to edit</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="text-2xs text-quaternary" style={{ textAlign: 'center', paddingBottom: 'var(--space-4)' }}>
        Programme started {formatDate(data.profile.startDate, { year: true })} · ends{' '}
        {formatDate(timeline.endDate, { year: true })} · next milestone{' '}
        {formatDate(addDays(derived.today, 7))}
      </div>
    </div>
  )
}
