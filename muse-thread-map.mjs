/**
 * muse-thread-map.mjs
 * ------------------------------------------------------------------
 * Maps one host conversation (OpenCode session) to one Muse Side chat.
 *
 * Muse keeps a single Main thread; the shim used to send every request
 * there, so unrelated agent sessions shared one context. This module
 * derives a stable key from the opening of a conversation and remembers
 * which Muse thread that key was bound to.
 * ------------------------------------------------------------------
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

function textOf(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : p && (p.text ?? p.content ?? '')))
      .filter(Boolean)
      .join('\n')
  }
  return String(content)
}

/**
 * Stable key for a conversation: its system prompt plus its first user message.
 * Later turns are ignored so follow-ups keep the same key.
 * @returns {string|null} null when there is no user message yet
 */
export function deriveThreadKey(messages) {
  const list = Array.isArray(messages) ? messages : []
  const system = list.filter((m) => m.role === 'system').map((m) => textOf(m.content)).filter(Boolean).join('\n\n')
  const firstUser = list.find((m) => m.role === 'user')
  if (!firstUser) return null
  const basis = `${system}\n\n${textOf(firstUser.content)}`
  return createHash('sha256').update(basis).digest('hex').slice(0, 20)
}

/** Extract the thread uuid from a Muse URL such as https://muse.ai/thread/<uuid>. */
export function extractThreadId(url) {
  const match = String(url || '').match(/\/thread\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  return match ? match[1] : null
}

/**
 * Tiny JSON-backed map of conversation key -> Muse thread id.
 * Writes are atomic (temp file + rename); a corrupt file is moved aside, not thrown.
 */
export function createThreadStore(file) {
  const target = path.resolve(file)
  let data = { version: 1, threads: {} }

  try {
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'))
    if (parsed && typeof parsed.threads === 'object' && parsed.threads) {
      data = { version: 1, threads: parsed.threads }
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      try { fs.renameSync(target, `${target}.corrupt-${Date.now()}`) } catch { /* best effort */ }
    }
  }

  const save = () => {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const tmp = `${target}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    fs.renameSync(tmp, target)
  }

  return {
    file: target,
    get(key) {
      if (!key) return null
      const entry = data.threads[key]
      return entry && entry.threadId ? entry.threadId : null
    },
    set(key, threadId) {
      if (!key || !threadId) return
      data.threads[key] = { threadId, updatedAt: new Date().toISOString() }
      save()
    },
    delete(key) {
      if (!key || !data.threads[key]) return
      delete data.threads[key]
      save()
    },
    size() {
      return Object.keys(data.threads).length
    },
  }
}
