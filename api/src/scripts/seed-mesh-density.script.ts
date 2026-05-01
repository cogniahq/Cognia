/**
 * Seeds ~500 additional memories around the Polaris narrative to make the
 * memory-mesh visualization feel like a real team's knowledge base accumulated
 * over months. Memories cluster across topics so the mesh shows
 * interconnected dots, not isolated points.
 *
 * Idempotent: deletes everything tagged `mesh-density` before re-inserting.
 *
 * Prereq: Blit Labs org + alex/sarah/bob users exist (run seed:polaris first).
 *
 * Usage:
 *   npm run seed:mesh
 */
import { prisma } from '../lib/prisma.lib'
import { memoryMeshService } from '../services/memory/memory-mesh.service'
import { logger } from '../utils/core/logger.util'

const ORG_SLUG = 'blit-labs'
const TAG = 'mesh-density'

type Owner = 'alex' | 'sarah' | 'bob'
type Source = 'slack' | 'notion' | 'google_docs' | 'github' | 'linear' | 'gmail' | 'loom' | 'web'

interface MemoryDef {
  title: string
  content: string
  owner: Owner
  source: Source
  daysAgo: number
  topics: string[]
  url?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
const rand = (lo: number, hi: number, salt: number): number =>
  lo + ((salt * 9301 + 49297) % (hi - lo + 1))

const OWNERS_WEIGHTED: Owner[] = ['alex', 'alex', 'sarah', 'sarah', 'sarah', 'bob', 'bob', 'bob']
const ownerFor = (i: number): Owner => OWNERS_WEIGHTED[i % OWNERS_WEIGHTED.length]

// ── Cluster 1: Polaris technical deep-dives (50) ───────────────────────────
const POLARIS_TECH: MemoryDef[] = (() => {
  const out: MemoryDef[] = []
  const items: Array<{ t: string; c: string; src: Source; topics: string[] }> = [
    {
      t: 'Y.js memory leak when many docs opened simultaneously',
      c: 'Reproduces with 50+ concurrent Y.Doc instances. Each retains undo-stack history forever. Fix: GC undo-stacks older than 5 minutes. Patch ready, awaiting review.',
      src: 'github',
      topics: ['polaris', 'yjs', 'memory-leak', 'performance'],
    },
    {
      t: 'Slack: should we add a presence indicator for inactive cursors?',
      c: 'UX feedback from beta — when a user is idle for 30s, their cursor should fade. Sarah: yes. Bob: trivial CSS animation. Filed POLARIS-37.',
      src: 'slack',
      topics: ['polaris', 'presence', 'ux', 'cursor'],
    },
    {
      t: 'CRDT op-size profiling at p99',
      c: 'Average op is 280 bytes. p99 is 4.2KB (large paste operations). Network breaks at ~8KB op size on flaky 4G connections. Need chunking strategy.',
      src: 'notion',
      topics: ['polaris', 'crdt', 'performance', 'network'],
    },
    {
      t: 'GitHub PR #501 — chunked CRDT op transport',
      c: 'Splits ops > 4KB into chunks. Each chunk gets a sequence number and parent hash. Reassembled on receiver. Reviewer: Sarah. 8 review iterations.',
      src: 'github',
      topics: ['polaris', 'crdt', 'transport', 'pr'],
    },
    {
      t: "Why we didn't use Liveblocks for cursors specifically",
      c: 'Considered using Liveblocks JUST for cursor sync (not full CRDT). Cost: $3k/mo at our MAU. We can build it on the same WS as our CRDT. Decision: build.',
      src: 'notion',
      topics: ['polaris', 'liveblocks', 'cursor', 'build-vs-buy'],
    },
    {
      t: 'WebSocket reconnect storm after deploy',
      c: "When we deploy api, all WS connections drop simultaneously, then reconnect in <1s. Server can't handle 600 simultaneous handshakes. Solution: jittered reconnect (0-5s).",
      src: 'github',
      topics: ['polaris', 'websocket', 'reconnect', 'deploy'],
    },
    {
      t: 'Loom: deep dive on awareness protocol',
      c: '14-min recording. How Y.js awareness works under the hood, why we built our own selection layer on top, edge cases around cursor positioning during scroll.',
      src: 'loom',
      topics: ['polaris', 'yjs', 'awareness', 'walkthrough'],
    },
    {
      t: 'POLARIS-12: handle browser tab freeze during long edits',
      c: 'Chrome throttles inactive tabs. Y.js sync stalls. When tab becomes active again, sync flood lags UI. Fix: pause/resume awareness on visibilitychange.',
      src: 'linear',
      topics: ['polaris', 'browser', 'performance', 'chrome'],
    },
    {
      t: 'Notion: undo/redo across users — impossible by design?',
      c: 'Per CRDT theory, "undo my last action" is well-defined; "undo across users" is not. Decision: scope undo to per-user. Document it.',
      src: 'notion',
      topics: ['polaris', 'crdt', 'undo', 'design'],
    },
    {
      t: 'Slack thread: nested groups breaking selection',
      c: 'When 2 users select a group containing nested groups, the visual selection box overlaps weirdly. Sarah debugging — looks like a transform-stacking issue.',
      src: 'slack',
      topics: ['polaris', 'selection', 'frontend', 'bug'],
    },
    {
      t: 'POLARIS-19: deduplicate cursor moves at 60Hz',
      c: 'Mouse-move fires every ~16ms. We were broadcasting all of them. Now: throttle to 30Hz on send, interpolate on receive. Network traffic dropped 50%.',
      src: 'linear',
      topics: ['polaris', 'cursor', 'performance', 'optimization'],
    },
    {
      t: 'Code review notes — PR #487 server persistence',
      c: "Sarah's comments: (1) snapshot interval should be config, (2) what happens if Postgres slow down? (3) need a metric for snapshot lag. All addressed before merge.",
      src: 'github',
      topics: ['polaris', 'code-review', 'persistence', 'postgres'],
    },
    {
      t: 'Google Doc: Polaris non-goals',
      c: "Things we are explicitly NOT building: (1) voice/video, (2) persistent comments, (3) version history with named branches, (4) operational transform fallback. Saved here so we don't re-debate.",
      src: 'google_docs',
      topics: ['polaris', 'scope', 'non-goals'],
    },
    {
      t: 'Slack: Sarah\'s "ya know what would be cool" thread on collab AI',
      c: 'Fun thread — what if when 2 users edit the same doc, we ran a diff-summary AI in the background? Bob: yes but not now. Sarah: filed as POLARIS-future-1.',
      src: 'slack',
      topics: ['polaris', 'ai', 'future', 'collab'],
    },
    {
      t: 'GitHub Issue #555 — race condition on simultaneous create+delete',
      c: "If user A creates a layer and user B deletes its parent at the same instant, the layer becomes orphaned. Y.js doesn't catch it. Need integrity check.",
      src: 'github',
      topics: ['polaris', 'crdt', 'race-condition', 'bug'],
    },
    {
      t: 'Notion: snapshot encoding format v2',
      c: 'v1 was Y.update binary blob, easy but opaque. v2 includes metadata (timestamp, user, op-count). Easier debugging. Migration: lazy on next snapshot.',
      src: 'notion',
      topics: ['polaris', 'snapshot', 'format', 'migration'],
    },
    {
      t: 'Slack: beta user reports lag on Edge browser',
      c: "Edge's WebSocket implementation has a 64KB buffer limit. We exceed it on large initial-load. Need to chunk initial state too.",
      src: 'slack',
      topics: ['polaris', 'edge', 'websocket', 'browser-compat'],
    },
    {
      t: 'POLARIS-31: collab rate-limit per workspace',
      c: 'Customer worry: what if a user spams 1000 edits/sec to brick others? Add per-user rate limit at the WS gateway. 100 ops/sec ceiling. Beyond: drop with warning.',
      src: 'linear',
      topics: ['polaris', 'rate-limit', 'abuse', 'security'],
    },
    {
      t: 'GitHub Discussion: Y.js v14 upgrade plan',
      c: 'Y.js v14 changes XmlFragment behavior slightly — our patch needs adjustment. Plan: pin to v13 for GA, upgrade in v1.1 release.',
      src: 'github',
      topics: ['polaris', 'yjs', 'upgrade', 'versioning'],
    },
    {
      t: 'Notion: write-up on conflict-resolution philosophy',
      c: 'Internal explainer of why CRDT "last writer wins on byte-level" is fine for our use case but problematic in legal/medical. Sets context for future verticals.',
      src: 'notion',
      topics: ['polaris', 'crdt', 'philosophy', 'design'],
    },
    {
      t: 'Loom: cursor latency demo at 200 users',
      c: 'Screen recording showing the demo canvas with 200 simulated cursors. Latency stays under 100ms throughout. Bob narrates the architecture.',
      src: 'loom',
      topics: ['polaris', 'demo', 'performance', 'cursor'],
    },
    {
      t: 'Slack: when to break out the Polaris service into its own repo?',
      c: 'Bob: code is ~8k LOC now, mixing well with main canvas codebase. Sarah: keep it monorepo for now, split when we have a 2nd realtime feature.',
      src: 'slack',
      topics: ['polaris', 'architecture', 'monorepo'],
    },
    {
      t: 'POLARIS-44: handle tab-killed-during-edit case',
      c: 'User edits, browser kills tab (OOM). Their offline state is lost. Possible fix: persist to IndexedDB every 30s. Trade-off: storage and battery.',
      src: 'linear',
      topics: ['polaris', 'edge-case', 'offline', 'persistence'],
    },
    {
      t: 'GitHub PR #523 — fix selection-flicker on Safari',
      c: "Bob's patch from his last day. Tests pass on Chrome+Firefox. Safari intermittent failure root-caused to event ordering. Fix: requestAnimationFrame wrapper.",
      src: 'github',
      topics: ['polaris', 'safari', 'bug', 'pr'],
    },
    {
      t: 'Notion: post-incident review — May 12 outage',
      c: 'WS gateway crashed during deploy because of unbounded reconnect storm. Lasted 4 minutes. Lessons: jittered reconnect, deploy windows, alerting.',
      src: 'notion',
      topics: ['polaris', 'incident', 'postmortem', 'deploy'],
    },
    {
      t: 'Slack: integrating Polaris with our extension',
      c: 'Question: should the Cognia browser extension also support realtime collab? Out of scope for now. Filed as future exploration.',
      src: 'slack',
      topics: ['polaris', 'extension', 'future'],
    },
    {
      t: 'Notion: Polaris pricing tier discussion',
      c: 'Should realtime collab be a paid add-on, included in Team tier, or Enterprise-only? Sales says Team to drive upgrades. Eng says no per-feature pricing.',
      src: 'notion',
      topics: ['polaris', 'pricing', 'product', 'business'],
    },
    {
      t: 'GitHub Issue #588 — cursor color collision at 50+ users',
      c: 'We pick cursor colors from a 24-color palette. At 50 users, collisions are ugly. Switch to HSL with golden-angle for unique colors.',
      src: 'github',
      topics: ['polaris', 'cursor', 'ux', 'color'],
    },
    {
      t: 'POLARIS-57: stale ws connections after laptop sleep',
      c: "When laptop sleeps + wakes, WebSocket may be in zombie state — connection thinks it's alive but server has dropped it. Add explicit ping/pong with 30s timeout.",
      src: 'linear',
      topics: ['polaris', 'websocket', 'sleep', 'heartbeat'],
    },
    {
      t: 'Slack: should we open-source the Y.js patch?',
      c: 'Our XmlFragment patch is generic. Bob suggested upstream. Sarah: yes, but maintain a fork until v15 lands.',
      src: 'slack',
      topics: ['polaris', 'open-source', 'yjs', 'community'],
    },
    {
      t: 'Notion: ARCHIVE — old OT prototype notes',
      c: "Before we picked CRDT, we spent 3 days on an OT prototype. Notes here for historical context. Don't resurrect.",
      src: 'notion',
      topics: ['polaris', 'ot', 'archive', 'history'],
    },
    {
      t: 'GitHub PR #612 — move snapshot encoding to worker thread',
      c: "Sarah's PR. Moves CRDT encoding off main loop. Eliminates the 300ms input-lag spikes at >200 users. Tests pass. Merged.",
      src: 'github',
      topics: ['polaris', 'performance', 'worker-thread', 'pr'],
    },
    {
      t: 'Loom: customer call walkthrough (Acme leadership)',
      c: "32-min demo to Acme's VP Engineering. Shows full collab flow, our scaling story, audit log integration. They committed to GA contract on this call.",
      src: 'loom',
      topics: ['polaris', 'customer', 'acme', 'demo'],
    },
    {
      t: 'Linear epic: POLARIS-GA — release checklist',
      c: 'Master list of GA blockers. 47 items. 31 done. Critical path: sharding, selection-flicker (now fixed), POLARIS-23 (offline). ETA: May 30.',
      src: 'linear',
      topics: ['polaris', 'ga', 'epic', 'checklist'],
    },
    {
      t: "Slack: Sarah's farewell — technical handoff thread",
      c: "Sarah's final pinned message in #eng-realtime. Links to all the docs, names the people who own each piece, expectations for the new hire.",
      src: 'slack',
      topics: ['polaris', 'handoff', 'sarah', 'departure'],
    },
    {
      t: 'Google Doc: customer success — Acme rollout plan',
      c: 'Phased rollout for Acme: pilot 14 users → expansion 50 → company-wide 600. Each phase has success criteria. Joint plan with their internal champion.',
      src: 'google_docs',
      topics: ['polaris', 'acme', 'rollout', 'customer-success'],
    },
    {
      t: 'Notion: Polaris vs Figma multiplayer comparison',
      c: "Honest comparison: Figma's multiplayer is the gold standard. We match on cursor latency. They're ahead on offline (their syncgraph is more sophisticated). Multi-year gap.",
      src: 'notion',
      topics: ['polaris', 'figma', 'competitive', 'analysis'],
    },
    {
      t: 'Slack: rate limiting bot for stress testing',
      c: 'Bob built a k6-based stress bot. Spawns N simulated users, each making M ops/sec. Used for the 1000-user perf test. Repo: blitlabs/polaris-stress.',
      src: 'slack',
      topics: ['polaris', 'stress-test', 'tooling', 'k6'],
    },
    {
      t: "GitHub Issue #634 — mobile Safari can't join sessions",
      c: "iOS Safari's ServiceWorker has weird WS behavior. Connection stalls after 30s idle. Need a different strategy on mobile.",
      src: 'github',
      topics: ['polaris', 'mobile', 'safari', 'bug'],
    },
    {
      t: 'POLARIS-66: persist user palette preference',
      c: 'Each user picks a cursor color. Currently re-randomized on each session. Persist preference in user_preferences table.',
      src: 'linear',
      topics: ['polaris', 'user-pref', 'cursor', 'color'],
    },
    {
      t: 'Slack: dogfood week findings',
      c: 'Internal team used Polaris for all canvas docs for 1 week. Pain points: (1) cursors hard to see on white bg, (2) join-link UX confusing. Both on backlog.',
      src: 'slack',
      topics: ['polaris', 'dogfood', 'feedback', 'ux'],
    },
    {
      t: 'Notion: API design for Polaris webhooks',
      c: 'External integrations want to know when a doc is edited. Webhook event: `document.edited` with diff summary. Throttled to once per 60s per doc.',
      src: 'notion',
      topics: ['polaris', 'webhook', 'api', 'integration'],
    },
    {
      t: 'Loom: how presence avatars work',
      c: '8-min internal explainer. Avatar position derived from cursor pos + viewport. Color from user palette. Hide-on-idle logic.',
      src: 'loom',
      topics: ['polaris', 'presence', 'avatar', 'frontend'],
    },
    {
      t: 'GitHub Discussion: should we GA without offline?',
      c: 'POLARIS-23 (offline) is unresolved. Could we GA without it? Acme says no. Other beta customers say yes. Decision: ship without; backport in v1.1.',
      src: 'github',
      topics: ['polaris', 'ga', 'offline', 'decision'],
    },
    {
      t: 'Slack: discovered that Notion has lower CRDT latency than us',
      c: 'We benchmarked Notion vs us at 100 users editing the same doc. Notion: 35ms median. Us: 48ms. Investigate their server topology.',
      src: 'slack',
      topics: ['polaris', 'competitive', 'notion', 'latency'],
    },
    {
      t: 'Notion: Polaris error budget for Q2',
      c: 'Allocated error budget: 0.1% of edit operations may fail or be delayed > 1s. Reset quarterly. Tracking in Grafana.',
      src: 'notion',
      topics: ['polaris', 'sre', 'error-budget', 'sli'],
    },
    {
      t: 'Linear: POLARIS-78 — encrypted doc state at rest',
      c: 'Compliance ask from healthcare prospect: CRDT state in postgres should be encrypted column-level. Investigate pgcrypto vs app-level.',
      src: 'linear',
      topics: ['polaris', 'encryption', 'compliance', 'postgres'],
    },
    {
      t: 'Slack: lunch debate — should ops be reversible?',
      c: 'Heated debate over lunch about whether all CRDT ops should support inverse-op for undo. Bob: yes, theoretical purity. Sarah: no, complexity. Tabled.',
      src: 'slack',
      topics: ['polaris', 'crdt', 'undo', 'debate'],
    },
    {
      t: 'GitHub PR #678 — improve sharding with consistent hashing',
      c: "Bob's draft PR (incomplete). Replaces modulo-shard with consistent hashing for less reshuffling on shard add/remove. Tests broken on his last day.",
      src: 'github',
      topics: ['polaris', 'sharding', 'consistent-hashing', 'pr'],
    },
    {
      t: 'Notion: writing the Polaris docs site',
      c: 'Plan for public-facing docs: getting started, integration guide, API reference, troubleshooting. Aim for launch with GA.',
      src: 'notion',
      topics: ['polaris', 'docs', 'launch', 'marketing'],
    },
    {
      t: 'Slack: post-Sarah handoff retrospective',
      c: "Team retro 1 week after Sarah left. What went well: handoff doc was thorough. What broke: nobody had Bob's Notion access until day 3. Action: deploy access protocols.",
      src: 'slack',
      topics: ['polaris', 'retrospective', 'handoff', 'process'],
    },
  ]
  items.forEach((it, i) => {
    out.push({
      title: it.t,
      content: it.c,
      owner: ownerFor(i),
      source: it.src,
      daysAgo: rand(20, 180, i + 1),
      topics: it.topics,
    })
  })
  return out
})()

// ── Cluster 2: Customer interactions (80) ──────────────────────────────────
const CUSTOMERS: MemoryDef[] = (() => {
  const out: MemoryDef[] = []
  const customers = [
    'Acme',
    'Northwind',
    'Globex',
    'Initech',
    'Hooli',
    'Pied Piper',
    'Stark Industries',
    'Wayne Enterprises',
  ]
  const interactionTypes = [
    { t: 'kickoff call', topic: 'kickoff' },
    { t: 'product demo', topic: 'demo' },
    { t: 'follow-up email', topic: 'followup' },
    { t: 'feature request', topic: 'feature-request' },
    { t: 'support ticket', topic: 'support' },
    { t: 'expansion conversation', topic: 'expansion' },
    { t: 'churn risk discussion', topic: 'retention' },
    { t: 'reference call', topic: 'reference' },
    { t: 'security review', topic: 'security' },
    { t: 'pricing negotiation', topic: 'pricing' },
  ]
  let idx = 0
  for (const c of customers) {
    for (const inter of interactionTypes) {
      const src: Source =
        inter.topic === 'support' || inter.topic === 'feature-request'
          ? 'gmail'
          : (['google_docs', 'notion', 'slack', 'gmail'][idx % 4] as Source)
      out.push({
        title: `${c} — ${inter.t} (${['Q1', 'Q2', 'Q3', 'Q4'][idx % 4]})`,
        content: `Notes from ${inter.t} with ${c}. Discussed: usage growth (currently ${20 + ((idx * 7) % 80)} active users), key blockers (${['scaling', 'SSO', 'reporting', 'integrations', 'API limits'][idx % 5]}), and next milestones. Sentiment: ${['positive', 'positive', 'neutral', 'positive', 'enthusiastic'][idx % 5]}. Action items: ${idx % 3 === 0 ? 'follow up next week' : 'wait for product update'}.`,
        owner: ownerFor(idx),
        source: src,
        daysAgo: rand(5, 200, idx + 100),
        topics: ['customer', c.toLowerCase().replace(/[^a-z]/g, '-'), inter.topic, 'sales'],
      })
      idx++
    }
  }
  return out
})()

// ── Cluster 3: Hiring & people (50) ────────────────────────────────────────
const HIRING: MemoryDef[] = (() => {
  const out: MemoryDef[] = []
  const candidates = [
    'Priya M.',
    'James K.',
    'Aditi S.',
    'Marco F.',
    'Eleanor C.',
    'Rohan G.',
    'Yuki T.',
    'David L.',
    'Nina W.',
    'Ahmed B.',
  ]
  const stages = [
    'phone screen',
    'technical interview',
    'system design',
    'cultural fit',
    'reference check',
  ]
  let idx = 0
  for (const cand of candidates) {
    for (const stage of stages) {
      out.push({
        title: `${cand} — ${stage} notes`,
        content: `${stage} for senior engineer role with ${cand}. Strong on ${['system design', 'async patterns', 'TypeScript', 'data modeling', 'distributed systems'][idx % 5]}. Concerns: ${['communication style', 'depth in CRDTs', 'timezone overlap', 'team fit', 'salary expectation'][idx % 5]}. Recommendation: ${['advance', 'advance', 'hold', 'advance', 'no hire'][idx % 5]}.`,
        owner: ownerFor(idx),
        source: idx % 3 === 0 ? 'notion' : 'google_docs',
        daysAgo: rand(15, 90, idx + 200),
        topics: ['hiring', 'engineering-hire', stage.replace(/ /g, '-'), 'people-ops'],
      })
      idx++
    }
  }
  return out
})()

// ── Cluster 4: OKRs and strategy (40) ──────────────────────────────────────
const STRATEGY: MemoryDef[] = (() => {
  const out: MemoryDef[] = []
  const items: Array<{ t: string; c: string; src: Source; topics: string[] }> = [
    {
      t: 'Q2 OKRs — Engineering',
      c: 'O1: Ship Polaris GA by May 30 (3 KRs). O2: Reduce p99 search latency by 30%. O3: Hire 2 senior engineers.',
      src: 'notion',
      topics: ['okrs', 'engineering', 'q2', 'planning'],
    },
    {
      t: 'Q2 OKRs — Sales',
      c: 'O1: Close 3 enterprise contracts ($150k+ ACV). O2: Drive net retention to 115%. O3: Build a partner channel.',
      src: 'notion',
      topics: ['okrs', 'sales', 'q2', 'planning'],
    },
    {
      t: 'Q2 OKRs — Product',
      c: 'O1: Polaris GA + 5 customer wins. O2: 4 new integrations live. O3: NPS > 40.',
      src: 'notion',
      topics: ['okrs', 'product', 'q2', 'planning'],
    },
    {
      t: 'Competitive analysis: Notion AI',
      c: 'Notion AI is now the dominant team-wiki+AI player. Our moat: search across all sources, not just Notion. Defensible if we ship integrations fast.',
      src: 'notion',
      topics: ['competitive', 'notion', 'strategy', 'ai'],
    },
    {
      t: 'Competitive analysis: Glean',
      c: 'Glean is enterprise search with $260M raised. Targets >1k employee companies. We are bottom-up, smaller teams. Different ICP, less direct competition.',
      src: 'notion',
      topics: ['competitive', 'glean', 'strategy', 'enterprise'],
    },
    {
      t: 'Pricing experiment results — Q1',
      c: 'Tested $20 vs $30 vs $45/seat for Team plan. $30 had highest LTV. $45 had higher conversion but worse retention. Settling on $30.',
      src: 'google_docs',
      topics: ['pricing', 'experiment', 'data', 'q1'],
    },
    {
      t: 'All-hands deck — March',
      c: 'Slides for monthly all-hands. Topics: Polaris progress, customer wins (Acme!), hiring updates, runway.',
      src: 'google_docs',
      topics: ['all-hands', 'company', 'march', 'slides'],
    },
    {
      t: 'Roadmap planning meeting',
      c: 'Meeting notes from quarterly roadmap review. Decided to deprioritize the AI-suggestions feature in favor of Polaris GA. Pushback from sales but eng prevailed.',
      src: 'notion',
      topics: ['roadmap', 'planning', 'prioritization'],
    },
    {
      t: 'Customer advisory board — recap',
      c: 'Met with 6 enterprise customers. Top asks: SOC 2, custom RBAC, data residency. We have all 3 on roadmap. Reassured them.',
      src: 'notion',
      topics: ['customer', 'advisory', 'enterprise', 'feedback'],
    },
    {
      t: 'Series A planning',
      c: 'Targeting Series A close by Q3. Need: 12 months of runway buffer post-close, $5M+ ARR run rate, 120% NRR. On track for 2 of 3.',
      src: 'google_docs',
      topics: ['fundraising', 'series-a', 'strategy'],
    },
    {
      t: 'Investor update — March',
      c: 'Monthly investor email. ARR $3.2M (+18% MoM). Polaris in beta with 3 customers. 2 senior eng candidates in pipeline. Burn at $200k/mo.',
      src: 'gmail',
      topics: ['investor', 'update', 'metrics', 'monthly'],
    },
    {
      t: 'Marketing: Polaris launch plan',
      c: 'Coordinated launch campaign for Polaris GA: blog post, demo video, Hacker News submission, customer case study, partner co-marketing.',
      src: 'notion',
      topics: ['marketing', 'launch', 'polaris', 'plan'],
    },
    {
      t: 'Brand refresh — discussion',
      c: 'Considering a brand refresh ahead of Series A. Logo feels dated. New visual identity by mid-Q3. Designer: Linear-acquired Margherita.',
      src: 'notion',
      topics: ['brand', 'design', 'refresh'],
    },
    {
      t: 'Sales pipeline review — week 18',
      c: 'Pipeline: $1.8M qualified opportunities. Top 3: Acme ($240k), Northwind ($90k), Globex ($60k). Win rate 28%, up from 22% last quarter.',
      src: 'google_docs',
      topics: ['sales', 'pipeline', 'metrics', 'revenue'],
    },
    {
      t: 'Hiring plan Q3',
      c: 'Adding 4 hires in Q3: 2 senior eng (one to replace Sarah), 1 designer, 1 customer success. Recruiter: Justfocus.',
      src: 'notion',
      topics: ['hiring', 'plan', 'q3', 'headcount'],
    },
    {
      t: 'Retention analysis — March cohort',
      c: 'March 2025 cohort: 92% retained at 60 days, 81% at 90 days. Better than Feb (78% at 90d). New onboarding flow is working.',
      src: 'google_docs',
      topics: ['retention', 'cohort', 'analytics', 'onboarding'],
    },
    {
      t: 'Burn rate analysis',
      c: "Current burn: $200k/mo. Runway: 18 months. Need to maintain or reduce; eng/people are the levers. Sarah's departure helps short-term, hurts mid-term.",
      src: 'google_docs',
      topics: ['burn', 'finance', 'runway', 'planning'],
    },
    {
      t: 'Annual planning offsite — agenda',
      c: 'Two-day offsite. Day 1: 2026 strategy, 5-year vision. Day 2: org design, OKRs, hiring plan. Location: Bandra rooftop.',
      src: 'notion',
      topics: ['offsite', 'planning', 'strategy', 'annual'],
    },
    {
      t: 'OKRs retro — Q1 results',
      c: 'Q1 OKR retro: 7/12 KRs hit, 3 missed, 2 punted. Engineering hit 4/4. Sales hit 1/3 (missed enterprise close target). Product hit 2/3.',
      src: 'notion',
      topics: ['okrs', 'retro', 'q1', 'metrics'],
    },
    {
      t: 'Vision doc — 5-year',
      c: 'Where Cognia goes by 2030: 100k+ active orgs, every AI assistant integrates with us, $50M+ ARR, IPO-track or strategic acquirer.',
      src: 'notion',
      topics: ['vision', 'strategy', '5-year', 'company'],
    },
  ]
  for (let pass = 0; pass < 2; pass++) {
    items.forEach((it, i) => {
      out.push({
        title: pass === 0 ? it.t : `${it.t} (revisit)`,
        content: it.c,
        owner: ownerFor(i + pass * 7),
        source: it.src,
        daysAgo: rand(10, 250, i + pass * 100 + 300),
        topics: it.topics,
      })
    })
  }
  return out.slice(0, 40)
})()

// ── Cluster 5: Engineering general (100) ───────────────────────────────────
const ENG_GENERAL: MemoryDef[] = (() => {
  const out: MemoryDef[] = []
  const items: Array<{ t: string; topics: string[] }> = [
    {
      t: 'Postgres connection pool exhausted at peak',
      topics: ['postgres', 'performance', 'incident'],
    },
    { t: 'Retry-with-backoff helper module', topics: ['utility', 'retry', 'library'] },
    { t: 'Rate limiting strategy: token bucket vs leaky bucket', topics: ['rate-limit', 'design'] },
    { t: 'Why we chose Vitest over Jest', topics: ['testing', 'vitest', 'tooling'] },
    { t: 'Migrating from Stripe to Razorpay', topics: ['billing', 'migration', 'razorpay'] },
    { t: 'OpenAI API: prompt caching savings analysis', topics: ['openai', 'caching', 'cost'] },
    { t: 'BullMQ: handling stalled jobs', topics: ['bullmq', 'queue', 'reliability'] },
    { t: 'Prisma query plan analysis', topics: ['prisma', 'postgres', 'query'] },
    { t: 'OAuth refresh token rotation strategy', topics: ['oauth', 'security', 'tokens'] },
    { t: 'When to use Server-Sent Events vs WebSockets', topics: ['sse', 'websocket', 'design'] },
    {
      t: 'Postgres LISTEN/NOTIFY for cache invalidation',
      topics: ['postgres', 'caching', 'realtime'],
    },
    { t: 'Docker layer caching wins', topics: ['docker', 'build', 'optimization'] },
    { t: 'Vercel Edge Functions experiments', topics: ['vercel', 'edge', 'serverless'] },
    { t: 'Claude vs GPT-4o for our synthesis workload', topics: ['ai', 'llm', 'evaluation'] },
    { t: 'How we test against Qdrant in unit tests', topics: ['testing', 'qdrant', 'mocking'] },
    { t: 'Git worktree workflow for parallel reviews', topics: ['git', 'workflow', 'tooling'] },
    {
      t: 'TypeScript strict mode migration progress',
      topics: ['typescript', 'strict', 'migration'],
    },
    { t: 'Logger structured output for Datadog', topics: ['logging', 'datadog', 'observability'] },
    { t: 'Pagination: cursor-based vs offset', topics: ['pagination', 'api', 'design'] },
    { t: 'Why our OpenAPI spec is hand-written', topics: ['openapi', 'documentation', 'api'] },
    {
      t: 'Optimizing Prisma includes for memory list',
      topics: ['prisma', 'performance', 'postgres'],
    },
    {
      t: 'CI parallelization: 4 minutes -> 90 seconds',
      topics: ['ci', 'optimization', 'github-actions'],
    },
    { t: 'Adding Sentry for error tracking', topics: ['sentry', 'observability', 'errors'] },
    { t: 'Migration: SHA-256 hashes for API keys', topics: ['security', 'api-keys', 'hashing'] },
    { t: 'Postgres JSONB query performance', topics: ['postgres', 'jsonb', 'performance'] },
    { t: "Why we don't use Kubernetes (yet)", topics: ['infra', 'k8s', 'complexity'] },
    { t: 'Audit log retention policy', topics: ['audit', 'retention', 'compliance'] },
    { t: 'GDPR delete-account flow design', topics: ['gdpr', 'privacy', 'design'] },
    { t: 'OWASP top 10 review for our stack', topics: ['security', 'owasp', 'review'] },
    {
      t: 'How we handle tenant isolation in Qdrant',
      topics: ['qdrant', 'multi-tenant', 'security'],
    },
    { t: 'Prisma migration squashing strategy', topics: ['prisma', 'migration', 'strategy'] },
    { t: 'Memory leak in document worker', topics: ['memory-leak', 'worker', 'debug'] },
    {
      t: 'WebSocket compression: per-message-deflate',
      topics: ['websocket', 'compression', 'performance'],
    },
    { t: 'Bundle size reduction: 800KB -> 480KB', topics: ['bundle', 'frontend', 'optimization'] },
    { t: 'Choosing Tailwind over CSS-in-JS', topics: ['css', 'tailwind', 'frontend'] },
    { t: 'React Server Components: eval and decline', topics: ['react', 'rsc', 'frontend'] },
    { t: 'Vitest vs Jest: migration writeup', topics: ['vitest', 'jest', 'testing'] },
    { t: 'Three.js performance for 1000+ nodes', topics: ['threejs', '3d', 'performance'] },
    { t: 'How dependency-track works', topics: ['security', 'dependencies', 'sbom'] },
    { t: 'Our CSP policy explained', topics: ['security', 'csp', 'headers'] },
    { t: 'Helmet middleware deep-dive', topics: ['helmet', 'security', 'middleware'] },
    { t: 'Cookie SameSite policy reasoning', topics: ['cookies', 'security', 'samesite'] },
    { t: 'Rate-limit key strategy: user vs IP', topics: ['rate-limit', 'design', 'security'] },
    { t: 'JWT vs opaque tokens trade-offs', topics: ['jwt', 'tokens', 'auth'] },
    { t: 'Refresh token rotation reuse detection', topics: ['security', 'tokens', 'auth'] },
    { t: 'BCrypt cost factor: 12 vs 14', topics: ['bcrypt', 'hashing', 'security'] },
    { t: '2FA TOTP implementation notes', topics: ['2fa', 'totp', 'security'] },
    { t: 'OIDC client implementation pitfalls', topics: ['oidc', 'sso', 'security'] },
    { t: 'SAML 2.0 SP minimum viable spec', topics: ['saml', 'sso', 'security'] },
    { t: 'SCIM 2.0 group provisioning quirks', topics: ['scim', 'provisioning', 'sso'] },
    { t: 'Search relevance: BM25 vs cosine eval', topics: ['search', 'bm25', 'evaluation'] },
    { t: 'Why we built our own sparse encoder', topics: ['search', 'sparse', 'bm25'] },
    { t: 'Cross-encoder reranking: Cohere vs Voyage', topics: ['rerank', 'cohere', 'voyage'] },
    { t: 'Hybrid search RRF fusion math', topics: ['search', 'rrf', 'hybrid'] },
    { t: 'Embedding cache hit ratio analysis', topics: ['caching', 'embeddings', 'performance'] },
    { t: 'Why we chose Qdrant over pgvector', topics: ['qdrant', 'pgvector', 'vector-db'] },
    { t: 'Qdrant scalar quantization eval', topics: ['qdrant', 'quantization', 'performance'] },
    { t: 'Chunking strategy for long documents', topics: ['chunking', 'documents', 'rag'] },
    { t: 'Citation extraction from LLM responses', topics: ['llm', 'citations', 'rag'] },
    { t: 'Hallucination mitigation experiments', topics: ['llm', 'hallucination', 'quality'] },
    { t: 'Async job priorities in BullMQ', topics: ['bullmq', 'priorities', 'queue'] },
    { t: 'Postgres VACUUM tuning', topics: ['postgres', 'vacuum', 'performance'] },
    {
      t: 'Detecting and reporting slow queries',
      topics: ['postgres', 'slow-queries', 'observability'],
    },
    { t: 'pg_stat_statements analysis weekly', topics: ['postgres', 'observability', 'tooling'] },
    { t: 'Redis memory usage breakdown', topics: ['redis', 'memory', 'observability'] },
    { t: 'BullMQ queue depth alerting', topics: ['bullmq', 'alerting', 'observability'] },
    { t: 'On-call rotation playbook', topics: ['oncall', 'playbook', 'process'] },
    { t: 'PagerDuty escalation policy', topics: ['pagerduty', 'oncall', 'process'] },
    { t: 'How we detect Qdrant collection drift', topics: ['qdrant', 'drift', 'validation'] },
    {
      t: 'Backup and restore: postgres + qdrant',
      topics: ['backup', 'disaster-recovery', 'postgres'],
    },
    { t: 'GitHub Actions secrets rotation', topics: ['ci', 'secrets', 'security'] },
    { t: 'Dependabot vs Renovate trade-offs', topics: ['dependabot', 'renovate', 'dependencies'] },
    { t: 'CodeQL findings: triage process', topics: ['codeql', 'security', 'sast'] },
    { t: 'Trivy scans in CI: what we ignore', topics: ['trivy', 'security', 'ci'] },
    { t: 'Snyk false positives writeup', topics: ['snyk', 'security', 'sast'] },
    {
      t: 'Frontend performance: First Contentful Paint',
      topics: ['performance', 'fcp', 'frontend'],
    },
    { t: 'Lazy-loading heavy 3D component', topics: ['threejs', 'lazy', 'frontend'] },
    { t: 'React Suspense boundaries strategy', topics: ['react', 'suspense', 'frontend'] },
    { t: 'Error boundary placement in our app', topics: ['react', 'error-boundary', 'frontend'] },
    { t: 'Toast notifications UX standards', topics: ['ux', 'toast', 'notifications'] },
    { t: 'Our shadcn/ui customization', topics: ['shadcn', 'ui', 'frontend'] },
    { t: 'Radix UI a11y wins', topics: ['radix', 'a11y', 'frontend'] },
    { t: 'Cmd+K command palette implementation', topics: ['cmd-k', 'frontend', 'ux'] },
    { t: 'Dark mode toggle: prefers-color-scheme', topics: ['dark-mode', 'frontend', 'css'] },
    { t: 'Tailwind plugin: typography', topics: ['tailwind', 'typography', 'plugin'] },
    { t: 'Date library: date-fns vs day.js eval', topics: ['date', 'library', 'dependencies'] },
    { t: 'Why we removed moment.js', topics: ['moment', 'dependencies', 'bundle'] },
    { t: 'Vitest setup for Prisma tests', topics: ['vitest', 'prisma', 'testing'] },
    {
      t: 'Testcontainers for integration tests',
      topics: ['testing', 'testcontainers', 'integration'],
    },
    { t: 'Snapshot testing: when it helps', topics: ['testing', 'snapshots', 'vitest'] },
    { t: 'Property-based testing experiment', topics: ['testing', 'property', 'fast-check'] },
    { t: 'Mocking strategy for OpenAI in tests', topics: ['testing', 'mocking', 'openai'] },
    { t: 'Branch protection rules audit', topics: ['github', 'branch-protection', 'process'] },
    { t: 'Conventional commits adoption', topics: ['git', 'conventional-commits', 'process'] },
    { t: 'Trunk-based dev: lessons learned', topics: ['git', 'trunk-based', 'process'] },
    { t: 'PR template tweaks', topics: ['github', 'pr-template', 'process'] },
    { t: 'Code review SLA: 4 hours during workday', topics: ['code-review', 'sla', 'process'] },
    { t: 'Pair programming experiments', topics: ['pair', 'process', 'engineering-culture'] },
    { t: 'Tech debt budget: 20% per sprint', topics: ['tech-debt', 'sprint', 'process'] },
    { t: 'Sprint planning: what we changed', topics: ['sprint', 'planning', 'process'] },
    { t: 'Estimation: t-shirt sizing vs points', topics: ['estimation', 'process', 'agile'] },
    { t: 'Async standups: how we run them', topics: ['standup', 'async', 'process'] },
    { t: 'Documentation as code: VitePress', topics: ['docs', 'vitepress', 'tooling'] },
    { t: 'API versioning strategy', topics: ['api', 'versioning', 'design'] },
    { t: 'Deprecation policy: 6-month notice', topics: ['deprecation', 'api', 'process'] },
    { t: 'Webhook DLQ implementation', topics: ['webhook', 'dlq', 'reliability'] },
  ]
  items.forEach((it, i) => {
    const sources: Source[] = ['github', 'notion', 'slack', 'github', 'notion']
    out.push({
      title: it.t,
      content: `Engineering note — ${it.t.toLowerCase()}. Captured during sprint ${rand(1, 24, i)} retro. Key takeaways: investigate root cause, document the fix, share learnings with the team. Follow-up: track in next sprint planning.`,
      owner: ownerFor(i),
      source: sources[i % sources.length],
      daysAgo: rand(7, 280, i + 500),
      topics: ['engineering', ...it.topics],
    })
  })
  return out
})()

// ── Cluster 6: Articles read / web captures (180) ──────────────────────────
const ARTICLES: MemoryDef[] = (() => {
  const out: MemoryDef[] = []
  const articles: Array<{ t: string; topics: string[] }> = [
    {
      t: 'How Notion Handles Realtime Collaboration',
      topics: ['notion', 'realtime', 'crdt', 'article'],
    },
    {
      t: "Figma's Multiplayer Architecture Explained",
      topics: ['figma', 'multiplayer', 'architecture', 'article'],
    },
    {
      t: 'Designing Data-Intensive Applications — Chapter 5',
      topics: ['ddia', 'book', 'distributed-systems'],
    },
    {
      t: 'Why Discord Stores Trillions of Messages on Cassandra',
      topics: ['discord', 'cassandra', 'scale', 'article'],
    },
    { t: 'The Twelve-Factor App: Notes', topics: ['12-factor', 'principles', 'article'] },
    { t: 'Postgres Internals — Bruce Momjian', topics: ['postgres', 'internals', 'talk'] },
    { t: 'CRDT Survey by Marc Shapiro', topics: ['crdt', 'research', 'paper'] },
    { t: 'Yjs Documentation: Awareness Protocol', topics: ['yjs', 'awareness', 'docs'] },
    { t: 'Operational Transformation vs CRDTs', topics: ['ot', 'crdt', 'comparison', 'article'] },
    { t: 'Building a Code Editor with CRDTs', topics: ['crdt', 'code-editor', 'article'] },
    { t: 'How Linear Handles Realtime Updates', topics: ['linear', 'realtime', 'article'] },
    {
      t: "Architecture of Slack's Realtime Messaging",
      topics: ['slack', 'realtime', 'architecture', 'article'],
    },
    {
      t: 'Building Resilient Distributed Systems — talk by Camille Fournier',
      topics: ['distributed-systems', 'resilience', 'talk'],
    },
    { t: 'How Stripe Handles Idempotency', topics: ['stripe', 'idempotency', 'article'] },
    { t: 'Idempotency Keys: A Pattern', topics: ['idempotency', 'pattern', 'article'] },
    { t: 'Database Migrations Without Downtime', topics: ['database', 'migrations', 'article'] },
    { t: 'Postgres Index Types Explained', topics: ['postgres', 'indexes', 'article'] },
    { t: 'When to Denormalize Your Database', topics: ['database', 'denormalization', 'article'] },
    { t: 'Caching Strategies for Web APIs', topics: ['caching', 'api', 'article'] },
    { t: 'How Cloudflare Built Workers KV', topics: ['cloudflare', 'kv', 'article'] },
    {
      t: 'Distributed Systems Reading List — Murat Demirbas',
      topics: ['distributed-systems', 'reading-list'],
    },
    {
      t: 'Latency Numbers Every Programmer Should Know',
      topics: ['latency', 'performance', 'reference'],
    },
    { t: 'The Art of HTTP Caching', topics: ['http', 'caching', 'article'] },
    { t: 'Designing the Perfect API Pagination', topics: ['api', 'pagination', 'article'] },
    { t: 'How GitHub Manages Code Review at Scale', topics: ['github', 'code-review', 'article'] },
    {
      t: "Async Code Review: Linear's Approach",
      topics: ['linear', 'code-review', 'async', 'article'],
    },
    { t: 'Trunk-Based Development at Spotify', topics: ['trunk-based', 'spotify', 'article'] },
    { t: 'How Netflix Handles Chaos Engineering', topics: ['netflix', 'chaos', 'article'] },
    { t: 'SRE Book — Chapter on Error Budgets', topics: ['sre', 'error-budget', 'book'] },
    { t: 'Postmortem: AWS S3 Outage 2017', topics: ['aws', 'postmortem', 'outage'] },
    { t: 'Postmortem: GitHub October 21 Incident', topics: ['github', 'postmortem', 'incident'] },
    { t: 'How Discord Cleared 10 Million Messages', topics: ['discord', 'data', 'operations'] },
    { t: 'OpenAI API Best Practices for Production', topics: ['openai', 'llm', 'production'] },
    { t: "Anthropic's Claude API Documentation", topics: ['anthropic', 'claude', 'docs'] },
    { t: 'Vercel AI SDK: Streaming Patterns', topics: ['vercel', 'ai', 'streaming'] },
    {
      t: 'Embedding Models Comparison: text-embedding-3',
      topics: ['embeddings', 'openai', 'comparison'],
    },
    { t: 'Cohere Reranker: When to Use It', topics: ['cohere', 'rerank', 'article'] },
    { t: 'Voyage AI: Domain-Specific Embeddings', topics: ['voyage', 'embeddings', 'article'] },
    { t: 'Jina AI Reranker Benchmarks', topics: ['jina', 'rerank', 'benchmark'] },
    { t: 'BM25 vs TF-IDF: Practical Differences', topics: ['bm25', 'tfidf', 'search'] },
    { t: 'Reciprocal Rank Fusion Explained', topics: ['rrf', 'search', 'algorithm'] },
    { t: 'Vector Search at 1B Scale: Pinecone', topics: ['pinecone', 'vector-search', 'scale'] },
    { t: 'Qdrant: Multi-Tenant Best Practices', topics: ['qdrant', 'multi-tenant', 'article'] },
    { t: 'Weaviate vs Qdrant: 2026 Comparison', topics: ['weaviate', 'qdrant', 'comparison'] },
    { t: 'pgvector Performance at 100M Vectors', topics: ['pgvector', 'performance', 'article'] },
    { t: 'How Notion Built Their AI Assistant', topics: ['notion', 'ai', 'article'] },
    { t: 'Building a RAG System: End-to-End', topics: ['rag', 'tutorial', 'article'] },
    { t: 'LangChain vs LlamaIndex: Choosing', topics: ['langchain', 'llamaindex', 'comparison'] },
    { t: 'Llama 3.1: Local LLM Deployment', topics: ['llama', 'local-llm', 'article'] },
    { t: 'Ollama for Production Workloads', topics: ['ollama', 'llm', 'production'] },
    {
      t: "Model Context Protocol: Anthropic's New Standard",
      topics: ['mcp', 'anthropic', 'protocol'],
    },
    { t: 'Building MCP Servers: Tutorial', topics: ['mcp', 'tutorial', 'protocol'] },
    { t: 'Claude Desktop MCP Integration Guide', topics: ['claude', 'mcp', 'desktop'] },
    { t: 'Cursor Editor: AI Features Deep Dive', topics: ['cursor', 'editor', 'ai'] },
    { t: 'Cline: Open-Source Coding Agent', topics: ['cline', 'agent', 'tools'] },
    { t: 'Continue.dev: AI in Your IDE', topics: ['continue', 'ide', 'ai'] },
    { t: 'Zed Editor: Speed-First Development', topics: ['zed', 'editor', 'article'] },
    { t: "TypeScript 5.5: What's New", topics: ['typescript', 'release', 'article'] },
    { t: 'Node.js 20 LTS Highlights', topics: ['node', 'release', 'article'] },
    { t: 'Bun Runtime: Should You Switch?', topics: ['bun', 'runtime', 'article'] },
    { t: 'Deno 2.0 Release Notes', topics: ['deno', 'release', 'article'] },
    {
      t: 'pnpm vs npm vs yarn: 2026 Edition',
      topics: ['package-manager', 'comparison', 'article'],
    },
    { t: 'Vite vs Webpack: When to Switch', topics: ['vite', 'webpack', 'article'] },
    { t: 'esbuild Performance Tips', topics: ['esbuild', 'performance', 'article'] },
    { t: 'Turbopack: The Future of Bundling?', topics: ['turbopack', 'bundler', 'article'] },
    { t: 'React Server Components: Production Lessons', topics: ['react', 'rsc', 'article'] },
    { t: 'Next.js 14 App Router Migration', topics: ['nextjs', 'migration', 'article'] },
    { t: 'Remix Loader/Action Patterns', topics: ['remix', 'patterns', 'article'] },
    { t: 'TanStack Router for SPA Apps', topics: ['tanstack', 'router', 'article'] },
    { t: 'Solid.js: Reactive Without Hooks', topics: ['solid', 'reactive', 'article'] },
    { t: 'Vue 3 Composition API in 2026', topics: ['vue', 'composition', 'article'] },
    { t: 'Svelte 5 Runes: New Mental Model', topics: ['svelte', 'runes', 'article'] },
    { t: 'CSS Container Queries in Production', topics: ['css', 'container-queries', 'article'] },
    { t: 'View Transitions API: Native Animations', topics: ['css', 'animations', 'article'] },
    { t: 'Web Components: Are We There Yet?', topics: ['web-components', 'article'] },
    {
      t: 'Service Workers: Offline-First Patterns',
      topics: ['service-workers', 'offline', 'article'],
    },
    { t: 'IndexedDB Wrappers: Dexie vs idb', topics: ['indexeddb', 'library', 'comparison'] },
    { t: 'WebRTC for Peer-to-Peer Editing', topics: ['webrtc', 'p2p', 'article'] },
    { t: 'WebTransport: HTTP/3 for Realtime', topics: ['webtransport', 'http3', 'article'] },
    { t: 'WebAssembly in 2026: State of the Art', topics: ['wasm', 'article'] },
    { t: 'Rust for Frontend Tooling', topics: ['rust', 'frontend', 'article'] },
    { t: 'Why Linear Rewrote in Rust', topics: ['linear', 'rust', 'article'] },
    { t: 'Discord Migrated 10M Channels to Rust', topics: ['discord', 'rust', 'article'] },
    { t: 'Tokio: Async Rust at Scale', topics: ['rust', 'tokio', 'article'] },
    { t: 'Go vs Rust: 2026 Update', topics: ['go', 'rust', 'comparison'] },
    {
      t: 'Erlang/OTP Lessons for Distributed Systems',
      topics: ['erlang', 'distributed-systems', 'article'],
    },
    { t: 'Akka: Actor Model in Practice', topics: ['akka', 'actors', 'article'] },
    { t: 'Temporal: Durable Execution Patterns', topics: ['temporal', 'workflow', 'article'] },
    { t: 'Inngest vs Trigger.dev: Workflow Engines', topics: ['inngest', 'trigger', 'workflow'] },
    {
      t: 'Restate: Distributed Application Runtime',
      topics: ['restate', 'distributed', 'article'],
    },
    { t: 'BullMQ vs SQS: Cost & Reliability', topics: ['bullmq', 'sqs', 'comparison'] },
    { t: 'Kafka: When You Actually Need It', topics: ['kafka', 'messaging', 'article'] },
    { t: 'NATS for Microservices', topics: ['nats', 'messaging', 'article'] },
    { t: 'gRPC vs REST in 2026', topics: ['grpc', 'rest', 'comparison'] },
    { t: 'GraphQL Federation at Scale', topics: ['graphql', 'federation', 'article'] },
    { t: 'tRPC: End-to-End Type Safety', topics: ['trpc', 'typescript', 'article'] },
    { t: 'OpenAPI 3.1: New Schema Features', topics: ['openapi', 'schema', 'article'] },
    { t: 'API Design: REST is Not Enough', topics: ['api', 'design', 'article'] },
    { t: 'JSON:API Specification Walkthrough', topics: ['json-api', 'spec', 'article'] },
    { t: 'HATEOAS in Practice (or Not)', topics: ['hateoas', 'rest', 'article'] },
    { t: 'Webhooks vs SSE: Decision Guide', topics: ['webhooks', 'sse', 'article'] },
    { t: 'Long Polling Considered Harmful', topics: ['long-polling', 'article'] },
    { t: 'WebSocket Frame Compression Wins', topics: ['websocket', 'compression', 'article'] },
    { t: 'HTTP/3 in 2026: Production Status', topics: ['http3', 'article'] },
    { t: 'CDN Edge Caching: Vercel vs Cloudflare', topics: ['cdn', 'vercel', 'cloudflare'] },
    { t: 'Bun.serve vs Node.js HTTP performance', topics: ['bun', 'node', 'performance'] },
    { t: 'Hyper: Rust HTTP Library Internals', topics: ['rust', 'hyper', 'article'] },
    { t: 'TLS 1.3 Performance Improvements', topics: ['tls', 'performance', 'article'] },
    { t: 'mTLS for Service-to-Service Auth', topics: ['mtls', 'security', 'article'] },
    { t: "OAuth 2.1 Draft: What's Changing", topics: ['oauth', 'spec', 'article'] },
    { t: 'OIDC vs SAML: Modern Recommendations', topics: ['oidc', 'saml', 'comparison'] },
    { t: 'PKCE: Why Mobile Needs It', topics: ['pkce', 'oauth', 'security'] },
    { t: 'Passkeys: The Future of Auth', topics: ['passkeys', 'auth', 'article'] },
    { t: 'WebAuthn Implementation Guide', topics: ['webauthn', 'auth', 'article'] },
    { t: 'JWT Security Best Practices', topics: ['jwt', 'security', 'article'] },
    {
      t: 'Zero-Trust Architecture: Beyond the Hype',
      topics: ['zero-trust', 'security', 'article'],
    },
    { t: "BeyondCorp: Google's Security Model", topics: ['beyondcorp', 'security', 'article'] },
    { t: 'SOC 2 Type II: Cost vs Benefit', topics: ['soc2', 'compliance', 'article'] },
    { t: 'GDPR for Engineers: What You Must Do', topics: ['gdpr', 'compliance', 'article'] },
    { t: 'CCPA Compliance Checklist', topics: ['ccpa', 'compliance', 'article'] },
    { t: 'Privacy by Design: 7 Principles', topics: ['privacy', 'design', 'article'] },
    { t: 'How Apple Implements Differential Privacy', topics: ['apple', 'privacy', 'article'] },
    { t: 'Encryption at Rest: Postgres Approaches', topics: ['encryption', 'postgres', 'article'] },
    { t: 'Hashicorp Vault for Secrets Management', topics: ['vault', 'secrets', 'article'] },
    { t: 'AWS KMS: Cost-Effective Patterns', topics: ['aws', 'kms', 'article'] },
    { t: 'Backup Strategies for Postgres', topics: ['postgres', 'backup', 'article'] },
    { t: 'Disaster Recovery Drills: How Often?', topics: ['dr', 'process', 'article'] },
    { t: 'Multi-Region Postgres: Patroni Setup', topics: ['postgres', 'patroni', 'article'] },
    { t: 'CockroachDB vs Spanner: 2026 Update', topics: ['cockroachdb', 'spanner', 'comparison'] },
    { t: 'YugabyteDB Production War Stories', topics: ['yugabyte', 'postgres', 'article'] },
    { t: 'TimescaleDB for Time-Series Data', topics: ['timescaledb', 'postgres', 'article'] },
    { t: 'ClickHouse for Real-Time Analytics', topics: ['clickhouse', 'analytics', 'article'] },
    { t: 'DuckDB: Embedded Analytics Engine', topics: ['duckdb', 'analytics', 'article'] },
    { t: 'Apache Arrow: Columnar In-Memory Format', topics: ['arrow', 'columnar', 'article'] },
    { t: 'Parquet vs Avro: When to Use Each', topics: ['parquet', 'avro', 'comparison'] },
    { t: 'Data Mesh vs Data Warehouse', topics: ['data-mesh', 'data-warehouse', 'article'] },
    { t: 'dbt for Analytics Engineering', topics: ['dbt', 'analytics', 'article'] },
    { t: 'Airbyte vs Fivetran: ELT Tools', topics: ['airbyte', 'fivetran', 'comparison'] },
    { t: 'How Stripe Built Internal Analytics', topics: ['stripe', 'analytics', 'article'] },
    {
      t: 'Product Analytics: Amplitude vs Mixpanel',
      topics: ['amplitude', 'mixpanel', 'comparison'],
    },
    { t: 'Funnel Analysis: Common Mistakes', topics: ['funnel', 'analytics', 'article'] },
    { t: 'A/B Testing at 50K MAU', topics: ['ab-testing', 'experimentation', 'article'] },
    { t: 'Statsig: Stat-Sig Experimentation', topics: ['statsig', 'experimentation', 'article'] },
    { t: 'GrowthBook: OSS Feature Flags', topics: ['growthbook', 'feature-flags', 'article'] },
    {
      t: 'LaunchDarkly: Enterprise Feature Flags',
      topics: ['launchdarkly', 'feature-flags', 'article'],
    },
    { t: 'PostHog: Open-Source Analytics', topics: ['posthog', 'analytics', 'article'] },
    { t: 'Plausible: Privacy-First Analytics', topics: ['plausible', 'analytics', 'article'] },
    { t: 'Sentry vs Datadog APM', topics: ['sentry', 'datadog', 'comparison'] },
    {
      t: 'Honeycomb: High-Cardinality Observability',
      topics: ['honeycomb', 'observability', 'article'],
    },
    { t: 'Grafana Tempo: Distributed Tracing', topics: ['grafana', 'tempo', 'article'] },
    {
      t: 'OpenTelemetry: One Standard to Rule Them',
      topics: ['opentelemetry', 'observability', 'article'],
    },
    { t: 'eBPF: Kernel-Level Observability', topics: ['ebpf', 'observability', 'article'] },
    { t: 'Container Security: Wiz vs Sysdig', topics: ['container-security', 'wiz', 'comparison'] },
    { t: 'Falco for Runtime Threat Detection', topics: ['falco', 'security', 'article'] },
    { t: 'OPA for Authorization Policies', topics: ['opa', 'authorization', 'article'] },
    { t: "Cedar: Amazon's Authorization Language", topics: ['cedar', 'authorization', 'article'] },
    { t: 'RBAC vs ABAC: When to Choose', topics: ['rbac', 'abac', 'comparison'] },
    { t: 'ReBAC: Relationship-Based Access', topics: ['rebac', 'authorization', 'article'] },
    { t: 'Auth0 vs Clerk vs WorkOS', topics: ['auth0', 'clerk', 'workos'] },
    { t: 'Keycloak: Self-Hosted Auth', topics: ['keycloak', 'auth', 'article'] },
    { t: 'Ory: Open-Source Auth Stack', topics: ['ory', 'auth', 'article'] },
    { t: 'Ory Hydra: OAuth 2.0 in Go', topics: ['ory', 'hydra', 'article'] },
    { t: 'SuperTokens: Self-Hosted Alternative', topics: ['supertokens', 'auth', 'article'] },
    { t: 'How Linear Onboards Users', topics: ['linear', 'onboarding', 'ux'] },
    { t: "Notion's Onboarding: Reverse-Engineered", topics: ['notion', 'onboarding', 'ux'] },
    { t: "Slack's Empty State Design", topics: ['slack', 'empty-state', 'ux'] },
    { t: 'Empty State Patterns That Convert', topics: ['empty-state', 'ux', 'article'] },
    { t: 'Tooltip Design: Accessibility Concerns', topics: ['tooltip', 'a11y', 'ux'] },
    { t: 'Modal Dialogs: When to Avoid', topics: ['modal', 'ux', 'article'] },
    { t: 'Form Design: Floating Labels', topics: ['form', 'ux', 'article'] },
    { t: 'Skeleton Screens vs Spinners', topics: ['skeleton', 'loading', 'ux'] },
    { t: 'Animation Performance: 60fps Rules', topics: ['animation', 'performance', 'article'] },
    { t: 'Dark Mode: Implementation Details', topics: ['dark-mode', 'article'] },
    { t: 'Color Systems: Tailwind vs Radix', topics: ['color', 'tailwind', 'radix'] },
    { t: 'Typography Scales for SaaS', topics: ['typography', 'design', 'article'] },
    { t: 'How to Choose a Design System', topics: ['design-system', 'article'] },
    { t: 'Material UI vs Chakra vs shadcn', topics: ['ui-library', 'comparison', 'article'] },
    { t: 'Storybook 8: New Features', topics: ['storybook', 'article'] },
    { t: 'Component Testing with Playwright', topics: ['playwright', 'testing', 'article'] },
    { t: 'Visual Regression: Chromatic vs Percy', topics: ['visual-regression', 'testing'] },
    { t: "E2E Testing: When It's Worth It", topics: ['e2e', 'testing', 'article'] },
    { t: 'Cypress vs Playwright in 2026', topics: ['cypress', 'playwright', 'comparison'] },
    { t: 'Mock Service Worker: Frontend Mocks', topics: ['msw', 'testing', 'article'] },
    { t: 'Why Vitest Beat Jest for Us', topics: ['vitest', 'jest', 'comparison'] },
    { t: 'Tracing in Distributed Systems', topics: ['tracing', 'distributed-systems', 'article'] },
    { t: "Reverse Engineering Cursor's AI", topics: ['cursor', 'ai', 'article'] },
    { t: 'How Replit Multiplayer Works', topics: ['replit', 'multiplayer', 'article'] },
    { t: 'Tabnine vs Copilot vs Cursor', topics: ['copilot', 'tabnine', 'cursor'] },
    { t: 'Why Hacker News Loves Tailwind', topics: ['tailwind', 'article'] },
  ]
  articles.forEach((it, i) => {
    out.push({
      title: it.t,
      content: `Web capture: ${it.t}. Read on ${['hacker news', 'dev.to', 'medium', 'company blog', 'newsletter', 'twitter'][i % 6]}. Key points relevant to our work: highlighted the ${['scaling', 'reliability', 'UX', 'testing', 'observability'][i % 5]} considerations. Saved for reference.`,
      owner: ownerFor(i),
      source: 'web',
      daysAgo: rand(1, 300, i + 800),
      topics: it.topics,
      url: `https://example.com/articles/${it.t
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 60)}`,
    })
  })
  return out.slice(0, 180)
})()

// ── Cluster 7: Internal team / culture (50) ────────────────────────────────
const INTERNAL: MemoryDef[] = (() => {
  const out: MemoryDef[] = []
  const items: Array<{ t: string; src: Source }> = [
    { t: 'All-hands deck — January', src: 'google_docs' },
    { t: 'All-hands deck — February', src: 'google_docs' },
    { t: 'All-hands deck — March', src: 'google_docs' },
    { t: 'All-hands deck — April', src: 'google_docs' },
    { t: 'Q1 retrospective notes', src: 'notion' },
    { t: 'Engineering retro — sprint 14', src: 'notion' },
    { t: 'Engineering retro — sprint 15', src: 'notion' },
    { t: 'Engineering retro — sprint 16', src: 'notion' },
    { t: 'Slack: lunch debate on tabs vs spaces', src: 'slack' },
    { t: 'Slack: best Bandra coffee', src: 'slack' },
    { t: 'Team offsite Lonavala — agenda', src: 'notion' },
    { t: 'Diwali bonus + holiday calendar', src: 'gmail' },
    { t: 'Slack: AMA with CEO', src: 'slack' },
    { t: 'Health insurance enrollment', src: 'gmail' },
    { t: '401(k) plan documentation', src: 'gmail' },
    { t: 'Vacation policy: unlimited PTO Q&A', src: 'notion' },
    { t: 'Slack: Friday demos this week', src: 'slack' },
    { t: 'Slack: who broke the build?', src: 'slack' },
    { t: "Slack: let's talk about deploys", src: 'slack' },
    { t: 'Engineering values doc', src: 'notion' },
    { t: 'Onboarding: week 1 checklist', src: 'notion' },
    { t: 'Onboarding: week 2 — first PR', src: 'notion' },
    { t: 'Onboarding: month 1 review', src: 'notion' },
    { t: 'Performance review template', src: 'notion' },
    { t: 'OKR check-in: April mid-month', src: 'notion' },
    { t: "Slack: someone's coffee in the fridge", src: 'slack' },
    { t: 'Slack: keyboard recommendations', src: 'slack' },
    { t: 'Slack: best chair for 8 hours of standing', src: 'slack' },
    { t: 'Slack: WFH setup pictures thread', src: 'slack' },
    { t: 'Internal blog: team retro lessons', src: 'notion' },
    { t: 'Slack: team birthday calendar', src: 'slack' },
    { t: 'Compensation philosophy doc', src: 'notion' },
    { t: 'Equity refresh policy', src: 'notion' },
    { t: 'Code of conduct', src: 'notion' },
    { t: 'Anti-harassment training Q1', src: 'gmail' },
    { t: 'Slack: who has the office key?', src: 'slack' },
    { t: 'Office WiFi password reset', src: 'slack' },
    { t: 'Q2 budget approval', src: 'gmail' },
    { t: 'Travel reimbursement policy', src: 'notion' },
    { t: 'Slack: anyone going to Reactathon?', src: 'slack' },
    { t: 'Conference budget guidelines', src: 'notion' },
    { t: 'Engineering hours of operation', src: 'notion' },
    { t: 'Async-first communication norms', src: 'notion' },
    { t: 'Slack: documenting our decisions properly', src: 'slack' },
    { t: 'Decision log conventions', src: 'notion' },
    { t: 'Slack: hot take — should we hire a CTO?', src: 'slack' },
    { t: 'Slack: when do we move to a bigger office?', src: 'slack' },
    { t: 'Engineering manager training notes', src: 'notion' },
    { t: 'IC growth ladder rubric', src: 'notion' },
    { t: 'Career conversation framework', src: 'notion' },
  ]
  items.forEach((it, i) => {
    out.push({
      title: it.t,
      content: `Internal Blit Labs ${it.t.toLowerCase()}. Reflects current team norms and decisions. Owner: ${ownerFor(i)}. Last reviewed during ${['Q1', 'Q2'][i % 2]} planning. Action: keep updated quarterly.`,
      owner: ownerFor(i),
      source: it.src,
      daysAgo: rand(7, 200, i + 1300),
      topics: ['internal', 'culture', 'team', 'process'],
    })
  })
  return out
})()

// ── Combine all clusters ───────────────────────────────────────────────────
const ALL_MEMORIES: MemoryDef[] = [
  ...POLARIS_TECH,
  ...CUSTOMERS,
  ...HIRING,
  ...STRATEGY,
  ...ENG_GENERAL,
  ...ARTICLES,
  ...INTERNAL,
]

// ── Insert + embed ─────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.log('[seed:mesh] starting', { totalMemories: ALL_MEMORIES.length })

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })
  if (!org) throw new Error(`Org "${ORG_SLUG}" not found. Run seed:polaris first.`)

  const users = await prisma.user.findMany({
    where: { email: { in: ['alex@blitlabs.com', 'sarah@blitlabs.com', 'bob@blitlabs.com'] } },
  })
  const byOwner: Record<Owner, string> = {
    alex: users.find(u => u.email === 'alex@blitlabs.com')?.id ?? '',
    sarah: users.find(u => u.email === 'sarah@blitlabs.com')?.id ?? '',
    bob: users.find(u => u.email === 'bob@blitlabs.com')?.id ?? '',
  }
  if (!byOwner.alex || !byOwner.sarah || !byOwner.bob) {
    throw new Error('Demo users missing. Run seed:polaris first.')
  }

  // Idempotent: clear previous mesh-density inserts
  const purged = await prisma.memory.deleteMany({
    where: {
      organization_id: org.id,
      page_metadata: { path: ['tag'], equals: TAG },
    },
  })
  if (purged.count > 0) logger.log('[seed:mesh] purged previous', { count: purged.count })

  const insertedIds: string[] = []
  let i = 0
  for (const m of ALL_MEMORIES) {
    const ts = Date.now() - m.daysAgo * 24 * 60 * 60 * 1000
    const row = await prisma.memory.create({
      data: {
        user_id: byOwner[m.owner],
        organization_id: org.id,
        source: m.source,
        source_type: 'INTEGRATION',
        memory_type: 'REFERENCE',
        title: m.title,
        content: m.content,
        url:
          m.url ??
          `https://example.com/${m.source}/${m.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 60)}`,
        timestamp: BigInt(ts),
        created_at: new Date(ts),
        last_accessed: new Date(ts),
        confidence_score: 0.8,
        importance_score: 0.5 + ((i * 7) % 40) / 100,
        page_metadata: {
          topics: m.topics,
          source_label: m.source,
          tag: TAG,
          demo: true,
        },
      },
    })
    insertedIds.push(row.id)
    i++
    if (i % 50 === 0) logger.log('[seed:mesh] inserted', { count: i })
  }
  logger.log('[seed:mesh] all inserted', { count: insertedIds.length })

  // Embed in batches of 16 (matches OpenAI rate-friendly chunk).
  const BATCH = 16
  for (let j = 0; j < insertedIds.length; j += BATCH) {
    const slice = insertedIds.slice(j, j + BATCH)
    try {
      await memoryMeshService.generateEmbeddingsForMemoriesBatch(slice)
      if ((j / BATCH) % 5 === 0)
        logger.log('[seed:mesh] embedded', { from: j, to: j + slice.length })
    } catch (error) {
      logger.error('[seed:mesh] embedding batch failed', {
        from: j,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  logger.log('[seed:mesh] complete', { totalInserted: insertedIds.length })
  await prisma.$disconnect()
}

main().catch(err => {
  logger.error('[seed:mesh] failed', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
  process.exit(1)
})
