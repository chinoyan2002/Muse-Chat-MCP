import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startShim } from '../muse-openai-shim.mjs'
import { driver } from '../muse-driver.mjs'
import { closeServer, startTestShim } from '../test-helpers/shim-server.mjs'

const THREAD_A = 'aaaaaaaa-1111-2222-3333-444444444444'
const hostEnv = {
  role: 'system',
  content: '<env>\nWorking directory: C:\\Users\\User\\Project\nPlatform: win32\n</env>',
}
const tools = [{
  type: 'function',
  function: {
    name: 'shell',
    description: 'Run a shell command',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
  },
}]
const failClosed = {
  reply: '',
  threadUrl: 'https://muse.ai/',
  error: 'browser crashed',
  threadUnavailable: true,
}

// A corrective retry that never produced a usable answer must not be reported as
// the first (unverified) reply. That is how a fake file listing used to escape.
async function withSequence(results, run, { mode = 'single', threadMap = null } = {}) {
  const dir = threadMap ? fs.mkdtempSync(path.join(os.tmpdir(), 'muse-retry-')) : null
  const originalMode = process.env.MUSE_THREAD_MODE
  const originalMap = process.env.MUSE_THREAD_MAP
  const original = driver.chat
  process.env.MUSE_THREAD_MODE = mode
  if (dir) process.env.MUSE_THREAD_MAP = path.join(dir, '.muse-threads.json')
  else delete process.env.MUSE_THREAD_MAP

  const queue = [...results]
  const prompts = []
  driver.chat = async (prompt) => {
    prompts.push(prompt)
    const next = queue.shift()
    return typeof next === 'function' ? next() : next
  }

  const { server, base } = await startTestShim(startShim)
  try {
    return await run({ base, dir, prompts })
  } finally {
    driver.chat = original
    if (originalMode === undefined) delete process.env.MUSE_THREAD_MODE
    else process.env.MUSE_THREAD_MODE = originalMode
    if (originalMap === undefined) delete process.env.MUSE_THREAD_MAP
    else process.env.MUSE_THREAD_MAP = originalMap
    await closeServer(server)
  }
}

function post(base, body) {
  return fetch(base + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-opencode-session-id': 'ses_retry' },
    body: JSON.stringify({ model: 'muse', ...body }),
  })
}

test('A: a prose refusal whose corrective retry fails is a 502, not the prose', async () => {
  const res = await withSequence(
    [{ reply: '無法讀取本地工作目錄：No such file or directory' }, failClosed],
    ({ base }) => post(base, {
      messages: [hostEnv, { role: 'user', content: 'list the files' }],
      tools,
    }),
  )
  assert.equal(res.status, 502)
  const body = await res.json()
  assert.match(body.error.message, /browser crashed/i)
  assert.equal(body.choices, undefined)
})

test('B: a fake file listing whose retry fails never leaks the fake results', async () => {
  const fake = '已記住：X-1。\n\n目前工作目錄 /home/hatch，前 5 個檔案：\n\nAGENTS.md\nHEARTBEAT.md'
  const res = await withSequence(
    [{ reply: fake, threadUrl: `https://muse.ai/thread/${THREAD_A}` }, failClosed],
    ({ base, dir }) => post(base, {
      messages: [hostEnv, { role: 'user', content: '讀取目前工作目錄' }],
      tools,
    }).then((r) => ({ r, dir })),
    { mode: 'session', threadMap: true },
  )
  assert.equal(res.r.status, 502)
  const text = await res.r.text()
  assert.doesNotMatch(text, /home\/hatch/)
  assert.doesNotMatch(text, /AGENTS\.md/)
  assert.doesNotMatch(text, /finish_reason/)
  const file = path.join(res.dir, '.muse-threads.json')
  const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { threads: {} }
  const bound = saved.threads['session:ses_retry']
  // Either unbound or bound to the thread this conversation actually used.
  assert.ok(!bound || bound.threadId === THREAD_A)
})

test('C: tool_choice=required with a failing retry is a 502, never prose', async () => {
  const res = await withSequence(
    [{ reply: 'I would rather answer in prose.' }, failClosed],
    ({ base }) => post(base, {
      messages: [hostEnv, { role: 'user', content: 'run it' }],
      tools,
      tool_choice: 'required',
    }),
  )
  assert.equal(res.status, 502)
  const body = await res.json()
  assert.match(body.error.message, /tool call/i)
  assert.equal(body.choices, undefined)
})

test('D: a rejected tool call whose correction fails is a 502, not the rejected call', async () => {
  const res = await withSequence(
    [{ reply: '{"tool_calls":[{"name":"shell","arguments":"not json"}]}' }, failClosed],
    ({ base }) => post(base, {
      messages: [hostEnv, { role: 'user', content: 'run it' }],
      tools,
    }),
  )
  assert.equal(res.status, 502)
  const text = await res.text()
  assert.doesNotMatch(text, /tool_calls/)
})

test('E: the streaming variant fails as JSON before any SSE header is sent', async () => {
  const res = await withSequence(
    [{ reply: '無法讀取本機檔案：permission denied' }, failClosed],
    ({ base }) => post(base, {
      messages: [hostEnv, { role: 'user', content: 'list the files' }],
      tools,
      stream: true,
    }),
  )
  assert.equal(res.status, 502)
  assert.match(res.headers.get('content-type') || '', /application\/json/)
  const body = await res.json()
  assert.match(body.error.message, /browser crashed/i)
})

test('F: a tool turn whose driver reports an error is not parsed into a reply', async () => {
  const res = await withSequence(
    [{
      reply: '{"tool_calls":[{"name":"shell","arguments":{"command":"Get-Location"}}]}',
      error: 'page crashed',
    }],
    ({ base }) => post(base, { messages: [hostEnv, { role: 'user', content: 'run it' }], tools }),
  )
  assert.equal(res.status, 502)
  const text = await res.text()
  assert.doesNotMatch(text, /tool_calls/)
})

test('a retry failure releases the lock so the next request still completes', async () => {
  const replies = [
    { reply: '無法讀取本機檔案：permission denied' },
    failClosed,
    { reply: '{"tool_calls":[{"name":"shell","arguments":{"command":"Get-Location"}}]}', threadUrl: `https://muse.ai/thread/${THREAD_A}` },
  ]
  await withSequence(replies, async ({ base, dir }) => {
    const first = await post(base, { messages: [hostEnv, { role: 'user', content: 'one' }], tools })
    assert.equal(first.status, 502)

    const second = await post(base, { messages: [hostEnv, { role: 'user', content: 'two' }], tools })
    assert.equal(second.status, 200)
    const body = await second.json()
    assert.equal(body.choices[0].finish_reason, 'tool_calls')

    const file = path.join(dir, '.muse-threads.json')
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.equal(saved.threads['session:ses_retry'].threadId, THREAD_A)
  }, { mode: 'session', threadMap: true })
})
