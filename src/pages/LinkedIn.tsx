/* ============================================================================
   LinkedIn
   ----------------------------------------------------------------------------
   Part 6 of the audit, made operational. The positioning statement, headline,
   About themes and weekly cadence are quoted verbatim — they are the answer to
   "outside your network, almost nobody knows you", and repeating the same few
   ideas is what turns a profile into a position.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { BarChart, LineChart, seriesColor } from '../components/charts'
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
  Segmented,
  Select,
  Stat,
  Tooltip,
} from '../components/ui'
import { addDays, formatCompact, formatDate } from '../lib/dates'
import { newId, useStore } from '../lib/store'
import type { ContentIdea, ID, LinkedInSnapshot } from '../lib/types'

const FORMAT_LABEL: Record<ContentIdea['format'], string> = {
  'deep-dive': 'Deep dive',
  'short-post': 'Short post',
  carousel: 'Carousel',
  article: 'Article',
  teardown: 'Teardown',
}

const IDEA_STATUS_TONE = { idea: 'neutral', drafting: 'warning', scheduled: 'info', published: 'success' } as const

const IDEA_STATUS_ORDER: ContentIdea['status'][] = ['idea', 'drafting', 'scheduled', 'published']

type View = 'growth' | 'calendar' | 'profile'

export function LinkedIn() {
  const { data, derived, update } = useStore()
  const [view, setView] = useState<View>('growth')
  const [openId, setOpenId] = useState<ID | null>(null)
  const [showSnapshotForm, setShowSnapshotForm] = useState(false)

  const li = data.linkedin
  const latest = li.snapshots.at(-1)
  const previous = li.snapshots.at(-2)
  const first = li.snapshots[0]

  const open = openId ? li.ideas.find((i) => i.id === openId) : undefined

  const patchLinkedIn = (producer: (current: typeof li) => typeof li, label: string) => {
    update((draft) => ({ ...draft, linkedin: producer(draft.linkedin) }), ['linkedin'], label)
  }

  const updateIdea = (ideaId: ID, producer: (idea: ContentIdea) => ContentIdea, label: string) => {
    patchLinkedIn((current) => ({ ...current, ideas: current.ideas.map((i) => (i.id === ideaId ? producer(i) : i)) }), label)
  }

  const addIdea = () => {
    const idea: ContentIdea = {
      id: newId('idea'),
      title: 'New idea',
      angle: '',
      theme: li.aboutThemes[0] ?? '',
      format: 'short-post',
      status: 'idea',
      skillIds: [],
      order: li.ideas.length,
    }
    patchLinkedIn((current) => ({ ...current, ideas: [idea, ...current.ideas] }), 'add content idea')
    setOpenId(idea.id)
  }

  /** A new snapshot seeds from the last one, so only what changed needs typing. */
  const addSnapshot = () => {
    const base: LinkedInSnapshot = latest
      ? { ...latest, date: derived.today, posts: 0, comments: 0, impressions: 0, profileViews: 0, searchAppearances: 0 }
      : {
          date: derived.today,
          followers: 0,
          connections: 0,
          impressions: 0,
          profileViews: 0,
          searchAppearances: 0,
          posts: 0,
          comments: 0,
        }
    patchLinkedIn(
      (current) => ({
        ...current,
        snapshots: [...current.snapshots.filter((s) => s.date !== base.date), base].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      }),
      'add snapshot',
    )
    setShowSnapshotForm(true)
  }

  const updateSnapshot = (date: string, producer: (snapshot: LinkedInSnapshot) => LinkedInSnapshot, label: string) => {
    patchLinkedIn(
      (current) => ({ ...current, snapshots: current.snapshots.map((s) => (s.date === date ? producer(s) : s)) }),
      label,
    )
  }

  /* --------------------------------------------------------------- stats -- */

  const stats = useMemo(() => {
    const weekStart = addDays(derived.today, -7)
    const recent = li.snapshots.filter((s) => s.date >= weekStart)
    return {
      followers: latest?.followers ?? 0,
      followerDelta: latest && previous ? latest.followers - previous.followers : 0,
      totalGrowth: latest && first ? latest.followers - first.followers : 0,
      connections: latest?.connections ?? 0,
      connectionDelta: latest && previous ? latest.connections - previous.connections : 0,
      impressions: li.snapshots.reduce((sum, s) => sum + s.impressions, 0),
      profileViews: li.snapshots.reduce((sum, s) => sum + s.profileViews, 0),
      postsThisWeek: recent.reduce((sum, s) => sum + s.posts, 0),
      commentsThisWeek: recent.reduce((sum, s) => sum + s.comments, 0),
      published: li.ideas.filter((i) => i.status === 'published').length,
      backlog: li.ideas.filter((i) => i.status === 'idea').length,
    }
  }, [derived.today, first, latest, li.ideas, li.snapshots, previous])

  const followerSeries = li.snapshots.map((s) => ({ x: s.date, y: s.followers }))
  const connectionSeries = li.snapshots.map((s) => ({ x: s.date, y: s.connections }))
  const impressionSeries = li.snapshots.map((s) => ({ x: s.date, y: s.impressions }))
  const engagementSeries = li.snapshots.map((s) => ({ x: s.date, y: s.comments }))

  const byTheme = useMemo(() => {
    const map = new Map<string, number>()
    for (const idea of li.ideas) map.set(idea.theme, (map.get(idea.theme) ?? 0) + 1)
    return [...map.entries()]
      .map(([label, value], i) => ({ label: label || 'Untagged', value, color: seriesColor(i) }))
      .sort((a, b) => b.value - a.value)
  }, [li.ideas])

  return (
    <div className="page">
      <PageHeader
        title="LinkedIn"
        lede="The audit's Part 6 strategy, made operational. One positioning statement, five themes, and a weekly cadence — repeated for twenty-four months. Consistency of theme is what makes a recruiter able to say what you specialise in after reading three posts."
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'growth', label: 'Growth' },
                { value: 'calendar', label: 'Content' },
                { value: 'profile', label: 'Positioning' },
              ]}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Icon name="plus" size={13} />}
              onClick={view === 'calendar' ? addIdea : addSnapshot}
            >
              {view === 'calendar' ? 'New idea' : 'Log snapshot'}
            </Button>
          </>
        }
      />

      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Followers"
              value={formatCompact(stats.followers)}
              size="lg"
              delta={{ value: stats.followerDelta }}
              meta={`+${stats.totalGrowth} since start`}
              help="Reach feeds the Presence pillar of your readiness score. 5,000 is treated as full marks — enough that opportunities start finding you."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Connections"
              value={formatCompact(stats.connections)}
              size="lg"
              delta={{ value: stats.connectionDelta }}
              help="The audit's target is roughly 20 relevant connections per week — about 2,000 over the programme. Relevant is the operative word."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Posts this week"
              value={`${stats.postsThisWeek} / 3`}
              size="lg"
              tone={stats.postsThisWeek >= 3 ? 'success' : 'warning'}
              help="One deep-dive plus two shorter posts, per the audit's weekly cadence."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Comments this week"
              value={`${stats.commentsThisWeek} / 25`}
              size="lg"
              tone={stats.commentsThisWeek >= 25 ? 'success' : 'warning'}
              help="20–30 thoughtful comments per week on posts by recognised PMs. A comment that adds a distinct point is worth more than ten posts nobody reads."
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar
                value={(stats.commentsThisWeek / 25) * 100}
                size="xs"
                tone={stats.commentsThisWeek >= 25 ? 'success' : undefined}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Total impressions"
              value={formatCompact(stats.impressions)}
              size="lg"
              meta={`${formatCompact(stats.profileViews)} profile views`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Idea backlog"
              value={stats.backlog}
              size="lg"
              tone={stats.backlog >= 10 ? 'success' : 'warning'}
              meta={`${stats.published} published`}
              help="Thirty ideas is what makes a weekly cadence survivable. An empty backlog is why people stop posting in month three."
            />
          </CardBody>
        </Card>
      </div>

      {/* ---------------------------------------------------------- growth -- */}
      {view === 'growth' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="grid grid--auto-lg">
            <Card className="span-2">
              <CardHeader
                title="Audience growth"
                subtitle={`${formatCompact(stats.followers)} followers · ${formatCompact(stats.connections)} connections`}
                help="Growth is the lagging indicator. Comments and posts are the leading ones — if this line is flat, look at the cadence numbers above."
              />
              <CardBody>
                {li.snapshots.length > 1 ? (
                  <LineChart
                    series={[
                      { label: 'Followers', color: 'var(--accent)', points: followerSeries, fill: true },
                      { label: 'Connections', color: 'var(--viz-2)', points: connectionSeries },
                    ]}
                    height={240}
                    formatX={(x) => formatDate(x)}
                    formatY={(y) => formatCompact(y)}
                  />
                ) : (
                  <EmptyState icon="📣" title="Not enough snapshots" body="Log a second snapshot to see the trend." />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Weekly cadence" subtitle="Part 6, verbatim" help="These four numbers are the whole strategy. Everything else is a consequence of hitting them." />
              <CardBody>
                <div className="col" style={{ gap: 'var(--space-4)' }}>
                  {li.weeklyCadence.map((row, index) => (
                    <div key={row.label} className="col" style={{ gap: 4 }}>
                      <div className="row row--between">
                        <span className="text-xs text-secondary" style={{ minWidth: 0 }}>
                          {row.label}
                        </span>
                        <span className="text-xs tnum shrink-0" style={{ fontWeight: 'var(--weight-semibold)' }}>
                          <InlineEdit
                            value={row.target}
                            numeric
                            onCommit={(next) =>
                              patchLinkedIn(
                                (current) => ({
                                  ...current,
                                  weeklyCadence: current.weeklyCadence.map((r, i) =>
                                    i === index ? { ...r, target: Number(next) || 0 } : r,
                                  ),
                                }),
                                'edit cadence target',
                              )
                            }
                            ariaLabel="Target"
                          />
                          <span className="text-quaternary"> {row.unit}</span>
                        </span>
                      </div>
                      <ProgressBar
                        value={
                          index === 0
                            ? (stats.postsThisWeek / Math.max(1, row.target)) * 100
                            : index === 2
                              ? (stats.commentsThisWeek / Math.max(1, row.target)) * 100
                              : 0
                        }
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid--auto-lg">
            <Card>
              <CardHeader title="Impressions" help="Impressions per snapshot period. Spikes usually trace back to one post — find it and understand why." />
              <CardBody>
                {li.snapshots.length > 1 ? (
                  <LineChart
                    series={[{ label: 'Impressions', color: 'var(--viz-4)', points: impressionSeries, fill: true }]}
                    height={180}
                    formatX={(x) => formatDate(x)}
                    formatY={(y) => formatCompact(y)}
                  />
                ) : (
                  <span className="text-xs text-quaternary">Log more snapshots.</span>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Engagement given" subtitle="Comments you made" help="Commenting is the cheapest way to be discovered by people with reach. It is also the first thing to slip." />
              <CardBody>
                {li.snapshots.length > 1 ? (
                  <LineChart
                    series={[{ label: 'Comments', color: 'var(--viz-3)', points: engagementSeries, fill: true }]}
                    height={180}
                    referenceY={25}
                    referenceLabel="Weekly target"
                    formatX={(x) => formatDate(x)}
                    formatY={(y) => String(Math.round(y))}
                  />
                ) : (
                  <span className="text-xs text-quaternary">Log more snapshots.</span>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Snapshot table */}
          <Card>
            <CardHeader
              title="Snapshots"
              subtitle="Every value is editable inline"
              actions={
                <Button variant="secondary" size="sm" icon={<Icon name="plus" size={13} />} onClick={addSnapshot}>
                  Log today
                </Button>
              }
            />
            <CardBody className="card__body--none">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="num">Followers</th>
                      <th className="num">Connections</th>
                      <th className="num">Impressions</th>
                      <th className="num">Profile views</th>
                      <th className="num">Search appearances</th>
                      <th className="num">Posts</th>
                      <th className="num">Comments</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...li.snapshots].reverse().map((snapshot) => (
                      <tr key={snapshot.date}>
                        <td className="num strong">{formatDate(snapshot.date, { year: true })}</td>
                        {(
                          [
                            'followers',
                            'connections',
                            'impressions',
                            'profileViews',
                            'searchAppearances',
                            'posts',
                            'comments',
                          ] as const
                        ).map((field) => (
                          <td key={field} className="num">
                            <InlineEdit
                              value={snapshot[field]}
                              numeric
                              onCommit={(next) =>
                                updateSnapshot(
                                  snapshot.date,
                                  (s) => ({ ...s, [field]: Math.max(0, Number(next) || 0) }),
                                  `edit ${field}`,
                                )
                              }
                              ariaLabel={field}
                            />
                          </td>
                        ))}
                        <td>
                          <DeleteButton
                            onDelete={() =>
                              patchLinkedIn(
                                (current) => ({
                                  ...current,
                                  snapshots: current.snapshots.filter((s) => s.date !== snapshot.date),
                                }),
                                'delete snapshot',
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
            <CardFooter>
              <span>{li.snapshots.length} snapshots</span>
              {showSnapshotForm ? <span className="text-accent">New row added — fill in the numbers above.</span> : null}
            </CardFooter>
          </Card>

          {/* Monthly goals */}
          {li.monthlyGoals.length > 0 ? (
            <Card>
              <CardHeader
                title="Monthly goals"
                subtitle="Ramping targets for the first twelve months"
                help="Targets ramp because the habit compounds — month 12 should be easier than month 3, not harder."
              />
              <CardBody className="card__body--none">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th className="num">Follower target</th>
                        <th className="num">Posts</th>
                        <th className="num">Comments</th>
                        <th className="num">Connections</th>
                        <th style={{ width: 130 }}>Actual vs target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {li.monthlyGoals.map((goal) => {
                        const pct = goal.followers > 0 ? (stats.followers / goal.followers) * 100 : 0
                        const reached = stats.followers >= goal.followers
                        return (
                          <tr key={goal.month}>
                            <td className="strong">{goal.month}</td>
                            <td className="num">{goal.followers.toLocaleString()}</td>
                            <td className="num">{goal.posts}</td>
                            <td className="num">{goal.comments}</td>
                            <td className="num">{goal.connections.toLocaleString()}</td>
                            <td>
                              <div className="row" style={{ gap: 6 }}>
                                <ProgressBar value={pct} size="sm" tone={reached ? 'success' : undefined} />
                                <span className="text-2xs tnum text-quaternary shrink-0">{Math.round(pct)}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* --------------------------------------------------------- content -- */}
      {view === 'calendar' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="grid grid--4" style={{ gap: 'var(--space-3)', alignItems: 'start' }}>
            {IDEA_STATUS_ORDER.map((status) => {
              const column = li.ideas.filter((i) => i.status === status)
              return (
                <Card key={status}>
                  <CardHeader
                    title={
                      <span className="row" style={{ gap: 6 }}>
                        <Badge tone={IDEA_STATUS_TONE[status]} dot>
                          {status}
                        </Badge>
                        <span className="text-2xs tnum text-quaternary">{column.length}</span>
                      </span>
                    }
                  />
                  <CardBody className="card__body--tight">
                    <div className="col" style={{ gap: 'var(--space-2)' }}>
                      {column.length === 0 ? (
                        <span className="text-2xs text-quaternary" style={{ padding: 'var(--space-2)' }}>
                          Empty
                        </span>
                      ) : (
                        column.map((idea) => (
                          <button
                            key={idea.id}
                            type="button"
                            onClick={() => setOpenId(idea.id)}
                            className="col"
                            style={{
                              gap: 5,
                              textAlign: 'left',
                              width: '100%',
                              padding: 'var(--space-3)',
                              background: 'var(--bg-inset)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            <span
                              className="text-xs clamp-3"
                              style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}
                            >
                              {idea.title}
                            </span>
                            <span className="text-2xs text-quaternary clamp-2">{idea.angle}</span>
                            <div className="row row--wrap" style={{ gap: 3 }}>
                              <Badge tone="neutral">{FORMAT_LABEL[idea.format]}</Badge>
                            </div>
                            {idea.impressions ? (
                              <span className="text-2xs tnum text-quaternary">
                                {formatCompact(idea.impressions)} impressions · {idea.reactions ?? 0} reactions
                              </span>
                            ) : null}
                            {idea.scheduledFor ? (
                              <span className="text-2xs text-quaternary">{formatDate(idea.scheduledFor)}</span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>

          {byTheme.length > 0 ? (
            <Card>
              <CardHeader
                title="Content by theme"
                subtitle="Against the five About themes"
                help="Concentration is the point. Five themes repeated is a position; twenty topics is noise."
              />
              <CardBody>
                <BarChart data={byTheme} horizontal formatValue={(v) => `${v} idea${v === 1 ? '' : 's'}`} />
              </CardBody>
            </Card>
          ) : null}

          {li.ideas.length === 0 ? (
            <Card>
              <EmptyState
                icon="💡"
                title="No ideas yet"
                body="Thirty ideas is a year of cover. Start with ten from work you have already done."
                action={
                  <Button variant="primary" size="sm" onClick={addIdea}>
                    New idea
                  </Button>
                }
              />
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------- positioning */}
      {view === 'profile' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <Card variant="accent">
            <CardHeader
              title="Positioning"
              subtitle="Part 6 of the audit, verbatim"
              help="Say one specific thing, repeatedly. A generic profile is indistinguishable from every other PM's, which is precisely the problem the audit identifies."
            />
            <CardBody>
              <div className="col" style={{ gap: 'var(--space-5)' }}>
                <div className="col" style={{ gap: 5 }}>
                  <span className="section-title">Positioning statement</span>
                  <span className="text-md" style={{ lineHeight: 'var(--leading-normal)' }}>
                    <InlineEdit
                      value={li.positioning}
                      multiline
                      onCommit={(next) => patchLinkedIn((c) => ({ ...c, positioning: next }), 'edit positioning')}
                      ariaLabel="Positioning statement"
                    />
                  </span>
                </div>

                <div className="col" style={{ gap: 5 }}>
                  <span className="section-title">Headline</span>
                  <span
                    className="text-sm mono"
                    style={{
                      lineHeight: 'var(--leading-normal)',
                      padding: 'var(--space-3)',
                      background: 'var(--bg-inset)',
                      borderRadius: 'var(--radius-md)',
                      display: 'block',
                    }}
                  >
                    <InlineEdit
                      value={li.headline}
                      multiline
                      onCommit={(next) => patchLinkedIn((c) => ({ ...c, headline: next }), 'edit headline')}
                      ariaLabel="Headline"
                    />
                  </span>
                  <span className="text-2xs text-quaternary">
                    {li.headline.length} characters — LinkedIn truncates around 220 on mobile
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="About themes"
              subtitle="The five ideas everything should ladder back to"
              help="Every post should be recognisably one of these five. That repetition is what makes a recruiter able to describe your specialism in one sentence."
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="plus" size={12} />}
                  onClick={() =>
                    patchLinkedIn((c) => ({ ...c, aboutThemes: [...c.aboutThemes, 'New theme'] }), 'add theme')
                  }
                >
                  Add
                </Button>
              }
            />
            <CardBody>
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                {li.aboutThemes.map((theme, index) => {
                  const count = li.ideas.filter((i) => i.theme === theme).length
                  return (
                    <div key={`${theme}-${index}`} className="row" style={{ gap: 'var(--space-3)' }}>
                      <Badge tone="accent">{index + 1}</Badge>
                      <span className="text-sm grow" style={{ color: 'var(--text-primary)' }}>
                        <InlineEdit
                          value={theme}
                          onCommit={(next) =>
                            patchLinkedIn(
                              (c) => ({
                                ...c,
                                aboutThemes: next
                                  ? c.aboutThemes.map((t, i) => (i === index ? next : t))
                                  : c.aboutThemes.filter((_, i) => i !== index),
                              }),
                              'edit theme',
                            )
                          }
                          ariaLabel="Theme"
                        />
                      </span>
                      <Tooltip content={`${count} content idea${count === 1 ? '' : 's'} against this theme`}>
                        <Badge tone={count > 0 ? 'success' : 'warning'}>{count}</Badge>
                      </Tooltip>
                      <IconButton
                        title="Remove theme"
                        tone="danger"
                        onClick={() =>
                          patchLinkedIn(
                            (c) => ({ ...c, aboutThemes: c.aboutThemes.filter((_, i) => i !== index) }),
                            'delete theme',
                          )
                        }
                      >
                        <Icon name="x" size={11} />
                      </IconButton>
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>

          <Card variant="inset">
            <CardHeader title="What not to post" help="From the audit's low-ROI list. Generic motivational content attracts an audience that cannot hire you and dilutes the positioning that can." />
            <CardBody>
              <div className="col" style={{ gap: 'var(--space-2)' }}>
                {[
                  'Generic motivational content — it attracts an audience that cannot hire you.',
                  'Reposts without a distinct point of your own added.',
                  'Anything that could have been written by any PM at any company.',
                  'Hot takes on topics you have no first-hand experience of.',
                ].map((item) => (
                  <div key={item} className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--danger)', fontSize: 11, marginTop: 2 }}>✕</span>
                    <span className="text-sm text-secondary">{item}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* ------------------------------------------------------- idea drawer */}
      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={640}
          title={
            <InlineEdit
              value={open.title}
              onCommit={(next) => updateIdea(open.id, (i) => ({ ...i, title: next }), 'rename idea')}
              ariaLabel="Idea title"
            />
          }
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              <Badge tone={IDEA_STATUS_TONE[open.status]}>{open.status}</Badge>
              <Badge tone="neutral">{FORMAT_LABEL[open.format]}</Badge>
              {open.publishedAt ? <span>· published {formatDate(open.publishedAt)}</span> : null}
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  patchLinkedIn((c) => ({ ...c, ideas: c.ideas.filter((i) => i.id !== open.id) }), 'delete idea')
                  setOpenId(null)
                }}
                label="Delete idea"
                size="md"
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {open.status !== 'published' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Icon name="check" size={13} />}
                    onClick={() =>
                      updateIdea(open.id, (i) => ({ ...i, status: 'published', publishedAt: derived.today }), 'publish idea')
                    }
                  >
                    Mark published
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>
            </>
          }
        >
          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Format</span>
              <Select
                value={open.format}
                size="sm"
                options={(Object.keys(FORMAT_LABEL) as ContentIdea['format'][]).map((f) => ({
                  value: f,
                  label: FORMAT_LABEL[f],
                }))}
                onChange={(next) => updateIdea(open.id, (i) => ({ ...i, format: next }), 'change format')}
              />
            </div>
            <div className="field">
              <span className="field__label">Status</span>
              <Select
                value={open.status}
                size="sm"
                options={IDEA_STATUS_ORDER.map((s) => ({ value: s, label: s }))}
                onChange={(next) =>
                  updateIdea(
                    open.id,
                    (i) => ({
                      ...i,
                      status: next,
                      publishedAt: next === 'published' ? (i.publishedAt ?? derived.today) : undefined,
                    }),
                    'change status',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Theme</span>
              <Select
                value={open.theme}
                size="sm"
                options={[
                  ...li.aboutThemes.map((t) => ({ value: t, label: t })),
                  ...(li.aboutThemes.includes(open.theme) ? [] : [{ value: open.theme, label: open.theme || 'Untagged' }]),
                ]}
                onChange={(next) => updateIdea(open.id, (i) => ({ ...i, theme: next }), 'change theme')}
              />
            </div>
            <div className="field">
              <span className="field__label">Scheduled for</span>
              <input
                className="input input--sm"
                type="date"
                value={open.scheduledFor ?? ''}
                onChange={(e) =>
                  updateIdea(open.id, (i) => ({ ...i, scheduledFor: e.target.value || undefined }), 'edit schedule')
                }
              />
            </div>
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">
              Angle
              <HelpDot>
                The specific thing that makes this worth reading. If the angle is "here is a framework",
                it will not land. If it is "the dashboard nobody opened", it will.
              </HelpDot>
            </span>
            <InlineEdit
              value={open.angle}
              multiline
              placeholder="What is the hook?"
              onCommit={(next) => updateIdea(open.id, (i) => ({ ...i, angle: next }), 'edit angle')}
              ariaLabel="Angle"
            />
          </div>

          {open.status === 'published' ? (
            <>
              <hr className="divider" />
              <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
                <div className="field">
                  <span className="field__label">Impressions</span>
                  <input
                    className="input input--sm input--num"
                    type="number"
                    min={0}
                    value={open.impressions ?? 0}
                    onChange={(e) =>
                      updateIdea(open.id, (i) => ({ ...i, impressions: Number(e.target.value) || undefined }), 'edit impressions')
                    }
                  />
                </div>
                <div className="field">
                  <span className="field__label">Reactions</span>
                  <input
                    className="input input--sm input--num"
                    type="number"
                    min={0}
                    value={open.reactions ?? 0}
                    onChange={(e) =>
                      updateIdea(open.id, (i) => ({ ...i, reactions: Number(e.target.value) || undefined }), 'edit reactions')
                    }
                  />
                </div>
                <div className="field">
                  <span className="field__label">Comments</span>
                  <input
                    className="input input--sm input--num"
                    type="number"
                    min={0}
                    value={open.comments ?? 0}
                    onChange={(e) =>
                      updateIdea(open.id, (i) => ({ ...i, comments: Number(e.target.value) || undefined }), 'edit comments')
                    }
                  />
                </div>
              </div>
              <div className="field">
                <span className="field__label">Post URL</span>
                <Input
                  value={open.url ?? ''}
                  size="sm"
                  placeholder="https://linkedin.com/posts/…"
                  onChange={(next) => updateIdea(open.id, (i) => ({ ...i, url: next || undefined }), 'edit url')}
                />
              </div>
            </>
          ) : null}

          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">Competencies this signals</span>
            <div className="row row--wrap" style={{ gap: 4 }}>
              {data.skills.map((skill) => {
                const selected = open.skillIds.includes(skill.id)
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() =>
                      updateIdea(
                        open.id,
                        (i) => ({
                          ...i,
                          skillIds: selected ? i.skillIds.filter((id) => id !== skill.id) : [...i.skillIds, skill.id],
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
        </Drawer>
      ) : null}
    </div>
  )
}
