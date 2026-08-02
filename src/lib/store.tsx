/* ============================================================================
   Store
   ----------------------------------------------------------------------------
   One context, one immutable `AppData` document, and a single `update()` that
   takes a producer function. Every mutation goes through it, which is what makes
   autosave, dirty-tracking and undo possible without touching feature code.

   Saving is per-file and debounced: editing a task writes `roadmap.json` only,
   not all eighteen files. Two rapid edits collapse into one write.
   ========================================================================= */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { derive, type Derived } from './derive'
import { today as todayISO } from './dates'
import {
  buildExport,
  clearMirror,
  connectFolder,
  downloadJson,
  initPersistence,
  loadFile,
  parseImport,
  refreshAdapter,
  saveFile,
  status as adapterStatus,
  type AdapterStatus,
} from './persistence'
import { DATA_FILES, type AppData, type DataFileKey, type Settings } from './types'

/* --------------------------------------------------------------- toasts --- */

export interface Toast {
  id: string
  title: string
  detail?: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  /** Milliseconds; 0 means it stays until dismissed. */
  duration?: number
}

/* ---------------------------------------------------------------- state --- */

export type LoadPhase = 'loading' | 'ready' | 'error'

interface StoreValue {
  phase: LoadPhase
  error?: string
  data: AppData
  derived: Derived
  adapter: AdapterStatus

  /** Apply an immutable update. `files` names which JSON files it touched. */
  update: (producer: (draft: AppData) => AppData, files: DataFileKey[], label?: string) => void
  /** Convenience: update one collection and its file in one call. */
  patch: <K extends DataFileKey>(key: K, producer: (current: AppData[K]) => AppData[K], label?: string) => void

  /** Files with unsaved changes. */
  dirty: Set<DataFileKey>
  saving: boolean
  lastSavedAt?: string
  saveNow: () => Promise<void>

  undo: () => void
  canUndo: boolean
  undoLabel?: string

  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void

  settings: Settings
  setSettings: (producer: (current: Settings) => Settings) => void

  connectDataFolder: () => Promise<void>
  exportAll: () => void
  importAll: (text: string) => boolean
  resetToSeed: () => Promise<void>

  /** Achievements celebrated this session, so a reload does not re-fire them. */
  celebrated: Set<string>
  markCelebrated: (id: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

/* ------------------------------------------------------------ empty doc --- */

/**
 * Shape-complete empty document. Used while loading and as the merge base, so no
 * component ever has to guard against a missing collection.
 */
function emptyData(): AppData {
  return {
    profile: {
      name: '', currentRole: '', currentCompany: '', location: '',
      positioning: '', headline: '', startDate: todayISO(), horizonMonths: 24,
      careerLevelLabel: '', targetLevelLabel: '',
      benchmark: { localPercentile: '', internationalPercentile: '', notYetCompetitiveFor: [], alreadyCompetitiveFor: [] },
      successProbability: { low: 0, high: 0, assumptions: [] },
      weeklyHourTarget: 12, bottleneck: '', highestValueSkill: '',
    },
    skills: [],
    roadmap: { chapters: [], throughput: [], phases: [] },
    tasks: [],
    goals: [],
    portfolio: [],
    books: [],
    courses: [],
    interviews: { questions: [], mocks: [] },
    networking: { contacts: [], events: [] },
    linkedin: { positioning: '', headline: '', aboutThemes: [], weeklyCadence: [], snapshots: [], ideas: [], monthlyGoals: [] },
    writing: [],
    applications: { applications: [], targetCompanies: [], compensation: [] },
    achievements: { achievements: [], badges: [] },
    analytics: { activity: [], readinessHistory: [], capacityHistory: [] },
    journal: { entries: [], prompts: [] },
    leverage: { actions: [], antiPatterns: [], timeBudgets: [], oneYearSequence: [], mistakes: [], startDoing: [], stopDoing: [], ifIWereResponsible: [] },
    settings: {
      theme: 'dark', accent: 'indigo', sidebarCollapsed: false, density: 'comfortable',
      autoSave: true, showCelebrations: true, reduceMotion: false, weekStartsOn: 1,
      hiddenSections: [], dashboardLayout: [],
    },
  }
}

/**
 * `skills.json` holds three related structures. Everything else maps directly.
 * Keeping this asymmetry in one function means the rest of the app sees a flat
 * `data.skills` array.
 */
interface SkillsFile {
  skills: AppData['skills']
  competitiveAdvantages: { id: string; title: string; detail: string; skill: string }[]
  gapRegister: Record<string, { id: string; title: string; detail: string; skill: string }[]>
}

let skillsMeta: Pick<SkillsFile, 'competitiveAdvantages' | 'gapRegister'> = {
  competitiveAdvantages: [],
  gapRegister: {},
}

export function getSkillsMeta() {
  return skillsMeta
}

const SAVE_DEBOUNCE_MS = 650
const UNDO_DEPTH = 40

/* --------------------------------------------------------------- provider - */

export function StoreProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<LoadPhase>('loading')
  const [error, setError] = useState<string | undefined>()
  const [data, setData] = useState<AppData>(emptyData)
  const [adapter, setAdapter] = useState<AdapterStatus>(() => adapterStatus())
  const [dirty, setDirty] = useState<Set<DataFileKey>>(new Set())
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string>()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [celebrated, setCelebrated] = useState<Set<string>>(new Set())

  const undoStack = useRef<{ data: AppData; files: DataFileKey[]; label: string }[]>([])
  const [undoLabel, setUndoLabel] = useState<string>()
  const saveTimer = useRef<number | null>(null)
  const pendingFiles = useRef<Set<DataFileKey>>(new Set())
  // Read inside the debounced save without making it a dependency.
  const dataRef = useRef(data)
  dataRef.current = data

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev.slice(-4), { ...t, id }])
    const duration = t.duration ?? (t.tone === 'danger' ? 8000 : 4000)
    if (duration > 0) {
      window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), duration)
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /* ---------------------------------------------------------------- load -- */

  useEffect(() => {
    let cancelled = false

    async function load() {
      const status = await initPersistence()
      if (cancelled) return
      setAdapter(status)

      const next = emptyData()
      const missing: DataFileKey[] = []

      const results = await Promise.all(
        DATA_FILES.map(async (name) => ({ name, ...(await loadFile<unknown>(name)) })),
      )
      if (cancelled) return

      for (const result of results) {
        if (result.value == null) {
          missing.push(result.name)
          continue
        }

        if (result.name === 'skills') {
          const file = result.value as SkillsFile
          // Tolerate both the wrapped shape and a bare array, so a hand-edited
          // file that drops the wrapper still loads.
          if (Array.isArray(file)) {
            next.skills = file as AppData['skills']
          } else {
            next.skills = file.skills ?? []
            skillsMeta = {
              competitiveAdvantages: file.competitiveAdvantages ?? [],
              gapRegister: file.gapRegister ?? {},
            }
          }
          continue
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(next as any)[result.name] = result.value
      }

      if (missing.length === DATA_FILES.length) {
        setError(
          'No data files were found. Run `npm run seed` in the project folder to create them, then reload.',
        )
        setPhase('error')
        return
      }

      setData(next)
      setPhase('ready')

      if (missing.length > 0) {
        toast({
          tone: 'warning',
          title: `${missing.length} data file${missing.length === 1 ? '' : 's'} missing`,
          detail: `${missing.join(', ')} — run \`npm run seed\` to create them.`,
          duration: 9000,
        })
      }

      if (!status.writesToDisk) {
        toast({
          tone: 'warning',
          title: 'Changes are not reaching your JSON files',
          detail: status.detail,
          duration: 0,
        })
      }
    }

    load().catch((e) => {
      if (cancelled) return
      setError((e as Error).message)
      setPhase('error')
    })

    return () => {
      cancelled = true
    }
  }, [toast])

  /* ---------------------------------------------------------------- save -- */

  const flush = useCallback(async () => {
    const files = [...pendingFiles.current]
    if (files.length === 0) return

    pendingFiles.current = new Set()
    setSaving(true)

    const current = dataRef.current
    const failures: string[] = []
    let anyDiskWrite = false

    for (const name of files) {
      // Re-wrap skills into its file shape on the way out.
      const payload =
        name === 'skills'
          ? { skills: current.skills, ...skillsMeta }
          : (current as unknown as Record<string, unknown>)[name]

      const result = await saveFile(name, payload)
      if (result.persistedToDisk) anyDiskWrite = true
      if (!result.persistedToDisk && !result.mirrored) {
        failures.push(`${name}.json: ${result.error ?? 'no writable target'}`)
      }
    }

    setSaving(false)
    setDirty((prev) => {
      const next = new Set(prev)
      for (const name of files) if (!pendingFiles.current.has(name)) next.delete(name)
      return next
    })

    if (anyDiskWrite) setLastSavedAt(new Date().toISOString())

    if (failures.length > 0) {
      toast({
        tone: 'danger',
        title: 'Some changes could not be saved',
        detail: failures.join(' · '),
        duration: 0,
      })
    }
  }, [toast])

  const scheduleSave = useCallback(
    (files: DataFileKey[]) => {
      for (const name of files) pendingFiles.current.add(name)
      setDirty((prev) => new Set([...prev, ...files]))

      if (!dataRef.current.settings.autoSave) return

      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null
        void flush()
      }, SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  const saveNow = useCallback(async () => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await flush()
  }, [flush])

  /* -------------------------------------------------------------- update -- */

  const update = useCallback(
    (producer: (draft: AppData) => AppData, files: DataFileKey[], label = 'change') => {
      setData((current) => {
        const next = producer(current)
        if (next === current) return current

        undoStack.current.push({ data: current, files, label })
        if (undoStack.current.length > UNDO_DEPTH) undoStack.current.shift()
        setUndoLabel(label)

        return next
      })
      scheduleSave(files)
    },
    [scheduleSave],
  )

  const patch = useCallback(
    <K extends DataFileKey>(key: K, producer: (current: AppData[K]) => AppData[K], label?: string) => {
      update((draft) => ({ ...draft, [key]: producer(draft[key]) }), [key], label ?? `edit ${key}`)
    },
    [update],
  )

  const undo = useCallback(() => {
    const entry = undoStack.current.pop()
    if (!entry) return
    setData(entry.data)
    scheduleSave(entry.files)
    setUndoLabel(undoStack.current.at(-1)?.label)
    toast({ tone: 'info', title: `Undid ${entry.label}`, duration: 2500 })
  }, [scheduleSave, toast])

  /* ------------------------------------------------------------ settings -- */

  const setSettings = useCallback(
    (producer: (current: Settings) => Settings) => {
      update((draft) => ({ ...draft, settings: producer(draft.settings) }), ['settings'], 'settings change')
    },
    [update],
  )

  /* ---------------------------------------------------- data folder etc. -- */

  const connectDataFolder = useCallback(async () => {
    const result = await connectFolder()
    if (result.ok) {
      const next = refreshAdapter()
      setAdapter(next)
      // Write everything immediately so the folder is complete and current.
      pendingFiles.current = new Set(DATA_FILES)
      await flush()
      toast({
        tone: 'success',
        title: `Connected to ${result.name ?? 'folder'}`,
        detail: 'All eighteen files written. Changes now save straight to disk.',
      })
    } else if (result.error) {
      toast({ tone: 'danger', title: 'Could not connect folder', detail: result.error })
    }
  }, [flush, toast])

  const exportAll = useCallback(() => {
    const payload = buildExport({
      ...(dataRef.current as unknown as Record<string, unknown>),
      skills: { skills: dataRef.current.skills, ...skillsMeta },
    })
    const stamp = new Date().toISOString().slice(0, 10)
    downloadJson(`career-command-center-${stamp}.json`, payload)
    toast({ tone: 'success', title: 'Backup downloaded', detail: 'All eighteen collections in one file.' })
  }, [toast])

  const importAll = useCallback(
    (text: string) => {
      const parsed = parseImport(text)
      if (!parsed) {
        toast({
          tone: 'danger',
          title: 'Import failed',
          detail: 'That file is not a Career Command Center backup.',
        })
        return false
      }

      update(
        (draft) => {
          const next: AppData = { ...draft }
          for (const [name, value] of Object.entries(parsed.files)) {
            if (name === 'skills') {
              const file = value as SkillsFile
              if (Array.isArray(file)) next.skills = file as AppData['skills']
              else {
                next.skills = file.skills ?? []
                skillsMeta = {
                  competitiveAdvantages: file.competitiveAdvantages ?? [],
                  gapRegister: file.gapRegister ?? {},
                }
              }
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(next as any)[name] = value
            }
          }
          return next
        },
        Object.keys(parsed.files) as DataFileKey[],
        'import',
      )

      toast({
        tone: 'success',
        title: 'Backup restored',
        detail: `${Object.keys(parsed.files).length} collections imported.`,
      })
      return true
    },
    [toast, update],
  )

  const resetToSeed = useCallback(async () => {
    clearMirror()
    toast({
      tone: 'info',
      title: 'Browser copy cleared',
      detail: 'Run `npm run reseed` to regenerate the JSON files, then reload.',
      duration: 9000,
    })
  }, [toast])

  const markCelebrated = useCallback((id: string) => {
    setCelebrated((prev) => new Set(prev).add(id))
  }, [])

  /* ------------------------------------------------------ derived + theme -- */

  const derived = useMemo(() => derive(data), [data])

  // Persist newly satisfied achievement unlocks so they survive a reload.
  const pendingUnlockRef = useRef(false)
  useEffect(() => {
    if (phase !== 'ready') return
    const fresh = derived.achievements.newlyUnlocked
    if (fresh.length === 0 || pendingUnlockRef.current) return

    pendingUnlockRef.current = true
    const stamp = new Date().toISOString()
    const ids = new Set(fresh.map((a) => a.id))

    update(
      (draft) => ({
        ...draft,
        achievements: {
          ...draft.achievements,
          achievements: draft.achievements.achievements.map((a) =>
            ids.has(a.id) && !a.unlockedAt ? { ...a, unlockedAt: stamp } : a,
          ),
        },
      }),
      ['achievements'],
      fresh.length === 1 ? `unlock ${fresh[0].name}` : `${fresh.length} achievements unlocked`,
    )

    // Release the guard after the state settles, so a later unlock can fire.
    window.setTimeout(() => {
      pendingUnlockRef.current = false
    }, 100)
  }, [derived.achievements.newlyUnlocked, phase, update])

  // Apply theme and density to the document root.
  useEffect(() => {
    const { theme, density, accent, reduceMotion } = data.settings
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : theme
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.setAttribute('data-density', density)
    document.documentElement.setAttribute('data-accent', accent)
    document.documentElement.toggleAttribute('data-reduce-motion', reduceMotion)
    try {
      localStorage.setItem('ccc.theme', resolved)
    } catch {
      /* pre-paint script will fall back to the system preference */
    }
  }, [data.settings.theme, data.settings.density, data.settings.accent, data.settings.reduceMotion, data.settings])

  // Follow the OS when the theme is 'system'.
  useEffect(() => {
    if (data.settings.theme !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      document.documentElement.setAttribute('data-theme', query.matches ? 'light' : 'dark')
    }
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [data.settings.theme])

  // Warn before leaving with unflushed work.
  useEffect(() => {
    if (dirty.size === 0) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty.size])

  // Flush on tab hide, which catches the close-the-laptop case.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden' && pendingFiles.current.size > 0) void flush()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [flush])

  const value = useMemo<StoreValue>(
    () => ({
      phase,
      error,
      data,
      derived,
      adapter,
      update,
      patch,
      dirty,
      saving,
      lastSavedAt,
      saveNow,
      undo,
      canUndo: undoStack.current.length > 0,
      undoLabel,
      toasts,
      toast,
      dismissToast,
      settings: data.settings,
      setSettings,
      connectDataFolder,
      exportAll,
      importAll,
      resetToSeed,
      celebrated,
      markCelebrated,
    }),
    [
      phase, error, data, derived, adapter, update, patch, dirty, saving, lastSavedAt,
      saveNow, undo, undoLabel, toasts, toast, dismissToast, setSettings,
      connectDataFolder, exportAll, importAll, resetToSeed, celebrated, markCelebrated,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/* ----------------------------------------------------------------- hooks -- */

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside <StoreProvider>')
  return value
}

export function useData(): AppData {
  return useStore().data
}

export function useDerived(): Derived {
  return useStore().derived
}

export function useSettings(): Settings {
  return useStore().data.settings
}

/** Stable id generator for new rows. */
let idCounter = 0
export function newId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`
}
