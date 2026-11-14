import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPrompt,
  claimsHostToolResult,
  collectFiles,
  startShim,
  validateArguments,
} from '../muse-openai-shim.mjs'
import { driver } from '../muse-driver.mjs'
import { closeServer, startTestShim } from '../test-helpers/shim-server.mjs'

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

const hostEnv = {
  role: 'system',
  content: '<env>\nWorking directory: C:\\Users\\User\\Documents\\路由設定檔\nPlatform: win32\n</env>\nYou are a coding agent.',
}

test('collectFiles only reads attachments from the current turn', () => {
  const body = {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'old turn' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,OLD' } },
        ],
      },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: 'current turn without attachments' },
    ],
  }
  assert.deepEqual(collectFiles(body), [])

  const withCurrent = {
    messages: [
      { role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,OLD' } }] },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'now' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,NEW' } },
        ],
      },
    ],
  }
  assert.deepEqual(collectFiles(withCurrent), [{ url: 'data:image/png;base64,NEW' }])
})

test('a reply that claims another working directory is treated as a tool result claim', () => {
  const messages = [
    hostEnv,
    { role: 'user', content: '讀取目前工作目錄，列出前 5 個檔案' },
  ]
  assert.equal(
    claimsHostToolResult('已記住：GUI-715。\n\n目前工作目錄 /home/hatch，前 5 個檔案：\n\nAGENTS.md', messages),
    true,
  )
  // The same directory the host declared is not a claim of foreign results.
  assert.equal(
    claimsHostToolResult('目前工作目錄 C:\\Users\\User\\Documents\\路由設定檔', messages),
    false,
  )
  assert.equal(claimsHostToolResult('42', messages), false)
})

test('general path mentions are not treated as tool results', () => {
  const messages = [hostEnv, { role: 'user', content: 'explain where configs live' }]
  assert.equal(claimsHostToolResult('在 macOS 上，設定檔通常位於 /Users/example/Library/Preferences。', messages), false)
  assert.equal(claimsHostToolResult('```bash\ncd /home/user/project\nls\n```', messages), false)
})

test('a claimed listing under a foreign root is still caught', () => {
  const messages = [hostEnv, { role: 'user', content: '目錄內容？' }]
  assert.equal(claimsHostToolResult('目前工作目錄 /home/hatch，前 5 個檔案：\n\nAGENTS.md', messages), true)
  assert.equal(claimsHostToolResult('目錄內容：\n/Users/example/notes.txt', messages), true)
})

test('fictional filenames without a directory claim are not guessed at', () => {
  const messages = [hostEnv, { role: 'user', content: 'what files?' }]
  // Documented limitation: without a directory claim there is no reliable signal.
  assert.equal(claimsHostToolResult('檔案有 alpha.txt、beta.txt 兩個。', messages), false)
})

test('an ordinary prose answer is not retried', async () => {  let calls = 0
  await withStubbedShim(
    () => { calls += 1; return '42' },
    async (base) => {
      const res = await postChat(base, { messages: [{ role: 'user', content: 'how many?' }], tools })
      assert.equal(res.status, 200)
      const data = await res.json()
      assert.equal(data.choices[0].message.content, '42')
    },
  )
  assert.equal(calls, 1)
})

test('a fake file listing is retried once and the tool call wins', async () => {
  const prompts = []
  const replies = [
    '已記住：GUI-715。\n\n目前工作目錄 /home/hatch，前 5 個檔案：\n\nAGENTS.md\nHEARTBEAT.md',
    '{"tool_calls":[{"name":"shell","arguments":{"command":"Get-Location"}}]}',
  ]
  await withStubbedShim(
    (prompt) => { prompts.push(prompt); return replies.shift() },
    async (base) => {
      const res = await postChat(base, {
        messages: [hostEnv, { role: 'user', content: '讀取目前工作目錄，列出前 5 個檔案' }],
        tools,
      })
      assert.equal(res.status, 200)
      const data = await res.json()
      assert.equal(data.choices[0].finish_reason, 'tool_calls')
      assert.equal(data.choices[0].message.tool_calls[0].function.name, 'shell')
    },
  )
  assert.equal(prompts.length, 2)
  assert.match(prompts[1], /sandbox|own workspace/i)
})

test('a fake file listing that repeats is a 502, not a fake success', async () => {
  const fake = '目前工作目錄 /home/hatch，前 5 個檔案：\n\nAGENTS.md\nHEARTBEAT.md'
  await withStubbedShim(
    () => fake,
    async (base) => {
      const res = await postChat(base, {
        messages: [hostEnv, { role: 'user', content: '讀取目前工作目錄' }],
        tools,
      })
      assert.equal(res.status, 502)
      const data = await res.json()
      assert.match(data.error.message, /without requesting a tool call/i)
    },
  )
})

test('the Code Mode catalog is dropped when no tool can use it', () => {
  const catalog = {
    role: 'system',
    content: 'The Code Mode tool catalog has changed.\n\nNew tools are available:\n- browse (18 tools)',
  }
  const without = buildPrompt({
    messages: [hostEnv, catalog, { role: 'user', content: 'hi' }],
    tools,
  })
  assert.doesNotMatch(without, /Code Mode tool catalog/)

  const withBrowse = buildPrompt({
    messages: [hostEnv, catalog, { role: 'user', content: 'hi' }],
    tools: [...tools, { type: 'function', function: { name: 'browse', parameters: { type: 'object' } } }],
  })
  assert.match(withBrowse, /Code Mode tool catalog/)
})

test('the tool protocol names the host platform and forbids sandbox results', () => {
  const prompt = buildPrompt({ messages: [hostEnv, { role: 'user', content: 'list files' }], tools })
  assert.match(prompt, /sandbox/i)
  assert.match(prompt, new RegExp(`Host platform: ${process.platform}`))
})

async function postChat(base, body) {
  return fetch(base + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'muse', ...body }),
  })
}

async function withStubbedShim(reply, run) {
  const original = driver.chat
  const originalMode = process.env.MUSE_THREAD_MODE
  process.env.MUSE_THREAD_MODE = 'single'
  driver.chat = async (prompt) => ({ reply: typeof reply === 'function' ? reply(prompt) : reply })
  const { server, base } = await startTestShim(startShim)
  try {
    return await run(base)
  } finally {
    driver.chat = original
    if (originalMode === undefined) delete process.env.MUSE_THREAD_MODE
    else process.env.MUSE_THREAD_MODE = originalMode
    await closeServer(server)
  }
}
