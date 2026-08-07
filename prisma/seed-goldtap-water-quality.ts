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
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000080"
const ORG_ID = "00000000-0000-0000-0000-000000000051" // Gold Tap Training (seed-goldtap.ts)

// ─── NODE GRAPH — "Discoloured: A Water Quality Event" ───────────────────────
//
// Gold Tap demo scenario: water-industry judgment under pressure.
// Mirrors the tabletop pattern (CHECKPOINT injects + DIALOGUE + EVALUATIVE)
// in the vocabulary of Gold Tap's actual courses: water hygiene, sampling,
// emergency supply, customer service. Utility is fictional (Medway Water)
// so no real company is depicted failing.
//
// Structure:
//
//   n1 (FIXED: Monday 07:20 — three discoloured-water jobs on one DMA)
//     → q1 (CHOICE: cluster response — sample and call it in vs flush it through)
//       → cp1 (CHECKPOINT: triage closed, escalation phase unlocked)
//         → n2 (GENERATED: on site — the contractor's job pack, the nursing home)
//           → d1 (DIALOGUE: Steve Malin, network duty manager — max 6 turns)
//             breakthrough → n3a (GENERATED: precautionary path holds)
//             max turns    → n3b (GENERATED: flush-first instinct won)
//             Both → q2 (CHOICE: the event notification decision)
//               → cp2 (CHECKPOINT: regulatory phase closed, afternoon unlocked)
//                 → n4 (GENERATED: sample results land; the street knows)
//                   → d2 (DIALOGUE: Kayleigh Morris, resident — max 6 turns)
//                     breakthrough → n5a (GENERATED: one week later — clean record)
//                     max turns    → n5b (GENERATED: one week later — harder read)
//                     Both → ev1 (EVALUATIVE: assesses n2, n3a/n3b, n4, n5a/n5b)
//                       → ep1 (ENDPOINT: Event Closed — Competence Record)

const nodes: Node[] = [

  // ─── MONDAY 07:20 ──────────────────────────────────────────────────────────

  {
    id: "n1",
    type: "FIXED",
    label: "Monday 07:20 — three jobs, one street",
    content:
      "Monday, 07:20. You collect the van keys and check the morning job queue.\n\nYou are a Network Technician at Medway Water, four years on the distribution team. Most Mondays start with a meter swap and a pressure complaint. Not this one.\n\nThree jobs, logged overnight, all within four hundred metres of each other on the Orchard Park estate: \"water brown, smells odd\" — 22:40. \"Discoloured water, won't clear on running\" — 06:15. \"Brown water, children in property\" — 06:52.\n\nYou pull up the mains records. A contractor gang did an emergency repair on the six-inch main under Orchard Way on Saturday night — burst clamp, off-and-on in four hours, job closed at 02:00 Sunday.\n\nThree discolouration complaints, clustered downstream of a weekend contractor repair. The van is fuelled. The estate is fifteen minutes away. And something in the shape of this is telling you it isn't three separate jobs.",
    mandatory: true,
    nextNodeId: "q1",
  },

  // ─── Q1: CLUSTER RESPONSE ──────────────────────────────────────────────────

  {
    id: "q1",
    type: "CHOICE",
    label: "Q1 — Three jobs or one event?",
    responseType: "closed",
    prompt:
      "Three clustered complaints downstream of a weekend repair. How do you play the first hour?",
    options: [
      {
        id: "q1-a",
        label:
          "Treat it as one possible event: check the contractor's job records, take samples at the affected properties FIRST, and call the water quality duty scientist before any flushing",
        nextNodeId: "cp1",
        isLoadBearing: true,
        stateChanges: { recognised_event: true, q1_correct: true },
        trainingFeedback:
          "This is the judgment that separates a technician from a job-closer. A cluster downstream of an off-and-on repair is an event hypothesis, not three coincidences — and samples taken before flushing are the only evidence of what customers actually received. Flush first and you have destroyed the very thing the water quality team needs to protect both the public and the company.",
        feedbackTone: "positive",
        competencySignal: "Event Recognition",
      },
      {
        id: "q1-b",
        label:
          "Get flushing immediately — discolouration after a repair is normal disturbed sediment, and the fastest way to help customers is to clear the main now",
        nextNodeId: "cp1",
        isLoadBearing: false,
        stateChanges: { recognised_event: false, q1_correct: false },
        trainingFeedback:
          "Nine times out of ten, you'd be right — and that's exactly what makes this dangerous. Disturbed sediment is the common cause; but an off-and-on contractor repair adds a contamination pathway, and 'smells odd' is not a sediment word. Flushing first clears the evidence out of the main before anyone has sampled what customers were drinking. The tenth time, flush-first is the decision an incident report turns on.",
        feedbackTone: "developmental",
        competencySignal: "Event Recognition",
      },
      {
        id: "q1-c",
        label:
          "Work the jobs in queue order as logged — assess each property on its merits and keep the morning's other jobs on schedule",
        nextNodeId: "cp1",
        isLoadBearing: false,
        stateChanges: { recognised_event: false, q1_correct: false },
        trainingFeedback:
          "Queue discipline is a virtue right up until it blinds you. Three complaints, one DMA, one upstream repair — the information is in the pattern, and patterns don't appear in single job tickets. Anyone can clear three jobs; the competence being assessed is whether you saw one event.",
        feedbackTone: "developmental",
        competencySignal: "Event Recognition",
      },
    ],
  },

  // ─── CHECKPOINT: TRIAGE CLOSED ─────────────────────────────────────────────

  {
    id: "cp1",
    type: "CHECKPOINT",
    label: "Inject gate — triage closed",
    visible: false,
    marksCompletionOf: "Recognise a complaint cluster after network work as a possible water quality event",
    unlocks: ["escalation-phase"],
    snapshotsState: true,
    nextNodeId: "n2",
  },

  // ─── ON SITE ───────────────────────────────────────────────────────────────

  {
    id: "n2",
    type: "GENERATED",
    label: "On site — the job pack, and the nursing home",
    beatInstruction:
      "Mid-morning on the Orchard Park estate. Two injects land in sequence. FIRST: the learner reviews the contractor's job pack for Saturday night's repair and finds it thin in ways that matter — vary the specifics each session, drawing from: no record of disinfection of fittings before insertion; the hygiene section of the permit left blank; one operative's National Water Hygiene card number missing or lapsed; no flushing/sampling noted at recommissioning; the excavation photographed part-flooded with groundwater. Do not use all of them — two or three, concretely described. Reflect session state: if the learner sampled first (check state), samples from three properties are already with the lab on priority; if they flushed first, the mains water now runs clearer and the learner must reckon with what that means for evidence. SECOND: walking the DMA, the learner clocks Fairhaven House — a forty-bed nursing home, on the affected run, whose kitchen has been drawing water all morning. End with the learner's phone ringing: Steve Malin, the network duty manager, wanting a picture and wanting it quick.",
    constraints: {
      lengthMin: 140,
      lengthMax: 240,
      mustEndAt: "the duty manager's call about to be answered",
      mustNotDo: [
        "resolve whether the water is actually contaminated — nobody knows yet",
        "make the contractor cartoonishly negligent — thin paperwork, not villainy",
        "have anyone decide the escalation for the learner",
      ],
      mustInclude: [
        "specific gaps in the contractor job pack",
        "Fairhaven House nursing home on the affected run",
      ],
    },
    nextNodeId: "d1",
  },

  // ─── DIALOGUE: STEVE MALIN, DUTY MANAGER ───────────────────────────────────

  {
    id: "d1",
    type: "DIALOGUE",
    label: "The call — Steve Malin, network duty manager",
    actorId: "Steve Malin",
    openingLine:
      "Right, talk to me. I've got three discolouration jobs on my board for Orchard Park and I've just had the contracts manager on saying their repair was signed off clean. Here's where I am: it's Monday, I'm two techs down, and if we start saying the word 'event' this turns into forms, the quality team, and a very long week for both of us. Sediment after a repair clears with a good flush. So — tell me why I shouldn't just have you flush the run and close the jobs by lunch.",
    breakthroughCriteria:
      "The learner has held the precautionary line under pressure from their own manager, and Steve has explicitly agreed to ALL of: (1) the water quality duty scientist is brought in NOW and the decision about flushing and notices is theirs, not operations'; (2) samples (already taken, or to be taken immediately before any flushing) go to the lab on priority; (3) Fairhaven House is contacted and protected straight away — advised not to use the supply for drinking or food prep pending advice, with alternative water arranged; and (4) the contractor job pack gaps are recorded and reported as found, not smoothed over. The learner achieved this with facts and procedure — the complaint cluster, the hygiene gaps, the vulnerable site — not by capitulating, and without being insubordinate: Steve is persuadable by evidence and by having the decision taken off his shoulders and put where procedure says it belongs.",
    maxTurns: 6,
    nextNodeId: "n3a",
    failureNodeId: "n3b",
  },

  // ─── MIDDAY: PRECAUTIONARY PATH ────────────────────────────────────────────

  {
    id: "n3a",
    type: "GENERATED",
    label: "Midday — the precautionary path holds",
    beatInstruction:
      "Midday. The machinery is running the way the procedure intends: the water quality duty scientist has taken ownership; priority samples are at the lab with results expected late afternoon; Fairhaven House has been visited, its kitchen switched to bottled water, its manager grateful and calm; the affected properties have had a knock on the door and a straight factual line. Steve Malin, having agreed the escalation, is now solidly behind it — reflect that a manager who has been talked round becomes an ally. Show the quiet operational competence: barriers, a tanker of alternative supply on standby, the timeline log being kept. THEN the tension re-tightens: the lab calls ahead informally — first-pass results are not clean; confirmation and speciation by late afternoon. Whatever this is, it was in the water people drank over the weekend. End with the water quality scientist saying the next decision is about notification — and asking the learner, who has been on the ground all day, to walk the incident room through the timeline.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt: "the notification question raised, the learner about to present the timeline",
      mustNotDo: [
        "confirm exactly what the contamination is — first-pass, unconfirmed",
        "let the good process feel like the story is over",
        "have anyone state what the notification decision should be",
      ],
    },
    nextNodeId: "q2",
  },

  // ─── MIDDAY: FLUSH-FIRST PATH ──────────────────────────────────────────────

  {
    id: "n3b",
    type: "GENERATED",
    label: "Midday — the flush went ahead",
    beatInstruction:
      "Midday, on the path where Steve's flush-first instinct carried the call. The run has been flushed; the water at the taps looks better; two of the three complaints have been closed. Show the surface calm and let the unease build underneath it: the samples that would have shown what customers drank over the weekend were never taken (or were taken only after flushing — reflect session state); the contractor job pack gaps are still sitting in the learner's photos, unreported; Fairhaven House has been drinking and cooking on the supply all morning. THEN the day turns: a GP surgery on the estate phones the company — two patients, same street, gastrointestinal symptoms, both households on the affected run. The water quality team is now involved by a route nobody wanted, asking the questions the morning should have answered: what did the samples show? There are no samples. End with Steve Malin, quieter than this morning, telling the learner the quality duty scientist wants them in the incident room with everything they've got — and the learner knowing exactly how much thinner 'everything' is than it should be.",
    constraints: {
      lengthMin: 130,
      lengthMax: 230,
      mustNotDo: [
        "confirm the illness is waterborne — suspected, not established",
        "make the harm irreversible or anyone die — this is a cautionary path, not a catastrophe",
        "let the learner off the hook for the missing evidence, or blame them in narration — show consequences and let them sit",
      ],
      mustEndAt: "summoned to the incident room, the evidence gap fully visible",
    },
    nextNodeId: "q2",
  },

  // ─── Q2: THE NOTIFICATION DECISION ─────────────────────────────────────────

  {
    id: "q2",
    type: "CHOICE",
    label: "Q2 — Who gets told, and when?",
    responseType: "closed",
    prompt:
      "The incident room turns to notification. Possible contamination of a public supply, a vulnerable site on the run, results not yet confirmed. What do you argue for?",
    options: [
      {
        id: "q2-a",
        label:
          "Notify now on what is known: formal event notification to the Drinking Water Inspectorate, precautionary 'do not drink' advice to affected properties agreed with the health authority, alternative water out this afternoon — update everyone as results confirm",
        nextNodeId: "cp2",
        isLoadBearing: true,
        stateChanges: { notified_promptly: true, q2_correct: true },
        trainingFeedback:
          "Correct — and this is the water industry's version of a rule that holds across every regulated sector: the duty runs from suspicion, not from certainty. Event notification to the DWI is required for what MAY affect quality, precautionary consumer advice is issued in consultation with health authorities before confirmation, and 'we waited for the lab' has appeared in more enforcement narratives than any other sentence. Early, honest, updated-in-phases is the defensible shape.",
        feedbackTone: "positive",
        competencySignal: "Regulatory Compliance",
      },
      {
        id: "q2-b",
        label:
          "Hold until the lab confirms this evening — issuing 'do not drink' advice on an unconfirmed first pass will frighten hundreds of households, hammer trust, and might all be for nothing",
        nextNodeId: "cp2",
        isLoadBearing: false,
        stateChanges: { notified_promptly: false, q2_correct: false },
        trainingFeedback:
          "The concern about alarm is real, which is why precautionary advice is agreed with the health authority rather than shouted from a van — but holding notification for confirmation inverts the duty. The hours between suspicion and confirmation are exactly the hours in which a nursing home kitchen keeps cooking. If it confirms, you protected nobody during the window that mattered; if it clears, a precautionary notice properly handled costs far less trust than 'they knew on Monday' ever will.",
        feedbackTone: "developmental",
        competencySignal: "Regulatory Compliance",
      },
      {
        id: "q2-c",
        label:
          "Quietly advise Fairhaven House and the three complainants directly, but keep it informal and off the record until the picture is certain — protect the vulnerable without starting the regulatory machine",
        nextNodeId: "cp2",
        isLoadBearing: false,
        stateChanges: { notified_promptly: false, q2_correct: false },
        trainingFeedback:
          "Half-right is the most seductive wrong answer. Protecting Fairhaven House immediately is exactly correct — but doing it 'off the record' creates an uncontrolled patchwork: some households warned, their neighbours not, no health authority input on the advice, and a paper trail that shows the company knew enough to warn selectively. The regulatory machine exists precisely so that protection is consistent, authorised, and recorded. Use it.",
        feedbackTone: "developmental",
        competencySignal: "Regulatory Compliance",
      },
    ],
  },

  // ─── CHECKPOINT: REGULATORY PHASE CLOSED ───────────────────────────────────

  {
    id: "cp2",
    type: "CHECKPOINT",
    label: "Inject gate — regulatory phase closed",
    visible: false,
    marksCompletionOf: "Apply notification duties on suspicion: DWI event notification and authorised, consistent consumer advice",
    unlocks: ["street-phase"],
    snapshotsState: true,
    nextNodeId: "n4",
  },

  // ─── LATE AFTERNOON: THE STREET ────────────────────────────────────────────

  {
    id: "n4",
    type: "GENERATED",
    label: "Late afternoon — the street knows",
    beatInstruction:
      "Late afternoon on Orchard Way. The lab has confirmed: microbiological contamination consistent with ingress at the repair — vary the specific finding each session at briefing level only (coliforms present / E. coli detection at low count) with reassuring-but-real framing. Reflect session state honestly: on the prompt-notification path, 'do not drink' cards are going door to door with bottled water stations at the community centre, and the learner is delivering them; on the delayed paths, the confirmation has forced the same actions hours later, with the WhatsApp version of events already ahead of the official one. Either way the street is out on its doorsteps. The learner, in Medway Water hi-vis, is the visible face of the company on the pavement. A local Facebook group post — 'they've known since THIS MORNING' — is being shown around on phones, accurate in the way that hurts most on the delayed path. End with a woman coming out of number 14 straight at the learner, a baby on her hip and a bottle of brown-ish tap water in her free hand: Kayleigh Morris, and she wants answers now.",
    constraints: {
      lengthMin: 140,
      lengthMax: 240,
      mustEndAt: "Kayleigh Morris in front of the learner, about to speak",
      mustNotDo: [
        "get ahead of the medical facts — nobody's illness is confirmed waterborne",
        "make the crowd a mob — this is a British street, frightened and cross, not a riot",
        "have the learner start speaking yet",
      ],
      mustInclude: [
        "the confirmed lab finding at briefing level",
        "the door-to-door notification effort per session state",
        "the baby and the bottle of discoloured water",
      ],
    },
    nextNodeId: "d2",
  },

  // ─── DIALOGUE: KAYLEIGH MORRIS, RESIDENT ───────────────────────────────────

  {
    id: "d2",
    type: "DIALOGUE",
    label: "The doorstep — Kayleigh Morris",
    actorId: "Kayleigh Morris",
    openingLine:
      "You. You're the water company, yeah? I made his bottles up with that on Saturday. Saturday, Sunday, this morning — he's seven months old. And now there's a card through my door saying don't drink it? I've been giving it to my BABY. What was in it? Don't give me 'we're investigating' — what was in my water and is he going to be alright?",
    breakthroughCriteria:
      "The learner has met a frightened parent as a human being first and a company representative second, and ALL of the following happened: (1) genuine, unhurried acknowledgment of her fear before any information — she felt heard, not handled; (2) honesty about what is known and not known: the water failed its safety test, what that does and does not mean, and NO false reassurance that the baby is definitely fine, NO speculation about what he may have; (3) concrete, practical next steps she can hold onto: what advice to follow now, where the bottled water is, and — critically — advice to speak to her GP or NHS 111 about the baby today, framed as the right precaution rather than cause for panic; (4) her details taken so the company follows up directly and she is flagged for priority support; and (5) no blame-shifting onto the contractor, no minimising ('it's only low levels'), no promising results or outcomes the learner cannot control. She does not need to be happy; she needs to leave this conversation knowing exactly what to do next and that somebody told her the truth.",
    maxTurns: 6,
    nextNodeId: "n5a",
    failureNodeId: "n5b",
  },

  // ─── ONE WEEK LATER: CLEAN RECORD ──────────────────────────────────────────

  {
    id: "n5a",
    type: "GENERATED",
    label: "One week later — what the record shows",
    beatInstruction:
      "One week on. Close with an honest reckoning, not a victory lap. The event is over: the main recommissioned after disinfection and clear samples, the notice lifted after two consecutive clean results, bottled water stations stood down. Count the real outcomes, reflecting session state: the DWI's event report acknowledged (on the prompt path) early notification and evidence preserved by sampling before flushing — or recorded the gaps (on mixed paths); no confirmed illness linked to the supply, Kayleigh Morris's baby seen by the GP and fine, and her follow-up call from the company actually made; the contractor's hygiene failures now a formal non-conformance with consequences for their framework contract; Fairhaven House writing, unexpectedly, to thank the company for how it was handled. Steve Malin's debrief line to the learner should carry the theme: the paperwork nobody enjoys is the story the company gets to tell afterwards. End in the yard, Monday again, job queue loading — and the learner reading the queue differently than they did a week ago.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt: "the next Monday's queue, read with new eyes",
      mustNotDo: [
        "make it triumphant — a contamination event handled well is still a bad week",
        "leave Kayleigh and the baby unresolved",
        "introduce new incidents",
      ],
    },
    nextNodeId: "ev1",
  },

  // ─── ONE WEEK LATER: HARDER READ ───────────────────────────────────────────

  {
    id: "n5b",
    type: "GENERATED",
    label: "One week later — the harder read",
    beatInstruction:
      "One week on, on the path where the doorstep went badly — the learner reassured where they should have been honest, got defensive, blamed the contractor, or sent Kayleigh Morris away with fear and no next step. The operational event closed the same way: disinfection, clear samples, notice lifted. But the human record reads differently: Kayleigh's account of the doorstep — 'the man from the water company told me it was basically fine' or 'couldn't even look at me' — quoted in a local news piece and in her formal complaint, now attached to the DWI event file; the company's otherwise defensible response coloured by its worst conversation, plus whatever notification delay session state carries. Be fair and precise about the lesson: the samples, the notices and the flushing were all recoverable by process — the two minutes on the doorstep were the only part of the event that was the learner's alone, and that is the part in the file. No confirmed illness; the baby is fine; that fact arriving as relief rather than vindication. Steve Malin's debrief is unsparing but decent. End in the yard, Monday, the queue loading.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt: "the next Monday's queue",
      mustNotDo: [
        "destroy the learner's career or make the failure irredeemable",
        "let the baby's outcome stay ambiguous",
        "blame the learner in narration — let the quoted words and the file do it",
      ],
    },
    nextNodeId: "ev1",
  },

  // ─── EVALUATIVE ────────────────────────────────────────────────────────────

  {
    id: "ev1",
    type: "EVALUATIVE",
    label: "Event assessment — water quality competence rubric",
    rubric: [
      {
        id: "event-recognition",
        label: "Event recognition and evidence",
        description:
          "Technician recognised a clustered pattern as a possible water quality event rather than routine jobs, and protected the evidence: samples taken at consumer taps before flushing, contractor job pack gaps recorded and reported as found.",
        weight: "critical",
      },
      {
        id: "public-health-protection",
        label: "Public health protection",
        description:
          "Acted on the precautionary principle for the window between suspicion and confirmation: vulnerable site (nursing home) protected immediately with authorised advice and alternative supply, notification made on suspicion rather than held for lab certainty, consumer advice issued consistently rather than selectively.",
        weight: "critical",
      },
      {
        id: "professional-courage",
        label: "Professional courage under operational pressure",
        description:
          "Held the procedural line with their own duty manager when pressured to flush-and-close: escalated to the water quality team using facts rather than confrontation, and put the decision where the procedure places it.",
        weight: "major",
      },
      {
        id: "customer-communication",
        label: "Customer communication under distress",
        description:
          "On the doorstep with a frightened parent: acknowledged fear before information, was honest about known and unknown without false reassurance or speculation, gave concrete next steps including appropriate health-service signposting, and arranged follow-up.",
        weight: "major",
      },
      {
        id: "recording-timeline",
        label: "Recording and timeline discipline",
        description:
          "Kept a factual timeline from the first hour — what was observed, decided, and communicated, when — of the standard an event review and a DWI report can rely on.",
        weight: "minor",
      },
    ],
    assessesNodeIds: ["n2", "d1", "n3a", "n3b", "n4", "d2", "n5a", "n5b"],
    nextNodeId: "ep1",
  },

  // ─── ENDPOINT ──────────────────────────────────────────────────────────────

  {
    id: "ep1",
    type: "ENDPOINT",
    label: "Endpoint — Event Closed",
    endpointId: "ep-event-closed",
    outcomeLabel: "Event Closed — Competence Record",
    closingLine:
      "Water quality events are not won in the incident room. They are won by whoever looks at three job tickets and sees one event.",
    summaryInstruction:
      "Write a competence-record summary in three to four sentences, in the style of an event review's individual-performance section: walk the technician's decision timeline (cluster recognition and sampling, the duty manager escalation, the notification position, the doorstep conversation) against Medway Water procedure and the precautionary principle, naming specific decisions and their consequences within the event. Close with one commendation and one development action. Professional, exact, suitable for a certification evidence file.",
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
      "Medway Water — a fictional UK water company supplying 1.4 million customers across Kent. The setting is the distribution network: vans, job queues, DMAs, mains records, and the Orchard Park estate — a 1970s development of four hundred households, one nursing home, and a six-inch main that a contractor repaired on Saturday night. The learner is a Network Technician; the event runs from a Monday morning job queue to the following Monday.",
    rules:
      "Medway Water event procedure: (1) A cluster of quality complaints, or any complaint following network work, must be assessed as a possible event, not routine jobs. (2) Where contamination is possible, samples are taken at consumer taps BEFORE flushing — flushing destroys evidence of what customers received. (3) The water quality duty scientist owns event decisions (flushing, notices, notification); operations executes. (4) Events which may affect water quality are notified to the Drinking Water Inspectorate on suspicion, updated as facts confirm. (5) Consumer advice ('do not drink' / boil) is agreed with the health authority (UKHSA) and issued consistently to all affected properties — never informally or selectively. (6) Vulnerable and priority-services customers are protected first, with alternative supplies. (7) All network work is done under water hygiene rules: National Water Hygiene cards, disinfected fittings, hygiene-completed permits — gaps are reported as found. (8) A timeline log is kept from the first hour of any suspected event.",
    atmosphere:
      "Working-day realism under a tightening clock. Vans, kerbside conversations, a job queue that keeps filling, and the specific dread of a public supply going wrong quietly over a weekend. The register is professional and unglamorous — hi-vis and sample bottles, not war rooms. Pressure arrives as reasonable-sounding people wanting reasonable-sounding shortcuts.",
  },
  actors: [
    {
      name: "Steve Malin",
      role: "Network duty manager, Medway Water",
      personality:
        "Twenty-two years on the network, promoted off the tools. Not a bad manager — a stretched one: two technicians down, a board full of jobs, and a Monday. His instinct is operational: clear the queue, keep the schedule, don't start the machinery unless you must. He has seen a hundred discolouration complaints clear with a flush, and that experience is precisely his blind spot. He respects evidence, respects people who stand their ground with facts rather than attitude, and — the key to him — is quietly relieved when a decision that scares him is placed with the people whose job it is to own it. Once persuaded, he commits fully.",
      speech:
        "Fast, blunt, list-shaped. Talks in job counts and clock times. Pushes hard once, tests whether you fold, then listens if you come back with substance. Never bullies; pressures. On the far side of agreement he becomes brisk and supportive: 'right, then here's what I'll do from my end.'",
      knowledge:
        "The network cold: mains, DMAs, valve positions, which contractor gangs cut corners. The event procedure in outline — he knows the quality team owns these calls, which is exactly why his flush-first framing is a test as much as an instruction. Knows nothing yet about the job pack gaps or Fairhaven House until told.",
      relationshipToProtagonist:
        "The learner's duty manager — four years of mutual professional respect. He rates them, which is why how they handle this call sets how he treats their judgment for years. This is pressure from a decent manager having a bad Monday: the hardest kind to hold a line against.",
      voice: {
        vendorVoiceId: "JBFqnCBsd6RMkjVDRZzb", // "George" — British male, warm gravel
        pace: "rapid",
        notes: "Blunt and quick, softening to brisk support once persuaded",
      },
    },
    {
      name: "Kayleigh Morris",
      role: "Resident, 14 Orchard Way — mother of a seven-month-old",
      personality:
        "Twenty-eight, on maternity leave, sharp and articulate when she isn't terrified — and she is terrified, which is coming out as anger because anger is easier to stand on. She made her baby's bottles with that water for three days. She is not anti-company or performing for the street: she wants the truth and something to DO. She can hear the difference between honesty and handling instantly — false reassurance ('I'm sure he's fine') reads to her as lying, and corporate deflection sends her straight to the Facebook group and the papers. Met with genuine human honesty and concrete steps, her anger drains fast into focus, because focus is what she actually needs.",
      speech:
        "Rapid, direct, interrupting at first — questions stacked on questions, the baby jiggled on her hip. Quotes specifics: days, feeds, the card through the door. Goes quiet and very attentive the moment someone starts telling her the truth. Says 'right' when she's absorbing instructions.",
      knowledge:
        "Everything a resident knows and nothing more: the brown water Saturday, the smell, the card today, the street's WhatsApp theories. Does not know what a coliform is — and does not need the word; she needs what it means for her son.",
      relationshipToProtagonist:
        "A stranger in company hi-vis — the first reachable human face of Medway Water. Whatever the learner says in these two minutes IS the company to her, permanently.",
      voice: {
        vendorVoiceId: "pFZP5JQG7iQjIQuC4Bku", // "Lily" — British female, warm
        pace: "rapid",
        notes: "Frightened-angry, words tumbling; slows and quietens when met with honesty",
      },
    },
  ],
  protagonist: {
    perspective: "you",
    role: "Network Technician, Medway Water distribution team — four years in, National Water Hygiene carded, trusted with a van and a patch.",
    knowledge:
      "Solid on the tools: mains, flushing, sampling technique, the estate's network. Trained on the event procedure and water hygiene rules — and about to discover the distance between knowing a procedure and holding it against a manager on the phone and a mother on a doorstep.",
    goal:
      "Read the morning correctly, protect the public through the uncertain hours, hold the procedural line under pressure from above, tell the truth kindly to the people on the street, and end the week with a record that stands inspection.",
  },
  style: {
    tone:
      "Grounded operational realism with quiet stakes. The tension lives in job queues, sample bottles, phone calls, and doorsteps — never in melodrama. Consequences are institutional and human: files, notices, a baby's bottles.",
    language: "en-GB",
    register: "professional",
    targetLength: { min: 130, max: 240 },
    styleNotes:
      "Second person, present tense. Day and time markers open scenes where natural ('Monday, 07:20'). Use the industry's real vocabulary plainly: DMA, mains, flushing, sampling, event, notice, hygiene card, job pack. Named characters are specific people under specific pressures. Keep water science at briefing level — what a result means, never a chemistry lesson. Emotional register: restraint; the doorstep scene carries the heart of the module and must be written with care for Kayleigh's dignity.",
  },
  groundTruth: [
    {
      label: "Water hygiene principles (National Water Hygiene themes)",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "All work on the potable network is done under water hygiene rules: operatives carry National Water Hygiene cards; fittings and tools in contact with potable water are disinfected; permits include hygiene sign-off; mains returned to service after invasive work are flushed, disinfected where required, and sampled per procedure. An off-and-on repair with groundwater in the excavation is a recognised contamination pathway (ingress under depressurisation). Gaps in hygiene records after network work are themselves reportable findings — the record of what was NOT done is evidence, and smoothing it over compounds the failure.",
    },
    {
      label: "Event response and notification duties",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Under the drinking water quality framework (Water Supply (Water Quality) Regulations and DWI guidance), companies must notify the Drinking Water Inspectorate of events which may affect, or may have affected, drinking water quality — the duty runs from suspicion, not laboratory confirmation, and initial notifications are updated as facts develop. Consumer protection advice ('do not drink', boil water) is decided by the company's water quality function in consultation with health authorities (UKHSA), issued consistently to all affected properties, and lifted only on satisfactory results. Where contamination is suspected, samples at consumer taps before remedial flushing are the primary evidence of consumer exposure; flushing first is evidentially destructive. Priority-services and vulnerable customers (care settings, infants, dialysis) are protected first with alternative supplies.",
    },
    {
      label: "Operational facts fixed for this exercise",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "should_include",
      content:
        "Fixed facts: three discolouration complaints logged overnight within 400m on the Orchard Park DMA, all downstream of a six-inch main repaired by a framework contractor between 22:00 Saturday and 02:00 Sunday (burst clamp; supply off and on; excavation held groundwater). Fairhaven House, a 40-bed nursing home, draws from the affected run. Priority lab turnaround is same-day for first-pass, next-day for confirmation. Alternative supplies available: bottled water stations and one 10,000-litre tanker within two hours. The learner's timeline log, sample records, and photographs of the contractor job pack are the evidential spine of the event file.",
    },
  ],
  scripts: [
    {
      label: "Clocks and exposure always visible",
      priority: "must",
      trigger: "always",
      instruction:
        "Every scene keeps the exposure window in view: who has been drinking this water, since when, and what has and hasn't yet been decided. Time markers are concrete. The pressure of this module is the gap between suspicion and confirmation — never let that gap feel comfortable.",
    },
    {
      label: "Decisions belong to the learner",
      priority: "must",
      trigger: "always",
      instruction:
        "Narration never resolves, recommends, or pre-empts a decision the learner has not made. Characters pressure from their own interests; procedures state duties; the choosing is always left at the learner's feet.",
    },
    {
      label: "Science at briefing level, honesty about uncertainty",
      priority: "must",
      trigger: "always",
      instruction:
        "Water quality science stays at the level a competent technician would brief: what a result indicates, what is unknown, what the precaution is for. Never provide clinical reassurance or diagnosis about any person's health — the correct move is always health-service signposting, and generated content must model that rather than 'the baby will be fine'.",
    },
    {
      label: "Vary the surface, keep the structure",
      priority: "must",
      trigger: "always",
      instruction:
        "On each session vary incidental specifics — which hygiene gaps appear in the job pack, the exact lab finding at briefing level, house numbers, weather, minor characters — while keeping every structural fact (the cluster, the repair, the nursing home, the timings, the duties) fixed. A repeat run must test the same judgment against fresh detail.",
    },
    {
      label: "Consequences compound through state",
      priority: "should",
      trigger: "always",
      instruction:
        "Generated scenes honestly reflect accumulated decisions: sampling-first preserves evidence that later scenes rely on; flush-first leaves gaps that later scenes expose; prompt notification changes the street's temperature; the doorstep conversation echoes into the closing file. Good and bad decisions must both visibly compound.",
    },
  ],
  useCaseCategory: "crisis_exercise",
  learningObjectives: [
    "Recognise a complaint cluster after network work as a possible water quality event",
    "Protect evidence: sample at consumer taps before flushing where contamination is suspected",
    "Hold the precautionary line under operational pressure and escalate to the water quality function",
    "Apply notification duties on suspicion: DWI event notification and authorised, consistent consumer advice",
    "Communicate honestly with frightened customers: acknowledge, be truthful about uncertainty, give concrete steps and health signposting",
  ],
}

// ─── SHAPE ────────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 2,
  totalDepthMax: 2,
  endpointCount: 1,
  endpoints: [
    {
      id: "ep-event-closed",
      label: "Event Closed — Competence Record",
      minChoicesToReach: 2,
      maxChoicesToReach: 2,
      narrativeWeight: "earned",
      emotionalTarget:
        "Sober professional pride or honest reckoning — the feeling of an event review where the record speaks for itself, and a technician who will read Monday's queue differently forever",
    },
  ],
  loadBearingChoices: [1, 2],
  convergencePoints: [2],
  pacingModel: "competency_build",
  mandatoryNodeIds: ["n1"],
  displaySteps: 10,
}

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Gold Tap water quality event exercise…")

  const useCasePack = USE_CASE_PACKS.l_and_d
  if (!useCasePack) throw new Error('USE_CASE_PACK "l_and_d" not found in lib/engine/usecases')

  const org = await db.org.findUnique({ where: { id: ORG_ID } })
  if (!org) {
    throw new Error(
      "Gold Tap org not found — run `npx tsx prisma/seed-goldtap.ts` first (it owns the org, users and tiers)."
    )
  }

  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    update: {
      description:
        "Three brown-water complaints, one weekend repair, a nursing home on the run: manage the event end to end.",
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
      title: "Discoloured: A Water Quality Event",
      slug: "goldtap-water-quality-event",
      description:
        "Three brown-water complaints, one weekend repair, a nursing home on the run: manage the event end to end.",
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
  console.log("    Title:  Discoloured: A Water Quality Event")
  console.log("    Type:   l_and_d / renderingTheme: training")
  console.log("    Slug:   goldtap-water-quality-event")
  console.log("    Nodes:  14")
  console.log("      1× FIXED      — Monday 07:20, three jobs one street")
  console.log("      6× GENERATED  — site visit, midday (×2), the street, one week later (×2)")
  console.log("      2× CHOICE     — cluster response (q1), notification (q2)")
  console.log("      2× CHECKPOINT — inject gates with state snapshots")
  console.log("      2× DIALOGUE   — Steve Malin, duty manager (6); Kayleigh Morris, resident (6)")
  console.log("      1× EVALUATIVE — 5-criterion rubric (2× critical)")
  console.log("      1× ENDPOINT   — Event Closed — Competence Record")
  console.log("")
  console.log("  Training player URL:")
  console.log("    http://localhost:6060/scenario/goldtap-water-quality-event")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
