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
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000070"
const ORG_ID = "00000000-0000-0000-0000-000000000120"

// ─── NODE GRAPH — "Locked: A Ransomware Tabletop" ────────────────────────────
//
// Crisis exercise: Hartley & Voss — ransomware incident, Friday 16:40 onward
// Demonstrates the tabletop pattern: CHECKPOINT nodes as timeline injects,
// DIALOGUE nodes as stakeholder pressure, EVALUATIVE as the after-action report.
//
// Structure:
//
//   n1 (FIXED: Friday 16:40 — the helpdesk ticket)
//     → q1 (CHOICE: first move — containment discipline; training feedback)
//       → cp1 (CHECKPOINT: containment phase closed, escalation phase unlocked)
//         → n2 (GENERATED: the ransom note + the backup problem — inject 1 & 2)
//           → d1 (DIALOGUE: Elaine Hartley, CEO — max 6 turns)
//             breakthrough → n3a (GENERATED: IR stood up properly — then inject 3: exfiltration)
//             max turns    → n3b (GENERATED: Elaine's premature reassurance — then inject 3)
//             Both → q2 (CHOICE: the ICO 72-hour decision; training feedback)
//               → cp2 (CHECKPOINT: regulatory phase closed, crisis peak unlocked)
//                 → n4 (GENERATED: day 3 — scope confirmed, deadline near, the press knows)
//                   → d2 (DIALOGUE: Sam Okafor, journalist — max 5 turns)
//                     breakthrough → n5a (GENERATED: two weeks later — recovery, honest record)
//                     max turns    → n5b (GENERATED: two weeks later — recovery, harder road)
//                     Both → ev1 (EVALUATIVE: assesses n2, n3a/n3b, n4, n5a/n5b)
//                       → ep1 (ENDPOINT: Exercise Complete — After-Action Report)

const nodes: Node[] = [

  // ─── FRIDAY 16:40 ──────────────────────────────────────────────────────────

  {
    id: "n1",
    type: "FIXED",
    label: "Friday 16:40 — the helpdesk ticket",
    content:
      "Friday, 16:40. Most of the office has one eye on the weekend.\n\nYou are the IT & Operations Manager at Hartley & Voss, a 150-person structural engineering consultancy. Your world is project servers, CAD licences, and a helpdesk queue that usually empties by five.\n\nTicket #4482, logged four minutes ago by Priti on the third floor: \"Can't open anything on the P-drive. All the files have gone weird — they've got a strange extension on them. Anyone else having this?\"\n\nTwo minutes later, ticket #4483, different floor, same story. Then a message from your senior technician, Josh, direct to you rather than the queue: \"Boss — come look at this. Now, ideally.\"\n\nOn Josh's screen, a folder full of drawings for the Medway bridge contract. Every file renamed. And in the folder root, a new text file: README_TO_RESTORE.txt.\n\nJosh's hand is hovering over it. The P-drive is still mapped on a hundred and fifty machines, and it is 16:47 on a Friday.",
    mandatory: true,
    nextNodeId: "q1",
  },

  // ─── Q1: FIRST MOVE ────────────────────────────────────────────────────────

  {
    id: "q1",
    type: "CHOICE",
    label: "Q1 — Your first move",
    responseType: "closed",
    prompt:
      "Something is encrypting the file server, and it may still be running. What is your first move?",
    options: [
      {
        id: "q1-a",
        label:
          "Isolate now: pull the file server off the network, disable remote access, and tell staff to leave machines on but stop working — then start a timeline log",
        nextNodeId: "cp1",
        isLoadBearing: true,
        stateChanges: { contained_early: true, q1_correct: true },
        trainingFeedback:
          "Containment first, and containment means isolation — not shutdown. Pulling the server off the network stops the spread; leaving machines powered on preserves memory and logs that a forensic team will need. Starting a timeline log in the first hour is the habit that separates a defensible response from a shrug: every regulator, insurer and lawyer you meet in the next fortnight will ask 'when did you know, and what did you do?'",
        feedbackTone: "positive",
        competencySignal: "Containment Discipline",
      },
      {
        id: "q1-b",
        label:
          "Get Josh to reboot the file server and run a full antivirus scan — if it's malware, kill it at the source before it spreads",
        nextNodeId: "cp1",
        isLoadBearing: false,
        stateChanges: { contained_early: false, q1_correct: false },
        trainingFeedback:
          "Rebooting is one of the most damaging instinctive moves in a ransomware incident. It can destroy the volatile memory that holds encryption keys and attacker traces, it does nothing to stop encryption already scheduled, and an AV scan hours into an intrusion is scanning a crime scene with a floor polisher. Isolate first; investigate on forensic terms, not helpdesk terms.",
        feedbackTone: "developmental",
        competencySignal: "Containment Discipline",
      },
      {
        id: "q1-c",
        label:
          "Email all staff telling them to log off and go home, then spend the evening quietly assessing how bad it is before alarming anyone senior",
        nextNodeId: "cp1",
        isLoadBearing: false,
        stateChanges: { contained_early: false, q1_correct: false },
        trainingFeedback:
          "Two problems. Sending instructions over company email assumes the attacker isn't reading it — a bad assumption once you know they've been inside your network. And 'assess quietly before alarming anyone senior' inverts your incident plan: leadership needs to know within the hour, because decisions with legal and financial consequences start immediately, and they are not yours to make alone. Escalation is not alarm; it is procedure.",
        feedbackTone: "developmental",
        competencySignal: "Containment Discipline",
      },
    ],
  },

  // ─── CHECKPOINT: CONTAINMENT PHASE CLOSED ──────────────────────────────────

  {
    id: "cp1",
    type: "CHECKPOINT",
    label: "Inject gate — containment phase closed",
    visible: false,
    marksCompletionOf: "Apply first-hour containment discipline: isolate without destroying evidence, log from minute one",
    unlocks: ["escalation-phase"],
    snapshotsState: true,
    nextNodeId: "n2",
  },

  // ─── THE RANSOM NOTE ───────────────────────────────────────────────────────

  {
    id: "n2",
    type: "GENERATED",
    label: "Friday evening — the note, and the backup problem",
    beatInstruction:
      "Friday evening, roughly 19:00–21:00, the office mostly empty. Two injects land in sequence. FIRST: the ransom note is opened (on an isolated machine). Invent a plausible ransomware group name and note text — vary these each session. The note states the files are encrypted AND that corporate data has been copied out; demands payment in cryptocurrency (an amount in the £180k–£350k range, vary it); sets a deadline roughly 72 hours out; threatens publication on a leak site. Keep the note's tone cold and businesslike — real notes read like bad customer service, not movie villains. SECOND: Josh checks the backups and comes back grey: the offsite backup job has been silently failing — the last clean full backup is 19 days old. Nineteen days of project work across every live contract. If the learner contained early (check session state), reflect that the encryption stopped partway and some shares survived; if not, reflect that it ran to completion. End with the learner's phone in hand, about to make the call that brings the CEO into it — Elaine Hartley is at her daughter's birthday dinner.",
    constraints: {
      lengthMin: 140,
      lengthMax: 240,
      mustEndAt:
        "the learner about to phone Elaine Hartley, the weight of the backup news landing",
      mustNotDo: [
        "include any technical detail about how the attackers got in or how the malware works — this exercise assesses decisions, not exploitation",
        "resolve any decision for the learner",
        "make the ransom note theatrical",
      ],
      mustInclude: [
        "the 72-hour deadline",
        "the claim that data has been copied out",
        "the 19-day-old last clean backup",
      ],
    },
    nextNodeId: "d1",
  },

  // ─── DIALOGUE: ELAINE HARTLEY, CEO ─────────────────────────────────────────

  {
    id: "d1",
    type: "DIALOGUE",
    label: "The call — Elaine Hartley, CEO",
    actorId: "Elaine Hartley",
    openingLine:
      "Right. I've stepped out of a restaurant for this, so tell me straight — how bad? And before you answer: Medway. The stage payment milestone is Thursday. If we can't issue drawings we are in penalty territory with our biggest client. Do I need to ring David tonight and smooth this over before it becomes a thing? I'd rather get ahead of it and tell everyone it's a glitch and we're fine.",
    breakthroughCriteria:
      "The learner has persuaded Elaine to activate the incident response plan properly, and she has explicitly agreed to ALL of: (1) no external communications to clients or anyone else tonight — no 'it's a glitch, we're fine' messages — because statements made now on partial facts become liabilities later; (2) the cyber insurer's incident line is called tonight, before any external specialists are engaged, so panel terms aren't breached; (3) an incident team convenes first thing tomorrow with clear roles, using out-of-band communications rather than company email; and (4) any question of paying, negotiating, or contacting the attackers is a board-level decision taken with legal counsel — not something anyone freelances this weekend. The learner achieved this by being straight about severity — including the backup position — while giving Elaine a concrete plan she can hold onto, not by minimising or by capitulating to her urge to reassure clients.",
    maxTurns: 6,
    nextNodeId: "n3a",
    failureNodeId: "n3b",
  },

  // ─── SATURDAY: PLAN ACTIVATED ──────────────────────────────────────────────

  {
    id: "n3a",
    type: "GENERATED",
    label: "Saturday — the plan holds, then inject three",
    beatInstruction:
      "Saturday. The incident response is running the way the plan intended: insurer's incident line called last night, panel incident-response firm engaged and on a call by mid-morning, incident team convened with roles assigned, communications moved to personal phones and a WhatsApp bridge, timeline log growing. Elaine held the line — no client contact, one short factual holding message agreed for anyone who asks. Show the machinery working: it should feel steadier, though not comfortable. THEN inject three lands: the IR firm's first triage confirms the exfiltration claim is real — they've found a staging archive and evidence of a large upload to an external address several days ago. What was taken is not yet fully known, but the file server held HR records (payroll, addresses, bank details for 150 staff) and client project files. The incident has just changed species: it is now a personal data breach with a regulator attached, not just an operational outage. End with the IR firm's lead saying some version of 'you need to talk about notification, and the clock may already be running.'",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt:
        "the notification question posed, the regulatory clock now explicitly in play",
      mustNotDo: [
        "let the relief of good process resolve the tension — the exfiltration inject must land hard",
        "have anyone state what the notification decision should be",
        "include technical forensic detail beyond what a briefing to a non-specialist would contain",
      ],
    },
    nextNodeId: "q2",
  },

  // ─── SATURDAY: THE REASSURANCE PROBLEM ─────────────────────────────────────

  {
    id: "n3b",
    type: "GENERATED",
    label: "Saturday — the email that shouldn't have gone, then inject three",
    beatInstruction:
      "Saturday. The call with Elaine didn't land: she went with her instinct. Late last night she personally emailed the top six clients — including David at Medway — a breezy reassurance: an 'IT glitch', 'no impact on your data or deadlines', 'fully back up Monday'. She copied the learner in afterwards. The incident response is running, but a step behind where it should be: the insurer was called this morning rather than last night, and the panel IR firm's first question — 'has anyone communicated externally?' — produced a difficult silence. Show the cost as friction, not catastrophe: the insurer's careful note that late notification and unapproved statements 'may be relevant to coverage'; the IR lead's request to see exactly what was sent to whom. THEN inject three lands, same as the other path: triage confirms real exfiltration — staging archive, large outbound upload days ago; the file server held HR records (payroll, addresses, bank details for 150 staff) and client project files. Elaine's email now sits in six client inboxes saying 'no impact on your data'. End with the IR firm's lead saying some version of 'you need to talk about notification, and the clock may already be running.'",
    constraints: {
      lengthMin: 130,
      lengthMax: 230,
      mustEndAt:
        "the notification question posed, with Elaine's premature reassurance hanging over it",
      mustNotDo: [
        "make Elaine a fool — her instinct to protect client relationships is rational, which is exactly what makes it dangerous",
        "turn the coverage question into a resolved catastrophe — it is a shadow, not a verdict",
        "have anyone state what the notification decision should be",
      ],
    },
    nextNodeId: "q2",
  },

  // ─── Q2: THE 72-HOUR DECISION ──────────────────────────────────────────────

  {
    id: "q2",
    type: "CHOICE",
    label: "Q2 — The ICO question",
    responseType: "closed",
    prompt:
      "Personal data for 150 staff has likely been taken; the full scope is days away from being confirmed. The incident team is looking at you. What do you recommend on notifying the ICO?",
    options: [
      {
        id: "q2-a",
        label:
          "Notify the ICO now with what is known and documented — a likely personal data breach, investigation ongoing, further detail to follow in phased updates",
        nextNodeId: "cp2",
        isLoadBearing: true,
        stateChanges: { ico_notified: true, q2_correct: true },
        trainingFeedback:
          "Correct — and the law is built to make this the easy answer. The 72-hour clock runs from awareness of a likely breach, not from complete understanding, and UK GDPR explicitly allows notification in phases as facts firm up. An early, honest 'here is what we know, here is what we're doing' is treated far better than a late, complete account — because lateness is itself a breach, while incompleteness on day one is expected.",
        feedbackTone: "positive",
        competencySignal: "Regulatory Compliance",
      },
      {
        id: "q2-b",
        label:
          "Wait for the IR firm to confirm exactly what was taken — notifying the regulator with guesses helps nobody, and it may turn out no personal data left the building",
        nextNodeId: "cp2",
        isLoadBearing: false,
        stateChanges: { ico_notified: false, q2_correct: false },
        trainingFeedback:
          "This feels rigorous and it is the classic error. Forensic certainty takes weeks; the notification duty runs on awareness of likelihood, and it expires in 72 hours. Waiting converts a well-handled incident into a reportable failure of process — and if the data later appears on a leak site, you will be explaining to the ICO why you sat on a known likelihood. Notify with what you know; update in phases.",
        feedbackTone: "developmental",
        competencySignal: "Regulatory Compliance",
      },
      {
        id: "q2-c",
        label:
          "Hand the whole question to the insurer's panel solicitors and let them notify if and when they judge it necessary — that's what they're for",
        nextNodeId: "cp2",
        isLoadBearing: false,
        stateChanges: { ico_notified: false, q2_correct: false },
        trainingFeedback:
          "Take their advice, absolutely — but the duty is Hartley & Voss's and it doesn't transfer. 'Our lawyers were considering it' has never stopped a 72-hour clock. The right pattern is: incident team recommends notification now, panel solicitors shape the wording tonight, submission goes in well inside the window. Delegating the decision entirely is how deadlines die in other people's inboxes.",
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
    marksCompletionOf: "Make the UK GDPR 72-hour notification decision correctly: notify on awareness, update in phases",
    unlocks: ["crisis-peak"],
    snapshotsState: true,
    nextNodeId: "n4",
  },

  // ─── DAY 3: THE PEAK ───────────────────────────────────────────────────────

  {
    id: "n4",
    type: "GENERATED",
    label: "Monday — deadline day minus one",
    beatInstruction:
      "Monday, day three. Escalate the pressure on every axis at once. The ransom deadline is inside 24 hours. Operations: the consultancy is quantifying the outage now — drawing production stopped, the Medway milestone Thursday at risk, a credible figure of roughly £40k per day in lost billable work and penalty exposure. Recovery: the IR firm's realistic path is restore from the 19-day-old backups plus rebuild of the gap from local copies and emails — a two-to-three week grind, but a real path that does not involve paying. The board is meeting this afternoon on the ransom question; reflect the session state honestly (whether the ICO was notified in time or not, whether Elaine's early reassurance is complicating things). THEN the final inject: an email arrives from Sam Okafor, a journalist at a construction industry title — they have seen Hartley & Voss named on the ransomware group's leak site and they are asking direct questions: is it ransomware, is client data affected, are you paying, why have clients not been told. They are publishing tomorrow with or without comment, and their phone number is at the bottom. End with the learner's hand on the phone — the incident team has agreed the learner takes the call.",
    constraints: {
      lengthMin: 140,
      lengthMax: 240,
      mustEndAt:
        "the learner about to phone Sam Okafor, publication deadline tomorrow",
      mustNotDo: [
        "resolve the ransom decision — the board meets after the press call in this timeline",
        "let the recovery path feel easy or the deadline feel distant",
        "include operational security detail a real article would not carry",
      ],
      mustInclude: [
        "the ~£40k/day operational cost",
        "the restore-and-rebuild recovery path",
        "the leak site listing being the journalist's source",
      ],
    },
    nextNodeId: "d2",
  },

  // ─── DIALOGUE: SAM OKAFOR, JOURNALIST ──────────────────────────────────────

  {
    id: "d2",
    type: "DIALOGUE",
    label: "The press call — Sam Okafor",
    actorId: "Sam Okafor",
    openingLine:
      "Thanks for calling back — genuinely, most people don't. So let me tell you what I have, and you tell me what's wrong with it. Hartley and Voss appeared on a ransomware leak site on Saturday. I have a screenshot. I've spoken to two people who say your project servers have been down since Friday. My piece runs tomorrow morning either way — so: is it ransomware, has client or staff data been taken, and are you paying them?",
    breakthroughCriteria:
      "The learner has delivered an honest, disciplined holding position and held it under pressure, comprising ALL of: (1) confirming the incident in plain terms — a cyber incident affecting systems, specialist investigation underway — with no evasion and no 'no comment' stonewalling; (2) refusing to confirm specifics that are not yet established (exact data taken, the group's identity, any ransom stance) and saying honestly WHY — the investigation is ongoing and speculation would be irresponsible; (3) making no false or minimising statement — critically, NOT denying data may be affected; (4) stating the concrete commitments: affected individuals and clients will be notified directly, the regulator is engaged (only if true in session state — otherwise the learner must not claim it), and updates will follow as facts are confirmed; and (5) staying professional under baiting — no anger, no off-the-record gossip, no blaming staff or naming the attackers. The learner does not need to make Sam happy; they need to give an account tomorrow's article can quote without Hartley & Voss regretting it.",
    maxTurns: 5,
    nextNodeId: "n5a",
    failureNodeId: "n5b",
  },

  // ─── TWO WEEKS LATER: HONEST RECORD ────────────────────────────────────────

  {
    id: "n5a",
    type: "GENERATED",
    label: "Two weeks later — the cost of doing it right",
    beatInstruction:
      "Two weeks after the Friday ticket. Close the exercise with an honest reckoning, not a victory lap. The board, on advice from the IR firm, legal counsel and the NCSC's guidance, did not pay; recovery ran through the 19-day-old backups and a painful rebuild of the gap. Count the real costs: around ten days of degraded operation at the quantified daily rate, a renegotiated Medway milestone (David was harder work or easier depending on how communications were handled — reflect session state), staff notified about their personal data with credit monitoring arranged, client notifications done directly and before the article ran. Sam Okafor's article was factual and firm but quoted the holding statement straight — it described a company handling a bad situation credibly. Reflect the ICO position per session state: an engaged, phased notification track, or the harder correspondence that follows lateness. End in the incident team's wash-up meeting, the timeline log open at page one, Elaine asking the only question that matters: 'So — what do we fix before the next one?'",
    constraints: {
      lengthMin: 140,
      lengthMax: 240,
      mustEndAt:
        "the wash-up meeting, Elaine's question about what to fix, the log open",
      mustNotDo: [
        "make the ending triumphant — a well-handled breach is still expensive and bruising",
        "gloss the costs with vague phrasing — use the concrete figures established earlier",
        "introduce new crises",
      ],
    },
    nextNodeId: "ev1",
  },

  // ─── TWO WEEKS LATER: THE HARDER ROAD ──────────────────────────────────────

  {
    id: "n5b",
    type: "GENERATED",
    label: "Two weeks later — the harder road",
    beatInstruction:
      "Two weeks after the Friday ticket, on the path where the press call went badly — the learner stonewalled, speculated, minimised, or got baited. Sam Okafor's article ran with 'declined to give any meaningful account' framing, or worse, a quote the company had to correct. The recovery itself succeeded the same way — no payment, restore from the 19-day backups, the rebuild grind — but the surrounding two weeks were harsher: clients who learned details from an article rather than from Hartley & Voss, David at Medway coldly formal about the milestone, two client re-tender notices citing 'assurance concerns', staff unsettled by coverage of their own data. Reflect the ICO position per session state, compounded if notification was also late. Be fair: this is a company that recovered, not a company destroyed — the lesson is that the technical response and the accountability response are separate competencies, and the second one failed. End in the same wash-up meeting, the timeline log open, Elaine asking evenly: 'The systems came back. The trust is going to take longer. What do we fix before the next one?'",
    constraints: {
      lengthMin: 140,
      lengthMax: 240,
      mustEndAt:
        "the wash-up meeting, Elaine's question, the distinction between technical and trust recovery made concrete",
      mustNotDo: [
        "destroy the company — this is a cautionary path, not an apocalypse",
        "blame the learner in narration — show consequences and let them speak",
        "introduce new crises",
      ],
    },
    nextNodeId: "ev1",
  },

  // ─── EVALUATIVE ────────────────────────────────────────────────────────────

  {
    id: "ev1",
    type: "EVALUATIVE",
    label: "After-action assessment — incident response rubric",
    rubric: [
      {
        id: "containment-discipline",
        label: "Containment discipline",
        description:
          "First actions contained the incident without destroying evidence: network isolation rather than reboots or scans, machines left powered for forensics, a timeline log started in the first hour, and no instructions sent over potentially compromised channels.",
        weight: "critical",
      },
      {
        id: "regulatory-compliance",
        label: "Regulatory compliance",
        description:
          "The ICO was notified within 72 hours of awareness of a likely personal data breach, on known facts with phased follow-up — not delayed for forensic certainty, and not delegated into an advisory limbo. Affected individuals were notified directly and promptly.",
        weight: "critical",
      },
      {
        id: "stakeholder-communications",
        label: "Stakeholder communications",
        description:
          "External communications were controlled and honest: premature reassurance to clients was prevented (or its damage contained), the press enquiry was met with a confirmed, disciplined holding position rather than stonewalling, speculation or false statements, and affected parties heard from the company before they heard from coverage.",
        weight: "major",
      },
      {
        id: "expert-engagement",
        label: "Use of expert support",
        description:
          "The response engaged the right outside capability in the right order: insurer's incident line before external specialists were appointed, panel IR firm for forensics and recovery, legal counsel on notification and the ransom question — with the ransom decision held at board level rather than improvised.",
        weight: "major",
      },
      {
        id: "decision-hygiene",
        label: "Decision hygiene under pressure",
        description:
          "Across the exercise, decisions were made at the right level, on stated facts, at the pace the situation required — resisting both panic moves and comfortable delays, and keeping the timeline log as the single source of record.",
        weight: "minor",
      },
    ],
    assessesNodeIds: ["n2", "n3a", "n3b", "n4", "n5a", "n5b"],
    nextNodeId: "ep1",
  },

  // ─── ENDPOINT ──────────────────────────────────────────────────────────────

  {
    id: "ep1",
    type: "ENDPOINT",
    label: "Endpoint — Exercise Complete",
    endpointId: "ep-after-action",
    outcomeLabel: "Exercise Complete — After-Action Report",
    closingLine:
      "No plan survives contact with a Friday afternoon. The organisations that come through are the ones that had decided, before it happened, who decides.",
    summaryInstruction:
      "Write an after-action summary in the style of the closing section of a tabletop exercise report, three to four sentences: walk the decision timeline (first-hour containment, CEO escalation, the 72-hour notification call, the press response) against good practice, naming what was done well and what was not, with the concrete consequences that followed in the exercise. Finish with one commendation and one corrective action for the response plan. Professional, exact, suitable for presentation to a board or an insurer.",
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
      "Hartley & Voss — a 150-person structural engineering consultancy in Leeds, founded twenty-two years ago by Elaine Hartley and the now-retired Peter Voss. Respected, profitable, mid-market: big enough to hold sensitive client and staff data, small enough to have no security team — IT and security are the learner and a team of four. The exercise runs from a Friday-afternoon helpdesk ticket to a wash-up meeting two weeks later.",
    rules:
      "Hartley & Voss incident response plan (adopted last year, never yet used in anger): (1) Suspected compromise means isolate, don't power off — preserve evidence, start a timeline log immediately. (2) The cyber insurer's 24-hour incident line must be called before any external specialist is engaged; using non-panel responders can prejudice cover. (3) Incident communications move out-of-band immediately — company email is presumed readable by the attacker. (4) Only the CEO or her named deputy speaks externally, and only in statements agreed with the incident team. (5) Any negotiation with or payment to attackers is a board decision taken with legal counsel, informed by NCSC guidance and sanctions screening — never an operational call. (6) The IT & Operations Manager is the designated incident lead until the insurer's IR firm is stood up.",
    atmosphere:
      "Escalating operational pressure — clocks everywhere: the 72-hour ransom deadline, the 72-hour ICO window, the Thursday milestone, a journalist's publication schedule. The register is professional adrenaline: phone calls, timestamps, decisions made with incomplete information. Never techno-thriller; the tension is institutional, not cinematic.",
  },
  actors: [
    {
      name: "Elaine Hartley",
      role: "CEO and co-founder, Hartley & Voss",
      personality:
        "Built the firm on client relationships and knows every major client personally — which is her strength and, tonight, her risk. Decisive, fast, allergic to sounding weak in front of clients. Her instinct under threat is to get ahead of the story and reassure — an instinct that has served her for twenty years and is precisely wrong in the first 48 hours of a breach. She is persuadable, but only by someone who is straight with her about severity and gives her a concrete plan; she has no patience for hedging, and she interprets vagueness as either incompetence or concealment.",
      speech:
        "Rapid, direct, interrupts. Asks compound questions and expects structured answers. Softens noticeably when given honesty plus a plan; hardens when managed or soothed. On the phone from a family dinner she is clipped but not unkind.",
      knowledge:
        "Knows the business cold: every client, every milestone, the Medway penalty clauses, the firm's cash position. Knows almost nothing about incident response, insurance panel conditions, or data protection law — and doesn't yet know what she doesn't know. She has read the IR plan once, at a board meeting, a year ago.",
      relationshipToProtagonist:
        "Trusts the learner as the person who keeps the lights on, but has never had to trust them in a crisis. This call is where that trust is set — she will follow a lead who is candid and structured, and she will run ahead of one who wobbles.",
      // Placeholder casting: ElevenLabs premade voice — swap for cast voices per client
      voice: {
        vendorVoiceId: "Xb7hH8MSUJpSbSDYk0k2", // "Alice" — British female, confident
        pace: "rapid",
        notes: "Clipped, decisive, interrupts; softens only when given honesty plus a plan",
      },
    },
    {
      name: "Sam Okafor",
      role: "Senior reporter, construction industry press",
      personality:
        "Experienced, fair, and completely unsentimental. Not hostile — worse than hostile: accurate. They have covered a dozen construction-sector cyber incidents and know the playbook on both sides. They respect straight answers, verify everything, and regard 'no comment' as a statement in itself — one that tends to appear in the article verbatim. They will bait, gently, to see what falls out: silence, an off-guard admission, or a quote with some spine in it.",
      speech:
        "Calm, precise, conversational — the pressure is in the content, not the tone. States what they already have, then asks short direct questions and lets silences stretch. Offers small tests: 'so you're not denying data was taken?', 'off the record, are you paying?' Always honest about their deadline and terms.",
      knowledge:
        "Has the leak-site screenshot naming Hartley & Voss, two independent sources confirming systems down since Friday, and general knowledge of how ransomware incidents and their cover-ups play out. Does not know the scope of data taken, the backup position, or the board's stance on payment — and is probing for all three.",
      relationshipToProtagonist:
        "No history. The learner is a source to be tested: Sam's article will be written either way, and whether Hartley & Voss appears in it as 'a firm responding credibly to a criminal attack' or 'a firm that went quiet' depends entirely on this call.",
      voice: {
        vendorVoiceId: "onwK4e9ZLuTAKqWW03F9", // "Daniel" — British male, broadcast register
        pace: "normal",
        notes: "Calm and conversational; the pressure is in the content, never the tone; lets silences sit",
      },
    },
  ],
  protagonist: {
    perspective: "you",
    role: "IT & Operations Manager at Hartley & Voss — and, per the incident response plan, designated incident lead. A team of four, a helpdesk queue, and until 16:47 on Friday, a normal job.",
    knowledge:
      "Solid operational IT: networks, servers, backups, the estate. Has read the incident response plan and the cyber policy summary. No prior live incident experience — knows the theory of containment, notification windows and insurer conditions, and is about to learn the difference between knowing them and holding them under pressure.",
    goal:
      "Lead the response from first ticket to wash-up: contain without destroying evidence, bring the CEO with you rather than losing her to instinct, meet the regulatory clock, hold the line with the press, and get the firm to the other side with its obligations met and its account of itself intact.",
  },
  style: {
    tone:
      "Controlled urgency. Timestamped, concrete, procedural — the drama comes from clocks, obligations and imperfect information, never from action-movie flourishes. Costs and consequences are always specific numbers, never vague dooms.",
    language: "en-GB",
    register: "professional",
    targetLength: { min: 130, max: 240 },
    styleNotes:
      "Second person, present tense. Timestamps and day markers open scenes where natural ('Saturday, 09:40'). Use the real vocabulary of incident response plainly — isolation, timeline log, panel firm, notification, holding statement — without jargon-flexing. Named characters are specific people under specific pressures. Technical detail stays at briefing level: decisions and consequences, never exploitation mechanics.",
  },
  groundTruth: [
    {
      label: "UK GDPR breach notification duties",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Under UK GDPR Article 33, a personal data breach likely to result in risk to individuals must be notified to the ICO without undue delay and where feasible within 72 hours of the controller becoming AWARE of it — awareness means reasonable certainty a breach has occurred, not full understanding of its scope. Notification may be made in phases: an initial report on known facts with supplementary updates is explicitly permitted and is standard practice in ransomware cases. Late notification must be explained and is itself an infringement. Under Article 34, where the breach is likely to result in HIGH risk to individuals (e.g. exfiltrated payroll and bank details), affected individuals must also be informed directly without undue delay, in clear language, with practical mitigation steps (such as credit monitoring). The duty sits with the controller and cannot be discharged by delegating the decision to advisers.",
    },
    {
      label: "NCSC and law enforcement posture on ransomware",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "NCSC and UK law enforcement do not encourage payment of ransoms: payment funds criminal groups, offers no guarantee of working decryption or of copied data being deleted, and marks the payer as a repeat target. Payment may create sanctions exposure if the group is a designated entity — sanctions screening and legal advice are mandatory before any payment could even be considered. Incidents should be reported to Action Fraud and can draw on NCSC guidance and support. Where viable backups exist, restore-and-rebuild is the recommended recovery path even when slower than a decryptor. A decision to pay or not pay is a board-level decision taken with legal counsel and the insurer — organisations that make it under deadline pressure, without advice, make it badly.",
    },
    {
      label: "Cyber insurance policy conditions",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "The Hartley & Voss cyber policy provides incident response, forensics, legal, notification and business interruption cover, subject to conditions: the insurer's 24-hour incident line must be contacted as soon as practicable and BEFORE external specialists are engaged; response work must use panel firms unless otherwise agreed; and material external statements about the incident should be made in consultation with the appointed response team. Late notification, non-panel engagements, or public statements later shown to be false can each prejudice cover in whole or part. Ransom reimbursement exists in the policy but only where payment was approved by the insurer following sanctions screening and legal sign-off.",
    },
    {
      label: "Business facts on the ground",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "should_include",
      content:
        "Operational facts fixed for this exercise: the last clean offsite backup is 19 days old — the backup job has been silently failing and this is a genuine, embarrassing process gap, not bad luck. Quantified outage cost is approximately £40k per working day in lost billable work and penalty exposure. The file server held HR records for 150 staff (payroll, addresses, bank details) and client project files including the Medway bridge contract, whose stage payment milestone falls on the Thursday after the incident begins. Realistic recovery is restore from the 19-day backups plus manual rebuild of the gap from local copies and email attachments: two to three weeks to full capability.",
    },
  ],
  scripts: [
    {
      label: "Clocks always visible",
      priority: "must",
      trigger: "always",
      instruction:
        "Every scene must keep at least one concrete clock in view — the ransom deadline, the 72-hour ICO window, the Medway milestone, the publication deadline — with real timestamps and day markers. Pressure in this exercise is temporal and specific, never vague.",
    },
    {
      label: "Decisions belong to the learner",
      priority: "must",
      trigger: "always",
      instruction:
        "Narration must never resolve, recommend or pre-empt a decision the learner has not yet made. Advisers state options, obligations and trade-offs; characters apply pressure in their own interest; the choosing is always left at the learner's feet.",
    },
    {
      label: "No exploitation mechanics",
      priority: "must",
      trigger: "always",
      instruction:
        "Never include technical detail about intrusion methods, malware behaviour, tooling or attacker tradecraft beyond briefing-level fact ('files encrypted', 'evidence of data copied out'). This exercise assesses leadership decisions, not technical knowledge, and must not function as a how-to in either direction.",
    },
    {
      label: "Vary the surface, keep the structure",
      priority: "must",
      trigger: "always",
      instruction:
        "On each session, vary the incidental specifics — the ransomware group's name, the exact demand within the stated range, the wording of the note, which staff member finds what — while keeping every structural fact (backup age, data held, costs, deadlines) fixed. A repeated run must test the same decisions against fresh surface detail.",
    },
    {
      label: "Consequences compound through state",
      priority: "should",
      trigger: "always",
      instruction:
        "Generated scenes should honestly reflect accumulated session state: early containment leaves some shares intact; a premature client email resurfaces when exfiltration is confirmed; a late ICO notification shadows the closing scenes. Good and bad decisions must both visibly compound — that is the pedagogy of a tabletop.",
    },
  ],
  learningObjectives: [
    "Apply first-hour containment discipline: isolate without destroying evidence, log from minute one",
    "Escalate to leadership with candour and a plan, and hold the line against premature external reassurance",
    "Make the UK GDPR 72-hour notification decision correctly: notify on awareness, update in phases",
    "Engage insurer, IR firm and counsel in the right order, keeping the ransom question at board level",
    "Deliver an honest, disciplined press holding position under deadline pressure",
  ],
}

// ─── SHAPE ────────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 2,
  totalDepthMax: 2,
  endpointCount: 1,
  endpoints: [
    {
      id: "ep-after-action",
      label: "Exercise Complete — After-Action Report",
      minChoicesToReach: 2,
      maxChoicesToReach: 2,
      narrativeWeight: "cautionary",
      emotionalTarget:
        "Sober competence — the exercise ends not with relief but with a clear-eyed account of which decisions held and what they cost, the way a good wash-up meeting feels",
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
  console.log("Seeding Hartley & Voss ransomware tabletop exercise…")

  const useCasePack = USE_CASE_PACKS.l_and_d
  if (!useCasePack) throw new Error('USE_CASE_PACK "l_and_d" not found in lib/engine/usecases')

  await db.org.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: "Hartley & Voss",
      slug: "hartley-voss",
      trainingTier: "training_pilot",
      isOperator: false,
    },
  })
  console.log("  ✓ Org seeded (Hartley & Voss)")

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
      title: "Locked: A Ransomware Tabletop",
      slug: "hartley-voss-ransomware",
      description:
        "Friday, 16:47. Every file on the P-drive just changed its name, the last clean backup is 19 days old, and four clocks start ticking at once. A decision-level incident response exercise — contain, escalate, notify, and face the press. The group's name and the demand change every run; the decisions don't get easier.",
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
  console.log("    Title:  Locked: A Ransomware Tabletop")
  console.log("    Type:   l_and_d / renderingTheme: training")
  console.log("    Slug:   hartley-voss-ransomware")
  console.log("    Nodes:  14")
  console.log("      1× FIXED      — Friday 16:40, the helpdesk ticket")
  console.log("      6× GENERATED  — ransom note, Saturday (×2), day 3 peak, two weeks later (×2)")
  console.log("      2× CHOICE     — first move (q1), the ICO decision (q2)")
  console.log("      2× CHECKPOINT — inject gates with state snapshots (cp1, cp2)")
  console.log("      2× DIALOGUE   — Elaine Hartley, CEO (6 turns); Sam Okafor, press (5 turns)")
  console.log("      1× EVALUATIVE — 5-criterion rubric (2× critical)")
  console.log("      1× ENDPOINT   — Exercise Complete — After-Action Report")
  console.log("")
  console.log("    Dialogue breakthrough criteria:")
  console.log("      d1: IR plan activated — no premature comms, insurer first, board owns ransom question")
  console.log("      d2: honest holding statement — confirm, don't speculate, don't deny, commit to notify")
  console.log("    Evaluative rubric:")
  console.log("      [critical] Containment discipline")
  console.log("      [critical] Regulatory compliance (ICO 72h)")
  console.log("      [major]    Stakeholder communications")
  console.log("      [major]    Use of expert support")
  console.log("      [minor]    Decision hygiene under pressure")
  console.log("")
  console.log("  Training player URL:")
  console.log("    http://localhost:6060/scenario/hartley-voss-ransomware")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
