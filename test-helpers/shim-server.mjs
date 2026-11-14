import assert from 'node:assert/strict'

/**
 * Start the shim on an ephemeral port that `fetch()` will actually accept.
 *
 * The WHATWG fetch spec blocks a list of ports (6000, 6566, 6665-6669, 6679, 10080, …)
 * and undici rejects them with the opaque `bad port` error before connecting. On this
 * Windows host the dynamic TCP range is 1024-14999 instead of the 49152+ default, so
 * `listen(0)` can hand out a blocked port and the request fails even though the server
 * is fine. Probe `/v1/models` and rebind until the port is usable.
 */
export async function startTestShim(startShim, { attempts = 5 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const server = startShim({ port: 0, host: '127.0.0.1' })
    const port = await waitForPort(server)
    const base = `http://127.0.0.1:${port}`
    try {
      const res = await fetch(base + '/v1/models')
      if (res.ok) {
        await res.arrayBuffer()
        return { server, base }
      }
      await res.arrayBuffer().catch(() => {})
    } catch {
      // Blocked port or a bind race: retry on a different port.
    }
    await closeServer(server)
  }
  assert.fail('the test shim could not open a port that fetch accepts')
}

async function waitForPort(server) {
  if (!server.listening) {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
  }
  const address = server.address()
  return address && address.port
}

export function closeServer(server) {
  return new Promise((resolve) => {
    if (!server.listening) return resolve()
    server.close(resolve)
  })
}
