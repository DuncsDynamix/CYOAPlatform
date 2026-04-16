# Traverse Engine — Requirements Specification

**Document type:** Requirements specification for codebase assessment  
**Prepared for:** Claude Code  
**Project:** Traverse Engine (formerly PageEngine)  
**Version:** 1.1  
**Status:** For implementation assessment

---

## How To Use This Document

This document defines what the Traverse Engine must do. It does not prescribe implementation. Your task is to read the codebase, assess the current state against each requirement, and produce a list of changes needed to bring the codebase into compliance.

For each requirement, note whether it is:
- **Already met** — no change needed
- **Partially met** — describe what is missing
- **Not met** — describe what needs to be built

Do not rename files, restructure the project, or make changes outside the scope of what these requirements define.

---

## 1. Naming

The product is called **Traverse Engine**. All references to "PageEngine" in code, comments, configuration, environment variables, and documentation must be replaced with appropriate Traverse Engine naming. The B2C reader product is called **Turn To Page**. The authoring tool is called **Traverse Studio**. The L&D product is called **Calibre**.

---

## 2. Core Engine Principle

The engine executes directed node graphs. It has no knowledge of rendering, use case, or product context. It does not know whether it is running a story, a training scenario, or an educational module. All use-case meaning is carried in the Experience Context Pack and the node graph configuration. The engine must remain free of render-layer or use-case-specific logic.

---

## 3. Session State

### 3.1 Flags

The session state must maintain a `flags` map for non-numeric state values. Keys are author-defined strings. Values must support string and boolean types only.

### 3.2 Counters

The session state must maintain a separate `counters` map for numeric accumulator values. Keys are author-defined strings. Values are integers or floats. Counters must be strictly separate from flags — they are not the same data structure with a looser type. The engine must not allow a flag and a counter to share the same key name within a session.

### 3.3 Path tracking

Session state must track: current node ID, all visited node IDs (ordered), number of choices made, and a return stack for subroutine traversal (see section 6).

### 3.4 Arc awareness

The engine must calculate and maintain arc awareness values as part of session state: depth percentage, distance to nearest endpoint, and a pacing instruction string. These are calculated by the engine and never authored directly.

### 3.5 State changes on choice

When a reader selects a choice option, the engine must apply any state changes defined on that option before routing to the next node. State changes may write to flags or counters. A single state change operation must not be able to write to both a flag key and a counter key of the same name simultaneously.

---

## 4. Node Types

The engine must support the following node types. All node types share a base schema with: unique ID, type identifier, and an author-facing label that is never shown to the reader.

### 4.1 FIXED

A node with static authored content. The engine returns the content exactly as authored. Must have exactly one successor node. May be marked mandatory (see section 8.2).

### 4.2 GENERATED

A node whose content is produced by the AI at runtime. Must carry: a beat instruction describing the dramatic or informational state to achieve, minimum and maximum word count constraints, a description of where the content must end, a list of prohibited content elements, and an optional list of required content elements.

The engine must pass the following to the AI generation call automatically, without the author specifying it: the full Experience Context Pack, the complete narrative history for the session, the current session state (flags and counters), and the current arc awareness values.

Must have exactly one successor node.

### 4.3 CHOICE

A node that presents options to the reader. Supports two response modes:

**Closed:** Presents a defined list of options. Each option carries: a unique ID, display label, successor node ID, branch type annotation, optional display conditions, and optional state changes to apply on selection.

**Open:** Presents a free-text input. Carries a prompt string and placeholder string. The engine routes open responses via AI-assisted interpretation.

### 4.4 CHECKPOINT

A node that marks a structural boundary in the experience. May be visible to the reader or silent. Carries: a label describing what is being completed, a list of node IDs or flags to unlock, a successor node ID, and a flag controlling whether the engine writes a full session state snapshot when this node is processed.

When `snapshotsState` is true, the engine must write a `checkpoint_reached` analytics event containing the full session state at that moment (see section 9.2).

### 4.5 ENDPOINT

A node that terminates a session. Carries: an endpoint ID matching the shape definition, an outcome label, a fixed closing line authored by the experience creator (never generated), a summary instruction for the AI-generated personalised summary, and outcome card configuration.

Endpoint nodes may optionally define multiple outcome variants. When variants are present, the engine selects the highest-qualifying variant based on a named counter value and a minimum threshold. If no variant qualifies, the engine falls back to the base endpoint fields. Each variant carries its own outcome label, closing line, and summary instruction.

The engine must pass the full counters map to the AI when generating the personalised endpoint summary, in addition to the narrative history.

### 4.6 SUBROUTINE\_CALL *(Phase 2 — reserve schema only)*

A node that routes to a target node while pushing a return address onto the session return stack. The engine must not attempt to execute this node type in Phase 1 but must not throw an unhandled error if it is encountered — it should return a clear not-implemented response.

### 4.7 SUBROUTINE\_RETURN *(Phase 2 — reserve schema only)*

A node that pops the top entry from the session return stack and routes there. Same Phase 2 handling as above.

---

## 5. Choice Option Display Conditions

Each choice option may carry an optional array of display conditions. The engine must evaluate all conditions before presenting options to the reader. An option is presented only if all of its conditions pass. An option with no conditions is always presented.

The engine must support the following condition types:

- **min\_choices** — passes if the number of choices made in the session is greater than or equal to a specified value
- **flag\_equals** — passes if a named flag equals a specified string or boolean value
- **flag\_exists** — passes if a named flag is present in session state regardless of value
- **flag\_not\_exists** — passes if a named flag is absent from session state
- **counter\_gte** — passes if a named counter is greater than or equal to a specified number
- **counter\_lte** — passes if a named counter is less than or equal to a specified number
- **counter\_equals** — passes if a named counter equals a specified number

When a condition is not met, the option behaviour is controlled by an `ifNotMet` field: either `suppress_option` (remove from the list entirely) or `show_disabled` (include in the list but marked as unavailable). The render layer is responsible for how a disabled option is displayed.

The existing depth gate mechanism must be migrated to use `min_choices` display conditions. The underlying behaviour must be identical.

---

## 6. Subroutine / Return Stack

The session state must reserve a `returnStack` field as an ordered array of node ID strings. It must default to an empty array. In Phase 1 nothing writes to or reads from this stack. It must be present in the schema so Phase 2 subroutine support does not require a session schema migration.

---

## 7. Branch Type Annotation

Each choice option may carry an optional `branchType` field. Valid values are: `structural`, `cosmetic`, and `load_bearing`. This field is metadata — the engine does not alter routing behaviour based on it. It is used by the authoring tool for design feedback and by the arc awareness system when identifying load-bearing transitions.

---

## 8. Shape Definition

### 8.1 Standard fields

The shape definition must carry: minimum and maximum total depth, endpoint count, endpoint shapes, load-bearing choice positions, convergence point positions, pacing model, and mandatory node IDs.

### 8.2 Mandatory node enforcement

When the engine attempts to resolve an ENDPOINT node, it must first check whether all node IDs listed in `mandatoryNodeIds` appear in the session's visited node list. If any mandatory nodes have not been visited, the engine must route to the first unvisited mandatory node rather than resolving the endpoint. This enforcement must be transparent to the render layer — the render layer simply receives the next node as normal.

---

## 9. Analytics

### 9.1 Existing events

The following events must be tracked: `session_started`, `node_reached`, `choice_made`, `session_completed`, `session_abandoned`, `story_shared`, `subscription_started`, `subscription_cancelled`, `subscription_reactivated`, `page_view`, `generation_metric`, `error`.

### 9.2 New event: checkpoint\_reached

The engine must emit a `checkpoint_reached` event when processing a CHECKPOINT node where `snapshotsState` is true. The event payload must include: session ID, experience ID, user ID (if present), the checkpoint label (`marksCompletionOf`), and the complete session state snapshot at the time of processing. The shape of the snapshot must match the full session state schema including both flags and counters.

### 9.3 Existing node\_reached event

The `node_reached` event must record whether the node ID appears in the experience's `mandatoryNodeIds` list. This allows downstream systems to construct mandatory content completion records without querying the experience definition separately.

---

## 10. AI Generation

### 10.1 Node content generation

When generating content for a GENERATED node, the engine must include in the prompt context: the Experience Context Pack, the full ordered narrative history for the session, the current flags, the current counters, and the arc awareness instruction. The counters must be passed as a named map — not merged into flags.

### 10.2 Endpoint summary generation

When generating the personalised summary at an ENDPOINT node, the engine must include: the full narrative history, the choice history, the summary instruction from the node definition (or the qualifying variant's summary instruction if variants are in use), and the full counters map. The AI must not receive raw flags unless the experience's context pack explicitly references them — counters carry the accumulated meaning that summaries need.

### 10.3 Model

All generation calls must use `claude-sonnet-4-20250514`. This must be defined as a single constant, not scattered across call sites.

---

## 11. Pre-generation Timing

When a reader arrives at any node, the engine must immediately begin generating content for all GENERATED child nodes reachable from the current node in parallel, without awaiting completion. This must not block the reader's experience. The engine must check the cache before generating — if a child node's content is already cached for this session, generation must be skipped.

The opening screen is a special case: the engine must generate the first node and all of its immediate GENERATED children before signalling readiness, streaming progress events via SSE during this process.

---

## 12. Caching

Generated node content must be cached per session and per node ID. Cache entries must expire after a duration sufficient to cover the longest reasonable single session. Cache operations must never block the reader — cache writes are fire-and-forget. The cache key must incorporate both session ID and node ID to prevent cross-session content bleed.

---

## 13. API Routes

The engine must expose the following routes:

- **POST /api/engine/start** — creates a session, returns session ID and first node content
- **POST /api/engine/choose** — submits a choice, applies state changes, returns next node content
- **GET /api/engine/stream** — SSE stream for the opening generation sequence
- **GET /api/engine/node** — returns the current node content for an existing session

All routes must validate input with schema validation before processing. All routes must apply rate limiting. Routes must support anonymous sessions (no authenticated user) as well as authenticated sessions. An authenticated session must be verified as belonging to the requesting user before any state mutation.

---

## 14. Experience CRUD

The authoring API must support creating, reading, updating, and deleting experiences. Update operations must accept the full experience payload including nodes, context pack, and shape definition as a single atomic write — partial updates to sub-fields are not required. Publish and unpublish must be separate operations from general update.

---

## 15. Authentication and Authorisation

Authentication is handled by Supabase Auth. The following rules must be enforced at the API layer:

- Draft and preview experiences are readable only by their author
- Published experiences are readable by any authenticated user with an active subscription, or by anonymous users if the experience is marked as free
- Only the author of an experience may edit or delete it
- Session state may only be mutated by the session owner, or anonymously if the session has no associated user

---

## 16. Subscription Gating

The engine must check subscription status before allowing a reader to start a session on a non-free published experience. The subscription check must happen at session creation time, not at each node. Free-tier access may be restricted to a defined number of nodes — this limit is configuration, not hardcoded.

---

## 17. BYOK

Operators may supply their own Anthropic API key. When present and decryptable, the operator's key must be used for all AI generation within that operator's experiences. The platform key must be used as the fallback. Operator keys must be stored encrypted at rest and must never appear in logs, analytics events, or error messages.

---

## 18. Security

- All API inputs must be validated and sanitised before use
- Rate limiting must be applied to engine endpoints and auth endpoints with separate limits
- Session ownership must be verified before any read or write of session state
- Operator API keys must be encrypted with AES-256-GCM
- Stripe webhook payloads must be verified against the webhook secret before processing
- Stripe events must be processed idempotently — duplicate delivery of the same event must not cause duplicate state changes

---

## 19. Testing

The following must have test coverage:

- Arc awareness calculation across all arc phases
- Display condition evaluation for all condition types
- Mandatory node enforcement at endpoint resolution
- Outcome variant selection logic (correct variant selected for given counter value)
- Checkpoint state snapshot emission
- Depth gate migration — existing depth gate behaviour must be preserved exactly under the new display conditions model
- Choice option state changes writing correctly to flags vs counters
- Session state initialisation with correct defaults including empty returnStack

---

## Appendix A — What This Document Does Not Specify

The following are intentionally outside this document's scope. They are the responsibility of the render layer, not the engine:

- How choices are displayed (buttons, numbered options, text inputs)
- How disabled options appear to the reader
- How checkpoint completion is communicated to the reader
- How the outcome card is rendered or shared
- How the personalised endpoint summary is presented
- The visual design of any reader or authoring interface
- SCORM or LTI integration
- Avatar video or text-to-speech output
- The visual node graph editor

---

## Appendix B — Glossary

| Term | Definition |
|---|---|
| Traverse Engine | The headless engine layer. Executes node graphs, calls AI, manages session state. |
| Traverse Studio | The authoring tool. Builds and manages experiences. |
| Calibre | The L&D product built on Traverse Engine. |
| Turn To Page | The B2C reader product built on Traverse Engine. |
| Experience | A complete authored node graph with context pack and shape definition. |
| Session | A single reader's traversal of an experience, including all accumulated state. |
| Node | A single unit in the experience graph. |
| Context Pack | Author-supplied configuration describing the world, tone, and content rules. Passed to every AI generation call. |
| Shape Definition | Author-supplied structural description of the experience graph — depth, endpoints, mandatory nodes. |
| Flags | String and boolean session state values. Author-defined keys. |
| Counters | Numeric session state accumulators. Author-defined keys. Separate from flags. |
| Display Condition | A logical test evaluated against session state that controls whether a choice option is shown. |
| Outcome Variant | A conditional version of an endpoint's closing content, selected based on a counter threshold. |
| Return Stack | Session state field reserving space for Phase 2 subroutine traversal. |
| Arc Awareness | Engine-calculated values describing the reader's position within the experience shape, injected into AI generation prompts. |
| Mandatory Node | A node guaranteed to be visited before any endpoint can resolve. |
| BYOK | Bring Your Own Key — operator-supplied Anthropic API key. |
