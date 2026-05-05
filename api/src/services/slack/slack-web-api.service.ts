export interface SlackApiResponse {
  ok: boolean
  error?: string
  [key: string]: unknown
}

export interface SlackAuthTestResponse extends SlackApiResponse {
  team?: string
  team_id?: string
  user_id?: string
  bot_id?: string
  url?: string
}

export interface SlackUserInfoResponse extends SlackApiResponse {
  user?: {
    id: string
    name?: string
    real_name?: string
    profile?: {
      email?: string
      display_name?: string
      real_name?: string
    }
  }
}

export interface SlackConversationRepliesResponse extends SlackApiResponse {
  messages?: Array<{
    user?: string
    text?: string
    ts?: string
    bot_id?: string
    subtype?: string
  }>
}

export interface SlackPostMessageResponse extends SlackApiResponse {
  channel?: string
  ts?: string
}

export interface SlackMessageBlock {
  type: string
  text?: {
    type: string
    text: string
  }
  elements?: unknown[]
}

const SLACK_API_BASE = 'https://slack.com/api'

async function parseSlackResponse<T extends SlackApiResponse>(response: Response): Promise<T> {
  const data = (await response.json()) as T
  if (!data.ok) {
    throw new Error(data.error || `Slack API request failed with HTTP ${response.status}`)
  }
  return data
}

export class SlackWebApiService {
  async authTest(accessToken: string): Promise<SlackAuthTestResponse> {
    return this.post<SlackAuthTestResponse>(accessToken, 'auth.test', {})
  }

  async getUserInfo(accessToken: string, userId: string): Promise<SlackUserInfoResponse> {
    return this.get<SlackUserInfoResponse>(accessToken, 'users.info', { user: userId })
  }

  async getConversationReplies(
    accessToken: string,
    channelId: string,
    ts: string,
    limit = 10
  ): Promise<SlackConversationRepliesResponse> {
    return this.get<SlackConversationRepliesResponse>(accessToken, 'conversations.replies', {
      channel: channelId,
      ts,
      limit: String(limit),
      inclusive: 'true',
    })
  }

  async postMessage(
    accessToken: string,
    input: {
      channel: string
      text: string
      threadTs?: string
      blocks?: SlackMessageBlock[]
    }
  ): Promise<SlackPostMessageResponse> {
    return this.post<SlackPostMessageResponse>(accessToken, 'chat.postMessage', {
      channel: input.channel,
      text: input.text,
      thread_ts: input.threadTs,
      blocks: input.blocks,
      unfurl_links: false,
      unfurl_media: false,
    })
  }

  private async get<T extends SlackApiResponse>(
    accessToken: string,
    method: string,
    params: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${SLACK_API_BASE}/${method}`)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    return parseSlackResponse<T>(response)
  }

  private async post<T extends SlackApiResponse>(
    accessToken: string,
    method: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${SLACK_API_BASE}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    })

    return parseSlackResponse<T>(response)
  }
}

export const slackWebApiService = new SlackWebApiService()
