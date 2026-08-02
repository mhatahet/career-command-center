/* ============================================================================
   Job Applications
   ----------------------------------------------------------------------------
   Pipeline by stage, target companies by tier, and the illustrative compensation
   table from Part 9. The audit is explicit that referral-backed, targeted
   applications beat high-volume submissions — so referral rate is the headline
   metric here, not application count.
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
import { formatMoney, formatRelative } from '../lib/dates'
import { useRoute, useScrollToAnchor } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { ApplicationStage, ID, JobApplication, TargetCompany } from '../lib/types'

const STAGE_LABEL: Record<ApplicationStage, string> = {
  researching: 'Researching',
  applied: 'Applied',
  'recruiter-screen': 'Recruiter screen',
  'hiring-manager': 'Hiring manager',
  'take-home': 'Take-home',
  'onsite-loop': 'Onsite loop',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
}

/** Funnel order. Terminal stages are excluded from the funnel view. */
const FUNNEL: ApplicationStage[] = [
  'researching',
  'applied',
  'recruiter-screen',
  'hiring-manager',
  'take-home',
  'onsite-loop',
  'offer',
]

const TERMINAL: ApplicationStage[] = ['rejected', 'withdrawn', 'ghosted']

const STAGE_TONE: Record<ApplicationStage, 'neutral' | 'info' | 'accent' | 'success' | 'danger' | 'warning'> = {
  researching: 'neutral',
  applied: 'info',
  'recruiter-screen': 'info',
  'hiring-manager': 'accent',
  'take-home': 'accent',
  'onsite-loop': 'warning',
  offer: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
  ghosted: 'neutral',
}

const TIER_NOTE: Record<1 | 2 | 3, string> = {
  1: 'Dream. Demands exceptional evidence in strategy, metrics, experimentation and scale.',
  2: 'Highly realistic. Strong fit with your enterprise SaaS and systems experience.',
  3: 'Stepping stone. Provides international experience and quantified impact for the next round.',
}

type View = 'pipeline' | 'targets' | 'compensation'

export function Applications() {
  const { data, derived, update } = useStore()
  const route = useRoute()

  const [view, setView] = useState<View>('pipeline')
  const [query, setQuery] = useState('')
  const [tierFilter, setTierFilter] = useState<1 | 2 | 3 | 'all'>('all')
  const [openId, setOpenId] = useState<ID | null>(route.anchor ?? null)

  useScrollToAnchor(route.anchor)

  const { applications, targetCompanies, compensation } = data.applications

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return applications.filter((app) => {
      if (tierFilter !== 'all' && app.companyTier !== tierFilter) return false
      if (!q) return true
      return `${app.company} ${app.role} ${app.country} ${app.interviewNotes}`.toLowerCase().includes(q)
    })
  }, [applications, query, tierFilter])

  const open = openId ? applications.find((a) => a.id === openId) : undefined

  const updateApplication = (appId: ID, producer: (app: JobApplication) => JobApplication, label: string) => {
    update(
      (draft) => ({
        ...draft,
        applications: {
          ...draft.applications,
          applications: draft.applications.applications.map((a) => (a.id === appId ? producer(a) : a)),
        },
      }),
      ['applications'],
      label,
    )
  }

  const updateCompany = (companyId: ID, producer: (company: TargetCompany) => TargetCompany, label: string) => {
    update(
      (draft) => ({
        ...draft,
        applications: {
          ...draft.applications,
          targetCompanies: draft.applications.targetCompanies.map((c) => (c.id === companyId ? producer(c) : c)),
        },
      }),
      ['applications'],
      label,
    )
  }

  const addApplication = (company?: TargetCompany) => {
    const app: JobApplication = {
      id: newId('app'),
      company: company?.name ?? 'New company',
      role: 'Senior Product Manager',
      companyTier: company?.tier ?? 2,
      country: '',
      remote: 'remote',
      stage: 'researching',
      hasReferral: false,
      rounds: [],
      interviewNotes: '',
      lessonsLearned: '',
      outcome: 'pending',
      order: applications.length,
    }
    update(
      (draft) => ({
        ...draft,
        applications: { ...draft.applications, applications: [app, ...draft.applications.applications] },
      }),
      ['applications'],
      'add application',
    )
    setOpenId(app.id)
    setView('pipeline')
  }

  /* --------------------------------------------------------------- stats -- */

  const stats = useMemo(() => {
    const live = applications.filter((a) => !TERMINAL.includes(a.stage) && a.stage !== 'researching')
    const submitted = applications.filter((a) => a.stage !== 'researching')
    const withReferral = submitted.filter((a) => a.hasReferral)
    const interviews = applications.filter((a) =>
      ['recruiter-screen', 'hiring-manager', 'take-home', 'onsite-loop', 'offer'].includes(a.stage),
    )
    return {
      total: applications.length,
      submitted: submitted.length,
      live: live.length,
      referralRate: submitted.length > 0 ? (withReferral.length / submitted.length) * 100 : 0,
      referrals: withReferral.length,
      interviews: interviews.length,
      responseRate: submitted.length > 0 ? (interviews.length / submitted.length) * 100 : 0,
      offers: applications.filter((a) => a.stage === 'offer').length,
      rejected: applications.filter((a) => TERMINAL.includes(a.stage)).length,
    }
  }, [applications])

  /** Funnel with stage-to-stage conversion, so the leak is visible. */
  const funnel = useMemo(() => {
    // An application at a later stage has passed every earlier one.
    const reached = (stage: ApplicationStage) => {
      const index = FUNNEL.indexOf(stage)
      return applications.filter((a) => {
        const current = FUNNEL.indexOf(a.stage)
        // Terminal applications count toward the furthest stage they reached,
        // which the rounds log approximates better than the stage alone.
        if (current === -1) return a.rounds.length >= index
        return current >= index
      }).length
    }

    return FUNNEL.map((stage, i) => {
      const count = reached(stage)
      const previous = i === 0 ? count : reached(FUNNEL[i - 1])
      return {
        stage,
        label: STAGE_LABEL[stage],
        value: count,
        conversion: previous > 0 ? (count / previous) * 100 : 0,
        color: seriesColor(i),
      }
    })
  }, [applications])

  const byTier = useMemo(
    () =>
      ([1, 2, 3] as const).map((tier) => ({
        tier,
        companies: targetCompanies.filter((c) => c.tier === tier),
        applications: applications.filter((a) => a.companyTier === tier).length,
      })),
    [applications, targetCompanies],
  )

  const isEarly = derived.timeline.currentMonth < 12

  return (
    <div className="page">
      <PageHeader
        title="Job Applications"
        lede="Referral rate, not application count. The audit puts “applying to hundreds of jobs without referrals or targeted preparation” on the explicit ignore list, and applications formally begin in month 12 — after the portfolio and the interview reps exist."
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search applications…" size="sm" />
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'pipeline', label: 'Pipeline', count: applications.length },
                { value: 'targets', label: 'Targets', count: targetCompanies.length },
                { value: 'compensation', label: 'Compensation' },
              ]}
            />
            <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={() => addApplication()}>
              Add
            </Button>
          </>
        }
      />

      {isEarly && applications.length === 0 ? (
        <Card variant="accent">
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent-text)' }}>
                <Icon name="info" size={18} />
              </span>
              <div className="col" style={{ gap: 4 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  Applications start in month 12 — you are in month {derived.timeline.currentMonth}
                </span>
                <p className="text-xs text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                  This is deliberate, not an oversight. Applying before you are interview-ready is one of the
                  three biggest mistakes in the audit: it burns referrals that are finite and largely
                  non-renewable. Use the intervening months to build the portfolio and the mock-interview
                  record, and use the Targets tab now to research and score fit.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Applications submitted"
              value={stats.submitted}
              size="lg"
              meta={`${stats.live} live · ${stats.rejected} closed`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Referral rate"
              value={Math.round(stats.referralRate)}
              unit="%"
              size="lg"
              tone={stats.referralRate >= 40 ? 'success' : stats.submitted > 0 ? 'warning' : 'neutral'}
              meta={`${stats.referrals} referral${stats.referrals === 1 ? '' : 's'}`}
              help="The single strongest predictor of conversion. The audit's recommendation is referral-backed applications over volume — 40% or above is a working network."
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar
                value={stats.referralRate}
                size="xs"
                marker={40}
                tone={stats.referralRate >= 40 ? 'success' : 'warning'}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Response rate"
              value={Math.round(stats.responseRate)}
              unit="%"
              size="lg"
              meta={`${stats.interviews} reached an interview`}
              help="Share of submitted applications that reached at least a recruiter screen. Low response with high volume means the targeting is wrong, not the résumé."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat label="Offers" value={stats.offers} size="lg" tone={stats.offers > 0 ? 'success' : 'neutral'} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Target companies"
              value={targetCompanies.filter((c) => c.watching).length}
              size="lg"
              meta={`of ${targetCompanies.length} tracked`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Interview readiness"
              value={derived.readiness.pillars.find((p) => p.key === 'interview')?.score.toFixed(0) ?? '—'}
              unit="/100"
              size="lg"
              tone={
                (derived.readiness.pillars.find((p) => p.key === 'interview')?.score ?? 0) >= 60
                  ? 'success'
                  : 'warning'
              }
              help="Check this before applying to a Tier 1 company. A low number here means a referral spent for nothing."
            />
          </CardBody>
        </Card>
      </div>

      {/* -------------------------------------------------------- pipeline -- */}
      {view === 'pipeline' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          {applications.length > 0 ? (
            <Card>
              <CardHeader
                title="Funnel"
                subtitle="Stage-to-stage conversion"
                help="Where you lose people is more informative than how many you apply to. A cliff at the recruiter screen is a résumé problem; a cliff at the onsite is a preparation problem."
              />
              <CardBody>
                <div className="col" style={{ gap: 'var(--space-3)' }}>
                  {funnel.map((step, i) => (
                    <div key={step.stage} className="col" style={{ gap: 4 }}>
                      <div className="row row--between">
                        <span className="row text-xs" style={{ gap: 6 }}>
                          <span
                            className="chart-legend__swatch"
                            style={{ background: step.color, width: 8, height: 8, borderRadius: 2 }}
                          />
                          <span className="text-secondary">{step.label}</span>
                        </span>
                        <span className="text-xs tnum">
                          <strong>{step.value}</strong>
                          {i > 0 ? (
                            <span
                              className="text-quaternary"
                              style={{ color: step.conversion < 30 ? 'var(--warning-text)' : undefined }}
                            >
                              {' '}
                              · {Math.round(step.conversion)}% through
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <ProgressBar
                        value={funnel[0].value > 0 ? (step.value / funnel[0].value) * 100 : 0}
                        size="sm"
                        tone={step.stage === 'offer' ? 'success' : undefined}
                      />
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}

          <div className="row row--wrap" style={{ gap: 4 }}>
            <button type="button" onClick={() => setTierFilter('all')} style={{ display: 'inline-flex' }}>
              <Badge tone={tierFilter === 'all' ? 'accent' : 'neutral'} size="lg">
                All tiers · {applications.length}
              </Badge>
            </button>
            {([1, 2, 3] as const).map((tier) => (
              <button key={tier} type="button" onClick={() => setTierFilter(tier)} style={{ display: 'inline-flex' }}>
                <Badge tone={tierFilter === tier ? 'accent' : 'neutral'} size="lg">
                  Tier {tier} · {applications.filter((a) => a.companyTier === tier).length}
                </Badge>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon="💼"
                title={applications.length === 0 ? 'No applications yet' : 'None match the filters'}
                body={
                  applications.length === 0
                    ? 'By design until month 12. Research targets and score fit in the meantime.'
                    : 'Adjust the tier filter or search.'
                }
                action={
                  <Button variant="secondary" size="sm" onClick={() => setView('targets')}>
                    Browse target companies
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card>
              <CardBody className="card__body--none">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Role</th>
                        <th className="num">Tier</th>
                        <th>Location</th>
                        <th>Stage</th>
                        <th>Referral</th>
                        <th>Applied</th>
                        <th className="num">Rounds</th>
                        <th>Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((app) => (
                        <tr key={app.id} id={app.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(app.id)}>
                          <td className="strong">{app.company}</td>
                          <td>{app.role}</td>
                          <td className="num">
                            <Badge tone={app.companyTier === 1 ? 'danger' : app.companyTier === 2 ? 'accent' : 'neutral'}>
                              T{app.companyTier}
                            </Badge>
                          </td>
                          <td className="text-xs">
                            {app.country}
                            {app.remote !== 'onsite' ? ` · ${app.remote}` : ''}
                          </td>
                          <td>
                            <Badge tone={STAGE_TONE[app.stage]} dot>
                              {STAGE_LABEL[app.stage]}
                            </Badge>
                          </td>
                          <td>
                            {app.hasReferral ? (
                              <Tooltip content={app.recruiterName ? `Via ${app.recruiterName}` : 'Referral secured'}>
                                <Badge tone="success">yes</Badge>
                              </Tooltip>
                            ) : (
                              <Badge tone="neutral">no</Badge>
                            )}
                          </td>
                          <td className="text-xs">
                            {app.appliedDate ? formatRelative(app.appliedDate, derived.today) : '—'}
                          </td>
                          <td className="num">{app.rounds.length}</td>
                          <td className="text-xs">{app.salaryRange ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
              <CardFooter>
                <span>{filtered.length} applications</span>
                <span>
                  {stats.referrals} with referrals · {Math.round(stats.referralRate)}% rate
                </span>
              </CardFooter>
            </Card>
          )}
        </div>
      ) : null}

      {/* --------------------------------------------------------- targets -- */}
      {view === 'targets' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          {byTier.map(({ tier, companies, applications: applied }) => (
            <Card key={tier}>
              <CardHeader
                title={`Tier ${tier} — ${tier === 1 ? 'Dream' : tier === 2 ? 'Highly realistic' : 'Stepping stone'}`}
                subtitle={TIER_NOTE[tier]}
                actions={
                  <span className="text-xs text-quaternary tnum">
                    {companies.length} companies · {applied} applications
                  </span>
                }
              />
              <CardBody className="card__body--none">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Why it fits, or does not</th>
                        <th className="num">
                          Fit
                          <HelpDot>
                            Your own assessment of how well your profile maps onto this company, 0–100.
                            Prioritise the highest-fit companies within each tier — that is where a referral
                            converts.
                          </HelpDot>
                        </th>
                        <th style={{ width: 110 }} />
                        <th>Watching</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {[...companies]
                        .sort((a, b) => b.fit - a.fit)
                        .map((company) => (
                          <tr key={company.id}>
                            <td className="strong">{company.name}</td>
                            <td style={{ maxWidth: 520 }} className="text-xs">
                              {company.note}
                            </td>
                            <td className="num">
                              <InlineEdit
                                value={company.fit}
                                numeric
                                onCommit={(next) =>
                                  updateCompany(
                                    company.id,
                                    (c) => ({ ...c, fit: Math.max(0, Math.min(100, Number(next) || 0)) }),
                                    'edit fit score',
                                  )
                                }
                                ariaLabel="Fit score"
                              />
                            </td>
                            <td>
                              <ProgressBar
                                value={company.fit}
                                size="sm"
                                tone={company.fit >= 80 ? 'success' : company.fit >= 60 ? undefined : 'warning'}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={company.watching}
                                onChange={(e) =>
                                  updateCompany(company.id, (c) => ({ ...c, watching: e.target.checked }), 'toggle watching')
                                }
                                aria-label={`Watch ${company.name}`}
                              />
                            </td>
                            <td>
                              <Button variant="ghost" size="sm" onClick={() => addApplication(company)}>
                                Apply
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      {/* ---------------------------------------------------- compensation -- */}
      {view === 'compensation' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <Card>
            <CardHeader
              title="Compensation progression"
              subtitle="Part 9 of the audit — illustrative"
              help="Actual compensation varies significantly by company, level, equity, location and market conditions. Treat this as context for target-setting, not a forecast."
            />
            <CardBody className="card__body--none">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Region</th>
                      <th className="num">Today (typical)</th>
                      <th className="num">5-year target</th>
                      <th style={{ minWidth: 240 }}>Range</th>
                      <th className="num">Uplift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compensation.map((row) => {
                      const maxAll = Math.max(...compensation.map((r) => r.targetHigh))
                      const uplift = Math.round(
                        ((row.targetLow + row.targetHigh) / (row.todayLow + row.todayHigh) - 1) * 100,
                      )
                      return (
                        <tr key={row.region}>
                          <td className="strong">{row.region}</td>
                          <td className="num">
                            {formatMoney(row.todayLow)}–{formatMoney(row.todayHigh)}
                          </td>
                          <td className="num">
                            {formatMoney(row.targetLow)}–{formatMoney(row.targetHigh)}
                          </td>
                          <td>
                            <div style={{ position: 'relative', height: 10, background: 'var(--track)', borderRadius: 999 }}>
                              <Tooltip content={`Today: ${formatMoney(row.todayLow)}–${formatMoney(row.todayHigh)}`}>
                                <span
                                  style={{
                                    position: 'absolute',
                                    left: `${(row.todayLow / maxAll) * 100}%`,
                                    width: `${((row.todayHigh - row.todayLow) / maxAll) * 100}%`,
                                    top: 0,
                                    bottom: 0,
                                    background: 'var(--text-quaternary)',
                                    borderRadius: 999,
                                  }}
                                />
                              </Tooltip>
                              <Tooltip content={`Target: ${formatMoney(row.targetLow)}–${formatMoney(row.targetHigh)}`}>
                                <span
                                  style={{
                                    position: 'absolute',
                                    left: `${(row.targetLow / maxAll) * 100}%`,
                                    width: `${((row.targetHigh - row.targetLow) / maxAll) * 100}%`,
                                    top: 0,
                                    bottom: 0,
                                    background: 'var(--accent)',
                                    borderRadius: 999,
                                    opacity: 0.9,
                                  }}
                                />
                              </Tooltip>
                            </div>
                          </td>
                          <td className="num">
                            <span style={{ color: 'var(--success-text)' }}>+{uplift}%</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
            <CardFooter>
              <div className="chart-legend">
                <span className="chart-legend__item">
                  <span className="chart-legend__swatch" style={{ background: 'var(--text-quaternary)' }} />
                  Today
                </span>
                <span className="chart-legend__item">
                  <span className="chart-legend__swatch" style={{ background: 'var(--accent)' }} />
                  5-year target
                </span>
              </div>
              <span>Assumes strong execution, international mobility and successful role transitions</span>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Target-range midpoints" help="Ranked by the midpoint of the five-year target range. Useful for deciding which markets are worth the relocation or remote-hiring friction." />
            <CardBody>
              <BarChart
                data={[...compensation]
                  .sort((a, b) => (b.targetLow + b.targetHigh) / 2 - (a.targetLow + a.targetHigh) / 2)
                  .map((row, i) => ({
                    label: row.region,
                    value: (row.targetLow + row.targetHigh) / 2,
                    sublabel: `${formatMoney(row.targetLow)}–${formatMoney(row.targetHigh)}`,
                    color: seriesColor(i),
                  }))}
                horizontal
                formatValue={(v) => formatMoney(v)}
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* -------------------------------------------------- application drawer */}
      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={720}
          title={
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <InlineEdit
                value={open.company}
                onCommit={(next) => updateApplication(open.id, (a) => ({ ...a, company: next }), 'rename company')}
                ariaLabel="Company"
              />
            </span>
          }
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              <InlineEdit
                value={open.role}
                onCommit={(next) => updateApplication(open.id, (a) => ({ ...a, role: next }), 'edit role')}
                ariaLabel="Role"
              />
              <Badge tone={STAGE_TONE[open.stage]}>{STAGE_LABEL[open.stage]}</Badge>
              <Badge tone={open.companyTier === 1 ? 'danger' : open.companyTier === 2 ? 'accent' : 'neutral'}>
                Tier {open.companyTier}
              </Badge>
              {open.hasReferral ? <Badge tone="success">referral</Badge> : null}
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  update(
                    (draft) => ({
                      ...draft,
                      applications: {
                        ...draft.applications,
                        applications: draft.applications.applications.filter((a) => a.id !== open.id),
                      },
                    }),
                    ['applications'],
                    'delete application',
                  )
                  setOpenId(null)
                }}
                label="Delete application"
                size="md"
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {open.jobUrl ? (
                  <a href={open.jobUrl} target="_blank" rel="noreferrer noopener" className="btn btn--secondary btn--sm">
                    <Icon name="external" size={13} /> Job post
                  </a>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>
            </>
          }
        >
          {/* Stage advance */}
          <Card variant="inset">
            <CardBody className="card__body--tight">
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                <span className="section-title">Stage</span>
                <div className="row row--wrap" style={{ gap: 4 }}>
                  {FUNNEL.map((stage) => (
                    <Button
                      key={stage}
                      variant={open.stage === stage ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() =>
                        updateApplication(
                          open.id,
                          (a) => ({
                            ...a,
                            stage,
                            appliedDate: stage !== 'researching' ? (a.appliedDate ?? derived.today) : a.appliedDate,
                            outcome: stage === 'offer' ? 'offer' : 'pending',
                          }),
                          'change stage',
                        )
                      }
                    >
                      {STAGE_LABEL[stage]}
                    </Button>
                  ))}
                </div>
                <div className="row row--wrap" style={{ gap: 4 }}>
                  {TERMINAL.map((stage) => (
                    <Button
                      key={stage}
                      variant={open.stage === stage ? 'danger' : 'ghost'}
                      size="sm"
                      onClick={() =>
                        updateApplication(
                          open.id,
                          (a) => ({
                            ...a,
                            stage,
                            outcome: stage === 'withdrawn' ? 'withdrawn' : 'rejected',
                          }),
                          'close application',
                        )
                      }
                    >
                      {STAGE_LABEL[stage]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Company tier</span>
              <Select
                value={String(open.companyTier)}
                size="sm"
                options={[
                  { value: '1', label: 'Tier 1 — dream' },
                  { value: '2', label: 'Tier 2 — highly realistic' },
                  { value: '3', label: 'Tier 3 — stepping stone' },
                ]}
                onChange={(next) =>
                  updateApplication(open.id, (a) => ({ ...a, companyTier: Number(next) as 1 | 2 | 3 }), 'change tier')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Country</span>
              <Input
                value={open.country}
                size="sm"
                onChange={(next) => updateApplication(open.id, (a) => ({ ...a, country: next }), 'edit country')}
              />
            </div>
            <div className="field">
              <span className="field__label">Work model</span>
              <Select
                value={open.remote}
                size="sm"
                options={[
                  { value: 'remote', label: 'Remote' },
                  { value: 'hybrid', label: 'Hybrid' },
                  { value: 'onsite', label: 'Onsite' },
                ]}
                onChange={(next) => updateApplication(open.id, (a) => ({ ...a, remote: next }), 'edit work model')}
              />
            </div>
            <div className="field">
              <span className="field__label">Salary range</span>
              <Input
                value={open.salaryRange ?? ''}
                size="sm"
                placeholder="$140k–$180k"
                onChange={(next) =>
                  updateApplication(open.id, (a) => ({ ...a, salaryRange: next || undefined }), 'edit salary')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Applied date</span>
              <input
                className="input input--sm"
                type="date"
                value={open.appliedDate ?? ''}
                onChange={(e) =>
                  updateApplication(open.id, (a) => ({ ...a, appliedDate: e.target.value || undefined }), 'edit applied date')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">
                Referral
                <HelpDot>
                  Referral-backed applications convert far better than cold ones. If this is off, ask whether
                  the application is worth submitting yet.
                </HelpDot>
              </span>
              <div className="row" style={{ height: 26, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={open.hasReferral}
                  onChange={(e) =>
                    updateApplication(open.id, (a) => ({ ...a, hasReferral: e.target.checked }), 'toggle referral')
                  }
                  aria-label="Has referral"
                />
              </div>
            </div>
            <div className="field">
              <span className="field__label">Referred by</span>
              <Select
                value={open.referrerContactId ?? ''}
                size="sm"
                options={[
                  { value: '', label: 'Not linked' },
                  ...data.networking.contacts.map((c) => ({ value: c.id, label: `${c.name} — ${c.company}` })),
                ]}
                onChange={(next) =>
                  updateApplication(
                    open.id,
                    (a) => ({ ...a, referrerContactId: next || undefined, hasReferral: next ? true : a.hasReferral }),
                    'link referrer',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Recruiter</span>
              <Input
                value={open.recruiterName ?? ''}
                size="sm"
                onChange={(next) =>
                  updateApplication(open.id, (a) => ({ ...a, recruiterName: next || undefined }), 'edit recruiter')
                }
              />
            </div>
          </div>

          <div className="field">
            <span className="field__label">Job post URL</span>
            <Input
              value={open.jobUrl ?? ''}
              size="sm"
              placeholder="https://…"
              onChange={(next) => updateApplication(open.id, (a) => ({ ...a, jobUrl: next || undefined }), 'edit job url')}
            />
          </div>

          <hr className="divider" />

          {/* Rounds */}
          <div className="col" style={{ gap: 'var(--space-3)' }}>
            <div className="row row--between">
              <span className="section-title">
                Interview rounds
                <HelpDot>
                  Debrief within 24 hours of every round. Write down every question asked — the patterns
                  across companies are what tell you what to fix.
                </HelpDot>
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="plus" size={12} />}
                onClick={() =>
                  updateApplication(
                    open.id,
                    (a) => ({
                      ...a,
                      rounds: [
                        ...a.rounds,
                        {
                          id: newId('rd'),
                          date: derived.today,
                          kind: 'Recruiter screen',
                          interviewer: '',
                          notes: '',
                          outcome: 'pending',
                        },
                      ],
                    }),
                    'add round',
                  )
                }
              >
                Add round
              </Button>
            </div>

            {open.rounds.length === 0 ? (
              <span className="text-xs text-quaternary">No rounds logged yet.</span>
            ) : (
              open.rounds.map((round) => (
                <div
                  key={round.id}
                  className="col"
                  style={{
                    gap: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    background: 'var(--bg-inset)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
                    <input
                      className="input input--sm"
                      type="date"
                      style={{ maxWidth: 140 }}
                      value={round.date}
                      onChange={(e) =>
                        updateApplication(
                          open.id,
                          (a) => ({
                            ...a,
                            rounds: a.rounds.map((r) => (r.id === round.id ? { ...r, date: e.target.value } : r)),
                          }),
                          'edit round date',
                        )
                      }
                    />
                    <Input
                      value={round.kind}
                      size="sm"
                      placeholder="Round type"
                      onChange={(next) =>
                        updateApplication(
                          open.id,
                          (a) => ({
                            ...a,
                            rounds: a.rounds.map((r) => (r.id === round.id ? { ...r, kind: next } : r)),
                          }),
                          'edit round kind',
                        )
                      }
                    />
                    <Input
                      value={round.interviewer}
                      size="sm"
                      placeholder="Interviewer"
                      onChange={(next) =>
                        updateApplication(
                          open.id,
                          (a) => ({
                            ...a,
                            rounds: a.rounds.map((r) => (r.id === round.id ? { ...r, interviewer: next } : r)),
                          }),
                          'edit interviewer',
                        )
                      }
                    />
                    <Select
                      value={round.outcome}
                      size="sm"
                      className="shrink-0"
                      options={[
                        { value: 'pending', label: 'Pending' },
                        { value: 'pass', label: 'Pass' },
                        { value: 'fail', label: 'Fail' },
                      ]}
                      onChange={(next) =>
                        updateApplication(
                          open.id,
                          (a) => ({
                            ...a,
                            rounds: a.rounds.map((r) => (r.id === round.id ? { ...r, outcome: next } : r)),
                          }),
                          'edit round outcome',
                        )
                      }
                    />
                    <IconButton
                      title="Remove round"
                      tone="danger"
                      onClick={() =>
                        updateApplication(
                          open.id,
                          (a) => ({ ...a, rounds: a.rounds.filter((r) => r.id !== round.id) }),
                          'delete round',
                        )
                      }
                    >
                      <Icon name="x" size={11} />
                    </IconButton>
                  </div>
                  <InlineEdit
                    value={round.notes}
                    multiline
                    placeholder="Every question asked, and how you answered…"
                    onCommit={(next) =>
                      updateApplication(
                        open.id,
                        (a) => ({
                          ...a,
                          rounds: a.rounds.map((r) => (r.id === round.id ? { ...r, notes: next } : r)),
                        }),
                        'edit round notes',
                      )
                    }
                    ariaLabel="Round notes"
                  />
                </div>
              ))
            )}
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">Interview notes</span>
            <InlineEdit
              value={open.interviewNotes}
              multiline
              placeholder="Company research, people met, anything worth remembering…"
              onCommit={(next) => updateApplication(open.id, (a) => ({ ...a, interviewNotes: next }), 'edit notes')}
              ariaLabel="Interview notes"
            />
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">
              Lessons learned
              <HelpDot>
                The audit's review question is "what feedback patterns emerged from interviews?" This field is
                where that answer accumulates.
              </HelpDot>
            </span>
            <InlineEdit
              value={open.lessonsLearned}
              multiline
              placeholder="What would you do differently in the next loop?"
              onCommit={(next) => updateApplication(open.id, (a) => ({ ...a, lessonsLearned: next }), 'edit lessons')}
              ariaLabel="Lessons learned"
            />
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
