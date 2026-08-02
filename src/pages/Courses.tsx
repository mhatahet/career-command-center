/* ============================================================================
   Courses
   ----------------------------------------------------------------------------
   The audit is blunt about courses: "collecting certificates without
   demonstrable application" is on the ignore list. So this page ranks by ROI per
   hour and makes the projects column mandatory reading — a course with no
   artefact against it is flagged, not celebrated.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
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
import { formatDate, formatHours } from '../lib/dates'
import { useRoute, useScrollToAnchor } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { Course, Difficulty, ID, Priority, Status } from '../lib/types'

const STATUS_TONE = {
  'not-started': 'neutral',
  'in-progress': 'info',
  blocked: 'danger',
  done: 'success',
  dropped: 'neutral',
} as const

const IMPORTANCE_TONE = { critical: 'danger', high: 'warning', medium: 'neutral', low: 'neutral' } as const

type Sort = 'roi' | 'importance' | 'progress' | 'hours'

export function Courses() {
  const { data, derived, patch } = useStore()
  const route = useRoute()

  const [sort, setSort] = useState<Sort>('roi')
  const [filter, setFilter] = useState<'all' | 'active' | 'queued' | 'done'>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<ID | null>(route.anchor ?? null)

  useScrollToAnchor(route.anchor)

  const courses = useMemo(() => {
    const q = query.trim().toLowerCase()
    const importanceRank = { critical: 0, high: 1, medium: 2, low: 3 }

    return data.courses
      .filter((course) => {
        if (filter === 'active' && course.status !== 'in-progress') return false
        if (filter === 'queued' && course.status !== 'not-started') return false
        if (filter === 'done' && course.status !== 'done') return false
        if (!q) return true
        return `${course.title} ${course.provider} ${course.notes}`.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        switch (sort) {
          case 'importance':
            return importanceRank[a.importance] - importanceRank[b.importance] || b.roi - a.roi
          case 'progress':
            return b.progress - a.progress
          case 'hours':
            return a.hours - b.hours
          case 'roi':
          default:
            // ROI per hour: the only ranking that respects the audit's warning
            // about long courses with nothing to show for them.
            return b.roi / Math.max(1, b.hours) - a.roi / Math.max(1, a.hours)
        }
      })
  }, [data.courses, filter, query, sort])

  const open = openId ? data.courses.find((c) => c.id === openId) : undefined

  const updateCourse = (courseId: ID, producer: (course: Course) => Course, label: string) => {
    patch('courses', (list) => list.map((c) => (c.id === courseId ? producer(c) : c)), label)
  }

  /** Hours completed derives progress and status together. */
  const setHoursCompleted = (course: Course, hours: number) => {
    const clamped = Math.max(0, Math.min(course.hours, hours))
    updateCourse(
      course.id,
      (c) => ({
        ...c,
        hoursCompleted: clamped,
        progress: c.hours > 0 ? Math.round((clamped / c.hours) * 100) : 0,
        status: clamped >= c.hours && c.hours > 0 ? 'done' : clamped > 0 ? 'in-progress' : c.status,
        startedAt: clamped > 0 ? (c.startedAt ?? derived.today) : c.startedAt,
        completedAt: clamped >= c.hours && c.hours > 0 ? (c.completedAt ?? derived.today) : c.completedAt,
      }),
      'update course hours',
    )
  }

  const addCourse = () => {
    const course: Course = {
      id: newId('cs'),
      title: 'New course',
      provider: '',
      status: 'not-started',
      hours: 10,
      hoursCompleted: 0,
      progress: 0,
      difficulty: 3,
      importance: 'medium',
      roi: 5,
      hasCertificate: false,
      projects: [],
      notes: '',
      skillIds: [],
      xp: 150,
      order: data.courses.length,
    }
    patch('courses', (list) => [course, ...list], 'add course')
    setOpenId(course.id)
  }

  const stats = useMemo(() => {
    const done = data.courses.filter((c) => c.status === 'done')
    const withoutProjects = data.courses.filter((c) => c.projects.length === 0)
    return {
      done: done.length,
      active: data.courses.filter((c) => c.status === 'in-progress').length,
      hoursDone: data.courses.reduce((sum, c) => sum + c.hoursCompleted, 0),
      hoursTotal: data.courses.reduce((sum, c) => sum + c.hours, 0),
      certificates: done.filter((c) => c.hasCertificate).length,
      withoutProjects: withoutProjects.length,
      avgRoi:
        data.courses.length > 0 ? data.courses.reduce((sum, c) => sum + c.roi, 0) / data.courses.length : 0,
    }
  }, [data.courses])

  const skillNames = useMemo(() => new Map(data.skills.map((s) => [s.id, s.name])), [data.skills])

  return (
    <div className="page">
      <PageHeader
        title="Courses"
        lede="Ranked by ROI per hour, not by prestige. The audit puts “collecting certificates without demonstrable application” on the explicit ignore list — so a course only earns its place if there is an artefact attached to it."
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search courses…" size="sm" />
            <Select
              value={sort}
              size="sm"
              onChange={setSort}
              options={[
                { value: 'roi', label: 'Sort: ROI per hour' },
                { value: 'importance', label: 'Sort: importance' },
                { value: 'progress', label: 'Sort: progress' },
                { value: 'hours', label: 'Sort: shortest first' },
              ]}
            />
            <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={addCourse}>
              Add
            </Button>
          </>
        }
      />

      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="Completed" value={`${stats.done} / ${data.courses.length}`} size="lg" meta={`${stats.active} in progress`} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Hours completed"
              value={Math.round(stats.hoursDone)}
              unit="h"
              size="lg"
              meta={`of ${Math.round(stats.hoursTotal)}h planned`}
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar value={(stats.hoursDone / Math.max(1, stats.hoursTotal)) * 100} size="xs" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Without an artefact"
              value={stats.withoutProjects}
              size="lg"
              tone={stats.withoutProjects > 0 ? 'warning' : 'success'}
              help="A course with no project against it produces a certificate and nothing an employer can inspect. The audit is explicit that this is wasted time."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Average ROI"
              value={stats.avgRoi.toFixed(1)}
              unit="/10"
              size="lg"
              help="Your own assessment of career payoff per hour invested. Use it ruthlessly — a 120-hour course rated 4 is worse than a 6-hour one rated 9."
            />
          </CardBody>
        </Card>
      </div>

      <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: data.courses.length },
            { value: 'active', label: 'In progress', count: stats.active },
            { value: 'queued', label: 'Queued', count: data.courses.filter((c) => c.status === 'not-started').length },
            { value: 'done', label: 'Done', count: stats.done },
          ]}
        />
      </div>

      {courses.length === 0 ? (
        <Card>
          <EmptyState icon="🎓" title="No courses match" body="Adjust the filters or add one." />
        </Card>
      ) : (
        <Card>
          <CardBody className="card__body--none">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Provider</th>
                    <th className="num">Hours</th>
                    <th style={{ width: 130 }}>Progress</th>
                    <th className="num">
                      ROI
                      <HelpDot>Career payoff per hour invested, 1–10. The primary sort key on this page.</HelpDot>
                    </th>
                    <th className="num">ROI/h</th>
                    <th className="num">Diff.</th>
                    <th>Importance</th>
                    <th>Artefacts</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} id={course.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(course.id)}>
                      <td className="strong">
                        <div className="row" style={{ gap: 6 }}>
                          <span>{course.title}</span>
                          {course.hasCertificate ? (
                            <Tooltip content="Offers a certificate. Worth little on its own — the artefact is what counts.">
                              <span className="text-2xs text-quaternary">🎖</span>
                            </Tooltip>
                          ) : null}
                        </div>
                      </td>
                      <td>{course.provider}</td>
                      <td className="num">{course.hours}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <ProgressBar
                            value={course.progress}
                            size="sm"
                            tone={course.progress >= 100 ? 'success' : undefined}
                            live={course.status === 'in-progress'}
                          />
                          <span className="text-2xs tnum text-quaternary shrink-0">{course.progress}%</span>
                        </div>
                      </td>
                      <td className="num">
                        <Badge tone={course.roi >= 8 ? 'success' : course.roi >= 6 ? 'accent' : 'neutral'}>
                          {course.roi}
                        </Badge>
                      </td>
                      <td className="num">{(course.roi / Math.max(1, course.hours)).toFixed(2)}</td>
                      <td className="num">{course.difficulty}</td>
                      <td>
                        <Badge tone={IMPORTANCE_TONE[course.importance]}>{course.importance}</Badge>
                      </td>
                      <td>
                        {course.projects.length === 0 ? (
                          <Tooltip content="No artefact attached. The audit warns explicitly against courses that produce nothing inspectable.">
                            <Badge tone="warning">none</Badge>
                          </Tooltip>
                        ) : (
                          <Badge tone="success">{course.projects.length}</Badge>
                        )}
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[course.status]} dot>
                          {course.status.replace('-', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
          <CardFooter>
            <span>{courses.length} courses</span>
            <span className="tnum">
              {Math.round(courses.reduce((sum, c) => sum + c.hours, 0))}h total ·{' '}
              {Math.round(courses.reduce((sum, c) => sum + c.hoursCompleted, 0))}h done
            </span>
          </CardFooter>
        </Card>
      )}

      {/* Low-ROI warning */}
      {data.courses.some((c) => c.roi <= 5 && c.hours >= 40) ? (
        <Card variant="inset">
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--warning)' }}>
                <Icon name="alert" size={18} />
              </span>
              <div className="col" style={{ gap: 4 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)', color: 'var(--warning-text)' }}>
                  Long courses with low ROI
                </span>
                <p className="text-xs text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                  {data.courses
                    .filter((c) => c.roi <= 5 && c.hours >= 40)
                    .map((c) => `${c.title} (${c.hours}h, ROI ${c.roi})`)
                    .join(' · ')}
                  . The audit's first low-ROI activity is “collecting certificates without demonstrable
                  application”. Either attach a real artefact to these or drop them — the hours are better
                  spent on the portfolio.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Detail drawer */}
      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={680}
          title={
            <InlineEdit
              value={open.title}
              onCommit={(next) => updateCourse(open.id, (c) => ({ ...c, title: next }), 'rename course')}
              ariaLabel="Course title"
            />
          }
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              <InlineEdit
                value={open.provider}
                placeholder="Provider"
                onCommit={(next) => updateCourse(open.id, (c) => ({ ...c, provider: next }), 'edit provider')}
                ariaLabel="Provider"
              />
              <Badge tone={STATUS_TONE[open.status]}>{open.status.replace('-', ' ')}</Badge>
              <Badge tone={IMPORTANCE_TONE[open.importance]}>{open.importance}</Badge>
              {open.completedAt ? <span>· completed {formatDate(open.completedAt)}</span> : null}
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  patch('courses', (list) => list.filter((c) => c.id !== open.id), 'delete course')
                  setOpenId(null)
                }}
                label="Delete course"
                size="md"
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {open.status !== 'done' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Icon name="check" size={13} />}
                    onClick={() => setHoursCompleted(open, open.hours)}
                  >
                    Mark complete
                  </Button>
                ) : (
                  <Badge tone="success" size="lg">
                    Complete · +{open.xp} XP
                  </Badge>
                )}
                <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>
            </>
          }
        >
          <div className="row" style={{ gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Ring
              value={open.progress}
              size={78}
              thickness={7}
              display={open.progress}
              label="%"
              tone={open.progress >= 100 ? 'success' : undefined}
            />
            <div className="col grow" style={{ gap: 'var(--space-3)', minWidth: 200 }}>
              <div className="row row--wrap" style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                <div className="field" style={{ maxWidth: 130 }}>
                  <span className="field__label">Hours completed</span>
                  <input
                    className="input input--sm input--num"
                    type="number"
                    min={0}
                    max={open.hours}
                    step={0.5}
                    value={open.hoursCompleted}
                    onChange={(e) => setHoursCompleted(open, Number(e.target.value) || 0)}
                  />
                </div>
                <span className="text-xs text-quaternary" style={{ paddingBottom: 7 }}>
                  of {open.hours}h
                </span>
                <div className="row" style={{ gap: 4, paddingBottom: 2 }}>
                  {[0.5, 1, 2].map((step) => (
                    <Button
                      key={step}
                      variant="ghost"
                      size="sm"
                      onClick={() => setHoursCompleted(open, open.hoursCompleted + step)}
                    >
                      +{step}h
                    </Button>
                  ))}
                </div>
              </div>
              <ProgressBar value={open.progress} size="md" tone={open.progress >= 100 ? 'success' : undefined} />
            </div>
          </div>

          <hr className="divider" />

          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Status</span>
              <Select
                value={open.status}
                size="sm"
                options={[
                  { value: 'not-started', label: 'Not started' },
                  { value: 'in-progress', label: 'In progress' },
                  { value: 'blocked', label: 'Blocked' },
                  { value: 'done', label: 'Done' },
                  { value: 'dropped', label: 'Dropped' },
                ]}
                onChange={(next) => updateCourse(open.id, (c) => ({ ...c, status: next as Status }), 'change status')}
              />
            </div>
            <div className="field">
              <span className="field__label">Total hours</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                value={open.hours}
                onChange={(e) =>
                  updateCourse(
                    open.id,
                    (c) => {
                      const hours = Math.max(0, Number(e.target.value) || 0)
                      return {
                        ...c,
                        hours,
                        progress: hours > 0 ? Math.round((c.hoursCompleted / hours) * 100) : 0,
                      }
                    },
                    'edit total hours',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">
                ROI
                <HelpDot>Career payoff per hour, 1–10. Be honest — this is the number that decides whether the course is worth the time.</HelpDot>
              </span>
              <input
                className="input input--sm input--num"
                type="number"
                min={1}
                max={10}
                value={open.roi}
                onChange={(e) =>
                  updateCourse(
                    open.id,
                    (c) => ({ ...c, roi: Math.max(1, Math.min(10, Number(e.target.value) || 1)) }),
                    'edit roi',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Importance</span>
              <Select
                value={open.importance}
                size="sm"
                options={[
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
                onChange={(next) =>
                  updateCourse(open.id, (c) => ({ ...c, importance: next as Priority }), 'change importance')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Difficulty</span>
              <Select
                value={String(open.difficulty)}
                size="sm"
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
                onChange={(next) =>
                  updateCourse(open.id, (c) => ({ ...c, difficulty: Number(next) as Difficulty }), 'change difficulty')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Offers a certificate</span>
              <div className="row" style={{ height: 26, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={open.hasCertificate}
                  onChange={(e) =>
                    updateCourse(open.id, (c) => ({ ...c, hasCertificate: e.target.checked }), 'toggle certificate')
                  }
                  aria-label="Offers a certificate"
                />
              </div>
            </div>
          </div>

          <div className="field">
            <span className="field__label">Course URL</span>
            <Input
              value={open.url ?? ''}
              size="sm"
              placeholder="https://…"
              onChange={(next) => updateCourse(open.id, (c) => ({ ...c, url: next || undefined }), 'edit url')}
            />
          </div>

          {open.hasCertificate ? (
            <div className="field">
              <span className="field__label">Certificate URL</span>
              <Input
                value={open.certificateUrl ?? ''}
                size="sm"
                placeholder="https://…"
                onChange={(next) =>
                  updateCourse(open.id, (c) => ({ ...c, certificateUrl: next || undefined }), 'edit certificate url')
                }
              />
            </div>
          ) : null}

          {/* Competencies */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">Competencies this develops</span>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {data.skills.map((skill) => {
                const selected = open.skillIds.includes(skill.id)
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() =>
                      updateCourse(
                        open.id,
                        (c) => ({
                          ...c,
                          skillIds: selected ? c.skillIds.filter((id) => id !== skill.id) : [...c.skillIds, skill.id],
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

          <hr className="divider" />

          {/* Projects */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <div className="row row--between">
              <span className="section-title" style={{ color: open.projects.length === 0 ? 'var(--warning-text)' : undefined }}>
                Artefacts produced
                <HelpDot>
                  What exists in the world because of this course. If the answer is "a certificate", the audit
                  says the time was wasted. Convert every course into something inspectable.
                </HelpDot>
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={12} />}
                onClick={() =>
                  updateCourse(open.id, (c) => ({ ...c, projects: [...c.projects, 'New artefact'] }), 'add artefact')
                }
              >
                Add
              </Button>
            </div>
            {open.projects.length === 0 ? (
              <div
                className="text-xs"
                style={{
                  padding: 'var(--space-3)',
                  background: 'var(--warning-subtle)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--warning-text)',
                }}
              >
                No artefact yet. Decide now what this course will produce, or reconsider whether to take it.
              </div>
            ) : (
              open.projects.map((project, index) => (
                <div key={`${project}-${index}`} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--success)', fontSize: 10, marginTop: 4 }}>◆</span>
                  <span className="text-sm text-secondary grow">
                    <InlineEdit
                      value={project}
                      onCommit={(next) =>
                        updateCourse(
                          open.id,
                          (c) => ({
                            ...c,
                            projects: next
                              ? c.projects.map((p, i) => (i === index ? next : p))
                              : c.projects.filter((_, i) => i !== index),
                          }),
                          'edit artefact',
                        )
                      }
                      ariaLabel="Artefact"
                    />
                  </span>
                  <IconButton
                    title="Remove"
                    tone="danger"
                    onClick={() =>
                      updateCourse(
                        open.id,
                        (c) => ({ ...c, projects: c.projects.filter((_, i) => i !== index) }),
                        'delete artefact',
                      )
                    }
                  >
                    <Icon name="x" size={11} />
                  </IconButton>
                </div>
              ))
            )}
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">Notes</span>
            <InlineEdit
              value={open.notes}
              multiline
              placeholder="Which modules matter, which to skip, what to build alongside it…"
              onCommit={(next) => updateCourse(open.id, (c) => ({ ...c, notes: next }), 'edit notes')}
              ariaLabel="Course notes"
            />
          </div>

          <div className="row row--between text-2xs text-quaternary">
            <span>{open.startedAt ? `Started ${formatDate(open.startedAt)}` : 'Not started'}</span>
            <span>
              {formatHours(open.hoursCompleted)} of {formatHours(open.hours)} · {open.xp} XP on completion
            </span>
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
