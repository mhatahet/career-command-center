/* ============================================================================
   Persistence
   ----------------------------------------------------------------------------
   The requirement is that data lives in real JSON files in the project folder
   and is read and written automatically. A browser page cannot do that alone,
   so there are three adapters behind one interface, tried in order:

   1. `bridge`  — the Vite dev-server file bridge. Reads and writes
                  `data/*.json` directly. Zero friction, no prompts. This is the
                  adapter in use during `npm run dev`, which is the normal way
                  to run the app.

   2. `fsapi`   — the File System Access API. For a built, statically-hosted
                  copy: the user picks the `data` folder once, the handle is kept
                  in IndexedDB, and writes are automatic from then on. Chromium
                  browsers only.

   3. `local`   — localStorage. Always available, always written to as a mirror
                  even when a better adapter is active, so a failed disk write
                  can never lose work.

   Whichever adapter is active, localStorage is written too. That redundancy is
   the difference between "my data is in a file" and "my data was in a file".
   ========================================================================= */

import { DATA_FILES, type DataFileKey } from './types'

export type AdapterKind = 'bridge' | 'fsapi' | 'local'

export interface AdapterStatus {
  kind: AdapterKind
  label: string
  detail: string
  /** True when writes reach real files on disk. */
  writesToDisk: boolean
  /** True when the user could upgrade to a better adapter with one action. */
  canUpgrade: boolean
}

const BRIDGE_PREFIX = '/__data'
const LS_PREFIX = 'ccc.data.'
const LS_MIRROR_META = 'ccc.mirror.meta'

/* ------------------------------------------------------------- utilities -- */

function lsKey(name: DataFileKey) {
  return `${LS_PREFIX}${name}`
}

function readLocal<T>(name: DataFileKey): T | null {
  try {
    const raw = localStorage.getItem(lsKey(name))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeLocal(name: DataFileKey, value: unknown): boolean {
  try {
    localStorage.setItem(lsKey(name), JSON.stringify(value))
    return true
  } catch {
    // Quota exceeded, or storage disabled. The caller decides how loudly to
    // complain; the primary adapter may well have succeeded.
    return false
  }
}

/* -------------------------------------------------------- bridge adapter -- */

async function detectBridge(): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_PREFIX}/__manifest`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return false
    const body = (await response.json()) as { bridge?: string }
    return body.bridge === 'json-file-bridge'
  } catch {
    return false
  }
}

async function bridgeRead<T>(name: DataFileKey): Promise<T | null> {
  const response = await fetch(`${BRIDGE_PREFIX}/${name}.json`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Bridge read failed for ${name}.json (${response.status})`)
  return (await response.json()) as T
}

async function bridgeWrite(name: DataFileKey, value: unknown): Promise<void> {
  const response = await fetch(`${BRIDGE_PREFIX}/${name}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Bridge write failed for ${name}.json (${response.status}) ${detail}`)
  }
}

/* --------------------------------------------- File System Access adapter -- */

/**
 * A directory handle is not structured-cloneable into localStorage, but it is
 * into IndexedDB. One tiny store, one key.
 */
const IDB_NAME = 'ccc-fs'
const IDB_STORE = 'handles'
const IDB_KEY = 'data-dir'

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDB_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await idb()
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const request = tx.objectStore(IDB_STORE).get(key)
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return undefined
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await idb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* handle simply will not persist across reloads; the user re-picks it */
  }
}

/** Minimal typings — TS lib.dom does not yet ship the full File System Access API. */
type PermissionState = 'granted' | 'denied' | 'prompt'
interface FSFileHandle {
  getFile(): Promise<File>
  createWritable(options?: { keepExistingData?: boolean }): Promise<{
    write(data: string): Promise<void>
    close(): Promise<void>
  }>
}
interface FSDirectoryHandle {
  name: string
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FSFileHandle>
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite'
      startIn?: string
      id?: string
    }) => Promise<FSDirectoryHandle>
  }
}

let dirHandle: FSDirectoryHandle | null = null

export function isFsApiSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

async function restoreDirHandle(): Promise<FSDirectoryHandle | null> {
  const handle = await idbGet<FSDirectoryHandle>(IDB_KEY)
  if (!handle) return null
  try {
    const state = await handle.queryPermission({ mode: 'readwrite' })
    // Chromium will often return 'prompt' after a restart. Re-requesting here
    // silently fails without a user gesture, so leave it to `connectFolder`.
    if (state === 'granted') return handle
    return null
  } catch {
    return null
  }
}

/** Must be called from a user gesture. Prompts for the `data` folder. */
export async function connectFolder(): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!isFsApiSupported()) {
    return { ok: false, error: 'This browser does not support the File System Access API.' }
  }
  try {
    const handle = await window.showDirectoryPicker!({ mode: 'readwrite', id: 'ccc-data' })
    const permission = await handle.requestPermission({ mode: 'readwrite' })
    if (permission !== 'granted') return { ok: false, error: 'Write permission was not granted.' }
    dirHandle = handle
    await idbSet(IDB_KEY, handle)
    return { ok: true, name: handle.name }
  } catch (error) {
    const message = (error as Error).message ?? 'Folder selection was cancelled.'
    // AbortError is the user closing the picker — not worth surfacing as a failure.
    if ((error as Error).name === 'AbortError') return { ok: false }
    return { ok: false, error: message }
  }
}

async function fsapiRead<T>(name: DataFileKey): Promise<T | null> {
  if (!dirHandle) return null
  try {
    const fileHandle = await dirHandle.getFileHandle(`${name}.json`)
    const file = await fileHandle.getFile()
    const text = await file.text()
    return text.trim() ? (JSON.parse(text) as T) : null
  } catch {
    // NotFoundError for a file that does not exist yet is expected on first run.
    return null
  }
}

async function fsapiWrite(name: DataFileKey, value: unknown): Promise<void> {
  if (!dirHandle) throw new Error('No folder connected')
  const fileHandle = await dirHandle.getFileHandle(`${name}.json`, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(`${JSON.stringify(value, null, 2)}\n`)
  await writable.close()
}

/* ------------------------------------------------------- seed fallback ---- */

/**
 * When neither the bridge nor a folder handle is available — a built copy opened
 * without connecting a folder — the seeded JSON still needs to load. Vite serves
 * `/data/*.json` as static assets, so fetch them read-only and let localStorage
 * carry every subsequent change.
 */
async function staticRead<T>(name: DataFileKey): Promise<T | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

/* ------------------------------------------------------------- registry --- */

let activeKind: AdapterKind = 'local'
let bridgeAvailable = false

export async function initPersistence(): Promise<AdapterStatus> {
  bridgeAvailable = await detectBridge()

  if (bridgeAvailable) {
    activeKind = 'bridge'
    return status()
  }

  dirHandle = await restoreDirHandle()
  activeKind = dirHandle ? 'fsapi' : 'local'
  return status()
}

/** Re-evaluate after the user connects a folder. */
export function refreshAdapter(): AdapterStatus {
  if (bridgeAvailable) activeKind = 'bridge'
  else activeKind = dirHandle ? 'fsapi' : 'local'
  return status()
}

export function status(): AdapterStatus {
  switch (activeKind) {
    case 'bridge':
      return {
        kind: 'bridge',
        label: 'Writing to /data',
        detail:
          'Every change is written straight to the JSON files in your project folder. Nothing to configure.',
        writesToDisk: true,
        canUpgrade: false,
      }
    case 'fsapi':
      return {
        kind: 'fsapi',
        label: `Writing to ${dirHandle?.name ?? 'connected folder'}`,
        detail:
          'Connected to a folder on disk via the File System Access API. Changes are written automatically.',
        writesToDisk: true,
        canUpgrade: false,
      }
    default:
      return {
        kind: 'local',
        label: 'Browser storage only',
        detail: isFsApiSupported()
          ? 'Changes are saved in this browser but not to your JSON files. Connect the data folder to write to disk.'
          : 'Changes are saved in this browser but not to your JSON files. Run the app with `npm run dev`, or use a Chromium browser to connect the data folder.',
        writesToDisk: false,
        canUpgrade: isFsApiSupported(),
      }
  }
}

/* ---------------------------------------------------------------- read ---- */

export interface LoadResult<T> {
  value: T | null
  /** Where the value actually came from, which may differ from the active adapter. */
  source: AdapterKind | 'static' | 'none'
}

export async function loadFile<T>(name: DataFileKey): Promise<LoadResult<T>> {
  // Primary adapter first.
  if (activeKind === 'bridge') {
    try {
      const value = await bridgeRead<T>(name)
      if (value !== null) return { value, source: 'bridge' }
    } catch {
      /* fall through to the mirror */
    }
  } else if (activeKind === 'fsapi') {
    const value = await fsapiRead<T>(name)
    if (value !== null) return { value, source: 'fsapi' }
  }

  // localStorage mirror — the most recent state when running without a bridge.
  const mirrored = readLocal<T>(name)
  if (mirrored !== null) return { value: mirrored, source: 'local' }

  // Seeded file served as a static asset.
  const seeded = await staticRead<T>(name)
  if (seeded !== null) return { value: seeded, source: 'static' }

  return { value: null, source: 'none' }
}

/* --------------------------------------------------------------- write ---- */

export interface SaveResult {
  name: DataFileKey
  /** True when the value reached a real file. */
  persistedToDisk: boolean
  /** True when the localStorage mirror was updated. */
  mirrored: boolean
  error?: string
}

export async function saveFile(name: DataFileKey, value: unknown): Promise<SaveResult> {
  // Always mirror first. If the disk write then fails, the work still survives a
  // reload — which is the whole reason the mirror exists.
  const mirrored = writeLocal(name, value)

  try {
    if (activeKind === 'bridge') {
      await bridgeWrite(name, value)
      return { name, persistedToDisk: true, mirrored }
    }
    if (activeKind === 'fsapi') {
      await fsapiWrite(name, value)
      return { name, persistedToDisk: true, mirrored }
    }
    return { name, persistedToDisk: false, mirrored }
  } catch (error) {
    return { name, persistedToDisk: false, mirrored, error: (error as Error).message }
  }
}

/* --------------------------------------------------------- import/export -- */

/** Everything, as one object, for a manual backup. */
export function buildExport(data: Record<string, unknown>) {
  return {
    __format: 'career-command-center/v1',
    __exportedAt: new Date().toISOString(),
    files: Object.fromEntries(DATA_FILES.map((name) => [name, data[name] ?? null])),
  }
}

export function parseImport(text: string): { files: Partial<Record<DataFileKey, unknown>> } | null {
  try {
    const parsed = JSON.parse(text) as { __format?: string; files?: Record<string, unknown> }
    if (parsed.__format !== 'career-command-center/v1' || !parsed.files) return null

    const files: Partial<Record<DataFileKey, unknown>> = {}
    for (const name of DATA_FILES) {
      if (parsed.files[name] != null) files[name] = parsed.files[name]
    }
    return { files }
  } catch {
    return null
  }
}

/** Remove the localStorage mirror. Files on disk are untouched. */
export function clearMirror(): void {
  try {
    for (const name of DATA_FILES) localStorage.removeItem(lsKey(name))
    localStorage.removeItem(LS_MIRROR_META)
  } catch {
    /* nothing to clear */
  }
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
