import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, parseToolCalls, startShim } from '../muse-openai-shim.mjs'
import { driver } from '../muse-driver.mjs'

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

test('accepts an exact advertised tool name and object arguments', () => {
  const calls = parseToolCalls('{"tool_calls":[{"name":"shell","arguments":{"command":"Get-Location"}}]}', tools)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].function.name, 'shell')
  assert.deepEqual(JSON.parse(calls[0].function.arguments), { command: 'Get-Location' })
})

test('accepts JSON fenced tool calls', () => {
  const calls = parseToolCalls('```json\n{"tool_calls":[{"name":"shell","arguments":{"command":"pwd"}}]}\n```', tools)
  assert.equal(calls.length, 1)
})

test('rejects names that are not present in the supplied schema', () => {
  assert.equal(parseToolCalls('{"tool_calls":[{"name":"muse.shell","arguments":{"command":"pwd"}}]}', tools), null)
})

test('rejects malformed JSON arguments and missing required properties', () => {
  assert.equal(parseToolCalls('{"tool_calls":[{"name":"shell","arguments":"{bad"}]}', tools), null)
  assert.equal(parseToolCalls('{"tool_calls":[{"name":"shell","arguments":{}}]}', tools), null)
})

test('enforces a specifically selected tool', () => {
  assert.equal(parseToolCalls('{"tool_calls":[{"name":"shell","arguments":{"command":"pwd"}}]}', tools, {
    type: 'function', function: { name: 'read' },
  }), null)
})

test('includes the executed tool name and result in the next Muse prompt', () => {
  const prompt = buildPrompt({
    tools,
    messages: [
      { role: 'user', content: 'Find the project directory' },
      { role: 'assistant', tool_calls: [{ id: 'call_1', function: { name: 'shell' } }] },
      { role: 'tool', tool_call_id: 'call_1', content: 'C:\\Users\\User\\Muse-Chat-MCP' },
    ],
  })
  assert.match(prompt, /Find the project directory/)
  assert.match(prompt, /Tool name: shell/)
  assert.match(prompt, /C:\\Users\\User\\Muse-Chat-MCP/)
})

test('accepts unescaped Windows backslashes in tool arguments', () => {
  const calls = parseToolCalls(
    '{"tool_calls":[{"name":"shell","arguments":{"command":"echo C:\\Users\\User\\Muse-Chat-MCP"}}]}',
    tools,
  )
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(calls[0].function.arguments), { command: 'echo C:\\Users\\User\\Muse-Chat-MCP' })
})

test('retries once with a corrective prompt when a required property is missing', async () => {
  const readTool = {
    type: 'function',
    function: {
      name: 'read',
      description: 'Read a file from disk',
      parameters: {
        type: 'object',
        properties: { filePath: { type: 'string' } },
        required: ['filePath'],
      },
    },
  }
  const replies = [
    '{"tool_calls":[{"name":"read","arguments":{"path":"C:/package.json"}}]}',
    '{"tool_calls":[{"name":"read","arguments":{"filePath":"C:/package.json"}}]}',
  ]
  const prompts = []
  await withStubbedShim(
    (prompt) => { prompts.push(prompt); return replies[Math.min(prompts.length, replies.length) - 1] },
    async (base) => {
      const response = await fetch(base + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'muse',
          messages: [{ role: 'user', content: 'Read package.json' }],
          tools: [readTool],
        }),
      })
      const data = await response.json()
      assert.equal(data.choices[0].finish_reason, 'tool_calls')
      assert.equal(data.choices[0].message.tool_calls[0].function.name, 'read')
      assert.deepEqual(JSON.parse(data.choices[0].message.tool_calls[0].function.arguments), { filePath: 'C:/package.json' })
    },
  )
  assert.equal(prompts.length, 2)
  assert.match(prompts[1], /rejected/)
})

async function withStubbedShim(reply, run) {
  const original = driver.chat
  driver.chat = async (prompt) => ({ reply: typeof reply === 'function' ? reply(prompt) : reply })
  const server = startShim({ port: 0, host: '127.0.0.1' })
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    const address = server.address()
    return await run(`http://127.0.0.1:${address.port}`)
  } finally {
    driver.chat = original
    await new Promise((resolve) => server.close(resolve))
  }
}

test('HTTP non-stream response returns a validated OpenAI tool call', async () => {
  await withStubbedShim(
    '{"tool_calls":[{"name":"shell","arguments":{"command":"Get-Location"}}]}',
    async (base) => {
      const response = await fetch(base + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'muse',
          messages: [{ role: 'user', content: 'Where am I?' }],
          tools,
        }),
      })
      const data = await response.json()
      assert.equal(response.status, 200)
      assert.equal(data.choices[0].finish_reason, 'tool_calls')
      assert.equal(data.choices[0].message.tool_calls[0].function.name, 'shell')
    },
  )
})

test('HTTP response never forwards an unknown Muse tool name', async () => {
  await withStubbedShim(
    '{"tool_calls":[{"name":"muse.shell","arguments":{"command":"Get-Location"}}]}',
    async (base) => {
      const response = await fetch(base + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'muse',
          messages: [{ role: 'user', content: 'Where am I?' }],
          tools,
        }),
      })
      const data = await response.json()
      assert.equal(response.status, 200)
      assert.equal(data.choices[0].finish_reason, 'stop')
      assert.equal(data.choices[0].message.tool_calls, undefined)
      assert.ok(data.choices[0].message.content.includes('muse.shell'))
    },
  )
})

test('HTTP SSE response emits OpenAI tool_calls and the matching finish reason', async () => {
  await withStubbedShim(
    '{"tool_calls":[{"name":"shell","arguments":{"command":"Get-Location"}}]}',
    async (base) => {
      const response = await fetch(base + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'muse',
          stream: true,
          messages: [{ role: 'user', content: 'Where am I?' }],
          tools,
        }),
      })
      const body = await response.text()
      assert.equal(response.status, 200)
      assert.match(body, /"name":"shell"/)
      assert.match(body, /"finish_reason":"tool_calls"/)
      assert.ok(body.includes('data: [DONE]'))
    },
  )
})
