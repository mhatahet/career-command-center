/* ============================================================================
   Skills — the competency dashboard
   ----------------------------------------------------------------------------
   Sixteen competencies with scores, targets, weights, evidence and improvement
   plans. Every score is editable inline and every edit appends to the skill's
   history, so the trend line is a record rather than a decoration.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { Bullet, ChartLegend, LineChart, RadarChart } from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DeleteButton,
  EmptyState,
  HelpDot,
  Icon,
  IconButton,
  InlineEdit,
  Input,
  ProgressBar,
  Segmented,
  Select,
  Stat,
  Tooltip,
} from '../components/ui'
import { formatDate, formatHours } from '../lib/dates'
import { useRoute, useScrollToAnchor } from '../lib/router'
import { getSkillsMeta, newId, useStore } from '../lib/store'
import type { Evidence, GapTier, ID, Skill } from '../lib/types'

const TIER_LABEL: Record<GapTier, string> = {
  'must-fix': 'Must fix',
  'should-improve': 'Should improve',
  'nice-to-have': 'Nice to have',
  advantage: 'Advantage',
}

const TIER_TONE = {
  'must-fix': 'danger',
  'should-improve': 'warning',
  'nice-to-have': 'neutral',
  advantage: 'success',
} as const

const CATEGORY_LABEL = {
  craft: 'Craft',
  analytical: 'Analytical',
  strategic: 'Strategic',
  human: 'Human',
  technical: 'Technical',
} as const

const EVIDENCE_KINDS: { value: Evidence['kind']; label: string }[] = [
  { value: 'metric', label: 'Quantified metric' },
  { value: 'project', label: 'Project' },
  { value: 'artifact', label: 'Public artefact' },
  { value: 'role', label: 'Role experience' },
  { value: 'course', label: 'Course' },
  { value: 'other', label: 'Other' },
]

type SortKey = 'gap' | 'score' | 'weight' | 'name' | 'tier'

export function Skills() {
  const { data, derived, update } = useStore()
  const route = useRoute()
  const meta = getSkillsMeta()

  const [tierFilter, setTierFilter] = useState<GapTier | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('gap')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<ID>>(new Set(route.anchor ? [route.anchor] : []))

  useScrollToAnchor(route.anchor, [expanded.size])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = data.skills.filter((skill) => {
      if (tierFilter !== 'all' && skill.tier !== tierFilter) return false
      if (!q) return true
      return `${skill.name} ${skill.what} ${skill.strengths.join(' ')} ${skill.weaknesses.join(' ')}`
        .toLowerCase()
        .includes(q)
    })

    const tierRank = { 'must-fix': 0, 'should-improve': 1, 'nice-to-have': 2, advantage: 3 }

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'score':
          return a.currentScore - b.currentScore
        case 'weight':
          return b.weight - a.weight
        case 'name':
          return a.name.localeCompare(b.name)
        case 'tier':
          return tierRank[a.tier] - tierRank[b.tier] || b.weight - a.weight
        case 'gap':
        default:
          // Weighted gap: the honest measure of what to fix first.
          return (b.targetScore - b.currentScore) * b.weight - (a.targetScore - a.currentScore) * a.weight
      }
    })
  }, [data.skills, query, sort, tierFilter])

  const updateSkill = (skillId: ID, producer: (skill: Skill) => Skill, label: string) => {
    update(
      (draft) => ({ ...draft, skills: draft.skills.map((s) => (s.id === skillId ? producer(s) : s)) }),
      ['skills'],
      label,
    )
  }

  /** Changing a score appends to history, so the trend records reality. */
  const setScore = (skill: Skill, next: number) => {
    const clamped = Math.max(0, Math.min(10, Math.round(next * 10) / 10))
    if (clamped === skill.currentScore) return

    updateSkill(
      skill.id,
      (s) => {
        // One point per day: re-scoring twice in a day overwrites rather than
        // stacking, which keeps the trend readable.
        const history = s.history.filter((h) => h.date !== derived.today)
        return {
          ...s,
          currentScore: clamped,
          history: [...history, { date: derived.today, score: clamped }].sort((a, b) => (a.date < b.date ? -1 : 1)),
        }
      },
      `score ${skill.name}`,
    )
  }

  const counts = useMemo(() => {
    const byTier = (tier: GapTier) => data.skills.filter((s) => s.tier === tier).length
    return {
      all: data.skills.length,
      'must-fix': byTier('must-fix'),
      'should-improve': byTier('should-improve'),
      'nice-to-have': byTier('nice-to-have'),
      advantage: byTier('advantage'),
    }
  }, [data.skills])

  const totals = useMemo(() => {
    const atTarget = data.skills.filter((s) => s.currentScore >= s.targetScore).length
    const gained = data.skills.reduce((sum, s) => sum + (s.currentScore - s.baselineScore), 0)
    const evidence = data.skills.reduce((sum, s) => sum + s.evidence.length, 0)
    const quantified = data.skills.flatMap((s) => s.evidence).filter((e) => e.kind === 'metric').length
    return { atTarget, gained: Math.round(gained * 10) / 10, evidence, quantified }
  }, [data.skills])

  const hoursBySkill = useMemo(
    () => new Map(derived.hours.bySkill.map((row) => [row.skillId, row.hours])),
    [derived.hours.bySkill],
  )

  return (
    <div className="page">
      <PageHeader
        title="Skills"
        lede="The sixteen competencies from the executive audit, with the original baselines preserved. Weights reflect how hard a Tier-1 loop screens each one, so the weighted gap — not the raw score — is what tells you where to spend the next hour."
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search competencies…" size="sm" />
            <Select
              value={sort}
              size="sm"
              onChange={setSort}
              options={[
                { value: 'gap', label: 'Sort: weighted gap' },
                { value: 'score', label: 'Sort: lowest score' },
                { value: 'weight', label: 'Sort: highest weight' },
                { value: 'tier', label: 'Sort: tier' },
                { value: 'name', label: 'Sort: name' },
              ]}
            />
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Competency score"
              value={derived.readiness.competencyScore}
              unit="/100"
              size="lg"
              help="Weighted average of all sixteen scores. This is the Competency pillar — 55% of the readiness score."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="At or above target"
              value={`${totals.atTarget} / ${data.skills.length}`}
              size="lg"
              tone={totals.atTarget === data.skills.length ? 'success' : undefined}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Gained since baseline"
              value={totals.gained >= 0 ? `+${totals.gained}` : totals.gained}
              size="lg"
              tone={totals.gained > 0 ? 'success' : 'neutral'}
              meta="Total points across all competencies"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Quantified outcomes"
              value={`${totals.quantified} / 6`}
              size="lg"
              tone={totals.quantified >= 6 ? 'success' : 'warning'}
              meta={`${totals.evidence} evidence items total`}
              help="The audit asks for six quantified outcomes: ARR influenced, retention improved, activation increased, churn reduced, support tickets reduced, engineering time saved. Add them as metric evidence."
            />
          </CardBody>
        </Card>
      </div>

      {/* Radar + advantages */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Competency profile"
            subtitle="Current, target and the original audit baseline"
            help="Click any axis label to jump to that competency. Red labels are more than 0.6 points below target."
          />
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-6)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <RadarChart
                axes={data.skills.map((s) => s.name)}
                weakAxes={data.skills.filter((s) => s.currentScore < s.targetScore - 0.6).map((s) => s.name)}
                onAxisClick={(_, index) => {
                  const skill = data.skills[index]
                  if (!skill) return
                  setExpanded((prev) => new Set(prev).add(skill.id))
                  window.location.hash = `/skills#${skill.id}`
                }}
                series={[
                  { label: 'Current', color: 'var(--accent)', values: data.skills.map((s) => s.currentScore), fillOpacity: 0.2 },
                  { label: 'Target', color: 'var(--success)', values: data.skills.map((s) => s.targetScore), fillOpacity: 0.05, dashed: true },
                  { label: 'Baseline', color: 'var(--text-quaternary)', values: data.skills.map((s) => s.baselineScore), fillOpacity: 0, dashed: true },
                ]}
                size={368}
              />
              <div className="col" style={{ gap: 'var(--space-4)', minWidth: 210, flex: 1 }}>
                <ChartLegend
                  variant="line"
                  items={[
                    { label: 'Current', color: 'var(--accent)' },
                    { label: 'Target', color: 'var(--success)' },
                    { label: 'Audit baseline', color: 'var(--text-quaternary)' },
                  ]}
                />
                <hr className="divider" />
                <span className="section-title">By category</span>
                {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((category) => {
                  const inCategory = data.skills.filter((s) => s.category === category)
                  if (inCategory.length === 0) return null
                  const avg = inCategory.reduce((sum, s) => sum + s.currentScore, 0) / inCategory.length
                  const target = inCategory.reduce((sum, s) => sum + s.targetScore, 0) / inCategory.length
                  return (
                    <div key={category} className="col" style={{ gap: 4 }}>
                      <div className="row row--between text-xs">
                        <span className="text-secondary">{CATEGORY_LABEL[category]}</span>
                        <span className="tnum text-tertiary">
                          {avg.toFixed(1)} <span className="text-quaternary">/ {target.toFixed(1)}</span>
                        </span>
                      </div>
                      <ProgressBar
                        value={(avg / 10) * 100}
                        size="sm"
                        marker={(target / 10) * 100}
                        tone={avg >= target ? 'success' : undefined}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Competitive advantages"
            subtitle="Part 2 of the audit"
            help="These are rare and hard to see from the outside. The work is not improving them — it is making them legible to someone who has never met you."
          />
          <CardBody className="card__body--tight">
            <div className="col" style={{ gap: 'var(--space-3)' }}>
              {meta.competitiveAdvantages.map((advantage) => {
                const skill = data.skills.find((s) => s.name === advantage.skill)
                return (
                  <div key={advantage.id} className="col" style={{ gap: 3 }}>
                    <div className="row row--between">
                      <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                        {advantage.title}
                      </span>
                      {skill ? (
                        <Badge tone="success">{skill.currentScore.toFixed(1)}</Badge>
                      ) : null}
                    </div>
                    <p className="text-2xs text-tertiary" style={{ lineHeight: 'var(--leading-snug)' }}>
                      {advantage.detail}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tier filter */}
      <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
        <Segmented
          value={tierFilter}
          onChange={setTierFilter}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'must-fix', label: 'Must fix', count: counts['must-fix'] },
            { value: 'should-improve', label: 'Should improve', count: counts['should-improve'] },
            { value: 'advantage', label: 'Advantages', count: counts.advantage },
            { value: 'nice-to-have', label: 'Nice to have', count: counts['nice-to-have'] },
          ]}
        />
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(new Set(rows.map((s) => s.id)))}
          >
            Expand all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
            Collapse all
          </Button>
        </div>
      </div>

      {/* Skill rows */}
      <div className="col" style={{ gap: 'var(--space-3)' }}>
        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="🔍" title="No competencies match" body="Try a different filter or search." />
          </Card>
        ) : (
          rows.map((skill) => {
            const isOpen = expanded.has(skill.id)
            const gap = Math.round((skill.targetScore - skill.currentScore) * 10) / 10
            const delta = Math.round((skill.currentScore - skill.baselineScore) * 10) / 10
            const hours = hoursBySkill.get(skill.id) ?? 0
            const trend = skill.history.map((h) => ({ x: h.date, y: h.score }))

            return (
              <Card key={skill.id} id={skill.id}>
                <div
                  className="card__header"
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(skill.id)) next.delete(skill.id)
                      else next.add(skill.id)
                      return next
                    })
                  }
                >
                  <div className="row" style={{ gap: 'var(--space-3)', minWidth: 0, flex: 1 }}>
                    <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={15} />
                    <div className="col" style={{ gap: 3, minWidth: 0, flex: 1 }}>
                      <div className="row row--wrap" style={{ gap: 'var(--space-2)', minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' }}>
                          {skill.name}
                        </span>
                        <Badge tone={TIER_TONE[skill.tier]}>{TIER_LABEL[skill.tier]}</Badge>
                        <Badge tone="neutral">{skill.benchmark}</Badge>
                        <Tooltip
                          title="Weight in the readiness score"
                          content={`This competency carries ${(skill.weight * 100).toFixed(1)}% of the Competency pillar, which is itself 55% of the readiness score. Closing its ${gap.toFixed(1)}-point gap would add roughly ${((gap / 10) * skill.weight * 100 * 0.55).toFixed(1)} readiness points.`}
                        >
                          <Badge tone="neutral">w {(skill.weight * 100).toFixed(1)}%</Badge>
                        </Tooltip>
                      </div>
                      <span className="text-xs text-tertiary clamp-1">{skill.what}</span>
                    </div>
                  </div>

                  <div className="row shrink-0" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
                    {trend.length > 1 ? (
                      <div style={{ width: 90, height: 26 }}>
                        <LineChart
                          series={[{ label: skill.name, color: delta > 0 ? 'var(--success)' : 'var(--accent)', points: trend, fill: true }]}
                          height={26}
                          yMin={Math.min(...trend.map((t) => t.y)) - 0.5}
                          yMax={Math.max(...trend.map((t) => t.y), skill.targetScore) + 0.3}
                          yTicks={1}
                          formatY={() => ''}
                          formatX={() => ''}
                        />
                      </div>
                    ) : null}

                    <div className="col" style={{ width: 120, gap: 4 }}>
                      <div className="row row--between text-xs">
                        <span className="tnum" style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                          {skill.currentScore.toFixed(1)}
                        </span>
                        <span className="tnum text-quaternary">→ {skill.targetScore.toFixed(1)}</span>
                      </div>
                      <Bullet
                        value={skill.currentScore}
                        target={skill.targetScore}
                        baseline={skill.baselineScore}
                      />
                    </div>

                    <div className="col" style={{ alignItems: 'flex-end', gap: 1, width: 52 }}>
                      <span
                        className="text-xs tnum"
                        style={{ color: gap <= 0 ? 'var(--success-text)' : 'var(--warning-text)', fontWeight: 'var(--weight-medium)' }}
                      >
                        {gap <= 0 ? 'at target' : `−${gap.toFixed(1)}`}
                      </span>
                      {delta !== 0 ? (
                        <span className="text-2xs tnum text-success">
                          {delta > 0 ? '+' : ''}
                          {delta.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {isOpen ? (
                  <CardBody className="animate-in">
                    <div className="col" style={{ gap: 'var(--space-5)' }}>
                      {/* Why it matters */}
                      <div
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          background: 'var(--accent-subtle)',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: '2px solid var(--accent)',
                        }}
                      >
                        <span className="section-title" style={{ marginBottom: 4, display: 'block' }}>
                          Why this matters
                        </span>
                        <p className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                          {skill.whyItMatters}
                        </p>
                      </div>

                      {/* Score controls */}
                      <div className="grid grid--auto-sm" style={{ gap: 'var(--space-4)' }}>
                        <div className="field">
                          <span className="field__label">
                            Current score
                            <HelpDot>
                              Re-score honestly when you have new evidence. Each change appends a point
                              to the history, so the trend line is a record of what actually happened.
                            </HelpDot>
                          </span>
                          <div className="row" style={{ gap: 'var(--space-2)' }}>
                            <IconButton title="Decrease by 0.1" onClick={() => setScore(skill, skill.currentScore - 0.1)}>
                              −
                            </IconButton>
                            <input
                              className="input input--sm input--num"
                              type="number"
                              step={0.1}
                              min={0}
                              max={10}
                              value={skill.currentScore}
                              onChange={(e) => setScore(skill, Number(e.target.value))}
                            />
                            <IconButton title="Increase by 0.1" onClick={() => setScore(skill, skill.currentScore + 0.1)}>
                              +
                            </IconButton>
                          </div>
                        </div>

                        <div className="field">
                          <span className="field__label">Target score</span>
                          <input
                            className="input input--sm input--num"
                            type="number"
                            step={0.1}
                            min={0}
                            max={10}
                            value={skill.targetScore}
                            onChange={(e) =>
                              updateSkill(
                                skill.id,
                                (s) => ({ ...s, targetScore: Math.max(0, Math.min(10, Number(e.target.value) || 0)) }),
                                'edit target',
                              )
                            }
                          />
                        </div>

                        <div className="field">
                          <span className="field__label">
                            Confidence
                            <HelpDot>
                              How confident are you that you could defend this score in an interview? Low
                              confidence on a high score usually means the evidence is thin.
                            </HelpDot>
                          </span>
                          <Select
                            value={String(skill.confidence) as '1' | '2' | '3' | '4' | '5'}
                            size="sm"
                            options={[
                              { value: '1', label: '1 — No evidence' },
                              { value: '2', label: '2 — Weak' },
                              { value: '3', label: '3 — Moderate' },
                              { value: '4', label: '4 — Strong' },
                              { value: '5', label: '5 — Could teach it' },
                            ]}
                            onChange={(next) =>
                              updateSkill(
                                skill.id,
                                (s) => ({ ...s, confidence: Number(next) as Skill['confidence'] }),
                                'edit confidence',
                              )
                            }
                          />
                        </div>

                        <div className="field">
                          <span className="field__label">Audit baseline</span>
                          <div className="row" style={{ gap: 'var(--space-2)', height: 26, alignItems: 'center' }}>
                            <span className="text-sm tnum text-tertiary">{skill.baselineScore.toFixed(1)}</span>
                            <span className="text-2xs text-quaternary">immutable</span>
                          </div>
                        </div>

                        <div className="field">
                          <span className="field__label">Hours invested</span>
                          <div className="row" style={{ gap: 'var(--space-2)', height: 26, alignItems: 'center' }}>
                            <span className="text-sm tnum text-secondary">{formatHours(hours)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Strengths / weaknesses */}
                      <div className="grid grid--auto" style={{ gap: 'var(--space-4)' }}>
                        <div className="col" style={{ gap: 'var(--space-2)' }}>
                          <span className="section-title" style={{ color: 'var(--success-text)' }}>
                            Strengths
                          </span>
                          {skill.strengths.length === 0 ? (
                            <span className="text-xs text-quaternary">None recorded.</span>
                          ) : (
                            skill.strengths.map((item, i) => (
                              <div key={`${item}-${i}`} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                                <span style={{ color: 'var(--success)', fontSize: 10, marginTop: 3 }}>✓</span>
                                <span className="text-xs text-secondary grow">
                                  <InlineEdit
                                    value={item}
                                    onCommit={(next) =>
                                      updateSkill(
                                        skill.id,
                                        (s) => ({
                                          ...s,
                                          strengths: next
                                            ? s.strengths.map((x, xi) => (xi === i ? next : x))
                                            : s.strengths.filter((_, xi) => xi !== i),
                                        }),
                                        'edit strength',
                                      )
                                    }
                                    ariaLabel="Strength"
                                  />
                                </span>
                              </div>
                            ))
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icon name="plus" size={12} />}
                            onClick={() =>
                              updateSkill(skill.id, (s) => ({ ...s, strengths: [...s.strengths, 'New strength'] }), 'add strength')
                            }
                          >
                            Add
                          </Button>
                        </div>

                        <div className="col" style={{ gap: 'var(--space-2)' }}>
                          <span className="section-title" style={{ color: 'var(--danger-text)' }}>
                            Weak areas
                          </span>
                          {skill.weaknesses.map((item, i) => (
                            <div key={`${item}-${i}`} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                              <span style={{ color: 'var(--danger)', fontSize: 10, marginTop: 3 }}>○</span>
                              <span className="text-xs text-secondary grow">
                                <InlineEdit
                                  value={item}
                                  onCommit={(next) =>
                                    updateSkill(
                                      skill.id,
                                      (s) => ({
                                        ...s,
                                        weaknesses: next
                                          ? s.weaknesses.map((x, xi) => (xi === i ? next : x))
                                          : s.weaknesses.filter((_, xi) => xi !== i),
                                      }),
                                      'edit weakness',
                                    )
                                  }
                                  ariaLabel="Weak area"
                                />
                              </span>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icon name="plus" size={12} />}
                            onClick={() =>
                              updateSkill(skill.id, (s) => ({ ...s, weaknesses: [...s.weaknesses, 'New weak area'] }), 'add weakness')
                            }
                          >
                            Add
                          </Button>
                        </div>

                        <div className="col" style={{ gap: 'var(--space-2)' }}>
                          <span className="section-title" style={{ color: 'var(--accent-text)' }}>
                            Improvement plan
                          </span>
                          {skill.improvementPlan.map((item, i) => (
                            <div key={`${item}-${i}`} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                              <span style={{ color: 'var(--accent)', fontSize: 10, marginTop: 3 }}>→</span>
                              <span className="text-xs text-secondary grow">
                                <InlineEdit
                                  value={item}
                                  onCommit={(next) =>
                                    updateSkill(
                                      skill.id,
                                      (s) => ({
                                        ...s,
                                        improvementPlan: next
                                          ? s.improvementPlan.map((x, xi) => (xi === i ? next : x))
                                          : s.improvementPlan.filter((_, xi) => xi !== i),
                                      }),
                                      'edit plan step',
                                    )
                                  }
                                  ariaLabel="Plan step"
                                />
                              </span>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icon name="plus" size={12} />}
                            onClick={() =>
                              updateSkill(
                                skill.id,
                                (s) => ({ ...s, improvementPlan: [...s.improvementPlan, 'New action'] }),
                                'add plan step',
                              )
                            }
                          >
                            Add
                          </Button>
                        </div>
                      </div>

                      <hr className="divider" />

                      {/* Evidence */}
                      <div className="col" style={{ gap: 'var(--space-3)' }}>
                        <div className="row row--between">
                          <span className="section-title">
                            Evidence
                            <HelpDot>
                              The whole audit turns on this: employers hire demonstrated impact, not
                              capability. Metric evidence counts toward the Evidence pillar of your
                              readiness score.
                            </HelpDot>
                          </span>
                          <Button
                            variant="subtle"
                            size="sm"
                            icon={<Icon name="plus" size={12} />}
                            onClick={() =>
                              updateSkill(
                                skill.id,
                                (s) => ({
                                  ...s,
                                  evidence: [
                                    ...s.evidence,
                                    {
                                      id: newId('ev'),
                                      label: 'New evidence — describe it with a number',
                                      kind: 'metric',
                                      addedAt: derived.today,
                                    },
                                  ],
                                }),
                                'add evidence',
                              )
                            }
                          >
                            Add evidence
                          </Button>
                        </div>

                        {skill.evidence.length === 0 ? (
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
                            No evidence recorded. A {skill.currentScore.toFixed(1)} you cannot prove is a{' '}
                            {skill.currentScore.toFixed(1)} an interviewer will discount.
                          </div>
                        ) : (
                          <div className="col" style={{ gap: 'var(--space-2)' }}>
                            {skill.evidence.map((item) => (
                              <div
                                key={item.id}
                                className="row"
                                style={{
                                  gap: 'var(--space-2)',
                                  padding: 'var(--space-2) var(--space-3)',
                                  background: 'var(--bg-inset)',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                <Select
                                  value={item.kind}
                                  size="sm"
                                  options={EVIDENCE_KINDS}
                                  className="shrink-0"
                                  onChange={(next) =>
                                    updateSkill(
                                      skill.id,
                                      (s) => ({
                                        ...s,
                                        evidence: s.evidence.map((e) => (e.id === item.id ? { ...e, kind: next } : e)),
                                      }),
                                      'edit evidence kind',
                                    )
                                  }
                                />
                                <span className="text-xs grow" style={{ color: 'var(--text-primary)' }}>
                                  <InlineEdit
                                    value={item.label}
                                    onCommit={(next) =>
                                      updateSkill(
                                        skill.id,
                                        (s) => ({
                                          ...s,
                                          evidence: s.evidence.map((e) => (e.id === item.id ? { ...e, label: next } : e)),
                                        }),
                                        'edit evidence',
                                      )
                                    }
                                    ariaLabel="Evidence description"
                                  />
                                </span>
                                <span className="text-2xs text-quaternary shrink-0">{formatDate(item.addedAt)}</span>
                                <DeleteButton
                                  onDelete={() =>
                                    updateSkill(
                                      skill.id,
                                      (s) => ({ ...s, evidence: s.evidence.filter((e) => e.id !== item.id) }),
                                      'delete evidence',
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Related resources */}
                      <RelatedResources skill={skill} />
                    </div>
                  </CardBody>
                ) : null}
              </Card>
            )
          })
        )}
      </div>

      {/* Gap register */}
      <Card>
        <CardHeader
          title="Gap register"
          subtitle="Part 3 of the audit, verbatim"
          help="Every named gap from the audit, grouped by remediation tier and mapped to the competency it belongs to."
        />
        <CardBody>
          <div className="grid grid--auto" style={{ gap: 'var(--space-5)' }}>
            {(['must-fix', 'should-improve', 'nice-to-have'] as const).map((tier) => (
              <div key={tier} className="col" style={{ gap: 'var(--space-3)' }}>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <Badge tone={TIER_TONE[tier]} size="lg">
                    {TIER_LABEL[tier]}
                  </Badge>
                  <span className="text-2xs text-quaternary">
                    {(meta.gapRegister[tier] ?? []).length} items
                  </span>
                </div>
                {(meta.gapRegister[tier] ?? []).map((gap) => {
                  const skill = data.skills.find((s) => s.name === gap.skill)
                  return (
                    <button
                      key={gap.id}
                      type="button"
                      className="col"
                      style={{
                        gap: 3,
                        textAlign: 'left',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-sm)',
                        width: '100%',
                      }}
                      onClick={() => {
                        if (!skill) return
                        setExpanded((prev) => new Set(prev).add(skill.id))
                        window.location.hash = `/skills#${skill.id}`
                      }}
                    >
                      <div className="row row--between">
                        <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>
                          {gap.title}
                        </span>
                        {skill ? <span className="text-2xs tnum text-quaternary">{skill.currentScore.toFixed(1)}</span> : null}
                      </div>
                      <span className="text-2xs text-tertiary">{gap.detail}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------ related resources -- */

/** Books, courses, projects and interview questions tagged to this competency. */
function RelatedResources({ skill }: { skill: Skill }) {
  const { data } = useStore()

  const books = data.books.filter((b) => b.skillIds.includes(skill.id))
  const courses = data.courses.filter((c) => c.skillIds.includes(skill.id))
  const projects = data.portfolio.filter((p) => p.skillIds.includes(skill.id))
  const questions = data.interviews.questions.filter((q) => q.skillIds.includes(skill.id))

  const groups = [
    { label: 'Books & articles', items: books.map((b) => ({ id: b.id, label: b.title, meta: b.status })), route: '/reading' },
    { label: 'Courses', items: courses.map((c) => ({ id: c.id, label: c.title, meta: `${c.progress}%` })), route: '/courses' },
    { label: 'Projects', items: projects.map((p) => ({ id: p.id, label: p.title, meta: `${p.completion}%` })), route: '/portfolio' },
    {
      label: 'Interview questions',
      items: questions.slice(0, 6).map((q) => ({ id: q.id, label: q.prompt, meta: `×${q.practiceCount}` })),
      route: '/interview-prep',
    },
  ].filter((group) => group.items.length > 0)

  if (groups.length === 0) return null

  return (
    <>
      <hr className="divider" />
      <div className="grid grid--auto" style={{ gap: 'var(--space-4)' }}>
        {groups.map((group) => (
          <div key={group.label} className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">{group.label}</span>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="row row--between"
                style={{ gap: 'var(--space-2)', textAlign: 'left', width: '100%' }}
                onClick={() => window.location.assign(`#${group.route}#${item.id}`)}
              >
                <span className="text-xs text-secondary truncate">{item.label}</span>
                <span className="text-2xs text-quaternary shrink-0">{item.meta}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
