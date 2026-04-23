export type FieldHelp = {
  name: string;
  description: string;
  example?: string;
};

export type NodeTypeHelp = {
  summary: string;
  fields: FieldHelp[];
  tips: string[];
};

export const NODE_TYPE_HELP: Record<string, NodeTypeHelp> = {
  FIXED: {
    summary:
      "The player sees exactly what you wrote — no AI variation. Every player reads identical text. Use this for opening scenes, rules explainers, or any moment that must be the same for everyone.",
    fields: [
      {
        name: "content",
        description: "The prose shown to the player. Write it in the voice and tense of your experience.",
        example: "The storm arrived without warning...",
      },
      {
        name: "mandatory",
        description:
          "If true, every player must visit this node before reaching any endpoint. The engine redirects silently if they would otherwise skip it.",
        example: "true for your opening scene",
      },
      {
        name: "nextNodeId",
        description: "The ID of the node the player moves to after this one.",
      },
    ],
    tips: [
      "Use mandatory: true for your opening scene so every player reads it before they can skip to an ending.",
      "FIXED is the right choice when the text would be wrong if varied — an exact place name, a specific instruction, a rules explainer.",
      "Write in the voice of your experience (second-person 'you', past tense, etc.). The AI won't touch it.",
    ],
  },

  GENERATED: {
    summary:
      "The player sees AI-written prose that adapts to their session — their choices, accumulated flags, and arc position. Two players on different paths will read different versions of the same scene. Prose is generated once and cached per session.",
    fields: [
      {
        name: "beatInstruction",
        description:
          "A director's note telling the AI what should happen in this scene — the situation, the emotional state, what it's building towards. Write it as a directive, not as prose.",
        example: "The reader has just arrived at the lighthouse. Describe stepping inside — dark, salt-damp, abandoned. Set up the mystery.",
      },
      {
        name: "constraints.mustEndAt",
        description:
          "Where the scene should leave the player. Be specific: where are they standing, what are they looking at, what decision do they face? This is the engine's anchor for where to stop writing.",
        example: "reader at the base of the stairs, torch in hand, two doors ahead",
      },
      {
        name: "constraints.mustNotDo",
        description:
          "Things the AI must not do. Use this to prevent spoilers or avoid contradicting earlier scenes.",
        example: '["reveal who was operating the light", "introduce new characters"]',
      },
      {
        name: "constraints.lengthMin / lengthMax",
        description:
          "Word count range. 150–250 is a good default for narrative; 120–200 works well for training.",
      },
      {
        name: "constraints.mustInclude",
        description:
          "Things that must appear in the prose. Use sparingly — the AI is better when given latitude.",
        example: '["the keeper\'s logbook on the desk"]',
      },
    ],
    tips: [
      "Write beatInstruction as a director's note: 'here's the situation, the emotional state, what this scene is building towards.' Not 'write a scene where...'",
      "mustEndAt is critical — it tells the engine where to stop. Make it specific.",
      "Use mustNotDo to prevent spoilers. If the next node is a CHOICE about escalating to a supervisor, write 'don't suggest escalating to the supervisor'.",
      "The engine pre-generates GENERATED children in the background while the player reads the current node, so the experience feels fast.",
    ],
  },

  CHOICE: {
    summary:
      "The player picks from a list of options (closed) or types a free-text response (open). Their choice routes them to different nodes and can update session state via flags and counters.",
    fields: [
      {
        name: "responseType",
        description: "'closed' shows a fixed list of clickable options. 'open' shows a free-text input box routed by AI.",
      },
      {
        name: "prompt",
        description: "Question or scenario text shown above the options.",
        example: "The alarm is still sounding. What do you do?",
      },
      {
        name: "options[].label",
        description: "The text the player clicks. Keep it concise — 10–20 words is usually right.",
        example: "Isolate the affected zone and notify Priya immediately",
      },
      {
        name: "options[].isLoadBearing",
        description:
          "If true, this choice meaningfully changes the story trajectory. The engine writes more carefully at load-bearing junctions and tracks them in analytics. Cosmetic choices should be false.",
      },
      {
        name: "options[].stateChanges",
        description:
          "Flags and counters to update when this option is selected. Numbers accumulate into counters; strings and booleans become flags.",
        example: '{ "q1_correct": true, "performance_score": 1 }',
      },
      {
        name: "options[].trainingFeedback",
        description:
          "Feedback shown to the learner after this choice (training experiences only).",
        example: "Isolating the zone is the correct first step under the 2016 Regulations.",
      },
      {
        name: "options[].displayConditions",
        description:
          "Runtime rules that control whether this option is visible. Use flag_equals, counter_gte, min_choices, etc.",
      },
    ],
    tips: [
      "CHOICE nodes don't have their own nextNodeId — each option routes independently.",
      "Paths can converge: two options from different CHOICE nodes can point to the same downstream node. This avoids an exponentially large graph.",
      "Open choices capture free text but don't evaluate it unless the next node is a DIALOGUE. For assessed free text, use DIALOGUE.",
      "For training experiences, always set trainingFeedback and feedbackTone on every option.",
    ],
  },

  CHECKPOINT: {
    summary:
      "Usually invisible — a tracking milestone the player passes through without seeing. Sets flags that can unlock later content, and optionally fires an analytics snapshot. If visible: true, the player sees a brief message.",
    fields: [
      {
        name: "visible",
        description: "Whether the player sees this node. Set false for tracking-only checkpoints.",
      },
      {
        name: "visibleContent",
        description: "Text shown to the player if visible is true.",
        example: "Morning shift complete.",
      },
      {
        name: "marksCompletionOf",
        description: "A label for what this checkpoint represents — used in analytics and author tooling, not shown to players.",
        example: "act-one",
      },
      {
        name: "unlocks",
        description:
          "Array of flag names to set to true when this checkpoint is reached. These flags can gate CHOICE options via displayConditions. Pass [] if you don't need to unlock anything.",
        example: '["path-of-strength-unlocked"]',
      },
      {
        name: "snapshotsState",
        description:
          "If true, fires an analytics event with full session state when this checkpoint is reached. Use at major milestones.",
      },
    ],
    tips: [
      "You don't need a checkpoint for every milestone — use them when you need to unlock content or snapshot analytics.",
      "Flags set by unlocks persist for the entire session and can be read by displayConditions on CHOICE options.",
      "To know which endpoint each player reached via your training dashboard, use snapshotsState: true on a checkpoint just before the final CHOICE.",
    ],
  },

  ENDPOINT: {
    summary:
      "The experience ends here. The player sees a closing line, then a personalized AI-written summary of their journey, then an outcome card. The session is marked complete.",
    fields: [
      {
        name: "endpointId",
        description: "A stable identifier for this ending — used in analytics. Must be unique across the experience.",
        example: "ep-rescue",
      },
      {
        name: "outcomeLabel",
        description: "Short title of this ending shown on the outcome card. Max 100 characters.",
        example: "The Rescue",
      },
      {
        name: "closingLine",
        description:
          "The last authored line of prose shown to the player — a note of closure, a lingering image, a reflection. Not AI-generated.",
        example: "You never learned who had been working that light before you arrived.",
      },
      {
        name: "summaryInstruction",
        description:
          "A directive to the AI telling it what personalized summary to write. Reference the player's possible choices and the path that led to this ending.",
        example: "Write two sentences summarising this reader's journey: they found shelter in a storm, discovered a mystery, and chose to signal the ship to safety.",
      },
      {
        name: "outcomeVariants",
        description:
          "Conditional endings based on a counter value. The engine evaluates each variant in order and picks the highest-qualifying one. Lets one ENDPOINT node serve multiple outcome tiers.",
        example: 'counterKey: "performance_score", minThreshold: 4 → "Safety Champion"',
      },
      {
        name: "scoreConfig",
        description:
          "Displays a numeric score on the outcome card. Set counterKey, maxScore, passMark, and label. Display only — doesn't affect routing.",
      },
    ],
    tips: [
      "Write summaryInstruction so the AI can reference the player's specific path. Mention the key choices that led to this ending.",
      "You don't need a separate ENDPOINT node for each counter threshold — use outcomeVariants on a single ENDPOINT to handle multiple outcome tiers cleanly.",
      "closingLine is authored, not generated — write it as the final sentence the experience delivers.",
      "If you set mandatoryNodeIds in the shape, the engine silently redirects players who reach this endpoint without visiting those nodes.",
    ],
  },

  DIALOGUE: {
    summary:
      "A live conversation with a character. The player types responses; the character replies. The engine evaluates each turn against a breakthrough criteria. If the player succeeds, they advance on the success path; if they reach maxTurns without success, they route to the failure path.",
    fields: [
      {
        name: "actorId",
        description:
          "Must exactly match an Actor.name from your context pack's actors array, including capitalisation. The actor's personality, speech, and knowledge fields drive the character's responses.",
        example: "Mike Preston",
      },
      {
        name: "openingLine",
        description:
          "The character's first line. If omitted, the AI generates one based on the actor's personality and context.",
        example: "Look, I've been waiting twelve days for this refund. Can someone actually sort this out?",
      },
      {
        name: "breakthroughCriteria",
        description:
          "What constitutes success. Write as specific, observable behaviours — not feelings or vague outcomes. The engine evaluates each player turn against this.",
        example: "The agent has acknowledged the billing error as ClearConnect's fault, empathised with Mike's frustration, and offered a specific £120 refund with a clear timeframe.",
      },
      {
        name: "maxTurns",
        description:
          "Maximum player turns before the dialogue auto-ends. 4–6 is a good range for training exercises.",
        example: "5",
      },
      {
        name: "nextNodeId",
        description: "Where to go if breakthrough is achieved.",
      },
      {
        name: "failureNodeId",
        description:
          "Where to go if maxTurns is reached without breakthrough. If omitted, failure routes the same as breakthrough.",
      },
    ],
    tips: [
      "Write breakthroughCriteria as observable, specific behaviours. 'The player is sincere' is too vague. 'The player explicitly acknowledges the error was the company's fault AND names a specific refund amount' is evaluable.",
      "For training experiences, always set failureNodeId. Success and failure should have meaningfully different consequences.",
      "The actor's personality, speech, and knowledge fields in the context pack are what drive the character — write these carefully before authoring the DIALOGUE node.",
      "The player's typed text is stored in dialogue history and passed to subsequent EVALUATIVE nodes as context.",
    ],
  },

  EVALUATIVE: {
    summary:
      "A rubric-based assessment of how the player performed. The engine reviews the narrative scaffold from earlier GENERATED nodes, evaluates each criterion, and shows a results screen with pass/fail per criterion plus coaching feedback.",
    fields: [
      {
        name: "assessesNodeIds",
        description:
          "Array of node IDs (typically GENERATED nodes) whose scaffold context is passed to the evaluator. The engine built these scaffolds automatically as the player visited each node.",
        example: '["n2", "n3", "n4a", "n5"]',
      },
      {
        name: "rubric[].label",
        description: "Short name for this criterion, shown on the results screen.",
        example: "Resolution clarity",
      },
      {
        name: "rubric[].description",
        description:
          "What the criterion is assessing. Write as an observable description — this is what the AI uses to judge whether the player passed.",
        example: "The agent offered a specific resolution — naming the exact amount (£120), a timeframe, and a reference number.",
      },
      {
        name: "rubric[].weight",
        description:
          "'critical' — must pass for the overall evaluation to pass. 'major' — important but not blocking. 'minor' — informational only.",
      },
    ],
    tips: [
      "You don't create scaffolds — the engine does automatically whenever a GENERATED node is visited. You just list which nodes to assess via assessesNodeIds.",
      "Include all GENERATED nodes on the paths you want assessed. The engine handles gracefully when a player only visited some branches.",
      "Write rubric descriptions as observable behaviours: 'the agent named a specific amount' is evaluable. 'the agent was helpful' is not.",
      "1–2 critical criteria and 2–3 major criteria is a good balance. Too many critical criteria makes the experience very hard to pass.",
    ],
  },

  OBSERVED_DIALOGUE: {
    summary:
      "The player watches a scripted conversation between two characters — they read it but don't participate. Use this to show character dynamics, model correct behaviour, or set context before the player has to perform it themselves in a DIALOGUE node.",
    fields: [
      {
        name: "actorAId / actorBId",
        description:
          "The two speakers. Both must exactly match Actor.name values in your context pack's actors array.",
        example: "Sarah Chen / Marcus Webb",
      },
      {
        name: "purpose",
        description:
          "What this scene demonstrates — used in the generation prompt so the AI knows what to write. Write it as a specific dramatic goal, not just a topic.",
        example: "Sarah catches Marcus about to skip a log entry and talks him through why it's a legal requirement, not an admin nicety.",
      },
      {
        name: "turns",
        description:
          "Number of back-and-forth exchanges to generate. Each 'turn' is one exchange (A speaks, B speaks). 3–8 is a good range.",
        example: "5",
      },
      {
        name: "openingContext",
        description: "Optional stage direction shown before the dialogue begins.",
        example: "Break room, 7:45am. Sarah is at the coffee machine when Marcus comes in.",
      },
    ],
    tips: [
      "Use OBSERVED_DIALOGUE to model the behaviour you want the player to replicate in a subsequent DIALOGUE node.",
      "Purpose is critical — 'Sarah explains WIMS' is weak. 'Sarah catches Marcus about to skip a log entry and explains why it's a legal requirement' gives the AI a clear dramatic intention.",
      "4–6 turns is usually enough to make a point without overstaying.",
      "Both actorAId and actorBId must be in your context pack's actors array, or the engine won't know how to voice them.",
    ],
  },
};
