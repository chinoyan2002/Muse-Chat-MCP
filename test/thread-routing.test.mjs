import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startShim } from '../muse-openai-shim.mjs'
import { driver } from '../muse-driver.mjs'

const THREAD_A = 'aaaaaaaa-1111-2222-3333-444444444444'
const THREAD_B = 'bbbbbbbb-1111-2222-3333-444444444444'

async function withShim(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-route-'))
  process.env.MUSE_THREAD_MAP = path.join(dir, '.muse-threads.json')
  process.env.MUSE_THREAD_MODE = 'session'

  const calls = []
  const original = driver.chat
  driver.chat = async (prompt, opts = {}) => {
    calls.push({ prompt, opts })
    const threadUrl = opts.newThread || opts.chat === undefined
      ? `https://muse.ai/thread/${opts.newThread ? THREAD_A : THREAD_B}`
      : `https://muse.ai/thread/${opts.chat}`
    return { reply: 'ok', threadUrl }
  }

  const server = startShim({ port: 0, host: '127.0.0.1' })
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    const base = `http://127.0.0.1:${server.address().port}`
    return await run({ base, calls, dir })
  } finally {
    driver.chat = original
    delete process.env.MUSE_THREAD_MAP
    delete process.env.MUSE_THREAD_MODE
    await new Promise((resolve) => server.close(resolve))
  }
}

async function send(base, content, headers = {}) {
  const res = await fetch(base + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ model: 'muse', messages: [{ role: 'user', content }] }),
  })
  return res.json()
}

test('first request creates a side chat, the follow-up reuses it', async () => {
  await withShim(async ({ base, calls, dir }) => {
    await send(base, 'session one')
    await send(base, 'session one')

    assert.equal(calls[0].opts.newThread, true)
    assert.equal(calls[0].opts.chat, undefined)
    assert.equal(calls[1].opts.newThread, false)
    assert.equal(calls[1].opts.chat, THREAD_A)

    const saved = JSON.parse(fs.readFileSync(path.join(dir, '.muse-threads.json'), 'utf8'))
    assert.equal(Object.values(saved.threads)[0].threadId, THREAD_A)
  })
})

test('a different conversation creates its own side chat', async () => {
  await withShim(async ({ base, calls }) => {
    await send(base, 'session one')
    await send(base, 'session two')
    assert.equal(calls[0].opts.newThread, true)
    assert.equal(calls[1].opts.newThread, true)
  })
})

test('MUSE_THREAD_MODE=single keeps the old single-thread behavior', async () => {
  await withShim(async ({ base, calls }) => {
    process.env.MUSE_THREAD_MODE = 'single'
    await send(base, 'session one')
    await send(base, 'session one')
    assert.equal(calls[0].opts.newThread, false)
    assert.equal(calls[0].opts.chat, undefined)
    assert.equal(calls[1].opts.newThread, false)
  })
})

test('an explicit x-muse-chat header wins over session routing', async () => {
  await withShim(async ({ base, calls }) => {
    await send(base, 'session one', { 'x-muse-chat': THREAD_B })
    assert.equal(calls[0].opts.chat, THREAD_B)
    assert.equal(calls[0].opts.newThread, false)
  })
})

test('session routing adds the isolation guard to the prompt', async () => {
  await withShim(async ({ base, calls }) => {
    await send(base, 'session one')
    assert.match(calls[0].prompt, /Independent task/)
    assert.match(calls[0].prompt, /獨立的工作項目/)
  })
})

test('single mode leaves the prompt unguarded', async () => {
  await withShim(async ({ base, calls }) => {
    process.env.MUSE_THREAD_MODE = 'single'
    await send(base, 'session one')
    assert.doesNotMatch(calls[0].prompt, /Independent task/)
  })
})
