/* ============================================================================
   Networking
   ----------------------------------------------------------------------------
   The audit's recommendation is unambiguous: pursue targeted, referral-backed
   applications rather than high-volume submissions. Referrals come from
   relationships, relationships come from a next action that actually happens.
   So this page leads with what is due, not with a contact count.
   ========================================================================= */

import { useMemo, useState } from 'react'

import { BarChart, DonutChart, seriesColor } from '../components/charts'
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
import { addDays, formatDate, formatRelative } from '../lib/dates'
import { useRoute, useScrollToAnchor } from '../lib/router'
import { newId, useStore } from '../lib/store'
import type { Contact, ContactKind, ID, NetworkingEvent, RelationshipStrength } from '../lib/types'

const KIND_LABEL: Record<ContactKind, string> = {
  'pm-leader': 'PM leader',
  recruiter: 'Recruiter',
  peer: 'Peer',
  'hiring-manager': 'Hiring manager',
  mentor: 'Mentor',
  other: 'Other',
}

const STATUS_LABEL: Record<Contact['status'], string> = {
  'to-reach-out': 'To reach out',
  'reached-out': 'Reached out',
  'in-conversation': 'In conversation',
  warm: 'Warm',
  'referral-given': 'Referral given',
  dormant: 'Dormant',
}

const STATUS_TONE = {
  'to-reach-out': 'neutral',
  'reached-out': 'info',
  'in-conversation': 'accent',
  warm: 'success',
  'referral-given': 'success',
  dormant: 'warning',
} as const

const STRENGTH_LABEL = ['', 'Stranger', 'Acquainted', 'Real relationship', 'Would help', 'Would advocate']

const TOUCHPOINT_KINDS = ['message', 'call', 'coffee-chat', 'event', 'comment', 'referral'] as const

type View = 'pipeline' | 'due' | 'events'

export function Networking() {
  const { data, derived, update } = useStore()
  const route = useRoute()

  const [view, setView] = useState<View>('due')
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<ContactKind | 'all'>('all')
  const [openId, setOpenId] = useState<ID | null>(route.anchor ?? null)
  const [openEventId, setOpenEventId] = useState<ID | null>(null)

  useScrollToAnchor(route.anchor)

  const { contacts, events } = data.networking

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts.filter((contact) => {
      if (kindFilter !== 'all' && contact.kind !== kindFilter) return false
      if (!q) return true
      return `${contact.name} ${contact.company} ${contact.role} ${contact.notes} ${contact.nextAction}`
        .toLowerCase()
        .includes(q)
    })
  }, [contacts, kindFilter, query])

  const due = useMemo(
    () =>
      filtered
        .filter((c) => c.nextActionDate && c.nextActionDate <= addDays(derived.today, 7))
        .sort((a, b) => (a.nextActionDate ?? '').localeCompare(b.nextActionDate ?? '')),
    [derived.today, filtered],
  )

  const open = openId ? contacts.find((c) => c.id === openId) : undefined
  const openEvent = openEventId ? events.find((e) => e.id === openEventId) : undefined

  const updateContact = (contactId: ID, producer: (contact: Contact) => Contact, label: string) => {
    update(
      (draft) => ({
        ...draft,
        networking: {
          ...draft.networking,
          contacts: draft.networking.contacts.map((c) => (c.id === contactId ? producer(c) : c)),
        },
      }),
      ['networking'],
      label,
    )
  }

  const updateEvent = (eventId: ID, producer: (event: NetworkingEvent) => NetworkingEvent, label: string) => {
    update(
      (draft) => ({
        ...draft,
        networking: {
          ...draft.networking,
          events: draft.networking.events.map((e) => (e.id === eventId ? producer(e) : e)),
        },
      }),
      ['networking'],
      label,
    )
  }

  /** Logging a touchpoint advances the relationship and reschedules the next action. */
  const logTouchpoint = (contact: Contact, kind: (typeof TOUCHPOINT_KINDS)[number], note: string) => {
    updateContact(
      contact.id,
      (c) => ({
        ...c,
        lastContact: derived.today,
        // A real conversation moves the relationship along; a comment does not.
        status:
          kind === 'referral'
            ? 'referral-given'
            : kind === 'call' || kind === 'coffee-chat'
              ? 'in-conversation'
              : c.status === 'to-reach-out'
                ? 'reached-out'
                : c.status,
        relationshipStrength: (kind === 'call' || kind === 'coffee-chat' || kind === 'referral'
          ? Math.min(5, c.relationshipStrength + 1)
          : c.relationshipStrength) as RelationshipStrength,
        nextActionDate: addDays(derived.today, kind === 'referral' ? 21 : 14),
        touchpoints: [...c.touchpoints, { id: newId('tp'), date: derived.today, kind, note }],
      }),
      'log touchpoint',
    )
  }

  const addContact = () => {
    const contact: Contact = {
      id: newId('ct'),
      name: 'New contact',
      company: '',
      role: '',
      kind: 'pm-leader',
      status: 'to-reach-out',
      relationshipStrength: 1,
      nextAction: 'Find a genuine reason to reach out',
      nextActionDate: addDays(derived.today, 3),
      touchpoints: [],
      couldRefer: false,
      notes: '',
    }
    update(
      (draft) => ({ ...draft, networking: { ...draft.networking, contacts: [contact, ...draft.networking.contacts] } }),
      ['networking'],
      'add contact',
    )
    setOpenId(contact.id)
  }

  const addEvent = () => {
    const event: NetworkingEvent = {
      id: newId('ev'),
      name: 'New event',
      kind: 'conference',
      date: addDays(derived.today, 30),
      location: '',
      status: 'considering',
      goal: '',
      outcomes: '',
      contactsMade: 0,
    }
    update(
      (draft) => ({ ...draft, networking: { ...draft.networking, events: [event, ...draft.networking.events] } }),
      ['networking'],
      'add event',
    )
    setOpenEventId(event.id)
    setView('events')
  }

  /* --------------------------------------------------------------- stats -- */

  const stats = useMemo(() => {
    const strong = contacts.filter((c) => c.relationshipStrength >= 3)
    const couldRefer = contacts.filter((c) => c.couldRefer)
    const overdue = contacts.filter((c) => c.nextActionDate && c.nextActionDate < derived.today)
    const stale = contacts.filter(
      (c) => c.lastContact && c.lastContact < addDays(derived.today, -60) && c.status !== 'dormant',
    )
    const referralsGiven = contacts.filter((c) => c.status === 'referral-given').length
    // The audit's weekly target is 5 real conversations.
    const weekStart = addDays(derived.today, -7)
    const conversationsThisWeek = contacts.reduce(
      (sum, c) =>
        sum + c.touchpoints.filter((t) => t.date >= weekStart && (t.kind === 'call' || t.kind === 'coffee-chat')).length,
      0,
    )
    return {
      total: contacts.length,
      strong: strong.length,
      couldRefer: couldRefer.length,
      overdue: overdue.length,
      stale: stale.length,
      referralsGiven,
      conversationsThisWeek,
      tier1: contacts.filter((c) => c.targetCompanyTier === 1).length,
      tier2: contacts.filter((c) => c.targetCompanyTier === 2).length,
    }
  }, [contacts, derived.today])

  const byStatus = useMemo(() => {
    const order: Contact['status'][] = [
      'to-reach-out',
      'reached-out',
      'in-conversation',
      'warm',
      'referral-given',
      'dormant',
    ]
    return order.map((status, i) => ({
      status,
      label: STATUS_LABEL[status],
      value: contacts.filter((c) => c.status === status).length,
      color: seriesColor(i),
    }))
  }, [contacts])

  const byStrength = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((strength) => ({
        label: `${strength} — ${STRENGTH_LABEL[strength]}`,
        value: contacts.filter((c) => c.relationshipStrength === strength).length,
        color: strength >= 4 ? 'var(--success)' : strength === 3 ? 'var(--accent)' : 'var(--text-quaternary)',
      })),
    [contacts],
  )

  return (
    <div className="page">
      <PageHeader
        title="Networking"
        lede="Relationships, not connections. The audit's recommendation is targeted, referral-backed applications over high-volume submissions — and five referrals from target companies is an explicit success metric. What matters here is whether the next action actually happens."
        actions={
          <>
            <Input value={query} onChange={setQuery} placeholder="Search contacts…" size="sm" />
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'due', label: 'Due', count: due.length },
                { value: 'pipeline', label: 'Pipeline', count: contacts.length },
                { value: 'events', label: 'Events', count: events.length },
              ]}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Icon name="plus" size={13} />}
              onClick={view === 'events' ? addEvent : addContact}
            >
              {view === 'events' ? 'Add event' : 'Add contact'}
            </Button>
          </>
        }
      />

      <div className="grid grid--auto-sm">
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Actions overdue"
              value={stats.overdue}
              size="lg"
              tone={stats.overdue > 0 ? 'danger' : 'success'}
              meta={`${due.length} due within 7 days`}
              help="The single number that predicts whether this page is working. A network with no overdue actions is a network being worked."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Real relationships"
              value={`${stats.strong} / 60`}
              size="lg"
              tone={stats.strong >= 60 ? 'success' : undefined}
              meta={`${stats.total} contacts total`}
              help="Strength 3 or above — people who would actually reply. Sixty is what the Presence pillar treats as full marks."
            />
            <div style={{ marginTop: 'var(--space-2)' }}>
              <ProgressBar value={(stats.strong / 60) * 100} size="xs" tone={stats.strong >= 60 ? 'success' : undefined} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Could refer you"
              value={stats.couldRefer}
              size="lg"
              tone={stats.couldRefer >= 5 ? 'success' : 'warning'}
              meta={`${stats.referralsGiven} referral${stats.referralsGiven === 1 ? '' : 's'} given`}
              help="Five referrals from target companies is one of the audit's stated success metrics. Referrals are finite — spend them once you are interview-ready."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Conversations this week"
              value={`${stats.conversationsThisWeek} / 5`}
              size="lg"
              tone={stats.conversationsThisWeek >= 5 ? 'success' : 'warning'}
              help="The audit's weekly KPI is five networking conversations. Conversations, not connection requests — the difference is everything."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="At Tier 1 / Tier 2"
              value={`${stats.tier1} / ${stats.tier2}`}
              size="lg"
              help="Contacts inside the audit's target companies. A relationship at a Tier 2 company you can reach is worth more than three at a Tier 1 you cannot."
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="card__body--tight">
            <Stat
              label="Going cold"
              value={stats.stale}
              size="lg"
              tone={stats.stale > 0 ? 'warning' : 'success'}
              meta="No contact in 60+ days"
              help="Relationships decay silently. A short message every couple of months costs nothing and keeps the door open."
            />
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------------------- due -- */}
      {view === 'due' ? (
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          {due.length === 0 ? (
            <Card>
              <EmptyState
                icon="✓"
                title="Nothing due"
                body="No next actions within the next seven days. Either the network is quiet or the next actions need setting."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setView('pipeline')}>
                    View full pipeline
                  </Button>
                }
              />
            </Card>
          ) : (
            due.map((contact) => {
              const overdue = contact.nextActionDate! < derived.today
              return (
                <Card key={contact.id} id={contact.id} variant={overdue ? 'accent' : 'default'}>
                  <CardBody className="card__body--tight">
                    <div className="row row--wrap" style={{ gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                      <div className="col grow" style={{ gap: 4, minWidth: 200 }}>
                        <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
                          <span className="text-sm" style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                            {contact.name}
                          </span>
                          <Badge tone={STATUS_TONE[contact.status]} dot>
                            {STATUS_LABEL[contact.status]}
                          </Badge>
                          {contact.targetCompanyTier ? (
                            <Badge tone={contact.targetCompanyTier === 1 ? 'danger' : 'accent'}>
                              T{contact.targetCompanyTier}
                            </Badge>
                          ) : null}
                          {contact.couldRefer ? <Badge tone="success">could refer</Badge> : null}
                        </div>
                        <span className="text-xs text-tertiary">
                          {contact.role}
                          {contact.company ? ` · ${contact.company}` : ''} · {KIND_LABEL[contact.kind]}
                        </span>
                        <span className="text-sm text-secondary">
                          <strong className="text-quaternary text-2xs">NEXT: </strong>
                          {contact.nextAction}
                        </span>
                      </div>

                      <div className="col shrink-0" style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                        <Badge tone={overdue ? 'danger' : 'warning'} size="lg">
                          {formatRelative(contact.nextActionDate, derived.today)}
                        </Badge>
                        <div className="row" style={{ gap: 4 }}>
                          <Tooltip content="Log a message and push the next action out two weeks">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => logTouchpoint(contact, 'message', 'Sent a message')}
                            >
                              Messaged
                            </Button>
                          </Tooltip>
                          <Tooltip content="Log a real conversation — this also raises relationship strength">
                            <Button
                              variant="subtle"
                              size="sm"
                              onClick={() => logTouchpoint(contact, 'call', 'Had a conversation')}
                            >
                              Talked
                            </Button>
                          </Tooltip>
                          <Button variant="secondary" size="sm" onClick={() => setOpenId(contact.id)}>
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )
            })
          )}
        </div>
      ) : null}

      {/* -------------------------------------------------------- pipeline -- */}
      {view === 'pipeline' ? (
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="grid grid--auto-lg">
            <Card>
              <CardHeader title="Pipeline by status" help="A healthy network has movement from left to right. A pile-up at 'reached out' means the follow-up is not happening." />
              <CardBody>
                <div className="row" style={{ gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <DonutChart
                    data={byStatus.filter((s) => s.value > 0)}
                    size={130}
                    thickness={19}
                    centerValue={contacts.length}
                    centerLabel="contacts"
                  />
                  <div className="col grow" style={{ gap: 5, minWidth: 150 }}>
                    {byStatus.map((row) => (
                      <div key={row.status} className="row row--between">
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

            <Card>
              <CardHeader
                title="Relationship strength"
                help="1 stranger, 3 real relationship, 5 would advocate for you unprompted. Only 3 and above count toward the Presence pillar."
              />
              <CardBody>
                <BarChart data={byStrength} horizontal formatValue={(v) => `${v}`} />
              </CardBody>
            </Card>
          </div>

          <div className="row row--wrap" style={{ gap: 4 }}>
            <button type="button" onClick={() => setKindFilter('all')} style={{ display: 'inline-flex' }}>
              <Badge tone={kindFilter === 'all' ? 'accent' : 'neutral'} size="lg">
                All · {contacts.length}
              </Badge>
            </button>
            {(Object.keys(KIND_LABEL) as ContactKind[]).map((kind) => {
              const count = contacts.filter((c) => c.kind === kind).length
              if (count === 0) return null
              return (
                <button key={kind} type="button" onClick={() => setKindFilter(kind)} style={{ display: 'inline-flex' }}>
                  <Badge tone={kindFilter === kind ? 'accent' : 'neutral'} size="lg">
                    {KIND_LABEL[kind]} · {count}
                  </Badge>
                </button>
              )
            })}
          </div>

          <Card>
            <CardBody className="card__body--none">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Kind</th>
                      <th>Status</th>
                      <th className="num">Strength</th>
                      <th>Last contact</th>
                      <th>Next action</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered
                      .slice()
                      .sort(
                        (a, b) =>
                          b.relationshipStrength - a.relationshipStrength ||
                          (a.nextActionDate ?? '9999').localeCompare(b.nextActionDate ?? '9999'),
                      )
                      .map((contact) => {
                        const overdue = contact.nextActionDate && contact.nextActionDate < derived.today
                        return (
                          <tr key={contact.id} id={contact.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(contact.id)}>
                            <td className="strong">
                              <div className="row" style={{ gap: 5 }}>
                                {contact.name}
                                {contact.couldRefer ? (
                                  <Tooltip content="Could refer you">
                                    <span className="text-2xs">🎫</span>
                                  </Tooltip>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <div className="row" style={{ gap: 5 }}>
                                {contact.company}
                                {contact.targetCompanyTier ? (
                                  <Badge tone={contact.targetCompanyTier === 1 ? 'danger' : 'accent'}>
                                    T{contact.targetCompanyTier}
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="text-xs">{contact.role}</td>
                            <td className="text-xs">{KIND_LABEL[contact.kind]}</td>
                            <td>
                              <Badge tone={STATUS_TONE[contact.status]} dot>
                                {STATUS_LABEL[contact.status]}
                              </Badge>
                            </td>
                            <td className="num">
                              <Tooltip content={STRENGTH_LABEL[contact.relationshipStrength]}>
                                <span className="text-2xs">
                                  {'●'.repeat(contact.relationshipStrength)}
                                  <span style={{ opacity: 0.25 }}>{'●'.repeat(5 - contact.relationshipStrength)}</span>
                                </span>
                              </Tooltip>
                            </td>
                            <td className="text-xs">{contact.lastContact ? formatRelative(contact.lastContact, derived.today) : 'never'}</td>
                            <td style={{ maxWidth: 280 }} className="text-xs">
                              {contact.nextAction}
                            </td>
                            <td className="text-xs" style={{ color: overdue ? 'var(--danger-text)' : undefined }}>
                              {contact.nextActionDate ? formatRelative(contact.nextActionDate, derived.today) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </CardBody>
            <CardFooter>
              <span>{filtered.length} contacts</span>
              <span>{stats.strong} at strength 3+</span>
            </CardFooter>
          </Card>
        </div>
      ) : null}

      {/* ---------------------------------------------------------- events -- */}
      {view === 'events' ? (
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          {events.length === 0 ? (
            <Card>
              <EmptyState
                icon="🎪"
                title="No events tracked"
                body="Speaking at a small meetup builds more brand than attending a large conference."
                action={
                  <Button variant="primary" size="sm" onClick={addEvent}>
                    Add event
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid--auto">
              {[...events]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((event) => (
                  <Card key={event.id} onClick={() => setOpenEventId(event.id)}>
                    <CardBody>
                      <div className="col" style={{ gap: 'var(--space-3)' }}>
                        <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                          <div className="col" style={{ gap: 2, minWidth: 0 }}>
                            <span
                              className="text-sm clamp-2"
                              style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}
                            >
                              {event.name}
                            </span>
                            <span className="text-2xs text-quaternary">
                              {event.kind} · {event.location}
                            </span>
                          </div>
                          <Badge
                            tone={
                              event.status === 'attended'
                                ? 'success'
                                : event.status === 'registered'
                                  ? 'accent'
                                  : event.status === 'skipped'
                                    ? 'neutral'
                                    : 'warning'
                            }
                          >
                            {event.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-tertiary">{formatDate(event.date, { year: true })}</span>
                        <p className="text-2xs text-secondary clamp-3" style={{ lineHeight: 'var(--leading-snug)', minHeight: 40 }}>
                          <strong className="text-quaternary">Goal: </strong>
                          {event.goal || 'No goal set. An event without a goal is a day spent.'}
                        </p>
                        {event.contactsMade > 0 ? (
                          <Badge tone="success">{event.contactsMade} contacts made</Badge>
                        ) : null}
                      </div>
                    </CardBody>
                  </Card>
                ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ---------------------------------------------------- contact drawer */}
      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          width={700}
          title={
            <InlineEdit
              value={open.name}
              onCommit={(next) => updateContact(open.id, (c) => ({ ...c, name: next }), 'rename contact')}
              ariaLabel="Contact name"
            />
          }
          subtitle={
            <span className="row row--wrap" style={{ gap: 6 }}>
              <Badge tone={STATUS_TONE[open.status]}>{STATUS_LABEL[open.status]}</Badge>
              <Badge tone="neutral">{KIND_LABEL[open.kind]}</Badge>
              <span>
                strength {open.relationshipStrength}/5 — {STRENGTH_LABEL[open.relationshipStrength]}
              </span>
            </span>
          }
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  update(
                    (draft) => ({
                      ...draft,
                      networking: {
                        ...draft.networking,
                        contacts: draft.networking.contacts.filter((c) => c.id !== open.id),
                      },
                    }),
                    ['networking'],
                    'delete contact',
                  )
                  setOpenId(null)
                }}
                label="Delete contact"
                size="md"
              />
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {open.linkedinUrl ? (
                  <a href={open.linkedinUrl} target="_blank" rel="noreferrer noopener" className="btn btn--secondary btn--sm">
                    <Icon name="external" size={13} /> LinkedIn
                  </a>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </div>
            </>
          }
        >
          {/* Log a touchpoint */}
          <Card variant="inset">
            <CardBody className="card__body--tight">
              <div className="col" style={{ gap: 'var(--space-3)' }}>
                <span className="section-title">
                  Log a touchpoint
                  <HelpDot>
                    A call or coffee chat raises relationship strength; a message or comment does not.
                    Logging any touchpoint reschedules the next action automatically.
                  </HelpDot>
                </span>
                <div className="row row--wrap" style={{ gap: 4 }}>
                  {TOUCHPOINT_KINDS.map((kind) => (
                    <Button
                      key={kind}
                      variant={kind === 'call' || kind === 'coffee-chat' ? 'subtle' : 'secondary'}
                      size="sm"
                      onClick={() => logTouchpoint(open, kind, `Logged a ${kind.replace('-', ' ')}`)}
                    >
                      {kind.replace('-', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Company</span>
              <Input
                value={open.company}
                size="sm"
                onChange={(next) => updateContact(open.id, (c) => ({ ...c, company: next }), 'edit company')}
              />
            </div>
            <div className="field">
              <span className="field__label">Role</span>
              <Input
                value={open.role}
                size="sm"
                onChange={(next) => updateContact(open.id, (c) => ({ ...c, role: next }), 'edit role')}
              />
            </div>
            <div className="field">
              <span className="field__label">Kind</span>
              <Select
                value={open.kind}
                size="sm"
                options={(Object.keys(KIND_LABEL) as ContactKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                onChange={(next) => updateContact(open.id, (c) => ({ ...c, kind: next }), 'change kind')}
              />
            </div>
            <div className="field">
              <span className="field__label">Status</span>
              <Select
                value={open.status}
                size="sm"
                options={(Object.keys(STATUS_LABEL) as Contact['status'][]).map((s) => ({
                  value: s,
                  label: STATUS_LABEL[s],
                }))}
                onChange={(next) => updateContact(open.id, (c) => ({ ...c, status: next }), 'change status')}
              />
            </div>
            <div className="field">
              <span className="field__label">
                Relationship strength
                <HelpDot>
                  1 stranger · 2 acquainted · 3 real relationship · 4 would help if asked · 5 would advocate
                  unprompted. Only 3+ counts toward readiness.
                </HelpDot>
              </span>
              <Select
                value={String(open.relationshipStrength)}
                size="sm"
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${STRENGTH_LABEL[n]}` }))}
                onChange={(next) =>
                  updateContact(
                    open.id,
                    (c) => ({ ...c, relationshipStrength: Number(next) as RelationshipStrength }),
                    'change strength',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Target company tier</span>
              <Select
                value={String(open.targetCompanyTier ?? 0)}
                size="sm"
                options={[
                  { value: '0', label: 'Not a target' },
                  { value: '1', label: 'Tier 1 — dream' },
                  { value: '2', label: 'Tier 2 — highly realistic' },
                  { value: '3', label: 'Tier 3 — stepping stone' },
                ]}
                onChange={(next) =>
                  updateContact(
                    open.id,
                    (c) => ({
                      ...c,
                      targetCompanyTier: Number(next) === 0 ? undefined : (Number(next) as 1 | 2 | 3),
                    }),
                    'change tier',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Last contact</span>
              <input
                className="input input--sm"
                type="date"
                value={open.lastContact ?? ''}
                onChange={(e) =>
                  updateContact(open.id, (c) => ({ ...c, lastContact: e.target.value || undefined }), 'edit last contact')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Next action date</span>
              <input
                className="input input--sm"
                type="date"
                value={open.nextActionDate ?? ''}
                onChange={(e) =>
                  updateContact(
                    open.id,
                    (c) => ({ ...c, nextActionDate: e.target.value || undefined }),
                    'edit next action date',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Could refer you</span>
              <div className="row" style={{ height: 26, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={open.couldRefer}
                  onChange={(e) => updateContact(open.id, (c) => ({ ...c, couldRefer: e.target.checked }), 'toggle refer')}
                  aria-label="Could refer you"
                />
              </div>
            </div>
          </div>

          <div className="field">
            <span className="field__label">LinkedIn URL</span>
            <Input
              value={open.linkedinUrl ?? ''}
              size="sm"
              placeholder="https://linkedin.com/in/…"
              onChange={(next) => updateContact(open.id, (c) => ({ ...c, linkedinUrl: next || undefined }), 'edit linkedin')}
            />
          </div>

          <div className="field">
            <span className="field__label">Email</span>
            <Input
              value={open.email ?? ''}
              size="sm"
              onChange={(next) => updateContact(open.id, (c) => ({ ...c, email: next || undefined }), 'edit email')}
            />
          </div>

          <hr className="divider" />

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">
              Next action
              <HelpDot>
                Write it so specifically that you could do it without thinking. "Follow up" is not a next
                action; "send the analytics case study and ask what she would change" is.
              </HelpDot>
            </span>
            <InlineEdit
              value={open.nextAction}
              multiline
              placeholder="What exactly will you do, and when?"
              onCommit={(next) => updateContact(open.id, (c) => ({ ...c, nextAction: next }), 'edit next action')}
              ariaLabel="Next action"
            />
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">Notes</span>
            <InlineEdit
              value={open.notes}
              multiline
              placeholder="How you met, what they care about, what you could offer them…"
              onCommit={(next) => updateContact(open.id, (c) => ({ ...c, notes: next }), 'edit notes')}
              ariaLabel="Notes"
            />
          </div>

          {/* Touchpoint history */}
          <div className="col" style={{ gap: 'var(--space-2)' }}>
            <span className="section-title">History ({open.touchpoints.length})</span>
            {open.touchpoints.length === 0 ? (
              <span className="text-xs text-quaternary">No touchpoints logged yet.</span>
            ) : (
              [...open.touchpoints]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((touchpoint) => (
                  <div
                    key={touchpoint.id}
                    className="row"
                    style={{
                      gap: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--bg-inset)',
                      borderRadius: 'var(--radius-md)',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Badge tone={touchpoint.kind === 'referral' ? 'success' : 'neutral'}>
                      {touchpoint.kind.replace('-', ' ')}
                    </Badge>
                    <span className="text-xs text-secondary grow">
                      <InlineEdit
                        value={touchpoint.note}
                        onCommit={(next) =>
                          updateContact(
                            open.id,
                            (c) => ({
                              ...c,
                              touchpoints: c.touchpoints.map((t) => (t.id === touchpoint.id ? { ...t, note: next } : t)),
                            }),
                            'edit touchpoint',
                          )
                        }
                        ariaLabel="Touchpoint note"
                      />
                    </span>
                    <span className="text-2xs text-quaternary shrink-0">{formatDate(touchpoint.date)}</span>
                    <IconButton
                      title="Remove"
                      tone="danger"
                      onClick={() =>
                        updateContact(
                          open.id,
                          (c) => ({ ...c, touchpoints: c.touchpoints.filter((t) => t.id !== touchpoint.id) }),
                          'delete touchpoint',
                        )
                      }
                    >
                      <Icon name="x" size={11} />
                    </IconButton>
                  </div>
                ))
            )}
          </div>
        </Drawer>
      ) : null}

      {/* ------------------------------------------------------ event drawer */}
      {openEvent ? (
        <Drawer
          open
          onClose={() => setOpenEventId(null)}
          width={600}
          title={
            <InlineEdit
              value={openEvent.name}
              onCommit={(next) => updateEvent(openEvent.id, (e) => ({ ...e, name: next }), 'rename event')}
              ariaLabel="Event name"
            />
          }
          subtitle={`${openEvent.kind} · ${formatDate(openEvent.date, { year: true })}`}
          footer={
            <>
              <DeleteButton
                onDelete={() => {
                  update(
                    (draft) => ({
                      ...draft,
                      networking: {
                        ...draft.networking,
                        events: draft.networking.events.filter((e) => e.id !== openEvent.id),
                      },
                    }),
                    ['networking'],
                    'delete event',
                  )
                  setOpenEventId(null)
                }}
                label="Delete event"
                size="md"
              />
              <Button variant="secondary" size="sm" onClick={() => setOpenEventId(null)}>
                Close
              </Button>
            </>
          }
        >
          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <span className="field__label">Kind</span>
              <Select
                value={openEvent.kind}
                size="sm"
                options={[
                  { value: 'conference', label: 'Conference' },
                  { value: 'meetup', label: 'Meetup' },
                  { value: 'webinar', label: 'Webinar' },
                  { value: 'ama', label: 'AMA' },
                  { value: 'workshop', label: 'Workshop' },
                ]}
                onChange={(next) => updateEvent(openEvent.id, (e) => ({ ...e, kind: next }), 'change event kind')}
              />
            </div>
            <div className="field">
              <span className="field__label">Status</span>
              <Select
                value={openEvent.status}
                size="sm"
                options={[
                  { value: 'considering', label: 'Considering' },
                  { value: 'registered', label: 'Registered' },
                  { value: 'attended', label: 'Attended' },
                  { value: 'skipped', label: 'Skipped' },
                ]}
                onChange={(next) => updateEvent(openEvent.id, (e) => ({ ...e, status: next }), 'change event status')}
              />
            </div>
            <div className="field">
              <span className="field__label">Date</span>
              <input
                className="input input--sm"
                type="date"
                value={openEvent.date}
                onChange={(e) => updateEvent(openEvent.id, (ev) => ({ ...ev, date: e.target.value }), 'edit event date')}
              />
            </div>
            <div className="field">
              <span className="field__label">Location</span>
              <Input
                value={openEvent.location}
                size="sm"
                onChange={(next) => updateEvent(openEvent.id, (e) => ({ ...e, location: next }), 'edit location')}
              />
            </div>
            <div className="field">
              <span className="field__label">Contacts made</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={0}
                value={openEvent.contactsMade}
                onChange={(e) =>
                  updateEvent(openEvent.id, (ev) => ({ ...ev, contactsMade: Number(e.target.value) || 0 }), 'edit contacts made')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Cost</span>
              <Input
                value={openEvent.cost ?? ''}
                size="sm"
                placeholder="Ticket + travel"
                onChange={(next) => updateEvent(openEvent.id, (e) => ({ ...e, cost: next || undefined }), 'edit cost')}
              />
            </div>
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">
              Goal
              <HelpDot>
                An event without a specific goal is a day spent. "Meet three PMs at Tier 2 companies" is a
                goal; "network" is not.
              </HelpDot>
            </span>
            <InlineEdit
              value={openEvent.goal}
              multiline
              placeholder="What would make attending worth it?"
              onCommit={(next) => updateEvent(openEvent.id, (e) => ({ ...e, goal: next }), 'edit goal')}
              ariaLabel="Goal"
            />
          </div>

          <div className="col" style={{ gap: 5 }}>
            <span className="section-title">Outcomes and notes</span>
            <InlineEdit
              value={openEvent.outcomes}
              multiline
              placeholder="What actually happened, who you met, what to follow up on…"
              onCommit={(next) => updateEvent(openEvent.id, (e) => ({ ...e, outcomes: next }), 'edit outcomes')}
              ariaLabel="Outcomes"
            />
          </div>
        </Drawer>
      ) : null}
    </div>
  )
}
