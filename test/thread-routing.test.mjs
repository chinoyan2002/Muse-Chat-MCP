import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startShim } from '../muse-openai-shim.mjs'
import { driver } from '../muse-driver.mjs'
import { closeServer, startTestShim } from '../test-helpers/shim-server.mjs'

const THREAD_A = 'aaaaaaaa-1111-2222-3333-444444444444'
const THREAD_B = 'bbbbbbbb-1111-2222-3333-444444444444'

async function withShim(run, driverImpl, streamImpl) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-route-'))
  process.env.MUSE_THREAD_MAP = path.join(dir, '.muse-threads.json')
  process.env.MUSE_THREAD_MODE = 'session'
  delete process.env.MUSE_THREAD_KEY

  const calls = []
  const originalChat = driver.chat
  const originalStream = driver.chatStream
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
  // Stream requests go through driver.chatStream; default it to the same stub.
  driver.chatStream = streamImpl || (async (prompt, opts = {}) => {
    const result = await driver.chat(prompt, opts)
    if (result.reply && opts.onDelta) opts.onDelta(result.reply)
    return result
  })

  const { server, base } = await startTestShim(startShim)
  try {
    return await run({ base, calls, dir })
  } finally {
    driver.chat = originalChat
    driver.chatStream = originalStream
    delete process.env.MUSE_THREAD_MAP
    delete process.env.MUSE_THREAD_MODE
    delete process.env.MUSE_THREAD_KEY
    await closeServer(server)
  }
}

function post(base, body, headers = {}) {
  return fetch(base + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-opencode-session-id': 'ses_default', ...headers },
    body: JSON.stringify(body),
  })
}

async function send(base, content, headers = {}) {
  const res = await post(base, { model: 'muse', messages: [{ role: 'user', content }] }, headers)
  return res.json()
}

test('A: the same session id reuses its thread on later turns', async () => {
  await withShim(async ({ base, calls, dir }) => {
    await send(base, 'session one')
    await send(base, 'session one')

    assert.equal(calls[0].opts.newThread, true)
    assert.equal(calls[0].opts.chat, undefined)
    assert.equal(calls[1].opts.newThread, false)
    assert.equal(calls[1].opts.chat, THREAD_A)

    const saved = JSON.parse(fs.readFileSync(path.join(dir, '.muse-threads.json'), 'utf8'))
    assert.equal(saved.threads['session:ses_default'].threadId, THREAD_A)
  })
})

test('B: two session ids with identical prompts get separate threads', async () => {
  await withShim(async ({ base, calls }) => {
    await send(base, 'same text', { 'x-opencode-session-id': 'ses_one' })
    await send(base, 'same text', { 'x-opencode-session-id': 'ses_two' })
    assert.equal(calls[0].opts.newThread, true)
    assert.equal(calls[1].opts.newThread, true)
  })
})

test('C: child sessions sharing the parent affinity still get their own threads', async () => {
  await withShim(async ({ base, calls, dir }) => {
    const affinity = { 'x-opencode-session': 'ses_parent' }
    await send(base, 'task', { ...affinity, 'x-opencode-session-id': 'ses_parent' })
    await send(base, 'task', { ...affinity, 'x-opencode-session-id': 'ses_child_a' })
    await send(base, 'task', { ...affinity, 'x-opencode-session-id': 'ses_child_b' })

    assert.deepEqual(calls.map((c) => c.opts.newThread), [true, true, true])
    const saved = JSON.parse(fs.readFileSync(path.join(dir, '.muse-threads.json'), 'utf8'))
    const ids = new Set([
      saved.threads['session:ses_parent'].threadId,
      saved.threads['session:ses_child_a'].threadId,
      saved.threads['session:ses_child_b'].threadId,
    ])
    assert.equal(ids.size, 3)
  })
})

test('D: session mode refuses requests without a unique session id', async () => {
  await withShim(async ({ base, calls, dir }) => {
    const res = await post(base, { model: 'muse', messages: [{ role: 'user', content: 'no id' }] }, {
      'x-opencode-session-id': '',
      'x-opencode-session': 'ses_parent_affinity',
      'x-session-id': 'ses_parent_affinity',
    })
    assert.equal(res.status, 400)
    const data = await res.json()
    assert.equal(data.error.code, 'missing_session_id')
    assert.match(data.error.message, /x-opencode-session-id/)
    assert.equal(calls.length, 0)
    const file = path.join(dir, '.muse-threads.json')
    assert.equal(fs.existsSync(file), false)
  })
})

test('E: a changed system prompt keeps the same thread for the same session', async () => {
  await withShim(async ({ base, calls }) => {
    await post(base, {
      model: 'muse',
      messages: [{ role: 'system', content: 'system v1' }, { role: 'user', content: 'hello' }],
    })
    await post(base, {
      model: 'muse',
      messages: [{ role: 'system', content: 'system v2 (date changed)' }, { role: 'user', content: 'hello' }],
    })
    assert.equal(calls[1].opts.newThread, false)
    assert.equal(calls[1].opts.chat, THREAD_A)
  })
})

test('F: an explicit x-muse-chat header wins over session routing', async () => {
  await withShim(async ({ base, calls }) => {
    await send(base, 'session one', { 'x-muse-chat': THREAD_B })
    assert.equal(calls[0].opts.chat, THREAD_B)
    assert.equal(calls[0].opts.newThread, false)
  })
})

test('G: MUSE_THREAD_MODE=single keeps the old single-thread behavior', async () => {
  await withShim(async ({ base, calls }) => {
    process.env.MUSE_THREAD_MODE = 'single'
    await send(base, 'session one')
    await send(base, 'session one')
    assert.equal(calls[0].opts.newThread, false)
    assert.equal(calls[0].opts.chat, undefined)
    assert.equal(calls[1].opts.newThread, false)
  })
})

test('G: MUSE_THREAD_MODE=new still starts a fresh chat per request', async () => {
  await withShim(async ({ base, calls }) => {
    process.env.MUSE_THREAD_MODE = 'new'
    await send(base, 'session one')
    await send(base, 'session one')
    assert.deepEqual(calls.map((c) => c.opts.newThread), [true, true])
  })
})

test('the title generator uses its own thread instead of a conversation thread', async () => {
  await withShim(async ({ base, calls, dir }) => {
    const titleMessages = [
      { role: 'system', content: 'You name conversations so the user can find them later in a list of past sessions.' },
      { role: 'user', content: 'hello' },
    ]
    await post(base, { model: 'muse', messages: titleMessages })
    await send(base, 'hello')

    assert.equal(calls[0].opts.newThread, true)
    assert.equal(calls[1].opts.newThread, true)
    const saved = JSON.parse(fs.readFileSync(path.join(dir, '.muse-threads.json'), 'utf8'))
    assert.ok(saved.threads['opencode:titles'])
    assert.ok(saved.threads['session:ses_default'])
  })
})

test('a failed side-chat creation returns 5xx and never binds or reuses a thread', async () => {
  const calls = []
  await withShim(async ({ base, dir }) => {
    const first = await post(base, { model: 'muse', messages: [{ role: 'user', content: 'session one' }] })
    assert.equal(first.status, 502)
    const body = await first.json()
    assert.match(body.error.message, /side.chat|fresh Muse thread/i)

    const second = await post(base, { model: 'muse', messages: [{ role: 'user', content: 'session one' }] })
    assert.equal(second.status, 502)

    // Both attempts must ask for a new chat: reusing "whatever is open" is the
    // fail-open path this guard exists to prevent.
    assert.deepEqual(calls.map((c) => c.opts.newThread), [true, true])
    const file = path.join(dir, '.muse-threads.json')
    const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { threads: {} }
    assert.equal(Object.keys(saved.threads).length, 0)
  }, async (prompt, opts = {}) => {
    calls.push({ prompt, opts })
    await new Promise((resolve) => setTimeout(resolve, 25))
    // Same contract the real driver returns when the side chat cannot be opened.
    return {
      reply: '',
      messages: [],
      threadUrl: 'https://muse.ai/',
      threadId: null,
      error: 'the new-side-chat control did not open a new thread; refusing to send into the current chat',
      threadUnavailable: true,
    }
  })
})

test('a fail-closed result never binds the thread it refused to use', async () => {
  await withShim(async ({ base, dir }) => {
    const res = await post(base, {
      model: 'muse',
      stream: true,
      messages: [{ role: 'user', content: 'session one' }],
    })
    assert.equal(res.status, 502)
    const file = path.join(dir, '.muse-threads.json')
    const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { threads: {} }
    // The driver reports the URL it was on when the send was refused. That is the old
    // thread; persisting it would silently share it with this conversation.
    assert.equal(Object.keys(saved.threads).length, 0)
  }, async () => ({ reply: 'ok', threadUrl: `https://muse.ai/thread/${THREAD_A}` }), async () => ({
    reply: '',
    messages: [],
    threadUrl: `https://muse.ai/thread/${THREAD_A}`,
    threadId: null,
    error: 'the message could not be confirmed as sent into a fresh Muse thread',
    threadUnavailable: true,
  }))
})

test('three concurrent requests recover to one thread after the first creation fails', async () => {
  let attempts = 0
  await withShim(async ({ base, dir }) => {
    const responses = await Promise.all([
      post(base, { model: 'muse', messages: [{ role: 'user', content: 'session one' }] }),
      post(base, { model: 'muse', messages: [{ role: 'user', content: 'session one' }] }),
      post(base, { model: 'muse', messages: [{ role: 'user', content: 'session one' }] }),
    ])
    const statuses = responses.map((r) => r.status).sort()
    assert.deepEqual(statuses, [200, 200, 502])

    // One failed creation plus exactly one successful creation: waiters must take turns
    // instead of each opening a new Muse chat once the lock is released.
    assert.equal(attempts, 2)
    const saved = JSON.parse(fs.readFileSync(path.join(dir, '.muse-threads.json'), 'utf8'))
    assert.equal(saved.threads['session:ses_default'].threadId, THREAD_A)
  }, async (prompt, opts = {}) => {
    await new Promise((resolve) => setTimeout(resolve, 25))
    if (opts.newThread) {
      attempts += 1
      if (attempts === 1) {
        return {
          reply: '',
          threadUrl: 'https://muse.ai/',
          threadId: null,
          error: 'the new-side-chat control did not open a new thread',
          threadUnavailable: true,
        }
      }
      return { reply: 'ok', threadUrl: `https://muse.ai/thread/${attempts === 2 ? THREAD_A : THREAD_B}` }
    }
    return { reply: 'ok', threadUrl: `https://muse.ai/thread/${opts.chat}` }
  })
})

test('the isolation guard is added to session-routed prompts', async () => {
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

test('the legacy prompt hash is only used when explicitly enabled', async () => {
  await withShim(async ({ base, calls }) => {
    process.env.MUSE_THREAD_KEY = 'hash'
    await post(base, { model: 'muse', messages: [{ role: 'user', content: 'same text' }] }, { 'x-opencode-session-id': '' })
    await post(base, { model: 'muse', messages: [{ role: 'user', content: 'same text' }] }, { 'x-opencode-session-id': '' })
    assert.equal(calls[1].opts.newThread, false)
    assert.equal(calls[1].opts.chat, THREAD_A)
  })
})

test('concurrent first requests for one session create only one side chat', async () => {
  await withShim(async ({ base, calls }) => {
    await Promise.all([
      post(base, { model: 'muse', messages: [{ role: 'user', content: 'session one' }] }),
      post(base, { model: 'muse', messages: [{ role: 'user', content: 'session one' }] }),
    ])
    assert.equal(calls.filter((c) => c.opts.newThread === true).length, 1)
    assert.equal(calls.filter((c) => c.opts.chat === THREAD_A).length, 1)
  })
})
