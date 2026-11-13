import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startShim } from '../muse-openai-shim.mjs'
import { driver } from '../muse-driver.mjs'

const THREAD_A = 'aaaaaaaa-1111-2222-3333-444444444444'
const THREAD_B = 'bbbbbbbb-1111-2222-3333-444444444444'

async function withShim(run, driverImpl) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-route-'))
  process.env.MUSE_THREAD_MAP = path.join(dir, '.muse-threads.json')
  process.env.MUSE_THREAD_MODE = 'session'

  const calls = []
  const original = driver.chat
  let created = 0
  driver.chat = driverImpl || (async (prompt, opts = {}) => {
    calls.push({ prompt, opts })
    await new Promise((resolve) => setTimeout(resolve, 25))
    // Every fresh chat gets its own uuid so tests can tell threads apart.
    if (opts.newThread) {
      created += 1
      const id = created === 1 ? THREAD_A : `${String(created).repeat(8)}-1111-2222-3333-444444444444`
      return { reply: 'ok', threadUrl: `https://muse.ai/thread/${id}` }
    }
    return {
      reply: 'ok',
      threadUrl: `https://muse.ai/thread/${opts.chat === undefined ? THREAD_B : opts.chat}`,
    }
  })

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

test('routes by the OpenCode session header, not by the first message', async () => {
  await withShim(async ({ base, calls }) => {
    await send(base, 'first request', { 'x-opencode-session': 'ses_one' })
    await send(base, 'a different opening text', { 'x-opencode-session': 'ses_one' })
    assert.equal(calls[0].opts.newThread, true)
    assert.equal(calls[1].opts.newThread, false)
    assert.equal(calls[1].opts.chat, THREAD_A)
  })
})

test('two sessions with identical text still get separate threads', async () => {
  await withShim(async ({ base, calls }) => {
    await send(base, 'same text', { 'x-opencode-session': 'ses_one' })
    await send(base, 'same text', { 'x-opencode-session': 'ses_two' })
    assert.equal(calls[0].opts.newThread, true)
    assert.equal(calls[1].opts.newThread, true)
  })
})

test('the title generator uses its own thread instead of a conversation thread', async () => {
  await withShim(async ({ base, calls, dir }) => {
    const titleMessages = [
      { role: 'system', content: 'You name conversations so the user can find them later in a list of past sessions.' },
      { role: 'user', content: 'hello' },
    ]
    await fetch(base + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-opencode-session': 'ses_one' },
      body: JSON.stringify({ model: 'muse', messages: titleMessages }),
    })
    await send(base, 'hello', { 'x-opencode-session': 'ses_one' })

    assert.equal(calls[0].opts.newThread, true)
    assert.equal(calls[1].opts.newThread, true)
    const saved = JSON.parse(fs.readFileSync(path.join(dir, '.muse-threads.json'), 'utf8'))
    assert.ok(saved.threads['opencode:titles'])
    assert.ok(saved.threads['session:ses_one'])
  })
})

test('a failed side-chat creation never falls back to the current thread', async () => {
  const calls = []
  await withShim(async ({ base, dir }) => {
    await send(base, 'session one')
    await send(base, 'session one')
    // Both attempts must ask for a new chat: reusing "whatever is open" is the
    // fail-open path this guard exists to prevent.
    assert.deepEqual(calls.map((c) => c.opts.newThread), [true, true])
    const file = path.join(dir, '.muse-threads.json')
    const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { threads: {} }
    assert.equal(Object.keys(saved.threads).length, 0)
  }, async (prompt, opts = {}) => {
    calls.push({ prompt, opts })
    await new Promise((resolve) => setTimeout(resolve, 25))
    // Looks like success but carries no thread uuid.
    return { reply: 'ok', threadUrl: 'https://muse.ai/' }
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

test('concurrent first requests create only one side chat', async () => {
  await withShim(async ({ base, calls }) => {
    await Promise.all([send(base, 'session one'), send(base, 'session one')])
    assert.equal(calls.filter((c) => c.opts.newThread === true).length, 1)
    assert.equal(calls.filter((c) => c.opts.chat === THREAD_A).length, 1)
  })
})
