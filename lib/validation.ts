import { z } from "zod"

// ─── ENGINE API ───────────────────────────────────────────────

export const StartSessionSchema = z
  .object({
    experienceId: z.string().uuid().optional(),
    experienceSlug: z.string().min(1).max(100).optional(),
  })
  .refine((data) => data.experienceId || data.experienceSlug, {
    message: "Either experienceId or experienceSlug is required",
  })

export const SubmitChoiceSchema = z
  .object({
    sessionId: z.string().uuid(),
    choiceId: z.string().min(1).max(100).optional(),
    freeTextResponse: z.string().min(1).max(500).optional(),
  })
  .refine((data) => data.choiceId || data.freeTextResponse, {
    message: "Either choiceId or freeTextResponse is required",
  })

// ─── AUTHORING API ────────────────────────────────────────────

export const CreateExperienceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  genre: z.enum(["adventure", "mystery", "sci-fi", "horror", "romance", "fantasy"]).optional(),
  type: z.enum(["cyoa_story", "l_and_d", "education", "publisher_ip"]),
})

export const UpdateExperienceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  genre: z.string().max(100).optional(),
  type: z.enum(["cyoa_story", "l_and_d", "education", "publisher_ip"]).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  contextPack: z.record(z.unknown()).optional(),
  shape: z.record(z.unknown()).optional(),
  nodes: z.array(z.record(z.unknown())).optional(),
  segments: z.array(z.record(z.unknown())).optional(),
})

// ─── NODE SCHEMAS ─────────────────────────────────────────────

export const ChoiceOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(300),
  nextNodeId: z.string().min(1),
  isLoadBearing: z.boolean(),
  depthGate: z
    .object({
      minChoicesMade: z.number().int().min(0),
      ifNotMet: z.enum(["suppress_option", "show_disabled"]),
    })
    .optional(),
  stateChanges: z.record(z.union([z.number(), z.string(), z.boolean()])).optional(),
})

const BaseNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  position: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
})

export const FixedNodeSchema = BaseNodeSchema.extend({
  type: z.literal("FIXED"),
  content: z.string().min(1),
  mandatory: z.boolean(),
  nextNodeId: z.string().min(1),
})

export const GeneratedNodeSchema = BaseNodeSchema.extend({
  type: z.literal("GENERATED"),
  beatInstruction: z.string().min(1),
  constraints: z.object({
    lengthMin: z.number().int().min(1),
    lengthMax: z.number().int().min(1),
    mustEndAt: z.string().min(1),
    mustNotDo: z.array(z.string()),
    mustInclude: z.array(z.string()).optional(),
  }),
  nextNodeId: z.string().min(1),
})

export const ChoiceNodeSchema = BaseNodeSchema.extend({
  type: z.literal("CHOICE"),
  responseType: z.enum(["closed", "open"]),
  options: z.array(ChoiceOptionSchema).optional(),
  openPrompt: z.string().optional(),
  openPlaceholder: z.string().optional(),
})

export const CheckpointNodeSchema = BaseNodeSchema.extend({
  type: z.literal("CHECKPOINT"),
  visible: z.boolean(),
  visibleContent: z.string().optional(),
  marksCompletionOf: z.string().min(1),
  unlocks: z.array(z.string()),
  nextNodeId: z.string().min(1),
})

export const EndpointNodeSchema = BaseNodeSchema.extend({
  type: z.literal("ENDPOINT"),
  endpointId: z.string().min(1),
  outcomeLabel: z.string().min(1).max(100),
  closingLine: z.string().min(1),
  summaryInstruction: z.string().min(1),
  outcomeCard: z.object({
    shareable: z.boolean(),
    showChoiceStats: z.boolean(),
    showDepthStats: z.boolean(),
    showReadingTime: z.boolean(),
  }),
})

export const NodeSchema = z.discriminatedUnion("type", [
  FixedNodeSchema,
  GeneratedNodeSchema,
  ChoiceNodeSchema,
  CheckpointNodeSchema,
  EndpointNodeSchema,
])

// ─── INFERRED TYPES ───────────────────────────────────────────

export type StartSessionInput = z.infer<typeof StartSessionSchema>
export type SubmitChoiceInput = z.infer<typeof SubmitChoiceSchema>
export type CreateExperienceInput = z.infer<typeof CreateExperienceSchema>
export type UpdateExperienceInput = z.infer<typeof UpdateExperienceSchema>
