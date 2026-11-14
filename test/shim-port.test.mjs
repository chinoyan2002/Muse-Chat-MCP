import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { startShim } from '../muse-openai-shim.mjs'
import { closeServer, startTestShim } from '../test-helpers/shim-server.mjs'

// Port 6566 is on the fetch spec's blocked list. On hosts whose dynamic TCP range
// starts below 6566 (observed here: 1024-14999), listen(0) can return it and every
// fetch() then fails with the opaque "bad port" error. The harness must rebind.
test('the test shim skips a port that fetch refuses', async (t) => {
  const blocked = http.createServer((req, res) => res.end('{}'))
  const bound = await new Promise((resolve) => {
    blocked.once('error', () => resolve(false))
    blocked.listen(6566, '127.0.0.1', () => resolve(true))
  })
  if (!bound) {
    t.skip('port 6566 is already in use on this host')
    return
  }

  let calls = 0
  const { server, base } = await startTestShim((options) => {
    calls += 1
    return calls === 1 ? blocked : startShim(options)
  })

  try {
    assert.equal(calls, 2, 'the blocked port should be retried exactly once')
    assert.notEqual(Number(new URL(base).port), 6566)
    const res = await fetch(base + '/v1/models')
    assert.equal(res.status, 200)
    await res.arrayBuffer()
  } finally {
    await closeServer(server)
  }
})
