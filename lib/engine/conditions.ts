import type { DisplayCondition, ChoiceOption } from "@/types/experience"
import type { SessionState } from "@/types/session"

/**
 * Evaluates a single display condition against session state.
 * Returns true if the condition passes (option should be shown normally).
 */
export function evaluateCondition(
  condition: DisplayCondition,
  state: SessionState
): boolean {
  switch (condition.type) {
    case "min_choices":
      return state.choicesMade >= condition.value
    case "flag_equals":
      return state.flags[condition.key] === condition.value
    case "flag_exists":
      return condition.key in state.flags
    case "flag_not_exists":
      return !(condition.key in state.flags)
    case "counter_gte":
      return (state.counters[condition.key] ?? 0) >= condition.value
    case "counter_lte":
      return (state.counters[condition.key] ?? 0) <= condition.value
    case "counter_equals":
      return (state.counters[condition.key] ?? 0) === condition.value
  }
}

/**
 * Evaluates all display conditions (and legacy depthGate) for each option.
 * Suppressed options are removed. show_disabled options are included with disabled=true.
 * This replaces applyDepthGates in the executor.
 */
export function applyDisplayConditions(
  options: ChoiceOption[],
  state: SessionState
): ChoiceOption[] {
  const result: ChoiceOption[] = []

  for (const option of options) {
    // Legacy depth gate — treat as min_choices condition
    if (option.depthGate) {
      const passes = state.choicesMade >= option.depthGate.minChoicesMade
      if (!passes) {
        if (option.depthGate.ifNotMet === "suppress_option") continue
        result.push({ ...option, disabled: true })
        continue
      }
    }

    // New display conditions
    const conditions = option.displayConditions ?? []
    let suppressed = false
    let anyFailed = false

    for (const condition of conditions) {
      if (!evaluateCondition(condition, state)) {
        if (condition.ifNotMet === "suppress_option") {
          suppressed = true
          break
        }
        anyFailed = true
      }
    }

    if (suppressed) continue
    result.push(anyFailed ? { ...option, disabled: true } : option)
  }

  return result
}
