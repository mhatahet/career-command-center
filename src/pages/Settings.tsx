/* ============================================================================
   Settings
   ----------------------------------------------------------------------------
   Appearance, profile, data storage, backup and restore, plus the keyboard
   shortcut reference. The Data section is the important one: it explains exactly
   where the JSON files live and how writes are reaching them.
   ========================================================================= */

import { useRef, useState } from 'react'

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
  InlineEdit,
  Input,
  ProgressBar,
  Segmented,
  Select,
  Stat,
  Toggle,
  Tooltip,
} from '../components/ui'
import { formatDate } from '../lib/dates'
import { NAV } from '../lib/nav'
import { isFsApiSupported } from '../lib/persistence'
import { useScrollToAnchor, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { DATA_FILES } from '../lib/types'

const ACCENTS = ['indigo', 'violet', 'cyan', 'emerald', 'amber', 'rose', 'blue'] as const

const ACCENT_HEX: Record<(typeof ACCENTS)[number], string> = {
  indigo: '#6366f1',
  violet: '#a855f7',
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  blue: '#3b82f6',
}

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '⌘K / Ctrl K', label: 'Open the command palette' },
  { keys: '/', label: 'Open the command palette' },
  { keys: '⌘S / Ctrl S', label: 'Save all pending changes now' },
  { keys: '⌘Z / Ctrl Z', label: 'Undo the last change' },
  { keys: 't', label: 'Toggle light and dark' },
  { keys: '[', label: 'Collapse or expand the sidebar' },
  { keys: 'Shift E', label: 'Download a full backup' },
  { keys: '?', label: 'Jump to this shortcut list' },
  { keys: 'g then d', label: 'Go to Dashboard' },
  { keys: 'g then l', label: 'Go to Learning Path' },
  { keys: 'g then r', label: 'Go to Career Roadmap' },
  { keys: 'g then s', label: 'Go to Skills' },
  { keys: 'g then p', label: 'Go to Portfolio' },
  { keys: 'g then w', label: 'Go to Writing' },
  { keys: 'g then i', label: 'Go to Interview Prep' },
  { keys: 'g then n', label: 'Go to Networking' },
  { keys: 'g then a', label: 'Go to Job Applications' },
  { keys: 'g then h', label: 'Go to Highest Leverage' },
  { keys: 'g then j', label: 'Go to Journal' },
  { keys: 'Esc', label: 'Close a drawer, modal or the palette' },
]

export function Settings() {
  const {
    data,
    derived,
    settings,
    setSettings,
    update,
    adapter,
    dirty,
    saving,
    saveNow,
    lastSavedAt,
    connectDataFolder,
    exportAll,
    importAll,
    resetToSeed,
    toast,
  } = useStore()

  const route = useRoute()
  useScrollToAnchor(route.anchor)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      importAll(text)
    } catch (error) {
      toast({ tone: 'danger', title: 'Could not read that file', detail: (error as Error).message })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const hiddenSet = new Set(settings.hiddenSections)

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        lede="Appearance, profile, and — most importantly — where your data lives and whether it is actually reaching disk."
        actions={
          dirty.size > 0 ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Icon name="save" size={13} />}
              onClick={() => void saveNow()}
              disabled={saving}
            >
              {saving ? 'Saving…' : `Save ${dirty.size} file${dirty.size === 1 ? '' : 's'}`}
            </Button>
          ) : null
        }
      />

      {/* ============================================================ data == */}
      <Card variant={adapter.writesToDisk ? 'default' : 'accent'} id="data">
        <CardHeader
          title="Data storage"
          subtitle={adapter.label}
          help="This app has no server and no database. Your data is eighteen JSON files in the project's data folder, and this section shows exactly how the app is reaching them."
          actions={
            <Badge tone={adapter.writesToDisk ? 'success' : 'warning'} size="lg" dot>
              {adapter.kind === 'bridge' ? 'Dev bridge' : adapter.kind === 'fsapi' ? 'Folder connected' : 'Browser only'}
            </Badge>
          }
        />
        <CardBody>
          <div className="col" style={{ gap: 'var(--space-5)' }}>
            <p className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-relaxed)', maxWidth: '80ch' }}>
              {adapter.detail}
            </p>

            {!adapter.writesToDisk ? (
              <div
                className="col"
                style={{
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  background: 'var(--warning-subtle)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span className="text-sm" style={{ color: 'var(--warning-text)', fontWeight: 'var(--weight-medium)' }}>
                  Changes are not reaching your JSON files
                </span>
                <p className="text-xs text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
                  Everything is still being saved in this browser, so nothing is lost. But the files in{' '}
                  <code>data/</code> are not being updated. Two ways to fix it:
                </p>
                <ol className="col" style={{ gap: 'var(--space-2)', paddingLeft: 'var(--space-4)' }}>
                  <li className="text-xs text-secondary">
                    <strong>Run the app with <code>npm run dev</code></strong> — the dev server includes a file
                    bridge that reads and writes <code>data/*.json</code> automatically, with no prompts.
                  </li>
                  <li className="text-xs text-secondary">
                    <strong>Connect the folder</strong> — in a Chromium browser, grant access to the{' '}
                    <code>data</code> folder once and writes become automatic from then on.
                  </li>
                </ol>
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Icon name="folder" size={13} />}
                    onClick={() => void connectDataFolder()}
                    disabled={!isFsApiSupported()}
                    title={
                      isFsApiSupported()
                        ? 'Pick the project data folder'
                        : 'This browser does not support the File System Access API'
                    }
                  >
                    Connect data folder
                  </Button>
                  {!isFsApiSupported() ? (
                    <span className="text-2xs text-quaternary" style={{ alignSelf: 'center' }}>
                      Requires Chrome, Edge or another Chromium browser
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid grid--auto-sm">
              <Stat
                label="Pending writes"
                value={dirty.size}
                size="md"
                tone={dirty.size > 0 ? 'warning' : 'success'}
                meta={dirty.size > 0 ? [...dirty].join(', ') : 'everything saved'}
              />
              <Stat
                label="Last write to disk"
                value={lastSavedAt ? formatDate(lastSavedAt.slice(0, 10), { year: true }) : '—'}
                size="md"
                meta={lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : 'no disk write yet this session'}
              />
              <Stat label="Data files" value={DATA_FILES.length} size="md" meta="in data/" />
              <Stat
                label="Autosave"
                value={settings.autoSave ? 'On' : 'Off'}
                size="md"
                tone={settings.autoSave ? 'success' : 'warning'}
                meta={settings.autoSave ? 'debounced ~0.6s' : 'save manually with ⌘S'}
              />
            </div>

            <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  Autosave
                </span>
                <span className="text-xs text-tertiary">
                  Write changes automatically. With this off, use ⌘S — the topbar shows a count of pending files.
                </span>
              </div>
              <Toggle
                checked={settings.autoSave}
                onChange={(next) => setSettings((s) => ({ ...s, autoSave: next }))}
                ariaLabel="Autosave"
              />
            </div>

            <hr className="divider" />

            {/* Backup */}
            <div className="col" style={{ gap: 'var(--space-3)' }}>
              <span className="section-title">
                Backup and restore
                <HelpDot>
                  A backup is a single JSON file containing all eighteen collections. Worth taking before any
                  large edit, and before a reseed.
                </HelpDot>
              </span>
              <div className="row row--wrap" style={{ gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" icon={<Icon name="download" size={13} />} onClick={exportAll}>
                  Download backup
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Icon name="upload" size={13} />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? 'Importing…' : 'Restore from backup'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleImport(file)
                  }}
                />
                <Tooltip content="Clears this browser's copy. The JSON files on disk are untouched — run `npm run reseed` to regenerate them from scratch.">
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Icon name="refresh" size={13} />}
                    onClick={() => void resetToSeed()}
                  >
                    Clear browser copy
                  </Button>
                </Tooltip>
              </div>
              <span className="text-2xs text-quaternary">
                Restoring replaces every collection in the backup. Take a fresh backup first if you are unsure.
              </span>
            </div>

            <hr className="divider" />

            {/* File list */}
            <div className="col" style={{ gap: 'var(--space-2)' }}>
              <span className="section-title">Files in data/</span>
              <div className="row row--wrap" style={{ gap: 4 }}>
                {DATA_FILES.map((name) => (
                  <Badge key={name} tone={dirty.has(name) ? 'warning' : 'neutral'}>
                    {name}.json
                    {dirty.has(name) ? ' •' : ''}
                  </Badge>
                ))}
              </div>
              <span className="text-2xs text-quaternary">
                Amber means unsaved changes are pending for that file. Each file is written independently, so
                editing a task rewrites <code>roadmap.json</code> only.
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ====================================================== appearance == */}
      <Card>
        <CardHeader title="Appearance" />
        <CardBody>
          <div className="col" style={{ gap: 'var(--space-5)' }}>
            <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  Theme
                </span>
                <span className="text-xs text-tertiary">Or press <kbd>t</kbd> anywhere to toggle.</span>
              </div>
              <Segmented
                value={settings.theme}
                onChange={(next) => setSettings((s) => ({ ...s, theme: next }))}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </div>

            <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  Accent colour
                </span>
                <span className="text-xs text-tertiary">
                  Affects buttons, progress and the primary chart series.
                </span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                {ACCENTS.map((accent) => (
                  <Tooltip key={accent} content={accent}>
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, accent }))}
                      aria-label={accent}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 'var(--radius-sm)',
                        background: ACCENT_HEX[accent],
                        border:
                          settings.accent === accent
                            ? '2px solid var(--text-primary)'
                            : '2px solid transparent',
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    />
                  </Tooltip>
                ))}
              </div>
            </div>

            <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  Density
                </span>
                <span className="text-xs text-tertiary">
                  Compact tightens padding across cards and tables — useful on a laptop screen.
                </span>
              </div>
              <Segmented
                value={settings.density}
                onChange={(next) => setSettings((s) => ({ ...s, density: next }))}
                options={[
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'compact', label: 'Compact' },
                ]}
              />
            </div>

            <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  Celebration animations
                </span>
                <span className="text-xs text-tertiary">Confetti and a card when an achievement unlocks.</span>
              </div>
              <Toggle
                checked={settings.showCelebrations}
                onChange={(next) => setSettings((s) => ({ ...s, showCelebrations: next }))}
                ariaLabel="Celebrations"
              />
            </div>

            <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  Reduce motion
                </span>
                <span className="text-xs text-tertiary">
                  Suppresses confetti and decorative animation. Your OS setting is respected regardless.
                </span>
              </div>
              <Toggle
                checked={settings.reduceMotion}
                onChange={(next) => setSettings((s) => ({ ...s, reduceMotion: next }))}
                ariaLabel="Reduce motion"
              />
            </div>

            <div className="row row--between row--wrap" style={{ gap: 'var(--space-3)' }}>
              <div className="col" style={{ gap: 2 }}>
                <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                  Week starts on
                </span>
                <span className="text-xs text-tertiary">
                  Affects weekly KPI periods, the heat map layout and velocity calculations.
                </span>
              </div>
              <Segmented
                value={String(settings.weekStartsOn)}
                onChange={(next) => setSettings((s) => ({ ...s, weekStartsOn: Number(next) as 0 | 1 }))}
                options={[
                  { value: '1', label: 'Monday' },
                  { value: '0', label: 'Sunday' },
                ]}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ========================================================= profile == */}
      <Card>
        <CardHeader
          title="Profile and programme"
          help="The start date drives every month, quarter and projection in the app. Changing it shifts the whole plan coherently."
        />
        <CardBody>
          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-4)' }}>
            <div className="field">
              <span className="field__label">Name</span>
              <Input
                value={data.profile.name}
                size="sm"
                onChange={(next) =>
                  update((draft) => ({ ...draft, profile: { ...draft.profile, name: next } }), ['profile'], 'edit name')
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Current role</span>
              <Input
                value={data.profile.currentRole}
                size="sm"
                onChange={(next) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, currentRole: next } }),
                    ['profile'],
                    'edit role',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Company</span>
              <Input
                value={data.profile.currentCompany}
                size="sm"
                onChange={(next) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, currentCompany: next } }),
                    ['profile'],
                    'edit company',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Location</span>
              <Input
                value={data.profile.location}
                size="sm"
                onChange={(next) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, location: next } }),
                    ['profile'],
                    'edit location',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">
                Programme start date
                <HelpDot>
                  Everything derives from this: which month you are in, which chapter is current, days
                  remaining, and every projection.
                </HelpDot>
              </span>
              <input
                className="input input--sm"
                type="date"
                value={data.profile.startDate}
                onChange={(e) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, startDate: e.target.value } }),
                    ['profile'],
                    'edit start date',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Horizon (months)</span>
              <input
                className="input input--sm input--num"
                type="number"
                min={1}
                max={60}
                value={data.profile.horizonMonths}
                onChange={(e) =>
                  update(
                    (draft) => ({
                      ...draft,
                      profile: { ...draft.profile, horizonMonths: Math.max(1, Number(e.target.value) || 24) },
                    }),
                    ['profile'],
                    'edit horizon',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">
                Weekly hour target
                <HelpDot>
                  Be honest rather than aspirational. This number drives the capacity warnings and the
                  completion projection — an inflated target produces a comforting projection and a missed
                  deadline.
                </HelpDot>
              </span>
              <input
                className="input input--sm input--num"
                type="number"
                min={1}
                max={60}
                value={data.profile.weeklyHourTarget}
                onChange={(e) =>
                  update(
                    (draft) => ({
                      ...draft,
                      profile: { ...draft.profile, weeklyHourTarget: Math.max(1, Number(e.target.value) || 12) },
                    }),
                    ['profile'],
                    'edit weekly target',
                  )
                }
              />
            </div>
            <div className="field">
              <span className="field__label">Current level label</span>
              <Input
                value={data.profile.careerLevelLabel}
                size="sm"
                onChange={(next) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, careerLevelLabel: next } }),
                    ['profile'],
                    'edit level label',
                  )
                }
              />
            </div>
          </div>

          <div className="col" style={{ gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
            <div className="field">
              <span className="field__label">Positioning statement</span>
              <InlineEdit
                value={data.profile.positioning}
                multiline
                onCommit={(next) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, positioning: next } }),
                    ['profile'],
                    'edit positioning',
                  )
                }
                ariaLabel="Positioning"
              />
            </div>
            <div className="field">
              <span className="field__label">Headline</span>
              <InlineEdit
                value={data.profile.headline}
                multiline
                onCommit={(next) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, headline: next } }),
                    ['profile'],
                    'edit headline',
                  )
                }
                ariaLabel="Headline"
              />
            </div>
            <div className="field">
              <span className="field__label">
                Biggest bottleneck
                <HelpDot>Shown on the dashboard. Update it when the honest answer changes.</HelpDot>
              </span>
              <InlineEdit
                value={data.profile.bottleneck}
                multiline
                onCommit={(next) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, bottleneck: next } }),
                    ['profile'],
                    'edit bottleneck',
                  )
                }
                ariaLabel="Bottleneck"
              />
            </div>
            <div className="field">
              <span className="field__label">Highest-value skill</span>
              <InlineEdit
                value={data.profile.highestValueSkill}
                multiline
                onCommit={(next) =>
                  update(
                    (draft) => ({ ...draft, profile: { ...draft.profile, highestValueSkill: next } }),
                    ['profile'],
                    'edit highest value skill',
                  )
                }
                ariaLabel="Highest-value skill"
              />
            </div>
          </div>
        </CardBody>
        <CardFooter>
          <span>
            Month {derived.timeline.currentMonth} of {derived.timeline.totalMonths} · {derived.timeline.daysRemaining}{' '}
            days remaining
          </span>
          <span>Ends {formatDate(derived.timeline.endDate, { year: true })}</span>
        </CardFooter>
      </Card>

      {/* ======================================================== sections == */}
      <Card>
        <CardHeader
          title="Sidebar sections"
          subtitle="Hide sections you do not use"
          help="Hidden sections stay reachable through the command palette — this only removes them from the sidebar."
        />
        <CardBody>
          <div className="grid grid--auto-sm" style={{ gap: 'var(--space-3)' }}>
            {NAV.map((item) => {
              const hidden = hiddenSet.has(item.id)
              return (
                <div key={item.id} className="row row--between" style={{ gap: 'var(--space-2)' }}>
                  <span className="row text-sm" style={{ gap: 6, minWidth: 0 }}>
                    <span>{item.icon}</span>
                    <span className={hidden ? 'text-quaternary truncate' : 'truncate'}>{item.label}</span>
                  </span>
                  <Toggle
                    checked={!hidden}
                    onChange={(visible) =>
                      setSettings((s) => ({
                        ...s,
                        hiddenSections: visible
                          ? s.hiddenSections.filter((id) => id !== item.id)
                          : [...s.hiddenSections, item.id],
                      }))
                    }
                    ariaLabel={`Show ${item.label}`}
                  />
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* ======================================================= shortcuts == */}
      <Card id="shortcuts">
        <CardHeader
          title="Keyboard shortcuts"
          subtitle="The g-prefix jumps work from anywhere except a text field"
        />
        <CardBody className="card__body--none">
          <div className="grid grid--2" style={{ gap: 0 }}>
            {SHORTCUTS.map((shortcut, index) => (
              <div
                key={shortcut.keys}
                className="row row--between"
                style={{
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-5)',
                  borderTop: index < 2 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <span className="text-sm text-secondary">{shortcut.label}</span>
                <kbd style={{ flexShrink: 0 }}>{shortcut.keys}</kbd>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ============================================================ about == */}
      <Card variant="inset">
        <CardHeader title="About" />
        <CardBody>
          <div className="col" style={{ gap: 'var(--space-4)' }}>
            <p className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-relaxed)', maxWidth: '80ch' }}>
              Career Command Center turns the 24-month roadmap from your executive career audit into something
              you can work from every day. Every score, target, KPI and project in here traces back to that
              document — the readiness score is weighted so that the audit's central finding holds: the
              capability is real, the proof is what is missing.
            </p>

            <div className="grid grid--auto-sm">
              <Stat label="Chapters" value={data.roadmap.chapters.length} size="md" />
              <Stat
                label="Tasks"
                value={data.roadmap.chapters.reduce(
                  (sum, c) => sum + c.missions.reduce((s, m) => s + m.tasks.length, 0),
                  0,
                )}
                size="md"
              />
              <Stat label="Competencies" value={data.skills.length} size="md" />
              <Stat label="Achievements" value={data.achievements.achievements.length} size="md" />
              <Stat label="Interview questions" value={data.interviews.questions.length} size="md" />
              <Stat label="Target companies" value={data.applications.targetCompanies.length} size="md" />
            </div>

            <hr className="divider" />

            <div className="col" style={{ gap: 'var(--space-2)' }}>
              <span className="section-title">Programme progress</span>
              <div className="row row--between text-xs">
                <span className="text-tertiary">Tasks complete vs calendar elapsed</span>
                <span className="tnum">
                  {Math.round(derived.roadmapProgress.pct)}% work · {derived.timeline.timePct}% time
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
        <CardFooter>
          <span>Frontend only · React + TypeScript + Vite · data in eighteen JSON files</span>
          <span>
            <Select
              value=""
              size="sm"
              options={[
                { value: '', label: 'Regenerate data…' },
                { value: 'seed', label: 'npm run seed — fill in missing files' },
                { value: 'reseed', label: 'npm run reseed — overwrite everything' },
              ]}
              onChange={(next) => {
                if (!next) return
                toast({
                  tone: 'info',
                  title: `Run \`npm run ${next}\` in the project folder`,
                  detail:
                    next === 'reseed'
                      ? 'This overwrites every data file and discards logged progress. Download a backup first.'
                      : 'This only creates files that do not already exist. Nothing is overwritten.',
                  duration: 9000,
                })
              }}
            />
          </span>
        </CardFooter>
      </Card>
    </div>
  )
}
