import test from 'node:test'
import assert from 'node:assert/strict'
import { startShim } from '../muse-openai-shim.mjs'
import { driver } from '../muse-driver.mjs'
import { closeServer, startTestShim } from '../test-helpers/shim-server.mjs'

// Stream-mode failures must never look like a successful completion.
async function withShim(run, { chat, chatStream } = {}) {
  const originalChat = driver.chat
  const originalStream = driver.chatStream
  const originalMode = process.env.MUSE_THREAD_MODE
  process.env.MUSE_THREAD_MODE = 'single'
  if (chat) driver.chat = chat
  if (chatStream) driver.chatStream = chatStream

  const { server, base } = await startTestShim(startShim)
  try {
    return await run(base)
  } finally {
    driver.chat = originalChat
    driver.chatStream = originalStream
    if (originalMode === undefined) delete process.env.MUSE_THREAD_MODE
    else process.env.MUSE_THREAD_MODE = originalMode
    await closeServer(server)
  }
}

function post(base, body) {
  return fetch(base + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const failClosed = {
  reply: '',
  messages: [],
  threadUrl: 'https://muse.ai/',
  threadId: null,
  error: 'the new-side-chat control did not open a new thread; refusing to send into the current chat',
  threadUnavailable: true,
}

test('SSE: side-chat creation failure returns an HTTP error, not an empty 200 stream', async () => {
  await withShim(async (base) => {
    const res = await post(base, { model: 'muse', stream: true, messages: [{ role: 'user', content: 'hi' }] })
    assert.equal(res.status, 502)
    assert.match(res.headers.get('content-type') || '', /application\/json/)
    const body = await res.json()
    assert.match(body.error.message, /side.chat|fresh Muse thread/i)
  }, { chat: async () => failClosed, chatStream: async () => failClosed })
})

test('SSE: driver failure before the first token returns an HTTP error', async () => {
  await withShim(async (base) => {
    const res = await post(base, { model: 'muse', stream: true, messages: [{ role: 'user', content: 'hi' }] })
    assert.equal(res.status, 502)
    const body = await res.json()
    assert.match(body.error.message, /browser crashed/i)
  }, {
    chat: async () => ({ reply: '', error: 'browser crashed' }),
    chatStream: async () => ({ reply: '', error: 'browser crashed' }),
  })
})

test('SSE: an error after partial output is delivered as an SSE error event', async () => {
  await withShim(async (base) => {
    const res = await post(base, { model: 'muse', stream: true, messages: [{ role: 'user', content: 'hi' }] })
    assert.equal(res.status, 200)
    const text = await res.text()
    assert.match(text, /partial answer/)
    assert.match(text, /"error":\{"message":"Muse error: page crashed"/)
    assert.match(text, /data: \[DONE\]/)
  }, {
    chat: async () => ({ reply: '', error: 'page crashed' }),
    chatStream: async (prompt, opts = {}) => {
      opts.onDelta && opts.onDelta('partial answer')
      return { reply: 'partial answer', error: 'page crashed' }
    },
  })
})

test('non-stream: an error accompanying a reply is still an HTTP error', async () => {
  // The streaming path already fails on any driver error. A non-empty reply must not
  // make the same failure look like a normal answer when the caller did not stream.
  await withShim(async (base) => {
    const res = await post(base, { model: 'muse', messages: [{ role: 'user', content: 'hi' }] })
    assert.equal(res.status, 502)
    const text = await res.text()
    assert.doesNotMatch(text, /partial answer/)
  }, { chat: async () => ({ reply: 'partial answer', error: 'page crashed' }) })
})

test('SSE: tool_choice=required without a tool call returns an HTTP error', async () => {
  await withShim(async (base) => {
    const res = await post(base, {
      model: 'muse',
      stream: true,
      tool_choice: 'required',
      tools: [{
        type: 'function',
        function: {
          name: 'shell',
          parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
        },
      }],
      messages: [{ role: 'user', content: 'run something' }],
    })
    assert.equal(res.status, 502)
    const body = await res.json()
    assert.match(body.error.message, /requires a tool call/i)
  }, { chat: async () => ({ reply: 'I would rather answer in prose.' }) })
})

test('non-stream: the same failures return a 5xx JSON error', async () => {
  await withShim(async (base) => {
    const res = await post(base, { model: 'muse', messages: [{ role: 'user', content: 'hi' }] })
    assert.equal(res.status, 502)
    const body = await res.json()
    assert.match(body.error.message, /side.chat|fresh Muse thread/i)
  }, { chat: async () => failClosed, chatStream: async () => failClosed })
})

test('SSE: a normal reply still ends with finish_reason and [DONE]', async () => {
  await withShim(async (base) => {
    const res = await post(base, { model: 'muse', stream: true, messages: [{ role: 'user', content: 'hi' }] })
    assert.equal(res.status, 200)
    const text = await res.text()
    assert.match(text, /"finish_reason":"stop"/)
    assert.match(text, /data: \[DONE\]/)
  }, {
    chat: async () => ({ reply: 'hello', threadUrl: null }),
    chatStream: async (prompt, opts = {}) => {
      opts.onDelta && opts.onDelta('hello')
      return { reply: 'hello', threadUrl: null }
    },
  })
})
