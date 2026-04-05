export function getRenderableOrganizationAnswer(answer) {
  if (typeof answer !== "string") {
    return null
  }

  const trimmedAnswer = answer.trim()
  return trimmedAnswer.length > 0 ? trimmedAnswer : null
}

export function getOrganizationAnswerState(input) {
  const renderableAnswer = getRenderableOrganizationAnswer(input?.answer)

  return {
    renderableAnswer,
    shouldPoll: Boolean(input?.answerJobId) && !renderableAnswer,
  }
}
