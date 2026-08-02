/* ============================================================================
   Portfolio — and its two focused views, Case Studies and AI Projects
   ----------------------------------------------------------------------------
   The audit's central diagnosis is that the problem is proof, not capability.
   This is the page where proof gets made, so every project carries the full
   narrative spine: problem → goal → process → research → discovery → UX →
   metrics → tradeoffs → risks → business impact → lessons.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { DonutChart, seriesColor } from '../components/charts'
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
  Tooltip,
} from '../components/ui'
import { formatDate, formatHours, formatRelative } from '../lib/dates'
import { navigate, useRoute, useScrollToAnchor } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { ID, PortfolioKind, PortfolioProject, Status } from '../lib/types'

/** The audit's Part 5 project taxonomy. */
const KIND_LABEL: Record<PortfolioKind, string> = {
  'case-study': 'Case study',
  redesign: 'Product redesign',
  'ai-project': 'AI project',
  'strategy-doc': 'Strategy document',
  teardown: 'Product teardown',
  'data-project': 'Data project',
  'open-source': 'Open source',
}

const KIND_ICON: Record<PortfolioKind, string> = {
  'case-study': '📝',
  redesign: '🎨',
  'ai-project': '🤖',
  'strategy-doc': '♟',
  teardown: '🔩',
  'data-project': '📊',
  'open-source': '🌐',
}

const PUBLISH_TONE = { private: 'neutral', draft: 'warning', review: 'info', published: 'success' } as const

type SectionKey =
  | 'problem'
  | 'goal'
  | 'process'
  | 'research'
  | 'discovery'
  | 'ux'
  | 'metrics'
  | 'tradeoffs'
  | 'risks'
  | 'businessImpact'
  | 'lessons'

/** The eleven narrative sections. Order is the story order, deliberately. */
const SECTIONS: { key: SectionKey; label: string; help: string }[] = [
  { key: 'problem', label: 'Problem', help: 'Frame the problem before the solution. The audit lists problem framing first for every artefact.' },
  { key: 'goal', label: 'Goal', help: 'What success looks like, stated before you started.' },
  { key: 'process', label: 'Process', help: 'How you actually worked. Reviewers read this to judge rigour.' },
  { key: 'research', label: 'Research', help: 'What you looked at, and how much was real evidence versus assumption.' },
  { key: 'discovery', label: 'Discovery', help: 'User insights. The audit says your discovery evidence is thin — this section is where you fix that.' },
  { key: 'ux', label: 'UX', help: 'Information architecture, mental models, interaction. Your 8.8 competency — make it visible.' },
  { key: 'metrics', label: 'Metrics', help: 'Non-negotiable. An artefact without a metrics section reads as design, not product.' },
  { key: 'tradeoffs', label: 'Tradeoffs', help: 'What you chose not to do, and what it cost. The rejected options are the evidence of judgement.' },
  { key: 'risks', label: 'Risks', help: 'What could make this wrong, and how you would find out.' },
  { key: 'businessImpact', label: 'Business impact', help: 'Quantified. ARR, retention, activation, churn, tickets, engineering time. The audit calls this out repeatedly.' },
  { key: 'lessons', label: 'Lessons', help: 'What you would do differently. Written after, not before.' },
]

export type PortfolioScope = 'all' | 'case-studies' | 'ai'

/** `rationale` is authored by the seed but is not part of the persisted type. */
type ProjectWithRationale = PortfolioProject & { rationale?: string }

export function Portfolio({ scope = 'all' }: { scope?: PortfolioScope }) {
  const { data, derived, patch } = useStore()
  const route = useRoute()

  const [kindFilter, setKindFilter] = useState<PortfolioKind | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'published' | 'not-started'>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<ID | null>(route.anchor ?? null)
  const [sort, setSort] = useState<'roi' | 'completion' | 'due' | 'title'>('roi')

  useScrollToAnchor(route.anchor)

  /** Scope narrows the page without duplicating a line of logic. */
  const inScope = useMemo(() => {
    switch (scope) {
      case 'case-studies':
        return data.portfolio.filter(
          (p) => p.kind === 'case-study' || p.kind === 'redesign' || p.kind === 'teardown',
        )
      case 'ai':
        return data.portfolio.filter((p) => p.kind === 'ai-project')
      default:
        return data.portfolio
    }
  }, [data.portfolio, scope])

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = inScope.filter((project) => {
      if (kindFilter !== 'all' && project.kind !== kindFilter) return false
      if (statusFilter === 'published' && project.publishStatus !== 'published') return false
      if (
        statusFilter === 'active' &&
        !(project.status === 'in-progress' || (project.completion > 0 && project.completion < 100))
      )
        return false
      if (statusFilter === 'not-started' && project.completion > 0) return false
      if (!q) return true
      return `${project.title} ${project.problem} ${project.goal} ${project.businessImpact}`
        .toLowerCase()
        .includes(q)
    })

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'completion':
          return b.completion - a.completion
        case 'due':
          return (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')
        case 'title':
          return a.title.localeCompare(b.title)
        case 'roi':
        default:
          return a.roiRank - b.roiRank
      }
    })
  }, [inScope, kindFilter, query, sort, statusFilter])

  const openProject = openId ? (data.portfolio.find((p) => p.id === openId) as ProjectWithRationale | undefined) : undefined

  const updateProject = (projectId: ID, producer: (project: PortfolioProject) => PortfolioProject, label: string) => {
    patch('portfolio', (list) => list.map((p) => (p.id === projectId ? producer(p) : p)), label)
  }

  const addProject = () => {
    const project: PortfolioProject = {
      id: newId('pf'),
      title: 'New portfolio project',
      kind: scope === 'ai' ? 'ai-project' : 'case-study',
      roiRank: inScope.length + 1,
      status: 'not-started',
      completion: 0,
      publishStatus: 'private',
      problem: '',
      goal: '',
      process: '',
      research: '',
      discovery: '',
      ux: '',
      metrics: '',
      tradeoffs: '',
      risks: '',
      businessImpact: '',
      lessons: '',
      skillIds: [],
      estimatedHours: 20,
      actualHours: 0,
      targetDate: undefined,
      attachments: [],
      screenshots: [],
      xp: 300,
      order: data.portfolio.length,
    }
    patch('portfolio', (list) => [...list, project], 'add project')
    setOpenId(project.id)
  }

  /* ---------------------------------------------------------- aggregates -- */

  const stats = useMemo(() => {
    const published = inScope.filter((p) => p.publishStatus === 'published')
    const active = inScope.filter((p) => p.completion > 0 && p.publishStatus !== 'published')
    return {
      published: published.length,
      active: active.length,
      hours: inScope.reduce((sum, p) => sum + p.actualHours, 0),
      plannedHours: inScope.reduce((sum, p) => sum + p.estimatedHours, 0),
      withMetrics: inScope.filter((p) => p.metrics.trim().length > 0).length,
      withImpact: inScope.filter((p) => p.businessImpact.trim().length > 0).length,
      avgCompletion:
        inScope.length > 0 ? inScope.reduce((sum, p) => sum + p.completion, 0) / inScope.length : 0,
    }
  }, [inScope])

  const byKind = useMemo(() => {
    const map = new Map<PortfolioKind, number>()
    for (const project of inScope) map.set(project.kind, (map.get(project.kind) ?? 0) + 1)
    return [...map.entries()].map(([kind, count], i) => ({
      label: KIND_LABEL[kind],
      value: count,
      color: seriesColor(i),
    }))
  }, [inScope])

  const skillNames = useMemo(() => new Map(data.skills.map((s) => [s.id, s.name])), [data.skills])

  const titles: Record<PortfolioScope, { title: string; lede: string }> = {
    all: {
      title: 'Portfolio',
      lede: `The audit's seven highest-ROI projects, in its own ranking order. This page closes the biggest gap in your profile — the success metric is 6–8 published artefacts, and you have ${stats.published}.`,
    },
    'case-studies': {
      title: 'Case Studies',
      lede: 'Case studies, redesigns and teardowns — the artefacts that show craft. Every one needs a metrics section and a stated tradeoff, or it reads as design rather than product.',
    },
    ai: {
      title: 'AI Projects',
      lede: 'AI product work: retrieval, prompting architecture, evaluation harnesses and unit economics. AI Product Knowledge is the fastest-appreciating asset in the audit, and evaluation is the specific named gap.',
    },
  }

  const publishTarget = scope === 'all' ? 7 : Math.max(1, inScope.length)

  return (
    <div className="page">
      <PageHeader
        title={titles[scope].title}
        lede={titles[scope].lede}
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search projects…" size="sm" />
            <Select
              value={sort}
              size="sm"
              onChange={setSort}
              options={[
                { value: 'roi', label: 'Sort: ROI rank' },
                { value: 'completion', label: 'Sort: completion' },
                { value: 'due', label: 'Sort: due date' },
                { value: 'title', label: 'Sort: title' },
              ]}
            />
            <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={addProject}>
              New project
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Published"
              value={`${stats.published} / ${publishTarget}`}
              size="lg"
              tone={stats.published >= 6 ? 'success' : stats.published === 0 ? 'danger' : 'warning'}
              help="The audit's stated success metric is 6–8 high-quality public portfolio artefacts. Published work is half the Evidence pillar of your readiness score."
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar
                value={(stats.published / publishTarget) * 100}
                size="xs"
                tone={stats.published >= 6 ? 'success' : undefined}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="In progress" value={stats.active} size="lg" meta={`${inScope.length} total scoped`} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Hours invested"
              value={Math.round(stats.hours)}
              unit="h"
              size="lg"
              meta={`${Math.round(stats.plannedHours)}h planned`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="With a metrics section"
              value={`${stats.withMetrics} / ${inScope.length}`}
              size="lg"
              tone={stats.withMetrics === inScope.length ? 'success' : 'warning'}
              help="Metrics is the section most portfolios omit and the one interviewers look for first. An artefact without it reads as design work."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="With quantified impact"
              value={`${stats.withImpact} / ${inScope.length}`}
              size="lg"
              tone={stats.withImpact === inScope.length ? 'success' : 'warning'}
              help="Large companies hire demonstrated impact, not capability. A number in this section is what converts an artefact into evidence."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="Average completion" value={Math.round(stats.avgCompletion)} unit="%" size="lg" />
          </CardBody>
        </Card>
      </div>

      {/* Filters + mix */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Filters"
            actions={
              <Segmented
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All', count: inScope.length },
                  { value: 'active', label: 'Active', count: stats.active },
                  { value: 'published', label: 'Published', count: stats.published },
                  { value: 'not-started', label: 'Not started', count: inScope.filter((p) => p.completion === 0).length },
                ]}
              />
            }
          />
          <CardBody className="card__body--tight">
            <div className="row row--wrap" style={{ gap: 4 }}>
              <button type="button" onClick={() => setKindFilter('all')} style={{ display: 'inline-flex' }}>
                <Badge tone={kindFilter === 'all' ? 'accent' : 'neutral'} size="lg">
                  All kinds
                </Badge>
              </button>
              {(Object.keys(KIND_LABEL) as PortfolioKind[]).map((kind) => {
                const count = inScope.filter((p) => p.kind === kind).length
                if (count === 0) return null
                return (
                  <button key={kind} type="button" onClick={() => setKindFilter(kind)} style={{ display: 'inline-flex' }}>
                    <Badge tone={kindFilter === kind ? 'accent' : 'neutral'} size="lg">
                      {KIND_ICON[kind]} {KIND_LABEL[kind]} {count}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Portfolio mix"
            help="Range matters. Seven artefacts of the same kind prove one competency; seven different kinds prove breadth."
          />
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <DonutChart data={byKind} size={124} thickness={18} centerValue={inScope.length} centerLabel="projects" />
              <div className="col grow" style={{ gap: 5, minWidth: 130 }}>
                {byKind.map((row) => (
                  <div key={row.label} className="row row--between">
                    <span className="row text-xs" style={{ gap: 6, minWidth: 0 }}>
                      <span
                        className="chart-legend__swatch"
                        style={{ background: row.color, width: 8, height: 8, borderRadius: 2 }}
                      />
                      <span className="truncate text-secondary">{row.label}</span>
                    </span>
                    <span className="text-xs tnum text-tertiary">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Project cards */}
      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon="💻"
            title="No projects match"
            body="Adjust the filters, or add a new project."
            action={
              <Button variant="primary" size="sm" onClick={addProject}>
                New project
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid--auto-lg">
          {projects.map((project) => {
            const sectionsFilled = SECTIONS.filter((s) => project[s.key].trim().length > 0).length
            const overdue =
              project.targetDate && project.targetDate < derived.today && project.publishStatus !== 'published'

            return (
              <Card key={project.id} id={project.id}>
                <CardHeader
                  title={
                    <span className="row" style={{ gap: 6, minWidth: 0 }}>
                      <span>{KIND_ICON[project.kind]}</span>
                      <span className="truncate">{project.title}</span>
                    </span>
                  }
                  subtitle={
                    <span className="row row--wrap" style={{ gap: 6 }}>
                      <Badge tone="neutral">ROI #{project.roiRank}</Badge>
                      <Badge tone={PUBLISH_TONE[project.publishStatus]}>{project.publishStatus}</Badge>
                      {overdue ? <Badge tone="danger">overdue</Badge> : null}
                      <span className="text-2xs text-quaternary">{KIND_LABEL[project.kind]}</span>
                    </span>
                  }
                  actions={
                    <Ring
                      value={project.completion}
                      size={42}
                      thickness={4}
                      display={project.completion === 100 ? '✓' : project.completion}
                      valueSize={project.completion === 100 ? 15 : 11}
                      tone={project.publishStatus === 'published' ? 'success' : undefined}
                    />
                  }
                />
                <CardBody>
                  <div className="col" style={{ gap: 'var(--space-3)' }}>
                    <p className="text-xs text-secondary clamp-3" style={{ lineHeight: 'var(--leading-normal)', minHeight: 54 }}>
                      {project.problem ||
                        'No problem statement yet. Start here — the audit lists problem framing first for every artefact.'}
                    </p>

                    <div className="col" style={{ gap: 4 }}>
                      <div className="row row--between text-2xs">
                        <span className="text-quaternary">
                          Narrative sections
                          <HelpDot>
                            All eleven: problem, goal, process, research, discovery, UX, metrics, tradeoffs,
                            risks, business impact, lessons. Green marks the two the audit insists on.
                          </HelpDot>
                        </span>
                        <span className="tnum text-quaternary">
                          {sectionsFilled}/{SECTIONS.length}
                        </span>
                      </div>
                      <div className="row" style={{ gap: 2 }}>
                        {SECTIONS.map((section) => (
                          <Tooltip
                            key={section.key}
                            content={`${section.label}: ${project[section.key].trim() ? 'written' : 'empty'}`}
                          >
                            <span
                              style={{
                                flex: 1,
                                minWidth: 4,
                                height: 4,
                                borderRadius: 2,
                                background: project[section.key].trim()
                                  ? section.key === 'metrics' || section.key === 'businessImpact'
                                    ? 'var(--success)'
                                    : 'var(--accent)'
                                  : 'var(--track)',
                              }}
                            />
                          </Tooltip>
                        ))}
                      </div>
                    </div>

                    <div className="row row--wrap" style={{ gap: 4 }}>
                      {project.skillIds.slice(0, 4).map((skillId) => (
                        <Badge key={skillId} tone="neutral">
                          {skillNames.get(skillId) ?? skillId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardBody>
                <CardFooter>
                  <span className="tnum">
                    {formatHours(project.actualHours)} / {formatHours(project.estimatedHours)} ·{' '}
                    {project.targetDate ? formatRelative(project.targetDate, derived.today) : 'no date'}
                  </span>
                  <div className="row" style={{ gap: 4 }}>
                    {project.url ? (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="icon-btn"
                        title="Open published artefact"
                      >
                        <Icon name="external" size={13} />
                      </a>
                    ) : null}
                    <Button variant="subtle" size="sm" onClick={() => setOpenId(project.id)}>
                      Open
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* ROI rationale */}
      {scope === 'all' ? (
        <Card variant="inset">
          <CardHeader
            title="Why this order"
            subtitle="Part 5 of the audit — highest-ROI projects, ranked"
            help="The ranking is the audit's, not arbitrary. Working in this order means each artefact is easier because the one before it built the skill."
          />
          <CardBody className="card__body--none">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Project</th>
                    <th>Why it ranks here</th>
                    <th className="num">Hours</th>
                    <th style={{ width: 100 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(data.portfolio as ProjectWithRationale[])]
                    .sort((a, b) => a.roiRank - b.roiRank)
                    .map((project) => (
                      <tr key={project.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(project.id)}>
                        <td className="num strong">{project.roiRank}</td>
                        <td className="strong">
                          {KIND_ICON[project.kind]} {project.title}
                        </td>
                        <td style={{ maxWidth: 460 }}>{project.rationale ?? '—'}</td>
                        <td className="num">{project.estimatedHours}</td>
                        <td>
                          <Badge tone={PUBLISH_TONE[project.publishStatus]}>{project.publishStatus}</Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Detail drawer */}
      {openProject ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={760}
          title={
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <span>{KIND_ICON[openProject.kind]}</span>
              <InlineEdit
                value={openProject.title}
                onCommit={(next) => updateProject(openProject.id, (p) => ({ ...p, title: next }), 'rename project')}
                ariaLabel="Project title"
              />
            </span>
          }
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              <Badge tone="neutral">ROI #{openProject.roiRank}</Badge>
              <Badge tone={PUBLISH_TONE[openProject.publishStatus]}>{openProject.publishStatus}</Badge>
              <span>{KIND_LABEL[openProject.kind]}</span>
              {openProject.completedAt ? <span>· completed {formatDate(openProject.completedAt)}</span> : null}
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  patch('portfolio', (list) => list.filter((p) => p.id !== openProject.id), 'delete project')
                  setOpenId(null)
                }}
                label="Delete project"
                size="md"
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {openProject.publishStatus !== 'published' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Icon name="check" size={13} />}
                    onClick={() =>
                      updateProject(
                        openProject.id,
                        (p) => ({
                          ...p,
                          publishStatus: 'published',
                          status: 'done',
                          completion: 100,
                          completedAt: derived.today,
                        }),
                        'publish project',
                      )
                    }
                  >
                    Mark published
                  </Button>
                ) : (
                  <Badge tone="success" size="lg">
                    Published · +{openProject.xp} XP
                  </Badge>
                )}
                <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>
            </>
          }
        >
          {openProject.rationale ? (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--accent-subtle)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '2px solid var(--accent)',
              }}
            >
              <span className="section-title" style={{ display: 'block', marginBottom: 4 }}>
                Why this project
              </span>
              <p className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                {openProject.rationale}
              </p>
            </div>
          ) : null}

          {/* Controls */}
          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Kind</span>
              <Select
                value={openProject.kind}
                size="sm"
                options={(Object.keys(KIND_LABEL) as PortfolioKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                onChange={(next) => updateProject(openProject.id, (p) => ({ ...p, kind: next }), 'change kind')}
              />
            </div>
            <div className="field">
              <span className="field__label">Status</span>
              <Select
                value={openProject.status}
                size="sm"
                options={[
                  { value: 'not-started', label: 'Not started' },
                  { value: 'in-progress', label: 'In progress' },
                  { value: 'blocked', label: 'Blocked' },
                  { value: 'done', label: 'Done' },
                  { value: 'dropped', label: 'Dropped' },
                ]}
                onChange={(next) =>
                  updateProject(openProject.id, (p) => ({ ...p, status: next as Status }), 'change status')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Publish status</span>
              <Select
                value={openProject.publishStatus}
                size="sm"
                options={[
                  { value: 'private', label: 'Private' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'review', label: 'In review' },
                  { value: 'published', label: 'Published' },
                ]}
                onChange={(next) =>
                  updateProject(
                    openProject.id,
                    (p) => ({
                      ...p,
                      publishStatus: next,
                      completedAt: next === 'published' ? (p.completedAt ?? derived.today) : undefined,
                    }),
                    'change publish status',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Completion %</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                max={100}
                step={5}
                value={openProject.completion}
                onChange={(e) =>
                  updateProject(
                    openProject.id,
                    (p) => ({ ...p, completion: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }),
                    'edit completion',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Estimated hours</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                step={1}
                value={openProject.estimatedHours}
                onChange={(e) =>
                  updateProject(
                    openProject.id,
                    (p) => ({ ...p, estimatedHours: Number(e.target.value) || 0 }),
                    'edit estimate',
                  )
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
                value={openProject.actualHours}
                onChange={(e) =>
                  updateProject(
                    openProject.id,
                    (p) => ({ ...p, actualHours: Number(e.target.value) || 0 }),
                    'edit actual hours',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Target date</span>
              <input
                className="input input--sm"
                type="date"
                value={openProject.targetDate ?? ''}
                onChange={(e) =>
                  updateProject(
                    openProject.id,
                    (p) => ({ ...p, targetDate: e.target.value || undefined }),
                    'edit target date',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">ROI rank</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={1}
                value={openProject.roiRank}
                onChange={(e) =>
                  updateProject(openProject.id, (p) => ({ ...p, roiRank: Number(e.target.value) || 1 }), 'edit roi rank')
                }
              />
            </div>
          </div>

          <div className="field">
            <span className="field__label">Published URL</span>
            <Input
              value={openProject.url ?? ''}
              size="sm"
              placeholder="https://…"
              onChange={(next) => updateProject(openProject.id, (p) => ({ ...p, url: next || undefined }), 'edit url')}
            />
          </div>

          {/* Competencies */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">
              Competencies this proves
              <HelpDot>Tagging a competency links this artefact from the Skills page, where it counts as evidence.</HelpDot>
            </span>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {data.skills.map((skill) => {
                const selected = openProject.skillIds.includes(skill.id)
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() =>
                      updateProject(
                        openProject.id,
                        (p) => ({
                          ...p,
                          skillIds: selected ? p.skillIds.filter((id) => id !== skill.id) : [...p.skillIds, skill.id],
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

          {/* Narrative sections */}
          <div className="col" style={{ gap: 'var(--space-5)' }}>
            <span className="section-title">
              The narrative
              <HelpDot>
                Every artefact in the audit shares the same emphases: problem framing, user insights,
                tradeoffs, success metrics, risks, outcomes. These headings are those emphases.
              </HelpDot>
            </span>

            {SECTIONS.map((section) => {
              const value = openProject[section.key]
              const critical = section.key === 'metrics' || section.key === 'businessImpact'
              return (
                <div key={section.key} className="col" style={{ gap: 5 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span
                      className="section-title"
                      style={{ color: critical && !value.trim() ? 'var(--warning-text)' : undefined }}
                    >
                      {section.label}
                      {critical ? ' *' : ''}
                    </span>
                    <HelpDot>{section.help}</HelpDot>
                    {critical && !value.trim() ? <Badge tone="warning">required</Badge> : null}
                  </div>
                  <InlineEdit
                    value={value}
                    multiline
                    placeholder={`${section.label} — click to write. ${section.help}`}
                    onCommit={(next) =>
                      updateProject(
                        openProject.id,
                        (p) => ({ ...p, [section.key]: next }),
                        `edit ${section.label.toLowerCase()}`,
                      )
                    }
                    ariaLabel={section.label}
                  />
                </div>
              )
            })}
          </div>

          <hr className="divider" />

          {/* Attachments */}
          <div className="col" style={{ gap: 'var(--space-3)' }}>
            <div className="row row--between">
              <span className="section-title">Attachments & screenshots</span>
              <div className="row" style={{ gap: 4 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="link" size={12} />}
                  onClick={() =>
                    updateProject(
                      openProject.id,
                      (p) => ({ ...p, attachments: [...p.attachments, { label: 'New link', url: '' }] }),
                      'add attachment',
                    )
                  }
                >
                  Link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="plus" size={12} />}
                  onClick={() =>
                    updateProject(
                      openProject.id,
                      (p) => ({
                        ...p,
                        screenshots: [...p.screenshots, { id: newId('img'), label: 'New screenshot', url: '' }],
                      }),
                      'add screenshot',
                    )
                  }
                >
                  Screenshot
                </Button>
              </div>
            </div>

            {openProject.attachments.length === 0 && openProject.screenshots.length === 0 ? (
              <span className="text-xs text-quaternary">
                Nothing attached. Links to the live artefact, the design file, or the spreadsheet behind the
                analysis all belong here.
              </span>
            ) : null}

            {openProject.attachments.map((attachment, index) => (
              <div key={`${attachment.label}-${index}`} className="row" style={{ gap: 'var(--space-2)' }}>
                <Input
                  value={attachment.label}
                  size="sm"
                  placeholder="Label"
                  onChange={(next) =>
                    updateProject(
                      openProject.id,
                      (p) => ({
                        ...p,
                        attachments: p.attachments.map((a, i) => (i === index ? { ...a, label: next } : a)),
                      }),
                      'edit attachment',
                    )
                  }
                />
                <Input
                  value={attachment.url}
                  size="sm"
                  placeholder="https://…"
                  onChange={(next) =>
                    updateProject(
                      openProject.id,
                      (p) => ({
                        ...p,
                        attachments: p.attachments.map((a, i) => (i === index ? { ...a, url: next } : a)),
                      }),
                      'edit attachment url',
                    )
                  }
                />
                <IconButton
                  title="Remove"
                  tone="danger"
                  onClick={() =>
                    updateProject(
                      openProject.id,
                      (p) => ({ ...p, attachments: p.attachments.filter((_, i) => i !== index) }),
                      'delete attachment',
                    )
                  }
                >
                  <Icon name="x" size={12} />
                </IconButton>
              </div>
            ))}

            {openProject.screenshots.map((shot) => (
              <div key={shot.id} className="col" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <Input
                    value={shot.label}
                    size="sm"
                    placeholder="Caption"
                    onChange={(next) =>
                      updateProject(
                        openProject.id,
                        (p) => ({
                          ...p,
                          screenshots: p.screenshots.map((s) => (s.id === shot.id ? { ...s, label: next } : s)),
                        }),
                        'edit screenshot',
                      )
                    }
                  />
                  <Input
                    value={shot.url}
                    size="sm"
                    placeholder="Image URL or data URI"
                    onChange={(next) =>
                      updateProject(
                        openProject.id,
                        (p) => ({
                          ...p,
                          screenshots: p.screenshots.map((s) => (s.id === shot.id ? { ...s, url: next } : s)),
                        }),
                        'edit screenshot url',
                      )
                    }
                  />
                  <IconButton
                    title="Remove"
                    tone="danger"
                    onClick={() =>
                      updateProject(
                        openProject.id,
                        (p) => ({ ...p, screenshots: p.screenshots.filter((s) => s.id !== shot.id) }),
                        'delete screenshot',
                      )
                    }
                  >
                    <Icon name="x" size={12} />
                  </IconButton>
                </div>
                {shot.url ? (
                  <img
                    src={shot.url}
                    alt={shot.label}
                    style={{
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-default)',
                      maxHeight: 260,
                      objectFit: 'contain',
                      background: 'var(--bg-inset)',
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="row row--between">
            <Button variant="ghost" size="sm" onClick={() => navigate('/leverage')}>
              See where this ranks on the 80/20 table
            </Button>
            <span className="text-2xs text-quaternary">Worth {openProject.xp} XP when published</span>
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
