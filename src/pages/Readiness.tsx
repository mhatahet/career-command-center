/* ============================================================================
   Readiness — the score, decomposed
   ----------------------------------------------------------------------------
   The headline number is only useful if you can see what moves it. This page
   shows the four pillars, every driver behind them, the trend, and the specific
   headroom available from each — so "raise my score" becomes a work list.
   ========================================================================= */

import { useMemo } from 'react'

import { Bullet, Gauge, LineChart, RadarChart, seriesColor } from '../components/charts'
import { PageHeader } from '../components/layout/Shell'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Icon,
  ProgressBar,
  Ring,
  Stat,
  Tooltip,
} from '../components/ui'
import { formatDate } from '../lib/dates'
import { PILLAR_WEIGHTS } from '../lib/derive'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'

export function Readiness() {
  const { data, derived } = useStore()
  const { readiness, projection, timeline } = derived

  const trend = data.analytics.readinessHistory.map((r) => ({ x: r.date, y: r.score }))

  /** Where the remaining points to 90 actually live. */
  const headroomRows = useMemo(
    () =>
      [...readiness.pillars]
        .sort((a, b) => b.headroom - a.headroom)
        .map((pillar) => ({
          ...pillar,
          // Share of the total remaining gap this pillar accounts for.
          shareOfGap:
            readiness.pillars.reduce((sum, p) => sum + p.headroom, 0) > 0
              ? (pillar.headroom / readiness.pillars.reduce((sum, p) => sum + p.headroom, 0)) * 100
              : 0,
        })),
    [readiness.pillars],
  )

  /** Weighted competency gap per skill — the ranked list of what to fix. */
  const skillGaps = useMemo(() => {
    const weightSum = data.skills.reduce((sum, s) => sum + s.weight, 0)
    return data.skills
      .map((skill) => {
        const gap = Math.max(0, skill.targetScore - skill.currentScore)
        const points = (gap / 10) * (skill.weight / weightSum) * 100 * PILLAR_WEIGHTS.competency
        return { skill, gap, points: Math.round(points * 100) / 100 }
      })
      .filter((row) => row.gap > 0)
      .sort((a, b) => b.points - a.points)
  }, [data.skills])

  const totalCompetencyHeadroom = skillGaps.reduce((sum, row) => sum + row.points, 0)

  return (
    <div className="page">
      <PageHeader
        title="Career Readiness Score"
        lede="One number out of 100, built from four weighted pillars. The audit's central finding is that your capability is real but the proof is not public — so competency alone cannot carry the score. Evidence, interview performance and market presence carry the rest, which is why the number climbs fastest when artefacts actually ship."
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/skills')} icon={<Icon name="arrowRight" size={13} />}>
            Edit competency scores
          </Button>
        }
      />

      {/* Headline */}
      <div className="grid grid--auto-lg">
        <Card variant="accent" className="span-2">
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-8)', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
              <div className="col" style={{ alignItems: 'center', gap: 'var(--space-3)' }}>
                <Gauge
                  value={readiness.score}
                  target={readiness.target}
                  size={252}
                  thickness={18}
                  segments={[
                    { from: 0, to: 45, color: 'var(--danger)' },
                    { from: 45, to: 70, color: 'var(--warning)' },
                    { from: 70, to: 90, color: 'var(--info)' },
                    { from: 90, to: 100, color: 'var(--success)' },
                  ]}
                >
                  <span
                    className="tnum"
                    style={{ fontSize: 56, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-tight)', lineHeight: 1 }}
                  >
                    {readiness.score}
                  </span>
                  <span className="text-xs text-tertiary">of 100</span>
                </Gauge>
                <Badge
                  size="lg"
                  tone={
                    readiness.band.tone === 'danger'
                      ? 'danger'
                      : readiness.band.tone === 'warning'
                        ? 'warning'
                        : readiness.band.tone === 'success'
                          ? 'success'
                          : 'info'
                  }
                >
                  {readiness.band.label}
                </Badge>
                <p className="text-xs text-secondary" style={{ maxWidth: 300, textAlign: 'center', lineHeight: 'var(--leading-normal)' }}>
                  {readiness.band.detail}
                </p>
              </div>

              <div className="col" style={{ gap: 'var(--space-5)', minWidth: 260, flex: 1 }}>
                <div className="grid grid--2" style={{ gap: 'var(--space-4)' }}>
                  <Stat label="Current" value={readiness.score} size="lg" />
                  <Stat label="Target" value={readiness.target} size="lg" meta="Tier 1 bar" />
                  <Stat label="Gap" value={readiness.gap} size="lg" tone="warning" />
                  <Stat
                    label="Forecast"
                    value={projection.readinessForecast}
                    size="lg"
                    tone={projection.readinessForecast >= 90 ? 'success' : projection.readinessForecast >= 80 ? 'accent' : 'warning'}
                    meta={`by ${formatDate(timeline.endDate, { year: true })}`}
                    help="Linear extrapolation of your readiness trend across the remaining days. It assumes the current rate holds, which is optimistic early and pessimistic later — the evidence pillar moves in steps, not smoothly."
                  />
                </div>

                <hr className="divider" />

                <div className="col" style={{ gap: 'var(--space-2)' }}>
                  <span className="section-title">Score bands</span>
                  {[
                    { min: 90, label: 'Tier 1 ready', tone: 'success' as const },
                    { min: 80, label: 'Top 10% ready', tone: 'success' as const },
                    { min: 70, label: 'Strong candidate', tone: 'info' as const },
                    { min: 60, label: 'Emerging', tone: 'info' as const },
                    { min: 45, label: 'Building proof', tone: 'warning' as const },
                  ].map((band) => (
                    <div key={band.label} className="row row--between">
                      <span className="row text-xs" style={{ gap: 6 }}>
                        <Badge tone={readiness.score >= band.min ? band.tone : 'neutral'}>{band.min}+</Badge>
                        <span className={readiness.score >= band.min ? 'text-secondary' : 'text-quaternary'}>
                          {band.label}
                        </span>
                      </span>
                      {readiness.score >= band.min ? <Icon name="check" size={13} /> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Trend */}
        <Card>
          <CardHeader
            title="Trend over time"
            subtitle={
              trend.length > 1
                ? `${(trend[trend.length - 1].y - trend[0].y >= 0 ? '+' : '')}${(trend[trend.length - 1].y - trend[0].y).toFixed(1)} since ${formatDate(trend[0].x)}`
                : 'Not enough history yet'
            }
            help="A snapshot is written each time the score is recalculated against a new day of data. The dashed line is the Tier-1 target."
          />
          <CardBody>
            {trend.length > 1 ? (
              <LineChart
                series={[{ label: 'Readiness', color: 'var(--accent)', points: trend, fill: true }]}
                height={220}
                yMin={Math.max(0, Math.min(...trend.map((t) => t.y)) - 8)}
                yMax={100}
                referenceY={90}
                referenceLabel="Tier 1"
                formatX={(x) => formatDate(x)}
                formatY={(y) => String(Math.round(y))}
              />
            ) : (
              <div className="text-sm text-tertiary" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                The trend appears once there are at least two snapshots.
              </div>
            )}
          </CardBody>
          <CardFooter>
            <span>{data.analytics.readinessHistory.length} snapshots</span>
            <span className="tnum">
              Competency alone: <strong>{readiness.competencyScore}</strong>
            </span>
          </CardFooter>
        </Card>
      </div>

      {/* Pillars */}
      <Card>
        <CardHeader
          title="The four pillars"
          subtitle="Where the score comes from, and where the remaining points are"
          help="Contribution is the points this pillar currently adds. Headroom is what is still available from it — the honest answer to 'what should I do next'."
        />
        <CardBody className="card__body--none">
          <div className="grid grid--auto" style={{ gap: 0 }}>
            {readiness.pillars.map((pillar, index) => (
              <div
                key={pillar.key}
                style={{
                  padding: 'var(--space-5)',
                  borderLeft: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <div className="col" style={{ gap: 'var(--space-4)' }}>
                  <div className="row" style={{ gap: 'var(--space-3)' }}>
                    <Ring
                      value={pillar.score}
                      size={62}
                      thickness={6}
                      tone={pillar.score >= 70 ? 'success' : pillar.score >= 40 ? undefined : 'warning'}
                      display={Math.round(pillar.score)}
                    />
                    <div className="col grow" style={{ gap: 2 }}>
                      <span className="text-sm" style={{ fontWeight: 'var(--weight-semibold)' }}>
                        {pillar.label}
                      </span>
                      <span className="text-2xs text-quaternary">
                        weight {(pillar.weight * 100).toFixed(0)}%
                      </span>
                      <span className="text-2xs">
                        <span className="text-tertiary">contributes </span>
                        <strong className="tnum" style={{ color: 'var(--text-primary)' }}>
                          {pillar.contribution}
                        </strong>
                        <span className="text-tertiary"> · headroom </span>
                        <strong className="tnum" style={{ color: 'var(--warning-text)' }}>
                          {pillar.headroom}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-tertiary" style={{ lineHeight: 'var(--leading-normal)' }}>
                    {pillar.detail}
                  </p>

                  <div className="col" style={{ gap: 'var(--space-2)' }}>
                    {pillar.drivers.map((driver) => (
                      <div key={driver.label} className="row row--between" style={{ gap: 'var(--space-2)' }}>
                        <span className="row text-xs" style={{ gap: 5, minWidth: 0 }}>
                          <span style={{ color: driver.done ? 'var(--success)' : 'var(--text-quaternary)', fontSize: 10 }}>
                            {driver.done ? '✓' : '○'}
                          </span>
                          <span className="truncate text-secondary">{driver.label}</span>
                        </span>
                        <span className="text-2xs tnum text-tertiary shrink-0">{driver.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Headroom allocation */}
      <div className="grid grid--auto-lg">
        <Card>
          <CardHeader
            title="Where the missing points are"
            subtitle={`${readiness.gap} points to the Tier 1 bar`}
            help="Sorted by how many readiness points each pillar still has to give. This is the answer to 'what would move the number most'."
          />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-4)' }}>
              {headroomRows.map((pillar, index) => (
                <div key={pillar.key} className="col" style={{ gap: 5 }}>
                  <div className="row row--between">
                    <span className="row text-sm" style={{ gap: 6 }}>
                      <span
                        className="chart-legend__swatch"
                        style={{ background: seriesColor(index), width: 9, height: 9, borderRadius: 2 }}
                      />
                      <span className="text-secondary">{pillar.label}</span>
                    </span>
                    <span className="text-xs tnum">
                      <strong style={{ color: 'var(--warning-text)' }}>{pillar.headroom}</strong>
                      <span className="text-quaternary"> pts · {pillar.shareOfGap.toFixed(0)}% of gap</span>
                    </span>
                  </div>
                  <ProgressBar value={pillar.shareOfGap} size="sm" tone="warning" />
                </div>
              ))}

              <hr className="divider" />

              <p className="text-xs text-tertiary" style={{ lineHeight: 'var(--leading-normal)' }}>
                {headroomRows[0]
                  ? `${headroomRows[0].label} holds the most available points. ${
                      headroomRows[0].key === 'evidence'
                        ? 'Publishing artefacts is the single fastest way to move this score — and it is precisely what the audit says is missing.'
                        : headroomRows[0].key === 'competency'
                          ? 'Closing the must-fix competency gaps is the priority.'
                          : headroomRows[0].key === 'interview'
                            ? 'Mock interview volume and score are the levers here.'
                            : 'Referrals and relationship strength are the levers here.'
                    }`
                  : 'Every pillar is maxed.'}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card className="span-2">
          <CardHeader
            title="Competency gaps, by readiness points"
            subtitle={`Closing all sixteen would add ${totalCompetencyHeadroom.toFixed(1)} points`}
            help="Each row shows the readiness points recovered by bringing that competency to its target. The ranking accounts for weight, so a small gap on a heavily-weighted competency can outrank a large gap on a light one."
          />
          <CardBody className="card__body--none">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Competency</th>
                    <th>Tier</th>
                    <th className="num">Current</th>
                    <th className="num">Target</th>
                    <th style={{ width: 120 }}>Progress</th>
                    <th className="num">Weight</th>
                    <th className="num">Points available</th>
                  </tr>
                </thead>
                <tbody>
                  {skillGaps.map(({ skill, gap, points }) => (
                    <tr key={skill.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/skills#${skill.id}`)}>
                      <td className="strong">{skill.name}</td>
                      <td>
                        <Badge
                          tone={
                            skill.tier === 'must-fix'
                              ? 'danger'
                              : skill.tier === 'should-improve'
                                ? 'warning'
                                : skill.tier === 'advantage'
                                  ? 'success'
                                  : 'neutral'
                          }
                        >
                          {skill.tier.replace('-', ' ')}
                        </Badge>
                      </td>
                      <td className="num">{skill.currentScore.toFixed(1)}</td>
                      <td className="num text-quaternary">{skill.targetScore.toFixed(1)}</td>
                      <td>
                        <Bullet value={skill.currentScore} target={skill.targetScore} baseline={skill.baselineScore} />
                      </td>
                      <td className="num">{(skill.weight * 100).toFixed(1)}%</td>
                      <td className="num">
                        <Tooltip content={`Closing this ${gap.toFixed(1)}-point gap adds ${points} readiness points.`}>
                          <strong style={{ color: points >= 1 ? 'var(--warning-text)' : 'var(--text-tertiary)' }}>
                            +{points.toFixed(2)}
                          </strong>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                  {skillGaps.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--success-text)' }}>
                        Every competency is at or above target.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Spider comparison against the baseline */}
      <div className="grid grid--auto-lg">
        <Card className="span-2">
          <CardHeader
            title="Spider chart"
            subtitle="Current versus target versus the original audit baseline"
            help="Three overlaid shapes. Where the filled shape has grown past the grey baseline, real progress has happened. Where it falls inside the dashed target, work remains."
          />
          <CardBody>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <RadarChart
                axes={data.skills.map((s) => s.name)}
                weakAxes={data.skills.filter((s) => s.currentScore < s.targetScore - 0.6).map((s) => s.name)}
                onAxisClick={(_, index) => navigate(`/skills#${data.skills[index]?.id}`)}
                series={[
                  { label: 'Current', color: 'var(--accent)', values: data.skills.map((s) => s.currentScore), fillOpacity: 0.22 },
                  { label: 'Target', color: 'var(--success)', values: data.skills.map((s) => s.targetScore), fillOpacity: 0.05, dashed: true },
                  { label: 'Baseline', color: 'var(--text-quaternary)', values: data.skills.map((s) => s.baselineScore), fillOpacity: 0, dashed: true },
                ]}
                size={420}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Assumptions behind the forecast" help="The audit's own conditions for the 65–75% probability estimate. The forecast is only meaningful while these hold." />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-4)' }}>
              <Stat
                label="Probability of a Senior PM role at a top international company"
                value={`${data.profile.successProbability.low}–${data.profile.successProbability.high}`}
                unit="%"
                size="lg"
                tone="accent"
                meta={`within ${data.profile.horizonMonths} months`}
              />
              <hr className="divider" />
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                {data.profile.successProbability.assumptions.map((assumption, i) => (
                  <div key={assumption} className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                    <Badge tone="neutral">{i + 1}</Badge>
                    <span className="text-xs text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                      {assumption}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
