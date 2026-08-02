/* ============================================================================
   Learning Path — the heart of the application
   ----------------------------------------------------------------------------
   The 24-month roadmap as a tree: Chapter (month) → Mission → Task → Subtask.
   Everything is editable inline, tasks reorder by drag, and completing work
   logs hours so the streak and charts stay honest.
   ========================================================================= */

import { useEffect, useMemo, useState } from 'react'

import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  DeleteButton,
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
  Tooltip,
  useReorder,
} from '../components/ui'
import { PageHeader } from '../components/layout/Shell'
import { formatDate, formatHours } from '../lib/dates'
import { chapterProgress, missionProgress, taskCompletion } from '../lib/derive'
import { addHoursToToday } from '../lib/logging'
import { useRoute, useScrollToAnchor } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { Chapter, Difficulty, ID, Mission, PathTask, Status, TaskArea } from '../lib/types'

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'dropped', label: 'Dropped' },
]

const STATUS_TONE = {
  'not-started': 'neutral',
  'in-progress': 'info',
  blocked: 'danger',
  done: 'success',
  dropped: 'neutral',
} as const

const DIFFICULTY_LABELS = ['', 'Trivial', 'Easy', 'Moderate', 'Hard', 'Very hard']

type Filter = 'all' | 'current' | 'open' | 'done'

export function LearningPath() {
  const { data, derived, update, patch, toast } = useStore()
  const route = useRoute()

  const [filter, setFilter] = useState<Filter>('current')
  const [query, setQuery] = useState('')
  const [expandedChapters, setExpandedChapters] = useState<Set<ID>>(new Set())
  const [expandedTasks, setExpandedTasks] = useState<Set<ID>>(new Set())

  // Open the current chapter on first load, and any chapter deep-linked to.
  useEffect(() => {
    const current = derived.timeline.currentChapter
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (current) next.add(current.id)
      if (route.anchor) next.add(route.anchor)
      return next
    })
  }, [derived.timeline.currentChapter, route.anchor])

  useScrollToAnchor(route.anchor, [expandedChapters.size])

  const chapters = useMemo(() => {
    const q = query.trim().toLowerCase()

    return data.roadmap.chapters.filter((chapter) => {
      if (q) {
        const haystack = [
          chapter.title,
          chapter.focus,
          chapter.measurableOutput,
          ...chapter.missions.flatMap((m) => [m.title, m.summary, ...m.tasks.map((t) => t.title)]),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      const progress = chapterProgress(chapter)
      switch (filter) {
        case 'current':
          // The current month plus the next two, so the page opens on what matters.
          return (
            chapter.month >= derived.timeline.currentMonth &&
            chapter.month <= derived.timeline.currentMonth + 2
          )
        case 'open':
          return progress.pct < 100
        case 'done':
          return progress.pct >= 100
        default:
          return true
      }
    })
  }, [data.roadmap.chapters, derived.timeline.currentMonth, filter, query])

  /* --------------------------------------------------------- mutations --- */

  /** Replace one task inside the nested roadmap structure. */
  const updateTask = (chapterId: ID, missionId: ID, taskId: ID, producer: (task: PathTask) => PathTask, label: string) => {
    update(
      (draft) => ({
        ...draft,
        roadmap: {
          ...draft.roadmap,
          chapters: draft.roadmap.chapters.map((chapter) =>
            chapter.id !== chapterId
              ? chapter
              : {
                  ...chapter,
                  missions: chapter.missions.map((mission) =>
                    mission.id !== missionId
                      ? mission
                      : recomputeMissionStatus({
                          ...mission,
                          tasks: mission.tasks.map((task) => (task.id === taskId ? producer(task) : task)),
                        }),
                  ),
                },
          ),
        },
      }),
      ['roadmap'],
      label,
    )
  }

  const updateMission = (chapterId: ID, missionId: ID, producer: (mission: Mission) => Mission, label: string) => {
    update(
      (draft) => ({
        ...draft,
        roadmap: {
          ...draft.roadmap,
          chapters: draft.roadmap.chapters.map((chapter) =>
            chapter.id !== chapterId
              ? chapter
              : {
                  ...chapter,
                  missions: chapter.missions.map((mission) => (mission.id === missionId ? producer(mission) : mission)),
                },
          ),
        },
      }),
      ['roadmap'],
      label,
    )
  }

  const updateChapter = (chapterId: ID, producer: (chapter: Chapter) => Chapter, label: string) => {
    update(
      (draft) => ({
        ...draft,
        roadmap: {
          ...draft.roadmap,
          chapters: draft.roadmap.chapters.map((chapter) => (chapter.id === chapterId ? producer(chapter) : chapter)),
        },
      }),
      ['roadmap'],
      label,
    )
  }

  /** Mission status follows its tasks — never set by hand. */
  const recomputeMissionStatus = (mission: Mission): Mission => {
    const tasks = mission.tasks
    const allDone = tasks.length > 0 && tasks.every((t) => t.status === 'done' || t.status === 'dropped')
    const anyStarted = tasks.some((t) => t.status !== 'not-started')
    return { ...mission, status: allDone ? 'done' : anyStarted ? 'in-progress' : 'not-started' }
  }

  /**
   * Completing a task marks it done and logs its hours in one `update()`.
   *
   * Two separate calls would push two entries onto the undo stack, so a single
   * Cmd+Z would revert the logged hours but leave the task ticked — the kind of
   * half-undo that quietly corrupts a two-year record.
   */
  const toggleTaskDone = (chapter: Chapter, mission: Mission, task: PathTask) => {
    const wasDone = task.status === 'done'

    update(
      (draft) => {
        const roadmap = {
          ...draft.roadmap,
          chapters: draft.roadmap.chapters.map((c) =>
            c.id !== chapter.id
              ? c
              : {
                  ...c,
                  missions: c.missions.map((m) =>
                    m.id !== mission.id
                      ? m
                      : recomputeMissionStatus({
                          ...m,
                          tasks: m.tasks.map((t) =>
                            t.id !== task.id
                              ? t
                              : {
                                  ...t,
                                  status: (wasDone ? 'not-started' : 'done') as Status,
                                  completedAt: wasDone ? undefined : derived.today,
                                  actualHours: wasDone
                                    ? 0
                                    : t.actualHours > 0
                                      ? t.actualHours
                                      : t.estimatedHours,
                                  // Finishing a task implies its subtasks are finished.
                                  subtasks: t.subtasks.map((s) => ({ ...s, done: wasDone ? s.done : true })),
                                },
                          ),
                        }),
                  ),
                },
          ),
        }

        // Re-opening a task leaves the logged hours alone: the work happened.
        if (wasDone) return { ...draft, roadmap }

        const activity = addHoursToToday(draft.analytics.activity, derived.today, {
          hours: task.estimatedHours,
          xp: task.xp,
          area: inferArea(task, chapter),
          skillIds: task.skillIds,
        })

        return { ...draft, roadmap, analytics: { ...draft.analytics, activity } }
      },
      wasDone ? ['roadmap'] : ['roadmap', 'analytics'],
      wasDone ? 'reopen task' : 'complete task',
    )

    if (!wasDone) {
      toast({
        tone: 'success',
        title: `+${task.xp} XP · ${task.title}`,
        detail: `${formatHours(task.estimatedHours)} logged to today.`,
        duration: 3000,
      })
    }
  }

  const toggleSubtask = (chapter: Chapter, mission: Mission, task: PathTask, subtaskId: ID) => {
    updateTask(
      chapter.id,
      mission.id,
      task.id,
      (t) => {
        const subtasks = t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s))
        const anyDone = subtasks.some((s) => s.done)
        const allDone = subtasks.length > 0 && subtasks.every((s) => s.done)
        // Status follows the subtasks, but never auto-completes: marking the task
        // done is a deliberate act that logs hours.
        const status: Status =
          t.status === 'done' ? 'done' : allDone || anyDone ? 'in-progress' : 'not-started'
        return { ...t, subtasks, status }
      },
      'toggle subtask',
    )
  }

  const addTask = (chapter: Chapter, mission: Mission) => {
    const task: PathTask = {
      id: newId('tk'),
      title: 'New task',
      description: '',
      status: 'not-started',
      estimatedHours: 2,
      actualHours: 0,
      difficulty: 3,
      xp: 55,
      subtasks: [],
      skillIds: [],
      resources: [],
      dependencies: [],
      dueDate: undefined,
      notes: '',
      order: mission.tasks.length,
    }
    updateMission(chapter.id, mission.id, (m) => ({ ...m, tasks: [...m.tasks, task] }), 'add task')
    setExpandedTasks((prev) => new Set(prev).add(task.id))
  }

  const deleteTask = (chapter: Chapter, mission: Mission, taskId: ID) => {
    updateMission(
      chapter.id,
      mission.id,
      (m) => recomputeMissionStatus({ ...m, tasks: m.tasks.filter((t) => t.id !== taskId) }),
      'delete task',
    )
  }

  const addMission = (chapter: Chapter) => {
    const mission: Mission = {
      id: newId('ms'),
      title: 'New mission',
      summary: '',
      rationale: '',
      status: 'not-started',
      tasks: [],
      xpBonus: 250,
      reflectionPrompt: 'What did this mission teach you?',
      reflection: '',
      order: chapter.missions.length,
    }
    updateChapter(chapter.id, (c) => ({ ...c, missions: [...c.missions, mission] }), 'add mission')
  }

  /* --------------------------------------------------------------- view -- */

  const totals = useMemo(() => {
    const all = data.roadmap.chapters.flatMap((c) => c.missions.flatMap((m) => m.tasks))
    return {
      tasks: all.length,
      done: all.filter((t) => t.status === 'done').length,
      hours: all.reduce((sum, t) => sum + t.estimatedHours, 0),
      doneHours: all.filter((t) => t.status === 'done').reduce((sum, t) => sum + t.estimatedHours, 0),
      xp: all.reduce((sum, t) => sum + t.xp, 0),
    }
  }, [data.roadmap.chapters])

  const skillNames = useMemo(() => new Map(data.skills.map((s) => [s.id, s.name])), [data.skills])

  return (
    <div className="page">
      <PageHeader
        title="Learning Path"
        lede={`The full 24-month programme as a learning tree — ${data.roadmap.chapters.length} chapters, ${data.roadmap.chapters.reduce((s, c) => s + c.missions.length, 0)} missions, ${totals.tasks} tasks, ${Math.round(totals.hours)} estimated hours. Every task is editable, reorderable, and logs its hours to your activity record when you complete it.`}
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search chapters and tasks…" size="sm" />
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'current', label: 'Current', count: 3 },
                { value: 'open', label: 'Open' },
                { value: 'done', label: 'Done' },
                { value: 'all', label: 'All', count: data.roadmap.chapters.length },
              ]}
            />
          </>
        }
      />

      {/* Programme summary */}
      <Card variant="inset">
        <CardBody className="card__body--tight">
          <div className="row row--wrap" style={{ gap: 'var(--space-6)', alignItems: 'center' }}>
            <Ring
              value={derived.roadmapProgress.pct}
              size={64}
              thickness={6}
              display={`${Math.round(derived.roadmapProgress.pct)}`}
              label="%"
            />
            <div className="col" style={{ gap: 2 }}>
              <span className="text-xs text-tertiary">Tasks complete</span>
              <span className="text-sm tnum" style={{ fontWeight: 'var(--weight-semibold)' }}>
                {totals.done} / {totals.tasks}
              </span>
            </div>
            <div className="col" style={{ gap: 2 }}>
              <span className="text-xs text-tertiary">Hours</span>
              <span className="text-sm tnum" style={{ fontWeight: 'var(--weight-semibold)' }}>
                {Math.round(totals.doneHours)} / {Math.round(totals.hours)}
              </span>
            </div>
            <div className="col" style={{ gap: 2 }}>
              <span className="text-xs text-tertiary">XP available</span>
              <span className="text-sm tnum" style={{ fontWeight: 'var(--weight-semibold)' }}>
                {totals.xp.toLocaleString()}
              </span>
            </div>
            <div className="col grow" style={{ gap: 5, minWidth: 200 }}>
              <div className="row row--between text-xs">
                <span className="text-tertiary">
                  Progress vs calendar
                  <HelpDot>
                    The marker shows where the calendar says you should be ({derived.timeline.timePct}%
                    of the programme has elapsed). Being behind is normal early on — the first months
                    are the densest.
                  </HelpDot>
                </span>
                <span
                  className="tnum"
                  style={{
                    color: derived.timeline.paceDelta >= 0 ? 'var(--success-text)' : 'var(--warning-text)',
                  }}
                >
                  {derived.timeline.paceDelta >= 0 ? '+' : ''}
                  {derived.timeline.paceDelta}
                </span>
              </div>
              <ProgressBar
                value={derived.roadmapProgress.pct}
                marker={derived.timeline.timePct}
                size="md"
                gradient
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Phases */}
      <div className="grid grid--auto-sm">
        {data.roadmap.phases.map((phase) => {
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
            <Card key={phase.id} variant={active ? 'accent' : 'default'}>
              <CardBody className="card__body--tight">
                <div className="col" style={{ gap: 6 }}>
                  <div className="row row--between">
                    <span className="text-xs" style={{ fontWeight: 'var(--weight-semibold)' }}>
                      {phase.label}
                    </span>
                    <span className="text-2xs tnum text-quaternary">
                      M{phase.months[0]}–{phase.months[1]}
                    </span>
                  </div>
                  <span className="text-2xs text-tertiary clamp-2" style={{ minHeight: 26 }}>
                    {phase.theme}
                  </span>
                  <ProgressBar
                    value={pct}
                    size="xs"
                    tone={pct >= 100 ? 'success' : undefined}
                    className=""
                  />
                  <span className="text-2xs tnum text-quaternary">{Math.round(pct)}%</span>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {/* Chapters */}
      {chapters.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔍"
            title="No chapters match"
            body={query ? `Nothing matches “${query}”.` : 'Try a different filter.'}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          {chapters.map((chapter) => {
            const progress = chapterProgress(chapter)
            const isOpen = expandedChapters.has(chapter.id)
            const isCurrent = chapter.month === derived.timeline.currentMonth
            const locked = chapter.month > derived.timeline.currentMonth
            const complete = progress.pct >= 100

            return (
              <Card key={chapter.id} id={chapter.id} variant={isCurrent ? 'accent' : 'default'}>
                {/* Chapter header */}
                <div
                  className="card__header"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setExpandedChapters((prev) => {
                      const next = new Set(prev)
                      if (next.has(chapter.id)) next.delete(chapter.id)
                      else next.add(chapter.id)
                      return next
                    })
                  }
                >
                  <div className="row" style={{ gap: 'var(--space-3)', minWidth: 0, flex: 1 }}>
                    <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={16} />

                    <Ring
                      value={progress.pct}
                      size={40}
                      thickness={4}
                      tone={complete ? 'success' : undefined}
                      display={complete ? '✓' : `${Math.round(progress.pct)}`}
                      valueSize={complete ? 14 : 11}
                    />

                    <div className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                      <div className="row" style={{ gap: 'var(--space-2)', minWidth: 0 }}>
                        <Badge tone={isCurrent ? 'accent' : locked ? 'neutral' : complete ? 'success' : 'info'}>
                          {chapter.monthSpan
                            ? `M${chapter.monthSpan[0]}–${chapter.monthSpan[1]}`
                            : `Month ${chapter.month}`}
                        </Badge>
                        <span
                          className="truncate"
                          style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' }}
                        >
                          {chapter.title}
                        </span>
                        {isCurrent ? <Badge tone="accent" dot>Current</Badge> : null}
                        {locked ? (
                          <Tooltip content="Not started yet — this month is still ahead of you. Nothing stops you working early.">
                            <span style={{ color: 'var(--text-quaternary)', display: 'inline-flex' }}>
                              <Icon name="lock" size={12} />
                            </span>
                          </Tooltip>
                        ) : null}
                      </div>
                      <span className="text-xs text-tertiary truncate">
                        <strong style={{ color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>
                          Output:
                        </strong>{' '}
                        {chapter.measurableOutput}
                      </span>
                    </div>
                  </div>

                  <div className="row shrink-0" style={{ gap: 'var(--space-3)' }}>
                    <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                      <span className="text-xs tnum text-tertiary">
                        {progress.done}/{progress.total} tasks
                      </span>
                      <span className="text-2xs tnum text-quaternary">{chapter.estimatedHours}h · Q{chapter.quarter}</span>
                    </div>
                    <Tooltip
                      title={`Difficulty: ${DIFFICULTY_LABELS[chapter.difficulty]}`}
                      content={`Expected ROI: ${chapter.expectedRoi.replace('-', ' ')}. Focus: ${chapter.focus}.`}
                    >
                      <Badge
                        tone={
                          chapter.expectedRoi === 'very-high'
                            ? 'success'
                            : chapter.expectedRoi === 'high'
                              ? 'accent'
                              : 'neutral'
                        }
                      >
                        {chapter.expectedRoi === 'very-high' ? 'ROI ★★★' : chapter.expectedRoi === 'high' ? 'ROI ★★' : 'ROI ★'}
                      </Badge>
                    </Tooltip>
                  </div>
                </div>

                {isOpen ? (
                  <CardBody className="animate-in">
                    {/* Chapter context */}
                    <div className="grid grid--auto" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                      <div className="col" style={{ gap: 'var(--space-2)' }}>
                        <span className="section-title">Target outcomes</span>
                        {chapter.targetOutcomes.map((outcome) => (
                          <div key={outcome} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--accent-text)', fontSize: 10, marginTop: 3 }}>◆</span>
                            <span className="text-xs text-secondary">{outcome}</span>
                          </div>
                        ))}
                      </div>

                      <div className="col" style={{ gap: 'var(--space-2)' }}>
                        <span className="section-title">
                          Commitments this month
                          <HelpDot>
                            The throughput commitments that run alongside every chapter. Missing these
                            is what quietly derails the programme — the chapter work is visible, the
                            cadence is not.
                          </HelpDot>
                        </span>
                        {(
                          [
                            ['Writing', chapter.commitments.writing],
                            ['Networking', chapter.commitments.networking],
                            ['Interview', chapter.commitments.interviewPractice],
                            ['Portfolio', chapter.commitments.portfolio],
                            ['Applications', chapter.commitments.applications],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                            <span
                              className="text-2xs shrink-0"
                              style={{ color: 'var(--text-quaternary)', width: 74, paddingTop: 1 }}
                            >
                              {label}
                            </span>
                            <span className="text-xs text-secondary">{value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="col" style={{ gap: 'var(--space-2)' }}>
                        <span className="section-title">Competencies developed</span>
                        <div className="row row--wrap" style={{ gap: 4 }}>
                          {chapter.skillIds.map((skillId) => (
                            <Badge key={skillId} tone="neutral">
                              {skillNames.get(skillId) ?? skillId}
                            </Badge>
                          ))}
                        </div>
                        {chapter.dependencies.length > 0 ? (
                          <>
                            <span className="section-title" style={{ marginTop: 'var(--space-2)' }}>
                              Depends on
                            </span>
                            <div className="row row--wrap" style={{ gap: 4 }}>
                              {chapter.dependencies.map((depId) => {
                                const dep = data.roadmap.chapters.find((c) => c.id === depId)
                                const depDone = dep ? chapterProgress(dep).pct >= 100 : false
                                return (
                                  <Badge key={depId} tone={depDone ? 'success' : 'warning'}>
                                    {depDone ? '✓' : '○'} Month {dep?.month ?? '?'}
                                  </Badge>
                                )
                              })}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* Missions */}
                    <div className="col" style={{ gap: 'var(--space-4)' }}>
                      {chapter.missions.map((mission) => (
                        <MissionBlock
                          key={mission.id}
                          chapter={chapter}
                          mission={mission}
                          skillNames={skillNames}
                          expandedTasks={expandedTasks}
                          setExpandedTasks={setExpandedTasks}
                          onToggleTask={(task) => toggleTaskDone(chapter, mission, task)}
                          onToggleSubtask={(task, subtaskId) => toggleSubtask(chapter, mission, task, subtaskId)}
                          onUpdateTask={(taskId, producer, label) =>
                            updateTask(chapter.id, mission.id, taskId, producer, label)
                          }
                          onDeleteTask={(taskId) => deleteTask(chapter, mission, taskId)}
                          onAddTask={() => addTask(chapter, mission)}
                          onUpdateMission={(producer, label) => updateMission(chapter.id, mission.id, producer, label)}
                          onReorderTasks={(orderedIds) =>
                            updateMission(
                              chapter.id,
                              mission.id,
                              (m) => ({
                                ...m,
                                tasks: m.tasks.map((t) => ({ ...t, order: orderedIds.indexOf(t.id) })),
                              }),
                              'reorder tasks',
                            )
                          }
                          achievement={
                            mission.achievementId
                              ? data.achievements.achievements.find((a) => a.id === mission.achievementId)
                              : undefined
                          }
                          achievementUnlocked={
                            mission.achievementId
                              ? derived.achievements.unlocked.has(mission.achievementId)
                              : false
                          }
                        />
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icon name="plus" size={13} />}
                        onClick={() => addMission(chapter)}
                      >
                        Add mission
                      </Button>
                    </div>
                  </CardBody>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <div className="text-2xs text-quaternary" style={{ textAlign: 'center', paddingBottom: 'var(--space-4)' }}>
        Showing {chapters.length} of {data.roadmap.chapters.length} chapters · changes save to{' '}
        <code>data/roadmap.json</code>
      </div>
      {/* patch is used by child interactions through closures above */}
      <span hidden>{typeof patch}</span>
    </div>
  )
}

/* ============================================================== mission == */

function MissionBlock({
  chapter,
  mission,
  skillNames,
  expandedTasks,
  setExpandedTasks,
  onToggleTask,
  onToggleSubtask,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onUpdateMission,
  onReorderTasks,
  achievement,
  achievementUnlocked,
}: {
  chapter: Chapter
  mission: Mission
  skillNames: Map<ID, string>
  expandedTasks: Set<ID>
  setExpandedTasks: React.Dispatch<React.SetStateAction<Set<ID>>>
  onToggleTask: (task: PathTask) => void
  onToggleSubtask: (task: PathTask, subtaskId: ID) => void
  onUpdateTask: (taskId: ID, producer: (task: PathTask) => PathTask, label: string) => void
  onDeleteTask: (taskId: ID) => void
  onAddTask: () => void
  onUpdateMission: (producer: (mission: Mission) => Mission, label: string) => void
  onReorderTasks: (orderedIds: ID[]) => void
  achievement?: { id: ID; name: string; icon: string; description: string; xp: number }
  achievementUnlocked: boolean
}) {
  const progress = missionProgress(mission)
  const { sorted, dragProps, move } = useReorder(mission.tasks, onReorderTasks)
  const [showReflection, setShowReflection] = useState(false)

  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-inset)',
        overflow: 'hidden',
      }}
    >
      {/* Mission header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-subtle)',
        }}
      >
        <div className="row row--between" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
            <div className="row" style={{ gap: 'var(--space-2)', minWidth: 0 }}>
              <Badge tone={STATUS_TONE[mission.status]} dot>
                {mission.status.replace('-', ' ')}
              </Badge>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', minWidth: 0 }}>
                <InlineEdit
                  value={mission.title}
                  onCommit={(next) => onUpdateMission((m) => ({ ...m, title: next }), 'rename mission')}
                  ariaLabel="Mission title"
                />
              </span>
              {mission.rationale ? (
                <HelpDot title="Why this mission exists">{mission.rationale}</HelpDot>
              ) : null}
            </div>
            <span className="text-xs text-tertiary">
              <InlineEdit
                value={mission.summary}
                placeholder="Add a summary…"
                onCommit={(next) => onUpdateMission((m) => ({ ...m, summary: next }), 'edit mission summary')}
                ariaLabel="Mission summary"
              />
            </span>
          </div>

          <div className="row shrink-0" style={{ gap: 'var(--space-3)' }}>
            {achievement ? (
              <Tooltip
                title={achievementUnlocked ? `Unlocked: ${achievement.name}` : `Locked: ${achievement.name}`}
                content={`${achievement.description} Worth ${achievement.xp} XP.`}
              >
                <Badge tone={achievementUnlocked ? 'success' : 'neutral'}>
                  {achievement.icon} {achievementUnlocked ? 'Earned' : 'Reward'}
                </Badge>
              </Tooltip>
            ) : null}
            <div className="col" style={{ width: 96, gap: 4 }}>
              <div className="row row--between text-2xs">
                <span className="text-quaternary">
                  {progress.done}/{progress.total}
                </span>
                <span className="tnum text-quaternary">{Math.round(progress.pct)}%</span>
              </div>
              <ProgressBar value={progress.pct} size="sm" tone={progress.pct >= 100 ? 'success' : undefined} />
            </div>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="col">
        {sorted.map((task, index) => {
          const isExpanded = expandedTasks.has(task.id)
          const completion = taskCompletion(task)
          const blockedBy = task.dependencies.filter((depId) => {
            const dep = chapter.missions.flatMap((m) => m.tasks).find((t) => t.id === depId)
            return dep && dep.status !== 'done'
          })

          return (
            <div
              key={task.id}
              {...dragProps(task.id)}
              style={{
                borderTop: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                background: 'var(--bg-base)',
                opacity: task.status === 'dropped' ? 0.5 : 1,
                transition: 'background var(--dur-fast) var(--ease-out)',
              }}
            >
              {/* Task row */}
              <div
                className="row"
                style={{ gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', alignItems: 'flex-start' }}
              >
                <span
                  style={{ color: 'var(--text-quaternary)', cursor: 'grab', paddingTop: 2 }}
                  title="Drag to reorder"
                >
                  <Icon name="drag" size={13} />
                </span>

                <div style={{ paddingTop: 1 }}>
                  <Checkbox
                    checked={task.status === 'done'}
                    onChange={() => onToggleTask(task)}
                    ariaLabel={`Complete ${task.title}`}
                  />
                </div>

                <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
                  <div className="row" style={{ gap: 'var(--space-2)', minWidth: 0, flexWrap: 'wrap' }}>
                    <span
                      className="text-sm"
                      style={{
                        color: task.status === 'done' ? 'var(--text-quaternary)' : 'var(--text-primary)',
                        textDecoration: task.status === 'done' ? 'line-through' : undefined,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <InlineEdit
                        value={task.title}
                        onCommit={(next) => onUpdateTask(task.id, (t) => ({ ...t, title: next }), 'rename task')}
                        ariaLabel="Task title"
                      />
                    </span>

                    {task.subtasks.length > 0 ? (
                      <span className="text-2xs tnum text-quaternary shrink-0">
                        {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                      </span>
                    ) : null}

                    {blockedBy.length > 0 ? (
                      <Tooltip content={`Blocked by ${blockedBy.length} unfinished task(s) in this chapter.`}>
                        <Badge tone="warning">blocked</Badge>
                      </Tooltip>
                    ) : null}

                    <Tooltip content={`Difficulty: ${DIFFICULTY_LABELS[task.difficulty]}`}>
                      <span className="text-2xs text-quaternary shrink-0" aria-label={`Difficulty ${task.difficulty} of 5`}>
                        {'●'.repeat(task.difficulty)}
                        <span style={{ opacity: 0.3 }}>{'●'.repeat(5 - task.difficulty)}</span>
                      </span>
                    </Tooltip>

                    <span className="text-2xs tnum text-quaternary shrink-0">{formatHours(task.estimatedHours)}</span>

                    <Tooltip content="XP awarded when this task completes">
                      <Badge tone={task.status === 'done' ? 'success' : 'neutral'}>{task.xp}</Badge>
                    </Tooltip>
                  </div>

                  {task.status === 'in-progress' && task.subtasks.length > 0 ? (
                    <ProgressBar value={completion} size="xs" live />
                  ) : null}

                  {task.skillIds.length > 0 ? (
                    <div className="row row--wrap" style={{ gap: 4 }}>
                      {task.skillIds.map((skillId) => (
                        <span key={skillId} className="text-2xs text-quaternary">
                          {skillNames.get(skillId)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="row shrink-0" style={{ gap: 2 }}>
                  <IconButton
                    title="Move up"
                    onClick={() => move(task.id, -1)}
                  >
                    <Icon name="chevronUp" size={12} />
                  </IconButton>
                  <IconButton title="Move down" onClick={() => move(task.id, 1)}>
                    <Icon name="chevronDown" size={12} />
                  </IconButton>
                  <IconButton
                    title={isExpanded ? 'Collapse' : 'Expand details'}
                    active={isExpanded}
                    onClick={() =>
                      setExpandedTasks((prev) => {
                        const next = new Set(prev)
                        if (next.has(task.id)) next.delete(task.id)
                        else next.add(task.id)
                        return next
                      })
                    }
                  >
                    <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} size={13} />
                  </IconButton>
                </div>
              </div>

              {/* Task detail */}
              {isExpanded ? (
                <div
                  className="col animate-in"
                  style={{
                    gap: 'var(--space-4)',
                    padding: 'var(--space-1) var(--space-4) var(--space-4) 58px',
                  }}
                >
                  {task.description ? (
                    <p
                      className="text-xs"
                      style={{
                        color: 'var(--text-secondary)',
                        lineHeight: 'var(--leading-normal)',
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--accent-subtle)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: '2px solid var(--accent)',
                      }}
                    >
                      {task.description}
                    </p>
                  ) : null}

                  {/* Subtasks */}
                  {task.subtasks.length > 0 ? (
                    <div className="col" style={{ gap: 'var(--space-1)' }}>
                      <span className="section-title">Subtasks</span>
                      {task.subtasks.map((subtask) => (
                        <div key={subtask.id} className="row" style={{ gap: 'var(--space-2)' }}>
                          <Checkbox
                            checked={subtask.done}
                            onChange={() => onToggleSubtask(task, subtask.id)}
                            ariaLabel={subtask.title}
                          />
                          <span
                            className="text-xs grow"
                            style={{
                              color: subtask.done ? 'var(--text-quaternary)' : 'var(--text-secondary)',
                              textDecoration: subtask.done ? 'line-through' : undefined,
                            }}
                          >
                            <InlineEdit
                              value={subtask.title}
                              onCommit={(next) =>
                                onUpdateTask(
                                  task.id,
                                  (t) => ({
                                    ...t,
                                    subtasks: t.subtasks.map((s) =>
                                      s.id === subtask.id ? { ...s, title: next } : s,
                                    ),
                                  }),
                                  'rename subtask',
                                )
                              }
                              ariaLabel="Subtask title"
                            />
                          </span>
                          <IconButton
                            title="Remove subtask"
                            tone="danger"
                            onClick={() =>
                              onUpdateTask(
                                task.id,
                                (t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.id !== subtask.id) }),
                                'delete subtask',
                              )
                            }
                          >
                            <Icon name="x" size={11} />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Icon name="plus" size={12} />}
                    onClick={() =>
                      onUpdateTask(
                        task.id,
                        (t) => ({
                          ...t,
                          subtasks: [...t.subtasks, { id: newId('st'), title: 'New subtask', done: false }],
                        }),
                        'add subtask',
                      )
                    }
                  >
                    Add subtask
                  </Button>

                  {/* Resources */}
                  {task.resources.length > 0 ? (
                    <div className="col" style={{ gap: 'var(--space-2)' }}>
                      <span className="section-title">Required resources</span>
                      <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
                        {task.resources.map((resource) => (
                          <a
                            key={resource.url}
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="row text-xs"
                            style={{
                              gap: 5,
                              padding: '3px var(--space-2)',
                              background: 'var(--bg-inset)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <Icon name="external" size={11} />
                            {resource.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Editable fields */}
                  <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
                    <div className="field">
                      <span className="field__label">Status</span>
                      <Select
                        value={task.status}
                        size="sm"
                        options={STATUS_OPTIONS}
                        onChange={(next) =>
                          onUpdateTask(
                            task.id,
                            (t) => ({
                              ...t,
                              status: next,
                              completedAt: next === 'done' ? (t.completedAt ?? new Date().toISOString().slice(0, 10)) : undefined,
                            }),
                            'change task status',
                          )
                        }
                      />
                    </div>

                    <div className="field">
                      <span className="field__label">Estimated hours</span>
                      <input
                        className="input input--sm input--num"
                        type="number"
                        step={0.5}
                        min={0}
                        value={task.estimatedHours}
                        onChange={(e) =>
                          onUpdateTask(
                            task.id,
                            (t) => ({ ...t, estimatedHours: Math.max(0, Number(e.target.value) || 0) }),
                            'edit estimated hours',
                          )
                        }
                      />
                    </div>

                    <div className="field">
                      <span className="field__label">Actual hours</span>
                      <input
                        className="input input--sm input--num"
                        type="number"
                        step={0.5}
                        min={0}
                        value={task.actualHours}
                        onChange={(e) =>
                          onUpdateTask(
                            task.id,
                            (t) => ({ ...t, actualHours: Math.max(0, Number(e.target.value) || 0) }),
                            'edit actual hours',
                          )
                        }
                      />
                    </div>

                    <div className="field">
                      <span className="field__label">Difficulty</span>
                      <Select
                        value={String(task.difficulty) as '1' | '2' | '3' | '4' | '5'}
                        size="sm"
                        options={[1, 2, 3, 4, 5].map((n) => ({
                          value: String(n) as '1' | '2' | '3' | '4' | '5',
                          label: `${n} — ${DIFFICULTY_LABELS[n]}`,
                        }))}
                        onChange={(next) =>
                          onUpdateTask(
                            task.id,
                            (t) => ({ ...t, difficulty: Number(next) as Difficulty }),
                            'edit difficulty',
                          )
                        }
                      />
                    </div>

                    <div className="field">
                      <span className="field__label">Due date</span>
                      <input
                        className="input input--sm"
                        type="date"
                        value={task.dueDate ?? ''}
                        onChange={(e) =>
                          onUpdateTask(task.id, (t) => ({ ...t, dueDate: e.target.value || undefined }), 'edit due date')
                        }
                      />
                    </div>

                    <div className="field">
                      <span className="field__label">XP reward</span>
                      <input
                        className="input input--sm input--num"
                        type="number"
                        step={5}
                        min={0}
                        value={task.xp}
                        onChange={(e) =>
                          onUpdateTask(task.id, (t) => ({ ...t, xp: Math.max(0, Number(e.target.value) || 0) }), 'edit xp')
                        }
                      />
                    </div>
                  </div>

                  <div className="field">
                    <span className="field__label">Notes</span>
                    <InlineEdit
                      value={task.notes}
                      multiline
                      placeholder="Notes on this task — what you tried, what worked, what to remember…"
                      onCommit={(next) => onUpdateTask(task.id, (t) => ({ ...t, notes: next }), 'edit task notes')}
                      ariaLabel="Task notes"
                    />
                  </div>

                  <div className="row row--between">
                    <span className="text-2xs text-quaternary">
                      {task.completedAt ? `Completed ${formatDate(task.completedAt)}` : `Task id ${task.id}`}
                    </span>
                    <DeleteButton onDelete={() => onDeleteTask(task.id)} label="Delete task" />
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}

        {/* Mission footer */}
        <div
          className="row row--between"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderTop: '1px solid var(--border-subtle)',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          <Button variant="ghost" size="sm" icon={<Icon name="plus" size={12} />} onClick={onAddTask}>
            Add task
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReflection((open) => !open)}
            icon={<Icon name="edit" size={12} />}
          >
            {mission.reflection ? 'Reflection ✓' : 'Reflection'}
          </Button>
        </div>

        {showReflection ? (
          <div
            className="col animate-in"
            style={{
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-inset)',
            }}
          >
            <span className="text-xs" style={{ color: 'var(--accent-text)', fontWeight: 'var(--weight-medium)' }}>
              {mission.reflectionPrompt}
            </span>
            <InlineEdit
              value={mission.reflection}
              multiline
              placeholder="Write your answer. Reflection is what turns hours into learning."
              onCommit={(next) => onUpdateMission((m) => ({ ...m, reflection: next }), 'edit reflection')}
              ariaLabel="Mission reflection"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- helpers -- */

/**
 * Map a learning-path task onto a task area for hour attribution. Uses the
 * chapter focus and the task title, which is accurate enough for the by-area
 * breakdown and needs no extra field on every task.
 */
function inferArea(task: PathTask, chapter: Chapter): TaskArea {
  const text = `${task.title} ${chapter.focus}`.toLowerCase()
  if (text.includes('sql')) return 'sql'
  if (text.includes('experiment') || text.includes('a/b')) return 'experimentation'
  if (text.includes('analytic') || text.includes('metric') || text.includes('amplitude') || text.includes('mixpanel'))
    return 'analytics'
  if (text.includes('ai') || text.includes('llm') || text.includes('prompt')) return 'ai'
  if (text.includes('interview') || text.includes('mock') || text.includes('star')) return 'interview'
  if (text.includes('portfolio') || text.includes('case study') || text.includes('redesign') || text.includes('teardown'))
    return 'portfolio'
  if (text.includes('article') || text.includes('write') || text.includes('publish')) return 'writing'
  if (text.includes('linkedin') || text.includes('post') || text.includes('comment')) return 'linkedin'
  if (text.includes('network') || text.includes('connect') || text.includes('referral')) return 'networking'
  if (text.includes('read') || text.includes('book') || text.includes('chapter')) return 'reading'
  if (text.includes('apply') || text.includes('application') || text.includes('resume')) return 'applications'
  if (text.includes('course') || text.includes('academy') || text.includes('tutorial')) return 'course'
  return 'admin'
}
