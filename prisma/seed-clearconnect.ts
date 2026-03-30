import { PrismaClient } from "@prisma/client"
import type {
  Node,
  ExperienceContextPack,
  ShapeDefinition,
} from "../types/experience"
import { USE_CASE_PACKS } from "../lib/engine/usecases"

const db = new PrismaClient()

// ─── IDs ─────────────────────────────────────────────────────────────────────

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000030"
const ORG_ID = "00000000-0000-0000-0000-000000000100"

// ─── NODE GRAPH — "The First Call" ───────────────────────────────────────────
//
// Training course: ClearConnect call centre — customer complaint handling
// Demonstrates DIALOGUE + EVALUATIVE node types
//
// Structure:
//
//   n1 (FIXED: intro — first day on live calls, Sarah briefs the learner)
//     → n2 (GENERATED: call queue fires — Mike Preston's account on screen)
//       → q1 (CHOICE: how do you prepare before connecting? training feedback)
//         → n3 (GENERATED: call connects — Mike is frustrated, explains the problem)
//           → d1 (DIALOGUE: live call with Mike, max 5 turns)
//             breakthrough → n4a (GENERATED: call resolved, Mike agrees to refund)
//             max turns    → n4b (GENERATED: call escalated, Sarah takes over)
//             Both → q2 (CHOICE: wrap-up actions — training feedback)
//               → n5 (GENERATED: end of shift, Sarah's debrief)
//                 → ev1 (EVALUATIVE: assesses n2, n3, n4a/n4b, n5 scaffold context)
//                   → ep1 (ENDPOINT: First Shift Complete)

const nodes: Node[] = [

  // ─── OPENING ───────────────────────────────────────────────────────────────

  {
    id: "n1",
    type: "FIXED",
    label: "Opening — First day on live calls",
    content:
      "8:47 am. You log into your workstation at ClearConnect's Salford contact centre.\n\nThe open-plan floor is already at full capacity — two hundred agents, the ambient hum of conversations, call queue numbers ticking in the top corner of every screen. You've done two weeks of classroom training and five days of supervised calls. Today is your first unsupported shift.\n\nSarah Chen, your team leader, spins her chair to face you as you sit down. She's been doing this for six years and has a way of giving advice that sounds like observation.\n\n\"Billing complaints today,\" she says, nodding at your screen. \"Queue's already building. One thing — Mike Preston, account 4471-B, has been waiting twelve days for a refund. He's called three times. If he comes through to you, take a breath before you pick up. You want to know his situation before you say hello.\"\n\nShe turns back to her own screen. Your call queue goes from zero to one.",
    mandatory: true,
    nextNodeId: "n2",
  },

  // ─── CALL QUEUE ────────────────────────────────────────────────────────────

  {
    id: "n2",
    type: "GENERATED",
    label: "Call queue — Mike Preston's account",
    beatInstruction:
      "The learner is at their workstation looking at the call queue dashboard. A new incoming call has appeared at the top of the queue — the caller is Mike Preston, account number 4471-B. The CRM panel alongside the call queue shows: account status — active, 7 years as a ClearConnect customer, broadband + phone bundle at £49/month. Open complaint — billing error, £120 overcharged on March invoice. Contact history: email sent 14 March (no reply sent), live chat 18 March (status set to 'under investigation'), inbound call 22 March (agent noted 'referred to billing team'). Today is 26 March. The call is ringing. The learner needs to decide how to handle it before they connect.",
    constraints: {
      lengthMin: 100,
      lengthMax: 180,
      mustEndAt:
        "the call ringing, the CRM information visible on screen, the learner at the moment of decision",
      mustNotDo: [
        "tell the learner what to do",
        "resolve the situation before they act",
        "introduce Mike speaking yet — he's still ringing",
      ],
    },
    nextNodeId: "q1",
  },

  // ─── Q1: CALL PREPARATION ──────────────────────────────────────────────────

  {
    id: "q1",
    type: "CHOICE",
    label: "Q1 — How do you prepare before connecting?",
    responseType: "closed",
    options: [
      {
        id: "q1-a",
        label:
          "Take 30 seconds to read through the account history and open complaint notes, then connect",
        nextNodeId: "n3",
        isLoadBearing: true,
        stateChanges: { q1_correct: true },
        trainingFeedback:
          "Reviewing account history before connecting is one of the simplest habits that separates confident agents from hesitant ones. When you pick up the call already knowing Mike's name, the amount, and how long he's been waiting, you start from a position of credibility — not catch-up.",
        feedbackTone: "positive",
        competencySignal: "Call Preparation",
      },
      {
        id: "q1-b",
        label:
          "Connect immediately — customers expect a fast pick-up, and you can pull up the account while he's talking",
        nextNodeId: "n3",
        isLoadBearing: false,
        stateChanges: { q1_correct: false },
        trainingFeedback:
          "Accepting a call before reviewing the account puts you on the back foot from the first second. Customers who are already frustrated can hear when you're finding information they expect you to already have — it signals that ClearConnect hasn't prepared, and it erodes trust before you've said anything useful.",
        feedbackTone: "developmental",
        competencySignal: "Call Preparation",
      },
    ],
  },

  // ─── CALL CONNECTS ─────────────────────────────────────────────────────────

  {
    id: "n3",
    type: "GENERATED",
    label: "Call connects — Mike explains the problem",
    beatInstruction:
      "The call connects. Mike Preston is a man in his mid-fifties — his voice has the controlled, careful quality of someone who has been keeping their patience across multiple interactions and is now nearly at the end of it. He doesn't shout. He explains methodically: he was charged £120 on his March invoice that shouldn't be there — he checked his tariff, his usage, his contract, and there is no basis for the charge. He emailed. No reply. He used live chat — was told it was 'under investigation'. He called three weeks ago and was told someone from billing would call him back. Nobody called. Now here he is again. He ends with a direct question: 'Can someone actually sort this out today, or am I going to have to go to Ofcom?' There is a pause. He's waiting.",
    constraints: {
      lengthMin: 110,
      lengthMax: 200,
      mustEndAt:
        "Mike waiting in silence after his question, the agent needing to respond",
      mustNotDo: [
        "suggest what the right response is",
        "have the agent speak yet — this is Mike's moment to be heard",
        "make Mike aggressive or abusive — he is frustrated, controlled, and reasonable",
      ],
      mustInclude: [
        "the twelve-day wait",
        "the three previous contacts",
        "the £120 amount",
      ],
    },
    nextNodeId: "d1",
  },

  // ─── DIALOGUE: LIVE CALL WITH MIKE ────────────────────────────────────────

  {
    id: "d1",
    type: "DIALOGUE",
    label: "Live call — Mike Preston",
    actorId: "Mike Preston",
    openingLine:
      "Look, I've been waiting twelve days for this refund. Twelve days. I've spoken to you people three times and I keep getting told it's being dealt with. I just want my hundred and twenty pounds back. Can someone actually sort this out today, or is that too much to ask?",
    breakthroughCriteria:
      "The agent has clearly acknowledged the billing error as ClearConnect's fault — not hedged, not vague — has genuinely empathised with Mike's frustration at the twelve-day wait, and has offered a specific, concrete resolution: a full refund of £120 to his account with a clear stated timeframe. Mike feels heard and has something real to hold onto.",
    maxTurns: 5,
    nextNodeId: "n4a",
    failureNodeId: "n4b",
  },

  // ─── POST-CALL: BREAKTHROUGH PATH ─────────────────────────────────────────

  {
    id: "n4a",
    type: "GENERATED",
    label: "Call resolved — Mike accepts the refund commitment",
    beatInstruction:
      "The call has ended positively. Mike Preston, though still not pleased about the error occurring in the first place, is satisfied — the agent acknowledged the mistake clearly, apologised without being defensive, and committed to a full £120 refund within a specific timeframe. His last words were something like 'right, fine, as long as it actually happens this time.' The line went quiet. The after-call work screen has appeared — a 5-minute window to complete wrap-up before the next call connects. Sarah Chen, two desks away, caught the tone of the call and gives a brief professional nod in the learner's direction. It wasn't effusive praise — just acknowledgement. The refund has been entered as a priority action in the CRM. The wrap-up form is open. Mike is waiting for the outcome.",
    constraints: {
      lengthMin: 110,
      lengthMax: 200,
      mustEndAt:
        "after-call work screen active, Sarah's acknowledgement given, wrap-up form open",
      mustNotDo: [
        "over-praise the agent — keep it proportionate and professional",
        "say what the wrap-up notes should contain — that comes in the next choice",
      ],
    },
    nextNodeId: "q2",
  },

  // ─── POST-CALL: ESCALATION PATH ────────────────────────────────────────────

  {
    id: "n4b",
    type: "GENERATED",
    label: "Call escalated — Sarah takes over",
    beatInstruction:
      "Despite the agent's efforts, the call reached a point where Mike demanded to speak to a supervisor. His frustration peaked when the conversation circled without producing a concrete commitment — he'd heard 'I'll look into that' and 'let me check' from three agents already, and when the same pattern began to emerge again, he said flatly: 'Just put me through to someone who can actually make a decision.' Sarah picked up the handover call, apologised directly, confirmed the £120 refund within 48 hours, and added a £25 goodwill credit. The call ended in under three minutes. Sarah returns to the agent's desk, professional and unhurried — not angry, not embarrassed on their behalf. She pulls a chair up. 'Let's talk about what happened.' The call recording is still on screen. The after-call work timer has already lapsed — Sarah has paused the queue for the agent.",
    constraints: {
      lengthMin: 120,
      lengthMax: 210,
      mustEndAt:
        "Sarah seated at the agent's desk, call recording visible, a coaching conversation about to begin",
      mustNotDo: [
        "be punitive — Sarah is coaching, not disciplining",
        "imply the agent has failed permanently — this is a first-week learning moment",
        "resolve the coaching conversation — end at the start of it",
      ],
    },
    nextNodeId: "q2",
  },

  // ─── Q2: CALL WRAP-UP ──────────────────────────────────────────────────────

  {
    id: "q2",
    type: "CHOICE",
    label: "Q2 — Call wrap-up: what do you do now?",
    responseType: "closed",
    options: [
      {
        id: "q2-a",
        label:
          "Write full call notes (issue, resolution, refund reference, timeline committed), then send Mike a brief email confirmation of the refund and timeframe",
        nextNodeId: "n5",
        isLoadBearing: true,
        stateChanges: { q2_correct: true },
        trainingFeedback:
          "Complete wrap-up with written confirmation is what turns a verbal commitment into an accountable resolution. When Mike receives that email, he has something to quote if the refund doesn't arrive. It protects him and it protects ClearConnect. Agents who send wrap-up confirmations see their repeat contact rate drop significantly.",
        feedbackTone: "positive",
        competencySignal: "Call Wrap-Up",
      },
      {
        id: "q2-b",
        label:
          "Log a brief note and mark the ticket resolved — the refund is already in motion and you're falling behind on queue",
        nextNodeId: "n5",
        isLoadBearing: false,
        stateChanges: { q2_correct: false },
        trainingFeedback:
          "A verbal promise without written confirmation has no reference point. If the refund is delayed by even a day, Mike will call back — and the next agent will have no record of what was committed. Incomplete wrap-up is the single biggest driver of repeat contacts at ClearConnect, and every repeat contact costs three times the operational overhead of a properly closed first contact.",
        feedbackTone: "developmental",
        competencySignal: "Call Wrap-Up",
      },
    ],
  },

  // ─── END OF SHIFT ──────────────────────────────────────────────────────────

  {
    id: "n5",
    type: "GENERATED",
    label: "End of first shift — Sarah's debrief",
    beatInstruction:
      "It's 17:15 — the learner's first unsupported shift is over. Sarah has reviewed the call recordings and CRM notes from the day. She's running a ten-minute end-of-shift check-in at the learner's desk — not a formal review, just a team leader being present for someone's first live day. Reference the Mike Preston call specifically — acknowledge what went well in terms of tone or preparation (or note what to work on if the call escalated). Reference the wrap-up quality from Q2 — whether the notes were complete and whether the confirmation email went out. Sarah identifies one clear thing to focus on for tomorrow. She ends with something practical and forward-looking — not reassuring fluff, just useful direction. End with the learner logging off, the evening shift queue already populating on the adjacent screen.",
    constraints: {
      lengthMin: 110,
      lengthMax: 200,
      mustEndAt:
        "learner logging off, evening queue visible, a clear development point to take into tomorrow",
      mustNotDo: [
        "give generic feedback — reference the specific decisions made during the module",
        "be either unrealistically positive or unnecessarily harsh",
      ],
    },
    nextNodeId: "ev1",
  },

  // ─── EVALUATIVE ────────────────────────────────────────────────────────────

  {
    id: "ev1",
    type: "EVALUATIVE",
    label: "Performance assessment — call handling rubric",
    rubric: [
      {
        id: "empathy-demonstration",
        label: "Empathy and rapport",
        description:
          "Agent acknowledged the customer's frustration clearly and made them feel heard before moving to resolution — did not jump straight to fixing without first validating the experience.",
        weight: "major",
      },
      {
        id: "resolution-specificity",
        label: "Resolution clarity",
        description:
          "Agent offered a specific, accountable resolution — the exact refund amount, a realistic and committed timeframe, and a reference number. Did not use vague language like 'we will look into it'.",
        weight: "critical",
      },
      {
        id: "wrap-up-protocol",
        label: "Call wrap-up and documentation",
        description:
          "Agent completed call wrap-up correctly: full CRM notes including issue, resolution, and timeline; refund reference number generated and communicated; follow-up confirmation sent to customer.",
        weight: "major",
      },
      {
        id: "professional-composure",
        label: "Professional composure under pressure",
        description:
          "Agent maintained a calm, professional tone throughout — did not become defensive, dismissive, or reactive when faced with the customer's frustration.",
        weight: "minor",
      },
    ],
    assessesNodeIds: ["n2", "n3", "n4a", "n4b", "n5"],
    nextNodeId: "ep1",
  },

  // ─── ENDPOINT ──────────────────────────────────────────────────────────────

  {
    id: "ep1",
    type: "ENDPOINT",
    label: "Endpoint — First Shift Complete",
    endpointId: "ep-first-shift",
    outcomeLabel: "First Shift Complete",
    closingLine:
      "Every agent has a first shift. The ones who get good at this job are the ones who stay curious about why calls go the way they do.",
    summaryInstruction:
      "Write two sentences summarising the agent's performance across their first live shift: reference their approach to call preparation (from the call queue decision), how they handled the live complaint call with Mike Preston, and the quality of their wrap-up actions. Identify one clear strength and one specific area to develop. Coaching tone — direct, honest, and forward-looking.",
    outcomeCard: {
      shareable: false,
      showChoiceStats: true,
      showDepthStats: false,
      showReadingTime: true,
    },
  },
]

// ─── CONTEXT PACK ─────────────────────────────────────────────────────────────

const contextPack: ExperienceContextPack = {
  world: {
    description:
      "ClearConnect's Salford customer service centre — a 200-seat contact centre handling billing, technical support, and complaint resolution for a UK broadband and phone provider with 2.3 million subscribers. The learner is a new call centre agent, one week post-training, on their first unsupported shift handling live billing complaints.",
    rules:
      "ClearConnect call handling standards: (1) All billing disputes must be acknowledged within the first 60 seconds of a call. (2) Refunds over £50 require a CRM reference number generated before the call ends — do not end a call without one. (3) Call wrap-up notes must include: issue code, resolution code, reference number, and a plain-language summary of the agreed resolution. (4) Any commitment made to a customer during a call is binding — failure to honour a committed timeline triggers an automatic Ofcom complaint under ADR rules. (5) ClearConnect First Call Resolution target: 78%. Repeat contact rate target: below 18%. Average handle time target: 6.5 minutes.",
    atmosphere:
      "Professional, busy, performance-measured. The pressure is ambient — queue numbers ticking in the corner, the low hum of neighbouring calls, CSAT scores visible on the wall display. Not hostile, but never relaxed. Competence here is built through consistent small decisions: preparation, empathy, specificity, and follow-through.",
  },
  actors: [
    {
      name: "Mike Preston",
      role: "ClearConnect customer — billing complaint",
      personality:
        "A man in his mid-fifties who has been a ClearConnect customer for seven years. He is not aggressive, but he has been patient for twelve days across three contacts and is now at the end of it. He responds well to directness and concrete information. He does not respond to vague reassurances — he's heard them twice already.",
      speech:
        "Measured and controlled. Not shouting — just unambiguously clear about what he wants and what he's already been through. Gets more frustrated when he hears hedging. Gets calmer when he hears accountability.",
      knowledge:
        "He knows the amount (£120), the date the charge appeared, and that three previous contacts have produced nothing. He does not know the internal reason for the charge — he just knows it shouldn't be there.",
      relationshipToProtagonist:
        "A frustrated customer who wants resolution. He will respond to genuine empathy and specificity — he is not trying to be difficult, he is trying to get a problem fixed.",
    },
    {
      name: "Sarah Chen",
      role: "Team leader, ClearConnect Salford",
      personality:
        "Six years at ClearConnect, now responsible for onboarding new agents. Professional and direct — she gives feedback as a matter of course, not as a big moment. She is invested in developing good agents and does not conflate a difficult call with a failing agent.",
      speech:
        "Economical and precise. She doesn't over-explain. When she corrects, she names what happened specifically and says what to do differently — she doesn't diagnose the agent's feelings.",
      knowledge:
        "Full working knowledge of ClearConnect systems, Ofcom rules, call handling best practice, and what makes the difference between agents who develop quickly and those who plateau.",
      relationshipToProtagonist:
        "Team leader and first-week mentor. She is present but not hovering. She steps in when it's necessary and debrief constructively afterwards.",
    },
  ],
  protagonist: {
    perspective: "you",
    role: "New call centre agent at ClearConnect, Salford. One week post-training. First unsupported shift on live billing complaints.",
    knowledge:
      "Competent with the CRM system and the basics of call handling procedure. Still developing instincts for de-escalation and managing conversations where the customer is already frustrated before you pick up.",
    goal: "Handle the complaint call professionally, resolve Mike's issue without escalating, and complete the call wrap-up correctly.",
  },
  style: {
    tone:
      "Professional, grounded, realistic. The pressure in a call centre is real but not dramatic — it's measured in queue numbers and CSAT scores, not crises. The stakes for each call are genuine but proportionate.",
    language: "en-GB",
    register: "professional",
    targetLength: { min: 100, max: 200 },
    styleNotes:
      "Use specific call centre language where it fits: CRM, FCR, after-call work, wrap-up, handle time, CSAT. Second person throughout. Present tense. Reference Mike Preston by name — he is a specific person with a specific situation, not a generic 'customer'. When Sarah gives feedback, make it behavioural and specific, not evaluative ('here's what to do differently' not 'that was disappointing').",
  },
  groundTruth: [
    {
      label: "ClearConnect billing and refund policy",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Billing error refunds: all confirmed billing errors must be refunded within 5 working days. Refunds over £50 require a CRM reference number before the call ends — this reference must be verbally communicated to the customer and included in the follow-up confirmation email within 2 hours of the call closing. If an agent commits to a refund timeline on a call, that commitment is binding and logged against their performance record. Goodwill credits (typically £10–£25) may be offered at team leader discretion for delays over 10 working days or for three or more repeat contacts on the same issue.",
    },
    {
      label: "Ofcom and ADR obligations",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Under Ofcom's General Conditions, ClearConnect must handle unresolved complaints within 8 weeks before a customer can escalate to the Alternative Dispute Resolution (ADR) scheme (Communications Ombudsman). Verbal commitments made by agents during calls are considered binding under consumer contract law if the customer can reasonably demonstrate they relied on them. Agents must not make commitments they cannot guarantee — if unsure of a timeline, escalate to team leader rather than give a date that may not be met.",
    },
    {
      label: "Call handling performance standards",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "should_include",
      content:
        "ClearConnect KPI targets: First Call Resolution (FCR) 78% — a call is FCR if the customer does not contact us again within 14 days on the same issue. Average Handle Time (AHT) 6.5 minutes. Customer Satisfaction Score (CSAT) 4.2/5.0, measured by post-call SMS survey. Repeat contact rate below 18%. The primary driver of repeat contacts is incomplete wrap-up — specifically: verbal commitments without CRM reference numbers, and no follow-up confirmation email sent. The secondary driver is unresolved empathy — customers who felt unheard during the call, even if the issue was technically resolved.",
    },
  ],
  scripts: [
    {
      label: "Empathy before resolution",
      priority: "must",
      trigger: "always",
      instruction:
        "Every customer interaction in this module must demonstrate the principle that empathy comes before resolution. Do not allow generated content to move to fixing the problem before the agent has acknowledged what it felt like to have the problem. This is not soft — it is operationally effective: customers who feel unheard call back even after the issue is resolved.",
    },
    {
      label: "Specific over vague",
      priority: "must",
      trigger: "always",
      instruction:
        "Never allow generated content to contain vague commitments: 'we will look into it', 'someone will be in touch', 'it should be sorted soon'. Every resolution in this module must be specific: the amount, the method, the timeframe. Vague commitments are the root cause of the failure states in this module.",
    },
    {
      label: "FCR framing for consequences",
      priority: "should",
      trigger: "always",
      instruction:
        "When showing outcomes — good or bad — frame them in terms of first call resolution and what happens next for the customer. A good outcome is Mike not needing to call again. A bad outcome is Mike calling back, or escalating to Ofcom. Ground consequences in these operational realities, not abstract 'customer satisfaction'.",
    },
  ],
  learningObjectives: [
    "Prepare for each call by reviewing account history before connecting",
    "Acknowledge customer frustration empathetically before moving to resolution",
    "Offer specific, accountable resolutions with a committed timeframe",
    "Complete call wrap-up to the required standard: notes, reference, confirmation email",
  ],
}

// ─── SHAPE ────────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 2,
  totalDepthMax: 2,
  endpointCount: 1,
  endpoints: [
    {
      id: "ep-first-shift",
      label: "First Shift Complete",
      minChoicesToReach: 2,
      maxChoicesToReach: 2,
      narrativeWeight: "bittersweet",
      emotionalTarget:
        "Honest reflection on a genuine first test — specific feedback, a clear development area, and a forward-looking close",
    },
  ],
  loadBearingChoices: [1, 2],
  convergencePoints: [2],
  pacingModel: "competency_build",
  mandatoryNodeIds: ["n1"],
}

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding ClearConnect complaint handling training experience…")

  await db.org.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: "ClearConnect",
      slug: "clearconnect",
      trainingTier: "training_pilot",
      isOperator: false,
    },
  })
  console.log("  ✓ Org seeded (ClearConnect)")

  await db.user.upsert({
    where: { id: AUTHOR_ID },
    update: {},
    create: {
      id: AUTHOR_ID,
      email: "dev@pageengine.local",
      name: "Dev Author",
      orgId: ORG_ID,
      orgRole: "owner",
    },
  })
  console.log("  ✓ User seeded")

  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    update: {
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
      title: "The First Call: Handling Customer Complaints",
      slug: "clearconnect-complaint-handling",
      description:
        "Your first unsupported shift at ClearConnect. A frustrated customer, a twelve-day billing error, and five turns to sort it out — live on the phone. Demonstrates DIALOGUE and EVALUATIVE node types.",
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

  console.log("  ✓ Experience seeded")
  console.log("    Title:  The First Call: Handling Customer Complaints")
  console.log("    Type:   l_and_d / renderingTheme: training")
  console.log("    Slug:   clearconnect-complaint-handling")
  console.log("    Nodes:  11")
  console.log("      1× FIXED   — opening brief from Sarah Chen")
  console.log("      4× GENERATED — call queue, call connects, post-call (×2), end of shift")
  console.log("      2× CHOICE  — call preparation (q1), wrap-up actions (q2)")
  console.log("      1× DIALOGUE — live call with Mike Preston (max 5 turns)")
  console.log("      1× EVALUATIVE — 4-criterion rubric (empathy, resolution, wrap-up, composure)")
  console.log("      1× ENDPOINT — First Shift Complete")
  console.log("")
  console.log("    Dialogue breakthrough criteria:")
  console.log("      Empathy demonstrated + specific £120 refund with timeframe offered")
  console.log("    Evaluative rubric:")
  console.log("      [critical] Resolution specificity")
  console.log("      [major]    Empathy and rapport")
  console.log("      [major]    Call wrap-up and documentation")
  console.log("      [minor]    Professional composure under pressure")
  console.log("")
  console.log("  Training player URL:")
  console.log("    http://localhost:3000/scenario/clearconnect-complaint-handling")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
