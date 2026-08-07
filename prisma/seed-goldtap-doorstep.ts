import { PrismaClient } from "@prisma/client"
import type { Node, ExperienceContextPack, ShapeDefinition } from "../types/experience"
import { USE_CASE_PACKS } from "../lib/engine/usecases"

/**
 * "The Doorstep: Refusal-of-Entry Practice" (Experience ID ...0090)
 *
 * The practice & rehearsal use case: repeatable conversation practice with AI
 * role-players, coaching feedback rather than a certificate. Theory pages feed
 * two doorstep dialogues (a frightened customer, a hostile one); an EVALUATIVE
 * node assesses the learner's own words; the endpoint is a formative debrief.
 */

const db = new PrismaClient()

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000090"
const ORG_ID = "00000000-0000-0000-0000-000000000051" // Gold Tap Training (seed-goldtap.ts)

// Objectives — checkpoint marksCompletionOf must match these verbatim
const OBJ_THEORY =
  "Understand rights of entry, the identity and password procedure, and why customers are right to be cautious"
const OBJ_REASSURE = "Reassure a frightened customer with patient verification, not persuasion pressure"
const OBJ_DEESCALATE =
  "Stay calm under hostility: de-escalate, offer choices, and withdraw and record properly when refused"

// ─── NODES ───────────────────────────────────────────────────────────────────

const nodes: Node[] = [
  {
    id: "n-intro",
    type: "FIXED",
    label: "Welcome — why the doorstep is the hardest part of the job",
    mandatory: true,
    content: `# The Doorstep: Refusal-of-Entry Practice

Most of your training certifies what you know. This session practises something harder: what you *say*, on a doorstep, to a customer who does not want to let you in.

You will read two short briefings, then hold two live conversations. The residents are played by AI and they respond to what you actually say. No two runs are the same, and there is no pass mark: at the end you get coaching feedback on your own words, and you can run it again any time.

A refused visit handled well is a success. Forcing a doorstep is the only way to fail.`,
    nextNodeId: "n-theory-rights",
  },

  {
    id: "n-theory-rights",
    type: "FIXED",
    label: "Briefing 1 — Rights, identity, and why customers are right to be cautious",
    mandatory: true,
    content: `## Rights, identity and the cautious customer

### Why suspicion is the correct starting point

Bogus callers posing as "the water board" are one of the most common forms of distraction burglary in the UK, and older residents are the primary target. Water companies actively tell their customers to challenge callers at the door. When a resident refuses you entry, the system is working. Never treat suspicion as an insult.

### What you carry and what they can check

| You | The customer |
|-----|--------------|
| Photo ID card, shown without being asked, passed through a window or letterbox if wanted | May keep the door closed while checking, and should |
| The company phone number printed on their bill, never a number you dictate | Can call customer services to confirm your name and visit |
| Knowledge of the password scheme | Vulnerable customers may hold an agreed password you must be asked for and match |
| An appointment reference where one exists | Can rebook to a time when a relative can be present |

### What you may and may not do

- You are visiting to carry out legitimate work: a meter reading, an internal stop tap check, a water quality sample. For routine visits you have no right to force entry, and you never attempt it.
- If entry is refused, you explain the follow-up route, log the visit as refused with the reason, and leave. Formal powers of entry involve notice and, in extreme cases, a warrant: that is a company process, never a doorstep argument.
- You never step inside uninvited, never block a closing door, and never raise your voice.`,
    nextNodeId: "n-theory-craft",
  },

  {
    id: "n-theory-craft",
    type: "FIXED",
    label: "Briefing 2 — The conversation craft",
    mandatory: true,
    content: `## The conversation craft

Six habits separate a good doorstep call from a complaint:

1. **Purpose before paperwork.** Open with why you are there in one plain sentence, before reaching for ID or a clipboard. People decide whether to trust you in the first ten seconds.
2. **Acknowledge before you answer.** "You're right to check" defuses more suspicion than any card. Meet hostility with acknowledgement too: "It sounds like you've had a bad experience with us."
3. **Offer choices, not ultimatums.** "You can call the number on your bill, or I can come back at two when your son is home" keeps the customer in control. "I need to come in" takes control away and hardens refusal.
4. **Slow down for fear, stay level for anger.** A frightened customer needs time and a calm voice. An angry one needs you not to match their energy: short sentences, even tone, no defensiveness.
5. **Watch for vulnerability.** Confusion, distress, or a password request signals extra care: involve customer services, suggest a supported rebooking, never press.
6. **Withdraw and record.** If the answer stays no: confirm the follow-up route, thank them, leave, and log the refusal with the reason while it is fresh. The record protects the customer, the company, and you.

Keep these in reach: the **Notes** button in the header holds both briefings during the conversations.

*Two doorsteps are waiting. Take a breath.*`,
    nextNodeId: "cp-theory",
  },

  {
    id: "cp-theory",
    type: "CHECKPOINT",
    label: "Theory complete",
    visible: false,
    marksCompletionOf: OBJ_THEORY,
    unlocks: [],
    nextNodeId: "n-scene-margaret",
  },

  // ─── CONVERSATION 1: THE FRIGHTENED CUSTOMER ─────────────────────────────

  {
    id: "n-scene-margaret",
    type: "GENERATED",
    label: "Doorstep 1 — the chain stays on",
    beatInstruction:
      "Set up the learner's first doorstep visit of the morning. Invent the specifics fresh: street name, weather, time, the exact job (an internal stop tap check, a routine water quality sample, or a meter inspection at the property). The address belongs to Margaret Hale, 81, who lives alone. The learner knocks; after a long pause the door opens a few inches on the chain. One eye and a cardigan shoulder. She asks who they are, voice careful. End at that moment: chain on, Margaret waiting, the learner about to speak first.",
    constraints: {
      lengthMin: 90,
      lengthMax: 160,
      mustEndAt: "the door on the chain, Margaret waiting for the learner's first words",
      mustNotDo: [
        "have Margaret open the door or make any decision yet",
        "characterise the learner's manner: their conduct is what the exercise tests",
      ],
    },
    nextNodeId: "d-margaret",
  },

  {
    id: "d-margaret",
    type: "DIALOGUE",
    label: "Margaret Hale — the chain stays on",
    actorId: "Margaret Hale",
    openingLine:
      "I don't open the door to people I don't know. My son says the water board never just turns up. How do I know you're who you say you are?",
    breakthroughCriteria:
      "The learner has reassured Margaret through correct procedure rather than persuasion pressure: they have acknowledged that her caution is right; offered proper verification on her terms (showing photo ID through the window or letterbox, inviting her to call the number printed on her own bill rather than any number the learner provides, or the agreed password scheme if she has one); explained the purpose of the visit in plain terms; and offered her a real choice such as rebooking for a time when a relative can be present. Margaret should only relax if the learner has actually done these things. Impatience, pressure, or dictating a phone number for her to call must make her more guarded, not less.",
    maxTurns: 6,
    nextNodeId: "n-out-margaret",
    failureNodeId: "n-out-margaret",
  },

  {
    id: "n-out-margaret",
    type: "GENERATED",
    label: "Doorstep 1 — how it ended",
    beatInstruction:
      "Close the Margaret Hale visit, honestly reflecting the conversation that just happened. If the learner reassured her properly (acknowledged her caution, offered verification on her terms, gave her choices), she either admits them once satisfied or agrees a rebooking she is comfortable with: either is a good outcome, and the scene should feel like trust carefully built. If the learner pressured or rushed her, the chain stays on and the door closes: describe the learner logging a refused visit and what they would record. Never punish a well-handled refusal: if the learner offered the right routes and Margaret still said no, the closing note is that this is the procedure working.",
    constraints: {
      lengthMin: 80,
      lengthMax: 150,
      mustEndAt: "the visit concluded, the learner noting the outcome, walking back to the van",
      mustNotDo: [
        "invent misconduct the learner did not commit",
        "frame a courteous refusal as a failure",
      ],
    },
    nextNodeId: "cp-margaret",
  },

  {
    id: "cp-margaret",
    type: "CHECKPOINT",
    label: "Doorstep 1 complete",
    visible: false,
    marksCompletionOf: OBJ_REASSURE,
    unlocks: [],
    nextNodeId: "n-scene-dean",
  },

  // ─── CONVERSATION 2: THE HOSTILE CUSTOMER ────────────────────────────────

  {
    id: "n-scene-dean",
    type: "GENERATED",
    label: "Doorstep 2 — already angry",
    beatInstruction:
      "Set up the second visit, late morning, at a different property: invent the street and the job fresh (options: a leak trace needing access to an internal stop tap, a flow check after low-pressure complaints, a meter inspection). The customer is Dean Currie, mid-forties. He has an unresolved billing dispute with the water company and answers the door already angry: arms folded or door half-open, jaw set. He recognises the uniform and starts before the learner can speak. End just before Dean's opening salvo lands.",
    constraints: {
      lengthMin: 90,
      lengthMax: 160,
      mustEndAt: "Dean in the doorway, about to let fly, the learner drawing breath",
      mustNotDo: [
        "make Dean threatening or abusive: he is angry, not dangerous",
        "resolve anything before the conversation starts",
      ],
    },
    nextNodeId: "d-dean",
  },

  {
    id: "d-dean",
    type: "DIALOGUE",
    label: "Dean Currie — already angry",
    actorId: "Dean Currie",
    openingLine:
      "Oh, you're joking. You lot chase me for a bill I've already paid, and now you want to come into my house? You've got some nerve. Go on then, what is it this time?",
    breakthroughCriteria:
      "The learner has de-escalated Dean without either matching his anger or capitulating on procedure: they have stayed level and not defensive; acknowledged his frustration as real without pretending to fix the billing dispute at the door; clearly separated today's job from the billing issue and pointed the dispute to the right channel; explained the purpose and benefit of today's visit plainly; and offered genuine choices (proceed now, rebook, or refuse with the follow-up route explained). If Dean still refuses, the learner accepting the refusal gracefully and stating what happens next also satisfies the breakthrough: a clean withdrawal is a correct outcome. Sarcasm, arguing back, blaming him, or bluffing about consequences must escalate him.",
    maxTurns: 6,
    nextNodeId: "n-out-dean",
    failureNodeId: "n-out-dean",
  },

  {
    id: "n-out-dean",
    type: "GENERATED",
    label: "Doorstep 2 — how it ended",
    beatInstruction:
      "Close the Dean Currie visit, honestly reflecting the conversation. If the learner stayed level, acknowledged the frustration, separated the jobs and offered choices, Dean either grudgingly allows the work ('go on then, ten minutes') or agrees a rebooking, still grumbling but no longer at war. If the learner argued, got defensive, or threatened consequences, Dean shuts the door hard: describe the learner recording a refused visit and the note they leave for the billing team about the unresolved dispute. Either way, end with the learner in the van completing the visit log, and one line acknowledging that doorsteps like these are the job at its hardest.",
    constraints: {
      lengthMin: 80,
      lengthMax: 150,
      mustEndAt: "visit logged, van door shut, morning over",
      mustNotDo: [
        "resolve the billing dispute",
        "invent conduct the learner did not commit",
      ],
    },
    nextNodeId: "cp-dean",
  },

  {
    id: "cp-dean",
    type: "CHECKPOINT",
    label: "Doorstep 2 complete",
    visible: false,
    marksCompletionOf: OBJ_DEESCALATE,
    unlocks: [],
    nextNodeId: "ev-debrief",
  },

  // ─── COACHING ASSESSMENT ─────────────────────────────────────────────────

  {
    id: "ev-debrief",
    type: "EVALUATIVE",
    label: "Coaching review — your two doorsteps",
    rubric: [
      {
        id: "acknowledge-first",
        label: "Acknowledged before answering",
        description:
          "The learner acknowledged the customer's feeling (caution or anger) as legitimate before arguing their own case, in at least one conversation.",
        weight: "major",
      },
      {
        id: "verification-offered",
        label: "Offered verification on the customer's terms",
        description:
          "With Margaret, the learner offered proper identity verification she controls: ID through the window, calling the number on her own bill, the password scheme, or rebooking with a relative present. Dictating a number to call, or relying on charm, does not meet this.",
        weight: "critical",
      },
      {
        id: "stayed-level",
        label: "Stayed level under hostility",
        description:
          "With Dean, the learner kept an even, non-defensive tone: no sarcasm, no arguing back, no matching his energy, no bluffed consequences.",
        weight: "critical",
      },
      {
        id: "choices-not-ultimatums",
        label: "Offered choices, not ultimatums",
        description:
          "The learner gave the customer real options (proceed, verify first, rebook, refuse with follow-up explained) rather than insisting on entry.",
        weight: "major",
      },
      {
        id: "withdraw-ready",
        label: "Treated refusal as a valid outcome",
        description:
          "Where a customer held their refusal, the learner accepted it gracefully and described the follow-up or recording step, rather than pushing past the no.",
        weight: "minor",
      },
    ],
    assessesNodeIds: ["d-margaret", "d-dean"],
    nextNodeId: "n-end",
  },

  {
    id: "n-end",
    type: "ENDPOINT",
    label: "Practice complete",
    endpointId: "ep-practice",
    outcomeLabel: "Practice session complete",
    closingLine:
      "This session is practice, not a certificate. Different residents answer the door every run: come back before your next field rotation and try again.",
    summaryInstruction:
      "Write a short coaching debrief (three to four sentences) addressed directly to the learner about their two doorstep conversations, in the voice of a supportive field mentor. Name one specific thing they said or chose that worked and why it worked, and one concrete thing to try differently next run, quoting or closely paraphrasing their own words where possible. Do not give a score or pass/fail language: this is rehearsal.",
    outcomeCard: {
      shareable: false,
      showChoiceStats: false,
      showDepthStats: false,
      showReadingTime: false,
    },
  },
]

// ─── CONTEXT PACK ────────────────────────────────────────────────────────────

const contextPack: ExperienceContextPack = {
  world: {
    description:
      "Medway Water, a fictional UK water company supplying 1.4 million customers across Kent. The setting is domestic doorsteps on ordinary residential streets: chained doors, bay windows, bins out for collection. The learner is a field operative whose job today requires entry to customers' homes for routine work (stop tap checks, meter inspections, water quality samples).",
    rules:
      "Operatives carry photo ID and show it unprompted. Customers verify by calling the number on their own bill, never a number the caller provides. Vulnerable customers may hold an agreed password. Operatives have no right to force entry for routine work; refused visits are logged with a reason and follow-up route. Bogus-caller crime makes customer suspicion correct behaviour, and operatives are trained to welcome it.",
    atmosphere:
      "Small-scale and human: net curtains, a radio inside, a dog barking two doors down. The stakes are personal rather than operational: a frightened pensioner's front hall, a working man's bad month. Pressure comes from emotion, not sirens.",
  },
  actors: [
    {
      name: "Margaret Hale",
      role: "Resident, 81, lives alone",
      personality:
        "Sharp-minded but frightened. Her son has drilled her about doorstep scams and a neighbour was burgled by a fake gasman last spring. She is not confused and not rude: she is doing exactly what the leaflets told her to do, and she will hold the chain until she is genuinely satisfied. Warms visibly to patience, to being given control, and to anyone who says she is right to check. Pressure, hurry, or being talked over frightens her further and ends the conversation.",
      speech:
        "Careful, polite, slightly formal. Short questions through the gap in the door. Repeats her son's advice like a shield: 'My son says...'. When reassured, her sentences lengthen and she mentions the kettle.",
      knowledge:
        "Knows what her son and the crime-prevention leaflets have told her: real callers show ID, real companies let you phone to check, never let anyone hurry you. Knows nothing about water operations. May or may not remember whether she has a password set up: if asked, she has one.",
      relationshipToProtagonist:
        "A stranger claiming to be from the water company: exactly what she has been warned about. Every word the learner says either confirms the warning or earns her trust.",
      voice: {
        vendorVoiceId: "pFZP5JQG7iQjIQuC4Bku", // "Lily" — British female, warm
        pace: "measured",
        notes: "Elderly, careful, guarded through the chain; softens and slows further when trust is earned",
      },
    },
    {
      name: "Dean Currie",
      role: "Resident, mid-forties, unresolved billing dispute",
      personality:
        "Not a bad man: a fed-up one. Three months of disputed bills, two phone calls that went nowhere, and now the same company is on his doorstep wanting access. His anger is real but it is aimed at the company, not the person, and he can tell the difference if the person in front of him stays calm and treats his complaint as real. Defensiveness, corporate speak, or any hint of threat confirms everything he already believes. Genuine acknowledgement plus a clear separation of today's job from the billing fight takes the wind out of him faster than he expects.",
      speech:
        "Fast, loud at first, rhetorical questions, 'you lot'. Interrupts early. As he de-escalates the volume drops before the vocabulary does: still gruff, but listening. If handled well he ends conversations with grudging practicality: 'Ten minutes, then.'",
      knowledge:
        "His own billing saga in precise, rehearsed detail. Roughly what today's visit is for once told. Nothing about the learner personally, and somewhere he knows that too.",
      relationshipToProtagonist:
        "The company made flesh, until the learner proves otherwise. The first employee who has stood still and listened to him in three months, if they manage it.",
      voice: {
        vendorVoiceId: "JBFqnCBsd6RMkjVDRZzb", // "George" — British male, warm gravel
        pace: "rapid",
        notes: "Opens hot and fast; volume falls as he is de-escalated, ending gruff but civil",
      },
    },
  ],
  protagonist: {
    perspective: "you",
    role: "Field operative, Medway Water: carded, uniformed, with a morning list of domestic visits requiring entry.",
    knowledge:
      "Trained on the ID and password procedures and the rights-of-entry rules from the briefings. Competent at the technical work behind the door. The doorstep itself, a frightened or furious human being, is what this session exists to practise.",
    goal:
      "Get legitimate work done with the customer's genuine consent: reassure the frightened, de-escalate the angry, and when the answer stays no, withdraw well and record properly.",
  },
  style: {
    tone:
      "Close, human realism. Two people either side of a threshold. The drama is entirely in the words chosen; no operational stakes beyond this doorstep.",
    language: "en-GB",
    register: "professional",
    targetLength: { min: 90, max: 160 },
    styleNotes:
      "Second person, present tense. Domestic detail in small touches, never laid on thick. Margaret's fear and Dean's anger are treated with dignity: neither is a caricature. The learner's own conduct is never narrated for them; scenes end where their words must begin.",
  },
  groundTruth: [
    {
      label: "Identity verification and the password scheme",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Doorstep procedure: operatives show photo ID unprompted, through a window or letterbox if the customer prefers. Customers are encouraged to keep the door closed and verify by phoning the customer services number printed on their own bill; an operative must never dictate a number to call. Vulnerable customers may register a password that callers must be asked for and state correctly. Rebooking a visit, including to a time when a relative can be present, is always available and costs the customer nothing. Bogus callers posing as water company staff are an established doorstep crime pattern targeting older residents; customer suspicion is correct behaviour and operatives are trained to welcome and never resent it.",
    },
    {
      label: "Rights of entry and refusal handling",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "For routine visits (meter inspections, internal stop tap checks, sampling) the operative has no right to force entry and never attempts to enter uninvited, block a closing door, or threaten consequences. If entry is refused: explain the follow-up route calmly, thank the customer, leave, and log the visit as refused with the reason recorded promptly. Formal entry powers involve written notice and in rare cases a warrant, handled by the company centrally, never argued on a doorstep. A courteously handled refusal is a correct outcome and is recorded as such.",
    },
    {
      label: "De-escalation principles",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Open with purpose in plain language before paperwork. Acknowledge the customer's feeling as legitimate before answering it. Offer choices rather than ultimatums so the customer keeps control. For fear: slow down, lower stimulation, give time and verification routes. For anger: stay level, keep sentences short, do not defend the company or match energy, separate today's task from the grievance and route the grievance to the correct channel. Watch for vulnerability signals (confusion, distress, password requests) and respond with extra care, involving customer services where needed.",
    },
  ],
  scripts: [
    {
      label: "The learner's conduct is the exercise",
      priority: "must",
      trigger: "always",
      instruction:
        "Narration never performs the learner's people-skills for them: scenes stop where the learner must speak, and outcomes honestly reflect what the learner actually said. Characters respond to the learner's real words, not to an assumed script.",
    },
    {
      label: "Refusal is a valid ending",
      priority: "must",
      trigger: "always",
      instruction:
        "A customer who holds their refusal after being offered the correct routes is not a failure state. Treat a graceful withdrawal with proper recording as a successful outcome and reflect that in generated scenes.",
    },
  ],
  learningObjectives: [OBJ_THEORY, OBJ_REASSURE, OBJ_DEESCALATE],
  useCaseCategory: "practice_rehearsal",
}

// ─── SHAPE ───────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 2,
  totalDepthMax: 4,
  endpointCount: 1,
  endpoints: [
    {
      id: "ep-practice",
      label: "Practice session complete",
      minChoicesToReach: 0,
      maxChoicesToReach: 2,
      narrativeWeight: "earned",
      emotionalTarget:
        "The feeling of leaving a good training session: specific things to keep, one thing to try next time, and the itch to have another go",
    },
  ],
  loadBearingChoices: [],
  convergencePoints: [],
  pacingModel: "competency_build",
  mandatoryNodeIds: ["n-intro", "n-theory-rights", "n-theory-craft", "d-margaret", "d-dean", "ev-debrief"],
  displaySteps: 10,
}

// ─── SEED ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding The Doorstep: Refusal-of-Entry Practice (ID ...0090)…")

  const org = await db.org.findUnique({ where: { id: ORG_ID } })
  if (!org) {
    throw new Error(
      "Gold Tap org not found — run `npx tsx prisma/seed-goldtap.ts` first (it owns the org, users and tiers)."
    )
  }

  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    update: {
      title: "The Doorstep: Refusal-of-Entry Practice",
      slug: "goldtap-doorstep-practice",
      description:
        "Practise the hardest doorstep conversations with customers who never say the same thing twice.",
      genre: "training",
      type: "l_and_d",
      renderingTheme: "training",
      orgId: ORG_ID,
      nodes: nodes as object[],
      segments: [],
      useCasePack: USE_CASE_PACKS.l_and_d as object,
      contextPack: contextPack as object,
      shape: shape as object,
      status: "published",
      publishedAt: new Date(),
    },
    create: {
      id: EXPERIENCE_ID,
      authorId: AUTHOR_ID,
      orgId: ORG_ID,
      title: "The Doorstep: Refusal-of-Entry Practice",
      slug: "goldtap-doorstep-practice",
      description:
        "Practise the hardest doorstep conversations with customers who never say the same thing twice.",
      genre: "training",
      status: "published",
      publishedAt: new Date(),
      type: "l_and_d",
      renderingTheme: "training",
      useCasePack: USE_CASE_PACKS.l_and_d as object,
      contextPack: contextPack as object,
      shape: shape as object,
      nodes: nodes as object[],
      segments: [],
    },
  })

  console.log("  ✓ Experience seeded (org: Gold Tap Training)")
  console.log("    Title:  The Doorstep: Refusal-of-Entry Practice")
  console.log("    Nodes:  12 (3 FIXED, 4 GENERATED, 2 DIALOGUE, 3 CHECKPOINT via 1 EVALUATIVE + 1 ENDPOINT)")
  console.log("    Kind:   practice_rehearsal — formative, no pass mark")
  console.log("    Play:   /scenario/goldtap-doorstep-practice")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
