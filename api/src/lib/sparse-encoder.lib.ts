/**
 * BM25-style sparse encoder.
 *
 * Tokenizes text into a deterministic sparse vector. Token strings are hashed
 * to uint32 indices so the vocabulary is unbounded and stable across runs.
 * Values are raw term frequencies; Qdrant computes IDF and BM25 scoring
 * server-side via the `modifier: "idf"` flag on the sparse vector config.
 *
 * Symmetric: ingest and query MUST go through this same function.
 */

export interface SparseVector {
  indices: number[]
  values: number[]
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'but',
  'by',
  'do',
  'does',
  'doing',
  'for',
  'from',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'him',
  'his',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'me',
  'my',
  'no',
  'nor',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'over',
  'own',
  'same',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'you',
  'your',
  'yours',
])

const MIN_TOKEN_LENGTH = 2
const MAX_TOKEN_LENGTH = 64
const MAX_TOKENS_PER_DOC = 4096

/**
 * djb2 + xor hash, folded to 31 bits to keep values in a safe integer range
 * Qdrant accepts. Stable across Node versions.
 */
function hashToken(token: string): number {
  let hash = 5381
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) + hash) ^ token.charCodeAt(i)
  }
  return hash >>> 1
}

/**
 * Light stemmer: strips common English suffixes. Not Porter, but enough to
 * collapse runs/running/runs into a shared root for retrieval.
 */
function stem(token: string): string {
  if (token.length < 4) return token
  for (const suffix of ['ingly', 'edly', 'ing', 'ies', 'ied', 'ed', 'ly', 'es', 's']) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      let root = token.slice(0, token.length - suffix.length)
      // Undo English consonant-doubling for -ing/-ed: 'runn' -> 'run'
      if (
        (suffix === 'ing' || suffix === 'ed' || suffix === 'edly' || suffix === 'ingly') &&
        root.length >= 4 &&
        root[root.length - 1] === root[root.length - 2] &&
        !'aeiou'.includes(root[root.length - 1])
      ) {
        root = root.slice(0, -1)
      }
      return root
    }
  }
  return token
}

/**
 * Tokenizer: lowercases, splits on non-word boundaries, keeps alphanumerics
 * and underscore. Preserves digits (case numbers, statute citations) and
 * hyphenated tokens (split into parts AND kept as compound).
 */
export function tokenize(text: string): string[] {
  if (!text) return []

  const lowered = text.toLowerCase()
  const raw: string[] = []
  let buf = ''

  for (let i = 0; i < lowered.length && raw.length < MAX_TOKENS_PER_DOC * 2; i++) {
    const ch = lowered.charCodeAt(i)
    const isWord =
      (ch >= 0x30 && ch <= 0x39) || // 0-9
      (ch >= 0x61 && ch <= 0x7a) || // a-z
      ch === 0x5f || // _
      ch === 0x2d // - (preserved within tokens)

    if (isWord) {
      buf += lowered[i]
    } else if (buf.length > 0) {
      raw.push(buf)
      buf = ''
    }
  }
  if (buf.length > 0) raw.push(buf)

  const out: string[] = []
  for (const token of raw) {
    if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) continue
    if (STOP_WORDS.has(token)) continue

    if (token.includes('-')) {
      const compound = token.replace(/-+/g, '-')
      if (compound.length >= MIN_TOKEN_LENGTH) {
        out.push(stem(compound))
      }
      for (const part of token.split('-')) {
        if (part.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(part)) {
          out.push(stem(part))
        }
      }
    } else {
      out.push(stem(token))
    }

    if (out.length >= MAX_TOKENS_PER_DOC) break
  }

  return out
}

/**
 * Encode text into a sparse vector with hashed indices and term frequencies.
 * Returns null for empty or stop-only input — callers should skip storing.
 */
export function encodeSparse(text: string): SparseVector | null {
  const tokens = tokenize(text)
  if (tokens.length === 0) return null

  const tf = new Map<number, number>()
  for (const token of tokens) {
    const idx = hashToken(token)
    tf.set(idx, (tf.get(idx) || 0) + 1)
  }

  const indices: number[] = []
  const values: number[] = []
  for (const [idx, count] of tf.entries()) {
    indices.push(idx)
    values.push(count)
  }

  return { indices, values }
}

export const __test__ = {
  hashToken,
  stem,
}
