import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { deriveThreadKey, extractThreadId, createThreadStore } from '../muse-thread-map.mjs'

const msg = (role, content) => ({ role, content })

test('deriveThreadKey is stable for the same opening and ignores later turns', () => {
  const a = deriveThreadKey([msg('system', 'be brief'), msg('user', 'first task'), msg('assistant', 'ok')])
  const b = deriveThreadKey([msg('system', 'be brief'), msg('user', 'first task'), msg('user', 'follow up')])
  assert.equal(a, b)
  assert.equal(typeof a, 'string')
  assert.ok(a.length >= 16)
})

test('deriveThreadKey separates different sessions', () => {
  const a = deriveThreadKey([msg('system', 'be brief'), msg('user', 'task one')])
  const b = deriveThreadKey([msg('system', 'be brief'), msg('user', 'task two')])
  assert.notEqual(a, b)
})

test('deriveThreadKey returns null without a user message', () => {
  assert.equal(deriveThreadKey([msg('system', 'only system')]), null)
  assert.equal(deriveThreadKey([]), null)
})

test('extractThreadId reads a thread uuid from a Muse url', () => {
  assert.equal(
    extractThreadId('https://muse.ai/thread/49c68c37-8346-4ac4-a6ec-18f126914e62'),
    '49c68c37-8346-4ac4-a6ec-18f126914e62',
  )
  assert.equal(extractThreadId('https://muse.ai/thread/new'), null)
  assert.equal(extractThreadId('https://muse.ai/'), null)
  assert.equal(extractThreadId(null), null)
})

test('thread store persists a mapping across instances', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-threads-'))
  const file = path.join(dir, '.muse-threads.json')
  const id = '11111111-2222-3333-4444-555555555555'

  const first = createThreadStore(file)
  first.set('key-a', id)

  const second = createThreadStore(file)
  assert.equal(second.get('key-a'), id)
  assert.equal(second.get('missing'), null)
})

test('thread store backs a corrupt file up instead of throwing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-threads-'))
  const file = path.join(dir, '.muse-threads.json')
  fs.writeFileSync(file, '{not json')

  const store = createThreadStore(file)
  assert.equal(store.get('any'), null)
  const backups = fs.readdirSync(dir).filter((f) => f.startsWith('.muse-threads.json.corrupt-'))
  assert.equal(backups.length, 1)
})
