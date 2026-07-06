/**
 * Gold Tap Training — anchor design partner seed.
 *
 * Creates the Gold Tap org (training_pilot tier), an owner + two learner
 * users (access-control fixtures), and a compact published scenario that
 * exercises FIXED, CHOICE, GENERATED, DIALOGUE, EVALUATIVE and ENDPOINT
 * node types: responsible alcohol service on a busy Friday shift.
 *
 * Also moves the dev author (…0001) into the Gold Tap org as an owner so
 * the local dev user can author and play org-gated content.
 *
 * Run: npx tsx prisma/seed-goldtap.ts
 */
import { db } from "../lib/db/prisma"
import { USE_CASE_PACKS } from "../lib/engine/usecases"
import type { Node, ExperienceContextPack, ShapeDefinition } from "../types/experience"

const ORG_ID = "00000000-0000-0000-0000-000000000051"
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000050"
const DEV_AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const OWNER_ID = "00000000-0000-0000-0000-000000000052"
const LEARNER_A_ID = "00000000-0000-0000-0000-000000000053"
const LEARNER_B_ID = "00000000-0000-0000-0000-000000000054"

// ─── CONTEXT PACK ─────────────────────────────────────────────────────────────

const contextPack: ExperienceContextPack = {
  world: {
    description:
      "The Gilded Lion, a busy gastropub on a Friday evening. The learner is a recently hired bar team member on their first weekend shift. The venue holds a premises licence; the duty manager is on site but stretched.",
    rules:
      "Realistic UK licensed-premises setting. Licensing Act 2003 applies: it is an offence to serve alcohol to a person who is drunk. No dramatic exaggeration — consequences are professional and legal, not theatrical.",
    atmosphere: "Loud, warm, fast-moving. Pressure comes from queues and regulars, not villains.",
  },
  actors: [
    {
      name: "Marie",
      role: "Duty manager at The Gilded Lion",
      personality:
        "Calm, experienced, direct. Coaches rather than scolds, but expects staff to know their legal responsibilities.",
      speech: "Plain, brisk sentences. Asks pointed questions before giving answers.",
      knowledge:
        "Personal licence holder. Knows the Licensing Act 2003 duties on serving intoxicated customers, refusal procedures, and the venue's incident log.",
      relationshipToProtagonist: "Line manager — supportive but assessing how the learner handled the situation.",
    },
  ],
  protagonist: {
    perspective: "you",
    role: "new bar team member",
    knowledge: "Completed induction e-learning; first weekend shift; knows where the duty manager is.",
    goal: "Serve customers well while meeting legal responsibilities around alcohol service.",
  },
  style: {
    tone: "grounded and professional, with warmth",
    language: "en-GB",
    register: "plain",
    targetLength: { min: 120, max: 220 },
    styleNotes: "Second person, present tense. Concrete sensory detail of a busy bar. No moralising narrator.",
  },
  groundTruth: [
    {
      label: "Licensing duty",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Under the Licensing Act 2003 it is an offence to knowingly sell alcohol to a person who is drunk. Staff should refuse service politely, offer alternatives (water, food), and involve the duty manager when a refusal may escalate. Refusals should be logged.",
    },
  ],
  scripts: [],
}

// ─── SHAPE ────────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 4,
  totalDepthMax: 7,
  endpointCount: 1,
  endpoints: [],
  loadBearingChoices: [1],
  convergencePoints: [3],
  pacingModel: "narrative_arc",
  mandatoryNodeIds: ["n-intro"],
}

// ─── NODES ────────────────────────────────────────────────────────────────────

const nodes: Node[] = [
  {
    id: "n-intro",
    type: "FIXED",
    label: "Friday shift begins",
    mandatory: true,
    content:
      "Half past nine on your first Friday at The Gilded Lion. The bar is three deep and the glasswasher hasn't stopped since seven. Marie, the duty manager, is at the far end dealing with a delivery driver.\n\nDes — a regular, by the way the others greet him — sways up to the bar. His eyes take a second too long to find yours. He plants both hands on the bar top to steady himself and grins.\n\n\"Same again, chief. Pint of the gold tap.\"",
    nextNodeId: "n-choice-serve",
  },
  {
    id: "n-choice-serve",
    type: "CHOICE",
    label: "Serve Des?",
    responseType: "closed",
    options: [
      {
        id: "opt-serve",
        label: "Pour the pint — he's a regular and it's busy",
        nextNodeId: "n-after-serve",
        isLoadBearing: true,
        stateChanges: { served_intoxicated: true },
        requiresFreshGeneration: true,
      },
      {
        id: "opt-decline",
        label: "Politely decline and offer him water and some food",
        nextNodeId: "n-after-decline",
        isLoadBearing: true,
        stateChanges: { refused_service: true },
        requiresFreshGeneration: true,
      },
      {
        id: "opt-escalate",
        label: "Stall him and quietly fetch Marie",
        nextNodeId: "n-after-escalate",
        isLoadBearing: true,
        stateChanges: { escalated_to_manager: true },
        requiresFreshGeneration: true,
      },
    ],
  },
  {
    id: "n-after-serve",
    type: "GENERATED",
    label: "Consequence: served while drunk",
    beatInstruction:
      "The learner serves Des despite clear signs of intoxication. Show the immediate relief of the queue moving, then the slow-arriving consequence: Des stumbles into a table, a glass breaks, other customers notice, and Marie sees the fresh pint in his hand. No injuries — but the learner realises the refusal decision was theirs to make and they passed it up.",
    constraints: {
      lengthMin: 120,
      lengthMax: 220,
      mustEndAt: "Marie catching the learner's eye and nodding towards the quiet end of the bar",
      mustNotDo: ["injure anyone", "involve police", "have Marie shout or humiliate the learner"],
    },
    nextNodeId: "n-dialogue-marie",
  },
  {
    id: "n-after-decline",
    type: "GENERATED",
    label: "Consequence: polite refusal",
    beatInstruction:
      "The learner politely refuses service, offering water and the kitchen's last food orders. Show the refusal done well: low voice, no audience, a reason given without lecturing. Des grumbles but takes the water; a nearby customer gives an approving look. The learner's heart is still going — refusing a regular is hard.",
    constraints: {
      lengthMin: 120,
      lengthMax: 220,
      mustEndAt: "Marie catching the learner's eye and nodding towards the quiet end of the bar",
      mustNotDo: ["make Des aggressive", "make the refusal feel effortless"],
    },
    nextNodeId: "n-dialogue-marie",
  },
  {
    id: "n-after-escalate",
    type: "GENERATED",
    label: "Consequence: fetched the manager",
    beatInstruction:
      "The learner stalls Des ('two minutes, just changing the barrel') and quietly brings Marie over. Marie handles the refusal smoothly — but the learner notices she does exactly what they could have done themselves: quiet word, water, kitchen menu. Involving her was safe, not wrong, but the queue built and the decision was theirs to own.",
    constraints: {
      lengthMin: 120,
      lengthMax: 220,
      mustEndAt: "Marie returning and nodding the learner towards the quiet end of the bar",
      mustNotDo: ["make Marie resentful", "frame escalation as failure"],
    },
    nextNodeId: "n-dialogue-marie",
  },
  {
    id: "n-dialogue-marie",
    type: "DIALOGUE",
    label: "Debrief with Marie",
    actorId: "Marie",
    openingLine:
      "Right — quiet five minutes while the kitchen catches up. Talk me through Des. What did you see, and what was actually your call to make there?",
    breakthroughCriteria:
      "The learner identifies the signs of intoxication they observed, states that serving a drunk customer is illegal and that the refusal decision sits with whoever is serving, and describes a de-escalation approach (quiet refusal, alternatives, logging it, involving the manager if it may turn confrontational).",
    maxTurns: 5,
    nextNodeId: "n-eval",
    failureNodeId: "n-eval",
  },
  {
    id: "n-eval",
    type: "EVALUATIVE",
    label: "Responsible service assessment",
    rubric: [
      {
        id: "crit-legal-duty",
        label: "Legal duty recognised",
        description:
          "Learner recognised that serving a visibly intoxicated customer is an offence and that the duty applies to them personally, not just the manager.",
        weight: "critical",
      },
      {
        id: "crit-customer-care",
        label: "Respectful handling",
        description:
          "Learner handled (or planned to handle) the refusal without humiliating the customer: low-key, alternatives offered, no audience.",
        weight: "major",
      },
      {
        id: "crit-escalation",
        label: "Sensible use of escalation",
        description:
          "Learner involved the duty manager appropriately — neither dumping the decision nor refusing help when a situation could escalate.",
        weight: "minor",
      },
    ],
    assessesNodeIds: ["n-after-serve", "n-after-decline", "n-after-escalate"],
    nextNodeId: "n-end",
  },
  {
    id: "n-end",
    type: "ENDPOINT",
    label: "End of shift",
    endpointId: "ep-shift-end",
    outcomeLabel: "Last orders",
    closingLine: "The bell rings for last orders. Tomorrow you'll be quicker — and surer.",
    summaryInstruction:
      "Summarise in two or three sentences how the learner handled the Des situation, naming the decision they made and one thing to carry into their next shift.",
    outcomeCard: {
      shareable: false,
      showChoiceStats: true,
      showDepthStats: false,
      showReadingTime: false,
    },
  },
]

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Gold Tap Training (anchor design partner)…")

  const existing = await db.experience.findUnique({ where: { id: EXPERIENCE_ID } })
  if (existing) {
    console.log("✓ Already seeded. Run with a clean DB to re-seed.")
    return
  }

  const useCasePack = USE_CASE_PACKS.l_and_d
  if (!useCasePack) throw new Error('USE_CASE_PACK "l_and_d" not found in lib/engine/usecases')

  await db.org.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: "Gold Tap Training",
      slug: "gold-tap-training",
      trainingTier: "training_pilot",
      isOperator: false,
    },
  })
  console.log("  ✓ Org seeded (Gold Tap Training, training_pilot)")

  // The dev author joins Gold Tap as an owner — Gold Tap is the anchor
  // partner, so local dev should see the org-gated experience end to end.
  await db.user.upsert({
    where: { id: DEV_AUTHOR_ID },
    update: { orgId: ORG_ID, orgRole: "owner" },
    create: {
      id: DEV_AUTHOR_ID,
      email: "dev@pageengine.local",
      name: "Dev Author",
      orgId: ORG_ID,
      orgRole: "owner",
    },
  })

  await db.user.upsert({
    where: { id: OWNER_ID },
    update: {},
    create: {
      id: OWNER_ID,
      email: "owner@goldtaptraining.example",
      name: "Gold Tap Owner",
      orgId: ORG_ID,
      orgRole: "owner",
    },
  })

  await db.user.upsert({
    where: { id: LEARNER_A_ID },
    update: {},
    create: {
      id: LEARNER_A_ID,
      email: "learner1@goldtaptraining.example",
      name: "Gold Tap Learner One",
      orgId: ORG_ID,
      orgRole: "learner",
    },
  })

  await db.user.upsert({
    where: { id: LEARNER_B_ID },
    update: {},
    create: {
      id: LEARNER_B_ID,
      email: "learner2@goldtaptraining.example",
      name: "Gold Tap Learner Two",
      orgId: ORG_ID,
      orgRole: "learner",
    },
  })
  console.log("  ✓ Users seeded (dev author → owner; +1 owner, +2 learners)")

  await db.experience.create({
    data: {
      id: EXPERIENCE_ID,
      authorId: DEV_AUTHOR_ID,
      orgId: ORG_ID,
      title: "Last Orders: Responsible Alcohol Service",
      slug: "gold-tap-responsible-service",
      description:
        "First Friday shift at The Gilded Lion. A regular who's had too many, a queue three deep, and a decision that is legally yours to make. Exercises CHOICE, GENERATED, DIALOGUE and EVALUATIVE nodes.",
      genre: "training",
      status: "published",
      publishedAt: new Date(),
      type: "l_and_d",
      renderingTheme: "training",
      useCasePack: useCasePack as object,
      contextPack: contextPack as unknown as object,
      shape: shape as unknown as object,
      nodes: nodes as unknown as object[],
      segments: [],
    },
  })
  console.log(`  ✓ Experience seeded (${EXPERIENCE_ID})`)
  console.log("Done. Play at /scenario/" + EXPERIENCE_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
