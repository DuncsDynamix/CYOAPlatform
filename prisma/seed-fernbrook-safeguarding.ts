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
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000060"
const ORG_ID = "00000000-0000-0000-0000-000000000110"

// ─── NODE GRAPH — "The Morning Visit" ────────────────────────────────────────
//
// Training course: Fernbrook Care — recognising and escalating financial abuse
// Demonstrates the competence-evidence pattern: generated indicator variation,
// disclosure DIALOGUE, escalation CHOICE, EVALUATIVE rubric mapped to policy.
//
// Structure:
//
//   n1 (FIXED: intro — morning rota, briefing on Margaret Ellery)
//     → n2 (GENERATED: arrival — indicators of financial abuse planted, unlabelled)
//       → q1 (CHOICE: what do you do with what you've noticed? training feedback)
//         → n3 (GENERATED: during care tasks — Margaret quieter than usual)
//           → d1 (DIALOGUE: conversation with Margaret, max 7 turns)
//             breakthrough → n4a (GENERATED: disclosure made — Margaret asks what happens now)
//             max turns    → n4b (GENERATED: no disclosure — but the signs remain)
//             Both → q2 (CHOICE: escalation decision — training feedback)
//               → n5 (GENERATED: call with Priya, the safeguarding lead)
//                 → ev1 (EVALUATIVE: assesses n2, n3, n4a/n4b, n5 scaffold context)
//                   → ep1 (ENDPOINT: Visit Concluded — competence record)

const nodes: Node[] = [

  // ─── OPENING ───────────────────────────────────────────────────────────────

  {
    id: "n1",
    type: "FIXED",
    label: "Opening — Morning rota, Margaret's visit",
    content:
      "7:50 am. You check the rota on your phone in the car outside your first call of the day.\n\nMargaret Ellery, 84. Personal care and breakfast, forty-five minutes. You've been coming to Margaret three mornings a week for about four months now — long enough to know how she takes her tea and which hip is the bad one. She's sharp, private, proud of managing on her own since her husband died.\n\nThere's a note on the care plan from Dawn, who covered Saturday: \"Margaret's nephew Darren staying over weekends now — says he's helping with shopping and bills. Margaret seemed a bit flat. Nothing specific.\"\n\nNothing specific. You put the phone in your pocket and walk up the path. The curtains are open, which is normal. The milk hasn't been taken in, which isn't.",
    mandatory: true,
    nextNodeId: "n2",
  },

  // ─── ARRIVAL — INDICATORS ──────────────────────────────────────────────────

  {
    id: "n2",
    type: "GENERATED",
    label: "Arrival — something is not right",
    beatInstruction:
      "The carer lets themselves in with the key safe and begins the visit as normal. Weave in THREE concrete, observable indicators consistent with possible financial abuse — vary the specific details each session, drawing from: red-letter or final-demand post left in view; a cash withdrawal receipt or bank letter somewhere it wouldn't normally be; cupboards or fridge unusually bare given that shopping money is supposedly being handled; Margaret's purse or bank card out of its usual place, or missing; a new expensive item of Darren's (trainers, gadget, keys to a different car) in the house; Margaret making a vague comment about needing to 'be careful this month'. The indicators must be shown, never named — do NOT use the words abuse, safeguarding, exploitation, or theft. Margaret herself is up, dressed, polite, but subdued — noticeably quieter than her normal self. She deflects any direct attention onto small talk. End with the carer clocking the third indicator and having a private moment of unease.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt:
        "the carer's private moment of unease, before they have said or decided anything",
      mustNotDo: [
        "name or label what the indicators might mean",
        "have Margaret disclose anything yet",
        "have Darren present in the house during this visit",
        "make the indicators cartoonishly obvious — they should be the kind of thing a rushed carer could miss",
      ],
      mustInclude: [
        "three distinct observable indicators",
        "Margaret being quieter than usual",
      ],
    },
    nextNodeId: "q1",
  },

  // ─── Q1: WHAT DO YOU DO WITH WHAT YOU'VE NOTICED? ─────────────────────────

  {
    id: "q1",
    type: "CHOICE",
    label: "Q1 — What do you do with what you've noticed?",
    responseType: "closed",
    prompt:
      "The visit clock is running. What you've seen might be nothing — or might not. What do you do?",
    options: [
      {
        id: "q1-a",
        label:
          "Carry on with the visit as normal, keep noticing, and look for a natural moment to check in with Margaret gently",
        nextNodeId: "n3",
        isLoadBearing: true,
        stateChanges: { q1_correct: true },
        trainingFeedback:
          "This is the professional response: stay observant, protect the relationship, and create space for Margaret to talk rather than putting her on the spot. Indicators are not conclusions — your job at this stage is to notice accurately and keep the door open, not to investigate.",
        feedbackTone: "positive",
        competencySignal: "Recognition of Indicators",
      },
      {
        id: "q1-b",
        label:
          "Ask Margaret directly about the letters and the money — better to get it out in the open straight away",
        nextNodeId: "n3",
        isLoadBearing: false,
        stateChanges: { q1_correct: false },
        trainingFeedback:
          "Direct challenge this early usually closes the conversation down. Margaret is a private, proud person — confronted with her own post, she is most likely to feel accused or humiliated, and you may lose the trust that would have let her tell you in her own time. Gentle, open conversation comes before direct questions.",
        feedbackTone: "developmental",
        competencySignal: "Recognition of Indicators",
      },
      {
        id: "q1-c",
        label:
          "Put it out of your mind — you're a carer, not an investigator, and there's a schedule to keep",
        nextNodeId: "n3",
        isLoadBearing: false,
        stateChanges: { q1_correct: false },
        trainingFeedback:
          "Care workers are the eyes of the safeguarding system — you see what no social worker, GP or family member sees. 'Not my job' is how financial abuse continues for months. You don't have to investigate anything, but you do have a duty to notice, and to act on what you notice before the end of today.",
        feedbackTone: "developmental",
        competencySignal: "Recognition of Indicators",
      },
    ],
  },

  // ─── DURING CARE — THE OPENING ─────────────────────────────────────────────

  {
    id: "n3",
    type: "GENERATED",
    label: "During care — Margaret is not herself",
    beatInstruction:
      "The carer helps Margaret with her morning routine and makes breakfast. The ordinary intimacy of personal care — familiar, unhurried, dignified. Margaret talks a little, but keeps circling back to safe topics and going quiet in between. At one natural moment — over tea at the kitchen table works well — she almost says something: a half-started sentence about Darren, or about the post, or about money, that she abandons ('Oh — it doesn't matter'). The moment sits there. She is not distressed; she is weighing something. End at the exact point where the carer could either let it go or gently pick it up.",
    constraints: {
      lengthMin: 120,
      lengthMax: 200,
      mustEndAt:
        "Margaret's abandoned half-sentence hanging in the air, the carer deciding whether to pick it up",
      mustNotDo: [
        "have Margaret disclose anything concrete yet",
        "have the carer speak the pivotal question — that belongs to the dialogue",
        "make Margaret tearful or frightened — she is composed, private, and weighing trust",
      ],
    },
    nextNodeId: "d1",
  },

  // ─── DIALOGUE: MARGARET ────────────────────────────────────────────────────

  {
    id: "d1",
    type: "DIALOGUE",
    label: "Conversation — Margaret at the kitchen table",
    actorId: "Margaret Ellery",
    openingLine:
      "Oh, don't mind me, love. I'm just tired. Darren was here till Sunday night — he's been marvellous, really, doing all my bits at the bank now so I don't have to stand in the queue. It's just… no, it's silly. Drink your tea before it goes cold.",
    breakthroughCriteria:
      "The carer has used open, unhurried, non-leading questions and genuine listening, and Margaret has voiced — in her own words — a specific worry about her money or about Darren's use of her card, PIN, or pension. Additionally, the carer has NOT promised to keep it secret: if Margaret asked them not to tell anyone, the carer gently and honestly explained that they cannot promise that, and who they would need to tell and why, while reassuring her that nothing will happen behind her back. Margaret remains calm and does not feel accused, managed, or rushed.",
    maxTurns: 7,
    nextNodeId: "n4a",
    failureNodeId: "n4b",
  },

  // ─── POST-DIALOGUE: DISCLOSURE PATH ────────────────────────────────────────

  {
    id: "n4a",
    type: "GENERATED",
    label: "After the disclosure — what happens now",
    beatInstruction:
      "Margaret has said it out loud — her worry about the money and Darren, in whatever words she used. The room feels different: not dramatic, just quieter and more honest. She is composed but anxious about what happens next, and about Darren — she does not want him in trouble, she wants it to stop. Reference what she actually disclosed in the conversation. She asks some version of 'what happens now?' The visit is nearly over; the next call is waiting. The carer must leave with Margaret feeling that telling the truth was safe, while knowing themselves that this cannot wait until next week. End with the carer saying goodbye on the doorstep, the weight of what they now know going with them.",
    constraints: {
      lengthMin: 120,
      lengthMax: 200,
      mustEndAt:
        "the carer on the doorstep, visit over, carrying what they now know",
      mustNotDo: [
        "have the carer promise confidentiality or that 'everything will be fine'",
        "have the carer phone anyone yet — the escalation decision comes next",
        "make Margaret regret the disclosure",
      ],
    },
    nextNodeId: "q2",
  },

  // ─── POST-DIALOGUE: NO DISCLOSURE PATH ─────────────────────────────────────

  {
    id: "n4b",
    type: "GENERATED",
    label: "No disclosure — but the signs remain",
    beatInstruction:
      "The moment passed. Margaret closed the door on the subject — politely, firmly, the way she closes any subject she isn't ready for. Perhaps the carer pushed a little too hard, or not quite warmly enough, or the trust simply wasn't there today. The rest of the visit is ordinary and slightly careful on both sides. But nothing the carer observed has been explained away: the indicators from earlier in the visit are all still true. Reference one or two of them specifically as the carer tidies up and says goodbye. Margaret waves from the window as always. End with the carer at the car, keys in hand, aware that a closed conversation does not close a concern.",
    constraints: {
      lengthMin: 120,
      lengthMax: 200,
      mustEndAt:
        "the carer at the car, aware the concern still stands without a disclosure",
      mustNotDo: [
        "frame the carer as having failed — a non-disclosure is a normal outcome, not an ending",
        "resolve or explain away any of the indicators",
        "have Margaret become upset or the relationship become damaged",
      ],
    },
    nextNodeId: "q2",
  },

  // ─── Q2: ESCALATION DECISION ───────────────────────────────────────────────

  {
    id: "q2",
    type: "CHOICE",
    label: "Q2 — What do you do before your next visit?",
    responseType: "closed",
    prompt:
      "You're in the car. Your next call is in twenty minutes. Whatever you saw and heard this morning — what do you do with it?",
    options: [
      {
        id: "q2-a",
        label:
          "Record exactly what you observed and heard — facts, not conclusions — in the visit notes now, then phone Priya, the safeguarding lead, before your next call",
        nextNodeId: "n5",
        isLoadBearing: true,
        stateChanges: { q2_correct: true },
        trainingFeedback:
          "This is the procedure, and it exists for good reasons. Same-day reporting to the safeguarding lead, in your own words, facts only: what you saw, what was said, in what context. You are not accusing anyone and you are not investigating — you are handing accurate information to the person whose job it is to decide what happens next. This is what 'the eyes of the safeguarding system' means in practice.",
        feedbackTone: "positive",
        competencySignal: "Escalation and Recording",
      },
      {
        id: "q2-b",
        label:
          "Keep a closer eye over the next few visits first — you'll be more use to Margaret with solid evidence than with a hunch",
        nextNodeId: "n5",
        isLoadBearing: false,
        stateChanges: { q2_correct: false },
        trainingFeedback:
          "Waiting to gather evidence feels responsible but it is the single most common way concerns die. Evidence-gathering is not your role — assessment belongs to the safeguarding lead and, if needed, the local authority. Every week of watching is another pension payment, and if harm continues during a period when you had a concern and sat on it, that is a failure of duty, not diligence.",
        feedbackTone: "developmental",
        competencySignal: "Escalation and Recording",
      },
      {
        id: "q2-c",
        label:
          "Have a quiet word with Darren at the weekend — man to man, no drama, before turning it into something official",
        nextNodeId: "n5",
        isLoadBearing: false,
        stateChanges: { q2_correct: false },
        trainingFeedback:
          "Never approach the person a concern relates to. If something is happening, you have warned him — money moves, post disappears, and Margaret may face pressure at home before any professional has assessed the risk. If nothing is happening, you have accused a family member on a hunch and likely destroyed your welcome in that house. Concerns go up, to the safeguarding lead — never sideways.",
        feedbackTone: "developmental",
        competencySignal: "Escalation and Recording",
      },
    ],
  },

  // ─── THE CALL WITH PRIYA ───────────────────────────────────────────────────

  {
    id: "n5",
    type: "GENERATED",
    label: "The call with Priya",
    beatInstruction:
      "The conversation with Priya Sharma, Fernbrook's registered manager and safeguarding lead — either the phone call the carer made from the car (if they escalated today), or the conversation that happens when the concern surfaces later and Priya walks through what should have happened (if they chose to wait or to speak to Darren). Priya is calm, specific and entirely unsurprised — she has handled financial abuse concerns before. She takes the carer through what happens next in plain terms: she will review the notes, speak to Margaret with her consent at the centre of it, and if the concern holds she will make a safeguarding referral to the local authority — and none of it happens behind Margaret's back. If the carer's dialogue with Margaret produced a disclosure, Priya acknowledges specifically how much harder her job would be without it. If the carer's choices were poor, Priya's correction is factual and forward-looking, not punitive. End with the carer starting the car for their next visit, the process now in the right hands.",
    constraints: {
      lengthMin: 120,
      lengthMax: 210,
      mustEndAt:
        "the carer driving to the next call, the concern formally in the right hands",
      mustNotDo: [
        "resolve the safeguarding question itself — whether Darren has done anything is not answered in this module",
        "give generic feedback — reference the specific observations, dialogue and escalation decision from this session",
        "be punitive on the developmental paths",
      ],
    },
    nextNodeId: "ev1",
  },

  // ─── EVALUATIVE ────────────────────────────────────────────────────────────

  {
    id: "ev1",
    type: "EVALUATIVE",
    label: "Competence assessment — safeguarding rubric",
    rubric: [
      {
        id: "indicator-recognition",
        label: "Recognition of indicators",
        description:
          "Carer noticed the observable indicators of possible financial abuse, weighted them appropriately — neither dismissing them nor leaping to conclusions — and connected them to a duty to act within the same day.",
        weight: "critical",
      },
      {
        id: "escalation-and-recording",
        label: "Escalation and recording",
        description:
          "Carer followed the escalation procedure correctly: factual, same-day recording of observations without opinion or accusation, and a same-day report to the safeguarding lead. Did not delay to gather evidence, approach the person the concern relates to, or handle the concern informally.",
        weight: "critical",
      },
      {
        id: "disclosure-handling",
        label: "Disclosure conversation",
        description:
          "Carer created safety for disclosure using open, unhurried, non-leading questions; did not promise secrecy, and if asked to, explained honestly who would need to know and why; kept Margaret's dignity and control at the centre throughout.",
        weight: "major",
      },
      {
        id: "person-centred-practice",
        label: "Person-centred practice",
        description:
          "Carer kept Margaret's wishes, dignity and ongoing relationship in view — protective action taken with her, not around her — consistent with Making Safeguarding Personal.",
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
    label: "Endpoint — Visit Concluded",
    endpointId: "ep-visit-concluded",
    outcomeLabel: "Visit Concluded — Competence Record",
    closingLine:
      "Safeguarding is rarely a dramatic moment. It is a carer who noticed, a conversation that stayed gentle, and a phone call made the same day.",
    summaryInstruction:
      "Write a competence-record summary in two to three sentences, in the style of an entry a training manager could file: reference how the carer handled the indicators on arrival, the conversation with Margaret (whether a disclosure was reached and how it was handled), and the escalation decision. Name one clear strength and one specific area to develop. Professional, factual, forward-looking tone — this is evidence of competence, not a story ending.",
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
      "Fernbrook Care — a domiciliary care provider covering a market town and surrounding villages, 60 care workers, around 300 clients. The learner is a care worker four months into the role, on their regular morning round. The setting is Margaret Ellery's terraced house: her home for fifty years, ordinary, private, hers.",
    rules:
      "Fernbrook safeguarding procedure: (1) Any safeguarding concern must be reported to the registered manager (safeguarding lead) the same working day — no exceptions for uncertainty; uncertainty is the lead's job to resolve, not the carer's. (2) Visit records must contain observable facts — what was seen and heard, quoted where possible — never opinion, diagnosis or accusation. (3) Care workers must never confront or question a person a concern relates to. (4) Never promise a client confidentiality about a safeguarding matter; explain honestly who must be told and why. (5) The client's wishes and control are central at every stage (Making Safeguarding Personal); action is taken with the adult, not to them. (6) Financial abuse is a category of abuse under the Care Act 2014, equal in seriousness to physical abuse or neglect.",
    atmosphere:
      "Quiet, domestic, real. The stakes are high but nothing here is dramatic — the tension lives in half-finished sentences, unopened post, and the gap between what is noticed and what is said. Warmth and professionalism coexist; the carer genuinely likes Margaret, which is precisely what makes this hard.",
  },
  actors: [
    {
      name: "Margaret Ellery",
      role: "Fernbrook client — 84, lives alone",
      personality:
        "Sharp, private, proud of coping since her husband Ted died six years ago. She minimises and deflects as a lifetime habit — 'don't fuss' is her reflex answer to concern. She is fond of her nephew Darren and genuinely grateful for his help, which is exactly why the worry she is carrying is so hard for her to say out loud: naming it feels like betrayal, and she fears both being seen as a silly old woman and getting Darren into trouble. She responds to warmth, patience and being given control; she shuts down under direct challenge, pity, or anything that smells of officialdom.",
      speech:
        "Deflects with small talk and busyness — tea, the garden, the neighbours. Half-starts sentences and abandons them. When she does approach the truth, she approaches it sideways and in small steps, testing whether it's safe. Never melodramatic; her distress shows as flatness, not tears.",
      knowledge:
        "She knows Darren has been using her bank card 'to save her the walk', that money has been leaving her account faster than her spending explains, that a red-letter bill arrived for something she thought was paid, and that when she asked Darren about it he was short with her in a way he's never been before. She does not use — or think in — words like abuse. If asked to keep things secret she will seek that promise; whether trust survives the carer declining to give it depends entirely on how honestly and gently they decline.",
      relationshipToProtagonist:
        "Four months of three-mornings-a-week familiarity. She trusts the carer more than she trusts almost anyone else who comes to the house — which is a responsibility, not a convenience. The trust is real but conditional: rush her, corner her, or talk to her like a case, and the door closes politely and completely.",
      // Placeholder casting: ElevenLabs premade voice — swap for a properly cast elderly voice
      voice: {
        vendorVoiceId: "pFZP5JQG7iQjIQuC4Bku", // "Lily" — British female, warm
        pace: "measured",
        notes: "Tired, guarded, softens late; deflections delivered lightly, not defensively",
      },
    },
    {
      name: "Priya Sharma",
      role: "Registered manager and safeguarding lead, Fernbrook Care",
      personality:
        "Fifteen years in care, seven as a registered manager. Calm, precise, quietly reassuring — she has taken dozens of these calls and treats each one as exactly what it is: information that needs to reach the right place. She corrects poor process factually and without heat, and she is generous in acknowledging good practice because she knows how much courage a first safeguarding call takes.",
      speech:
        "Plain, specific, structured — she narrates process out loud so the carer always knows what happens next and why. Asks factual questions: what did you see, what were the words used, when. Never speculates about guilt.",
      knowledge:
        "Full command of the Care Act 2014 safeguarding framework, Fernbrook's procedures, the local authority referral route, and Making Safeguarding Personal. She knows what happens after a referral and can describe it concretely.",
      relationshipToProtagonist:
        "The carer's manager and the person the procedure exists to connect them to. Supportive, unshockable, and clear that reporting a concern is doing the job right — not causing trouble.",
      voice: {
        vendorVoiceId: "Xb7hH8MSUJpSbSDYk0k2", // "Alice" — British female, clear and professional
        pace: "normal",
        notes: "Calm, structured, process narrated out loud; warmth without softness",
      },
    },
  ],
  protagonist: {
    perspective: "you",
    role: "Domiciliary care worker at Fernbrook Care, four months in role. Margaret's regular morning carer, three visits a week.",
    knowledge:
      "Competent and confident in personal care and daily visit routine. Has completed classroom safeguarding training — knows the categories of abuse and that concerns must be reported — but has never had to act on a live concern, and is about to discover the distance between knowing the procedure and using it.",
    goal:
      "Complete Margaret's morning visit well, recognise what the morning is showing you, handle whatever Margaret is ready to say with care, and do the right thing with it before the day ends.",
  },
  style: {
    tone:
      "Quiet, warm, closely observed. Domestic realism — the drama lives in small objects and half-sentences, never in raised voices. The emotional register is restraint: what is not said matters as much as what is.",
    language: "en-GB",
    register: "professional",
    targetLength: { min: 120, max: 210 },
    styleNotes:
      "Second person, present tense. Use the ordinary vocabulary of domiciliary care naturally: rota, care plan, key safe, visit notes, call. Margaret is always a specific person, never 'the client' in narration. Indicators of abuse are shown as concrete objects and moments, never labelled with safeguarding terminology in prose. Dialogue is where the module lives — give conversations room to breathe.",
  },
  groundTruth: [
    {
      label: "Care Act 2014 — safeguarding duties and categories",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Under the Care Act 2014, safeguarding duties apply to adults who have needs for care and support and are experiencing, or at risk of, abuse or neglect, and are unable to protect themselves because of those needs. Financial or material abuse is an explicit statutory category: it includes theft, fraud, coercion around wills or property, and misuse of an adult's money, bank card, PIN or benefits — including by family members, who are the most common source. The six safeguarding principles are: empowerment, prevention, proportionality, protection, partnership and accountability. Making Safeguarding Personal requires that the adult's own wishes and outcomes lead the response — action is taken with the person, not to them.",
    },
    {
      label: "Financial abuse — recognised indicators",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Recognised indicators of financial abuse in domiciliary settings include: unpaid bills, red-letter or final-demand post where finances were previously managed; unexplained shortage of money, food or heating despite adequate income; withdrawal receipts or bank correspondence inconsistent with the person's own activity; a third party newly controlling cards, PINs or bank access; the person's belongings or valuables going missing; a new person in the household with an unexplained rise in spending; anxiety, flatness or evasiveness when money or the third party is mentioned; and reluctance to be alone with, or contradicted in front of, the third party. No single indicator is proof; a cluster observed by someone who knows the person's normal is a reportable concern.",
    },
    {
      label: "Fernbrook reporting and recording standards",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Concerns must be reported to the safeguarding lead the same working day, by phone, followed by a written record in the visit notes. Records must state: what was observed (specific, concrete), what was said (verbatim where possible, in quotation marks), when and where, and who was present. Records must not contain opinion, speculation about perpetrators, or conclusions ('I think Darren is stealing' is not a record; 'three £250 withdrawals on the statement on the sideboard, Margaret said: he does my bank bits now' is). Carers must not investigate, must not question the person a concern relates to, and must not promise secrecy — the honest formula is: 'I can't keep this just between us, but nothing will happen behind your back, and what you want matters at every step.' A disclosure is not required for a report: observed indicators alone meet the threshold.",
    },
  ],
  scripts: [
    {
      label: "Show indicators, never label them",
      priority: "must",
      trigger: "always",
      instruction:
        "Generated prose must never name or diagnose what the indicators mean — no use of the words abuse, safeguarding, exploitation, financial abuse, or theft in narration. The learner's competence at recognition is the thing being assessed; the text must present evidence, not conclusions. Safeguarding vocabulary may appear only in Priya's dialogue in the final scene.",
    },
    {
      label: "Margaret's dignity is non-negotiable",
      priority: "must",
      trigger: "always",
      instruction:
        "Margaret is never pitiable, confused, or a victim-shaped object. She is a competent adult in a frightening situation involving someone she loves. Her deflections are strength, not weakness. Any generated content that patronises her, dramatises her distress, or takes her agency away is wrong for this module.",
    },
    {
      label: "Vary the surface, keep the structure",
      priority: "must",
      trigger: "always",
      instruction:
        "On each session, vary the concrete surface details — which indicators appear and in what form, the small talk, the household specifics — while keeping the underlying situation identical. A learner repeating this module must face the same competency test through different evidence, so that recognition is being assessed rather than recall.",
    },
    {
      label: "Consequences in safeguarding terms",
      priority: "should",
      trigger: "always",
      instruction:
        "When showing outcomes of choices, ground consequences in the operational reality of safeguarding: delay means continued risk and lost money that is rarely recovered; confrontation means evidence destroyed and pressure on Margaret at home; correct escalation means the concern reaches people with the powers and duty to act. Avoid abstract framing about 'doing the right thing'.",
    },
  ],
  learningObjectives: [
    "Recognise a cluster of financial abuse indicators against knowledge of the client's normal",
    "Hold a disclosure-safe conversation: open questions, no leading, no promise of secrecy",
    "Escalate correctly: same-day report to the safeguarding lead, facts recorded without opinion",
    "Apply Making Safeguarding Personal: keep the adult's wishes and control central to every action",
  ],
}

// ─── SHAPE ────────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 2,
  totalDepthMax: 2,
  endpointCount: 1,
  endpoints: [
    {
      id: "ep-visit-concluded",
      label: "Visit Concluded — Competence Record",
      minChoicesToReach: 2,
      maxChoicesToReach: 2,
      narrativeWeight: "earned",
      emotionalTarget:
        "Quiet professional gravity — the sense that an ordinary morning contained a real test, and that doing this job well is a serious thing done in small ways",
    },
  ],
  loadBearingChoices: [1, 2],
  convergencePoints: [2],
  pacingModel: "competency_build",
  mandatoryNodeIds: ["n1"],
}

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Fernbrook safeguarding training experience…")

  const useCasePack = USE_CASE_PACKS.l_and_d
  if (!useCasePack) throw new Error('USE_CASE_PACK "l_and_d" not found in lib/engine/usecases')

  await db.org.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: "Fernbrook Care",
      slug: "fernbrook-care",
      trainingTier: "training_pilot",
      isOperator: false,
    },
  })
  console.log("  ✓ Org seeded (Fernbrook Care)")

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
      title: "The Morning Visit: Recognising Financial Abuse",
      slug: "fernbrook-safeguarding",
      description:
        "A routine morning call that isn't. Three signs, one half-finished sentence, and a decision that can't wait until next week. Safeguarding competence assessment for domiciliary care workers — the indicators vary every session; the test never does.",
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
  console.log("    Title:  The Morning Visit: Recognising Financial Abuse")
  console.log("    Type:   l_and_d / renderingTheme: training")
  console.log("    Slug:   fernbrook-safeguarding")
  console.log("    Nodes:  11")
  console.log("      1× FIXED      — rota briefing, the note about Darren")
  console.log("      5× GENERATED  — arrival indicators, care visit, post-dialogue (×2), Priya call")
  console.log("      2× CHOICE     — response to indicators (q1), escalation decision (q2)")
  console.log("      1× DIALOGUE   — Margaret at the kitchen table (max 7 turns)")
  console.log("      1× EVALUATIVE — 4-criterion rubric (2× critical)")
  console.log("      1× ENDPOINT   — Visit Concluded — Competence Record")
  console.log("")
  console.log("    Dialogue breakthrough criteria:")
  console.log("      Open non-leading questions + disclosure reached + no promise of secrecy")
  console.log("    Evaluative rubric:")
  console.log("      [critical] Recognition of indicators")
  console.log("      [critical] Escalation and recording")
  console.log("      [major]    Disclosure conversation")
  console.log("      [minor]    Person-centred practice")
  console.log("")
  console.log("  Training player URL:")
  console.log("    http://localhost:6060/scenario/fernbrook-safeguarding")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
