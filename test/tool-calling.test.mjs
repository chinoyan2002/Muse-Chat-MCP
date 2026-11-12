import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, parseToolCalls } from '../muse-openai-shim.mjs'

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
