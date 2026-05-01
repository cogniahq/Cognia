/**
 * Seeds the "Project Polaris handover" demo cluster into the Blit Labs
 * workspace. Story: two engineers (Sarah, Bob) built a realtime-collab
 * feature called Polaris, then left the company. A new engineer (Alex)
 * joined and has to ship in one week. The context is scattered across
 * Slack, Notion, Google Docs, GitHub, Linear, Gmail, and Loom.
 *
 * Idempotent — re-running deletes only the Polaris memories (matched by
 * page_metadata.polaris === true) before re-inserting.
 *
 * Prerequisite: a `blit-labs` Organization with users alex/sarah/bob
 * @blitlabs.com must already exist.
 *
 * Usage:
 *   npm run seed:polaris
 */
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.lib'
import { memoryMeshService } from '../services/memory/memory-mesh.service'
import { logger } from '../utils/core/logger.util'

const ORG_SLUG = 'blit-labs'
const ORG_NAME = 'Blit Labs'
const DEMO_PASSWORD = 'DemoPassword2026!'
const POLARIS_TAG = 'polaris-handover'

const SEED_USERS: Record<Owner, { email: string; name: string }> = {
  alex: { email: 'alex@blitlabs.com', name: 'Alex Chen' },
  sarah: { email: 'sarah@blitlabs.com', name: 'Sarah Patel' },
  bob: { email: 'bob@blitlabs.com', name: 'Bob Kim' },
}

type Owner = 'alex' | 'sarah' | 'bob'

interface PolarisMemory {
  title: string
  content: string
  owner: Owner
  source: string // slack | notion | google_docs | github | linear | gmail | loom
  daysAgo: number
  topics: string[]
  url?: string
}

const MEMORIES: PolarisMemory[] = [
  // ── Cluster 1: Project Kickoff (~165–175 days ago) ───────────────────────
  {
    title: 'ACME Inc interview — 3rd customer asking for realtime collab',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 175,
    topics: ['polaris', 'customer-interview', 'realtime', 'discovery'],
    url: 'https://docs.google.com/document/d/acme-interview-q1',
    content:
      "Spoke with ACME's design lead today (Priya). Their team of 14 has been collaborating in our canvas via screen-share + a separate Figma file, which is brutal. This is the third enterprise prospect this month who asked for live multi-cursor + co-editing. ACME said: 'We'll commit to a $48k annual seat plan if you ship this by EOY.' Their procurement timeline gives us until end of next quarter. Recommend prioritizing this above the AI-suggestions roadmap. — Sarah",
  },
  {
    title: 'Polaris RFC — realtime co-editing for canvas v3',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 170,
    topics: ['polaris', 'rfc', 'architecture', 'realtime'],
    url: 'https://notion.so/blit/polaris-rfc',
    content:
      '**Goal**: enable simultaneous editing of canvas documents by 2-100 concurrent users with sub-100ms cursor latency and zero data loss. **Non-goals**: voice/video, comments-as-realtime (already shipped). **Approach**: CRDT-based document model with WebSocket transport. **Open questions**: (1) Build vs. Liveblocks/Pusher? (2) Y.js or Automerge? (3) How do we handle offline → online conflict resolution for a user who edits offline for 3 days? **Owner**: Sarah (TL), Bob (BE). **Target**: GA in 4 months.',
  },
  {
    title: 'Slack #eng-realtime: build vs Liveblocks debate',
    owner: 'bob',
    source: 'slack',
    daysAgo: 168,
    topics: ['polaris', 'build-vs-buy', 'liveblocks', 'cost-analysis'],
    url: 'https://blitlabs.slack.com/archives/C0POLARIS/p1234567890',
    content:
      "Bob: I costed Liveblocks at our projected scale. $8k/mo at 5k MAU, jumping to $25k/mo at 20k. We'd hit that in ~9 months at current growth. Plus their conflict-resolution is opaque to us — can't optimize. Sarah: agree, building wins on margin and on customer perception (data residency story is stronger when we own the stack). Decision: build. Spike for 2 weeks to de-risk Y.js, then commit. Bob to write up architecture doc by Friday.",
  },
  {
    title: 'POLARIS-1 — master tracking ticket',
    owner: 'sarah',
    source: 'linear',
    daysAgo: 165,
    topics: ['polaris', 'project-tracking', 'milestones'],
    url: 'https://linear.app/blit/issue/POLARIS-1',
    content:
      'Master ticket for Project Polaris. Phases: (1) Spike & arch decision [done], (2) Y.js integration on canvas v3 [in progress], (3) Server persistence + presence [in progress], (4) Conflict resolution + offline mode [open], (5) Beta with ACME, Northwind, Globex [planned], (6) GA. Sub-tickets POLARIS-2 through POLARIS-47. Risk register tracked separately in Notion.',
  },
  {
    title: 'Slack #announcements: Polaris kickoff',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 165,
    topics: ['polaris', 'kickoff', 'team'],
    url: 'https://blitlabs.slack.com/archives/C0ANNOUNCE/p1234500000',
    content:
      "Sarah: Hey team — kicking off Project Polaris this week. Realtime co-editing on canvas v3. I'm TL, Bob owns backend. Aiming for GA in 4 months — yes, aggressive, but ACME is our anchor customer and they'll churn if we don't ship. Will post weekly updates here. DMs welcome for help. 🚀",
  },

  // ── Cluster 2: Architecture Decisions (~130–150 days ago) ────────────────
  {
    title: 'Polaris arch — CRDT vs OT, with our constraints',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 150,
    topics: ['polaris', 'crdt', 'ot', 'architecture'],
    url: 'https://notion.so/blit/polaris-crdt-vs-ot',
    content:
      '**TL;DR**: going with CRDT. **OT pros**: smaller payloads, better-suited to centralized topology like Google Docs. **OT cons**: complex transformation matrix for our document model (tree-like, not flat), needs strict server ordering, hard to support offline edits. **CRDT pros**: handles offline natively, peer-to-peer-friendly if we ever need it, mature libraries (Y.js, Automerge). **CRDT cons**: larger payloads, garbage collection complexity. **Decision**: CRDT. Our document model is tree-shaped (groups, frames, nested layers), and offline-edit support is a strict ACME requirement.',
  },
  {
    title: 'Slack #eng-realtime: Y.js vs Automerge thread',
    owner: 'bob',
    source: 'slack',
    daysAgo: 148,
    topics: ['polaris', 'yjs', 'automerge', 'crdt'],
    url: 'https://blitlabs.slack.com/archives/C0POLARIS/p1234600000',
    content:
      'Bob: spent 4 days spiking both. Y.js: more performant on our document size (avg 12k nodes), better awareness/presence primitives, Kevin Jahns is responsive on GitHub. Automerge: cleaner API, JSON-native (which fits our existing model), but 3-4x slower on large docs in my benchmarks. Sarah: which has a better story on conflict-resolution edge cases? Bob: Y.js, by a hair — XmlFragment + RelativePosition handle our nested-layers model out of the box. Sarah: ship it.',
  },
  {
    title: 'Decision: Polaris uses Y.js + custom presence layer',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 145,
    topics: ['polaris', 'yjs', 'decision', 'presence'],
    url: 'https://notion.so/blit/polaris-yjs-decision',
    content:
      "**Decision**: Y.js for the CRDT layer, custom presence + cursor sync built on top. **Why not built-in awareness**: Y.js awareness is great for cursors but doesn't understand our 'selection' semantics (rectangle of layers). We'll roll our own thin layer on top. **Risks**: (1) ecosystem smaller than Automerge's enterprise contracts, (2) performance ceiling unknown beyond 1k users in a single doc — to be tested. **Mitigation**: pin to stable Y.js releases, contribute back upstream, build presence as plug-in we can swap.",
  },
  {
    title: 'WebSocket scaling design — sticky sessions + Redis pub/sub',
    owner: 'bob',
    source: 'google_docs',
    daysAgo: 140,
    topics: ['polaris', 'websocket', 'scaling', 'redis', 'infra'],
    url: 'https://docs.google.com/document/d/polaris-ws-scaling',
    content:
      'Single ws-server can hold ~10k connections (k6 tested). Beyond that, we shard by document_id with sticky sessions on AWS ALB. Cross-shard awareness via Redis pub/sub (we already run Redis 7 for BullMQ). Failover: when a ws-server dies, clients reconnect → new shard picks them up → state replays from Postgres snapshot + delta. Snapshot interval: every 30s OR every 100 ops, whichever first. Delta retention: 7 days (long enough for offline-edit replay).',
  },
  {
    title: 'Slack: why not WebRTC?',
    owner: 'bob',
    source: 'slack',
    daysAgo: 138,
    topics: ['polaris', 'webrtc', 'websocket', 'architecture'],
    url: 'https://blitlabs.slack.com/archives/C0POLARIS/p1234700000',
    content:
      "Q from Raj (intern): why not P2P via WebRTC? Bob: three reasons. (1) NAT/firewall traversal in enterprise networks is a nightmare — most ACME-tier customers block UDP. (2) We'd need TURN servers anyway, which negates the cost win. (3) Our compliance story requires server-side audit logs of every edit; WebRTC P2P bypasses our server. So: WebSocket + server-mediated, not because it's simpler (it's not), but because audit + enterprise networks force the issue.",
  },
  {
    title: 'GitHub PR #421 — initial Y.js integration',
    owner: 'bob',
    source: 'github',
    daysAgo: 130,
    topics: ['polaris', 'yjs', 'pr', 'integration'],
    url: 'https://github.com/blitlabs/canvas/pull/421',
    content:
      "Wires Y.js into the canvas v3 document model. New module `crdt/document.ts` wraps Y.Doc with our layer/group/frame semantics. Persistence still uses our existing Postgres `documents` table; CRDT state is encoded as a Y.js binary update and stored in `documents.crdt_state` (BYTEA). On load, we decode → re-hydrate. Tests: round-trip 1k random ops survives crash-and-reload. **NOT yet wired**: the WebSocket transport — that's PR #487. Reviewer: Sarah. Merged after 11 review comments.",
  },

  // ── Cluster 3: Implementation & Issues (~60–105 days ago) ────────────────
  {
    title: 'Slack: PoC at 50 users — no perceptible lag 🎉',
    owner: 'bob',
    source: 'slack',
    daysAgo: 105,
    topics: ['polaris', 'poc', 'performance', 'milestone'],
    url: 'https://blitlabs.slack.com/archives/C0POLARIS/p1234800000',
    content:
      'Bob: just ran 50 simulated users co-editing the ACME canvas dump for 30 minutes. p50 cursor latency 38ms, p99 95ms. Server CPU 18%. Sarah: 🚀 — ship it to internal dogfood next week? Bob: yep, opening PR #487 today.',
  },
  {
    title: 'GitHub PR #487 — server-side persistence + ws transport',
    owner: 'bob',
    source: 'github',
    daysAgo: 90,
    topics: ['polaris', 'websocket', 'persistence', 'pr'],
    url: 'https://github.com/blitlabs/canvas/pull/487',
    content:
      'Adds the WebSocket gateway (`api/src/realtime/`) + Postgres snapshot worker. Snapshots every 30s, delta log retained 7 days. New env: POLARIS_WS_PORT (default 8080), POLARIS_SNAPSHOT_INTERVAL_MS (30000), POLARIS_DELTA_RETENTION_DAYS (7). Migration `20260120_polaris_documents.sql` adds `crdt_state` BYTEA + `crdt_clock` BIGINT. **Open**: TLS termination — currently relying on ALB; need to verify wss:// works through corporate proxies (ACME uses Zscaler).',
  },
  {
    title: 'Polaris perf benchmarks — 100 / 500 / 1000 users',
    owner: 'sarah',
    source: 'notion',
    daysAgo: 80,
    topics: ['polaris', 'performance', 'benchmarks', 'scaling'],
    url: 'https://notion.so/blit/polaris-benchmarks-q2',
    content:
      'k6 load tests on staging. **100 users**: p50 35ms, p99 90ms, no errors. **500 users**: p50 48ms, p99 180ms, 0.02% reconnect rate. **1000 users**: p50 110ms (degraded), p99 720ms, server CPU 88% on a single shard. **Conclusion**: single shard tops out around 700 concurrent users in a doc. Beyond that we MUST shard. Bob has a sharding PR drafted but it depends on solving the cross-shard awareness problem (PUBSUB hot-key issue when one doc has hundreds of users).',
  },
  {
    title: 'Slack: text-input lag at 200+ users — debugging',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 75,
    topics: ['polaris', 'performance', 'debugging', 'lag'],
    url: 'https://blitlabs.slack.com/archives/C0POLARIS/p1234900000',
    content:
      'Sarah: weird — at 200+ users, text input has 300-400ms lag spikes every ~10s. Cursor sync stays smooth. Hypothesis: snapshot worker is blocking the event loop when it serializes the CRDT state. Bob: ah, yes. Y.js encoding is sync. Can move to a worker thread. Sarah: yes please, this is the #1 thing customers will notice. Bob: opening POLARIS-29.',
  },
  {
    title: 'Loom — Sarah walking through Polaris architecture',
    owner: 'sarah',
    source: 'loom',
    daysAgo: 70,
    topics: ['polaris', 'architecture', 'walkthrough', 'video'],
    url: 'https://loom.com/share/polaris-arch-walkthrough',
    content:
      '[Loom recording, 28 minutes] Sarah walks through the full Polaris architecture: client-side Y.Doc, the websocket gateway, the snapshot worker, the delta log, awareness/presence layer, and the offline reconciliation strategy. Includes whiteboard-style diagrams. Annotations call out the three known limitations (offline >7 days, cross-shard at >700 users, snapshot blocking on huge docs). Required watching for any new engineer joining the project.',
  },
  {
    title: 'POLARIS-23: offline conflict edge case (UNRESOLVED)',
    owner: 'bob',
    source: 'linear',
    daysAgo: 65,
    topics: ['polaris', 'offline', 'conflict-resolution', 'unresolved', 'risk'],
    url: 'https://linear.app/blit/issue/POLARIS-23',
    content:
      "**Status: Open, P1, no owner since Bob's sabbatical**. When a user edits offline for >7 days and then comes back online, our delta log has been GC'd, so we can't replay. Y.js can still merge using vector clocks, BUT: if the same nodes were modified online, the offline edit silently wins on later timestamps. ACME flagged this as a blocker. **Options considered**: (a) extend delta retention to 30d (3x storage cost), (b) snapshot the offline client on disconnect and diff on reconnect (UX work + needs SW changes), (c) prompt user to choose on conflict (poor UX). No decision made. Sarah's last comment: 'Need to talk to Bob in person before he leaves.'",
  },

  // ── Cluster 4: Customer Beta (~40–60 days ago) ───────────────────────────
  {
    title: 'Polaris Beta-1 — feedback synthesis',
    owner: 'sarah',
    source: 'google_docs',
    daysAgo: 55,
    topics: ['polaris', 'beta', 'customer-feedback', 'acme'],
    url: 'https://docs.google.com/document/d/polaris-beta-1-feedback',
    content:
      "Beta cohort: ACME (14 users), Northwind (8), Globex (5). **Wins**: cursor sync feels 'native' (Priya, ACME), conflict resolution 'just works' for online-only flow (3 mentions), presence avatars are a hit. **Pain points**: (1) cursor disappears on page-scroll for ~500ms, (2) when 2 users select the same group, the group flickers between selection borders [bug], (3) offline >24h triggers a 'document recovered' modal that customers find confusing, (4) ACME hit the 700-user limit during a company-wide brainstorm and got rate-limit errors. Customer NPS for the feature: +51 (high but with caveats).",
  },
  {
    title: 'Slack: ACME loves it, 2 critical bugs',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 50,
    topics: ['polaris', 'acme', 'bugs', 'critical'],
    url: 'https://blitlabs.slack.com/archives/C0POLARIS/p1235000000',
    content:
      "Sarah: just got off a call with Priya at ACME. Quote: 'This is the feature we've been waiting two years for.' BUT — two blockers for them going to GA: (1) selection-flicker bug at >5 simultaneous selectors, (2) rate-limit errors during their all-hands. Both are P0 for GA. Bob: I can knock out (1) this week. (2) is the sharding work, which is still 2-3 sprints. Sarah: tell Priya we'll fix (1) immediately and (2) within the GA target.",
  },
  {
    title: 'GitHub Issue #533 — cursor sync visual bug',
    owner: 'sarah',
    source: 'github',
    daysAgo: 48,
    topics: ['polaris', 'bug', 'cursor', 'frontend'],
    url: 'https://github.com/blitlabs/canvas/issues/533',
    content:
      "Repro: 2 users, both scroll the canvas at the same time → remote cursor briefly jumps to wrong position before snapping. Root cause (suspected): we transform cursor coords from doc-space to viewport-space on the receiving client; if the sender's viewport scrolled mid-flight, the coord is stale. Fix: send doc-space coords, transform on receiver. Estimate: half a day. Owner was Bob → unassigned (Bob on sabbatical). **PR not opened.**",
  },
  {
    title: 'Email — ACME procurement re: GA timeline',
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 45,
    topics: ['polaris', 'acme', 'ga', 'commercial'],
    url: 'https://mail.google.com/mail/u/0/#inbox/polaris-acme-ga-q2',
    content:
      "From: priya.kapoor@acme.com / To: sarah@blitlabs.com / Subject: Polaris GA — timeline confirmation. 'Sarah — looping in our procurement lead. We're ready to convert from Beta to a 14-seat GA contract ($48k/yr) the moment Polaris ships GA. We'd need GA by end of Q2 (May 30) to align with our internal rollout plan. The two issues we flagged in the beta call (selection flicker, rate-limit at scale) need to be resolved. Please confirm timeline by EOW.' — Sarah replied: 'Confirming Q2 GA. Both issues will be fixed.' [Note: this commitment was made BEFORE Bob's sabbatical announcement.]",
  },

  // ── Cluster 5: Departures & Handoff (~14–35 days ago) ────────────────────
  {
    title: "Notion: Sarah's Polaris handoff doc (DRAFT — incomplete)",
    owner: 'sarah',
    source: 'notion',
    daysAgo: 30,
    topics: ['polaris', 'handoff', 'departure', 'incomplete'],
    url: 'https://notion.so/blit/polaris-handoff-sarah',
    content:
      "**Polaris handoff** — what's done, what's open, what's risky. **Done**: Y.js integration, ws gateway, snapshots, presence, beta-1 with ACME/Northwind/Globex. **In flight**: sharding (Bob's branch `polaris/sharding`, ~60% complete), selection-flicker fix (no PR yet), snapshot-worker-thread move (PR #612 open). **Open / Risky**: POLARIS-23 (offline >7d), 700-user single-shard ceiling, ACME GA committed for May 30. **Things only I/Bob know**: how the Y.js awareness layer was customized for our selection semantics — see Loom + read `crdt/awareness.ts` carefully, the comments are sparse. **Things only Bob knows**: the Postgres snapshot encoding and how to recover from a corrupted delta log. Bob's notes on this are in his Notion workspace at /bob/polaris-internals — **MAY BE DELETED ON HIS OFFBOARDING**. ⚠️ Pull these before his last day.",
  },
  {
    title: "Email — Sarah's farewell + Polaris status",
    owner: 'sarah',
    source: 'gmail',
    daysAgo: 21,
    topics: ['polaris', 'departure', 'farewell', 'status'],
    url: 'https://mail.google.com/mail/u/0/#sent/polaris-farewell-sarah',
    content:
      "From: sarah@blitlabs.com / To: team@blitlabs.com / Subject: Goodbye + Polaris status. 'Hi all — Friday is my last day. Joining Anthropic to work on alignment research. Polaris is roughly 70% to GA: feature-complete for the online-only flow, but two critical items remain (offline-edge-case POLARIS-23, and the ACME-blocking sharding work for >700 users). Bob is on a 6-month sabbatical starting in 2 weeks, which means whoever picks up Polaris will be flying solo. I've put a handoff doc at /polaris-handoff. The Loom walkthrough is required watching. Please pull Bob's Notion notes before his offboarding completes — there are details in there that aren't in any RFC. Wishing the team the best.' — Sarah.",
  },
  {
    title: 'Slack: Bob is taking 6 months off — coverage plan?',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 28,
    topics: ['polaris', 'departure', 'sabbatical', 'staffing'],
    url: 'https://blitlabs.slack.com/archives/C0LEADS/p1235100000',
    content:
      "Sarah → leads: heads-up — Bob is taking a 6-month sabbatical starting in 2 weeks. He's burned out from the GA push. Combined with my departure, this means Polaris has no full-time engineer after May 1. We've committed to ACME for May 30 GA. Options: (a) hire a senior who can ramp in 2-3 weeks, (b) pull Liam off canvas-perf for 6 weeks, (c) push GA to August and refund ACME's prepay. CEO: hire ASAP, recruiter brief going out today. Will need to bridge with whoever joins.",
  },
  {
    title: "Notion: Bob's last status update before sabbatical",
    owner: 'bob',
    source: 'notion',
    daysAgo: 25,
    topics: ['polaris', 'status', 'departure', 'sabbatical'],
    url: 'https://notion.so/blit/polaris-bob-final-status',
    content:
      '**Polaris status (Bob, final update before sabbatical)**. **Sharding branch (`polaris/sharding`)**: ~60% done. The cross-shard awareness piece works locally but flakes intermittently in staging — I think Redis pub/sub is dropping messages under burst. Need to investigate `bull-board` metrics. **Selection-flicker bug**: I have a 30-line patch in my local branch `bob/cursor-fix` — never pushed because tests fail on Safari only. Pushed it now to GitHub as `bob/cursor-fix` (DO NOT MERGE without checking Safari). **POLARIS-23 (offline)**: still no decision. My recommendation: option (b) from the doc — snapshot the client on disconnect — but the SW work is non-trivial. **Dependencies only I know**: Y.js patch we maintain for nested-XmlFragment handling, applied via `patch-package`. If Y.js minor-version bumps, this needs re-patching.',
  },
  {
    title: 'Slack: need to talk to Bob about offline edge before Friday',
    owner: 'sarah',
    source: 'slack',
    daysAgo: 22,
    topics: ['polaris', 'offline', 'urgent', 'departure'],
    url: 'https://blitlabs.slack.com/archives/C0POLARIS/p1235200000',
    content:
      "Sarah → Bob (DM): hey — POLARIS-23 still has no decision and Friday is your last day before sabbatical. Can we book 60 min tomorrow? Whoever picks this up post-handoff is going to need either (a) a written-down decision, or (b) the context to make one. Bob: ya, let's do tomorrow 2pm. **[NO MEETING NOTES POSTED.]**",
  },

  // ── Cluster 6: Alex onboarding (~1–7 days ago, present) ──────────────────
  {
    title: 'Slack #announcements: Alex joined — taking over Polaris',
    owner: 'alex',
    source: 'slack',
    daysAgo: 6,
    topics: ['polaris', 'onboarding', 'new-hire', 'staffing'],
    url: 'https://blitlabs.slack.com/archives/C0ANNOUNCE/p1235300000',
    content:
      'CEO: 👋 welcoming Alex Chen, joining as Senior Engineer. Alex is taking over Project Polaris. Sarah and Bob have both transitioned out — Alex is flying solo on this one. ACME GA is committed for **May 30** (4 weeks from today). Please give Alex anything she needs. — Alex: hey everyone! excited to be here. spending this week reading every doc I can find. 🙏',
  },
  {
    title: "Notion: Alex's first-day notes (confused about scope)",
    owner: 'alex',
    source: 'notion',
    daysAgo: 3,
    topics: ['polaris', 'onboarding', 'open-questions', 'new-hire'],
    url: 'https://notion.so/blit/alex-day-1-notes',
    content:
      "Day 1 notes. **What I think Polaris is**: realtime co-editing for canvas v3, built on Y.js + WebSockets, currently in beta with 3 customers, committed to ACME for GA in 4 weeks. **What I'm unclear on**: (1) what's actually broken vs. what's in flight? (2) the sharding work — is it done? Sarah's handoff says '60%', Bob's last update also says '60%' but mentions Redis pub/sub flakiness in staging — is that a separate issue? (3) POLARIS-23 — there's no decision and apparently a meeting happened but no notes. (4) the selection-flicker fix is on a branch that 'fails on Safari' — what does that mean? (5) what does ACME actually need for GA vs. nice-to-have? **Action items**: pull Bob's Notion before it's deleted, watch the Loom, read crdt/awareness.ts.",
  },
  {
    title: 'Slack DM with PM (Jordan) — what does GA mean?',
    owner: 'alex',
    source: 'slack',
    daysAgo: 1,
    topics: ['polaris', 'ga', 'pm', 'scope'],
    url: 'https://blitlabs.slack.com/archives/D0JORDAN/p1235400000',
    content:
      "Alex → Jordan (DM): hey — quick one. for Polaris GA on May 30, what's the must-have list? I'm seeing references to a sharding fix (>700 users) and an offline-edge-case (POLARIS-23) but it's unclear which are GA-blocking vs post-GA. Jordan: ACME is the anchor. Their must-haves are: (1) selection-flicker fixed, (2) handle their all-hands of ~600 users without errors, (3) no data loss on offline edits. (1) is straightforward, (2) is the sharding work, (3) is POLARIS-23. ALL THREE are GA-blocking. We can de-scope the cross-shard awareness optimization — single-shard at 700 users is fine for ACME's specific use. Alex: 🙏",
  },
]

async function ensureUser(email: string): Promise<{ id: string; email: string }> {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      account_type: 'ORGANIZATION',
      email_verified_at: new Date(),
    },
  })
  return user
}

async function ensureOrg(
  alexId: string,
  sarahId: string,
  bobId: string
): Promise<{ id: string; slug: string }> {
  const existing = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })
  if (existing) return existing
  return prisma.organization.create({
    data: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      industry: 'Software / AI',
      team_size: '1-10',
      members: {
        create: [
          { user_id: alexId, role: 'ADMIN' },
          { user_id: sarahId, role: 'EDITOR' },
          { user_id: bobId, role: 'EDITOR' },
        ],
      },
    },
  })
}

async function purgePolaris(orgId: string): Promise<number> {
  const result = await prisma.memory.deleteMany({
    where: {
      organization_id: orgId,
      page_metadata: { path: ['polaris'], equals: true },
    },
  })
  return result.count
}

async function insertMemories(
  orgId: string,
  ownersByOwner: Record<Owner, string>
): Promise<string[]> {
  const insertedIds: string[] = []
  for (const m of MEMORIES) {
    const userId = ownersByOwner[m.owner]
    const ts = Date.now() - m.daysAgo * 24 * 60 * 60 * 1000
    const row = await prisma.memory.create({
      data: {
        user_id: userId,
        organization_id: orgId,
        source: m.source, // free-text: slack, notion, google_docs, github, linear, gmail, loom
        source_type: 'INTEGRATION',
        memory_type: 'REFERENCE',
        title: m.title,
        content: m.content,
        url:
          m.url ??
          `https://example.com/polaris/${m.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 50)}`,
        timestamp: BigInt(ts),
        created_at: new Date(ts),
        last_accessed: new Date(ts),
        confidence_score: 0.85,
        importance_score: 0.7 + Math.random() * 0.25,
        page_metadata: {
          topics: m.topics,
          source_label: m.source,
          polaris: true,
          tag: POLARIS_TAG,
          demo: true,
        },
      },
    })
    insertedIds.push(row.id)
  }
  return insertedIds
}

async function embedBatch(memoryIds: string[]): Promise<void> {
  // Same path the backfill script uses — generates dense + sparse vectors
  // and upserts to Qdrant.
  const BATCH = 16
  for (let i = 0; i < memoryIds.length; i += BATCH) {
    const slice = memoryIds.slice(i, i + BATCH)
    try {
      await memoryMeshService.generateEmbeddingsForMemoriesBatch(slice)
      logger.log('[seed:polaris] embedded batch', { from: i, to: i + slice.length })
    } catch (error) {
      logger.error('[seed:polaris] embedding batch failed', {
        from: i,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

async function main(): Promise<void> {
  logger.log('[seed:polaris] starting')

  // Bootstrap: create users + org if they don't exist (idempotent).
  const alex = await ensureUser(SEED_USERS.alex.email)
  const sarah = await ensureUser(SEED_USERS.sarah.email)
  const bob = await ensureUser(SEED_USERS.bob.email)
  const org = await ensureOrg(alex.id, sarah.id, bob.id)
  logger.log('[seed:polaris] workspace ready', {
    orgSlug: org.slug,
    users: { alex: alex.email, sarah: sarah.email, bob: bob.email },
  })

  const purged = await purgePolaris(org.id)
  if (purged > 0) {
    logger.log('[seed:polaris] purged previous Polaris memories', { count: purged })
  }

  const insertedIds = await insertMemories(org.id, {
    alex: alex.id,
    sarah: sarah.id,
    bob: bob.id,
  })
  logger.log('[seed:polaris] inserted memories', { count: insertedIds.length })

  await embedBatch(insertedIds)
  logger.log('[seed:polaris] complete', {
    orgSlug: ORG_SLUG,
    memoriesInserted: insertedIds.length,
    note: 'Test query: "I just joined and need to ship Project Polaris in 1 week — what do I need to know?"',
  })

  await prisma.$disconnect()
}

main().catch(err => {
  logger.error('[seed:polaris] failed', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
  process.exit(1)
})
