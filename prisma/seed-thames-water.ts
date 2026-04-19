import { PrismaClient } from "@prisma/client"
import type {
  Node,
  Segment,
  ExperienceContextPack,
  ShapeDefinition,
} from "../types/experience"
import { USE_CASE_PACKS } from "../lib/engine/usecases"

const db = new PrismaClient()

// ─── IDs ────────────────────────────────────────────────────────────────────

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000020"

// ─── NODE GRAPH — "A Day at Lee Valley" ─────────────────────────────────────
//
// Training course: Thames Water field operations technician
// 4 questions testing water quality, safety, and regulatory compliance
//
// Structure (4 CHOICE nodes, 3 branching endpoints):
//
//   n1 (FIXED: opening — morning shift at Lee Valley Works)
//     → n2 (GENERATED: monitoring console, turbidity alarm fires)
//       → q1 (CHOICE: Q1 — turbidity alarm response)
//         → n3a (GENERATED: [correct] isolated zone, supervisor notified)
//         → n3b (GENERATED: [risk] re-test only, delay in escalation)
//         Both → q2 (CHOICE: Q2 — colleague admits skipping dosing log)
//           → n5a (GENERATED: [correct] formal WIMS entry, line manager informed)
//           → n5b (GENERATED: [risk] informally backdated, not logged)
//           Both → cp1 (CHECKPOINT: Act One complete — morning shift assessed)
//             → n6 (GENERATED: afternoon shift, pump room scenario)
//               → q3 (CHOICE: Q3 — pump cavitation warning during peak demand)
//                 → n7a (GENERATED: [correct] pump isolated, maintenance ticket raised)
//                 → n7b (GENERATED: [risk] continued under manual watch, pump fails)
//                 Both → q4 (CHOICE: Q4 — customer calls about discoloured water)
//                   → n9a (GENERATED) → ep1 (ENDPOINT: Safety Champion)
//                   → n9b (GENERATED) → ep2 (ENDPOINT: Competent Practitioner)
//                   → n9c (GENERATED) → ep3 (ENDPOINT: Development Required)

const nodes: Node[] = [
  // ─── OPENING ─────────────────────────────────────────────────────────────

  {
    id: "n1",
    type: "FIXED",
    label: "Opening — Lee Valley Treatment Works",
    content:
      "6:45 am. The security barrier lifts and you pull into the car park at Thames Water's Lee Valley Water Treatment Works.\n\nThis is one of the largest water treatment facilities in the UK — 60 hectares of settlement tanks, rapid gravity filters, and chlorination plant processing up to 280 million litres of raw river water every day. Eight hundred thousand people across North London and Hertfordshire depend on what leaves this site.\n\nYou're a Field Operations Technician, eighteen months in. Your shift supervisor, Priya, meets you at the control building with a handover sheet.\n\n\"Quiet night,\" she says. \"Instruments look normal. Standard checks. I'll be in the office if you need me.\"\n\nYou sign in, pull on your PPE, and head for the monitoring console.",
    mandatory: true,
    nextNodeId: "n2",
  },

  // ─── ACT ONE: MORNING SHIFT ──────────────────────────────────────────────

  {
    id: "n2",
    type: "GENERATED",
    label: "Morning checks — turbidity alarm",
    beatInstruction:
      "The learner has arrived at the monitoring console to run the standard morning checks. Walk them through the console: flow rates, pH levels, chlorine residuals — all normal. Then, as they reach the turbidity readings for Filter Bank 3, an amber alert fires. Turbidity is reading 1.8 NTU on the filtered water outlet — above the Thames Water internal action level of 1.0 NTU and approaching the DWI regulatory limit of 4.0 NTU. The reading has been climbing for the past 20 minutes. The learner must decide what to do. End at the moment of decision with the amber light blinking on the console.",
    constraints: {
      lengthMin: 120,
      lengthMax: 220,
      mustEndAt:
        "learner at the console with the amber turbidity alert active and the decision clearly in front of them",
      mustNotDo: [
        "tell the learner what the right answer is",
        "suggest the reading might be a sensor fault",
        "mention what Priya would do",
      ],
    },
    nextNodeId: "q1",
  },

  // ─── Q1: TURBIDITY ALERT ─────────────────────────────────────────────────

  {
    id: "q1",
    type: "CHOICE",
    label: "Q1 — Turbidity alert response",
    responseType: "closed",
    options: [
      {
        id: "q1-a",
        label:
          "Isolate Filter Bank 3 from supply, take a manual confirmation sample, and notify Priya straight away",
        nextNodeId: "n3a",
        isLoadBearing: true,
        stateChanges: { q1_correct: true, performance_score: 1 },
      },
      {
        id: "q1-b",
        label:
          "Re-run the automated test — it may be sensor drift. If the second reading is the same, then escalate",
        nextNodeId: "n3b",
        isLoadBearing: true,
        stateChanges: { q1_correct: false, performance_score: 0 },
      },
    ],
  },

  // Q1 correct path
  {
    id: "n3a",
    type: "GENERATED",
    label: "Q1 correct — isolation and escalation",
    beatInstruction:
      "The learner has done exactly the right thing: isolated Filter Bank 3 from the distribution network and immediately notified their supervisor. Describe the action: they override the supply valve on Filter Bank 3, the panel registers the isolation, and they call Priya. Priya arrives within two minutes. She confirms the manual sample shows elevated particulate matter — likely a filter medium disturbance from last night's backwash cycle. The isolation was proportionate and correct. The filter is assessed, backwashed again, and brought back online within 45 minutes — well within Thames Water's SLA. Priya notes the response in WIMS. She gives a brief nod of approval — not praise, just professional acknowledgement. End with the filter back online and the learner picking up the morning's remaining task list.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt:
        "filter back online, Priya's acknowledgement given, learner picking up the task list",
      mustNotDo: [
        "be effusive with praise — keep it proportionate and professional",
        "introduce Marcus or the chlorination log yet",
      ],
    },
    nextNodeId: "n4",
  },

  // Q1 risk path
  {
    id: "n3b",
    type: "GENERATED",
    label: "Q1 risk — delayed escalation",
    beatInstruction:
      "The learner chose to re-test before escalating. Describe the second test cycle — another 8 minutes passing, the reading returning 1.9 NTU. The learner now calls Priya. Priya arrives and immediately asks why the filter wasn't isolated on the first amber reading. Explain the operational risk: for those 8 minutes, sub-optimal filtered water was within the distribution margin. Priya isolates the filter, notes the delayed response in WIMS as a process observation, and explains clearly: at Thames Water, the protocol is 'isolate first, investigate second.' A near-miss, not an incident — but a learning moment that will go into the shift log. End with Priya returning to the office and the learner back at the task list, the process observation noted.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt:
        "filter isolated, Priya's feedback absorbed, learner back at the task list",
      mustNotDo: [
        "be punitive — frame this as a learning moment, not a failure",
        "introduce Marcus or the chlorination log yet",
      ],
    },
    nextNodeId: "n4",
  },

  // Bridge: chlorination log station — Marcus introduces the problem
  {
    id: "n4",
    type: "GENERATED",
    label: "At the chlorination log — Marcus approaches",
    beatInstruction:
      "The learner has moved to the chlorination monitoring station — a separate console room adjacent to the main control building — to carry out the routine chlorine dosing log verification. The morning log should show two entries from the night shift: a dosing rate check at 22:00 and a residual confirmation at 02:00. The 22:00 entry is there. The 02:00 entry is absent. While the learner is looking at this gap, Marcus Webb — a fellow field technician finishing a handover — appears in the doorway. He's the one who was on nights. Before the learner can say anything, Marcus gets there first: 'Yeah, I know — I missed the 02:00 check. I was dealing with a drainage issue on the far side of the site. It was probably fine. I was going to... I don't know. What are you going to do?' He's not aggressive. He's uncomfortable. He's asking for help as much as anything. End with Marcus waiting for the learner's response, the unsigned log entry on the screen between them.",
    constraints: {
      lengthMin: 140,
      lengthMax: 230,
      mustEndAt:
        "Marcus waiting, unsigned log entry visible, learner must decide how to handle it",
      mustNotDo: [
        "suggest what the right answer is",
        "make Marcus hostile or defensive — he's embarrassed and uncertain",
        "resolve what the learner will do",
      ],
      mustInclude: ["the unsigned 02:00 log entry", "Marcus's explanation"],
    },
    nextNodeId: "q2",
  },

  // ─── Q2: COLLEAGUE'S MISSED PROCEDURE ────────────────────────────────────

  {
    id: "q2",
    type: "CHOICE",
    label: "Q2 — Colleague's missed dosing log",
    responseType: "closed",
    options: [
      {
        id: "q2-a",
        label:
          "Log it formally in WIMS as a procedural gap and let Priya know — it needs to be on record",
        nextNodeId: "n5a",
        isLoadBearing: true,
        stateChanges: { q2_correct: true },
      },
      {
        id: "q2-b",
        label:
          "Help Marcus fill in the gap informally — it was likely fine, and formally logging it might get him in trouble",
        nextNodeId: "n5b",
        isLoadBearing: true,
        stateChanges: { q2_correct: false },
      },
    ],
  },

  // Q2 correct path
  {
    id: "n5a",
    type: "GENERATED",
    label: "Q2 correct — formal logging and reporting",
    beatInstruction:
      "The learner has made the right call: a missed verification in a regulated water treatment process must go on record, regardless of whether it caused harm. Describe the action: the learner raises the gap in WIMS, references the correct procedure number, and notifies Priya. Priya speaks with Marcus privately. The entry reads as a procedural observation — not a formal disciplinary matter at this stage. Explain the wider context: the Drinking Water Inspectorate requires complete and unbroken process records. A backdated or undocumented verification would expose Thames Water to regulatory risk, and Marcus to far greater personal risk if a problem were discovered later and records showed falsification. Marcus thanks the learner later — reluctantly, but genuinely. End with the morning in-take checks complete, the learner heading toward the pump room for the afternoon shift's first task.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt:
        "morning records complete and accurate, learner heading to the pump room",
      mustNotDo: [
        "make Marcus into a villain — he made a mistake, not a malicious choice",
        "imply the learner has 'told on' a friend — frame it as regulatory duty",
      ],
    },
    nextNodeId: "cp1",
  },

  // Q2 risk path
  {
    id: "n5b",
    type: "GENERATED",
    label: "Q2 risk — informal cover",
    beatInstruction:
      "The learner has helped Marcus fill in the gap informally, not logging it in WIMS. Describe the short-term feeling — it felt like the right thing to do, protecting a colleague. Then explain the structural problem: water treatment records are legal documents under the Water Supply (Water Quality) Regulations 2016. An unrecorded procedural gap is a compliance breach. If a water quality incident occurred later in the same distribution zone, the missing verification would be discovered by the DWI, and both Marcus and the learner would be implicated in falsification rather than a simple procedural miss. Priya does a routine spot-check on the WIMS log later in the shift and notices the timing anomaly. She pulls the learner and Marcus into her office at the end of the shift. End with that meeting called, both of them waiting outside Priya's door.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt:
        "Priya's office door closed, learner and Marcus waiting — the conversation to come",
      mustNotDo: [
        "resolve the meeting's outcome — leave it as a consequence to sit with",
        "catastrophise — this is serious but not career-ending at this point",
      ],
    },
    nextNodeId: "cp1",
  },

  // ─── CHECKPOINT: ACT ONE COMPLETE ────────────────────────────────────────

  {
    id: "cp1",
    type: "CHECKPOINT",
    label: "Act One complete — morning shift assessed",
    visible: false,
    marksCompletionOf: "act-one-morning",
    unlocks: [],
    nextNodeId: "n6",
  },

  // ─── ACT TWO: AFTERNOON SHIFT ────────────────────────────────────────────

  {
    id: "n6",
    type: "GENERATED",
    label: "Afternoon shift — pump room scenario",
    beatInstruction:
      "Time jump to early afternoon. The morning's events have settled. The learner is now in the pump room conducting a routine inspection of the raw water transfer pumps — large submersible units that move water from the River Lee intake to the primary settlement tanks. It is a high-demand day: temperatures are up, consumption is elevated, and all four transfer pumps are running at capacity. During the walkround, the learner notices that Pump 2 has an unusual sound — a faint rhythmic cavitation, the kind that comes when a pump is working against a partially blocked intake screen or running slightly under-primed. The vibration gauge on the pump housing is reading amber at 4.8 mm/s — inside the tolerance band of 0–7 mm/s, but elevated from yesterday's 2.1 mm/s reading. End with the learner standing at the pump, gauge in hand, engine noise all around, peak demand continuing above ground.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt:
        "learner at Pump 2, elevated vibration reading confirmed, must decide what to do",
      mustNotDo: [
        "suggest what the right course of action is",
        "indicate whether the pump is about to fail or is fine",
      ],
    },
    nextNodeId: "q3",
  },

  // ─── Q3: PUMP CAVITATION WARNING ─────────────────────────────────────────

  {
    id: "q3",
    type: "CHOICE",
    label: "Q3 — Pump cavitation response",
    responseType: "closed",
    options: [
      {
        id: "q3-a",
        label:
          "Take Pump 2 offline, distribute load across the remaining three pumps, and raise a maintenance ticket with the asset team",
        nextNodeId: "n7a",
        isLoadBearing: true,
        stateChanges: { q3_correct: true },
      },
      {
        id: "q3-b",
        label:
          "Keep Pump 2 running — it's within tolerance. Log the vibration reading and check again in an hour",
        nextNodeId: "n7b",
        isLoadBearing: true,
        stateChanges: { q3_correct: false },
      },
    ],
  },

  // Q3 correct path
  {
    id: "n7a",
    type: "GENERATED",
    label: "Q3 correct — pump isolated and ticketed",
    beatInstruction:
      "The learner has taken Pump 2 offline and redistributed the load. Describe the action: they shut down Pump 2 via the local isolator, confirm the other three pumps ramp up to compensate, and raise a maintenance ticket in the asset management system citing the vibration readings and the cavitation sound. The asset team responds within 30 minutes — a maintenance technician attends, inspects the intake screen, and finds a significant debris accumulation from overnight rainfall that was restricting prime. The debris is cleared, the screen cleaned, the pump re-primed and returned to service within two hours. End with the pump room quiet again, all four pumps running normally, the learner's ticket closed as a preventive intervention — asset saved, supply uninterrupted. Shift log entry complete.",
    constraints: {
      lengthMin: 120,
      lengthMax: 210,
      mustEndAt:
        "pump room stable, all four pumps running, learner completing the shift log entry",
      mustNotDo: [
        "over-dramatise the preventive action — it was routine good practice",
      ],
    },
    nextNodeId: "q4",
  },

  // Q3 risk path
  {
    id: "n7b",
    type: "GENERATED",
    label: "Q3 risk — pump continues and fails",
    beatInstruction:
      "The learner has decided to keep Pump 2 running and monitor it. Describe the next 40 minutes: periodic checks, vibration hovering at amber, nothing dramatic. Then at 14:22 the pump trips on over-temperature. The motor winding has failed. Describe the immediate impact: three pumps now carrying load they can't sustain at peak demand, inflow rate dropping, a pressure dip appearing on the distribution system dashboard that the control room flags within seven minutes. The maintenance team are called as an emergency rather than a planned job — a significantly higher cost and a two-hour gap in intake capacity that requires emergency demand management. The post-incident review later that week will note that the original vibration reading and cavitation sound, taken together, met the criteria for a precautionary isolation under Thames Water's asset management standard. End with the pump failed, the incident report open on screen, and the learner heading for a debrief.",
    constraints: {
      lengthMin: 140,
      lengthMax: 230,
      mustEndAt:
        "pump failed, incident report open, learner heading for debrief with shift supervisor",
      mustNotDo: [
        "make this punitive — the failure happened, frame it educationally",
        "imply the learner will be dismissed",
      ],
    },
    nextNodeId: "q4",
  },

  // ─── Q4: CUSTOMER COMPLAINT — DISCOLOURED WATER ──────────────────────────

  {
    id: "q4",
    type: "CHOICE",
    label: "Q4 — Customer discolouration report",
    responseType: "closed",
    options: [
      {
        id: "q4-a",
        label:
          "Treat it as a potential water quality incident: log it in WIMS, collect a sample from the nearest distribution point, notify the shift supervisor and initiate the Thames Water customer water quality incident protocol",
        nextNodeId: "n9a",
        isLoadBearing: true,
        stateChanges: { q4_correct: true },
      },
      {
        id: "q4-b",
        label:
          "Log the complaint and pass the details to the customer services team — they handle customer contacts, not field operations",
        nextNodeId: "n9b",
        isLoadBearing: false,
        stateChanges: { q4_correct: false },
      },
      {
        id: "q4-c",
        label:
          "Reassure the customer it is likely a temporary disturbance — mains flushing nearby or a burst repair. Note it for the end-of-shift report",
        nextNodeId: "n9c",
        isLoadBearing: false,
        stateChanges: { q4_correct: false },
      },
    ],
  },

  // ─── Q4 PATHS LEADING TO ENDPOINTS ──────────────────────────────────────

  // Q4 correct path → Safety Champion endpoint
  {
    id: "n9a",
    type: "GENERATED",
    label: "Q4 correct — incident protocol initiated",
    beatInstruction:
      "The learner has correctly initiated the customer water quality incident protocol. Describe the sequence: WIMS entry with time, location, and complaint details; a distribution sample collected from the nearest hydrant point; the sample dispatched to the on-site lab; Priya notified and the duty water quality manager contacted. The lab result comes back within the hour — turbidity at 0.8 NTU, iron at 0.09 mg/l, both within regulatory limits. The discolouration is traced to a small main flushing operation by a network team two streets away — a communication failure between field teams, not a quality issue. The customer is called back by the water quality manager with a full explanation and an apology for the inconvenience. No DWI notification required. But the protocol was followed correctly: if the sample had shown a compliance failure, the rapid response would have been essential. End with Priya reviewing the learner's shift log entries — all four incidents handled and recorded. She asks them to take a seat for the end-of-shift debrief.",
    constraints: {
      lengthMin: 140,
      lengthMax: 230,
      mustEndAt:
        "all four incidents resolved and logged, end-of-shift debrief beginning",
      mustNotDo: [
        "rush the ending — give this the weight of a completed shift well handled",
      ],
    },
    nextNodeId: "ep1",
  },

  // Q4 partial path → Competent Practitioner endpoint
  {
    id: "n9b",
    type: "GENERATED",
    label: "Q4 partial — complaint passed to customer services",
    beatInstruction:
      "The learner has passed the complaint to customer services. Describe the gap: customer services are trained to handle billing and service complaints — not water quality incidents. The complaint sits in a queue for 40 minutes before a customer services agent recognises the language and escalates it to the field ops duty line. By the time Priya is notified, it has been 55 minutes since the original call. The distribution sample is collected and the result is clear — not a quality issue. But the Water Supply (Water Quality) Regulations require that a water quality complaint from a member of the public is treated as a potential incident until sampling proves otherwise, not routed through customer services as a general enquiry. Priya explains this in the debrief: the 55-minute delay would have mattered if the sample had shown a compliance breach. Water quality complaints route directly to operations, not customer services. End with the end-of-shift debrief in progress, Priya working through the learner's four decisions.",
    constraints: {
      lengthMin: 130,
      lengthMax: 220,
      mustEndAt: "end-of-shift debrief in progress, Priya reviewing decisions",
      mustNotDo: [
        "make Priya harsh — this is coaching, not dressing-down",
        "imply the learner has failed",
      ],
    },
    nextNodeId: "ep2",
  },

  // Q4 risk path → Development Required endpoint
  {
    id: "n9c",
    type: "GENERATED",
    label: "Q4 risk — customer reassured, not logged",
    beatInstruction:
      "The learner has reassured the customer and noted the call for the shift report. Describe the consequences: no WIMS entry, no sample taken, no supervisor informed. The call is not logged in the incident register at all. Three hours later, a second customer from the same street calls — same complaint, more agitated. Now a third call, this time to the out-of-hours duty line. The duty manager calls Priya, who pulls the shift log and finds nothing. She calls the learner. Explain the regulatory position: under the Water Industry Act and the DWI reporting framework, multiple customer contacts about the same apparent quality issue, if not captured in the incident register, constitute a regulatory near-miss — potentially a reportable failure depending on what the samples show. A distribution sample is taken at 21:00 — result is clear, no quality issue. But the failure to log and sample at first contact is the critical gap. End with the learner in Priya's office the next morning, a formal development plan on the table.",
    constraints: {
      lengthMin: 140,
      lengthMax: 230,
      mustEndAt:
        "formal development plan on the table, Priya beginning the structured conversation",
      mustNotDo: [
        "suggest dismissal or anything disproportionate",
        "resolve the meeting — end at the start of the conversation",
      ],
    },
    nextNodeId: "ep3",
  },

  // ─── ENDPOINTS ────────────────────────────────────────────────────────────

  {
    id: "ep1",
    type: "ENDPOINT",
    label: "Endpoint — Safety Champion",
    endpointId: "ep-champion",
    outcomeLabel: "Safety Champion",
    closingLine:
      "Four decisions, four correct calls. The water left this site clean and safe today. It did yesterday too — and will again tomorrow. That is what this work is.",
    summaryInstruction:
      "Write two sentences summarising the learner's performance: they handled an automated turbidity alarm correctly with immediate isolation and escalation; they maintained regulatory record integrity under social pressure; they made a precautionary asset management call that prevented equipment failure; and they correctly initiated the water quality incident protocol on a customer complaint. Acknowledge their consistent application of Thames Water's operational standards.",
    outcomeCard: {
      shareable: true,
      showChoiceStats: true,
      showDepthStats: false,
      showReadingTime: true,
    },
  },
  {
    id: "ep2",
    type: "ENDPOINT",
    label: "Endpoint — Competent Practitioner",
    endpointId: "ep-competent",
    outcomeLabel: "Competent Practitioner",
    closingLine:
      "Good instincts, sound intent — a few of the edges still need sharpening. That is what this kind of day is for.",
    summaryInstruction:
      "Write two sentences summarising the learner's performance across the four scenarios, noting where their decisions were strong and identifying the specific area where their response did not fully meet the required standard. Frame it as developmental — they are on the right trajectory but there is a defined area for improvement.",
    outcomeCard: {
      shareable: false,
      showChoiceStats: true,
      showDepthStats: false,
      showReadingTime: true,
    },
  },
  {
    id: "ep3",
    type: "ENDPOINT",
    label: "Endpoint — Development Required",
    endpointId: "ep-development",
    outcomeLabel: "Development Required",
    closingLine:
      "The water was safe today. But safe by luck is not the same as safe by practice. The difference matters — and so does getting this right.",
    summaryInstruction:
      "Write two sentences honestly summarising the learner's performance: identify the two or three decisions across the four scenarios that fell below the required standard, and frame the development plan not as a punishment but as the structured support they need to reach the competency level that this role requires. Be direct but not harsh.",
    outcomeCard: {
      shareable: false,
      showChoiceStats: true,
      showDepthStats: false,
      showReadingTime: true,
    },
  },
]

// ─── CONTEXT PACK ────────────────────────────────────────────────────────────

const contextPack: ExperienceContextPack = {
  world: {
    description:
      "Thames Water's Lee Valley Water Treatment Works, Hertfordshire. One of the largest drinking water treatment sites in the UK, processing raw water from the River Lee through sedimentation, rapid gravity filtration, and chlorination before supplying over 800,000 people across North London and Hertfordshire. The learner is an 18-month field operations technician — competent but still developing judgement.",
    rules:
      "All decisions must comply with: the Water Supply (Water Quality) Regulations 2016; Thames Water's internal WIMS (Water Industry Management System) logging requirements; the DWI (Drinking Water Inspectorate) reporting framework; and Thames Water's asset management standard for equipment isolation. The regulatory environment is non-negotiable — there is no 'close enough' in water quality.",
    atmosphere:
      "Professional, pressured, consequential. The stakes are real but not dramatic — this is ordinary operational life at a regulated utility. Competence here is built through small correct decisions, not heroics. The tone should feel like a well-run industrial facility: purposeful, structured, occasionally stressful.",
  },
  actors: [
    {
      name: "Priya Sharma",
      role: "Shift Supervisor",
      personality:
        "Experienced, direct, fair. Expects the right thing to be done but explains why clearly. Not a disciplinarian — a professional who takes the regulatory framework seriously because she understands what it protects.",
      speech:
        "Measured, factual. Uses precise operational language. Never emotional. When she corrects, she gives context, not just the correction.",
      knowledge:
        "Full working knowledge of all Thames Water operational standards, DWI requirements, and WIMS procedures. Twenty years in the industry.",
      relationshipToProtagonist:
        "Supervisor and mentor. She is watching the learner's development without being heavy-handed about it.",
    },
    {
      name: "Marcus Webb",
      role: "Fellow field technician",
      personality:
        "Friendly, somewhat casual about paperwork, not malicious. Makes the kind of mistake that comes from comfort, not negligence.",
      speech:
        "Informal, a bit rushed. Not used to being accountable for the small procedural things.",
      knowledge: "Technical competence is fine. Record-keeping discipline is the gap.",
      relationshipToProtagonist: "Peer — same grade, similar experience.",
    },
  ],
  protagonist: {
    perspective: "you",
    role: "Field Operations Technician, Thames Water Lee Valley Works. 18 months in post. Technically solid, still building confidence in escalation and regulatory judgement.",
    knowledge:
      "Working knowledge of plant operations, monitoring procedures, and the WIMS system. Less confident about the regulatory framework and when to escalate vs. self-resolve.",
    goal: "Complete the shift safely, make the right calls, and leave the site with the water supply uncompromised and the records clean.",
  },
  style: {
    tone:
      "Professional, grounded, realistic. No melodrama. The stakes are real but this is an ordinary working day — the tension comes from judgement under time pressure, not crisis.",
    language: "en-GB",
    register: "professional",
    targetLength: { min: 120, max: 220 },
    styleNotes:
      "Use precise operational language — NTU readings, WIMS, DWI, pump terminology — it grounds the training in reality. Second person throughout. Present tense. Avoid corporate motivational language. When consequences play out, be specific about the regulatory or operational impact rather than vague about 'serious problems'.",
  },
  groundTruth: [
    {
      label: "Thames Water operational standards",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Thames Water internal action level for treated water turbidity: 1.0 NTU. DWI regulatory limit: 4.0 NTU. Chlorine residual minimum in distribution: 0.1 mg/l. Asset vibration tolerance band for transfer pumps: 0–7 mm/s (amber >3.5, red >7.0). All water quality complaints from members of the public must be logged in WIMS and treated as potential incidents pending sample results — they do not route via customer services.",
    },
    {
      label: "Regulatory framework",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Water Supply (Water Quality) Regulations 2016 (England): requires water suppliers to maintain complete and accurate process and quality records. Any retrospective amendment to process records must be formally authorised and documented. Water Industry Act 1991: sets the legal framework for drinking water quality. DWI can require access to all operational records and WIMS data without notice. Falsification of water quality records is a criminal offence.",
    },
    {
      label: "Competency framework",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "The four competencies being assessed in this module: (1) Water Quality Monitoring — correct response to automated alarm conditions. (2) Regulatory Record Integrity — understanding that process records are legal documents. (3) Asset Management — precautionary equipment isolation vs. run-to-fail risk. (4) Incident Escalation — water quality complaints are operational incidents, not customer service matters.",
    },
  ],
  scripts: [
    {
      label: "Regulatory grounding",
      priority: "must",
      trigger: "always",
      instruction:
        "Every consequence — good or bad — must be grounded in a specific regulatory requirement or operational standard, not vague 'best practice'. Name the regulation, the internal standard, or the system (WIMS, DWI, Water Quality Regulations). This is not corporate compliance theatre — it is what protects drinking water safety.",
    },
    {
      label: "No right-answer signposting",
      priority: "must",
      trigger: "always",
      instruction:
        "Before a CHOICE node, never indicate which option is correct. Present the situation factually and end at the decision point. The learner must use their judgement, not pick up cues from the narrator.",
    },
    {
      label: "Consequences are educational not punitive",
      priority: "must",
      trigger: "always",
      instruction:
        "When a learner makes a sub-optimal choice, the consequence must be proportionate and framed as a learning opportunity. Priya corrects but does not punish. The DWI framework is serious but not catastrophic for a first-time lapse. The goal is changed behaviour, not fear.",
    },
    {
      label: "Endpoint personalisation",
      priority: "should",
      trigger: "on_node_type",
      nodeTypes: ["ENDPOINT"],
      instruction:
        "The endpoint summary must reference specific decisions from the learner's session history, not generic feedback. If they got Q1 right but Q3 wrong, name those specifically. The debrief should feel like it is talking about this specific shift, not a template.",
    },
  ],
}

// ─── SHAPE ───────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 4,
  totalDepthMax: 9,
  endpointCount: 3,
  endpoints: [
    {
      id: "ep-champion",
      label: "Safety Champion",
      minChoicesToReach: 4,
      maxChoicesToReach: 4,
      narrativeWeight: "triumphant",
      emotionalTarget:
        "Quiet professional pride — competence confirmed through a real day's work",
    },
    {
      id: "ep-competent",
      label: "Competent Practitioner",
      minChoicesToReach: 4,
      maxChoicesToReach: 4,
      narrativeWeight: "bittersweet",
      emotionalTarget:
        "Recognition of genuine competence alongside a clear, specific development area",
    },
    {
      id: "ep-development",
      label: "Development Required",
      minChoicesToReach: 4,
      maxChoicesToReach: 4,
      narrativeWeight: "cautionary",
      emotionalTarget:
        "Honest assessment that feels fair, not punitive — the start of a development conversation",
    },
  ],
  loadBearingChoices: [1, 2, 3, 4],
  convergencePoints: [2, 4],
  pacingModel: "competency_build",
  mandatoryNodeIds: ["n1"],
}

// ─── SEGMENTS ────────────────────────────────────────────────────────────────

const MORNING_NODE_IDS = ["n1", "n2", "q1", "n3a", "n3b", "n4", "q2", "n5a", "n5b", "cp1"]
const AFTERNOON_NODE_IDS = ["n6", "q3", "n7a", "n7b", "q4", "n9a", "n9b", "n9c", "ep1", "ep2", "ep3"]

const segments: Segment[] = [
  {
    id: "seg-morning",
    label: "Morning Shift",
    description: "Water quality monitoring and record integrity — two decisions.",
    order: 0,
    nodes: nodes.filter((n) => MORNING_NODE_IDS.includes(n.id)),
  },
  {
    id: "seg-afternoon",
    label: "Afternoon Shift",
    description: "Asset management and incident escalation — two decisions.",
    order: 1,
    nodes: nodes.filter((n) => AFTERNOON_NODE_IDS.includes(n.id)),
  },
]

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Thames Water training experience…")

  const existing = await db.experience.findUnique({ where: { id: EXPERIENCE_ID } })
  if (existing) {
    console.log("✓ Already seeded. Run with a clean DB to re-seed.")
    return
  }

  const useCasePack = USE_CASE_PACKS.l_and_d
  if (!useCasePack) throw new Error('USE_CASE_PACK "l_and_d" not found in lib/engine/usecases')

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

  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    update: {
      nodes: nodes as object[],
      segments: segments as object[],
      useCasePack: USE_CASE_PACKS.l_and_d as object,
      contextPack: contextPack as object,
      shape: shape as object,
      status: "published",
      publishedAt: new Date(),
    },
    create: {
      id: EXPERIENCE_ID,
      authorId: AUTHOR_ID,
      title: "A Day at Lee Valley: Field Operations Judgement",
      slug: "thames-water-lee-valley-field-ops",
      description:
        "Four decisions. One shift. Work through a day as a Thames Water field technician and see how your operational judgement holds up against the regulatory standards that protect drinking water for 800,000 people.",
      genre: "training",
      status: "published",
      publishedAt: new Date(),
      type: "l_and_d",
      renderingTheme: "professional",
      useCasePack: USE_CASE_PACKS.l_and_d as object,
      contextPack: contextPack as object,
      shape: shape as object,
      nodes: nodes as object[],
      segments: segments as object[],
    },
  })

  console.log("  ✓ Experience seeded")
  console.log("    Title: A Day at Lee Valley: Field Operations Judgement")
  console.log("    Type:  l_and_d (Thames Water field operations)")
  console.log("    Nodes: 21 (4 CHOICE, 10 GENERATED, 1 FIXED, 1 CHECKPOINT, 3 ENDPOINT)")
  console.log("    Competencies assessed:")
  console.log("      Q1 — Water Quality Monitoring (turbidity alarm response)")
  console.log("      Q2 — Regulatory Record Integrity (WIMS / colleague's missed log)")
  console.log("      Q3 — Asset Management (pump cavitation / precautionary isolation)")
  console.log("      Q4 — Incident Escalation (customer complaint routing)")
  console.log("    Endpoints: Safety Champion / Competent Practitioner / Development Required")
  console.log("")
  console.log("  Open: http://localhost:3000/experience/" + EXPERIENCE_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
