import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { encodeSparse, tokenize, __test__ } from './sparse-encoder.lib'

test('tokenize lowercases, drops stopwords, stems plurals', () => {
  const tokens = tokenize('The quick BROWN foxes jumping over running dogs')
  assert.ok(tokens.includes('quick'))
  assert.ok(tokens.includes('brown'))
  assert.ok(tokens.includes('fox'))
  assert.ok(tokens.includes('jump'))
  assert.ok(tokens.includes('run'))
  assert.ok(tokens.includes('dog'))
  assert.ok(!tokens.includes('the'))
  assert.ok(!tokens.includes('over'))
})

test('tokenize preserves alphanumerics like statute citations', () => {
  const tokens = tokenize('Section 230 and 18 U.S.C. § 1030(a)')
  assert.ok(tokens.includes('section'))
  assert.ok(tokens.includes('230'))
  assert.ok(tokens.includes('1030'))
})

test('tokenize emits both compound and parts of hyphenated words', () => {
  const tokens = tokenize('memory-mesh prototype')
  assert.ok(tokens.includes('memory-mesh'))
  assert.ok(tokens.includes('memory'))
  assert.ok(tokens.includes('mesh'))
})

test('encodeSparse returns null for empty input', () => {
  assert.equal(encodeSparse(''), null)
  assert.equal(encodeSparse('   '), null)
  assert.equal(encodeSparse('the and of'), null)
})

test('encodeSparse aggregates duplicate token frequencies', () => {
  const out = encodeSparse('cat cat cat dog')
  assert.ok(out !== null)
  assert.equal(out!.indices.length, 2)
  const map = new Map(out!.indices.map((idx, i) => [idx, out!.values[i]]))
  const catIdx = __test__.hashToken('cat')
  const dogIdx = __test__.hashToken('dog')
  assert.equal(map.get(catIdx), 3)
  assert.equal(map.get(dogIdx), 1)
})

test('encodeSparse is symmetric for identical content', () => {
  const a = encodeSparse('Production-grade hybrid retrieval')
  const b = encodeSparse('Production-grade hybrid retrieval')
  assert.deepEqual(a, b)
})

test('hashToken yields non-negative 31-bit integers', () => {
  for (const t of ['cat', 'CAT', 'apple', 'apple-pie', 'memory_mesh', '1030']) {
    const h = __test__.hashToken(t)
    assert.ok(Number.isInteger(h))
    assert.ok(h >= 0)
    assert.ok(h <= 0x7fffffff)
  }
})
