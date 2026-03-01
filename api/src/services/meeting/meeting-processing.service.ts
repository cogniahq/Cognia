import { prisma } from '../../lib/prisma.lib'
import { aiProvider } from '../ai/ai-provider.service'
import { memoryIngestionService } from '../memory/memory-ingestion.service'
import { memoryMeshService } from '../memory/memory-mesh.service'
import { logger } from '../../utils/core/logger.util'

interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

interface ActionItem {
  text: string
  assignee?: string
  dueDate?: string
  priority?: 'low' | 'medium' | 'high'
}

interface Topic {
  name: string
  description: string
  startTime: number
  endTime: number
}

/**
 * Post-meeting AI processing:
 * 1. Summarize transcript
 * 2. Extract action items
 * 3. Identify topics
 * 4. Feed into Memory pipeline for semantic search
 */
class MeetingProcessingService {
  /**
   * Run the full processing pipeline for a completed meeting.
   */
  async processMeeting(meetingId: string): Promise<void> {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })

    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`)
    }

    if (!meeting.raw_transcript) {
      logger.warn(`[MeetingProcessing] No transcript for meeting ${meetingId}`)
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'COMPLETED' },
      })
      return
    }

    const transcript = meeting.raw_transcript as unknown as TranscriptSegment[]
    const fullText = transcript.map(s => s.text).join(' ')

    if (fullText.trim().length < 50) {
      logger.warn(`[MeetingProcessing] Transcript too short for meeting ${meetingId}`)
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'COMPLETED' },
      })
      return
    }

    try {
      // Run AI processing in parallel
      const [summary, actionItems, topics] = await Promise.all([
        this.generateSummary(fullText, meeting.user_id),
        this.extractActionItems(fullText, meeting.user_id),
        this.identifyTopics(transcript, meeting.user_id),
      ])

      // Update meeting record with processed results
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          summary,
          action_items: actionItems as any,
          topics: topics as any,
          status: 'COMPLETED',
        },
      })

      // Feed into Memory pipeline for semantic search
      await this.ingestIntoMemory(meeting.user_id, meetingId, {
        title: meeting.title || `Meeting on ${new Date(meeting.created_at).toLocaleDateString()}`,
        summary,
        actionItems,
        topics,
        transcript,
        meetingUrl: meeting.meeting_url,
        platform: meeting.platform,
        organizationId: meeting.organization_id,
      })

      logger.log(`[MeetingProcessing] Completed processing for meeting ${meetingId}`)
    } catch (err) {
      logger.error(`[MeetingProcessing] Failed to process meeting ${meetingId}:`, err)
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'FAILED' },
      })
      throw err
    }
  }

  private async generateSummary(text: string, userId: string): Promise<string> {
    if (!aiProvider.isInitialized) {
      return 'AI provider not available for summary generation.'
    }

    return aiProvider.generateContent(
      `Summarize the following meeting transcript concisely. Focus on key decisions, outcomes, and important discussions. Keep it to 2-4 paragraphs.\n\nTranscript:\n${text.slice(0, 15000)}`,
      false,
      userId
    )
  }

  private async extractActionItems(text: string, userId: string): Promise<ActionItem[]> {
    if (!aiProvider.isInitialized) return []

    const response = await aiProvider.generateContent(
      `Extract action items from this meeting transcript. For each action item, provide:
- text: the action to be taken
- assignee: who should do it (if mentioned)
- priority: low, medium, or high

Return as a JSON array of objects with keys: text, assignee, priority.
Only return the JSON array, no other text.

Transcript:
${text.slice(0, 15000)}`,
      false,
      userId
    )

    try {
      const parsed = JSON.parse(response)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private async identifyTopics(transcript: TranscriptSegment[], userId: string): Promise<Topic[]> {
    if (!aiProvider.isInitialized) return []

    const text = transcript.map(s => `[${Math.floor(s.start)}s] ${s.text}`).join('\n')

    const response = await aiProvider.generateContent(
      `Identify the main topics discussed in this meeting transcript. For each topic, provide:
- name: short topic name
- description: brief description of what was discussed
- startTime: approximate start time in seconds
- endTime: approximate end time in seconds

Return as a JSON array. Only return the JSON array, no other text.

Transcript:
${text.slice(0, 15000)}`,
      false,
      userId
    )

    try {
      const parsed = JSON.parse(response)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  /**
   * Feed processed meeting data into the existing Memory ingestion pipeline.
   */
  private async ingestIntoMemory(
    userId: string,
    meetingId: string,
    data: {
      title: string
      summary: string
      actionItems: ActionItem[]
      topics: Topic[]
      transcript: TranscriptSegment[]
      meetingUrl: string
      platform: string
      organizationId: string | null
    }
  ): Promise<void> {
    const contentParts = [
      `Meeting: ${data.title}`,
      `Platform: ${data.platform === 'google_meet' ? 'Google Meet' : 'Zoom'}`,
      '',
      'Summary:',
      data.summary,
    ]

    if (data.actionItems.length > 0) {
      contentParts.push('', 'Action Items:')
      for (const item of data.actionItems) {
        contentParts.push(`- ${item.text}${item.assignee ? ` (${item.assignee})` : ''}`)
      }
    }

    if (data.topics.length > 0) {
      contentParts.push('', 'Topics:')
      for (const topic of data.topics) {
        contentParts.push(`- ${topic.name}: ${topic.description}`)
      }
    }

    const content = contentParts.join('\n')
    const canonicalData = memoryIngestionService.canonicalizeContent(content, data.meetingUrl)

    const memoryPayload = memoryIngestionService.buildMemoryCreatePayload({
      userId,
      title: data.title,
      url: data.meetingUrl,
      source: `meeting_${data.platform}`,
      content,
      contentPreview: data.summary.slice(0, 400),
      metadata: {
        meetingId,
        platform: data.platform,
        actionItemCount: data.actionItems.length,
        topicCount: data.topics.length,
        source_type: 'INTEGRATION',
      },
      canonicalText: canonicalData.canonicalText,
      canonicalHash: canonicalData.canonicalHash,
    })

    if (data.organizationId) {
      (memoryPayload as any).organization_id = data.organizationId
    }

    try {
      const memory = await prisma.memory.create({ data: memoryPayload })

      // Generate embeddings and relations for semantic search
      setImmediate(async () => {
        try {
          await memoryMeshService.generateEmbeddingsForMemory(memory.id)
          await memoryMeshService.createMemoryRelations(memory.id, userId)
        } catch (err) {
          logger.error(`[MeetingProcessing] Embedding generation failed for memory ${memory.id}:`, err)
        }
      })
    } catch (err) {
      logger.error(`[MeetingProcessing] Memory ingestion failed for meeting ${meetingId}:`, err)
    }
  }
}

export const meetingProcessingService = new MeetingProcessingService()
