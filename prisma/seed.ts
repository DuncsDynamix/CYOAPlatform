import { PrismaClient } from "@prisma/client"
import type {
  Node,
  Segment,
  ExperienceContextPack,
  ShapeDefinition,
} from "../types/experience"
import { USE_CASE_PACKS } from "../lib/engine/usecases"

const db = new PrismaClient()

// ─── SEED USER ────────────────────────────────────────────────

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000010"

// ─── NODE GRAPH — "The Lighthouse at Storm's Edge" ───────────
//
// Structure:
//   n1 (FIXED: opening)
//     → n2 (GENERATED: you reach the lighthouse)
//       → n3 (CHOICE: enter front door / climb sea wall)
//         → n4-path-door (GENERATED: inside the lighthouse)
//           → n5-door (CHOICE: investigate the light / go to basement)
//             → n6-light (GENERATED: keeper's log)
//               → n7-cp (CHECKPOINT: discovered the mystery)
//                 → n8 (GENERATED: the light activates)
//                   → n9 (CHOICE: signal the ship / extinguish the light)
//                     → n10-signal (GENERATED: ship responds)
//                       → ep1 (ENDPOINT: The Rescue)
//                     → n11-extinguish (GENERATED: ship wrecks)
//                       → ep2 (ENDPOINT: The Wreck)
//             → n12-basement (GENERATED: find the logbook)
//               → n9 (loops to same climax choice)
//         → n13-path-wall (GENERATED: climbing the sea wall)
//           → n14 (CHOICE: wait out the storm / descend and enter)
//             → n15 (GENERATED: waiting, exposed)
//               → ep3 (ENDPOINT: The Vigil)
//             → n4-path-door (loops — merges paths)

const nodes: Node[] = [
  // ─── OPENING ─────────────────────────────────────────────
  {
    id: "n1",
    type: "FIXED",
    label: "Opening — The Storm",
    content:
      "The storm arrived without warning.\n\nYou were meant to reach Crestholm by nightfall, but the coastal road is now a river of mud, and the sea has turned the colour of pewter. Ahead, perched on a jagged headland, the lighthouse blinks — its beam cutting through the driving rain like a needle through cloth.\n\nYour car is gone. Your phone is dead. The lighthouse is the only shelter for five miles.\n\nYou pull your coat tight and start walking.",
    mandatory: true,
    nextNodeId: "n2",
  },
  {
    id: "n2",
    type: "GENERATED",
    label: "Approaching the lighthouse",
    beatInstruction:
      "The reader has trudged through the storm and reached the base of the lighthouse. Describe the building close up — weathered, old, ominous but also inviting shelter. They notice two ways in: the front door (slightly ajar) and a sea-facing path that leads up the sea wall. Build atmosphere and end at the moment of decision.",
    constraints: {
      lengthMin: 120,
      lengthMax: 250,
      mustEndAt: "the reader standing at the fork between front door and sea wall path",
      mustNotDo: ["introduce any new characters yet", "explain the mystery"],
    },
    nextNodeId: "n3",
  },
  {
    id: "n3",
    type: "CHOICE",
    label: "Enter the lighthouse",
    responseType: "closed",
    options: [
      {
        id: "opt-door",
        label: "Push open the front door",
        nextNodeId: "n4-door",
        isLoadBearing: false,
      },
      {
        id: "opt-wall",
        label: "Take the sea wall path",
        nextNodeId: "n13-wall",
        isLoadBearing: false,
      },
    ],
  },

  // ─── PATH A: FRONT DOOR ──────────────────────────────────
  {
    id: "n4-door",
    type: "GENERATED",
    label: "Inside the lighthouse — ground floor",
    beatInstruction:
      "The reader has pushed open the front door and stepped inside. The lighthouse interior: circular, stone walls, a spiral staircase, old equipment. The keeper appears to be absent but the place shows signs of recent habitation — a half-eaten meal, a coat on a hook, a log fire burning low. Unsettling details accumulate. End at the foot of the stairs with the beam above them still rotating.",
    constraints: {
      lengthMin: 150,
      lengthMax: 280,
      mustEndAt: "reader at the foot of the stairs, looking up toward the light chamber, then noticing a door to the basement",
      mustNotDo: ["reveal what happened to the keeper"],
    },
    nextNodeId: "n5-door",
  },
  {
    id: "n5-door",
    type: "CHOICE",
    label: "Investigate inside",
    responseType: "closed",
    options: [
      {
        id: "opt-light",
        label: "Climb to the light chamber",
        nextNodeId: "n6-light",
        isLoadBearing: true,
      },
      {
        id: "opt-basement",
        label: "Try the basement door",
        nextNodeId: "n12-basement",
        isLoadBearing: false,
      },
    ],
  },
  {
    id: "n6-light",
    type: "GENERATED",
    label: "The light chamber",
    beatInstruction:
      "The reader has climbed to the top of the lighthouse. The light chamber: enormous Fresnel lens rotating slowly, the beam throwing strobing shadows. The keeper's final log lies open on a table, its last entry written in a hurry. It describes a ship in distress, an unexpected signal from the sea, and a decision the keeper made. End as the reader finishes reading — and the beam suddenly changes pattern on its own, as if responding to something outside.",
    constraints: {
      lengthMin: 160,
      lengthMax: 300,
      mustEndAt: "reader realising the light is signalling by itself in a pattern that means distress",
      mustNotDo: ["reveal who or what is controlling the light"],
      mustInclude: ["the keeper's log"],
    },
    nextNodeId: "n7-cp",
  },
  {
    id: "n7-cp",
    type: "CHECKPOINT",
    label: "Mystery discovered",
    visible: false,
    marksCompletionOf: "act-one",
    unlocks: [],
    nextNodeId: "n8",
  },
  {
    id: "n8",
    type: "GENERATED",
    label: "The light activates — ship spotted",
    beatInstruction:
      "The mystery deepens. The beam is signalling on its own. Through the rain-lashed glass the reader can now see a ship — enormous, dark — dangerously close to the rocks. The light seems to be guiding it in, not warning it away. There is a panel of controls on the wall. The reader has seconds to decide. End at the moment of decision.",
    constraints: {
      lengthMin: 130,
      lengthMax: 240,
      mustEndAt: "reader at the controls, ship visible, seconds to act",
      mustNotDo: ["make the decision for the reader"],
    },
    nextNodeId: "n9",
  },
  {
    id: "n9",
    type: "CHOICE",
    label: "Climax — the ship",
    responseType: "closed",
    options: [
      {
        id: "opt-signal",
        label: "Override the signal — flash the warning pattern",
        nextNodeId: "n10-signal",
        isLoadBearing: true,
      },
      {
        id: "opt-extinguish",
        label: "Kill the light entirely",
        nextNodeId: "n11-extinguish",
        isLoadBearing: true,
      },
    ],
  },
  {
    id: "n10-signal",
    type: "GENERATED",
    label: "Signalling the ship to safety",
    beatInstruction:
      "The reader has overridden the beam and is flashing the correct distress warning. Tense, physical action — working the controls while watching the ship through the glass. The ship begins to turn. A long, agonising minute. Then it clears the rocks. Lights aboard the ship come on. Someone on the bridge waves a torch. Relief, exhaustion, the storm beginning to ease. End on a moment of earned quiet.",
    constraints: {
      lengthMin: 150,
      lengthMax: 280,
      mustEndAt: "the ship safely past, first light of dawn on the horizon",
      mustNotDo: ["bring in additional characters by name"],
    },
    nextNodeId: "ep1",
  },
  {
    id: "n11-extinguish",
    type: "GENERATED",
    label: "The light goes dark",
    beatInstruction:
      "The reader has killed the light. For a moment — silence, darkness, just the howl of the wind. Then, from below, the grinding sound of a hull on rock. A distant impact, then the deep groan of a breaking ship. The reader watches from the dark tower, unable to undo what they've done. Dawn reveals the wreck on the rocks below. End on the weight of the choice, not melodrama.",
    constraints: {
      lengthMin: 140,
      lengthMax: 260,
      mustEndAt: "reader watching wreckage at first light, the lighthouse dark around them",
      mustNotDo: ["show survivors or non-survivors — leave it ambiguous"],
    },
    nextNodeId: "ep2",
  },
  {
    id: "n12-basement",
    type: "GENERATED",
    label: "The basement — the logbook",
    beatInstruction:
      "The reader has gone down to the basement instead of up. It's cold, damp, full of old equipment. But on a workbench they find a proper logbook — months of entries. The most recent entries grow increasingly erratic: the keeper describing signals from the sea that no one else could see, a ship that appeared every night in the same spot, a plan to guide it to safety by any means necessary. The entries stop three days ago. End as the reader hears the beam above them change pattern — the same signalling from upstairs has started.",
    constraints: {
      lengthMin: 150,
      lengthMax: 280,
      mustEndAt: "reader rushing up the stairs toward the light chamber, now hearing the ship's horn",
      mustNotDo: ["describe what happened to the keeper"],
    },
    nextNodeId: "n8",
  },

  // ─── PATH B: SEA WALL ────────────────────────────────────
  {
    id: "n13-wall",
    type: "GENERATED",
    label: "Climbing the sea wall",
    beatInstruction:
      "The reader has taken the path along the sea wall — precarious, exposed to the full fury of the storm. Spray, wind, physical effort. Below them the sea is violent. From this angle they can see further along the coast, and they spot something: a shape in the water, too regular to be rock. Could be a vessel. End as they reach a flat section of the wall with a decision: wait here in a small shelter cut into the stone, or descend back and try the lighthouse door.",
    constraints: {
      lengthMin: 130,
      lengthMax: 250,
      mustEndAt: "reader at the wall shelter, seeing the shape in the water, wind howling",
      mustNotDo: ["let the reader identify the shape clearly yet"],
    },
    nextNodeId: "n14",
  },
  {
    id: "n14",
    type: "CHOICE",
    label: "Sea wall decision",
    responseType: "closed",
    options: [
      {
        id: "opt-wait",
        label: "Shelter here and wait out the storm",
        nextNodeId: "n15-wait",
        isLoadBearing: false,
      },
      {
        id: "opt-descend",
        label: "Descend and enter through the front door",
        nextNodeId: "n4-door",
        isLoadBearing: false,
      },
    ],
  },
  {
    id: "n15-wait",
    type: "GENERATED",
    label: "The vigil on the wall",
    beatInstruction:
      "The reader stays on the sea wall as the storm rages. Hours pass. The shape in the water resolves slowly — it is a ship, dark and drifting, apparently powerless. The lighthouse beam behaves strangely: flickering, changing pattern, as if someone inside is working it. At dawn the storm breaks. The ship has passed somehow, leaving behind only a single life-ring lodged in the rocks below. The reader is cold, exhausted, and has no answers — only the certainty that something happened in that lighthouse they will never know.",
    constraints: {
      lengthMin: 160,
      lengthMax: 300,
      mustEndAt: "morning, the sea calm, the reader stiff and cold, looking at the life-ring",
      mustNotDo: ["explain the mystery or the ship"],
    },
    nextNodeId: "ep3",
  },

  // ─── ENDPOINTS ───────────────────────────────────────────
  {
    id: "ep1",
    type: "ENDPOINT",
    label: "Endpoint — The Rescue",
    endpointId: "ep-rescue",
    outcomeLabel: "The Rescue",
    closingLine:
      "You never learned who had been working that light before you arrived. But on the rocks below, where a ship might have broken apart, there is only water — and somewhere out there, a vessel making port.",
    summaryInstruction:
      "Write two sentences summarising the reader's journey: they found shelter from a storm, uncovered a mystery in the lighthouse, and chose to signal a ship to safety at the critical moment.",
    outcomeCard: {
      shareable: true,
      showChoiceStats: true,
      showDepthStats: true,
      showReadingTime: true,
    },
  },
  {
    id: "ep2",
    type: "ENDPOINT",
    label: "Endpoint — The Wreck",
    endpointId: "ep-wreck",
    outcomeLabel: "The Wreck",
    closingLine:
      "The light you killed bought silence. What it cost, you will not know until the tide turns. You leave the lighthouse before anyone comes to ask questions.",
    summaryInstruction:
      "Write two sentences summarising the reader's journey: they found shelter from a storm, uncovered a mystery in the lighthouse, and chose to extinguish the light — with consequences they cannot undo.",
    outcomeCard: {
      shareable: true,
      showChoiceStats: true,
      showDepthStats: false,
      showReadingTime: true,
    },
  },
  {
    id: "ep3",
    type: "ENDPOINT",
    label: "Endpoint — The Vigil",
    endpointId: "ep-vigil",
    outcomeLabel: "The Vigil",
    closingLine:
      "You watched all night from the wall, and the storm showed you nothing but itself. Whatever happened in that lighthouse, it happened without you.",
    summaryInstruction:
      "Write two sentences summarising the reader's journey: they took the harder path along the sea wall, stayed outside through the storm, and emerged with questions that will never be answered.",
    outcomeCard: {
      shareable: false,
      showChoiceStats: true,
      showDepthStats: true,
      showReadingTime: true,
    },
  },
]

const contextPack: ExperienceContextPack = {
  world: {
    description:
      "Remote coastal headland, British Isles, present day. A storm has closed the roads. The only structure for miles is an old lighthouse on a jagged cliff, its beam cutting through the rain.",
    rules:
      "Realistic — no supernatural elements are confirmed, only implied. The world operates on physical reality. Tension comes from isolation, atmosphere, and moral weight.",
    atmosphere:
      "Dread, isolation, literary thriller with ghost story ambiguity. Think Daphne du Maurier or early Ian McEwan. Build slowly, accelerate to the climax, earn the ending.",
  },
  actors: [
    {
      name: "The Keeper",
      role: "Absent lighthouse keeper",
      personality: "Obsessive, devoted, perhaps unhinged by isolation",
      speech:
        "Only appears through written log entries — clipped, factual, then increasingly desperate",
      knowledge: "Knows about the ship and its repeated appearances; has a plan",
      relationshipToProtagonist: "Unknown — never met",
    },
  ],
  protagonist: {
    perspective: "you",
    role: "Traveller caught in a storm — no connection to the lighthouse or its keeper. Just needs shelter.",
    knowledge:
      "Nothing about the lighthouse or its keeper. Car is gone. Phone is dead. The lighthouse is the only shelter for five miles.",
    goal: "To survive the storm — but the lighthouse has other plans.",
  },
  style: {
    tone: "Atmospheric, tense, literary. Dread without melodrama.",
    language: "en-GB",
    register: "literary",
    targetLength: { min: 100, max: 300 },
    styleNotes:
      "Short sentences during action. Longer, more complex sentences for atmosphere. Always second person ('you'). Present tense throughout. No adverbs. Favour concrete nouns.",
  },
  groundTruth: [
    {
      label: "Core canon facts",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "The keeper has been missing for three days. The ship appears every night in the same position during storms. The lighthouse beam can be manually controlled from the light chamber. The basement contains months of log entries.",
    },
  ],
  scripts: [
    {
      label: "Preserve mystery",
      priority: "must",
      trigger: "always",
      instruction:
        "Never explain the supernatural origin of the ship. Never give the keeper a name. Never provide a resolution that costs nothing. The mystery must remain unresolved.",
    },
    {
      label: "Motif weaving",
      priority: "should",
      trigger: "always",
      instruction:
        "Weave in these motifs where natural: light and dark, isolation, the cost of decisive action, the sea as indifferent witness.",
    },
    {
      label: "Ending elegiac tone",
      priority: "should",
      trigger: "on_node_type",
      nodeTypes: ["ENDPOINT"],
      instruction:
        "The ending reflection should be elegiac rather than conclusive. The protagonist has survived but the world has not changed. Leave one question unanswered.",
    },
  ],
}

const shape: ShapeDefinition = {
  totalDepthMin: 3,
  totalDepthMax: 7,
  endpointCount: 3,
  endpoints: [
    {
      id: "ep-rescue",
      label: "The Rescue",
      minChoicesToReach: 3,
      maxChoicesToReach: 5,
      narrativeWeight: "earned",
      emotionalTarget: "Relief tinged with unresolved mystery",
    },
    {
      id: "ep-wreck",
      label: "The Wreck",
      minChoicesToReach: 3,
      maxChoicesToReach: 5,
      narrativeWeight: "cautionary",
      emotionalTarget: "Weight of an irreversible choice",
    },
    {
      id: "ep-vigil",
      label: "The Vigil",
      minChoicesToReach: 2,
      maxChoicesToReach: 4,
      narrativeWeight: "bittersweet",
      emotionalTarget: "The melancholy of having stayed outside the story",
    },
  ],
  loadBearingChoices: [3, 4],
  convergencePoints: [4],
  pacingModel: "narrative_arc",
  mandatoryNodeIds: ["n1"],
}

// ─── SEGMENTS ────────────────────────────────────────────────

const segments: Segment[] = [
  {
    id: "seg-main",
    label: "The Lighthouse at Storm's Edge",
    description: "The complete story in a single segment.",
    order: 0,
    nodes: [...nodes],
  },
]

// ─── SEED ─────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database…")

  const existing = await db.experience.findUnique({ where: { id: EXPERIENCE_ID } })
  if (existing) {
    console.log("✓ Already seeded. Run with a clean DB to re-seed.")
    return
  }

  const useCasePack = USE_CASE_PACKS.cyoa_story
  if (!useCasePack) throw new Error('USE_CASE_PACK "cyoa_story" not found in lib/engine/usecases')

  // Upsert the dev author
  await db.user.upsert({
    where: { id: AUTHOR_ID },
    update: {},
    create: {
      id: AUTHOR_ID,
      email: "dev@pageengine.local",
      name: "Dev Author",
    },
  })
  console.log("  ✓ User seeded")

  // Upsert the experience
  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    update: {
      nodes: nodes as object[],
      segments: segments as object[],
      useCasePack: USE_CASE_PACKS.cyoa_story as object,
      contextPack: contextPack as object,
      shape: shape as object,
      status: "published",
      publishedAt: new Date(),
    },
    create: {
      id: EXPERIENCE_ID,
      authorId: AUTHOR_ID,
      title: "The Lighthouse at Storm's Edge",
      slug: "the-lighthouse-at-storms-edge",
      description:
        "Stranded in a coastal storm, you find shelter in an abandoned lighthouse — and stumble into a mystery that demands a choice.",
      genre: "mystery",
      status: "published",
      publishedAt: new Date(),
      type: "cyoa_story",
      renderingTheme: "retro-book",
      useCasePack: USE_CASE_PACKS.cyoa_story as object,
      contextPack: contextPack as object,
      shape: shape as object,
      nodes: nodes as object[],
      segments: segments as object[],
    },
  })
  console.log("  ✓ Experience seeded (18 nodes, 1 segment, 3 endings)")
  console.log("")
  console.log("Done. Open http://localhost:3000 to read the story.")
  console.log("Authoring: http://localhost:3000/experience/" + EXPERIENCE_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
