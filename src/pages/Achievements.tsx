/* ============================================================================
   Achievements
   ----------------------------------------------------------------------------
   Achievements unlock from evidence — hours logged, artefacts published, scores
   reached — never from opening the app. Progressive badges show where you are on
   a longer arc, and the "closest to unlocking" list doubles as a work queue.
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
  HelpDot,
  Icon,
  ProgressBar,
  Ring,
  Segmented,
  Stat,
  Tooltip,
} from '../components/ui'
import { formatCompact, formatDate, formatRelative } from '../lib/dates'
import { cumulativeXpForLevel } from '../lib/derive'
import { useStore } from '../lib/store'
import type { Achievement } from '../lib/types'

const TIER_TONE = { bronze: 'warning', silver: 'neutral', gold: 'accent', platinum: 'success' } as const

const TIER_COLOR = {
  bronze: '#b06f2e',
  silver: '#9aa0ac',
  gold: '#d9a51b',
  platinum: '#4fd1a5',
} as const

const CATEGORY_LABEL: Record<Achievement['category'], string> = {
  learning: 'Learning',
  portfolio: 'Portfolio',
  analytics: 'Analytics',
  interview: 'Interview',
  brand: 'Brand',
  consistency: 'Consistency',
  milestone: 'Milestones',
}

type Filter = 'all' | 'unlocked' | 'locked' | 'close'

export function Achievements() {
  const { data, derived, update } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [categoryFilter, setCategoryFilter] = useState<Achievement['category'] | 'all'>('all')

  const { achievements } = data.achievements
  const { unlocked, progress } = derived.achievements

  const rows = useMemo(() => {
    return achievements
      .map((achievement) => ({
        achievement,
        isUnlocked: unlocked.has(achievement.id),
        progress: progress.get(achievement.id),
      }))
      .filter((row) => {
        if (categoryFilter !== 'all' && row.achievement.category !== categoryFilter) return false
        if (filter === 'unlocked' && !row.isUnlocked) return false
        if (filter === 'locked' && row.isUnlocked) return false
        if (filter === 'close' && (row.isUnlocked || (row.progress?.pct ?? 0) < 40)) return false
        return true
      })
      .sort((a, b) => {
        // Unlocked most-recent-first, then locked by how close they are.
        if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1
        if (a.isUnlocked && b.isUnlocked) {
          return (b.achievement.unlockedAt ?? '').localeCompare(a.achievement.unlockedAt ?? '')
        }
        return (b.progress?.pct ?? 0) - (a.progress?.pct ?? 0)
      })
  }, [achievements, categoryFilter, filter, progress, unlocked])

  /** Manual achievements — the ones the engine cannot verify. */
  const toggleManual = (achievement: Achievement) => {
    update(
      (draft) => ({
        ...draft,
        achievements: {
          ...draft.achievements,
          achievements: draft.achievements.achievements.map((a) =>
            a.id === achievement.id
              ? { ...a, unlockedAt: a.unlockedAt ? undefined : new Date().toISOString() }
              : a,
          ),
        },
      }),
      ['achievements'],
      achievement.unlockedAt ? `re-lock ${achievement.name}` : `unlock ${achievement.name}`,
    )
  }

  const stats = useMemo(() => {
    const byTier = (tier: Achievement['tier']) => ({
      total: achievements.filter((a) => a.tier === tier).length,
      unlocked: achievements.filter((a) => a.tier === tier && unlocked.has(a.id)).length,
    })
    return {
      unlocked: unlocked.size,
      total: achievements.length,
      xpFromAchievements: achievements
        .filter((a) => unlocked.has(a.id))
        .reduce((sum, a) => sum + a.xp, 0),
      xpAvailable: achievements.filter((a) => !unlocked.has(a.id)).reduce((sum, a) => sum + a.xp, 0),
      bronze: byTier('bronze'),
      silver: byTier('silver'),
      gold: byTier('gold'),
      platinum: byTier('platinum'),
    }
  }, [achievements, unlocked])

  const byCategory = useMemo(
    () =>
      (Object.keys(CATEGORY_LABEL) as Achievement['category'][]).map((category, i) => {
        const inCategory = achievements.filter((a) => a.category === category)
        return {
          category,
          label: CATEGORY_LABEL[category],
          total: inCategory.length,
          unlocked: inCategory.filter((a) => unlocked.has(a.id)).length,
          color: seriesColor(i),
        }
      }),
    [achievements, unlocked],
  )

  /** Level ladder, so the next several levels are visible rather than implied. */
  const levelLadder = useMemo(() => {
    const current = derived.xp.level
    return Array.from({ length: 6 }, (_, i) => {
      const level = current + i
      return {
        level,
        threshold: cumulativeXpForLevel(level),
        next: cumulativeXpForLevel(level + 1),
        isCurrent: i === 0,
      }
    })
  }, [derived.xp.level])

  return (
    <div className="page">
      <PageHeader
        title="Achievements"
        lede="Everything here unlocks from evidence — hours logged, artefacts published, scores reached, streaks held. Nothing unlocks from opening the app, which is what keeps the numbers meaningful."
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: achievements.length },
              { value: 'unlocked', label: 'Earned', count: stats.unlocked },
              { value: 'close', label: 'Close' },
              { value: 'locked', label: 'Locked', count: stats.total - stats.unlocked },
            ]}
          />
        }
      />

      {/* Level + XP */}
      <div className="grid grid--auto-lg">
        <Card variant="accent" className="span-2">
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-6)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="col" style={{ alignItems: 'center', gap: 'var(--space-2)' }}>
                <Ring
                  value={derived.xp.levelPct}
                  size={132}
                  thickness={10}
                  display={derived.xp.level}
                  label="Level"
                  valueSize={40}
                />
                <span className="text-2xs text-quaternary tnum">
                  {formatCompact(derived.xp.toNextLevel)} XP to level {derived.xp.level + 1}
                </span>
              </div>

              <div className="col grow" style={{ gap: 'var(--space-4)', minWidth: 240 }}>
                <div className="grid grid--2" style={{ gap: 'var(--space-4)' }}>
                  <Stat
                    label="Total XP"
                    value={derived.xp.total.toLocaleString()}
                    size="lg"
                    help={`Tasks ${formatCompact(derived.xp.fromTasks)} · missions ${formatCompact(derived.xp.fromMissions)} · achievements ${formatCompact(derived.xp.fromAchievements)} · logged activity ${formatCompact(derived.xp.fromActivity)}.`}
                  />
                  <Stat
                    label="Achievements"
                    value={`${stats.unlocked} / ${stats.total}`}
                    size="lg"
                    tone={stats.unlocked === stats.total ? 'success' : undefined}
                  />
                  <Stat
                    label="XP from achievements"
                    value={formatCompact(stats.xpFromAchievements)}
                    size="md"
                    meta={`${formatCompact(stats.xpAvailable)} still available`}
                  />
                  <Stat label="Streak" value={`${derived.streak.current}d`} size="md" meta={`best ${derived.streak.longest}d`} />
                </div>

                <div className="col" style={{ gap: 'var(--space-2)' }}>
                  <span className="section-title">
                    Level ladder
                    <HelpDot>
                      The curve is quadratic: early levels arrive fast, later ones take real work. Level 25
                      needs 75,000 XP.
                    </HelpDot>
                  </span>
                  {levelLadder.map((rung) => {
                    const span = rung.next - rung.threshold
                    const into = Math.max(0, Math.min(span, derived.xp.total - rung.threshold))
                    return (
                      <div key={rung.level} className="row" style={{ gap: 'var(--space-3)' }}>
                        <span
                          className="text-2xs tnum shrink-0"
                          style={{
                            width: 24,
                            color: rung.isCurrent ? 'var(--accent-text)' : 'var(--text-quaternary)',
                            fontWeight: rung.isCurrent ? 'var(--weight-bold)' : undefined,
                          }}
                        >
                          {rung.level}
                        </span>
                        <div className="grow">
                          <ProgressBar
                            value={span > 0 ? (into / span) * 100 : 0}
                            size="xs"
                            tone={into >= span ? 'success' : undefined}
                          />
                        </div>
                        <span className="text-2xs tnum text-quaternary shrink-0" style={{ width: 54, textAlign: 'right' }}>
                          {formatCompact(rung.next)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Tier breakdown */}
        <Card>
          <CardHeader title="By tier" help="Tiers escalate with the difficulty of the proof required. Platinum needs the kind of evidence that ends the programme." />
          <CardBody>
            <div className="col" style={{ gap: 'var(--space-4)' }}>
              {(['bronze', 'silver', 'gold', 'platinum'] as const).map((tier) => {
                const row = stats[tier]
                return (
                  <div key={tier} className="col" style={{ gap: 5 }}>
                    <div className="row row--between">
                      <span className="row text-xs" style={{ gap: 6 }}>
                        <span
                          className="chart-legend__swatch"
                          style={{ background: TIER_COLOR[tier], width: 9, height: 9, borderRadius: 2 }}
                        />
                        <span className="text-secondary" style={{ textTransform: 'capitalize' }}>
                          {tier}
                        </span>
                      </span>
                      <span className="text-xs tnum text-tertiary">
                        {row.unlocked} / {row.total}
                      </span>
                    </div>
                    <ProgressBar
                      value={row.total > 0 ? (row.unlocked / row.total) * 100 : 0}
                      size="sm"
                      tone={row.unlocked === row.total ? 'success' : undefined}
                    />
                  </div>
                )
              })}

              <hr className="divider" />

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <DonutChart
                  data={byCategory.filter((c) => c.total > 0).map((c) => ({ label: c.label, value: c.unlocked, color: c.color }))}
                  size={130}
                  thickness={19}
                  centerValue={stats.unlocked}
                  centerLabel="earned"
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Badges */}
      <Card>
        <CardHeader
          title="Progressive badges"
          subtitle="Long arcs, five levels each"
          help="Badges track the things that only compound over a long horizon. The next threshold is always visible, so there is never a question about what would move it."
        />
        <CardBody className="card__body--none">
          <div className="grid grid--auto" style={{ gap: 0 }}>
            {derived.badges.map((row, index) => (
              <div
                key={row.badge.id}
                style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderLeft: index === 0 ? 'none' : '1px solid var(--border-subtle)',
                  borderTop: index >= 4 ? '1px solid var(--border-subtle)' : undefined,
                }}
              >
                <div className="col" style={{ gap: 'var(--space-3)' }}>
                  <div className="row" style={{ gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 24, lineHeight: 1, opacity: row.levelIndex >= 0 ? 1 : 0.35 }}>
                      {row.badge.icon}
                    </span>
                    <div className="col grow" style={{ gap: 1, minWidth: 0 }}>
                      <span className="text-sm" style={{ fontWeight: 'var(--weight-semibold)' }}>
                        {row.badge.name}
                      </span>
                      <span className="text-2xs text-quaternary">{row.badge.description}</span>
                    </div>
                    <Badge tone={row.maxed ? 'success' : row.levelIndex >= 0 ? 'accent' : 'neutral'}>
                      {row.levelLabel}
                    </Badge>
                  </div>

                  {/* Level pips */}
                  <div className="row" style={{ gap: 3 }}>
                    {row.badge.levels.map((level, i) => (
                      <Tooltip key={level.label} content={`${level.label} — ${level.threshold.toLocaleString()}`}>
                        <span
                          style={{
                            flex: 1,
                            height: 5,
                            borderRadius: 2,
                            background: i <= row.levelIndex ? 'var(--accent)' : 'var(--track)',
                          }}
                        />
                      </Tooltip>
                    ))}
                  </div>

                  <div className="row row--between text-2xs">
                    <span className="tnum text-tertiary">{row.current.toLocaleString()}</span>
                    {row.next ? (
                      <span className="tnum text-quaternary">
                        next: {row.next.label} at {row.next.threshold.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-success">maxed</span>
                    )}
                  </div>

                  {row.next ? <ProgressBar value={row.pctToNext} size="xs" /> : null}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Category filter */}
      <div className="row row--wrap" style={{ gap: 4 }}>
        <button type="button" onClick={() => setCategoryFilter('all')} style={{ display: 'inline-flex' }}>
          <Badge tone={categoryFilter === 'all' ? 'accent' : 'neutral'} size="lg">
            All · {stats.unlocked}/{stats.total}
          </Badge>
        </button>
        {byCategory.map((category) => (
          <button
            key={category.category}
            type="button"
            onClick={() => setCategoryFilter(category.category)}
            style={{ display: 'inline-flex' }}
          >
            <Badge tone={categoryFilter === category.category ? 'accent' : 'neutral'} size="lg">
              {category.label} · {category.unlocked}/{category.total}
            </Badge>
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid--auto">
        {rows.map(({ achievement, isUnlocked, progress: p }) => (
          <Card
            key={achievement.id}
            variant={isUnlocked ? 'default' : 'inset'}
            style={isUnlocked ? { borderColor: TIER_COLOR[achievement.tier] } : undefined}
          >
            <CardBody>
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontSize: 28,
                      lineHeight: 1,
                      filter: isUnlocked ? undefined : 'grayscale(1)',
                      opacity: isUnlocked ? 1 : 0.35,
                    }}
                  >
                    {achievement.icon}
                  </span>
                  <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                    <span
                      className="text-sm"
                      style={{
                        fontWeight: 'var(--weight-semibold)',
                        color: isUnlocked ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    >
                      {achievement.name}
                    </span>
                    <div className="row row--wrap" style={{ gap: 4 }}>
                      <Badge tone={TIER_TONE[achievement.tier]}>{achievement.tier}</Badge>
                      {achievement.xp > 0 ? <Badge tone={isUnlocked ? 'success' : 'neutral'}>+{achievement.xp}</Badge> : null}
                      {achievement.criterion.type === 'manual' ? <Badge tone="warning">manual</Badge> : null}
                    </div>
                  </div>
                  {isUnlocked ? (
                    <span style={{ color: 'var(--success)', flexShrink: 0 }}>
                      <Icon name="check" size={16} />
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-quaternary)', flexShrink: 0 }}>
                      <Icon name="lock" size={14} />
                    </span>
                  )}
                </div>

                <p
                  className="text-xs clamp-3"
                  style={{
                    color: isUnlocked ? 'var(--text-secondary)' : 'var(--text-quaternary)',
                    lineHeight: 'var(--leading-snug)',
                    minHeight: 42,
                  }}
                >
                  {achievement.description}
                </p>

                {isUnlocked ? (
                  <span className="text-2xs text-success">
                    Earned {formatRelative(achievement.unlockedAt?.slice(0, 10))}
                    {achievement.unlockedAt ? ` · ${formatDate(achievement.unlockedAt.slice(0, 10), { year: true })}` : ''}
                  </span>
                ) : p ? (
                  <div className="col" style={{ gap: 4 }}>
                    <ProgressBar value={p.pct} size="sm" tone={p.pct >= 80 ? 'warning' : undefined} />
                    <span className="text-2xs tnum text-quaternary">
                      {p.current.toLocaleString()} / {p.target.toLocaleString()} · {Math.round(p.pct)}%
                    </span>
                  </div>
                ) : null}

                {achievement.criterion.type === 'manual' ? (
                  <Button
                    variant={isUnlocked ? 'ghost' : 'subtle'}
                    size="sm"
                    onClick={() => toggleManual(achievement)}
                    fullWidth
                  >
                    {isUnlocked ? 'Mark as not achieved' : 'Mark as achieved'}
                  </Button>
                ) : null}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card variant="inset">
        <CardFooter>
          <span>
            {stats.unlocked} of {stats.total} achievements · {formatCompact(stats.xpFromAchievements)} XP earned
          </span>
          <span className="tnum">{formatCompact(stats.xpAvailable)} XP still on the table</span>
        </CardFooter>
      </Card>
    </div>
  )
}
