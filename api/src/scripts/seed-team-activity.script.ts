/**
 * Adds team-activity signals to the Blit Labs workspace so the demo feels
 * lived-in: more members, comments on key memories, shared memories,
 * saved searches, and a small set of tags.
 *
 * Idempotent. Run after seed:polaris and seed:mesh.
 *
 * Usage:
 *   npm run seed:team
 */
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.lib'
import { logger } from '../utils/core/logger.util'
import type { OrgRole } from '@prisma/client'

const ORG_SLUG = 'blit-labs'
const DEMO_PASSWORD = 'DemoPassword2026!'

interface TeamUser {
  email: string
  name: string
  role: OrgRole
}

const NEW_USERS: TeamUser[] = [
  { email: 'maya@blitlabs.com', name: 'Maya Rodriguez', role: 'EDITOR' }, // designer
  { email: 'jordan@blitlabs.com', name: 'Jordan Park', role: 'EDITOR' }, // PM
  { email: 'priya.m@blitlabs.com', name: 'Priya Mehta', role: 'EDITOR' }, // senior eng
  { email: 'marco@blitlabs.com', name: 'Marco Ferraro', role: 'EDITOR' }, // mid eng
  { email: 'aisha@blitlabs.com', name: 'Aisha Kapoor', role: 'EDITOR' }, // customer success
  { email: 'ravi@blitlabs.com', name: 'Ravi Sharma', role: 'ADMIN' }, // founder/CEO
  { email: 'diana@blitlabs.com', name: 'Diana Lin', role: 'EDITOR' }, // ops
]

interface CommentSeed {
  titleMatch: string
  authorEmail: string
  body: string
}

const COMMENTS: CommentSeed[] = [
  {
    titleMatch: "Sarah's Polaris handoff doc",
    authorEmail: 'jordan@blitlabs.com',
    body: 'Read this twice. The "things only Sarah/Bob knew" section is gold. Setting up a 1:1 with Alex on Friday to walk through it.',
  },
  {
    titleMatch: "Sarah's Polaris handoff doc",
    authorEmail: 'priya.m@blitlabs.com',
    body: "I'll start with the awareness layer in week 1. Bob's patch list looks tractable.",
  },
  {
    titleMatch: "Sarah's Polaris handoff doc",
    authorEmail: 'alex@blitlabs.com',
    body: "Pulled Bob's notion notes before his offboard cutoff - saved everything to /docs/internal/bob-archive.",
  },
  {
    titleMatch: 'POLARIS-23',
    authorEmail: 'priya.m@blitlabs.com',
    body: "Going with Option B (snapshot client on disconnect) per Bob's recommendation. Estimate: 14 days. Will pair with Marco for the SW changes.",
  },
  {
    titleMatch: 'POLARIS-23',
    authorEmail: 'jordan@blitlabs.com',
    body: 'Customer-side: ACME OK with v1.1 timeline if we ship a beta of this within 4 weeks of GA.',
  },
  {
    titleMatch: 'GA launch checklist',
    authorEmail: 'ravi@blitlabs.com',
    body: "Locked. Don't ship without all 5 hard blockers. We've committed to Acme.",
  },
  {
    titleMatch: 'GA launch checklist',
    authorEmail: 'aisha@blitlabs.com',
    body: 'Customer success runbook drafted. Reviewing with Jordan tomorrow.',
  },
  {
    titleMatch: 'ACME procurement',
    authorEmail: 'ravi@blitlabs.com',
    body: 'Confirmed with Priya at Acme that May 30 is firm. No slip.',
  },
  {
    titleMatch: 'Acme: bug report - cursor flicker',
    authorEmail: 'maya@blitlabs.com',
    body: 'Visual fix verified. Looks clean across all browsers in our test matrix now.',
  },
  {
    titleMatch: 'Selection-flicker fix',
    authorEmail: 'priya.m@blitlabs.com',
    body: 'Reading through the RAF debounce logic. Question: does this also handle the new nested-group selection edge case from POLARIS-29?',
  },
  {
    titleMatch: 'Stress test - 1000 simulated users',
    authorEmail: 'marco@blitlabs.com',
    body: 'Re-ran with consistent hashing branch - 700 ceiling holds. The bottleneck is genuinely CPU on the gateway, not topology.',
  },
  {
    titleMatch: 'Stress test - 1000 simulated users',
    authorEmail: 'priya.m@blitlabs.com',
    body: 'Worth a profiling session. I think we can squeeze 30% more headroom from the awareness loop.',
  },
  {
    titleMatch: 'Why we picked Y.js over Automerge',
    authorEmail: 'jordan@blitlabs.com',
    body: 'For when prospects ask: "Why not Automerge?" - this doc is the canonical answer. Linking from sales playbook.',
  },
  {
    titleMatch: 'Beta-1 NPS breakdown',
    authorEmail: 'aisha@blitlabs.com',
    body: 'Halcyon feedback gap is concerning. Setting up a customer call to investigate. May not be salvageable but worth one more try.',
  },
  {
    titleMatch: 'Y.js memory leak',
    authorEmail: 'priya.m@blitlabs.com',
    body: 'Validated the patch in staging - heap stays flat at 200MB. Ready to merge.',
  },
  {
    titleMatch: 'WebSocket reconnect storm',
    authorEmail: 'marco@blitlabs.com',
    body: 'Adding alarm to PagerDuty if reconnect rate spikes >5% in any 1-min window.',
  },
  {
    titleMatch: 'Acme expansion plan',
    authorEmail: 'jordan@blitlabs.com',
    body: 'Phase 2 (50 users) gate met. Greenlighting ramp.',
  },
  {
    titleMatch: 'Atlas Robotics discovery call',
    authorEmail: 'ravi@blitlabs.com',
    body: '$300k+ ARR potential. Personal involvement on the next call. Marcus is the buyer.',
  },
  {
    titleMatch: 'Q2 OKR: ship Polaris GA',
    authorEmail: 'priya.m@blitlabs.com',
    body: "On track for May 30. POLARIS-23 might miss but acceptable per Sarah's call.",
  },
  {
    titleMatch: 'Series A fundraising plan',
    authorEmail: 'ravi@blitlabs.com',
    body: 'Pitch deck v3 done. Targeting 4 investor meetings in next 2 weeks. Will share calendar.',
  },
  {
    titleMatch: 'Investor update - April',
    authorEmail: 'diana@blitlabs.com',
    body: 'Sent to all 23 investors. 3 replies asking for follow-up call. Calendar links going out today.',
  },
  {
    titleMatch: 'Hiring funnel',
    authorEmail: 'ravi@blitlabs.com',
    body: "Quality over quantity. Don't lower the bar to fill seats.",
  },
  {
    titleMatch: 'Priya M. accepted',
    authorEmail: 'maya@blitlabs.com',
    body: '🎉 Welcome Priya! Looking forward to working with you on Polaris UX too.',
  },
  {
    titleMatch: 'Priya M. accepted',
    authorEmail: 'aisha@blitlabs.com',
    body: 'Hope you settle in well! Always around for any customer-side context you need.',
  },
  {
    titleMatch: 'Onboarding plan for Priya M.',
    authorEmail: 'priya.m@blitlabs.com',
    body: 'Excited! Looking forward to week 1. Pre-reading: Loom walkthrough + handoff doc.',
  },
  {
    titleMatch: 'Customer Advisory Board',
    authorEmail: 'ravi@blitlabs.com',
    body: 'These 6 customers will determine our enterprise roadmap. Treat their feedback as priority-1.',
  },
  {
    titleMatch: 'Brand refresh planning',
    authorEmail: 'maya@blitlabs.com',
    body: "I'll own this when I have bandwidth post-Polaris GA. Visual identity refresh + logo work.",
  },
  {
    titleMatch: 'Pricing experiment',
    authorEmail: 'jordan@blitlabs.com',
    body: '$30 stuck. Worth re-running annually to validate.',
  },
  {
    titleMatch: 'Razorpay over Stripe',
    authorEmail: 'diana@blitlabs.com',
    body: 'Reconciliation script ran clean for Q1. Razorpay support has been responsive.',
  },
  {
    titleMatch: 'Vacation policy',
    authorEmail: 'aisha@blitlabs.com',
    body: 'Taking 2 weeks in July. Coverage: Jordan on customer escalations.',
  },
  {
    titleMatch: 'Engineering retro - sprint 18',
    authorEmail: 'marco@blitlabs.com',
    body: 'Deploy windows: confirmed Tue/Thu 10am IST. Pinned in #releases.',
  },
  {
    titleMatch: 'GA day-1 metrics',
    authorEmail: 'priya.m@blitlabs.com',
    body: 'Grafana dashboard ready. Added p95 cursor latency in addition to p99 - useful for early-warning.',
  },
  {
    titleMatch: 'Slack #announcements: Alex joined',
    authorEmail: 'maya@blitlabs.com',
    body: 'Welcome Alex! Lmk if you want a UX walkthrough of Polaris when you have a sec.',
  },
  {
    titleMatch: 'Slack #announcements: Alex joined',
    authorEmail: 'jordan@blitlabs.com',
    body: "Alex - I'll send a calendar invite for the customer-side context dump.",
  },
  {
    titleMatch: 'Loom: Bob walking through the gateway',
    authorEmail: 'priya.m@blitlabs.com',
    body: 'Watched 3 times. Mandatory rewatch every quarter for whoever owns Polaris infra.',
  },
  {
    titleMatch: 'Why we self-host Qdrant',
    authorEmail: 'marco@blitlabs.com',
    body: "At the rate we're growing, the savings will buy 1 more senior eng by Q4.",
  },
  {
    titleMatch: 'Customer feedback theme: cursor smoothness',
    authorEmail: 'maya@blitlabs.com',
    body: 'Treating cursor smoothness as a P0 invariant. No PR ships if it regresses cursor latency by >5%.',
  },
  {
    titleMatch: 'GDPR delete flow',
    authorEmail: 'diana@blitlabs.com',
    body: "Legal reviewed - we're compliant with GDPR Article 17. Documenting in /docs/legal.",
  },
  {
    titleMatch: 'SOC 2 Type II',
    authorEmail: 'diana@blitlabs.com',
    body: 'Auditor onboarded. Q4 audit window booked. Pre-audit checklist 60% done.',
  },
  {
    titleMatch: 'Caldera eval',
    authorEmail: 'jordan@blitlabs.com',
    body: 'Marking as cold. Re-engage Q3 if we hear back; otherwise nurture quarterly.',
  },
]

interface SavedSearchSeed {
  authorEmail: string
  name: string
  query: string
  alertEnabled?: boolean
  frequency?: 'realtime' | 'daily' | 'weekly'
}

const SAVED_SEARCHES: SavedSearchSeed[] = [
  {
    authorEmail: 'alex@blitlabs.com',
    name: 'Polaris GA blockers',
    query: 'Polaris GA blocker OR critical',
    alertEnabled: true,
    frequency: 'daily',
  },
  {
    authorEmail: 'alex@blitlabs.com',
    name: 'POLARIS-23 status',
    query: 'POLARIS-23 offline conflict',
  },
  {
    authorEmail: 'alex@blitlabs.com',
    name: 'Acme commitments',
    query: 'ACME OR Acme requirements GA',
  },
  {
    authorEmail: 'priya.m@blitlabs.com',
    name: 'My handoff reading list',
    query: 'Sarah handoff Polaris',
  },
  { authorEmail: 'priya.m@blitlabs.com', name: 'Open POLARIS tickets', query: 'POLARIS- open' },
  {
    authorEmail: 'jordan@blitlabs.com',
    name: 'Customer feedback themes',
    query: 'customer feedback NPS',
  },
  {
    authorEmail: 'jordan@blitlabs.com',
    name: 'Pricing decisions',
    query: 'pricing tier seat plan',
  },
  {
    authorEmail: 'aisha@blitlabs.com',
    name: 'Active customer issues',
    query: 'bug report customer Acme Northwind',
  },
  {
    authorEmail: 'aisha@blitlabs.com',
    name: 'Onboarding playbook',
    query: 'onboarding training customer-success',
  },
  { authorEmail: 'ravi@blitlabs.com', name: 'Investor updates', query: 'investor update ARR' },
  { authorEmail: 'ravi@blitlabs.com', name: 'Series A signals', query: 'Series A fundraising' },
  { authorEmail: 'maya@blitlabs.com', name: 'Cursor + UX', query: 'cursor color UX selection' },
  {
    authorEmail: 'marco@blitlabs.com',
    name: 'Postgres performance',
    query: 'Postgres performance pool',
  },
  { authorEmail: 'diana@blitlabs.com', name: 'Compliance backlog', query: 'SOC2 GDPR compliance' },
]

interface ShareSeed {
  titleMatch: string
  sharerEmail: string
  recipient: 'org' | 'link'
  permission?: 'READ' | 'COMMENT'
}

const SHARES: ShareSeed[] = [
  {
    titleMatch: "Sarah's Polaris handoff doc",
    sharerEmail: 'sarah@blitlabs.com',
    recipient: 'org',
    permission: 'READ',
  },
  {
    titleMatch: 'GA launch checklist',
    sharerEmail: 'sarah@blitlabs.com',
    recipient: 'org',
    permission: 'COMMENT',
  },
  {
    titleMatch: 'Loom: Bob walking through the gateway',
    sharerEmail: 'bob@blitlabs.com',
    recipient: 'org',
    permission: 'READ',
  },
  {
    titleMatch: 'Loom: Sarah walking through Polaris architecture',
    sharerEmail: 'sarah@blitlabs.com',
    recipient: 'org',
    permission: 'READ',
  },
  {
    titleMatch: 'POLARIS-23',
    sharerEmail: 'priya.m@blitlabs.com',
    recipient: 'org',
    permission: 'COMMENT',
  },
  {
    titleMatch: 'Acme - security questionnaire',
    sharerEmail: 'sarah@blitlabs.com',
    recipient: 'org',
    permission: 'READ',
  },
  {
    titleMatch: 'Q2 OKR: ship Polaris GA',
    sharerEmail: 'alex@blitlabs.com',
    recipient: 'org',
    permission: 'COMMENT',
  },
  {
    titleMatch: 'Investor update - April',
    sharerEmail: 'ravi@blitlabs.com',
    recipient: 'org',
    permission: 'READ',
  },
  {
    titleMatch: 'Customer Advisory Board',
    sharerEmail: 'sarah@blitlabs.com',
    recipient: 'org',
    permission: 'COMMENT',
  },
  {
    titleMatch: 'Quote from Acme',
    sharerEmail: 'sarah@blitlabs.com',
    recipient: 'link',
    permission: 'READ',
  },
  {
    titleMatch: 'Customer case study - Acme',
    sharerEmail: 'sarah@blitlabs.com',
    recipient: 'link',
    permission: 'READ',
  },
  {
    titleMatch: 'GA launch checklist',
    sharerEmail: 'alex@blitlabs.com',
    recipient: 'org',
    permission: 'COMMENT',
  },
]

interface TagSeed {
  name: string
  color: string
  matchPattern: RegExp
}

const TAGS: TagSeed[] = [
  {
    name: 'urgent',
    color: '#ef4444',
    matchPattern: /POLARIS-23|GA blocker|critical|outage|incident/i,
  },
  { name: 'decision', color: '#3b82f6', matchPattern: /decision|chose|picked|why we|Decision:/i },
  {
    name: 'customer',
    color: '#10b981',
    matchPattern: /Acme|Northwind|Halcyon|Loomis|Voltaire|Atlas Robotics|customer/i,
  },
  { name: 'handoff', color: '#f59e0b', matchPattern: /handoff|Sarah|Bob|sabbatical|farewell/i },
  {
    name: 'technical',
    color: '#8b5cf6',
    matchPattern: /Y\.js|CRDT|WebSocket|Postgres|Qdrant|stress test/i,
  },
  {
    name: 'strategy',
    color: '#ec4899',
    matchPattern: /OKR|strategy|roadmap|investor|Series A|pricing/i,
  },
]

async function ensureUser(email: string, name: string, hash: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing
  return prisma.user.create({
    data: {
      email,
      password_hash: hash,
      email_verified_at: new Date(),
    },
  })
}

async function ensureMembership(orgId: string, userId: string, role: OrgRole) {
  await prisma.organizationMember.upsert({
    where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
    update: { role },
    create: { organization_id: orgId, user_id: userId, role },
  })
}

async function findMemoryByTitle(orgId: string, fragment: string) {
  return prisma.memory.findFirst({
    where: { organization_id: orgId, title: { contains: fragment, mode: 'insensitive' } },
    orderBy: { created_at: 'desc' },
  })
}

async function main(): Promise<void> {
  logger.log('[seed:team] starting')

  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })
  if (!org) throw new Error(`Org "${ORG_SLUG}" not found. Run seed:polaris first.`)

  // 1. Ensure new users + memberships
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const usersByEmail = new Map<string, { id: string; email: string }>()

  // existing users
  const existing = await prisma.user.findMany({
    where: { email: { in: ['alex@blitlabs.com', 'sarah@blitlabs.com', 'bob@blitlabs.com'] } },
  })
  existing.forEach(u => usersByEmail.set(u.email, u))

  for (const u of NEW_USERS) {
    const created = await ensureUser(u.email, u.name, passwordHash)
    await ensureMembership(org.id, created.id, u.role)
    usersByEmail.set(u.email, created)
  }
  logger.log('[seed:team] users + memberships ready', { total: usersByEmail.size })

  // 2. Comments
  let commentsCreated = 0
  for (const c of COMMENTS) {
    const memory = await findMemoryByTitle(org.id, c.titleMatch)
    const author = usersByEmail.get(c.authorEmail)
    if (!memory || !author) continue
    // Skip if same author already commented this exact body on this memory
    const dup = await prisma.memoryComment.findFirst({
      where: { memory_id: memory.id, author_user_id: author.id, body_md: c.body },
    })
    if (dup) continue
    await prisma.memoryComment.create({
      data: { memory_id: memory.id, author_user_id: author.id, body_md: c.body },
    })
    commentsCreated++
  }
  logger.log('[seed:team] comments created', { count: commentsCreated })

  // 3. Saved searches
  let searchesCreated = 0
  for (const s of SAVED_SEARCHES) {
    const author = usersByEmail.get(s.authorEmail)
    if (!author) continue
    const dup = await prisma.savedSearch.findFirst({
      where: { user_id: author.id, name: s.name },
    })
    if (dup) continue
    await prisma.savedSearch.create({
      data: {
        user_id: author.id,
        organization_id: org.id,
        name: s.name,
        query: s.query,
        alert_enabled: s.alertEnabled ?? false,
        alert_frequency: s.frequency ?? 'daily',
      },
    })
    searchesCreated++
  }
  logger.log('[seed:team] saved searches created', { count: searchesCreated })

  // 4. Shares
  let sharesCreated = 0
  for (const s of SHARES) {
    const memory = await findMemoryByTitle(org.id, s.titleMatch)
    const sharer = usersByEmail.get(s.sharerEmail)
    if (!memory || !sharer) continue
    const recipientType = s.recipient === 'org' ? 'ORG' : 'LINK'
    const dup = await prisma.memoryShare.findFirst({
      where: {
        memory_id: memory.id,
        sharer_user_id: sharer.id,
        recipient_type: recipientType,
      },
    })
    if (dup) continue
    await prisma.memoryShare.create({
      data: {
        memory_id: memory.id,
        sharer_user_id: sharer.id,
        recipient_type: recipientType,
        recipient_org_id: s.recipient === 'org' ? org.id : null,
        link_token:
          s.recipient === 'link'
            ? Math.random().toString(36).slice(2, 26) + Math.random().toString(36).slice(2, 26)
            : null,
        permission: s.permission ?? 'READ',
      },
    })
    sharesCreated++
  }
  logger.log('[seed:team] shares created', { count: sharesCreated })

  // 5. Tags + assignments
  let tagsCreated = 0
  let tagAssignments = 0
  for (const t of TAGS) {
    const tag = await prisma.memoryTag.upsert({
      where: { organization_id_name: { organization_id: org.id, name: t.name } },
      update: { color: t.color },
      create: { organization_id: org.id, name: t.name, color: t.color },
    })
    tagsCreated++

    // Assign to memories whose title or content matches the pattern (cap at 12 per tag)
    const matches = await prisma.memory.findMany({
      where: { organization_id: org.id },
      select: { id: true, title: true, content: true },
    })
    const winners = matches
      .filter(m => t.matchPattern.test(m.title) || t.matchPattern.test(m.content))
      .slice(0, 12)

    for (const m of winners) {
      await prisma.memoryTagOnMemory.upsert({
        where: { memory_id_tag_id: { memory_id: m.id, tag_id: tag.id } },
        update: {},
        create: { memory_id: m.id, tag_id: tag.id },
      })
      tagAssignments++
    }
  }
  logger.log('[seed:team] tags', { tagsCreated, tagAssignments })

  logger.log('[seed:team] complete', {
    users: NEW_USERS.length,
    comments: commentsCreated,
    searches: searchesCreated,
    shares: sharesCreated,
    tags: tagsCreated,
    tagAssignments,
  })
  await prisma.$disconnect()
}

main().catch(err => {
  logger.error('[seed:team] failed', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  })
  process.exit(1)
})
