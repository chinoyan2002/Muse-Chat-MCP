import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

// Guards the zod major upgrade: the MCP SDK must still accept the same raw shapes
// muse-server.mjs registers, and the published JSON Schema must survive the trip.
test('the MCP SDK accepts zod schemas and serves them to a client', async () => {
  const server = new McpServer({ name: 'schema-check', version: '0.0.0' })
  server.registerTool(
    'echo',
    {
      description: 'Echo text back',
      inputSchema: { text: z.string().describe('text to echo'), count: z.number().optional() },
    },
    async ({ text }) => ({ content: [{ type: 'text', text }] }),
  )

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'schema-check-client', version: '0.0.0' })
  await client.connect(clientTransport)

  try {
    const listed = await client.listTools()
    const echo = listed.tools.find((t) => t.name === 'echo')
    assert.ok(echo, 'echo tool should be listed')
    assert.equal(echo.inputSchema.properties.text.type, 'string')
    assert.deepEqual(echo.inputSchema.required, ['text'])

    const result = await client.callTool({ name: 'echo', arguments: { text: 'ok' } })
    assert.equal(result.content[0].text, 'ok')
  } finally {
    await client.close()
    await server.close()
  }
})
