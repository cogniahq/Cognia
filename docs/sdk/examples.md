# Examples

End-to-end snippets for common integrations.

## Slack bot — answer questions from your team's docs

```ts
import { App } from '@slack/bolt'
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({ apiKey: process.env.COGNIA_API_KEY! })

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
})

app.event('app_mention', async ({ event, say }) => {
  const query = event.text.replace(/<@\w+>/, '').trim()
  const hits = await cognia.search.query({ query, limit: 5 })

  if (hits.length === 0) {
    await say(`I couldn't find anything for "${query}".`)
    return
  }

  const lines = hits.map((hit, idx) => {
    const source = hit.document?.name
      ? `${hit.document.name}${hit.document.page_number ? ` (p.${hit.document.page_number})` : ''}`
      : hit.title || 'memory'
    return `${idx + 1}. *${source}* — ${hit.snippet}`
  })

  await say(lines.join('\n'))
})

await app.start(3000)
```

## CLI — Cmd-K style search

```ts
#!/usr/bin/env node
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({ apiKey: process.env.COGNIA_API_KEY! })
const query = process.argv.slice(2).join(' ')

if (!query) {
  console.error('usage: cognia <query>')
  process.exit(1)
}

const hits = await cognia.search.query({ query, limit: 10 })
for (const hit of hits) {
  console.log(`${hit.score?.toFixed(2) ?? '   '}  ${hit.title ?? hit.id}`)
  console.log(`        ${hit.snippet.slice(0, 120)}…`)
  if (hit.url) console.log(`        ${hit.url}`)
  console.log()
}
```

## Cloudflare Worker — search endpoint

```ts
import { CogniaClient } from '@cogniahq/sdk'

interface Env { COGNIA_API_KEY: string }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const q = url.searchParams.get('q')
    if (!q) return new Response('q required', { status: 400 })

    const cognia = new CogniaClient({
      apiKey: env.COGNIA_API_KEY,
      fetch: globalThis.fetch,
    })
    const hits = await cognia.search.query({ query: q, limit: 10 })
    return Response.json({ hits })
  },
}
```

## Backfill all memories nightly to a search index

```ts
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({ apiKey: process.env.COGNIA_API_KEY! })

let processed = 0
for await (const memory of cognia.memories.iterate()) {
  await indexInElastic(memory)  // your code
  processed++
  if (processed % 100 === 0) console.log(`processed ${processed}`)
}
```

## Retrieval-augmented Claude prompt

```ts
import Anthropic from '@anthropic-ai/sdk'
import { CogniaClient } from '@cogniahq/sdk'

const cognia = new CogniaClient({ apiKey: process.env.COGNIA_API_KEY! })
const claude = new Anthropic()

async function answer(userQuery: string): Promise<string> {
  const hits = await cognia.search.query({ query: userQuery, limit: 8 })

  const context = hits
    .map((hit, idx) => `[${idx + 1}] ${hit.title ?? 'memory'}\n${hit.snippet}`)
    .join('\n\n')

  const response = await claude.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Answer the question using ONLY the citations below. Cite as [1], [2].\n\nCitations:\n${context}\n\nQuestion: ${userQuery}`,
      },
    ],
  })

  const block = response.content[0]
  return block?.type === 'text' ? block.text : ''
}
```
