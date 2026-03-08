import React, { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"
import { requireAuthToken } from "@/utils/auth"
import { cn } from "@/lib/utils.lib"
import { getMeeting, listMeetings, startMeeting, stopMeeting } from "@/services/meeting.service"
import { useNavigate } from "react-router-dom"
import {
  CalendarClock,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Square,
  Video,
} from "lucide-react"

import type {
  MeetingActionItem,
  MeetingDetail,
  MeetingSummary,
  MeetingTopic,
  TranscriptSegment,
} from "@/types/meeting"
import { PageHeader } from "@/components/shared/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  EmptyState,
  ErrorMessage,
  LoadingCard,
} from "@/components/ui/loading-spinner"

const ACTIVE_STATUSES = new Set(["JOINING", "IN_MEETING"])

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const formatSeconds = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00"

  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`
}

const formatDateTime = (value?: string | null): string => {
  if (!value) return "Not available"

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const formatRelativeTime = (value?: string | null): string => {
  if (!value) return "Not started"

  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

const getStatusBadgeClassName = (status: string) => {
  switch (status) {
    case "IN_MEETING":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "JOINING":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "PROCESSING":
      return "border-blue-200 bg-blue-50 text-blue-700"
    case "COMPLETED":
      return "border-slate-200 bg-slate-50 text-slate-700"
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700"
    default:
      return "border-gray-200 bg-gray-50 text-gray-700"
  }
}

export const Meetings: React.FC = () => {
  const navigate = useNavigate()
  const { accountType, isLoading: authLoading } = useAuth()
  const { currentOrganization } = useOrganization()

  const [isReady, setIsReady] = useState(false)
  const [meetings, setMeetings] = useState<MeetingSummary[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingDetail | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [stoppingId, setStoppingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [totalMeetings, setTotalMeetings] = useState(0)
  const [formState, setFormState] = useState({
    meetingUrl: "",
    title: "",
  })
  const selectedMeetingIdRef = useRef<string | null>(null)
  const listRequestIdRef = useRef(0)
  const detailRequestIdRef = useRef(0)

  useEffect(() => {
    if (authLoading) return

    try {
      requireAuthToken()
      setIsReady(true)
    } catch {
      navigate("/login")
    }
  }, [authLoading, navigate])

  useEffect(() => {
    selectedMeetingIdRef.current = selectedMeetingId
  }, [selectedMeetingId])

  const loadMeetingDetail = useCallback(async (meetingId: string) => {
    const requestId = detailRequestIdRef.current + 1
    detailRequestIdRef.current = requestId

    setDetailLoading(true)
    setDetailError(null)

    try {
      const meeting = await getMeeting(meetingId)
      if (detailRequestIdRef.current !== requestId) return
      setSelectedMeeting(meeting)
    } catch (err) {
      if (detailRequestIdRef.current !== requestId) return
      setSelectedMeeting(null)
      setDetailError(getErrorMessage(err, "Failed to load meeting details"))
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setDetailLoading(false)
      }
    }
  }, [])

  const loadMeetings = useCallback(async (preferredMeetingId?: string | null) => {
    const requestId = listRequestIdRef.current + 1
    listRequestIdRef.current = requestId

    setListLoading(true)
    setError(null)

    try {
      const data = await listMeetings()
      if (listRequestIdRef.current !== requestId) return
      setMeetings(data.meetings)
      setTotalMeetings(data.total)

      const resolvedMeetingId =
        preferredMeetingId && data.meetings.some(meeting => meeting.id === preferredMeetingId)
          ? preferredMeetingId
          : selectedMeetingIdRef.current &&
              data.meetings.some(meeting => meeting.id === selectedMeetingIdRef.current)
            ? selectedMeetingIdRef.current
            : data.meetings[0]?.id || null

      setSelectedMeetingId(resolvedMeetingId)

      if (resolvedMeetingId) {
        await loadMeetingDetail(resolvedMeetingId)
      } else {
        setSelectedMeeting(null)
        setDetailError(null)
      }
    } catch (err) {
      if (listRequestIdRef.current !== requestId) return
      setError(getErrorMessage(err, "Failed to load meetings"))
    } finally {
      if (listRequestIdRef.current === requestId) {
        setListLoading(false)
      }
    }
  }, [loadMeetingDetail])

  useEffect(() => {
    if (!isReady) return
    void loadMeetings()
  }, [isReady, loadMeetings])

  const transcript = asArray<TranscriptSegment>(selectedMeeting?.raw_transcript)
  const actionItems = asArray<MeetingActionItem>(selectedMeeting?.action_items)
  const topics = asArray<MeetingTopic>(selectedMeeting?.topics)
  const activeMeetingCount = meetings.filter(meeting =>
    ACTIVE_STATUSES.has(meeting.status)
  ).length
  const completedMeetingCount = meetings.filter(
    meeting => meeting.status === "COMPLETED"
  ).length

  const handleSelectMeeting = async (meetingId: string) => {
    setSelectedMeetingId(meetingId)
    await loadMeetingDetail(meetingId)
  }

  const handleJoinMeeting = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const createdMeeting = await startMeeting({
        meetingUrl: formState.meetingUrl.trim(),
        title: formState.title.trim() || undefined,
        organizationId:
          accountType === "ORGANIZATION" ? currentOrganization?.id : undefined,
      })

      setFormState({ meetingUrl: "", title: "" })
      await loadMeetings(createdMeeting.id)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to start meeting"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleStopMeeting = async (meetingId: string) => {
    setStoppingId(meetingId)
    setError(null)

    try {
      await stopMeeting(meetingId)
      await loadMeetings(meetingId)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to stop meeting"))
    } finally {
      setStoppingId(null)
    }
  }

  const rightActions = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void loadMeetings(selectedMeetingId)
      }}
      disabled={listLoading || detailLoading}
      className="gap-2"
    >
      {listLoading || detailLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCcw className="h-4 w-4" />
      )}
      Refresh
    </Button>
  )

  if (!isReady) {
    return null
  }

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
      }}
    >
      <PageHeader pageName="Meetings" rightActions={rightActions} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Meeting Capture
              </h1>
              <p className="text-xs text-gray-600">
                Join a live Google Meet or Zoom call, collect the transcript,
                and push the processed notes into Cognia memory.
              </p>
            </div>
            <div className="text-xs text-gray-500">
              {accountType === "ORGANIZATION"
                ? currentOrganization
                  ? `Workspace link: ${currentOrganization.name}`
                  : "No workspace selected. Meetings will still run, but won’t attach to a workspace."
                : "Personal account meeting flow"}
            </div>
          </div>

          {error ? <ErrorMessage message={error} /> : null}

          <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-xl">Start a Meeting</CardTitle>
                  <CardDescription>
                    Paste a Google Meet or Zoom link. The bot will join, record,
                    and process the meeting in the background.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleJoinMeeting} className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="meeting-url"
                        className="text-xs font-medium uppercase tracking-wide text-gray-600"
                      >
                        Meeting URL
                      </label>
                      <Input
                        id="meeting-url"
                        placeholder="https://meet.google.com/... or https://zoom.us/j/..."
                        value={formState.meetingUrl}
                        onChange={event =>
                          setFormState(current => ({
                            ...current,
                            meetingUrl: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="meeting-title"
                        className="text-xs font-medium uppercase tracking-wide text-gray-600"
                      >
                        Title
                      </label>
                      <Input
                        id="meeting-title"
                        placeholder="Optional label for the meeting"
                        value={formState.title}
                        onChange={event =>
                          setFormState(current => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs font-medium text-gray-700">
                        Attachment target
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {accountType === "ORGANIZATION"
                          ? currentOrganization?.name || "No organization selected"
                          : "Personal memory graph"}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={submitting || formState.meetingUrl.trim() === ""}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Video className="h-4 w-4" />
                      )}
                      Start Meeting
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Total
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                      {totalMeetings}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Active
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                      {activeMeetingCount}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Complete
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-gray-900">
                      {completedMeetingCount}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="text-xl">Recent Meetings</CardTitle>
                  <CardDescription>
                    Monitor join status, post-processing, and completed notes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {listLoading ? (
                    <LoadingCard className="py-10" />
                  ) : meetings.length === 0 ? (
                    <EmptyState
                      title="No meetings yet"
                      description="Start a meeting above or enable Google Calendar auto-join from Integrations."
                    />
                  ) : (
                    meetings.map(meeting => (
                      <button
                        key={meeting.id}
                        type="button"
                        onClick={() => {
                          void handleSelectMeeting(meeting.id)
                        }}
                        className={cn(
                          "w-full rounded-lg border p-4 text-left transition-colors",
                          selectedMeetingId === meeting.id
                            ? "border-black bg-gray-50"
                            : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900">
                              {meeting.title || "Untitled meeting"}
                            </div>
                            <div className="mt-1 truncate text-xs text-gray-500">
                              {meeting.meeting_url}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "whitespace-nowrap",
                              getStatusBadgeClassName(meeting.status)
                            )}
                          >
                            {meeting.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                          <span>{meeting.platform === "google_meet" ? "Google Meet" : "Zoom"}</span>
                          <span>{formatRelativeTime(meeting.started_at || meeting.created_at)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-gray-200 min-h-[640px]">
              <CardHeader className="border-b border-gray-100">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {selectedMeeting?.title || "Meeting details"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedMeeting
                        ? "Review live status, transcript, and processed outputs."
                        : "Select a meeting from the list to inspect its details."}
                    </CardDescription>
                  </div>

                  {selectedMeeting ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={getStatusBadgeClassName(selectedMeeting.status)}
                      >
                        {selectedMeeting.status.replace(/_/g, " ")}
                      </Badge>
                      {ACTIVE_STATUSES.has(selectedMeeting.status) ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            void handleStopMeeting(selectedMeeting.id)
                          }}
                          disabled={stoppingId === selectedMeeting.id}
                          className="gap-2"
                        >
                          {stoppingId === selectedMeeting.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                          Stop
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {detailLoading ? (
                  <LoadingCard className="py-24" />
                ) : detailError ? (
                  <ErrorMessage message={detailError} />
                ) : !selectedMeeting ? (
                  <EmptyState
                    title="Nothing selected"
                    description="Choose a meeting from the left to inspect the transcript and processed notes."
                  />
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                          Started
                        </div>
                        <div className="mt-2 text-sm font-medium text-gray-900">
                          {formatDateTime(selectedMeeting.started_at || selectedMeeting.created_at)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                          Ended
                        </div>
                        <div className="mt-2 text-sm font-medium text-gray-900">
                          {formatDateTime(selectedMeeting.ended_at)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                          Transcript Segments
                        </div>
                        <div className="mt-2 text-sm font-medium text-gray-900">
                          {transcript.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                          Topics
                        </div>
                        <div className="mt-2 text-sm font-medium text-gray-900">
                          {topics.length}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                          Meeting link
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm text-gray-900">
                          <CalendarClock className="h-4 w-4 text-gray-500" />
                          <span className="truncate">{selectedMeeting.meeting_url}</span>
                        </div>
                        {selectedMeeting.calendar_event_id ? (
                          <div className="mt-2 text-xs text-gray-500">
                            Auto-joined from Google Calendar
                          </div>
                        ) : null}
                      </div>

                      <a
                        href={selectedMeeting.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open link
                      </a>
                    </div>

                    <Tabs key={selectedMeeting.id} defaultValue="summary" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="actions">Action Items</TabsTrigger>
                        <TabsTrigger value="topics">Topics</TabsTrigger>
                        <TabsTrigger value="transcript">Transcript</TabsTrigger>
                      </TabsList>

                      <TabsContent value="summary" className="mt-4">
                        <Card className="border-gray-200 shadow-none">
                          <CardContent className="p-5">
                            {selectedMeeting.summary ? (
                              <div className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
                                {selectedMeeting.summary}
                              </div>
                            ) : (
                              <EmptyState
                                title="Summary not ready"
                                description={
                                  selectedMeeting.status === "PROCESSING"
                                    ? "The meeting has ended and the AI pipeline is still running."
                                    : "No summary is available for this meeting yet."
                                }
                              />
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="actions" className="mt-4">
                        <Card className="border-gray-200 shadow-none">
                          <CardContent className="p-5">
                            {actionItems.length === 0 ? (
                              <EmptyState
                                title="No action items"
                                description="Action items will appear here after the post-processing step extracts them."
                              />
                            ) : (
                              <div className="space-y-3">
                                {actionItems.map((item, index) => (
                                  <div
                                    key={`${item.text}-${index}`}
                                    className="rounded-lg border border-gray-200 p-4"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-medium text-gray-900">
                                        {item.text}
                                      </div>
                                      {item.priority ? (
                                        <Badge
                                          variant="outline"
                                          className="border-gray-200 bg-gray-50 text-gray-700"
                                        >
                                          {item.priority}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    {item.assignee ? (
                                      <div className="mt-2 text-xs text-gray-500">
                                        Assignee: {item.assignee}
                                      </div>
                                    ) : null}
                                    {item.dueDate ? (
                                      <div className="mt-1 text-xs text-gray-500">
                                        Due: {item.dueDate}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="topics" className="mt-4">
                        <Card className="border-gray-200 shadow-none">
                          <CardContent className="p-5">
                            {topics.length === 0 ? (
                              <EmptyState
                                title="No topics"
                                description="Topics will appear here after transcript processing finishes."
                              />
                            ) : (
                              <div className="space-y-3">
                                {topics.map((topic, index) => (
                                  <div
                                    key={`${topic.name}-${index}`}
                                    className="rounded-lg border border-gray-200 p-4"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-sm font-medium text-gray-900">
                                        {topic.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {formatSeconds(topic.startTime)} - {formatSeconds(topic.endTime)}
                                      </div>
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-gray-600">
                                      {topic.description}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="transcript" className="mt-4">
                        <Card className="border-gray-200 shadow-none">
                          <CardContent className="p-5">
                            {transcript.length === 0 ? (
                              <EmptyState
                                title="No transcript yet"
                                description="The transcript will stream in while the bot is in the meeting, then remain here after completion."
                              />
                            ) : (
                              <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
                                {transcript.map((segment, index) => (
                                  <div
                                    key={`${segment.start}-${segment.end}-${index}`}
                                    className="rounded-lg border border-gray-200 p-4"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                      <span className="font-mono">
                                        {formatSeconds(segment.start)} - {formatSeconds(segment.end)}
                                      </span>
                                      {segment.speaker ? (
                                        <Badge
                                          variant="outline"
                                          className="border-gray-200 bg-gray-50 text-gray-700"
                                        >
                                          {segment.speaker}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <Textarea
                                      readOnly
                                      value={segment.text}
                                      className="mt-3 min-h-[96px] resize-none border-0 bg-transparent px-0 py-0 text-sm leading-6 text-gray-700 shadow-none focus-visible:ring-0"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
