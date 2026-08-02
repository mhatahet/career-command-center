/* ============================================================================
   App shell: sidebar, topbar, command palette, keyboard shortcuts, celebration
   ========================================================================= */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { formatCompact, formatHours } from '../../lib/dates'
import { NAV, NAV_GROUPS, navFor, type NavItem } from '../../lib/nav'
import { navigate, useRoute } from '../../lib/router'
import { useStore } from '../../lib/store'
import { Badge, Button, Icon, IconButton, ProgressBar, Tooltip } from '../ui'
import './layout.css'

/* ================================================================ sidebar == */

function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data, derived, settings, setSettings, adapter, saving, dirty } = useStore()
  const route = useRoute()
  const collapsed = settings.sidebarCollapsed

  /** Live counts beside the sections where a number is genuinely useful. */
  const counts = useMemo<Record<string, number | undefined>>(() => {
    const openTasks = data.tasks.filter((t) => t.status !== 'done' && t.status !== 'dropped').length
    const dueActions = data.networking.contacts.filter(
      (c) => c.nextActionDate && c.nextActionDate <= derived.today,
    ).length
    const activeApplications = data.applications.applications.filter(
      (a) => !['rejected', 'withdrawn', 'ghosted'].includes(a.stage),
    ).length
    const unpublished = data.portfolio.filter((p) => p.publishStatus !== 'published').length
    const lockedAchievements =
      data.achievements.achievements.length - derived.achievements.unlocked.size

    return {
      dashboard: openTasks || undefined,
      networking: dueActions || undefined,
      applications: activeApplications || undefined,
      portfolio: unpublished || undefined,
      achievements: lockedAchievements ? derived.achievements.unlocked.size : undefined,
      'learning-path': derived.timeline.currentMonth,
    }
  }, [data, derived])

  const hidden = new Set(settings.hiddenSections)
  const visible = NAV.filter((item) => !hidden.has(item.id))

  const statusTone = saving ? 'saving' : adapter.writesToDisk ? 'ok' : 'warn'

  return (
    <aside
      className={`app-sidebar${collapsed ? ' app-sidebar--collapsed' : ''}${open ? ' app-sidebar--open' : ''}`}
    >
      <div className="sidebar__brand">
        <div className="sidebar__logo">CC</div>
        <div className="sidebar__brand-text">
          <span className="sidebar__brand-title">Command Center</span>
          <span className="sidebar__brand-sub">
            Month {derived.timeline.currentMonth} of {derived.timeline.totalMonths}
          </span>
        </div>
      </div>

      <div className="sidebar__level">
        <div className="sidebar__level-row">
          <span className="sidebar__level-badge">
            <span className="sidebar__level-num">{derived.xp.level}</span>
            Level
          </span>
          <span className="sidebar__xp">
            {formatCompact(derived.xp.intoLevel)} / {formatCompact(derived.xp.levelSpan)} XP
          </span>
        </div>
        <Tooltip
          title={`Level ${derived.xp.level}`}
          content={
            <>
              <strong>{derived.xp.total.toLocaleString()} XP</strong> total ·{' '}
              {formatCompact(derived.xp.toNextLevel)} to level {derived.xp.level + 1}.
              <br />
              Earned from completed tasks, published artefacts, finished books and achievements —
              never from opening the app.
            </>
          }
        >
          <div style={{ width: '100%' }}>
            <ProgressBar value={derived.xp.levelPct} size="xs" gradient ariaLabel="Level progress" />
          </div>
        </Tooltip>
      </div>

      <nav className="sidebar__nav">
        {NAV_GROUPS.map((group) => {
          const items = visible.filter((item) => item.group === group.id)
          if (items.length === 0) return null
          return (
            <div key={group.id}>
              {group.label ? <div className="sidebar__group-label">{group.label}</div> : null}
              {items.map((item) => (
                <SidebarLink
                  key={item.id}
                  item={item}
                  active={route.path === item.path}
                  count={counts[item.id]}
                  collapsed={collapsed}
                  onNavigate={onClose}
                />
              ))}
            </div>
          )
        })}
      </nav>

      <div className="sidebar__footer">
        <Tooltip
          title={adapter.label}
          content={
            <>
              {adapter.detail}
              {dirty.size > 0 ? (
                <>
                  <br />
                  <strong>
                    {dirty.size} file{dirty.size === 1 ? '' : 's'} pending
                  </strong>
                </>
              ) : null}
            </>
          }
          placement="right"
        >
          <div className="sidebar__status">
            <span className={`sidebar__status-dot sidebar__status-dot--${statusTone}`} />
            <span className="sidebar__footer-text truncate">
              {saving ? 'Saving…' : dirty.size > 0 ? `${dirty.size} pending` : adapter.label}
            </span>
          </div>
        </Tooltip>

        <div className="row" style={{ gap: 4, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <IconButton
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setSettings((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))}
          >
            <Icon name="sidebar" size={14} />
          </IconButton>
          {!collapsed ? (
            <>
              <IconButton
                title={settings.theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                onClick={() =>
                  setSettings((s) => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }))
                }
              >
                <Icon name={settings.theme === 'light' ? 'moon' : 'sun'} size={14} />
              </IconButton>
              <span className="sidebar__footer-text text-xs" style={{ marginLeft: 'auto', color: 'var(--text-quaternary)' }}>
                {formatHours(derived.hours.total)}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

function SidebarLink({
  item,
  active,
  count,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  count?: number
  collapsed: boolean
  onNavigate: () => void
}) {
  const link = (
    <button
      type="button"
      className={`sidebar__link${active ? ' sidebar__link--active' : ''}`}
      onClick={() => {
        navigate(item.path)
        onNavigate()
      }}
      aria-current={active ? 'page' : undefined}
    >
      <span className="sidebar__icon">{item.icon}</span>
      <span className="sidebar__label">{item.label}</span>
      {count !== undefined ? <span className="sidebar__count">{count}</span> : null}
    </button>
  )

  if (collapsed) {
    return (
      <Tooltip content={item.description} title={item.label} placement="right" delay={80}>
        <div style={{ width: '100%' }}>{link}</div>
      </Tooltip>
    )
  }

  return link
}

/* ================================================================= topbar == */

function Topbar({
  onOpenPalette,
  onOpenMenu,
}: {
  onOpenPalette: () => void
  onOpenMenu: () => void
}) {
  const { derived, dirty, saving, saveNow, undo, canUndo, undoLabel, settings, setSettings } = useStore()
  const route = useRoute()
  const nav = navFor(route.path)

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || ''),
    [],
  )
  const mod = isMac ? '⌘' : 'Ctrl'

  return (
    <header className="app-topbar">
      <IconButton title="Open menu" onClick={onOpenMenu} className="topbar__menu">
        ☰
      </IconButton>

      <div className="topbar__title">
        <span>{nav?.icon}</span>
        <span className="truncate">{nav?.label ?? 'Career Command Center'}</span>
      </div>

      <div className="divider--v" style={{ marginLeft: 4 }} />

      <Tooltip
        title="Learning streak"
        content={
          derived.streak.current > 0
            ? `${derived.streak.current} consecutive days. Longest: ${derived.streak.longest}. ${
                derived.streak.activeToday
                  ? 'Today is logged.'
                  : 'Nothing logged today yet — log an hour to keep it alive.'
              }`
            : 'No active streak. Log any work today to start one.'
        }
      >
        <Badge tone={derived.streak.atRisk ? 'warning' : derived.streak.current > 0 ? 'accent' : 'neutral'}>
          🔥 {derived.streak.current}
        </Badge>
      </Tooltip>

      <Tooltip
        title="Career readiness"
        content={`${derived.readiness.score} / 100 — ${derived.readiness.band.label}. ${derived.readiness.band.detail}`}
      >
        <Badge
          tone={
            derived.readiness.score >= 80
              ? 'success'
              : derived.readiness.score >= 60
                ? 'info'
                : 'warning'
          }
        >
          🧭 {derived.readiness.score}
        </Badge>
      </Tooltip>

      <button type="button" className="topbar__search" onClick={onOpenPalette}>
        <Icon name="search" size={13} />
        <span className="grow" style={{ textAlign: 'left' }}>
          Search or jump to…
        </span>
        <kbd>{mod}K</kbd>
      </button>

      <div className="topbar__actions">
        {canUndo ? (
          <Tooltip content={`Undo ${undoLabel ?? 'last change'} (${mod}Z)`}>
            <IconButton title="Undo" onClick={undo}>
              <Icon name="undo" size={14} />
            </IconButton>
          </Tooltip>
        ) : null}

        {dirty.size > 0 || !settings.autoSave ? (
          <Button
            variant={dirty.size > 0 ? 'primary' : 'ghost'}
            size="sm"
            icon={<Icon name="save" size={13} />}
            onClick={() => void saveNow()}
            disabled={saving || dirty.size === 0}
            title={`Save ${dirty.size} pending file(s)`}
          >
            {saving ? 'Saving…' : `Save ${dirty.size}`}
          </Button>
        ) : null}

        <Tooltip content={settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
          <IconButton
            title="Toggle theme"
            onClick={() => setSettings((s) => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }))}
          >
            <Icon name={settings.theme === 'light' ? 'moon' : 'sun'} size={14} />
          </IconButton>
        </Tooltip>
      </div>
    </header>
  )
}

/* ======================================================= command palette == */

interface Command {
  id: string
  title: string
  subtitle?: string
  icon: string
  group: string
  run: () => void
  keywords?: string
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, derived, setSettings, exportAll, saveNow, settings } = useStore()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = []

    // Sections
    for (const item of NAV) {
      list.push({
        id: `nav-${item.id}`,
        title: item.label,
        subtitle: item.description,
        icon: item.icon,
        group: 'Go to',
        run: () => navigate(item.path),
        keywords: item.id,
      })
    }

    // Actions
    list.push(
      {
        id: 'act-theme',
        title: settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
        icon: settings.theme === 'light' ? '🌙' : '☀️',
        group: 'Actions',
        run: () => setSettings((s) => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' })),
        keywords: 'theme dark light appearance',
      },
      {
        id: 'act-density',
        title: settings.density === 'compact' ? 'Comfortable density' : 'Compact density',
        icon: '↕',
        group: 'Actions',
        run: () =>
          setSettings((s) => ({ ...s, density: s.density === 'compact' ? 'comfortable' : 'compact' })),
        keywords: 'density compact spacing',
      },
      {
        id: 'act-save',
        title: 'Save all pending changes',
        icon: '💾',
        group: 'Actions',
        run: () => void saveNow(),
        keywords: 'save write flush json',
      },
      {
        id: 'act-export',
        title: 'Download a full backup',
        subtitle: 'All eighteen collections as one JSON file',
        icon: '⬇',
        group: 'Actions',
        run: exportAll,
        keywords: 'export backup download json',
      },
    )

    // Jump to the current chapter
    if (derived.timeline.currentChapter) {
      const chapter = derived.timeline.currentChapter
      list.push({
        id: 'jump-chapter',
        title: `Month ${chapter.month}: ${chapter.title}`,
        subtitle: chapter.measurableOutput,
        icon: '🗺',
        group: 'Current sprint',
        run: () => navigate(`/learning-path#${chapter.id}`),
        keywords: 'current chapter month sprint',
      })
    }

    // Top recommendations become one-keystroke jumps.
    for (const rec of derived.recommendations.slice(0, 5)) {
      list.push({
        id: `rec-${rec.id}`,
        title: rec.title,
        subtitle: `+${rec.expectedGain} readiness · ~${rec.estimatedHours}h`,
        icon: '⚡',
        group: 'Recommended next',
        run: () => navigate(rec.route),
        keywords: 'recommendation next suggested',
      })
    }

    // Deep search across the real content.
    for (const skill of data.skills) {
      list.push({
        id: `skill-${skill.id}`,
        title: skill.name,
        subtitle: `${skill.currentScore.toFixed(1)} → ${skill.targetScore.toFixed(1)} · ${skill.tier}`,
        icon: '📚',
        group: 'Skills',
        run: () => navigate(`/skills#${skill.id}`),
        keywords: `skill competency ${skill.tier}`,
      })
    }

    for (const project of data.portfolio) {
      list.push({
        id: `pf-${project.id}`,
        title: project.title,
        subtitle: `Portfolio · ROI #${project.roiRank} · ${project.completion}% complete`,
        icon: '💻',
        group: 'Portfolio',
        run: () => navigate(`/portfolio#${project.id}`),
        keywords: `portfolio project ${project.kind}`,
      })
    }

    for (const chapter of data.roadmap.chapters) {
      list.push({
        id: `ch-${chapter.id}`,
        title: `Month ${chapter.month}: ${chapter.title}`,
        subtitle: chapter.measurableOutput,
        icon: '🗺',
        group: 'Chapters',
        run: () => navigate(`/learning-path#${chapter.id}`),
        keywords: `chapter month roadmap ${chapter.focus}`,
      })
    }

    for (const book of data.books.filter((b) => b.kind === 'book')) {
      list.push({
        id: `bk-${book.id}`,
        title: book.title,
        subtitle: `${book.author} · ${book.status}`,
        icon: '📖',
        group: 'Reading',
        run: () => navigate(`/reading#${book.id}`),
        keywords: `book reading ${book.author}`,
      })
    }

    for (const contact of data.networking.contacts) {
      list.push({
        id: `ct-${contact.id}`,
        title: contact.name,
        subtitle: `${contact.role} at ${contact.company}`,
        icon: '🤝',
        group: 'Contacts',
        run: () => navigate(`/networking#${contact.id}`),
        keywords: `contact person ${contact.company}`,
      })
    }

    return list
  }, [data, derived, exportAll, saveNow, setSettings, settings.density, settings.theme])

  /**
   * Subsequence match, then rank: exact prefix beats word-start beats scattered.
   * Good enough to feel instant and predictable without a search dependency.
   */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // With no query, show the useful defaults rather than everything.
      return commands.filter((c) =>
        ['Current sprint', 'Recommended next', 'Go to', 'Actions'].includes(c.group),
      )
    }

    const scored: { command: Command; score: number }[] = []

    for (const command of commands) {
      const haystack = `${command.title} ${command.subtitle ?? ''} ${command.keywords ?? ''}`.toLowerCase()
      const title = command.title.toLowerCase()

      let score = 0
      if (title === q) score = 1000
      else if (title.startsWith(q)) score = 700
      else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) score = 500
      else if (title.includes(q)) score = 380
      else if (haystack.includes(q)) score = 200
      else {
        // Scattered-subsequence fallback, e.g. "lnpth" → "Learning Path".
        let cursor = 0
        for (const char of q) {
          const found = haystack.indexOf(char, cursor)
          if (found === -1) {
            cursor = -1
            break
          }
          cursor = found + 1
        }
        if (cursor === -1) continue
        score = 60
      }

      // Shorter titles win ties, so "Skills" beats "Skills radar snapshot".
      scored.push({ command, score: score - title.length * 0.35 })
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 40).map((s) => s.command)
  }, [commands, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const command of results) {
      const bucket = map.get(command.group) ?? []
      bucket.push(command)
      map.set(command.group, bucket)
    }
    return [...map.entries()]
  }, [results])

  // Flat order matching the rendered order, so arrow keys agree with the eye.
  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped])

  useEffect(() => {
    setIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // Keep the active row in view while arrowing.
  useEffect(() => {
    if (!open) return
    const active = listRef.current?.querySelector('.palette__item--active')
    active?.scrollIntoView({ block: 'nearest' })
  }, [index, open])

  const runAt = useCallback(
    (position: number) => {
      const command = flat[position]
      if (!command) return
      onClose()
      command.run()
    },
    [flat, onClose],
  )

  if (!open) return null

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette__input-row">
          <Icon name="search" size={16} />
          <input
            className="palette__input"
            placeholder="Search sections, skills, projects, chapters, contacts…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(flat.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                runAt(index)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
          />
          <kbd>esc</kbd>
        </div>

        <div className="palette__results" ref={listRef}>
          {flat.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              Nothing matches “{query}”.
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group}>
                <div className="palette__group">{group}</div>
                {items.map((command) => {
                  const position = flat.indexOf(command)
                  return (
                    <button
                      key={command.id}
                      type="button"
                      className={`palette__item${position === index ? ' palette__item--active' : ''}`}
                      onMouseEnter={() => setIndex(position)}
                      onClick={() => runAt(position)}
                    >
                      <span className="palette__item-icon">{command.icon}</span>
                      <span className="palette__item-body">
                        <span className="palette__item-title">{command.title}</span>
                        {command.subtitle ? (
                          <span className="palette__item-sub">{command.subtitle}</span>
                        ) : null}
                      </span>
                      {position === index ? <kbd>↵</kbd> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="palette__footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>g</kbd> then a letter jumps directly
          </span>
        </div>
      </div>
    </>,
    document.body,
  )
}

/* ============================================================ celebration == */

function Celebration() {
  const { derived, settings, celebrated, markCelebrated } = useStore()

  const pending = derived.achievements.newlyUnlocked.filter((a) => !celebrated.has(a.id))
  const achievement = pending[0]

  useEffect(() => {
    if (!achievement) return
    const timer = window.setTimeout(() => markCelebrated(achievement.id), 4200)
    return () => window.clearTimeout(timer)
  }, [achievement, markCelebrated])

  if (!achievement || !settings.showCelebrations) return null

  const colors = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-6)']

  return createPortal(
    <>
      {!settings.reduceMotion ? (
        <div className="confetti-layer" aria-hidden="true">
          {Array.from({ length: 44 }, (_, i) => {
            // Deterministic spread from the index — no Math.random, so the burst
            // is identical on every re-render rather than flickering.
            const spread = ((i * 37) % 100) - 50
            const drop = 180 + ((i * 53) % 220)
            const rotate = 240 + ((i * 91) % 600)
            return (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: `${50 + spread * 0.9}%`,
                  top: '24%',
                  background: colors[i % colors.length],
                  animationDelay: `${(i % 9) * 45}ms`,
                  ['--dx' as string]: `${spread * 1.8}px`,
                  ['--dy' as string]: `${drop}px`,
                  ['--dr' as string]: `${rotate}deg`,
                }}
              />
            )
          })}
        </div>
      ) : null}

      <div className="celebration" role="status" aria-live="polite">
        <span className="celebration__icon">{achievement.icon}</span>
        <span className="celebration__eyebrow">Achievement unlocked</span>
        <span className="celebration__title">{achievement.name}</span>
        <span className="celebration__body">{achievement.description}</span>
        <Badge tone="accent" size="lg">
          +{achievement.xp.toLocaleString()} XP
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => markCelebrated(achievement.id)}>
          Dismiss
        </Button>
      </div>
    </>,
    document.body,
  )
}

/* ================================================================= toasts == */

function ToastStack() {
  const { toasts, dismissToast } = useStore()
  if (toasts.length === 0) return null

  return createPortal(
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
          <div className="toast__content">
            <div className="toast__title">{toast.title}</div>
            {toast.detail ? <div className="toast__detail">{toast.detail}</div> : null}
          </div>
          <IconButton title="Dismiss" onClick={() => dismissToast(toast.id)}>
            <Icon name="x" size={13} />
          </IconButton>
        </div>
      ))}
    </div>,
    document.body,
  )
}

/* ================================================================== shell == */

export function Shell({ children }: { children: ReactNode }) {
  const { undo, saveNow, setSettings, exportAll } = useStore()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // `g` then a letter, Gmail-style. Cleared after 1.2s.
  const goPending = useRef(false)
  const goTimer = useRef<number | null>(null)

  useEffect(() => {
    /** Types of <input> that own their own text-editing and undo behaviour. */
    const TEXT_INPUT_TYPES = new Set([
      'text',
      'search',
      'url',
      'tel',
      'email',
      'password',
      'number',
      'date',
      'month',
      'week',
      'time',
      'datetime-local',
    ])

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null

      // A focused checkbox or radio is not "typing" — treating it as such was
      // swallowing Cmd/Ctrl+Z immediately after ticking a task, which is exactly
      // when undo is most likely to be wanted.
      const isTextEntry =
        target != null &&
        (target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          (target.tagName === 'INPUT' &&
            TEXT_INPUT_TYPES.has(((target as HTMLInputElement).type || 'text').toLowerCase())))

      // Single-letter shortcuts additionally stay out of the way of selects.
      const typing = isTextEntry || target?.tagName === 'SELECT'

      const mod = event.metaKey || event.ctrlKey

      // Command palette works even while typing elsewhere.
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveNow()
        return
      }

      if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        // Only defer to the browser inside a real text field, where its own
        // undo stack is the one the user means.
        if (isTextEntry) return
        event.preventDefault()
        undo()
        return
      }

      if (typing || mod || event.altKey) return

      // `g` prefix
      if (goPending.current) {
        const match = NAV.find((item) => item.shortcut === event.key.toLowerCase())
        goPending.current = false
        if (goTimer.current !== null) window.clearTimeout(goTimer.current)
        if (match) {
          event.preventDefault()
          navigate(match.path)
        }
        return
      }

      if (event.key === 'g') {
        goPending.current = true
        if (goTimer.current !== null) window.clearTimeout(goTimer.current)
        goTimer.current = window.setTimeout(() => {
          goPending.current = false
        }, 1200)
        return
      }

      // Single-key shortcuts
      switch (event.key) {
        case '/':
          event.preventDefault()
          setPaletteOpen(true)
          break
        case '?':
          event.preventDefault()
          navigate('/settings#shortcuts')
          break
        case 't':
          event.preventDefault()
          setSettings((s) => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }))
          break
        case 'e':
          if (event.shiftKey) {
            event.preventDefault()
            exportAll()
          }
          break
        case '[':
          event.preventDefault()
          setSettings((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (goTimer.current !== null) window.clearTimeout(goTimer.current)
    }
  }, [exportAll, saveNow, setSettings, undo])

  const { settings } = useStore()

  return (
    <div className="app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen ? <div className="scrim" onClick={() => setMenuOpen(false)} /> : null}

      <div className={`app-main${settings.sidebarCollapsed ? ' app-main--collapsed' : ''}`}>
        <Topbar onOpenPalette={() => setPaletteOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
        {children}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Celebration />
      <ToastStack />
    </div>
  )
}

/* ============================================================== page head == */

export function PageHeader({
  title,
  lede,
  actions,
  children,
}: {
  title: ReactNode
  lede?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="page__head">
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 className="page__title">{title}</h1>
        {lede ? <p className="page__lede">{lede}</p> : null}
        {children}
      </div>
      {actions ? <div className="page__toolbar">{actions}</div> : null}
    </div>
  )
}
