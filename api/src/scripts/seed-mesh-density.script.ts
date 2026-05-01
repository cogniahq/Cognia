/**
 * Seeds ~340 hand-crafted memories around the Polaris handover narrative
 * to make the memory mesh look like a real team's accumulated knowledge.
 *
 * Each memory has unique, specific content (real-feeling names, numbers,
 * dates, quotes) so embeddings spread out instead of clustering tightly.
 *
 * Idempotent - deletes everything tagged `mesh-density` before re-inserting.
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

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

const hexId = (seed: number, len = 32): string => {
  const chars = 'abcdef0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[(seed * 7 + i * 13 + 31) % 16]
  return s
}

// Per-source realistic URL fallback. Used when a memory doesn't have an
// explicit url. The shape of each URL matches the real product's link format.
const buildFallbackUrl = (m: MemoryDef, i: number): string => {
  const s = slugify(m.title)
  switch (m.source) {
    case 'slack':
      return `https://blitlabs.slack.com/archives/C0POLARIS/p${1730000000000 + i * 137}${(i % 1000).toString().padStart(3, '0')}`
    case 'notion':
      return `https://www.notion.so/blitlabs/${s}-${hexId(i + 17, 32)}`
    case 'github':
      return `https://github.com/blitlabs/canvas/issues/${500 + i}`
    case 'linear':
      return `https://linear.app/blit/issue/BLIT-${100 + i}`
    case 'gmail':
      return `https://mail.google.com/mail/u/0/#inbox/${hexId(i + 41, 16)}`
    case 'google_docs':
      return `https://docs.google.com/document/d/1${hexId(i + 53, 30)}/edit`
    case 'loom':
      return `https://www.loom.com/share/${hexId(i + 71, 32)}`
    case 'web':
      return `https://news.ycombinator.com/item?id=${30000000 + i * 17}`
    default:
      return `https://www.notion.so/blitlabs/${s}`
  }
}

// ── 1. Polaris technical & product (60) ─────────────────────────────────────
const POLARIS: MemoryDef[] = [
  {
    title: 'Y.js memory leak - undo stacks retained forever',
    content:
      'Reproduces with 50+ concurrent Y.Doc instances on a single tab. Each Y.UndoManager retains operation history indefinitely; at ~12k ops the heap hits 1.4GB. Fix: configure trackedOrigins more narrowly and add a 5-minute idle GC. Patch in PR #501.',
    owner: 'bob',
    source: 'github',
    daysAgo: 167,
    topics: ['polaris', 'yjs', 'memory-leak', 'performance'],
  },
  {
    title: 'Awareness protocol packet sizes',
    content:
      "Average awareness packet is 480 bytes (cursor + selection + user color). At 50 users firing 30Hz cursor moves, that's 720 KB/sec per shard. Compressed via per-message-deflate to ~140 KB/sec. Network never the bottleneck; CPU on the gateway is.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 152,
    topics: ['polaris', 'awareness', 'protocol', 'networking'],
  },
  {
    title: 'Why Acme refused our default cursor colors',
    content:
      "Acme's brand guidelines forbid certain reds. Our default palette has 3 reds. Sarah added a per-org cursor-palette override; the API takes a hex array. Documented in /docs/polaris/branding.",
    owner: 'sarah',
    source: 'slack',
    daysAgo: 142,
    topics: ['polaris', 'acme', 'cursor', 'branding'],
  },
  {
    title: 'Sticky session breakdown on AWS ALB',
    content:
      'ALB stickiness uses a duration-based cookie. If a user opens 3 tabs simultaneously, the cookie races and 1 of 3 lands on a different shard. We see ~2% of joins miss the right shard. Fix: stick on `document_id` query param via Lua header rewrite.',
    owner: 'bob',
    source: 'google_docs',
    daysAgo: 136,
    topics: ['polaris', 'alb', 'sticky-session', 'aws'],
  },
  {
    title: "POLARIS-23: offline >7 days - Bob's recommendation",
    content:
      'Bob\'s last comment before sabbatical: "Option B (snapshot client on disconnect, diff on reconnect) is the only one that\'s correct AND tractable. Plan: extend `IDBStore` to hold a Y.Doc snapshot per offline session; reconnect handshake replays the diff. ~2 weeks of work."',
    owner: 'bob',
    source: 'linear',
    daysAgo: 27,
    topics: ['polaris', 'offline', 'bob', 'decision'],
  },
  {
    title: 'Cursor lerp interpolation tuning',
    content:
      'Receiver-side interpolation between cursor updates uses a fixed 50ms lerp. Felt sluggish in dogfood. Lowered to 24ms - feels native, but 60Hz devices see micro-jitter. Compromise: 30ms with cubic easing. Sarah signed off.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 88,
    topics: ['polaris', 'cursor', 'animation', 'frontend'],
  },
  {
    title: 'Northwind requested SAML-gated rooms',
    content:
      "Northwind's security team wants Polaris rooms gated by their SAML IdP, not by Cognia's session. We'd need a per-room ACL evaluated on join. Filed POLARIS-58. Out of scope for GA per Sarah; possible in v1.1.",
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 64,
    topics: ['polaris', 'northwind', 'saml', 'enterprise'],
  },
  {
    title: 'Y.js v14 upgrade - what breaks',
    content:
      'v14 introduces strict types on XmlFragment. Our patch (we maintain a fork for nested-fragment handling) needs reapplication: 6-line diff. Test failures: `awareness.test.ts` expects v13 ordering. Plan: pin v13 for GA, upgrade in v1.1 + retire the patch.',
    owner: 'bob',
    source: 'github',
    daysAgo: 78,
    topics: ['polaris', 'yjs', 'upgrade', 'tech-debt'],
  },
  {
    title: 'Globex pilot - 5 users, then ghosted',
    content:
      "Globex piloted with 5 users for 2 weeks. NPS: +8 (mediocre). They went silent on follow-ups. Theory: their internal champion left for Stripe. Don't prioritize re-engagement until next quarter unless inbound.",
    owner: 'alex',
    source: 'gmail',
    daysAgo: 33,
    topics: ['polaris', 'globex', 'pilot', 'customer'],
  },
  {
    title: 'Selection-flicker fix (PR #523) deep dive',
    content:
      "Root cause: when 2 clients ack a `replace` op in the same RAF frame, both compute new selection bounds against pre-op coordinates. Fix is to debounce selection-recompute to a single requestAnimationFrame after all queued ops apply. Bob's patch handled the simple case; ours covers nested groups too.",
    owner: 'sarah',
    source: 'github',
    daysAgo: 60,
    topics: ['polaris', 'bug', 'selection', 'race-condition'],
  },
  {
    title: 'Postgres BYTEA vs LargeObject for snapshots',
    content:
      'Snapshots range 8KB to 600KB. BYTEA limit is 1GB; we never approach it. LargeObject would let us stream but adds complexity. Decision: BYTEA. Verified at 600KB read in 4ms. Vacuum will work with HOT updates.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 124,
    topics: ['polaris', 'postgres', 'snapshot', 'storage'],
  },
  {
    title: 'Acme expansion - they want comments-on-canvas next',
    content:
      'Acme demo with their VP design last Wed. Polaris is locked. Their next ask: persistent comments anchored to canvas regions, with thread + resolve. Scope: a separate feature, not Polaris extension. Sales committed to Q3.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 18,
    topics: ['polaris', 'acme', 'comments', 'expansion'],
  },
  {
    title: "Sarah's farewell scratchpad - gotchas only she knew",
    content:
      'Pinned in #eng-realtime: (1) gateway shard config in `infra/polaris-shards.json` - secret-rotated quarterly with the AWS key; (2) `awareness.ts` line 142 has a workaround for a v13 bug that v14 fixes; (3) the snapshot worker assumes UTC, breaks on AWS instances configured differently.',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 21,
    topics: ['polaris', 'handoff', 'tribal-knowledge', 'sarah'],
  },
  {
    title: 'Why we chose 30s snapshot interval',
    content:
      'Lower than 30s = unnecessary disk write rate. Higher than 30s = on a crash, up to 30s of edits replayed via delta log on next user load. 30s gives 95th percentile load time of 220ms. Verified with k6 on staging.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 102,
    topics: ['polaris', 'snapshot', 'interval', 'tradeoff'],
  },
  {
    title: "Initech evaluation - they're building in-house",
    content:
      "Initech's eng lead admitted they're prototyping their own collab in Yjs. Saw our pricing as too high. Don't expect them to convert. Filed for follow-up in 6 months when they realize how hard it is.",
    owner: 'alex',
    source: 'gmail',
    daysAgo: 41,
    topics: ['polaris', 'initech', 'build-vs-buy', 'prospect'],
  },
  {
    title: 'Cursor color collision at 50 users - fix shipped',
    content:
      'Generated colors via golden-angle in HSL, locked S=72%, L=58%. At 50 users, 2 perceived collisions (purple/violet) but no exact dupes. At 100, 5 perceived collisions; flag for v1.1 to add user color override.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 47,
    topics: ['polaris', 'cursor', 'color', 'ux'],
  },
  {
    title: 'Stress test - 1000 simulated users single doc',
    content:
      'k6 + a custom Y.js client simulator. Setup: 1000 users joining over 30s, each making 0.5 ops/sec for 10 min. Single-shard CPU sustained 92%. Reconnects: 0.4%. p99 op latency: 720ms (above SLO). Confirmed: 700-user single-shard ceiling.',
    owner: 'bob',
    source: 'github',
    daysAgo: 81,
    topics: ['polaris', 'stress-test', 'scaling', 'performance'],
  },
  {
    title: 'Why we picked Y.js over Automerge - long version',
    content:
      'Y.js: faster on our doc shape (avg 12k nodes), better awareness primitives, bigger community. Automerge: cleaner API, but 3.4x slower at 1M ops, less mature awareness. Dealbreaker for Automerge: no support for partial document loading. We need to load 1 frame without loading the whole canvas.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 145,
    topics: ['polaris', 'yjs', 'automerge', 'decision'],
  },
  {
    title: 'Beta-1 NPS breakdown',
    content:
      "ACME 14 users: NPS +51 (top promoters: VP Design, Lead Designer). Northwind 8 users: NPS +28 (lower because of cursor flicker bug - fixed). Globex 5 users: NPS +8 (silent users; can't tell what they actually felt). Overall: +37 weighted.",
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 56,
    topics: ['polaris', 'nps', 'customer-feedback', 'beta'],
  },
  {
    title: 'Snapshot worker thread spike-fix details',
    content:
      'PR #612: moved Y.encode + sha256 of snapshot into a worker thread. Before: blocked event loop 280-340ms every 30s at 200 users. After: <8ms event loop block (just for postMessage round-trip). Customers can no longer feel the snapshot.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 71,
    topics: ['polaris', 'worker-thread', 'performance', 'snapshot'],
  },
  {
    title: 'WebSocket gateway memory profile',
    content:
      "At 600 concurrent users on one shard: 480MB RSS, 280MB in WS connection state, 120MB in Y.Doc replicas, 80MB libuv/V8. Memory linear with users at ~800KB/user. Won't OOM until ~3500 users on a t3.large.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 92,
    topics: ['polaris', 'websocket', 'memory', 'profiling'],
  },
  {
    title: 'Acme procurement security questionnaire',
    content:
      'Acme sent 86 security questions. Top concerns: encryption at rest (yes, AES-256), data residency (US/EU options at GA), audit trail (yes, with 7-year retention), SOC2 (in progress, expected Q4). Sarah filled with eng review; Acme legal signed off.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 75,
    topics: ['polaris', 'acme', 'security', 'compliance'],
  },
  {
    title: 'Why server-side persistence not just WebRTC?',
    content:
      "Considered P2P via WebRTC + DHT. Killed because (1) NAT traversal blocked at Acme/Globex corporate networks, (2) compliance requires server-side audit log, (3) we'd need TURN servers anyway. Server-mediated WS won.",
    owner: 'bob',
    source: 'slack',
    daysAgo: 138,
    topics: ['polaris', 'webrtc', 'architecture', 'decision'],
  },
  {
    title: 'Shard rebalance on shard-add',
    content:
      "When we go from N to N+1 shards, modulo-shard moves 1/(N+1) of docs to the new shard. At 50 active rooms, that's ~5 forced reconnects. Acceptable. Consistent hashing only worth it past 20 shards.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 99,
    topics: ['polaris', 'sharding', 'rebalance', 'infra'],
  },
  {
    title: "Slack: Bob's last code review",
    content:
      'Bob\'s final approved PR was #618 (Sarah\'s palette override for Acme). His comment: "This is exactly the right shape - config, not code. Nice." Filed under "things that mattered."',
    owner: 'bob',
    source: 'slack',
    daysAgo: 22,
    topics: ['polaris', 'code-review', 'bob', 'culture'],
  },
  {
    title: 'On testing CRDTs - our approach',
    content:
      'Property-based tests via fast-check. We assert convergence: random sequences of ops applied in different orders to N replicas all converge. Found 2 real bugs this way (an awareness ordering issue, a delete-then-recreate ordering). Worth the slow CI.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 161,
    topics: ['polaris', 'testing', 'crdt', 'property-testing'],
  },
  {
    title: 'Notion vs us on multiplayer perf',
    content:
      "Sarah benchmarked Notion at 100 simultaneous editors on a doc. Notion's p50 cursor latency: 35ms. Ours: 48ms. Their advantage: dedicated server pool per workspace, so no cross-tenant noisy neighbor. Filed for v1.1: per-workspace shard affinity.",
    owner: 'sarah',
    source: 'slack',
    daysAgo: 84,
    topics: ['polaris', 'notion', 'competitive', 'performance'],
  },
  {
    title: 'GA launch checklist',
    content:
      '47 items. Hard blockers (5): selection-flicker fix (DONE), POLARIS-23 decision (PENDING), sharding for >700 users (60% done), Acme security signoff (DONE), GA marketing assets (DONE). Soft blockers: docs site, Loom intros, customer success runbook.',
    owner: 'sarah',
    source: 'linear',
    daysAgo: 24,
    topics: ['polaris', 'ga', 'launch', 'checklist'],
  },
  {
    title: 'Hooli evaluation - POC stalled on data residency',
    content:
      'Hooli evaluated Polaris for 3 weeks. Loved the latency. Killed the deal because we don\'t have EU data residency at GA. Sarah\'s response: "We will at v1.2; happy to design the rollout with you." Hooli: "Talk again in Q4."',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 38,
    topics: ['polaris', 'hooli', 'data-residency', 'prospect'],
  },
  {
    title: 'Why our delta log retention is 7 days',
    content:
      'Calculated from offline UX expectations (95% of users come back within 7 days), AWS storage cost ($0.023/GB-month for ~50GB delta logs), and replay perf (a 7-day delta replays in <500ms even for active rooms). 30-day retention discussed and rejected - 4x cost for 2% UX gain.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 110,
    topics: ['polaris', 'delta-log', 'retention', 'tradeoff'],
  },
  {
    title: 'Why awareness uses ephemeral state, not persistent',
    content:
      "Awareness (cursors, selections, presence) lives in Y.js's ephemeral protocol - never persisted. If you reload, your cursor is gone. Considered persisting; rejected because the data is meaningless 30s after the fact and would explode storage. Standard Y.js convention.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 158,
    topics: ['polaris', 'awareness', 'persistence', 'design'],
  },
  {
    title: 'Customer Success - Polaris training plan',
    content:
      "Each new Polaris customer gets: 30-min onboarding call, recorded walkthrough of admin panel, slack channel for support, monthly check-in for first 90 days. Owner: customer success (we don't have CS yet - Alex covers).",
    owner: 'alex',
    source: 'notion',
    daysAgo: 12,
    topics: ['polaris', 'customer-success', 'onboarding', 'process'],
  },
  {
    title: 'WebSocket reconnect storm: anatomy',
    content:
      'On deploy, 600 active connections drop within 200ms. Default exponential backoff with no jitter gives synchronized reconnects → server overload. Fix: jittered backoff (random 0-5s before first retry). Verified with chaos test.',
    owner: 'bob',
    source: 'github',
    daysAgo: 95,
    topics: ['polaris', 'websocket', 'reconnect', 'reliability'],
  },
  {
    title: 'Why the gateway is Node and not Go',
    content:
      "Considered Go for raw WS perf. Node won because (1) the team knows TS, (2) Y.js bindings exist for Node not Go (so we'd need to port), (3) at 700 users/shard the bottleneck is CRDT compute, not concurrent IO. Revisit if we hit 3000 users/shard.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 154,
    topics: ['polaris', 'node', 'golang', 'language-choice'],
  },
  {
    title: 'Customer asked: can two cursors share a color?',
    content:
      'Pied Piper noticed when 50+ users editing, occasionally two cursors look identical. Confirmed: golden-angle palette gives perceived collisions past ~30 users. Workaround: each user can override their cursor color. Long-term: switch to OKLab for better color separation.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 14,
    topics: ['polaris', 'cursor', 'color', 'customer-feedback'],
  },
  {
    title: 'Polaris cost per user analysis',
    content:
      'At 100 active users on Polaris: $42/month infra. Per-user cost dominated by Postgres I/O (snapshots) + WS gateway CPU. Pricing implication: 100-user customer at $30/seat = $3000 ARR; 1.4% infra cost. Margin healthy; scaling fine.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 67,
    topics: ['polaris', 'unit-economics', 'pricing', 'infra-cost'],
  },
  {
    title: 'Wayne Enterprises - strange request',
    content:
      'Wayne Enterprises asked: "Can we have Polaris with no cloud component?" They want everything air-gapped. Sarah: "That\'s self-hosted edition. Not in our v1 plan." Filed under enterprise-self-host as a 2027 question.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 51,
    topics: ['polaris', 'self-host', 'wayne', 'enterprise'],
  },
  {
    title: 'Loom: Bob walking through the gateway code',
    content:
      '14-min unlisted Loom recorded the day before Bob\'s sabbatical. He walks the WS gateway from accept() through to the per-shard Y.Doc lifecycle. Includes the "this is where it gets weird" warnings. Mandatory watch for anyone touching Polaris infra.',
    owner: 'bob',
    source: 'loom',
    daysAgo: 23,
    topics: ['polaris', 'walkthrough', 'infra', 'knowledge-transfer'],
  },
  {
    title: 'GA pricing: $30/seat for Team, included for Enterprise',
    content:
      'Decision: Polaris is $30/user/mo on Team plan, included on Enterprise. Rationale: drives upgrades. Sales pushed for $20 to lower friction; eng pushed for higher to reflect infra cost. Settled at $30 with sales review at 6 months.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 70,
    topics: ['polaris', 'pricing', 'team-plan', 'enterprise'],
  },
  {
    title: 'Acme data export request',
    content:
      'Acme legal asked: can users export their canvas + Polaris collab metadata at any time? Yes - we surface a JSON export of all docs + audit trail per workspace. GET /api/exports/full. Documented for their legal team.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 50,
    topics: ['polaris', 'acme', 'export', 'compliance'],
  },
  {
    title: 'Polaris feature flag rollout plan',
    content:
      'GA day: flag at 0%. T+1h: 5% of orgs. T+1d: 25%. T+3d: 100% if no incidents. Rollback by flipping flag. Each percentage triggers a Slack notification with metric snapshot. Plan in /docs/polaris/rollout.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 30,
    topics: ['polaris', 'feature-flag', 'rollout', 'launch'],
  },
  {
    title: "Why we don't support Internet Explorer",
    content:
      "Polaris uses WebSocket, ES modules, and CSS grid. IE11 is pre-WebSocket-extension support. We deprecated IE in 2024. Acme uses Edge company-wide. Initech still has IE pockets - they're aware.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 118,
    topics: ['polaris', 'browser-support', 'ie', 'frontend'],
  },
  {
    title: 'Document size at which Polaris starts to lag',
    content:
      'At 50k Y.js operations on a doc, initial load takes 1.8s. At 100k, 4.2s - perceptibly slow. Plan: snapshot+gc operations older than 30 days, replaying as a "compacted snapshot" + deltas for recent. POLARIS-72.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 88,
    topics: ['polaris', 'document-size', 'performance', 'compaction'],
  },
  {
    title: 'Slack: who carries the pager for Polaris GA?',
    content:
      'Decision: alex on first 2 weeks, then weekly rotation. Sarah willing to be on-call backup until end of June. Pager via PagerDuty service "polaris-prod". Runbook at /docs/polaris/oncall.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 7,
    topics: ['polaris', 'oncall', 'pagerduty', 'rotation'],
  },
  {
    title: 'What "complete" actually means for POLARIS-23',
    content:
      'POLARIS-23 (offline >7 days) needs: (1) IDB snapshot store, (2) reconnect handshake protocol, (3) UI to show "recovered changes from N days offline", (4) test fixtures for 30+ day offline gaps. Estimate: 14 days of senior engineer work.',
    owner: 'alex',
    source: 'linear',
    daysAgo: 4,
    topics: ['polaris', 'offline', 'scope', 'estimate'],
  },
  {
    title: 'Slack: what if we open-source the awareness layer?',
    content:
      'Sarah floated the idea: our custom selection-aware awareness layer is generic. Could open-source it. Bob: "yes, but maintain a fork until v15 of Y.js lands." Filed for post-GA.',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 89,
    topics: ['polaris', 'open-source', 'awareness', 'community'],
  },
  {
    title: 'GitHub Issue #634 - iOS Safari WS stall',
    content:
      "iOS Safari's ServiceWorker suspends WS during page transitions. Connection appears alive, but messages stall 2-30s. Workaround: detect via heartbeat-miss, force reconnect on resume. Fix in PR #639.",
    owner: 'sarah',
    source: 'github',
    daysAgo: 49,
    topics: ['polaris', 'ios', 'safari', 'bug'],
  },
  {
    title: 'POLARIS-66: persist cursor color preference',
    content:
      "User picks cursor color in their profile. Persist in `user_preferences.cursor_color_hex`. Server validates it's a valid hex. Default falls back to golden-angle assignment. 2-day fix.",
    owner: 'alex',
    source: 'linear',
    daysAgo: 3,
    topics: ['polaris', 'user-pref', 'cursor', 'small-fix'],
  },
  {
    title: 'Internal: dogfood week findings',
    content:
      'Internal team used Polaris for all canvas docs for 1 week. Pain points: (1) cursors hard to see on white backgrounds (low-contrast colors); (2) no "who\'s here" indicator outside the canvas; (3) no way to mute notifications during deep-work hours. All on backlog.',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 79,
    topics: ['polaris', 'dogfood', 'feedback', 'ux'],
  },
  {
    title: 'Stark Industries - strange compliance ask',
    content:
      'Stark requested: "All Polaris collab data must be queryable by an internal AI system for IP protection." They want a real-time stream. Sarah: "That\'s a webhooks-on-edit feature, not GA." Filed for v1.2.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 28,
    topics: ['polaris', 'stark', 'compliance', 'webhook'],
  },
  {
    title: 'Slack: should we GA without offline?',
    content:
      'POLARIS-23 still unresolved. Could we GA without it? Acme says no (they edit on flights). Northwind says yes (always-online). Decision: GA without; backport to all Polaris users in v1.1 (target: 6 weeks post-GA).',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 26,
    topics: ['polaris', 'ga', 'offline', 'decision'],
  },
  {
    title: 'Why Polaris docs live in /docs/polaris not /docs',
    content:
      'Future-proofing: when we ship more realtime products (canvas comments, voice notes, etc.), each gets its own /docs/<feature>. Avoids "one big collab section" sprawl. Decision in 2026-W12 docs review.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 122,
    topics: ['polaris', 'docs', 'organization', 'convention'],
  },
  {
    title: 'GA day-1 metrics target',
    content:
      'Targets for day 1: <10 incidents, p99 cursor latency <120ms across all customers, zero data-loss reports. Will chart in Grafana "polaris-ga" dashboard. Alex owns the dashboard.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 5,
    topics: ['polaris', 'ga', 'metrics', 'sli'],
  },
  {
    title: 'POLARIS-78: encrypted CRDT state at rest',
    content:
      'Compliance ask from healthcare prospect (not closed yet - code-named "MedTrack"). Need column-level encryption on `documents.crdt_state`. Options: pgcrypto (slow), app-level (faster, more code). Investigate for v1.2.',
    owner: 'sarah',
    source: 'linear',
    daysAgo: 65,
    topics: ['polaris', 'encryption', 'compliance', 'healthcare'],
  },
  {
    title: 'Notion: Polaris vs Liveblocks economics revisit',
    content:
      "Original analysis (build vs Liveblocks) at 5k MAU: $8k/mo vs $0 + 2 eng-months. We're now at 12k MAU and growing 25% MoM. Liveblocks would be $32k/mo today, $80k/mo in 6 months. Build was the right call.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 35,
    topics: ['polaris', 'liveblocks', 'build-vs-buy', 'economics'],
  },
  {
    title: 'Acme rollout phase 1 - 14 users for 30 days',
    content:
      "Started day 0 with 14 users on Acme's design team. After 30 days: zero data-loss reports, NPS +51, 3 feature requests (filed). Phase 2 (50 users) starts in 2 weeks. They're excited.",
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 32,
    topics: ['polaris', 'acme', 'rollout', 'customer-success'],
  },
  {
    title: 'Slack: the "selection across nested groups" nightmare',
    content:
      'When 2 users select overlapping nested groups, the selection rect math gets ambiguous. Bob spent 3 days on it. Solution: use the *innermost* common ancestor for visual rect, fall back to bounding box for outer groups. Specced in /docs/polaris/selection.',
    owner: 'bob',
    source: 'slack',
    daysAgo: 105,
    topics: ['polaris', 'selection', 'nested-groups', 'design'],
  },
  {
    title: 'Pied Piper feedback - they want voice',
    content:
      'PP: "Polaris is great but we want voice over the canvas." Out of scope. Filed under voice-canvas as 2027 exploration. PP: "We\'ll wait."',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 19,
    topics: ['polaris', 'pied-piper', 'voice', 'future'],
  },
  {
    title: 'GA blast radius - what could go wrong',
    content:
      'Worst case scenarios: (1) shard crash → 700 users disconnected, reconnect storm overwhelms gateway → cascading failure. Mitigation: jittered reconnect (done), per-shard rate limit on accept (done). (2) Y.js update bug corrupts CRDT state. Mitigation: snapshots replay-able to last good state.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 36,
    topics: ['polaris', 'disaster', 'blast-radius', 'risk'],
  },
]

// ── 2. Customer interactions (50) ───────────────────────────────────────────
const CUSTOMERS: MemoryDef[] = [
  {
    title: 'Acme intro call - designer Priya leads pitch',
    content:
      "First call with Acme. Their design lead Priya Kapoor pitched her team's collab pain to her CTO, who's on the call. They use Figma + Slack screen-share + lots of swearing. Demo went 12 min over because she demoed her own use case live. Verdict: hot prospect.",
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 188,
    topics: ['acme', 'customer-discovery', 'design', 'pitch'],
  },
  {
    title: 'Acme follow-up: 14 seats, $48k contract draft',
    content:
      'Two days after the demo, Priya emailed: "We want to commit to 14 seats for $48k/yr conditional on EOY GA delivery." Sales drafted MSA + DPA. Procurement timeline: 3 weeks. Sarah cc\'d for security questionnaire.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 184,
    topics: ['acme', 'contract', 'msa', 'sales'],
  },
  {
    title: 'Acme onboarding kickoff',
    content:
      'Priya + 3 team leads from Acme on the kickoff call. Walked through admin panel, RBAC, audit log demo. Their concern: "What if a user accidentally deletes a layer everyone\'s looking at?" Showed undo. They\'re comfortable.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 78,
    topics: ['acme', 'onboarding', 'admin', 'rbac'],
  },
  {
    title: 'Acme - security questionnaire returned',
    content:
      'Acme legal returned 86 questions answered. Two open items: (1) where exactly is data stored physically (we said us-east-1; they want us-west-2 backup), (2) encryption key rotation cadence (we said quarterly; they want monthly). Negotiating.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 75,
    topics: ['acme', 'security', 'questionnaire', 'compliance'],
  },
  {
    title: 'Acme expansion plan - 600 users by Q4',
    content:
      "Priya's expansion plan: design team (14) → product team (40 total) → engineering & marketing (140) → company-wide (600) by Q4. Each phase has gates: NPS > 30, no data-loss in 30 days. We have the spec.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 60,
    topics: ['acme', 'expansion', 'rollout', 'roadmap'],
  },
  {
    title: 'Northwind first call - 8 designers, no PM',
    content:
      "Northwind's design head, Aisha, runs an 8-person team. They're unhappy with Figma's comment threading. Want better realtime + comments. Polaris fits realtime; comments are next.",
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 174,
    topics: ['northwind', 'customer-discovery', 'figma', 'comments'],
  },
  {
    title: 'Northwind - switching from Miro for whiteboarding',
    content:
      "After 3 weeks of Polaris, Aisha's team switched off Miro for design workshops too. \"It's your canvas + collab; we don't need a separate whiteboard tool.\" Implication: Miro displacement is a pitch we can use elsewhere.",
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 52,
    topics: ['northwind', 'miro', 'displacement', 'use-case'],
  },
  {
    title: 'Northwind - request for Slack notifications on @mention',
    content:
      'Northwind designers want a Slack notification when @-mentioned in a Polaris comment. Comments aren\'t in Polaris yet. Filed as comment-feature dependency. Aisha: "Take your time; we\'ll wait."',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 44,
    topics: ['northwind', 'slack', 'notifications', 'feature-request'],
  },
  {
    title: 'Globex pilot scoping call',
    content:
      'Globex CTO + 4 engineers on the call. Asked detailed questions about CRDT internals, data ownership, export. They\'re evaluating Polaris vs building in-house. Demo went well; verdict from Globex side: "impressive but we\'ll talk to our team."',
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 169,
    topics: ['globex', 'evaluation', 'crdt', 'technical'],
  },
  {
    title: 'Globex - they went silent',
    content:
      "Sent 3 follow-ups over 3 weeks. No response. Theory: their internal champion is no longer there (LinkedIn shows him at Stripe now). Don't prioritize. Move to nurture sequence.",
    owner: 'alex',
    source: 'gmail',
    daysAgo: 40,
    topics: ['globex', 'silent', 'churn-risk', 'nurture'],
  },
  {
    title: 'Hooli evaluation summary',
    content:
      'Hooli tested Polaris for 3 weeks across 6 designers. Liked: latency, cursor smoothness, cleanliness of UI. Killed deal because they\'re EU-based and need data residency in Frankfurt - not at GA. Sarah: "v1.2." Hooli: "Talk Q4."',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 38,
    topics: ['hooli', 'eu', 'data-residency', 'prospect'],
  },
  {
    title: "Initech eval - they're building it themselves",
    content:
      "Initech's eng lead, Marco, said quietly that they're prototyping their own collab in Y.js. Saw our pricing as 4x what they'd build for. Don't expect them to convert this year. Set Q3 follow-up to see if they realize how hard it is.",
    owner: 'alex',
    source: 'gmail',
    daysAgo: 41,
    topics: ['initech', 'build-vs-buy', 'prospect', 'self-build'],
  },
  {
    title: 'Pied Piper outreach - they found us via HN',
    content:
      'Cold outreach: "Saw your HN post about CRDT for design tools. We have a different problem (compression) but love your tech." 30-min call. They\'re too small to be a customer ($300 ARR potential) but interesting tech network.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 56,
    topics: ['pied-piper', 'hacker-news', 'tech-network', 'outreach'],
  },
  {
    title: 'Stark Industries first call - they want air-gapped',
    content:
      'Stark CISO and design lead on the call. Their requirement: "We can\'t have anything leave our datacenter." That\'s self-hosted Polaris, which we don\'t offer. Sarah: "We don\'t do air-gapped today; not on roadmap until v2." Stark: "Then we can\'t use this." Polite end.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 51,
    topics: ['stark', 'air-gapped', 'self-host', 'no-fit'],
  },
  {
    title: 'Wayne Enterprises - odd fit',
    content:
      'Wayne wants Polaris. They want it to integrate with their internal AI system for "IP scanning." Design lead is enthusiastic; their CISO is wary. Sarah: "Let\'s talk to your CISO directly." Pending.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 39,
    topics: ['wayne', 'ai-integration', 'ciso', 'prospect'],
  },
  {
    title: 'Acme: complaint about cursor color',
    content:
      'Priya: "Some of our cursors look red. Our brand forbids that red specifically." Sarah pushed a per-org cursor-palette override the same week. Acme thrilled.',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 142,
    topics: ['acme', 'cursor', 'branding', 'quick-win'],
  },
  {
    title: 'Acme: bug report - cursor flicker',
    content:
      'Priya filed a bug: cursor flickers when 5+ users have overlapping selections. Sarah reproduced, Bob fixed (PR #523), shipped to Acme within 4 days. Priya: "This is what good vendor support looks like."',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 50,
    topics: ['acme', 'bug-report', 'quick-fix', 'customer-love'],
  },
  {
    title: 'Acme: feature request - comment threads',
    content:
      'Acme\'s next ask after Polaris GA: comment threads anchored to canvas regions. Sarah: "On Q3 roadmap as a separate feature." Acme: "How early in Q3?" Sarah: "July." Acme: "We\'ll commit to expanded contract on July delivery."',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 29,
    topics: ['acme', 'comments', 'q3', 'expansion-deal'],
  },
  {
    title: 'Acme: bug - undo across user actions',
    content:
      'Priya filed: "User A creates a frame, user B deletes it, user A presses Cmd+Z and nothing happens." Per CRDT design, undo is per-user. Documented & shipped a help-text in the editor. Priya: "OK, that\'s actually correct behavior."',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 88,
    topics: ['acme', 'undo', 'crdt-design', 'expected-behavior'],
  },
  {
    title: 'Northwind: feature request - palette override',
    content:
      'Aisha asked the same as Acme: per-org cursor color override. Already shipping. Aisha thrilled. Took 1 week.',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 100,
    topics: ['northwind', 'cursor', 'palette', 'feature-request'],
  },
  {
    title: 'Globex: question about export',
    content:
      'Before they went silent, Globex asked: "How do we export everything if we leave?" Sarah: "GET /api/exports/full - returns a tar of canvas + audit + collab metadata." Filed for documentation.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 165,
    topics: ['globex', 'export', 'data-portability', 'vendor-lock'],
  },
  {
    title: 'Hooli: technical deep-dive on data residency',
    content:
      'Hooli\'s lead engineer asked: "What changes if you offer EU data residency? Region-specific S3? Per-region Postgres? Cross-region failover behavior?" Sarah\'s answer: dedicated EU postgres, EU-only S3, no cross-region failover at v1.2. Hooli accepted; we just need to ship.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 28,
    topics: ['hooli', 'data-residency', 'eu', 'technical'],
  },
  {
    title: 'New prospect: Massive Dynamic - 90 designers',
    content:
      'Inbound from Massive Dynamic. Their design org: 90 designers across 12 sub-teams. Looking for one tool to consolidate Figma + Miro + Slack collab. Sarah scheduled discovery call. Big potential ($300k+ ARR).',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 14,
    topics: ['massive-dynamic', 'inbound', 'enterprise', 'high-ticket'],
  },
  {
    title: 'Q1 win - Acme contract signed',
    content:
      'After 2 months of pilot + procurement, Acme\'s 14-seat $48k contract signed Tuesday. Their CTO sent a personal email: "Looking forward to expansion." Champagne in the office.',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 75,
    topics: ['acme', 'contract-signed', 'win', 'q1'],
  },
  {
    title: 'Q1 loss - Hooli lost to a competitor',
    content:
      'Hooli had been evaluating us and Notion AI. They went with Notion AI for their wider product needs. Polaris was good but they wanted everything in one tool. Lesson: lead with platform story, not single feature.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 38,
    topics: ['hooli', 'loss', 'notion-ai', 'platform'],
  },
  {
    title: 'Customer success metric: time-to-first-collab-edit',
    content:
      'Defined: time from new user signup → first real collab edit (where 2+ users editing same doc within 60s). Avg today: 14 minutes. Target: <5 min. Driver: better empty-state and a "demo room" they can join.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 11,
    topics: ['customer-success', 'metric', 'onboarding', 'time-to-value'],
  },
  {
    title: 'Acme: training session feedback',
    content:
      "After the 30-min Polaris training, Acme's designers reported: 6/14 already used Polaris in a real session that afternoon. Highest immediate-adoption we've seen. The training is working.",
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 70,
    topics: ['acme', 'training', 'adoption', 'metrics'],
  },
  {
    title: 'Northwind: their workflow without Polaris',
    content:
      'How they used to work: 1 designer would record a Loom of changes, post to Slack with @mentions; 30+ min iteration loop. With Polaris: 0 latency. Aisha: "It\'s like getting back 4 hours a week per person."',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 48,
    topics: ['northwind', 'workflow', 'before-after', 'productivity'],
  },
  {
    title: "Quote from Acme that we're using in marketing",
    content:
      '"Polaris is the feature we\'ve been waiting two years for. It\'s like having my designers in the same room." - Priya Kapoor, VP Design, Acme Inc.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 50,
    topics: ['acme', 'quote', 'marketing', 'testimonial'],
  },
  {
    title: 'Customer ask: API access for their internal tools',
    content:
      'Acme wants programmatic access - "create rooms via API; manage members via API." We have docs API; Polaris API exists. Filed: write a Polaris API doc page.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 65,
    topics: ['acme', 'api', 'integration', 'programmatic'],
  },
  {
    title: 'Beta-2 cohort selection criteria',
    content:
      'After Beta-1 (Acme/Northwind/Globex), Beta-2 will include: 5-10 customers, mix of design + product + eng use cases, mix of company sizes (50-500 employees). No more enterprise pilots until v1.1.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 55,
    topics: ['beta', 'cohort', 'customer-criteria', 'planning'],
  },
  {
    title: 'Acme contract renewal projection',
    content:
      "Year-2 renewal: assuming Polaris stays stable, expansion to 100 seats = $360k ARR (vs $48k Y1). We'll know by Q3 when they decide.",
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 45,
    topics: ['acme', 'renewal', 'expansion', 'arr'],
  },
  {
    title: 'Win/loss interview - Globex',
    content:
      'Reached out to Globex for a win/loss interview. Their CTO: "Honestly? We thought we could build this. After 2 weeks of trying, we know we can\'t." Maybe re-engage Q3.',
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 18,
    topics: ['globex', 'win-loss', 're-engagement', 'build-vs-buy'],
  },
  {
    title: 'Customer dashboard mockup - what to show',
    content:
      'Customer wants: "Show me activity, MAU, top contributors, busy times." Mockup in Figma. Owner: customer success (which is alex). Ship in v1.1.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 8,
    topics: ['customer-dashboard', 'mockup', 'analytics', 'v1.1'],
  },
  {
    title: 'Onboarding email sequence - V2',
    content:
      'Day 0: welcome + first room link. Day 1: "have you tried inviting a teammate?" Day 3: case study (Acme). Day 7: customer success contact. Day 14: NPS prompt. Owner: alex.',
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 10,
    topics: ['onboarding', 'email', 'sequence', 'customer-success'],
  },
  {
    title: 'Massive Dynamic discovery call',
    content:
      'Their design lead, Marcus, brought 4 senior designers. Polaris demo went 22 min, all questions about scaling. They have 90 designers across timezones; they specifically asked: "Can you handle that we\'re US/EU/Asia?" Yes.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 11,
    topics: ['massive-dynamic', 'discovery', 'scale', 'timezones'],
  },
  {
    title: 'Massive Dynamic: pricing for 90 seats',
    content:
      'At $30/seat × 90 = $32.4k ARR. Sarah pitched annual prepay at $324k for 100% of designers + admin tools. Marcus: "Talk to procurement."',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 7,
    topics: ['massive-dynamic', 'pricing', 'enterprise', 'negotiation'],
  },
  {
    title: 'Customer use case - design system management',
    content:
      'Several customers (Acme, Northwind) use Polaris to manage their design system docs. Specifically: changes to component definitions land in Polaris first, then propagate to Figma. Pattern worth productizing.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 22,
    topics: ['use-case', 'design-system', 'figma', 'adjacent-product'],
  },
  {
    title: 'Customer feedback theme: cursor smoothness',
    content:
      'Across 7 customer conversations: "cursors feel smooth" came up 6 times. This is a moat we should protect. Don\'t regress cursor latency without consensus.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 16,
    topics: ['feedback', 'cursor', 'smoothness', 'moat'],
  },
  {
    title: 'Sales playbook v1: who to call',
    content:
      'Target: design-led companies, 50-500 employees, currently using Figma + Slack + Miro + Notion. Decision-makers: VP Design, Head of Design, Design Ops Lead. Pain: "design system changes get lost in Slack."',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 80,
    topics: ['sales-playbook', 'icp', 'target-customer'],
  },
  {
    title: 'Customer Q from Hooli - encryption keys',
    content:
      '"Who controls the encryption keys for our Polaris collab data?" Today: AWS KMS, our account. They want BYOK (customer-managed keys). Filed for v1.2 enterprise tier.',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 31,
    topics: ['hooli', 'byok', 'encryption', 'enterprise'],
  },
  {
    title: 'Polaris ABM list - top 10 prospects Q2',
    content:
      '1. Acme (already converting); 2. Northwind (already converting); 3. Massive Dynamic (in discovery); 4. Hooli (waiting on data residency); 5. Stark (no fit, air-gapped); 6. Wayne (still pending); 7. Initech (build-vs-buy); 8. Pied Piper (too small); 9. Globex (silent); 10. Tinhead (cold).',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 34,
    topics: ['abm', 'prospects', 'q2', 'sales'],
  },
  {
    title: 'Tinhead - cold outreach response',
    content:
      'Tinhead\'s design VP replied: "We use Figma + custom internal tooling. Open to a demo if you can show 30% productivity uplift." Sarah scheduled discovery in 2 weeks. Long-cycle.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 9,
    topics: ['tinhead', 'cold-outreach', 'prospect', 'long-cycle'],
  },
  {
    title: 'Customer onboarding playbook - v1.0',
    content:
      '1. Welcome email + admin panel walkthrough; 2. Demo room with sample data; 3. Live training (30 min); 4. Slack channel for support; 5. 30-day NPS survey; 6. Quarterly business review. Drafted in /docs/onboarding-playbook.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 100,
    topics: ['onboarding', 'playbook', 'customer-success', 'process'],
  },
  {
    title: 'Acme RBAC permissions matrix',
    content:
      'Acme requested: admin, editor, viewer, guest (no edit). Sarah added guest role to RBAC. Acme: "Perfect." Now in product for all customers.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 90,
    topics: ['acme', 'rbac', 'guest', 'permissions'],
  },
  {
    title: 'NPS data summary - Q1',
    content:
      'Q1 NPS across 3 beta customers: average +37 (weighted by users). Promoters: Priya (Acme), Aisha (Northwind), VP Design at Hooli. Detractors: 1 Northwind designer (cursor flicker - fixed). Promoter rate: 64%.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 50,
    topics: ['nps', 'q1', 'metrics', 'customer-feedback'],
  },
  {
    title: 'Customer support response time SLA',
    content:
      "Drafted: respond within 4 business hours for incidents, 1 business day for non-incidents. Currently we're at 2 hours and 6 hours respectively. Better than SLA. Ship to website.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 13,
    topics: ['support', 'sla', 'response-time', 'customer-success'],
  },
  {
    title: 'Customer churn risk analysis - Q1 cohort',
    content:
      'Of 3 beta customers, Globex went silent (churn risk: high). Acme + Northwind committed to GA. Globex churn cost: $0 (no contract yet). Lessons: identify champion + their leverage early.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 40,
    topics: ['churn', 'q1', 'globex', 'customer-success'],
  },
  {
    title: 'Demo script v3 - what works',
    content:
      'Updated demo script after 8 customer demos. New flow: live multi-user editing → cursor magic → conflict resolution → permissions → security & audit. Conversion rate: 60% (was 40%).',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 95,
    topics: ['demo', 'script', 'conversion', 'sales-enablement'],
  },
  {
    title: 'Customer voice: Polaris vs Miro head-to-head',
    content:
      'Northwind: "Miro is for whiteboarding sessions; Polaris is for working sessions on real artifacts. We use both for now but Polaris is winning more share each week." Filed under positioning.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 25,
    topics: ['miro', 'positioning', 'customer-voice', 'competitive'],
  },
]

// ── 3. Hiring (40) ──────────────────────────────────────────────────────────
const HIRING: MemoryDef[] = [
  {
    title: 'Senior Engineer JD - final draft',
    content:
      "Updated JD after Sarah's departure. New phrasing: \"You'll own a major feature end-to-end with the founder. We don't do tickets-by-PM; we do problem-by-engineer.\" Sourcing target: 5 yrs+ in distributed systems or design tools.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 26,
    topics: ['hiring', 'senior-eng', 'jd'],
  },
  {
    title: 'Priya M. phone screen',
    content:
      "30-min call with Priya M., ex-Stripe SRE, 6 yrs experience. Strong on observability and reliability. Looking for a smaller team after Stripe scale. Concern: hasn't worked on realtime systems specifically. Decision: advance to system design.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 24,
    topics: ['hiring', 'priya-m', 'phone-screen', 'sre'],
  },
  {
    title: 'Priya M. system design - multi-region read replicas',
    content:
      '60-min interview. Design a globally-distributed Polaris with EU/US replicas, eventual consistency, conflict resolution. She nailed it: identified write-master-per-region, CRDT-friendly partitioning, async replication with read-your-writes. Strong hire.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 22,
    topics: ['hiring', 'priya-m', 'system-design', 'distributed'],
  },
  {
    title: 'Priya M. cultural fit',
    content:
      'Founder + 1 other engineer interviewed. She asked about pace, process, on-call. Said: "I want a place where I can ship in 2 weeks not 2 quarters." Aligned with our culture. Strong yes.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 20,
    topics: ['hiring', 'priya-m', 'culture-fit', 'process'],
  },
  {
    title: 'Priya M. offer letter draft',
    content:
      "$220k base, 0.4% equity, $30k signing, 22 days PTO. Standard package. Sarah's replacement-level. Sent. Awaiting decision.",
    owner: 'alex',
    source: 'gmail',
    daysAgo: 18,
    topics: ['hiring', 'priya-m', 'offer', 'compensation'],
  },
  {
    title: 'Priya M. accepted!',
    content:
      'Offer accepted. Start date: 4 weeks. Plan: pair with alex on Polaris GA, then own offline+sharding work. Hiring win.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 11,
    topics: ['hiring', 'priya-m', 'accepted', 'team-news'],
  },
  {
    title: 'James K. phone screen - eng role',
    content:
      'James, 4 yrs at Google, embedded system experience. Strong on type systems but less hands-on on async. Felt eager. Advance to technical.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 50,
    topics: ['hiring', 'james-k', 'phone-screen', 'google'],
  },
  {
    title: 'James K. take-home review',
    content:
      'Take-home: build a small Y.js-based collaborative todo list. He delivered in 2 days. Code is clean but missing tests. Pass on style; concern on test discipline. Advance with note.',
    owner: 'alex',
    source: 'github',
    daysAgo: 47,
    topics: ['hiring', 'james-k', 'take-home', 'code-quality'],
  },
  {
    title: 'James K. decline - went to Anthropic',
    content:
      'James withdrew - got a competing offer at Anthropic for a system role. We were a close second. Lesson: speed up the process; we lost him to a 1-week-faster pipeline.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 35,
    topics: ['hiring', 'james-k', 'withdrawal', 'speed'],
  },
  {
    title: 'Aditi S. phone screen',
    content:
      '30-min with Aditi S., 5 yrs frontend at Linear. Strong on React, motion design, performance. Wanted to do more backend; we said: "You\'ll do both here." Advance to technical.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 39,
    topics: ['hiring', 'aditi-s', 'phone-screen', 'frontend'],
  },
  {
    title: 'Aditi S. technical interview',
    content:
      'Live coding: implement a debounced search with cancellation + AbortController. Did it perfectly in 35 min. Then optimized to use signals for cancel-by-id. Excellent. Advance.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 36,
    topics: ['hiring', 'aditi-s', 'live-coding', 'frontend'],
  },
  {
    title: 'Aditi S. system design',
    content:
      "60-min: design Polaris' frontend collab layer. She thought through awareness, cursor sync, conflict UI. Strong on UX considerations; weaker on how to wire to the backend stream. With more context she'd crush it. Advance.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 33,
    topics: ['hiring', 'aditi-s', 'system-design', 'frontend'],
  },
  {
    title: 'Aditi S. offer + decline',
    content:
      "Offered $200k + 0.35% equity. She declined for Stripe. Same lesson as James: we're competing for top design-tool engineers in the broader Bay Area FTE market. Don't cheap out on offers.",
    owner: 'alex',
    source: 'gmail',
    daysAgo: 28,
    topics: ['hiring', 'aditi-s', 'decline', 'market-rate'],
  },
  {
    title: 'Marco F. - referral from Sarah',
    content:
      'Sarah referred Marco F. from her old team at Anthropic. Backend, 3 yrs, looking for smaller. Phone screen scheduled.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 21,
    topics: ['hiring', 'marco-f', 'referral', 'anthropic'],
  },
  {
    title: 'Marco F. phone screen',
    content:
      'Strong communicator, good systems thinking. Concern: only 3 yrs experience for senior role. Decision: advance but discuss leveling.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 18,
    topics: ['hiring', 'marco-f', 'phone-screen', 'leveling'],
  },
  {
    title: 'Marco F. decision - hire as mid-level',
    content:
      'Decision: hire at mid-level title with senior IC trajectory. He accepted (fast process, less risk). Start: 3 weeks.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 11,
    topics: ['hiring', 'marco-f', 'accepted', 'mid-level'],
  },
  {
    title: 'Hiring funnel - Q1 numbers',
    content:
      'Q1: 240 inbound applications, 60 phone screens, 22 take-homes, 12 finals, 3 offers, 2 accepts (Priya M. + Marco F.). Acceptance rate: 67%. Sourcing: most from referrals + LinkedIn. Plan to scale Q2.',
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 18,
    topics: ['hiring', 'funnel', 'q1', 'metrics'],
  },
  {
    title: "Sarah's farewell - what she'd look for in her replacement",
    content:
      'From her exit interview: "Find someone who treats CRDTs as first-class infra knowledge, not a fun toy. They\'ll inherit a tricky codebase. They need patience for edge cases." Filed for hiring rubric.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 22,
    topics: ['hiring', 'sarah', 'rubric', 'crdt-experience'],
  },
  {
    title: 'Engineering ladder rubric',
    content:
      'Drafted: junior, mid, senior, staff. Each level: scope, autonomy, impact. Used in offer leveling decisions. Reviewed quarterly. Owner: alex (founder).',
    owner: 'alex',
    source: 'notion',
    daysAgo: 92,
    topics: ['hiring', 'ladder', 'leveling', 'engineering-culture'],
  },
  {
    title: 'Take-home design - what we ask',
    content:
      'Standard prompt: "Build a small collaborative app that demonstrates conflict resolution. Use any tech. Time-bound to 4 hours of focused work. Submit a Loom or written walkthrough." 4 hours forces tradeoffs; reveals style.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 40,
    topics: ['hiring', 'take-home', 'rubric', 'collaborative-skill'],
  },
  {
    title: 'Hiring debate - should we ask LeetCode?',
    content:
      'Sarah: "No." Bob: "Maybe one easy." Alex: "Take-home demonstrates real ability better." Decision: no LeetCode. Take-home + system design + collab interview = signal.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 105,
    topics: ['hiring', 'leetcode', 'interview-style', 'culture'],
  },
  {
    title: 'Hiring decision - pass on Eleanor',
    content:
      'Eleanor: 8 yrs, big-company senior. Strong technically. Cultural fit weak - wanted predictable process, big ownership-of-team. We\'re flat & messy. Pass with regret. Filed: "good in 5 yrs when we have process."',
    owner: 'alex',
    source: 'notion',
    daysAgo: 78,
    topics: ['hiring', 'eleanor', 'culture-fit', 'passed-on'],
  },
  {
    title: 'Recruiting brief for senior engineer Q3',
    content:
      'Q3 hiring brief: senior engineer, full-stack, with realtime/distributed-systems experience. Recruiter: Justfocus. Compensation: $200-240k base. Equity: 0.3-0.4%.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 14,
    topics: ['hiring', 'q3', 'senior-eng', 'recruiter'],
  },
  {
    title: 'Reference check - Priya M. with Stripe colleague',
    content:
      'Reference, ex-Stripe staff engineer. "Priya is a force multiplier. She raised the bar on observability for our team. Solid IC; not a manager." Strong reference.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 22,
    topics: ['hiring', 'priya-m', 'reference', 'stripe'],
  },
  {
    title: 'Designer hiring - when?',
    content:
      "Sarah suggested we hire a designer Q3. Currently Bob has been doing UI design (he's OK at it). Designer would unblock Polaris UX polish. Approved for Q3 hiring.",
    owner: 'sarah',
    source: 'slack',
    daysAgo: 65,
    topics: ['hiring', 'designer', 'q3', 'team-design'],
  },
  {
    title: 'Customer Success hiring - when?',
    content:
      'Currently alex is doing customer success. As we approach 10 customers, this becomes the constraint. Q3: hire CS Manager. Profile: ex-Linear, ex-Notion, or similar. Strong process orientation.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 30,
    topics: ['hiring', 'customer-success', 'q3', 'team-design'],
  },
  {
    title: 'Engineering org design - 6-month vision',
    content:
      'Today: alex (founder, full-stack), Marco (mid). Sarah replacement: Priya M. (senior). Next: + 1 senior backend, + 1 senior frontend. Target: 6 ICs by EOY. Specialization later.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 5,
    topics: ['hiring', 'org-design', '6-month', 'team-growth'],
  },
  {
    title: "Slack: Sarah's replacement is starting",
    content:
      '@channel: Priya M. starts Monday. Plan: pair with alex on Polaris GA, then own offline+sharding. Welcome her in #intros.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 9,
    topics: ['hiring', 'priya-m', 'onboarding', 'team-news'],
  },
  {
    title: 'Onboarding plan for Priya M.',
    content:
      'Week 1: pair on Polaris GA prep. Week 2: ship POLARIS-23 (offline) - solo with code review. Week 3: own her first incident (theoretical). Week 4: 1:1 review.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 8,
    topics: ['onboarding', 'priya-m', 'plan', 'first-month'],
  },
  {
    title: 'Slack: did we lose anyone besides Sarah?',
    content:
      'AMA question: "Did Sarah\'s departure trigger anyone else?" Answer: "Bob took sabbatical for unrelated reasons (burnout pre-Sarah). Priya M. coming in. Healthy team."',
    owner: 'alex',
    source: 'slack',
    daysAgo: 19,
    topics: ['hiring', 'retention', 'team-health', 'transparency'],
  },
  {
    title: 'Engineering culture writeup',
    content:
      'We value: ship fast, document decisions, write tests for the painful stuff, no hero culture. Drafted in /docs/internal/eng-values. Reviewed quarterly.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 47,
    topics: ['culture', 'values', 'engineering', 'documentation'],
  },
  {
    title: 'Comp philosophy doc',
    content:
      "We pay 60th percentile market. Equity is meaningful. We don't have a public ladder yet but we will at 10 ICs. Trust + transparency on raises. Drafted internal.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 60,
    topics: ['comp', 'philosophy', 'equity', 'transparency'],
  },
  {
    title: 'Slack: we use Linear for hiring',
    content:
      'Decided to use Linear for hiring pipeline (board view: applied → screening → take-home → finals → offer). Cleaner than Notion for stages.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 75,
    topics: ['hiring', 'linear', 'tooling', 'process'],
  },
  {
    title: 'Diversity reflection Q1',
    content:
      'Of Q1 hires (2 IC), 1 woman, 1 man. Ethnically: 1 South Asian, 1 European. Of pipeline: 38% women applicants, 32% women in finals. We can do better. Plan: more sourcing from women-in-tech communities Q2.',
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 35,
    topics: ['diversity', 'q1', 'hiring', 'reflection'],
  },
  {
    title: 'Interview rubric - culture fit',
    content:
      'Culture fit signal: (1) curiosity (do they ask hard questions?), (2) ownership (do they own outcomes?), (3) directness (can they push back?). Avoid: "vibes". Always specific examples.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 88,
    topics: ['culture-fit', 'rubric', 'interview', 'signal'],
  },
  {
    title: 'Hiring outreach experiment - open-ended posts',
    content:
      'Tested: rather than "we\'re hiring," wrote a deep technical post about a Polaris challenge. Got 12 inbound: 8 strong. Lesson: substance attracts.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 55,
    topics: ['hiring', 'sourcing', 'content', 'experiment'],
  },
  {
    title: 'Compensation benchmark - Q1',
    content:
      "Looked at Levels.fyi for senior eng in our region. Base $200-260k, equity 0.3-0.5%. We're paying $220k + 0.35% - middle of range. Can flex up for top candidates.",
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 50,
    topics: ['comp', 'benchmark', 'levels', 'q1'],
  },
  {
    title: 'Slack: should we have a remote team?',
    content:
      'Debate: full remote vs hub-with-flex. Decision: hub-with-flex. Bandra office, 2 days/week mandatory in person. Allows for global hires with travel.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 43,
    topics: ['remote', 'culture', 'office', 'policy'],
  },
  {
    title: 'Reference call template',
    content:
      'Standard reference call: 30 min. Q1: "What was [candidate]\'s biggest impact on the team?" Q2: "Where would they struggle in a startup?" Q3: "Would you hire them again?" 3 questions, lots of follow-up.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 100,
    topics: ['reference', 'template', 'interview', 'process'],
  },
  {
    title: 'Hiring volume Q2 plan',
    content:
      'Q2 plan: 4 hires. 2 senior eng, 1 designer, 1 customer success. ARR-driven hiring (each hire predicates on a milestone). Tracked in Linear.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 12,
    topics: ['hiring', 'q2', 'plan', 'headcount'],
  },
]

// ── 4. Strategy & OKRs (40) ─────────────────────────────────────────────────
const STRATEGY: MemoryDef[] = [
  {
    title: 'Q2 OKR: ship Polaris GA on May 30',
    content:
      'Owner: alex. Sub-KRs: (1) Polaris GA on May 30 (committed to Acme), (2) 5 paying customers by EOQ, (3) zero data-loss incidents in first 30 days. Success = all 3.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 28,
    topics: ['okrs', 'q2', 'polaris', 'ga'],
  },
  {
    title: 'Q2 OKR: NPS > 40',
    content:
      'Owner: sarah (then alex). Targeted 40 NPS across all customers. Today: 37. Path to 40: ship POLARIS-23 (offline) + close cursor color flicker.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 28,
    topics: ['okrs', 'q2', 'nps', 'customer-experience'],
  },
  {
    title: 'Competitive analysis - Notion AI',
    content:
      'Notion shipped Notion AI as their wedge into our space. Different angle: their AI is for writing/summarizing within Notion. Ours is for retrieval across all sources. Less direct conflict than feared. Watch for them adding multiplayer canvas.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 50,
    topics: ['competitive', 'notion-ai', 'strategy', 'analysis'],
  },
  {
    title: "Competitive analysis - Linear's collab moves",
    content:
      "Linear added comments-on-tickets-with-realtime-edit. Similar approach to Polaris. Linear focuses on issues; we focus on canvas. Different domains, but they're building the muscle.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 60,
    topics: ['competitive', 'linear', 'strategy', 'realtime'],
  },
  {
    title: 'Competitive analysis - Figma multiplayer evolution',
    content:
      "Figma's multiplayer is industry-leading. They have ~5 yrs head-start. Our wedge: smaller teams, deeper Polaris-style features (cursor presence + selection awareness) without Figma's scale-tax. Sustainable because Figma is enterprise-priced.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 75,
    topics: ['competitive', 'figma', 'wedge', 'positioning'],
  },
  {
    title: 'Series A fundraising plan - early notes',
    content:
      "Targeting Q3 close. Need: $5M+ ARR run rate (we're at $3.2M), 120% net retention (we're at 115%), 18 months runway post-close. Investor target: 2-3 VC term sheets.",
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 45,
    topics: ['series-a', 'fundraising', 'q3', 'metrics'],
  },
  {
    title: 'Investor update - March',
    content:
      "ARR $3.2M (+18% MoM). Polaris in beta with 3 customers. Hiring: 2 hires in pipeline. Burn $200k/mo. Runway 18 months. Highlights: Acme contract signed, Polaris stable in beta. Lowlights: Sarah's departure.",
    owner: 'alex',
    source: 'gmail',
    daysAgo: 65,
    topics: ['investor', 'update', 'march', 'metrics'],
  },
  {
    title: 'Investor update - April',
    content:
      'ARR $3.5M (+9%). Polaris GA on track for May 30. Acme contract signed, Northwind contract signed. New hire: Priya M. (senior eng). Burn $200k. Runway 18 months. Highlights: customer momentum, GA on track.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 35,
    topics: ['investor', 'update', 'april', 'metrics'],
  },
  {
    title: "Roadmap planning - what we're NOT doing",
    content:
      'Decided to drop: AI-suggestions feature (consensus tabled), real-time chat (out of scope), advanced commenting (Q3 separate feature). Focus = Polaris GA + foundational hardening.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 70,
    topics: ['roadmap', 'prioritization', 'focus', 'no-list'],
  },
  {
    title: 'Pricing experiment - $20 vs $30 vs $45',
    content:
      'Tested in Q1. $20: 16% conversion, 40% 90-day retention. $30: 12% conversion, 75% retention. $45: 6% conversion, 65% retention. $30 wins on LTV. Settling.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 80,
    topics: ['pricing', 'experiment', 'q1', 'data'],
  },
  {
    title: 'Marketing: Polaris launch plan',
    content:
      'Coordinated launch: blog post + Loom demo + HN submission + customer case study (Acme) + LinkedIn post + waitlist email blast. Owner: founder + designer. Soft launch on May 30, hard launch May 31.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 22,
    topics: ['marketing', 'launch', 'plan', 'polaris-ga'],
  },
  {
    title: 'Hacker News timing strategy',
    content:
      'Best HN time for B2B SaaS: Tuesday 8am PT. We\'ll post May 31 with title "We built realtime collab from scratch - here\'s what we learned." Substance > marketing language.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 18,
    topics: ['marketing', 'hacker-news', 'timing', 'launch'],
  },
  {
    title: 'Customer case study - Acme',
    content:
      'Drafted case study with Priya from Acme. Title: "How Acme\'s 14-person design team replaced Figma + Slack screen-share with one tool." 800 words, 2 quotes, 1 metric. Approved by Acme. Publishing on May 30.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 10,
    topics: ['case-study', 'acme', 'marketing', 'content'],
  },
  {
    title: 'Brand refresh planning',
    content:
      "Considering a brand refresh ahead of Series A. Logo feels dated; visual identity feels 2022. Designer hire (Q3) will own. Don't rush.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 95,
    topics: ['brand', 'refresh', 'design', 'q3'],
  },
  {
    title: 'Q1 OKR retro',
    content:
      'Q1: 7/12 KRs hit. Engineering: 4/4 (Polaris alpha shipped on time, hybrid search live). Sales: 1/3 (Acme signed but other 2 enterprise targets slipped). Product: 2/3 (NPS goal missed by 5 points).',
    owner: 'alex',
    source: 'notion',
    daysAgo: 90,
    topics: ['okrs', 'q1', 'retro', 'metrics'],
  },
  {
    title: 'Vision doc - 5-year',
    content:
      'By 2030: 100k+ orgs using Cognia, every major AI assistant integrates with us via MCP, $50M+ ARR, IPO-track or strategic acquirer. Path: become the team-knowledge graph that every AI grounds itself on.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 30,
    topics: ['vision', '5-year', 'strategy', 'company'],
  },
  {
    title: 'Pricing tier expansion plan',
    content:
      'Today: Free, Team ($30/seat), Enterprise (custom). Adding: Founder ($15/seat for 2-5 people, no Polaris). Driver: top-of-funnel for solo PMs / designers. Launch with Polaris GA.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 55,
    topics: ['pricing', 'tier', 'founder', 'top-of-funnel'],
  },
  {
    title: 'Annual planning offsite agenda',
    content:
      'Two-day offsite. Day 1: 2027 strategy + 5-yr vision + market analysis. Day 2: org design + Q3 OKRs + hiring plan + Series A prep. Location: Bandra rooftop.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 70,
    topics: ['offsite', 'planning', 'annual', 'strategy'],
  },
  {
    title: 'Burn rate analysis - May',
    content:
      'Burn: $215k/mo (was $200k). Increase: Priya M. + Marco F. salaries kicking in. Runway: 17 months at current burn. Series A close needed in 12 months. Stable.',
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 14,
    topics: ['burn', 'runway', 'finance', 'series-a'],
  },
  {
    title: 'Sales pipeline - week 18',
    content:
      'Pipeline: $1.8M qualified opportunities. Hot: Acme expansion ($240k), Massive Dynamic ($300k). Warm: Northwind expansion, Hooli (waiting). Cold: 5 ABM targets. Win rate Q1: 28%.',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 50,
    topics: ['sales', 'pipeline', 'q1', 'revenue'],
  },
  {
    title: "Why we don't do channel sales yet",
    content:
      "Considered partnering with design tool resellers. Killed because: (1) we don't have the volume to justify channel margin, (2) direct sales gives us customer feedback faster, (3) channel slows our learning. Revisit at $10M ARR.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 65,
    topics: ['sales', 'channel', 'strategy', 'direct'],
  },
  {
    title: 'Customer Advisory Board - recap',
    content:
      'Met with 6 enterprise customers: Acme, Northwind, Massive Dynamic, Hooli, Stark, Initech. Top asks: SOC2, custom RBAC, data residency. We have all 3 on roadmap. Reassured them.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 38,
    topics: ['advisory-board', 'enterprise', 'feedback', 'roadmap'],
  },
  {
    title: 'Customer health metrics dashboard',
    content:
      'Track per-customer: MAU/WAU, doc creation rate, engagement depth, NPS, support ticket volume. Surface for sales team in Linear. Owner: alex.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 33,
    topics: ['metrics', 'customer-health', 'dashboard', 'linear'],
  },
  {
    title: 'How we measure product-market fit',
    content:
      "PMF signal: 40%+ of users say they'd be very disappointed without us (Sean Ellis test). Today: 32% (n=85 surveyed). Goal: 40% by GA. Targeting Polaris adoption to drive.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 100,
    topics: ['pmf', 'metrics', 'sean-ellis', 'product'],
  },
  {
    title: 'Slack: are we becoming a team-collab company?',
    content:
      'Founder reflection: started as personal-second-brain. Now ~80% of revenue is team plans. Are we becoming a team collab tool? Discussed at all-hands. Decision: lean in. Re-position the website.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 45,
    topics: ['positioning', 'strategy', 'reflection', 'company'],
  },
  {
    title: 'Website re-positioning project',
    content:
      "Redo homepage hero around team-collab story. Polaris demo above the fold. Customer logos: Acme, Northwind, Globex. Pricing tier: Team plan as default. Owner: marketing (sarah's ex-network helping).",
    owner: 'alex',
    source: 'notion',
    daysAgo: 25,
    topics: ['website', 'marketing', 'positioning', 'team-collab'],
  },
  {
    title: 'AI integrations strategy',
    content:
      "Goal: Cognia is the data layer for any AI tool. Tactic: MCP server (shipped), API key system (shipped), partnership with AI tools. Don't build our own AI assistant.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 60,
    topics: ['ai', 'strategy', 'mcp', 'partnership'],
  },
  {
    title: 'MCP partnership outreach',
    content:
      'Reached out to Cursor, Cline, Continue, Zed for MCP integration partnership. Cursor: yes, will mention in their docs. Cline: also yes. Continue: discussing. Zed: not yet but interested. All free distribution.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 40,
    topics: ['mcp', 'partnership', 'distribution', 'ai-tools'],
  },
  {
    title: "Competitive intel - Glean's pricing leak",
    content:
      'Glean (enterprise search) prices at $30-50/seat for 1000+ employee companies. They target up-market; we target bottom-up smaller teams. Different ICP, less direct competition.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 75,
    topics: ['competitive', 'glean', 'enterprise', 'pricing'],
  },
  {
    title: 'Distribution channel - content marketing',
    content:
      'Plan: 1 deep technical post per 2 weeks. Topics: how Polaris works, hybrid search internals, MCP server build. Goal: signal-to-noise ratio that attracts senior engineers.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 50,
    topics: ['marketing', 'content', 'distribution', 'seo'],
  },
  {
    title: 'Startup philosophy - what we believe',
    content:
      'Drafted founder essay (unpublished). Core beliefs: (1) memory is the bottleneck for AI utility, (2) team knowledge belongs to the team, not Google or Slack, (3) the future of work is grounded AI, not fast AI.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 70,
    topics: ['philosophy', 'founder', 'beliefs', 'vision'],
  },
  {
    title: 'Customer Discovery sprint - recap',
    content:
      '1-week sprint. 12 customer calls (8 existing, 4 prospects). Top themes: (1) cursor smoothness as product moat, (2) audit trail as enterprise gate, (3) integration with Slack/Notion as table stakes.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 60,
    topics: ['customer-discovery', 'sprint', 'themes', 'prioritization'],
  },
  {
    title: 'Why Cognia is bottom-up',
    content:
      "We've made deliberate choices to be bottom-up: free tier, individual signup, fast-to-value Polaris demo. Top-down players (Glean, Microsoft Copilot) need long sales cycles. We can convert in 14 days.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 110,
    topics: ['gtm', 'bottom-up', 'strategy', 'differentiation'],
  },
  {
    title: 'Q3 priorities preview',
    content:
      'Q3: comments-on-canvas (separate feature), v1.1 of Polaris (offline + sharding), customer success function. Driving: Acme expansion, Series A close.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 8,
    topics: ['q3', 'priorities', 'planning', 'roadmap'],
  },
  {
    title: 'Slack: should we add Slack integration deeper?',
    content:
      'Today: Slack notifications on @-mention. Considering: deeper integration (e.g., share Polaris room from Slack message). Tradeoff: more integration debt vs more daily value. Decision: deeper Q4.',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 45,
    topics: ['slack', 'integration', 'q4', 'planning'],
  },
  {
    title: 'Why we picked Razorpay over Stripe',
    content:
      'Originally on Stripe. Migrated to Razorpay because: (1) lower processing fees in INR (we have Indian customers), (2) simpler subscription billing UX for emerging markets, (3) better support. Migration took 2 weeks.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 100,
    topics: ['razorpay', 'stripe', 'migration', 'billing'],
  },
  {
    title: "Founder mode - what I'm doing this quarter",
    content:
      'Founder check-in: 50% on Polaris GA, 25% on customer (Acme, Massive Dynamic), 15% on hiring, 10% on Series A prep. Saying no to: speaking events, advisory roles, podcasts.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 30,
    topics: ['founder', 'prioritization', 'quarter', 'focus'],
  },
  {
    title: 'Slack: customer feedback theme - feels like Figma but ours',
    content:
      'Across multiple customers: "Polaris feels like our own version of Figma\'s collab." Implication: we\'re a credible alternative for design-tool-curious teams.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 25,
    topics: ['feedback', 'figma', 'positioning', 'customer-voice'],
  },
  {
    title: 'Pricing model debate - usage-based?',
    content:
      'Considered: usage-based (per Polaris room created or per CRDT op). Killed: too unpredictable for customers. Stuck with seat-based. Re-evaluate at $5M ARR.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 85,
    topics: ['pricing', 'usage-based', 'seat-based', 'decision'],
  },
  {
    title: 'YC application - what we said about Polaris',
    content:
      'YC application essay: "Cognia is the team knowledge graph. Polaris is our wedge - realtime collab on canvas. We\'ll be the data layer for every AI tool." 350 words. Filed for re-use.',
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 90,
    topics: ['yc', 'application', 'positioning', 'company'],
  },
]

// ── 5. Engineering knowledge & lessons (60) ─────────────────────────────────
const ENG: MemoryDef[] = [
  {
    title: 'Postgres connection pool - what blew up',
    content:
      'On May 12, ran out of pool connections at 600 active users. Default pool was 20. Increased to 50, set max_idle to 5, idle_timeout to 30s. Now stable at 1500 users.',
    owner: 'bob',
    source: 'github',
    daysAgo: 119,
    topics: ['postgres', 'pool', 'incident', 'tuning'],
  },
  {
    title: 'Why our retry logic uses exponential backoff with jitter',
    content:
      "Exponential alone causes synchronized retries (thundering herd). Jitter randomizes across retry windows. We use AWS's formula: random between 0 and base * 2^attempt. Saved us from a deploy storm.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 110,
    topics: ['retry', 'backoff', 'jitter', 'reliability'],
  },
  {
    title: 'BullMQ stalled jobs - how to debug',
    content:
      "Stalled means: worker started, didn't finish, didn't crash visibly. Causes: process suspended (Heroku scale-down), network partition, infinite loop. Fix: increase stalledInterval, use job.heartbeat() in long jobs.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 145,
    topics: ['bullmq', 'stalled', 'debug', 'queue'],
  },
  {
    title: 'Prisma N+1 query bug we shipped',
    content:
      "Memory list endpoint returned each memory's tags as a separate query - N+1. Fixed with `include: { tags: true }`. Reduced p99 latency from 800ms to 95ms. Sentry caught it; metrics confirmed.",
    owner: 'sarah',
    source: 'github',
    daysAgo: 78,
    topics: ['prisma', 'n+1', 'performance', 'postgres'],
  },
  {
    title: 'OAuth refresh token rotation strategy',
    content:
      'Each refresh = new refresh token + access token, old refresh token revoked. Re-use detection: if old refresh used after rotation, revoke entire family + log. Inspired by IETF best practices.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 93,
    topics: ['oauth', 'refresh-token', 'rotation', 'security'],
  },
  {
    title: 'BCrypt cost factor: 12 vs 14',
    content:
      '12: 250ms hash time on our server. 14: 1s. Decision: 12 for now, monitor for spec change. Acceptable for ~100 logins/min. Will bump to 14 in 2027 when Apple Silicon norm.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 130,
    topics: ['bcrypt', 'password', 'security', 'tuning'],
  },
  {
    title: '2FA TOTP - what we ship',
    content:
      'Standard RFC 6238 TOTP. 30-sec window, 6 digits. Secret stored encrypted at rest. App support: any TOTP app (Google Authenticator, 1Password, Authy). Recovery codes: 10 single-use.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 115,
    topics: ['2fa', 'totp', 'rfc-6238', 'recovery-codes'],
  },
  {
    title: 'OIDC client implementation - gotchas',
    content:
      "(1) Always validate `aud` claim matches our client ID. (2) PKCE is required for public clients (mobile/SPA). (3) `nonce` prevents replay. (4) Don't trust `iss` blindly - check against your IdP's known issuer.",
    owner: 'sarah',
    source: 'github',
    daysAgo: 84,
    topics: ['oidc', 'sso', 'security', 'spec'],
  },
  {
    title: "SCIM 2.0 - what's actually required",
    content:
      'Spec is dense. We implement: /Users (CRUD), /Groups (read), bulk = no, search filter = limited. Most enterprise customers only use Users + role mapping. Filed scope as MVP.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 76,
    topics: ['scim', 'sso', 'spec', 'mvp'],
  },
  {
    title: 'Hybrid search - RRF fusion math',
    content:
      'Reciprocal Rank Fusion: each result gets 1/(k+rank) where k=60. Sum across rankings. Result with highest sum wins. We use k=60 because spec recommends. Tested smaller k - too aggressive on rank-1.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 98,
    topics: ['search', 'rrf', 'hybrid', 'algorithm'],
  },
  {
    title: 'Why we use BM25 sparse + dense embeddings',
    content:
      'Dense alone: misses exact-match queries ("GitHub"). BM25 alone: misses semantic queries ("version control"). Hybrid: search both, fuse via RRF. Best of both. Industry standard.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 90,
    topics: ['search', 'hybrid', 'bm25', 'dense'],
  },
  {
    title: 'Cross-encoder reranking - Cohere vs Voyage',
    content:
      'Cohere rerank-2: 50ms p99, $0.001/1k docs. Voyage rerank-2: 80ms p99, $0.0008/1k docs. Quality nearly identical. Cost is close. Decision: Cohere for ease of integration.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 85,
    topics: ['rerank', 'cohere', 'voyage', 'cost'],
  },
  {
    title: 'Chunking strategy for long docs',
    content:
      'Documents > 4k tokens: chunk into 512-token windows with 64-token overlap. Overlap prevents losing context at chunk boundaries. Each chunk gets its own embedding + dense + sparse.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 70,
    topics: ['chunking', 'document', 'rag', 'strategy'],
  },
  {
    title: 'Why we self-host Qdrant vs Pinecone',
    content:
      'Pinecone serverless: $0.40/M reads. We do ~5M reads/day = $60/day = $1800/mo. Qdrant self-hosted on a $50/mo VM. 36x cheaper. At our scale, savings matter.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 60,
    topics: ['qdrant', 'pinecone', 'vector-db', 'cost'],
  },
  {
    title: 'Embedding cache - what to cache',
    content:
      'Cache rules: (1) embedding for same text, (2) sparse vector for same text. TTL: 7 days. Hit rate currently: 12%. Saves $200/mo on embedding API. Worth it.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 55,
    topics: ['caching', 'embedding', 'cost', 'redis'],
  },
  {
    title: "Why we don't use LangChain",
    content:
      "Considered LangChain. Killed because: (1) abstraction layer adds complexity for the 3 LLM ops we do, (2) we need control over prompt format for citation accuracy, (3) we're not orchestrating multi-step chains. Built our own thin wrappers.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 105,
    topics: ['langchain', 'rag', 'build-vs-buy', 'architecture'],
  },
  {
    title: "Why we don't use LlamaIndex either",
    content:
      'Same reasons as LangChain. Plus: LlamaIndex is opinionated about data structures. We have our own (Cognia memory mesh). Adapters add friction.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 105,
    topics: ['llamaindex', 'rag', 'build-vs-buy', 'architecture'],
  },
  {
    title: 'OpenAI rate limit strategy',
    content:
      'Daily req limit: 200 RPD on tier 1. We saturate by 2pm. Backoff strategy: exponential + jitter on 429. Worker queues throttle to 50 RPM via BullMQ rate limiter. No silent failures.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 50,
    topics: ['openai', 'rate-limit', 'queue', 'reliability'],
  },
  {
    title: 'Why we use ts-node not tsx for scripts',
    content:
      'ts-node is older but more compatible with our tsconfig. tsx faster but had issues with our path aliases. Stuck with ts-node. Will revisit when our tsconfig settles.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 90,
    topics: ['ts-node', 'tsx', 'typescript', 'tooling'],
  },
  {
    title: 'Vitest vs Jest migration writeup',
    content:
      'Migrated from Jest to Vitest. Wins: 3x faster CI, native ESM, simpler config. Losses: had to rewrite 12 jest-specific tests. Net: worth it.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 85,
    topics: ['vitest', 'jest', 'migration', 'testing'],
  },
  {
    title: 'TypeScript strict mode migration',
    content:
      'Enabled `noImplicitAny` last. Took 3 weeks of fixes. Caught 12 real bugs (e.g., `any` chains hiding null returns). Worth the investment. New code: strict by default.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 100,
    topics: ['typescript', 'strict', 'migration', 'types'],
  },
  {
    title: 'Bundle size reduction journey',
    content:
      'Started: 800KB main bundle. After tree-shaking + lazy routes + dropping moment.js: 480KB. Plan to hit 350KB with virtualization for memory list.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 80,
    topics: ['bundle', 'size', 'frontend', 'performance'],
  },
  {
    title: 'Why we use Tailwind not CSS-in-JS',
    content:
      "Tested styled-components. Killed because: (1) bundle size impact (60KB), (2) runtime cost on render, (3) Tailwind's purge gives us atomic CSS at 24KB. Worth the learning curve.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 130,
    topics: ['tailwind', 'css', 'frontend', 'bundle'],
  },
  {
    title: "React Server Components - why we don't use them",
    content:
      "Considered RSC for our app shell. Killed because: (1) our SPA model serves us well, (2) no SEO need (auth-walled product), (3) RSC adds Next.js complexity we don't need. Vite + lazy routes is simpler.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 115,
    topics: ['rsc', 'react', 'frontend', 'architecture'],
  },
  {
    title: 'Three.js performance - 1000 nodes',
    content:
      'Renders 1000 mesh nodes at 60fps on M1 Mac. Tradeoff: simplified node geometry (sphere with 6 segments). Camera frustum culling helps. At 5000+ nodes, drops to 30fps.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 65,
    topics: ['threejs', 'performance', '3d', 'frontend'],
  },
  {
    title: 'CSP policy - what we allow',
    content:
      'Default-src self. Script-src self + nonce for inline scripts. Style-src self + unsafe-inline (radix needs it). Img-src self + data + https. Loud and clear.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 70,
    topics: ['csp', 'security', 'headers', 'helmet'],
  },
  {
    title: 'Postgres LISTEN/NOTIFY for cache invalidation',
    content:
      'When org config changes, we LISTEN on a channel + NOTIFY on update. Each app instance invalidates its config cache. Avoids cache-aside problems. <100ms propagation.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 75,
    topics: ['postgres', 'listen-notify', 'caching', 'realtime'],
  },
  {
    title: 'Webhook DLQ - when jobs fail repeatedly',
    content:
      'After 5 retries with backoff, push job to DLQ (separate queue). Alert on DLQ growth. Manual ops can replay if needed. We have ~3 jobs in DLQ across all of Q1.',
    owner: 'bob',
    source: 'github',
    daysAgo: 90,
    topics: ['webhook', 'dlq', 'reliability', 'queue'],
  },
  {
    title: 'Idempotency - request keys',
    content:
      'Every webhook delivery includes Idempotency-Key. Server stores response in Redis for 24h. Re-sends with same key get cached response. Prevents duplicate side effects.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 95,
    topics: ['idempotency', 'webhook', 'reliability', 'spec'],
  },
  {
    title: 'Why our migrations need IF EXISTS guards',
    content:
      "Learned the hard way: a fresh deploy DB doesn't have the legacy Stripe schema, so the Stripe→Razorpay migration tries to drop nonexistent indexes and fails. Fix: use IF EXISTS / IF NOT EXISTS / DO blocks for forward-compatibility.",
    owner: 'alex',
    source: 'github',
    daysAgo: 1,
    topics: ['migration', 'postgres', 'idempotent', 'prisma'],
  },
  {
    title: 'Audit log retention policy',
    content:
      'Audit logs retained 7 years (SOC2 requirement). Hot data: 90 days. Warm: 1 year. Cold (S3 Glacier): 6+ years. Deletion via background worker daily.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 50,
    topics: ['audit', 'retention', 'compliance', 'soc2'],
  },
  {
    title: 'GDPR delete flow design',
    content:
      'User clicks Delete Account → 30-day grace period (sends email reminder). After 30 days: full delete (DB + Qdrant + S3). Legal hold delays. Audit log records deletion event.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 60,
    topics: ['gdpr', 'delete', 'user-flow', 'legal-hold'],
  },
  {
    title: 'OWASP top 10 review - Q1',
    content:
      "Reviewed all 10. Findings: (1) we're good on A01, A02, A03 (auth, crypto, injection - already covered). (2) A06 (component vulnerabilities) - added Snyk scans to CI. (3) A09 (logging) - improved structured logs.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 95,
    topics: ['owasp', 'security', 'review', 'q1'],
  },
  {
    title: 'Multi-tenant isolation in Qdrant',
    content:
      'Each org gets its own collection? No - too much collection management overhead. Use payload field `organization_id` + index it. Query always filters by org_id. Verified no cross-tenant leakage in tests.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 105,
    topics: ['qdrant', 'multi-tenant', 'isolation', 'design'],
  },
  {
    title: 'On-call rotation playbook',
    content:
      'Pager: PagerDuty. Rotation: weekly. Each on-call has access to: prod logs, prod DB read-only, runbook for top 10 incidents. Escalation: 15 min unanswered → secondary, 30 min → CEO.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 25,
    topics: ['oncall', 'playbook', 'process', 'escalation'],
  },
  {
    title: 'Backup strategy for Postgres',
    content:
      'WAL streaming to S3 every 30s. Snapshot daily. Tested restore: every 6 weeks (just to make sure). RPO: 30s. RTO: 30 min.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 55,
    topics: ['backup', 'postgres', 'disaster-recovery', 'rpo'],
  },
  {
    title: 'Backup strategy for Qdrant',
    content:
      'Snapshot collection daily to S3. Tested restore: monthly. RPO: 24h. RTO: 1h. Acceptable; data is recoverable from Postgres + re-embedding if disaster.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 55,
    topics: ['backup', 'qdrant', 'disaster-recovery', 'rpo'],
  },
  {
    title: 'CI parallelization - 4 min to 90 sec',
    content:
      'Was: serial test, lint, build = 4 min. After: parallelized into 4 jobs (test, lint, build:api, build:client) = 90 sec. Cache npm, cache prisma client. Worth a sprint.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 110,
    topics: ['ci', 'parallel', 'performance', 'workflow'],
  },
  {
    title: 'Sentry findings: top 5 errors Q1',
    content:
      '1. Race in webhook DLQ replay (fixed). 2. Memory leak in document worker (fixed). 3. Y.js encoding error on undefined node (fixed). 4. Postgres advisory lock timeout (fixed). 5. Random email-verify token expiry (still investigating).',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 35,
    topics: ['sentry', 'errors', 'q1', 'debugging'],
  },
  {
    title: 'Bun runtime evaluation',
    content:
      "Tested Bun for our API. 30% faster cold start. Postgres driver issues - Bun's lib lacked LISTEN/NOTIFY. Stuck with Node 20. Revisit Bun in 6 months.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 70,
    topics: ['bun', 'node', 'runtime', 'evaluation'],
  },
  {
    title: "Why we don't use Kubernetes (yet)",
    content:
      'K8s adds: a control plane, manifests, ingress, service mesh. Today our needs: 1 service, 1 deploy. EC2 + docker-compose + Caddy = simpler. Re-evaluate at 5+ services.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 90,
    topics: ['kubernetes', 'infra', 'complexity', 'tradeoff'],
  },
  {
    title: 'Trunk-based dev - what works',
    content:
      'Long-lived branches die slowly. Merge to main daily. Feature flags for unfinished work. CI on every PR. Has scaled with our team (5 ICs).',
    owner: 'alex',
    source: 'notion',
    daysAgo: 100,
    topics: ['trunk-based', 'git', 'process', 'engineering-culture'],
  },
  {
    title: 'Code review SLA: 4 hours',
    content:
      'Goal: 4 business hours from PR to first review. Hit rate: 78%. Strategy: PRs < 200 lines stay reviewable. Multi-reviewer for non-trivial. Async reviews preferred.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 80,
    topics: ['code-review', 'sla', 'process', 'engineering-culture'],
  },
  {
    title: 'How we run sprint planning',
    content:
      '2-week sprints. Planning: every other Monday morning, 1.5 hr. Outcome: each engineer has clear goal for the sprint + 1 stretch. No more than 6 stories per IC.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 95,
    topics: ['sprint', 'planning', 'process', 'engineering-culture'],
  },
  {
    title: 'Tech debt budget: 20%',
    content:
      'Each sprint, 20% of capacity allocated to tech debt. Tracked in Linear with "tech-debt" label. Forces prioritization; prevents debt from compounding.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 90,
    topics: ['tech-debt', 'sprint', 'budget', 'process'],
  },
  {
    title: 'Estimation: t-shirt sizing',
    content:
      'We use S/M/L/XL not story points. Removes false precision. S = 1 day, M = 2-3 days, L = 1 week, XL = needs breakdown. Refined every sprint.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 95,
    topics: ['estimation', 'sprint', 'process', 'agile'],
  },
  {
    title: 'Postmortem: May 12 outage',
    content:
      'WS gateway deploy triggered reconnect storm. Lasted 4 min. Root cause: no jittered backoff. Fixed: added jitter, deploy windows. No data loss. Affected: 3 customers, 0 incidents reported.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 119,
    topics: ['postmortem', 'outage', 'reconnect', 'reliability'],
  },
  {
    title: 'Postmortem: Apr 23 OAuth break',
    content:
      "Google OAuth refresh failed for 2 hours. Cause: we hit Google's 24h refresh quota due to a worker loop. Fix: added rate limit on refresh worker, surfaced in monitoring.",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 9,
    topics: ['postmortem', 'oauth', 'quota', 'google'],
  },
  {
    title: 'Frontend perf: First Contentful Paint targets',
    content:
      'FCP target: <1.5s on 3G. Today: 1.2s. Strategies: critical CSS inline, lazy-load 3D mesh, defer non-critical JS. Tracked in Lighthouse CI.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 85,
    topics: ['fcp', 'performance', 'frontend', 'lighthouse'],
  },
  {
    title: 'How we test against Qdrant in unit tests',
    content:
      'Test container approach: Docker Compose spins up real Qdrant for integration tests. Faster than mocking; catches real bugs (e.g., scalar quantization edge cases). Tests run in CI in 90s.',
    owner: 'bob',
    source: 'github',
    daysAgo: 60,
    topics: ['testing', 'qdrant', 'testcontainers', 'integration'],
  },
  {
    title: 'Property-based testing experiment',
    content:
      'Used fast-check for 3 weeks on CRDT convergence tests. Found 2 real bugs (awareness ordering, delete-then-recreate). Slow CI (10 min added) but worth it for correctness-critical code.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 55,
    topics: ['property-testing', 'fast-check', 'crdt', 'testing'],
  },
  {
    title: 'Snapshot testing - when it helps',
    content:
      'Useful for: API response shapes, generated SQL queries. NOT useful for: rendered components (too brittle). We have 12 snapshot tests; review on every change.',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 88,
    topics: ['snapshots', 'testing', 'vitest', 'best-practice'],
  },
  {
    title: 'Pagination strategy: cursor-based',
    content:
      'Memory list paginates by cursor (composite of created_at + id). Stable across deletions. Preferred over offset for any large dataset.',
    owner: 'bob',
    source: 'github',
    daysAgo: 100,
    topics: ['pagination', 'cursor', 'api', 'design'],
  },
  {
    title: 'API versioning - /v1 first',
    content:
      'All public API at /v1/. No /v0 for beta. Breaking changes go to /v2 with 6-month deprecation notice. Standard.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 105,
    topics: ['api', 'versioning', 'rest', 'spec'],
  },
  {
    title: 'Why we expose OpenAPI not GraphQL',
    content:
      "Considered GraphQL. Killed because: (1) our API is read-heavy, simple queries, (2) OpenAPI tooling is mature, (3) we don't want to teach customers GraphQL. REST + OpenAPI wins.",
    owner: 'bob',
    source: 'notion',
    daysAgo: 110,
    topics: ['openapi', 'graphql', 'rest', 'api-design'],
  },
  {
    title: 'GitHub Actions parallelization tricks',
    content:
      'Use matrix strategy for OS x Node version. Use cache@v4 for npm. Use needs/depends for sequential steps. We run 4 jobs in parallel; total CI 90s.',
    owner: 'sarah',
    source: 'github',
    daysAgo: 75,
    topics: ['github-actions', 'ci', 'parallel', 'optimization'],
  },
  {
    title: 'Trivy scans in CI: what we ignore',
    content:
      'Trivy scans containers for vulns. Ignore: dev-only base images, known false positives in Node 20. Surface in PR comments.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 60,
    topics: ['trivy', 'security', 'ci', 'sast'],
  },
  {
    title: 'Branch protection rules audit',
    content:
      'Required: 1 reviewer, CI passing, signed commits, branch up-to-date. Disabled: enforce admins (we trust founders to bypass for emergencies). Audited quarterly.',
    owner: 'alex',
    source: 'github',
    daysAgo: 70,
    topics: ['github', 'branch-protection', 'security', 'process'],
  },
  {
    title: 'Logger structured output for Datadog',
    content:
      'Switched from text logs to JSON. Each log: timestamp, level, service, requestId, userId, msg, fields. Datadog parses for free. Saved 2 incidents from faster correlation.',
    owner: 'bob',
    source: 'notion',
    daysAgo: 65,
    topics: ['logging', 'structured', 'datadog', 'observability'],
  },
]

// ── 6. Articles read & external knowledge (60) ──────────────────────────────
const ARTICLES: MemoryDef[] = [
  {
    title: 'How Notion Built Real-Time Collab',
    content:
      "Article on Notion's blog. Operational transformation + custom server. Different approach from CRDTs but similar UX. Validates that there's no single-best architecture.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 165,
    topics: ['notion', 'realtime', 'article', 'crdt'],
  },
  {
    title: "Figma's Multiplayer Architecture by Evan Wallace",
    content:
      'Foundational article. They built a custom OT engine. Lessons: (1) ship correctness over performance early, (2) test with real users, not synthetic, (3) optimize what you can measure.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 200,
    topics: ['figma', 'multiplayer', 'article', 'ot'],
  },
  {
    title: 'Designing Data-Intensive Applications - Ch 5',
    content:
      "Replication chapter. Useful framing for our snapshot/delta approach. Single-leader vs multi-leader vs leaderless. We're single-leader (per shard). Trade-offs documented in our system design.",
    owner: 'bob',
    source: 'web',
    daysAgo: 180,
    topics: ['ddia', 'book', 'replication', 'distributed-systems'],
  },
  {
    title: 'Postgres Internals by Bruce Momjian',
    content:
      '40-min talk. WAL deep dive. Validates our backup approach (continuous WAL streaming + daily snapshots). Worth re-watching annually.',
    owner: 'bob',
    source: 'web',
    daysAgo: 150,
    topics: ['postgres', 'wal', 'talk', 'internals'],
  },
  {
    title: 'CRDT Survey by Marc Shapiro',
    content:
      'Foundational paper. Read 3 times before designing Polaris. Key insight: state-based CRDTs (CvRDTs) and op-based CRDTs (CmRDTs) have different scaling properties. We use CmRDT (Y.js) because of network efficiency.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 220,
    topics: ['crdt', 'paper', 'research', 'foundational'],
  },
  {
    title: 'Yjs Documentation: Awareness Protocol',
    content:
      'Y.js awareness uses ephemeral state via WebSockets. Per-user ephemeral data (cursor, selection) replicated to all others. Our custom selection layer extends this.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 195,
    topics: ['yjs', 'awareness', 'docs', 'protocol'],
  },
  {
    title: 'How Discord Stores Trillions of Messages',
    content:
      'Cassandra → ScyllaDB. Their tradeoff: throughput over consistency. Our tradeoff: consistency over throughput (we use Postgres). Different patterns for different workloads.',
    owner: 'bob',
    source: 'web',
    daysAgo: 130,
    topics: ['discord', 'cassandra', 'scale', 'article'],
  },
  {
    title: 'How Linear Handles Async Updates',
    content:
      "Linear's realtime sync uses a custom WebSocket protocol with opportunistic batching. Inspiration for our cursor sync (we batch 30Hz cursor moves).",
    owner: 'sarah',
    source: 'web',
    daysAgo: 140,
    topics: ['linear', 'realtime', 'article', 'batching'],
  },
  {
    title: "Stripe's Idempotency Pattern",
    content:
      'Every API call accepts Idempotency-Key. Stripe stores response for 24h. Re-sends with same key get cached response. We adopted this pattern for our webhooks.',
    owner: 'bob',
    source: 'web',
    daysAgo: 105,
    topics: ['stripe', 'idempotency', 'pattern', 'article'],
  },
  {
    title: 'Database Migrations Without Downtime',
    content:
      'Strangler fig pattern: dual-write to old + new schema, dual-read with fallback, swap reads, drop old. We used this for the Stripe→Razorpay migration. Worked.',
    owner: 'bob',
    source: 'web',
    daysAgo: 95,
    topics: ['migration', 'strangler-fig', 'article', 'postgres'],
  },
  {
    title: 'Postgres Index Types Explained',
    content:
      'B-tree (default), GIN (full text), GiST (geo), BRIN (large tables, ordered data). We use B-tree + GIN. BRIN considered for audit logs (ordered by time) but B-tree fine for now.',
    owner: 'bob',
    source: 'web',
    daysAgo: 110,
    topics: ['postgres', 'indexes', 'article', 'performance'],
  },
  {
    title: 'Caching Strategies for Web APIs',
    content:
      'Cache-aside, write-through, write-behind. We use cache-aside in Redis with 5-min TTL on org-config reads. Hit rate 78%. Saves Postgres load.',
    owner: 'bob',
    source: 'web',
    daysAgo: 90,
    topics: ['caching', 'strategies', 'article', 'redis'],
  },
  {
    title: 'How Cloudflare Built Workers KV',
    content:
      "Cloudflare's edge KV store. Uses centralized writes + edge propagation. Inspired our cache invalidation: writes go to Postgres, all replicas pull update.",
    owner: 'bob',
    source: 'web',
    daysAgo: 100,
    topics: ['cloudflare', 'workers', 'kv', 'article'],
  },
  {
    title: 'Latency Numbers Every Programmer Should Know',
    content:
      'Reference. L1 cache: 0.5ns. Memory: 100ns. SSD: 150,000ns. Network 1Gb: 10,000ns. Cross-continental: 100M ns. Helps prioritize.',
    owner: 'bob',
    source: 'web',
    daysAgo: 200,
    topics: ['latency', 'reference', 'article', 'foundational'],
  },
  {
    title: 'OpenAI API Best Practices for Production',
    content:
      'Use exponential backoff. Set request timeouts. Handle 429s gracefully. Cache embeddings. Stream where possible. We follow all 5.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 80,
    topics: ['openai', 'production', 'best-practices', 'article'],
  },
  {
    title: "Anthropic's Claude API Documentation",
    content:
      "Read for our MCP server build. Claude's tool-use protocol is well-designed. We integrated cognia_search, cognia_get_memory, cognia_list_memories as tools.",
    owner: 'alex',
    source: 'web',
    daysAgo: 65,
    topics: ['anthropic', 'claude', 'docs', 'mcp'],
  },
  {
    title: 'Vercel AI SDK: Streaming Patterns',
    content:
      'Vercel AI SDK has nice streaming helpers. Considered for our search streaming. Killed because we want to own the streaming layer for citation accuracy.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 70,
    topics: ['vercel', 'ai-sdk', 'streaming', 'article'],
  },
  {
    title: 'Embedding Models Comparison: text-embedding-3',
    content:
      'OpenAI text-embedding-3-small: 1536d, $0.02/1M tokens, 75% recall. text-embedding-3-large: 3072d, $0.13/1M, 80%. We use small (cost), bump to large for premium.',
    owner: 'bob',
    source: 'web',
    daysAgo: 90,
    topics: ['embeddings', 'openai', 'comparison', 'article'],
  },
  {
    title: 'BM25 vs TF-IDF: Practical Differences',
    content:
      'BM25 has saturating term frequency (avoiding rare-word blowup). Better for long docs. TF-IDF is simpler, faster. We use BM25 because our docs are mixed-length.',
    owner: 'bob',
    source: 'web',
    daysAgo: 100,
    topics: ['bm25', 'tfidf', 'search', 'article'],
  },
  {
    title: 'Reciprocal Rank Fusion Explained',
    content:
      'RRF: sum 1/(k+rank) across multiple rankings. k=60 is standard. Robust to outliers; better than score-based fusion. We use it for hybrid search.',
    owner: 'bob',
    source: 'web',
    daysAgo: 95,
    topics: ['rrf', 'search', 'article', 'algorithm'],
  },
  {
    title: "Vector Search at 1B Scale: Pinecone's Architecture",
    content:
      'Pinecone uses sharding + replication + caching. Our scale: ~5M vectors. Single Qdrant instance handles. Will revisit at 1B.',
    owner: 'bob',
    source: 'web',
    daysAgo: 105,
    topics: ['pinecone', 'vector-search', 'scale', 'article'],
  },
  {
    title: "Notion's AI Architecture",
    content:
      'Notion AI uses RAG with their own internal search index. Validates RAG approach. Their UX is clever: AI suggestions inline in writing.',
    owner: 'alex',
    source: 'web',
    daysAgo: 50,
    topics: ['notion-ai', 'rag', 'article', 'architecture'],
  },
  {
    title: 'Building a RAG System: End-to-End',
    content:
      'LangChain tutorial. Useful for our MCP server design. RAG pipeline: chunk → embed → retrieve → rerank → generate. We have all 5 stages.',
    owner: 'bob',
    source: 'web',
    daysAgo: 75,
    topics: ['rag', 'tutorial', 'article', 'langchain'],
  },
  {
    title: 'Llama 3.1: Local LLM Deployment',
    content:
      "Tested Llama 3.1 8B locally for embeddings. Lower quality than OpenAI's text-embedding-3-small, similar speed. Not worth it.",
    owner: 'bob',
    source: 'web',
    daysAgo: 85,
    topics: ['llama', 'local-llm', 'article', 'embeddings'],
  },
  {
    title: "Model Context Protocol - Anthropic's New Standard",
    content:
      'MCP is open. Allows AI tools to integrate with external knowledge sources via JSON-RPC. We built our MCP server day 2 of the spec landing.',
    owner: 'alex',
    source: 'web',
    daysAgo: 60,
    topics: ['mcp', 'anthropic', 'protocol', 'article'],
  },
  {
    title: 'Cursor Editor: AI Features Deep Dive',
    content:
      'Cursor uses Claude + custom UI for code AI. Their MCP integration is starter-friendly. Validates our MCP-server approach.',
    owner: 'alex',
    source: 'web',
    daysAgo: 55,
    topics: ['cursor', 'editor', 'article', 'ai'],
  },
  {
    title: 'TypeScript 5.5 Release Notes',
    content:
      'Inferred type predicates, JSDoc improvements. Will adopt the new predicates. Saves 50 lines of runtime checks.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 110,
    topics: ['typescript', 'release', 'article'],
  },
  {
    title: 'Node.js 20 LTS Highlights',
    content:
      'Native test runner, --watch mode, built-in fetch. We use --watch for dev. Saved Nodemon dependency.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 130,
    topics: ['node', 'release', 'article'],
  },
  {
    title: 'Vite vs Webpack: When to Switch',
    content:
      'Vite: dev mode, lazy imports, ESM-native. Webpack: still better for monorepos with code splitting at scale. We use Vite (single repo, simple needs).',
    owner: 'sarah',
    source: 'web',
    daysAgo: 120,
    topics: ['vite', 'webpack', 'frontend', 'article'],
  },
  {
    title: 'esbuild Performance Tips',
    content:
      'esbuild is 10-20x faster than tsc for compilation. Vite uses it. Lessons: (1) tree-shake aggressively, (2) avoid synthetic-default imports, (3) prefer named imports.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 105,
    topics: ['esbuild', 'performance', 'article', 'build'],
  },
  {
    title: 'Next.js App Router Migration',
    content:
      'Considered Next.js for our app. Killed (see notes). But the App Router pattern is influential. We use similar patterns in Vite + react-router.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 90,
    topics: ['nextjs', 'migration', 'article', 'frontend'],
  },
  {
    title: 'Solid.js: Reactive Without Hooks',
    content:
      "Tried Solid for a side project. Faster reactivity. Not worth migration. React's ecosystem still wins.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 95,
    topics: ['solid', 'reactive', 'article', 'frontend'],
  },
  {
    title: 'Vue 3 Composition API in 2026',
    content:
      "Vue 3 is mature. Vapor mode coming. We're React-shop; not migrating. Article useful for understanding alternative paradigms.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 100,
    topics: ['vue', 'composition', 'article', 'frontend'],
  },
  {
    title: 'CSS Container Queries in Production',
    content:
      'Browser support: 95%. Used for our admin sidebar (responsive without media queries). Easier to maintain.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 70,
    topics: ['css', 'container-queries', 'article', 'frontend'],
  },
  {
    title: 'View Transitions API: Native Animations',
    content:
      'Browser support: 70%+. Used for page transitions. Falls back to instant. Net positive.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 65,
    topics: ['css', 'animations', 'article', 'frontend'],
  },
  {
    title: 'Service Workers: Offline-First Patterns',
    content:
      "For Polaris offline mode (POLARIS-23). We'll use Service Worker + IndexedDB to cache CRDT state. Article informs the design.",
    owner: 'bob',
    source: 'web',
    daysAgo: 60,
    topics: ['service-workers', 'offline', 'article', 'polaris'],
  },
  {
    title: 'WebRTC for Peer-to-Peer Editing',
    content:
      'Considered for Polaris. Killed: NAT traversal in enterprise networks. Useful read for understanding the rejection.',
    owner: 'bob',
    source: 'web',
    daysAgo: 130,
    topics: ['webrtc', 'p2p', 'article', 'polaris'],
  },
  {
    title: 'Tokio: Async Rust at Scale',
    content:
      "Tokio handles 1M+ concurrent tasks. We don't use Rust today, but worth knowing for future eval. Realtime gateway candidate at scale.",
    owner: 'bob',
    source: 'web',
    daysAgo: 110,
    topics: ['rust', 'tokio', 'article', 'async'],
  },
  {
    title: 'Inngest vs Trigger.dev: Workflow Engines',
    content:
      'Both are durable execution platforms. Inngest more mature, Trigger.dev simpler API. We use BullMQ today; revisit at higher complexity.',
    owner: 'bob',
    source: 'web',
    daysAgo: 80,
    topics: ['inngest', 'trigger', 'workflow', 'article'],
  },
  {
    title: 'Restate: Distributed Application Runtime',
    content:
      'Restate is a durable workflow engine for stateful apps. Competitor to Temporal. Our needs are simpler; BullMQ suffices.',
    owner: 'bob',
    source: 'web',
    daysAgo: 85,
    topics: ['restate', 'distributed', 'article', 'workflow'],
  },
  {
    title: 'Kafka: When You Actually Need It',
    content:
      'Kafka excels at high-throughput log streaming. Not needed for our 1M ops/day load. PostgreSQL queue or BullMQ fine.',
    owner: 'bob',
    source: 'web',
    daysAgo: 115,
    topics: ['kafka', 'messaging', 'article', 'tradeoff'],
  },
  {
    title: 'gRPC vs REST in 2026',
    content:
      'gRPC for service-to-service, REST for public APIs. We use REST (public-facing API). gRPC considered for inter-service if we go microservices.',
    owner: 'bob',
    source: 'web',
    daysAgo: 95,
    topics: ['grpc', 'rest', 'article', 'api'],
  },
  {
    title: 'GraphQL Federation at Scale',
    content:
      "Apollo, Wundergraph, Hasura. Federation overhead is significant for small teams. We don't use GraphQL.",
    owner: 'bob',
    source: 'web',
    daysAgo: 105,
    topics: ['graphql', 'federation', 'article', 'api'],
  },
  {
    title: 'tRPC: End-to-End Type Safety',
    content:
      'tRPC eliminates type duplication between client and server. Cool but locks you into a protocol. We use OpenAPI + manual types.',
    owner: 'sarah',
    source: 'web',
    daysAgo: 90,
    topics: ['trpc', 'typescript', 'article', 'api'],
  },
  {
    title: 'Webhooks vs SSE: Decision Guide',
    content:
      'Webhooks: server pushes to URL, client manages reliability. SSE: server streams to browser, simpler. We use webhooks for integrations, SSE for in-app real-time.',
    owner: 'bob',
    source: 'web',
    daysAgo: 70,
    topics: ['webhooks', 'sse', 'article', 'realtime'],
  },
  {
    title: 'WebSocket Frame Compression Wins',
    content:
      'per-message-deflate gives 70% compression on text-heavy WS frames. Adds 5ms CPU per frame. Worth it for our awareness protocol.',
    owner: 'bob',
    source: 'web',
    daysAgo: 100,
    topics: ['websocket', 'compression', 'article', 'performance'],
  },
  {
    title: 'CDN Edge Caching: Vercel vs Cloudflare',
    content:
      "Vercel auto-caches at edge with their patterns. Cloudflare more granular control. We use Vercel for Cognia's frontend; backend self-hosted.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 60,
    topics: ['cdn', 'vercel', 'cloudflare', 'article'],
  },
  {
    title: 'TLS 1.3 Performance Improvements',
    content:
      'TLS 1.3 reduces handshake from 2 RTT to 1 RTT (or 0 with session resumption). Enabled in Caddy by default.',
    owner: 'bob',
    source: 'web',
    daysAgo: 110,
    topics: ['tls', 'performance', 'article', 'security'],
  },
  {
    title: "OAuth 2.1 Draft: What's Changing",
    content:
      "OAuth 2.1 consolidates RFCs, removes deprecated grant types (implicit, password). We're already on best practices: code+PKCE for SPA, refresh rotation. Aligned.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 75,
    topics: ['oauth', 'spec', 'article', 'security'],
  },
  {
    title: 'Passkeys: The Future of Auth',
    content:
      "Passkeys (WebAuthn) replace passwords. Better UX, better security. We'll add as alternative login Q3.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 80,
    topics: ['passkeys', 'auth', 'article', 'webauthn'],
  },
  {
    title: 'JWT Security Best Practices',
    content:
      "Short-lived access tokens (15 min). Long-lived refresh (rotated). Don't store sensitive data in JWT. We follow.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 95,
    topics: ['jwt', 'security', 'article', 'best-practices'],
  },
  {
    title: 'Zero-Trust Architecture: Beyond the Hype',
    content:
      "Zero trust = verify every request. Service-to-service mTLS, user JWT, audit log. We're mostly there; mTLS pending.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 100,
    topics: ['zero-trust', 'security', 'article', 'architecture'],
  },
  {
    title: 'SOC 2 Type II: Cost vs Benefit',
    content:
      "SOC 2 audit costs ~$30k. Required for enterprise. We're in pre-audit prep. Filed for Q4 audit. Driving: enterprise deal flow.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 50,
    topics: ['soc2', 'compliance', 'article', 'enterprise'],
  },
  {
    title: 'How Apple Implements Differential Privacy',
    content:
      "Apple's differential privacy adds noise to user data before aggregation. Reference for our analytics pipeline; we don't use DP today.",
    owner: 'sarah',
    source: 'web',
    daysAgo: 130,
    topics: ['apple', 'privacy', 'article', 'dp'],
  },
  {
    title: 'Encryption at Rest: Postgres Approaches',
    content:
      'pgcrypto column-level vs full-disk encryption (AWS RDS native). We use AWS RDS encryption. Considering pgcrypto for sensitive columns (e.g., 2FA secrets).',
    owner: 'sarah',
    source: 'web',
    daysAgo: 85,
    topics: ['encryption', 'postgres', 'article', 'security'],
  },
  {
    title: 'AWS KMS: Cost-Effective Patterns',
    content:
      'KMS data keys: encrypt-once, store ciphertext, request KMS only for decryption. Saves API calls. Used for our encryption-at-rest pipeline.',
    owner: 'bob',
    source: 'web',
    daysAgo: 90,
    topics: ['aws', 'kms', 'article', 'encryption'],
  },
  {
    title: 'Multi-Region Postgres: Patroni Setup',
    content:
      "Patroni for PG replication + failover. We don't multi-region today (RPO 30s acceptable). Future: when EU data residency required.",
    owner: 'bob',
    source: 'web',
    daysAgo: 75,
    topics: ['postgres', 'patroni', 'article', 'replication'],
  },
  {
    title: 'TimescaleDB for Time-Series Data',
    content:
      'Considered for our metrics/analytics. Killed: small data volume (only 30 days), Postgres B-tree fine. Revisit at 100M rows.',
    owner: 'bob',
    source: 'web',
    daysAgo: 85,
    topics: ['timescaledb', 'postgres', 'article', 'metrics'],
  },
  {
    title: 'ClickHouse for Real-Time Analytics',
    content:
      'ClickHouse for analytics: column-store, fast aggregations. Considered for product analytics. Killed: PostHog already gives us what we need.',
    owner: 'bob',
    source: 'web',
    daysAgo: 90,
    topics: ['clickhouse', 'analytics', 'article', 'column-store'],
  },
  {
    title: 'PostHog: Open-Source Analytics',
    content:
      'We use PostHog for product analytics (events, funnels). Self-hosted on a $10/mo VM. Saves $300/mo on Mixpanel.',
    owner: 'alex',
    source: 'web',
    daysAgo: 80,
    topics: ['posthog', 'analytics', 'article', 'open-source'],
  },
  {
    title: 'Sentry vs Datadog APM',
    content:
      'We use Sentry for errors, Datadog for APM. Different tools, different jobs. Total $200/mo. Worth every penny.',
    owner: 'bob',
    source: 'web',
    daysAgo: 70,
    topics: ['sentry', 'datadog', 'article', 'observability'],
  },
  {
    title: 'OpenTelemetry: One Standard to Rule Them',
    content:
      'OTel for tracing. Slowly adopting. Replaces our hand-rolled trace IDs. Cleaner correlation.',
    owner: 'bob',
    source: 'web',
    daysAgo: 65,
    topics: ['opentelemetry', 'observability', 'article', 'tracing'],
  },
]

// ── 7. Internal team & culture (35) ─────────────────────────────────────────
const INTERNAL: MemoryDef[] = [
  {
    title: 'All-hands deck - March 2026',
    content:
      "March all-hands. Highlights: Acme contract signed, Polaris alpha shipped, hiring update (Priya M. + Marco F.), $3.5M ARR. Lowlights: Sarah's departure, Bob's sabbatical. Goals for April.",
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 60,
    topics: ['all-hands', 'march', 'company', 'metrics'],
  },
  {
    title: 'All-hands deck - April 2026',
    content:
      'April all-hands. Polaris GA on track for May 30. Massive Dynamic discovery call went well. Priya M. starts Monday. Q2 OKRs reviewed. AMA after.',
    owner: 'alex',
    source: 'google_docs',
    daysAgo: 25,
    topics: ['all-hands', 'april', 'company', 'okrs'],
  },
  {
    title: "Q1 retro - what worked, what didn't",
    content:
      "Worked: speed of execution, customer momentum (Acme), team cohesion. Didn't: handoff process when Sarah left (lost some context), too few hires. Action: better handoff doc template.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 95,
    topics: ['retro', 'q1', 'team', 'reflection'],
  },
  {
    title: 'Engineering values doc',
    content:
      'We value: ship fast, document decisions, write tests for the painful stuff, no hero culture, collective code ownership, async-first communication. Reviewed quarterly.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 78,
    topics: ['culture', 'values', 'engineering', 'documentation'],
  },
  {
    title: 'Onboarding: week 1 checklist',
    content:
      'Day 1: laptop setup, AWS access, codebase walkthrough. Day 2: pair on existing PR. Day 3: pick a small bug, ship it. Day 5: 1:1 + first weekly retro.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 90,
    topics: ['onboarding', 'week-1', 'process', 'new-hire'],
  },
  {
    title: 'Onboarding: week 2 - first PR',
    content:
      "By Friday of week 2, new hire has shipped a small PR (bug fix, doc update) and reviewed someone else's PR. Sets the bar: code review is part of the job.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 90,
    topics: ['onboarding', 'week-2', 'process', 'first-pr'],
  },
  {
    title: 'Onboarding: month 1 review',
    content:
      'End of month 1, structured 1:1: "What surprised you? What\'s broken? What do you want to own next?" 30 min. Honest answers shape the next 30 days.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 88,
    topics: ['onboarding', 'month-1', 'review', 'feedback'],
  },
  {
    title: 'Performance review template',
    content:
      "Quarterly: each IC writes a 1-pager (what I did, what I learned, what's next). 1:1 with founder reviews. No surprises by year-end.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 100,
    topics: ['performance', 'review', 'template', 'process'],
  },
  {
    title: 'Compensation philosophy',
    content:
      "We pay 60th percentile market. Equity is meaningful (0.3-0.5% for senior). We don't do bonuses or commissions. Trust + transparency on raises.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 95,
    topics: ['comp', 'philosophy', 'equity', 'transparency'],
  },
  {
    title: 'Equity refresh policy',
    content:
      'Annual refresh grants for ICs hitting expectations. Cliff: 1 year. Vesting: 4 years. Refresh: 25% of original grant per year.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 90,
    topics: ['equity', 'refresh', 'vesting', 'comp'],
  },
  {
    title: 'Code of conduct',
    content:
      'Inclusive language. No tolerance for harassment. Open to feedback. Founder-enforced. We follow Citizen Code of Conduct as base, customized.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 110,
    topics: ['coc', 'culture', 'inclusion', 'process'],
  },
  {
    title: 'Anti-harassment training Q1',
    content:
      'All employees completed 1-hour anti-harassment training. New hires get within 30 days of start. Yearly refresher.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 80,
    topics: ['training', 'harassment', 'compliance', 'people-ops'],
  },
  {
    title: 'Engineering manager training notes',
    content:
      'Considered hiring an EM. Killed for now (we have 5 ICs, founder is the EM). Plan: hire EM at 8 ICs.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 75,
    topics: ['em', 'management', 'team-design', 'planning'],
  },
  {
    title: 'IC growth ladder rubric',
    content:
      'Drafted: junior, mid, senior, staff. Each level: scope, autonomy, impact. Reviewed quarterly.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 85,
    topics: ['ladder', 'ic', 'rubric', 'career'],
  },
  {
    title: 'Career conversation framework',
    content:
      'Quarterly: "What do you want to be doing in 12 months? What\'s blocking that?" Together we find a path. Rare to outgrow the role at our size.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 88,
    topics: ['career', 'conversation', 'development', 'process'],
  },
  {
    title: 'Travel reimbursement policy',
    content:
      'Conferences: company pays for 1 conference/yr per IC + flight + hotel. Customer travel: company pays. Standard NDA-signed expense report.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 85,
    topics: ['travel', 'reimbursement', 'policy', 'people-ops'],
  },
  {
    title: 'Vacation policy: unlimited PTO Q&A',
    content:
      'Common Qs: (1) "Will I be judged for taking vacation?" No. (2) "Is there a minimum?" Yes, 15 days minimum. (3) "Do I plan it with founder?" Yes, 2 weeks notice for trips > 1 week.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 100,
    topics: ['vacation', 'pto', 'culture', 'policy'],
  },
  {
    title: 'Office WiFi password reset',
    content:
      'WiFi password rotation due. New: Polar1s2026!. Updated in 1Password under "Office WiFi".',
    owner: 'alex',
    source: 'slack',
    daysAgo: 30,
    topics: ['office', 'wifi', 'password', 'rotation'],
  },
  {
    title: 'Diwali bonus + holiday calendar',
    content:
      'Diwali bonus: 1 month base. Holiday calendar 2026: Republic Day, Holi, Eid, Diwali, Christmas + 2 personal days. Confirmed in HR docs.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 105,
    topics: ['holiday', 'bonus', 'people-ops', 'calendar'],
  },
  {
    title: 'Q2 budget approval',
    content:
      'Q2 budget approved: $620k operating + $150k AWS + $30k tooling. Total $800k. On track for $200k/mo burn.',
    owner: 'alex',
    source: 'gmail',
    daysAgo: 75,
    topics: ['budget', 'q2', 'finance', 'planning'],
  },
  {
    title: 'Slack: AMA with founder',
    content:
      'Monthly AMA. Topics: Polaris timeline, Series A planning, hiring. Most-asked: "Are we still independent at 100 employees?" Answer: "We aim to be."',
    owner: 'alex',
    source: 'slack',
    daysAgo: 50,
    topics: ['ama', 'founder', 'transparency', 'company'],
  },
  {
    title: 'Slack: lunch debate on tabs vs spaces',
    content:
      "Long debate. Result: prettier auto-formats with 2-space indent. Settled. Don't reopen.",
    owner: 'sarah',
    source: 'slack',
    daysAgo: 130,
    topics: ['tabs-spaces', 'debate', 'formatting', 'team-culture'],
  },
  {
    title: 'Slack: best coffee in Bandra',
    content:
      "Aroma's espresso. Bayway's pour-over. Consensus: Aroma. Office's automatic machine: \"good enough.\"",
    owner: 'bob',
    source: 'slack',
    daysAgo: 90,
    topics: ['coffee', 'bandra', 'team-culture', 'fun'],
  },
  {
    title: 'Engineering retro - sprint 14',
    content:
      "Sprint 14 retro. Worked: shipped 4 PRs ahead of estimate. Didn't: 1 PR rebased twice due to migration conflicts. Action: mention migrations in standup.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 70,
    topics: ['retro', 'sprint-14', 'team', 'process'],
  },
  {
    title: 'Engineering retro - sprint 15',
    content:
      "Sprint 15 retro. Worked: cross-pair on Polaris. Didn't: ran out of OpenAI quota mid-sprint. Action: better quota monitoring.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 60,
    topics: ['retro', 'sprint-15', 'team', 'process'],
  },
  {
    title: 'Engineering retro - sprint 16',
    content:
      "Sprint 16 retro. Worked: shipped Polaris alpha to Acme. Didn't: missed selection-flicker bug for a week. Action: better customer escalation path.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 50,
    topics: ['retro', 'sprint-16', 'team', 'process'],
  },
  {
    title: 'Engineering retro - sprint 17',
    content:
      "Sprint 17 retro. Worked: Sarah's smooth handoff. Didn't: not enough customer-facing demos this sprint. Action: 1 customer demo per week.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 40,
    topics: ['retro', 'sprint-17', 'team', 'process'],
  },
  {
    title: 'Engineering retro - sprint 18',
    content:
      "Sprint 18 retro. Worked: closed Polaris GA blockers (5/5). Didn't: deploy on prod broke for 4 min. Action: deploy in low-traffic windows.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 30,
    topics: ['retro', 'sprint-18', 'team', 'process'],
  },
  {
    title: 'Sprint planning conventions',
    content:
      "Outcome: each engineer has clear story for the sprint + 1 stretch. No more than 6 stories per IC. Don't commit to what we can't deliver.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 95,
    topics: ['sprint', 'planning', 'convention', 'process'],
  },
  {
    title: 'Documentation as code: VitePress decision',
    content:
      'Switched docs from Notion to VitePress (Markdown in repo). Wins: version-controlled, deploys with code, reviewable. Losses: less collab-friendly. Worth it.',
    owner: 'alex',
    source: 'notion',
    daysAgo: 65,
    topics: ['docs', 'vitepress', 'tooling', 'team'],
  },
  {
    title: 'Slack: documenting our decisions properly',
    content:
      'Convention: every non-trivial decision gets a Notion doc. Title format: "Decision: <subject>". Includes context, options considered, decision, why.',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 60,
    topics: ['decisions', 'notion', 'process', 'convention'],
  },
  {
    title: 'Hot take: should we hire a CTO?',
    content:
      "Slack debate. Decision: not yet. Founder + senior IC team is enough until 8+ engineers. Title isn't leverage; people are.",
    owner: 'alex',
    source: 'slack',
    daysAgo: 100,
    topics: ['cto', 'hiring', 'team-design', 'debate'],
  },
  {
    title: 'Should we move to a bigger office?',
    content:
      'Current Bandra office: 12 desks. We have 5 ICs + 2 founders + occasional contractors. Need 15-20 desks by Q4. Looking at WeWork or BKC.',
    owner: 'alex',
    source: 'slack',
    daysAgo: 35,
    topics: ['office', 'bandra', 'wework', 'team-growth'],
  },
  {
    title: 'Friday demos this week',
    content:
      "Each engineer demos their week's work in 5 min. Slack thread captures recordings. We've done this for 18 weeks.",
    owner: 'alex',
    source: 'slack',
    daysAgo: 7,
    topics: ['friday-demos', 'team-culture', 'process', 'convention'],
  },
  {
    title: 'Async-first communication norms',
    content:
      "Default: async. Slack threads for non-urgent. Tagging @mention only when urgent. Sync calls only when async wouldn't work. Reduces interruption cost.",
    owner: 'alex',
    source: 'notion',
    daysAgo: 80,
    topics: ['async', 'communication', 'culture', 'process'],
  },
]

const ALL_MEMORIES: MemoryDef[] = [
  ...POLARIS,
  ...CUSTOMERS,
  ...HIRING,
  ...STRATEGY,
  ...ENG,
  ...ARTICLES,
  ...INTERNAL,
]

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

  const purged = await prisma.memory.deleteMany({
    where: {
      organization_id: org.id,
      page_metadata: { path: ['tag'], equals: TAG },
    },
  })
  if (purged.count > 0) logger.log('[seed:mesh] purged previous', { count: purged.count })

  const insertedIds: string[] = []
  for (let i = 0; i < ALL_MEMORIES.length; i++) {
    const m = ALL_MEMORIES[i]
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
        url: m.url ?? buildFallbackUrl(m, i),
        timestamp: BigInt(ts),
        created_at: new Date(ts),
        last_accessed: new Date(ts),
        confidence_score: 0.85,
        importance_score: 0.5 + ((i * 7) % 50) / 100,
        page_metadata: {
          topics: m.topics,
          source_label: m.source,
          tag: TAG,
          demo: true,
        },
      },
    })
    insertedIds.push(row.id)
    if ((i + 1) % 50 === 0) logger.log('[seed:mesh] inserted', { count: i + 1 })
  }
  logger.log('[seed:mesh] all inserted', { count: insertedIds.length })

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

  // Clear stale mesh snapshot so the next visualization request rebuilds layout.
  try {
    await prisma.meshSnapshot.deleteMany({
      where: { scope_type: 'organization', scope_id: org.id },
    })
    logger.log('[seed:mesh] cleared mesh snapshot for org')
  } catch {
    // table may not exist on older deployments; ignore
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
