export interface OrganizationAnswerStateInput {
  answerJobId?: string | null
  answer?: string | null
}

export interface OrganizationAnswerState {
  renderableAnswer: string | null
  shouldPoll: boolean
}

export function getRenderableOrganizationAnswer(
  answer?: string | null
): string | null

export function getOrganizationAnswerState(
  input: OrganizationAnswerStateInput
): OrganizationAnswerState
