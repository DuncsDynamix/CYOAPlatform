import { z } from "zod"

// Zod is the source of truth for the v2 contract; types are inferred.
// Unknown keys are stripped (z.object default), so editor-only fields
// such as node `position` never reach the engine.

export const VoiceProfileSchema = z.object({
  vendorVoiceId: z.string(),
  pace: z.enum(["measured", "normal", "rapid"]).optional(),
  notes: z.string().optional(),
})

export const CharacterSchema = z.object({
  name: z.string(),
  role: z.string(),
  personality: z.string(),
  speech: z.string(),
  knowledge: z.string(),
  relationshipToParticipant: z.string(),
  voice: VoiceProfileSchema.optional(),
})

export const VisibilitySchema = z.enum(["scenes", "characters", "assessor"])
export const ReferenceRoleSchema = z.enum(["reference", "exemplar", "case_data"])

export const ReferenceItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  role: ReferenceRoleSchema,
  priority: z.enum(["must", "should", "may"]),
  visibleTo: z.array(VisibilitySchema).optional(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string() }),
    z.object({ kind: z.literal("transcript"), turns: z.array(z.object({ speaker: z.string(), text: z.string() })) }),
    z.object({ kind: z.literal("retrieval"), ref: z.string() }),
  ]),
})

export const ContextRuleSchema = z.object({
  label: z.string(),
  priority: z.enum(["must", "should", "may"]),
  trigger: z.enum(["always", "on_node_type", "on_state_condition"]),
  instruction: z.string(),
  nodeTypes: z.array(z.string()).optional(),
  stateCondition: z.string().optional(),
})

export const TrainingExtensionSchema = z.object({
  kind: z.literal("training"),
  learningObjectives: z.array(z.string()),
  organisation: z.object({ name: z.string(), policySummary: z.string().optional() }).optional(),
})

export const StoryExtensionSchema = z.object({
  kind: z.literal("story"),
  atmosphere: z.string(),
  worldRules: z.string().optional(),
  canon: z.array(z.string()).optional(),
})

export const ContextPackSchema = z.object({
  contractVersion: z.literal(2),
  core: z.object({
    setting: z.object({ summary: z.string(), details: z.string().optional() }),
    participant: z.object({
      role: z.string(),
      perspective: z.enum(["first", "second", "third"]),
      startingKnowledge: z.string(),
      goal: z.string(),
    }),
    characters: z.array(CharacterSchema),
    style: z.object({
      tone: z.string(),
      register: z.string(),
      language: z.string(),
      targetLength: z.object({ min: z.number(), max: z.number() }),
      notes: z.string(),
    }),
    references: z.array(ReferenceItemSchema),
    rules: z.array(ContextRuleSchema),
  }),
  extension: z.discriminatedUnion("kind", [TrainingExtensionSchema, StoryExtensionSchema]),
})

export const CompetencyStatusSchema = z.enum(["strength", "developing", "not_yet_seen"])

export const SessionContextSchema = z.object({
  learner: z
    .object({
      displayName: z.string().max(120).optional(),
      role: z.string().max(200).optional(),
      experienceLevel: z.enum(["new", "developing", "experienced"]).optional(),
    })
    .optional(),
  profile: z
    .array(
      z.object({
        competencyId: z.string(),
        label: z.string(),
        status: CompetencyStatusSchema,
        evidence: z.string().max(300).optional(),
      })
    )
    .optional(),
  history: z
    .array(z.object({ experienceTitle: z.string(), completedAt: z.string(), summary: z.string().max(600) }))
    .max(10)
    .optional(),
  caseData: z.array(ReferenceItemSchema.refine((r) => r.role === "case_data", { message: "caseData items must have role case_data" })).optional(),
})

export type ContextPack = z.infer<typeof ContextPackSchema>
export type Character = z.infer<typeof CharacterSchema>
export type ReferenceItem = z.infer<typeof ReferenceItemSchema>
export type ReferenceRole = z.infer<typeof ReferenceRoleSchema>
export type Visibility = z.infer<typeof VisibilitySchema>
export type ContextRule = z.infer<typeof ContextRuleSchema>
export type TrainingExtension = z.infer<typeof TrainingExtensionSchema>
export type StoryExtension = z.infer<typeof StoryExtensionSchema>
export type SessionContext = z.infer<typeof SessionContextSchema>
export type CompetencyStatus = z.infer<typeof CompetencyStatusSchema>
export type LearnerProfileEntry = NonNullable<SessionContext["profile"]>[number]

export const DEFAULT_VISIBILITY: Record<ReferenceRole, Visibility[]> = {
  reference: ["scenes", "characters", "assessor"],
  exemplar: ["characters", "assessor"],
  case_data: ["scenes", "characters"],
}
