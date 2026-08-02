import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, ViteDevServer, Connect } from 'vite'

/**
 * JSON File Bridge
 * ----------------
 * The app is a pure frontend: there is no application server, no database, no auth.
 * But the requirement is that data lives in real `/data/*.json` files on disk and is
 * read + written automatically.
 *
 * A browser page cannot write to an arbitrary folder on its own. So this dev-server
 * middleware exposes a deliberately tiny, local-only file bridge:
 *
 *   GET    /__data/<name>.json   -> read  data/<name>.json
 *   PUT    /__data/<name>.json   -> write data/<name>.json (atomic, pretty-printed)
 *   GET    /__data/__manifest    -> list available files + mtimes
 *
 * It is not an API layer. It holds no business logic, no schema knowledge, and no state.
 * All product logic lives in the client. When the app is built for static hosting this
 * bridge is simply absent, and the client transparently falls back to the File System
 * Access API (a real folder handle the user grants once) and then to localStorage.
 *
 * Safety: file names are validated against a strict allowlist pattern and resolved paths
 * are asserted to stay inside `dataDir`, so the bridge cannot be used to traverse the
 * filesystem.
 */

export interface JsonFileBridgeOptions {
  /** Absolute path to the folder holding the JSON files. */
  dataDir: string
  /** URL prefix for the bridge. Defaults to `/__data`. */
  prefix?: string
}

const SAFE_NAME = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?\.json$/i
const MAX_BODY_BYTES = 12 * 1024 * 1024 // 12 MB ceiling; journals + notes stay far below this

function send(res: Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(payload)
}

function readBody(req: Parameters<Connect.NextHandleFunction>[0]): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Payload exceeds ${MAX_BODY_BYTES} bytes`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function jsonFileBridge(options: JsonFileBridgeOptions): Plugin {
  const { dataDir } = options
  const prefix = options.prefix ?? '/__data'

  /** Resolve `<prefix>/foo.json` to an absolute path, or null if it is not safe. */
  function resolveTarget(pathname: string): string | null {
    const name = decodeURIComponent(pathname.slice(prefix.length).replace(/^\/+/, ''))
    if (!SAFE_NAME.test(name)) return null
    const abs = path.resolve(dataDir, name)
    const rel = path.relative(dataDir, abs)
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null
    return abs
  }

  return {
    name: 'pm-dashboard:json-file-bridge',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith(prefix)) return next()

        const pathname = url.split('?')[0]

        // Advertise the bridge so the client can pick this adapter with certainty.
        if (pathname === `${prefix}/__manifest`) {
          try {
            await fs.mkdir(dataDir, { recursive: true })
            const names = (await fs.readdir(dataDir)).filter((n) => SAFE_NAME.test(n))
            const files = await Promise.all(
              names.map(async (name) => {
                const stat = await fs.stat(path.join(dataDir, name))
                return { name, size: stat.size, modified: stat.mtime.toISOString() }
              }),
            )
            return send(res, 200, { bridge: 'json-file-bridge', version: 1, dataDir, files })
          } catch (error) {
            return send(res, 500, { error: (error as Error).message })
          }
        }

        const target = resolveTarget(pathname)
        if (!target) return send(res, 400, { error: 'Invalid data file name' })

        try {
          if (req.method === 'GET') {
            try {
              const text = await fs.readFile(target, 'utf8')
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.setHeader('Cache-Control', 'no-store')
              return res.end(text)
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return send(res, 404, { error: 'Not found', name: path.basename(target) })
              }
              throw error
            }
          }

          if (req.method === 'PUT' || req.method === 'POST') {
            const raw = await readBody(req)
            let parsed: unknown
            try {
              parsed = JSON.parse(raw)
            } catch {
              return send(res, 422, { error: 'Body is not valid JSON' })
            }
            await fs.mkdir(dataDir, { recursive: true })
            // Write to a sibling temp file then rename, so a crash mid-write cannot
            // truncate a good file. Two tabs saving at once still resolve to one
            // complete document rather than an interleaved one.
            const tmp = `${target}.${process.pid}.tmp`
            await fs.writeFile(tmp, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
            await fs.rename(tmp, target)
            const stat = await fs.stat(target)
            return send(res, 200, {
              ok: true,
              name: path.basename(target),
              size: stat.size,
              modified: stat.mtime.toISOString(),
            })
          }

          res.setHeader('Allow', 'GET, PUT')
          return send(res, 405, { error: `Method ${req.method} not allowed` })
        } catch (error) {
          return send(res, 500, { error: (error as Error).message })
        }
      })

      server.config.logger.info(
        `  \x1b[32m➜\x1b[0m  \x1b[1mJSON bridge\x1b[0m: reading + writing ${path.relative(process.cwd(), dataDir)}/*.json`,
      )
    },
  }
}
