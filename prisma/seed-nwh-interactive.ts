/**
 * seed-nwh-interactive.ts
 *
 * National Water Hygiene — Interactive Certification Training
 * Experience ID: 00000000-0000-0000-0000-000000000041
 *
 * A scenario-based alternative to the didactic seed-nwh.ts.
 * Replaces the four FIXED content modules with:
 *   - Module 1: DIALOGUE with a sceptical peer (Jamie Ellis) — you must explain why water hygiene matters
 *   - Module 2: GENERATED scenario (ill after holiday, at the site gate) + CHOICE (what do you do?)
 *   - Module 3: GENERATED scenario (crack in reservoir wall) + CHOICE (what do you do?) + EVALUATIVE rubric
 *   - Module 4: DIALOGUE with the site supervisor (Pat Doherty) — pre-shift prevention check + EVALUATIVE rubric
 *
 * The formal 25-question MCQ test is identical to seed-nwh.ts and ends at the same ENDPOINT
 * with the same scoreConfig (pass mark 20/25).
 *
 * Node types used: FIXED, GENERATED, CHOICE (closed + open), DIALOGUE, EVALUATIVE, CHECKPOINT, ENDPOINT
 */

import { PrismaClient } from "@prisma/client"
import { USE_CASE_PACKS } from "@/lib/engine/usecases"
import type {
  ExperienceContextPack,
  ShapeDefinition,
} from "@/types/experience"

const db = new PrismaClient()

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000041"

// ─── CONTEXT PACK ────────────────────────────────────────────────────────────

const contextPack: ExperienceContextPack = {
  world: {
    description:
      "National Water Hygiene (NWH) certification training delivered under the EUSR scheme. The learner is a water industry operative at the start of their career, working on restricted operations sites — potable water infrastructure including pumping stations, treatment works, service reservoirs, and distribution network. The setting is a UK water utility.",
    rules:
      "Training content is grounded in the NWH syllabus. All scenarios reflect real operational situations. Health exclusion rules, restricted operation definitions, and contamination response procedures must be represented accurately. The correct procedure always exists and can be found in the training content.",
    atmosphere:
      "Professional, grounded, realistic. The water industry is safety-critical and compliance-driven, but it is also a normal working environment. Tone should feel like a competent, well-run site — purposeful, occasionally pressured, always accountable.",
  },
  protagonist: {
    perspective: "you",
    role: "Water industry operative, new to restricted operations, currently working through NWH certification",
    knowledge:
      "Basic water industry awareness. Has completed induction. Has not yet worked on restricted operations without supervision. Seeking NWH certification to work independently.",
    goal: "Complete the training, make the right calls in each scenario, and pass the 25-question certification test with at least 20 correct.",
  },
  actors: [
    {
      name: "Jamie Ellis",
      role: "Fellow operative, new to the water industry",
      personality:
        "Enthusiastic but overconfident. Has transferred from construction groundworks and thinks most safety rules are box-ticking exercises. Not malicious — genuinely unaware of what he doesn't know. Asks direct questions. Responds positively when given a clear, convincing answer.",
      speech:
        "Informal, blunt, occasionally dismissive. Construction-site register. Not aggressive, just hasn't learned to take water hygiene seriously yet. Will come around if you give him a real reason to.",
      knowledge:
        "Pipework and civil engineering basics. No formal understanding of NWH, Cryptosporidium risk, or the public health consequences of water contamination.",
      relationshipToProtagonist:
        "Peer. Started on the same site at the same time. You've both been through the same induction; Jamie clearly wasn't paying full attention.",
    },
    {
      name: "Pat Doherty",
      role: "Site Supervisor",
      personality:
        "Experienced, safety-first, direct. Knows the NWH scheme inside out. Takes compliance seriously without being preachy — she has seen what happens when hygiene practice fails. Fair, not harsh. Will challenge you clearly if something is wrong, but explains why.",
      speech:
        "Matter-of-fact, precise, uses correct NWH terminology. Gives clear expectations and specific guidance. Never vague. When she corrects, she gives the reason, not just the correction.",
      knowledge:
        "Complete knowledge of NWH scheme, EUSR requirements, restricted operations, health exclusion criteria, contamination prevention and response, Cryptosporidium risk, DWI notification procedures. Over 20 years in the industry.",
      relationshipToProtagonist:
        "Your site supervisor. Running your gate checks and scenario assessments. Professional, not unfriendly — she wants you to pass.",
    },
  ],
  style: {
    tone: "professional",
    language: "en-GB",
    register: "professional",
    targetLength: { min: 90, max: 180 },
    styleNotes:
      "Second person throughout. Present tense. Grounded and specific — name the site asset, the time of day, the exact situation. Avoid corporate motivational language. When things go well or badly, be specific about the operational and regulatory consequences rather than vague about 'serious problems'.",
  },
  groundTruth: [
    {
      label: "NWH health exclusion criteria",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Health exclusion illnesses under the NWH scheme: persistent vomiting or diarrhoea, Cryptosporidiosis, jaundice, hepatitis A or E, dysentery, typhoid or paratyphoid (including if a family member is diagnosed). Any gastrointestinal illness after travelling abroad must be reported to a supervisor before working on restricted operations, regardless of severity. The supervisor — not the operative — decides whether a health screen is required.",
    },
    {
      label: "NWH prevention requirements",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "Prevention requirements: separate clothing sets for sewage work and water supply work; small fittings bagged, labelled and off the van floor; pipes capped and stored off the ground in a secure area; fuel in a separate bunded area away from fittings and pipes; no pets or livestock on restricted operation sites; hand washing before and after restricted operations and after toilet use; only approved products (Regulation 31/England, Regulation 33/Scotland) to contact the water supply.",
    },
    {
      label: "Contamination response procedure",
      type: "inline",
      fetchStrategy: "on_session_start",
      priority: "must_include",
      content:
        "If contamination is suspected or a structural defect is found that could allow external water ingress to a potable asset: (1) stop work immediately; (2) report to supervisor immediately — not at end of shift; (3) asset must not be returned to supply until the situation has been assessed and cleared; (4) if water quality risk is confirmed, DWI must be notified. Operatives are not authorised to make solo decisions about returning assets to supply.",
    },
  ],
  scripts: [
    {
      label: "Regulatory grounding for scenarios",
      priority: "must",
      trigger: "always",
      instruction:
        "All scenario content must be grounded in real NWH procedures. If the learner makes an incorrect choice, the feedback or generated content must clearly identify what they should have done and why, referencing the specific NWH rule. Do not be vague about consequences.",
    },
  ],
}

// ─── NODES ───────────────────────────────────────────────────────────────────

const nodes = [

  // ─── INTRO ───────────────────────────────────────────────────────────────

  {
    id: "n-intro",
    type: "FIXED",
    label: "Welcome",
    mandatory: true,
    content: `# National Water Hygiene — Interactive Certification

Welcome to the interactive version of the NWH certification training.

This course uses **scenarios and conversations** to test your knowledge in realistic situations, not just multiple choice questions. You will:

- **Talk through** why water hygiene matters with a colleague who isn't sure
- **Make a real decision** about working while unwell after travelling abroad
- **Respond to** a structural problem discovered during reservoir maintenance
- **Demonstrate** your prevention knowledge in a pre-shift supervisor check

Each module builds on the last. After completing all four, you will take the **formal 25-question certification test** — the same assessment required for your NWH card under the EUSR scheme.

You need **20 out of 25 correct (80%)** to pass and receive your NWH card, valid for 3 years.`,
    nextNodeId: "n-m1-facts",
  },

  // ─── MODULE 1: THE IMPORTANCE OF WATER ───────────────────────────────────

  {
    id: "n-m1-facts",
    type: "FIXED",
    label: "Module 1 — Key facts",
    mandatory: true,
    content: `## Module 1: The Importance of Water

### Key Facts

- **Wholesome water** is water that has been treated and is safe for human consumption — the legal standard for all UK drinking water
- Water treatment is similar to food production: both remove harmful bacteria before the product reaches consumers
- **70%** of Earth's surface is water. Only **0.5%** is fresh and drinkable
- Water is the **world's largest food industry** — more products are made with water than any other ingredient
- Humans can survive approximately **3 weeks without food** but only **3 days without water**

Contaminating the water supply doesn't just affect tap water — it affects every food and beverage product that uses it.

---

*Jamie Ellis, who started on the same site as you, has a question.*`,
    nextNodeId: "d-m1",
  },

  {
    id: "d-m1",
    type: "DIALOGUE",
    label: "Jamie: why does water hygiene matter?",
    actorId: "Jamie Ellis",
    openingLine:
      "Honestly mate — between you and me — do you think all this water hygiene certification is a bit over the top? I've been doing groundworks for six years. You wash your hands, you don't drink from the trench. What's the actual worst case if someone's a bit slack about it? We're not neurosurgeons.",
    breakthroughCriteria:
      "The learner has explained clearly enough that Jamie understands and accepts at least two of the following: that only 0.5% of Earth's water is fresh and drinkable, making the water supply uniquely precious and fragile; that contamination can sicken thousands from a single incident because water is distributed to whole communities at once; that Cryptosporidium or similar pathogens introduced by a careless operative cannot be removed by standard chlorine treatment; that water is used in food and drink production everywhere, so contaminating the supply has consequences far beyond drinking water alone. Jamie's response should indicate he genuinely understands why the stakes matter — not just that he agrees to end the conversation.",
    maxTurns: 4,
    nextNodeId: "cp-m1",
  },

  {
    id: "cp-m1",
    type: "CHECKPOINT",
    label: "Module 1 complete",
    visible: false,
    marksCompletionOf: "Module 1 — The Importance of Water",
    unlocks: [],
    snapshotsState: false,
    nextNodeId: "n-m2-facts",
  },

  // ─── MODULE 2: WATER AS A CARRIER OF DISEASE ─────────────────────────────

  {
    id: "n-m2-facts",
    type: "FIXED",
    label: "Module 2 — Key facts",
    mandatory: true,
    content: `## Module 2: Water as a Carrier of Disease

### Historical Context

In **1854**, Dr John Snow traced a cholera outbreak killing over 600 people in London to a single contaminated water pump on Broad Street — the first proof that water could transmit fatal disease.

### Cryptosporidium — The Modern Threat

- **Resistant to chlorine** — standard disinfection does not kill it
- Must be **physically removed** by filtration or destroyed by UV treatment
- Causes severe gastrointestinal illness and is invisible, odourless, tasteless in water

### Health Exclusion — When You Must Not Work

You **must tell your supervisor** before working on restricted operations if you have, or recently had:

- Persistent vomiting or diarrhoea
- Cryptosporidiosis, hepatitis A or E, jaundice, typhoid, dysentery
- **Any gastrointestinal illness after travelling abroad** — even mild symptoms

Your supervisor — not you — decides whether a health screen is required. You do not make that call yourself.

---

*The next scenario puts you in the situation directly. Read it carefully.*`,
    nextNodeId: "n-m2-scene",
  },

  {
    id: "n-m2-scene",
    type: "GENERATED",
    label: "Scene: returning from holiday, at the site gate",
    beatInstruction:
      "It is Monday morning, 06:50. The learner has just returned from two weeks' holiday in Turkey and has had an upset stomach for the past two days — loose stools and mild cramps, nothing severe, probably just travel stomach. They are standing outside the security gate of a potable water pumping station — a restricted operation site. In one hand they hold their site pass; in the other, a coffee. Pat Doherty, the site supervisor, is running the morning gate briefing — clipboard check, sign-in, PPE inspection. Two colleagues are already through the gate, loading kit from a van. Pat hasn't noticed the learner yet. Today's job is maintenance on the raw water intake infrastructure — direct contact with water supply assets. The learner needs to decide what to do before swiping in.",
    constraints: {
      lengthMin: 90,
      lengthMax: 160,
      mustEndAt: "learner standing at the gate, site pass in hand, Pat's briefing in progress, a decision pending",
      mustNotDo: [
        "tell the learner what to do",
        "make the right answer obvious in the prose",
        "introduce any characters other than Pat Doherty and the two unnamed colleagues",
      ],
    },
    nextNodeId: "q-m2",
  },

  {
    id: "q-m2",
    type: "CHOICE",
    label: "Q-M2 — What do you do at the gate?",
    prompt: "You've been ill for two days with gastrointestinal symptoms after travelling abroad. You're at the gate of a restricted operation site for your morning shift. What do you do?",
    responseType: "closed",
    options: [
      {
        id: "q-m2-a",
        label: "Swipe in and get started — it's probably just travel stomach and you feel well enough",
        nextNodeId: "n-m2-debrief",
        isLoadBearing: false,
        trainingFeedback:
          "Entering a restricted operation site with active gastrointestinal symptoms after travelling abroad is a health exclusion under the NWH scheme — regardless of severity. Cryptosporidium can be shed asymptomatically and is resistant to chlorine. Once introduced to a water supply asset, it cannot be removed by standard treatment. You must tell Pat before entering.",
        feedbackTone: "developmental",
        competencySignal: "Water as a Carrier of Disease",
      },
      {
        id: "q-m2-b",
        label: "Tell Pat about your symptoms before entering the site",
        nextNodeId: "n-m2-debrief",
        isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback:
          "Correct. Reporting gastrointestinal symptoms after travel to your supervisor before entering a restricted operation site is exactly the right procedure. Pat will decide whether a health screen is needed — that decision is hers, not yours.",
        feedbackTone: "positive",
        competencySignal: "Water as a Carrier of Disease",
      },
      {
        id: "q-m2-c",
        label: "Go to the welfare unit first and see how you feel after a coffee and some breakfast",
        nextNodeId: "n-m2-debrief",
        isLoadBearing: false,
        trainingFeedback:
          "Waiting to see how you feel does not satisfy the NWH health exclusion requirement. You must report symptoms to your supervisor before entering the restricted operation site. The decision about whether you can work is Pat's to make, not yours.",
        feedbackTone: "developmental",
        competencySignal: "Water as a Carrier of Disease",
      },
      {
        id: "q-m2-d",
        label: "Don't mention it — take extra care with hand washing during the shift",
        nextNodeId: "n-m2-debrief",
        isLoadBearing: false,
        trainingFeedback:
          "Extra hand washing does not mitigate the risk of Cryptosporidium carriage. Once shed into a water asset, Crypto cannot be removed by chlorination. You must report gastrointestinal symptoms to your supervisor before working on restricted operations — there is no workaround.",
        feedbackTone: "developmental",
        competencySignal: "Water as a Carrier of Disease",
      },
    ],
  },

  {
    id: "n-m2-debrief",
    type: "FIXED",
    label: "Module 2 — Procedure debrief",
    mandatory: true,
    content: `### The Correct Procedure

**Before entering a restricted operation site after travelling abroad:**

If you have had any gastrointestinal symptoms — even mild — you must tell your supervisor **before** entering the site.

Your supervisor will assess whether a health screen is needed. They may ask you to stay away from restricted operations until you are cleared.

**Why this matters:** Travel-related gastrointestinal illness raises the risk of Cryptosporidium carriage. Because Crypto is resistant to chlorine, if you introduce it to a water supply asset it cannot be removed by standard treatment. The potential consequence is a boil water notice affecting thousands of customers — and a DWI investigation.

Reporting this is not optional. It also protects you: if a contamination incident is later traced to your site visit, your position is very different if you declared your illness than if you concealed it.`,
    nextNodeId: "cp-m2",
  },

  {
    id: "cp-m2",
    type: "CHECKPOINT",
    label: "Module 2 complete",
    visible: false,
    marksCompletionOf: "Module 2 — Water as a Carrier of Disease",
    unlocks: [],
    snapshotsState: false,
    nextNodeId: "n-m3-facts",
  },

  // ─── MODULE 3: CONTAMINATION AND CONSEQUENCES ─────────────────────────────

  {
    id: "n-m3-facts",
    type: "FIXED",
    label: "Module 3 — Key facts",
    mandatory: true,
    content: `## Module 3: Potential Contamination and Its Consequences

### Restricted Operations

Any work involving potable water assets requires a valid NWH card. This includes:
- Boreholes and raw water intakes
- Water treatment works
- Service reservoirs and water towers
- Distribution network (mains, valves, connections)

### How Contamination Enters the System

| Risk | Source |
|------|--------|
| Agricultural land adjacent to reservoir | Animal waste, pesticides, Cryptosporidium |
| Structural defects (cracks, open hatches) | External groundwater or surface water ingress |
| Maintenance without correct permit | Introduction of pathogens or chemicals |
| Birds | Faeces containing harmful bacteria |

### Consequences

- **Boil water notice** affecting thousands of customers
- **Customer illness** — in severe cases, death
- **DWI investigation** and potential prosecution under the Water Industry Act
- **Company investigation** and disciplinary action

If you discover or suspect a contamination risk: **stop work immediately, report to your supervisor at once, and do not return the asset to supply.**

---

*The next scenario tests this directly.*`,
    nextNodeId: "n-m3-scene",
  },

  {
    id: "n-m3-scene",
    type: "GENERATED",
    label: "Scene: crack in the reservoir wall",
    beatInstruction:
      "The learner is working inside a drained service reservoir — a large concrete-lined tank that holds treated potable water. The reservoir has been formally isolated and dewatered, and the learner has a legitimate permit-to-work for planned maintenance. It is mid-morning, quiet. While inspecting the inlet pipe connection, the learner notices something: a 20-centimetre crack in the concrete wall, about 30 centimetres above floor level and just to the right of the inlet. The crack has rough, irregular edges and dark brown staining — consistent with external water seeping in from outside, not with internal leakage from the reservoir itself. The site is bordered on its north side by a working dairy farm. Pat Doherty is visible at the far end of the reservoir, checking valve positions. No water has re-entered the tank. The permit-to-work covers today's maintenance, but not this — this is something new that wasn't known when the job was planned.",
    constraints: {
      lengthMin: 90,
      lengthMax: 160,
      mustEndAt:
        "learner standing in front of the crack, Pat visible at the far end of the reservoir, the situation unresolved",
      mustNotDo: [
        "tell the learner what to do",
        "describe the contamination risk explicitly — let the learner identify it",
        "introduce any characters not described",
        "resolve the tension",
      ],
    },
    nextNodeId: "q-m3",
  },

  {
    id: "q-m3",
    type: "CHOICE",
    label: "Q-M3 — What do you do about the crack?",
    prompt: "You've found a 20cm crack in the reservoir wall with dark staining consistent with external water ingress. The site borders a working dairy farm. Pat is at the far end of the reservoir. What do you do?",
    responseType: "closed",
    options: [
      {
        id: "q-m3-a",
        label: "Stop work immediately and go to Pat to report what you've found",
        nextNodeId: "n-m3-outcome",
        isLoadBearing: true,
        stateChanges: { m3_correct: true },
        trainingFeedback:
          "Correct. Stopping work and immediately reporting a potential structural defect near an agricultural boundary is exactly the right response. A crack adjacent to a dairy farm is a potential Cryptosporidium contamination route. The reservoir must not return to supply until a structural engineer has assessed it.",
        feedbackTone: "positive",
        competencySignal: "Contamination and Consequences",
      },
      {
        id: "q-m3-b",
        label: "Note it down to report to Pat at the end of the shift",
        nextNodeId: "n-m3-outcome",
        isLoadBearing: false,
        trainingFeedback:
          "This situation requires immediate reporting, not an end-of-shift note. A cracked wall next to agricultural land is a live contamination risk. Every hour without action increases the risk. Report to Pat now and stop further work.",
        feedbackTone: "developmental",
        competencySignal: "Contamination and Consequences",
      },
      {
        id: "q-m3-c",
        label: "Take a photo and continue the maintenance — the reservoir is isolated so there's no immediate risk",
        nextNodeId: "n-m3-outcome",
        isLoadBearing: false,
        trainingFeedback:
          "Even during isolation for maintenance, a crack adjacent to agricultural land represents an active contamination risk — external water could be entering the structure. Work must stop and the situation reported to Pat immediately. It is not your decision to assess 'immediate risk'.",
        feedbackTone: "developmental",
        competencySignal: "Contamination and Consequences",
      },
      {
        id: "q-m3-d",
        label: "Apply a temporary repair and carry on — you'll flag it in the end-of-job report",
        nextNodeId: "n-m3-outcome",
        isLoadBearing: false,
        trainingFeedback:
          "A self-administered temporary repair is not appropriate here. This is a structural integrity issue on a potable water asset with a potential contamination pathway. You are not authorised to make this call. Stop work, report immediately, and the reservoir must not return to supply until properly assessed.",
        feedbackTone: "developmental",
        competencySignal: "Contamination and Consequences",
      },
    ],
  },

  {
    id: "n-m3-outcome",
    type: "GENERATED",
    label: "Scene: Pat responds to the crack",
    beatInstruction:
      "Pat Doherty has arrived at the learner's position in the reservoir after the learner either came to find her or she noticed them stop work and pause at the wall. Her response adapts to what actually happened: if the learner stopped work and reported it immediately and correctly, Pat affirms this calmly — 'Right, good call' — and explains why it was right; if the learner did something else (carried on, planned to report later, tried to patch it), Pat redirects clearly and firmly but without drama. Either way, Pat explains the following: no further work in this reservoir until a structural engineer has assessed the crack; the reservoir must not return to supply until the investigation is complete; the dairy farm on the north boundary means any external water ingress could carry animal waste including Cryptosporidium; this must be formally logged, and if water quality risk is confirmed, the DWI must be notified. Pat is matter-of-fact — this is a recognised type of incident and the procedure is clear. They begin walking out together.",
    constraints: {
      lengthMin: 100,
      lengthMax: 190,
      mustEndAt:
        "learner and Pat heading out of the reservoir together, the situation being handled correctly, next steps clear",
      mustNotDo: [
        "be preachy or lecture-heavy — Pat states facts and moves on",
        "introduce characters not described",
        "describe the learner's internal emotions",
      ],
    },
    nextNodeId: "ev-m3",
  },

  {
    id: "ev-m3",
    type: "EVALUATIVE",
    label: "Module 3 — Contamination response assessment",
    rubric: [
      {
        id: "stop-work",
        label: "Stop work immediately",
        description:
          "The learner stopped current maintenance activities and did not proceed with any further work on the reservoir before the structural issue was formally assessed.",
        weight: "critical",
      },
      {
        id: "immediate-report",
        label: "Reported to supervisor immediately",
        description:
          "The learner reported the situation to Pat Doherty immediately — not at end of shift, not after finishing a section, but at the point of discovery.",
        weight: "critical",
      },
      {
        id: "asset-isolation",
        label: "Understood asset must not return to supply",
        description:
          "The learner recognised or demonstrated understanding that the reservoir must not be returned to supply until the structural issue and any contamination risk has been assessed and cleared.",
        weight: "major",
      },
      {
        id: "contamination-pathway",
        label: "Identified the contamination pathway",
        description:
          "The learner understood or articulated that the adjacent dairy farm represents a contamination risk (animal waste, Cryptosporidium) through the crack, and that this is the specific reason the situation is serious.",
        weight: "minor",
      },
    ],
    assessesNodeIds: ["n-m3-scene", "n-m3-outcome"],
    nextNodeId: "cp-m3",
  },

  {
    id: "cp-m3",
    type: "CHECKPOINT",
    label: "Module 3 complete",
    visible: false,
    marksCompletionOf: "Module 3 — Potential Contamination and Its Consequences",
    unlocks: [],
    snapshotsState: false,
    nextNodeId: "n-m4-facts",
  },

  // ─── MODULE 4: PREVENTION ─────────────────────────────────────────────────

  {
    id: "n-m4-facts",
    type: "FIXED",
    label: "Module 4 — Key facts",
    mandatory: true,
    content: `## Module 4: Preventing Contamination

### Personal Hygiene
- **Wash hands** before and after restricted operations, after toilet use, after soil contact
- Use **separate sets of clothing** for sewage work and water supply work — never combine them

### Van and Equipment Storage
| Item | Requirement |
|------|-------------|
| Small fittings | Bagged, labelled, off the van floor |
| Pipes | Capped at both ends, stored off the ground in a secure area |
| Fuel and chemicals | Separate bunded area, away from fittings and pipes |
| Tools (post-disinfection) | Off the ground on a non-permeable surface |

### Pets and Livestock
**Prohibited on restricted operation sites** — they are a significant source of Cryptosporidium and other pathogens.

### Approved Products
Only products approved under **Regulation 31** (England) or **Regulation 33** (Scotland) may contact the water supply. Published on the **DWQR website**.

### Disinfection
- Minimum **1,000 mg/litre** chlorine
- Fresh solution prepared **daily**
- **Never discharge chlorinated water** to surface drains or watercourses — toxic to aquatic life

---

*Pat Doherty will now run a gate check to test your prevention knowledge before you go on site.*`,
    nextNodeId: "d-m4",
  },

  {
    id: "d-m4",
    type: "DIALOGUE",
    label: "Pat: pre-shift prevention gate check",
    actorId: "Pat Doherty",
    openingLine:
      "Right. Before we go through — quick gate check. I do this with everyone at the start of a job. Walk me through your setup: van, kit, PPE. What have you got and how is it stored?",
    breakthroughCriteria:
      "The learner has demonstrated clear knowledge of at least three of the following NWH prevention requirements: separate clothing sets for sewage work and water supply work, never combined; small fittings bagged and labelled, not loose on the van floor; pipes capped at both ends and stored off the ground; fuel stored in a separate bunded area, away from fittings and pipes; no pets or livestock on restricted operation sites; hand washing before and after restricted operations. Pat is satisfied — the learner knows what is expected and has stated it clearly enough to pass the gate check.",
    maxTurns: 5,
    nextNodeId: "n-m4-summary",
    failureNodeId: "n-m4-summary",
  },

  {
    id: "n-m4-summary",
    type: "GENERATED",
    label: "Scene: gate check complete",
    beatInstruction:
      "The pre-shift prevention gate check with Pat Doherty has just concluded at the site entrance. The scene reflects the outcome of the conversation: if the learner demonstrated solid knowledge of NWH prevention requirements — clothing separation, correct storage, fuel bunding, hand washing, no pets on site — Pat signs them in promptly and notes it was a clean check, professional and brief. If the learner had gaps, Pat went through the key points in the dialogue and now confirms what was covered: 'Right, so you know the drill now.' Either way, Pat signs off the gate log and the learner enters the site. It is a clear morning. The shift has properly begun.",
    constraints: {
      lengthMin: 80,
      lengthMax: 150,
      mustEndAt:
        "gate check complete, learner entering the site, the shift underway",
      mustNotDo: [
        "invent details about the job beyond the gate check",
        "be vague — specifically reflect whether the check went well or whether Pat had to correct something",
      ],
    },
    nextNodeId: "ev-m4",
  },

  {
    id: "ev-m4",
    type: "EVALUATIVE",
    label: "Module 4 — Prevention knowledge assessment",
    rubric: [
      {
        id: "clothing-separation",
        label: "Clothing separation",
        description:
          "The learner correctly stated that separate sets of clothing must be used for sewage work and drinking water supply work, and that these must never be combined.",
        weight: "major",
      },
      {
        id: "storage-fittings",
        label: "Correct fittings storage",
        description:
          "The learner correctly stated that small fittings must be stored in sealed, labelled bags and kept off the van floor.",
        weight: "major",
      },
      {
        id: "fuel-separation",
        label: "Fuel and chemical separation",
        description:
          "The learner correctly stated that fuel must be stored in a separate bunded area, away from pipes and fittings, to prevent permeation and contamination.",
        weight: "critical",
      },
      {
        id: "storage-pipes",
        label: "Correct pipe storage",
        description:
          "The learner correctly stated that pipes must be capped at both ends and stored off the ground in a secure area.",
        weight: "major",
      },
      {
        id: "hand-hygiene",
        label: "Hand hygiene requirements",
        description:
          "The learner demonstrated knowledge of when hand washing is required: before and after restricted operations, after toilet use, and after contact with soil or contaminated materials.",
        weight: "major",
      },
    ],
    assessesNodeIds: ["n-m4-summary"],
    nextNodeId: "cp-m4",
  },

  {
    id: "cp-m4",
    type: "CHECKPOINT",
    label: "Module 4 complete",
    visible: false,
    marksCompletionOf: "Module 4 — Preventing Contamination",
    unlocks: [],
    snapshotsState: false,
    nextNodeId: "n-quiz-intro",
  },

  // ─── QUIZ INTRODUCTION ────────────────────────────────────────────────────

  {
    id: "n-quiz-intro",
    type: "FIXED",
    label: "Test introduction",
    mandatory: true,
    content: `## National Water Hygiene Certification Test

You have completed all four training modules.

The formal test contains **25 questions**. You need at least **20 correct (80%)** to pass and receive your NWH card under the EUSR scheme.

Your card will be valid for **3 years** and searchable by employers at eusr.co.uk.

Read each question carefully and select the best answer.`,
    nextNodeId: "n-q1",
  },

  // ─── 25 MCQ QUESTIONS (identical to seed-nwh.ts) ─────────────────────────

  {
    id: "n-q1",
    type: "CHOICE",
    label: "Q1 — Wholesome water",
    prompt: "What is the meaning of wholesome water?",
    responseType: "closed",
    options: [
      { id: "n-q1-a", label: "Water that contains parasites", nextNodeId: "n-q2", isLoadBearing: false,
        trainingFeedback: "Water containing parasites would be unsafe to drink. Wholesome water has been treated to remove such hazards.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q1-b", label: "Water that has a high concentration of chlorine", nextNodeId: "n-q2", isLoadBearing: false,
        trainingFeedback: "High chlorine concentrations alone do not define wholesome water. The legal standard is about safety for consumption, not chemical content.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q1-c", label: "Water that has medicinal qualities", nextNodeId: "n-q2", isLoadBearing: false,
        trainingFeedback: "Drinking water is not required to have medicinal properties. Wholesome water simply means it is treated and safe to consume.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q1-d", label: "Water that has been treated and is safe for consumption", nextNodeId: "n-q2", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Wholesome water is the legal standard — water that has been treated and is safe for human consumption.",
        feedbackTone: "positive", competencySignal: "The Importance of Water" },
    ],
  },

  {
    id: "n-q2",
    type: "CHOICE",
    label: "Q2 — Milk and water production",
    prompt: "Why are milk and drinking water similar in their production?",
    responseType: "closed",
    options: [
      { id: "n-q2-a", label: "They both have harmful bacteria removed before being distributed", nextNodeId: "n-q3", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Both milk and drinking water go through treatment processes that remove harmful bacteria before reaching the consumer.",
        feedbackTone: "positive", competencySignal: "The Importance of Water" },
      { id: "n-q2-b", label: "They both go in containers", nextNodeId: "n-q3", isLoadBearing: false,
        trainingFeedback: "While both products are often delivered in containers, that is not the meaningful similarity. The key link is the food hygiene process both undergo.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q2-c", label: "There are no similarities", nextNodeId: "n-q3", isLoadBearing: false,
        trainingFeedback: "There is a direct similarity — both water and milk are subject to treatment processes that remove harmful bacteria before distribution.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q2-d", label: "They're both boiled before being distributed", nextNodeId: "n-q3", isLoadBearing: false,
        trainingFeedback: "Drinking water is not boiled as part of standard treatment. The similarity is that both undergo processes to remove harmful bacteria.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
    ],
  },

  {
    id: "n-q3",
    type: "CHOICE",
    label: "Q3 — Drinkable water percentage",
    prompt: "Water covers 70% of our planet, how much of this water is suitable for use as drinking water?",
    responseType: "closed",
    options: [
      { id: "n-q3-a", label: "97%", nextNodeId: "n-q4", isLoadBearing: false,
        trainingFeedback: "97% of the Earth's water is seawater, which is not suitable for drinking without treatment.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q3-b", label: "0.5%", nextNodeId: "n-q4", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Only 0.5% of all water on Earth is fresh and drinkable — making it a scarce and precious resource.",
        feedbackTone: "positive", competencySignal: "The Importance of Water" },
      { id: "n-q3-c", label: "2%", nextNodeId: "n-q4", isLoadBearing: false,
        trainingFeedback: "The correct figure is 0.5%. Only a tiny fraction of Earth's water is drinkable — highlighting why water hygiene is so critical.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q3-d", label: "1%", nextNodeId: "n-q4", isLoadBearing: false,
        trainingFeedback: "The correct figure is 0.5%. The scarcity of drinkable water is why protecting water quality matters so much.",
        feedbackTone: "developmental", competencySignal: "The Importance of Water" },
    ],
  },

  {
    id: "n-q4",
    type: "CHOICE",
    label: "Q4 — Why sewage causes illness",
    prompt: "Why can sewage cause illness if it contaminates drinking water?",
    responseType: "closed",
    options: [
      { id: "n-q4-a", label: "It seriously discolours the water", nextNodeId: "n-q5", isLoadBearing: false,
        trainingFeedback: "Discolouration is a visible sign of contamination, but the real health risk comes from the harmful microorganisms that sewage introduces.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q4-b", label: "It gives off a bad smell", nextNodeId: "n-q5", isLoadBearing: false,
        trainingFeedback: "An unpleasant smell may indicate contamination, but odour alone does not cause illness. The danger lies in the harmful bacteria and viruses sewage contains.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q4-c", label: "It gives water an unpleasant taste", nextNodeId: "n-q5", isLoadBearing: false,
        trainingFeedback: "Taste changes can be a warning sign, but the health risk comes from the pathogens sewage introduces into the water supply.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q4-d", label: "It contains harmful bacteria and viruses", nextNodeId: "n-q5", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Sewage contains harmful bacteria and viruses that can cause serious illness if they contaminate drinking water.",
        feedbackTone: "positive", competencySignal: "Water as a Carrier of Disease" },
    ],
  },

  {
    id: "n-q5",
    type: "CHOICE",
    label: "Q5 — Cryptosporidium impact",
    prompt: "What could be the impact of Cryptosporidium in the drinking water supply?",
    responseType: "closed",
    options: [
      { id: "n-q5-a", label: "An unpleasant odour", nextNodeId: "n-q6", isLoadBearing: false,
        trainingFeedback: "Cryptosporidium does not typically cause an odour problem. Its danger is that it causes illness and is resistant to chlorine disinfection.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q5-b", label: "Discolouration of the drinking water", nextNodeId: "n-q6", isLoadBearing: false,
        trainingFeedback: "Cryptosporidium does not discolour water — it cannot be detected by taste, smell or sight, which makes it particularly dangerous.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q5-c", label: "Illness in the community", nextNodeId: "n-q6", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Cryptosporidium causes severe gastrointestinal illness and is resistant to chlorine, making it one of the most serious waterborne pathogens.",
        feedbackTone: "positive", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q5-d", label: "A change to the taste of the drinking water", nextNodeId: "n-q6", isLoadBearing: false,
        trainingFeedback: "Cryptosporidium does not affect taste. It is undetectable by the senses, which is why physical filtration and UV treatment are essential.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
    ],
  },

  {
    id: "n-q6",
    type: "CHOICE",
    label: "Q6 — Returning from abroad with diarrhoea",
    prompt: "When returning to work, after travelling abroad, you find that you are experiencing persistent diarrhoea. What must you do?",
    responseType: "closed",
    options: [
      { id: "n-q6-a", label: "Drink plenty of water to avoid becoming dehydrated", nextNodeId: "n-q7", isLoadBearing: false,
        trainingFeedback: "Staying hydrated is sensible personal advice, but your first duty when experiencing persistent diarrhoea is to report it to your supervisor before working on any water asset.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q6-b", label: "Tell your supervisor immediately and arrange a health screening", nextNodeId: "n-q7", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. You must report persistent diarrhoea to your supervisor immediately and arrange a health screen before returning to restricted operations.",
        feedbackTone: "positive", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q6-c", label: "Take plenty of vitamins", nextNodeId: "n-q7", isLoadBearing: false,
        trainingFeedback: "Taking vitamins does not address the public health risk. You must report the illness to your supervisor before working on water assets.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q6-d", label: "Carry on working until you feel better", nextNodeId: "n-q7", isLoadBearing: false,
        trainingFeedback: "Continuing to work on restricted operations while ill with diarrhoea puts the water supply at serious risk. Report to your supervisor immediately.",
        feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
    ],
  },

  {
    id: "n-q7",
    type: "CHOICE",
    label: "Q7 — Purpose of water quality audits",
    prompt: "Why are water quality audits carried out in the water industry?",
    responseType: "closed",
    options: [
      { id: "n-q7-a", label: "To confirm that procedures and best practice are being followed", nextNodeId: "n-q8", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Audits are carried out to confirm that correct procedures and best practices are being followed throughout the water industry.",
        feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q7-b", label: "To make sure that the auditors know how to carry out procedures correctly", nextNodeId: "n-q8", isLoadBearing: false,
        trainingFeedback: "Auditors already have specialist knowledge. The purpose of an audit is to verify that your organisation is following correct procedures.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q7-c", label: "To offer suggestions about new ways of carrying out procedures", nextNodeId: "n-q8", isLoadBearing: false,
        trainingFeedback: "Audits are primarily a compliance check, not a process improvement exercise. Their purpose is to confirm procedures are being followed.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q7-d", label: "To make sure that operations can be done as quickly and cheaply as possible", nextNodeId: "n-q8", isLoadBearing: false,
        trainingFeedback: "Speed and cost are not the focus of a water quality audit. The purpose is to confirm that safety procedures and best practices are being adhered to.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
    ],
  },

  {
    id: "n-q8",
    type: "CHOICE",
    label: "Q8 — Restricted operation activity",
    prompt: "Under the National Water Hygiene scheme, which of these is classed as a Restricted Operation activity?",
    responseType: "closed",
    options: [
      { id: "n-q8-a", label: "Repairing a pump at a sewage works", nextNodeId: "n-q9", isLoadBearing: false,
        trainingFeedback: "Sewage works are not potable water assets. Restricted operations relate specifically to work on or near the drinking water supply.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q8-b", label: "Electrical work at a Water Company's head office", nextNodeId: "n-q9", isLoadBearing: false,
        trainingFeedback: "Office electrical work does not involve contact with water supply assets. Restricted operations are those that could directly affect the drinking water supply.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q8-c", label: "Maintaining equipment at a river intake", nextNodeId: "n-q9", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. River intakes are raw water sources and working there is a restricted operation requiring a valid NWH card.",
        feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q8-d", label: "Working on a borehole site", nextNodeId: "n-q9", isLoadBearing: false,
        trainingFeedback: "You're right that boreholes are also restricted operations — this is also a correct answer. The question asks for one example and river intake maintenance is the primary answer given in the assessment.",
        feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
    ],
  },

  {
    id: "n-q9",
    type: "CHOICE",
    label: "Q9 — Reportable illness for restricted operations",
    prompt: "Which of these illnesses would be reportable to your line manager/supervisor if you work on Restricted Operations?",
    responseType: "closed",
    options: [
      { id: "n-q9-a", label: "Hepatitis A or E", nextNodeId: "n-q10", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Hepatitis A and E are among the illnesses that must be reported before working on restricted operations, as they can be spread through contaminated water.",
        feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q9-b", label: "Measles", nextNodeId: "n-q10", isLoadBearing: false,
        trainingFeedback: "Measles is not a waterborne disease and is not on the exclusion list for restricted operations. The key illnesses are those associated with gastrointestinal and waterborne transmission.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q9-c", label: "Conjunctivitis", nextNodeId: "n-q10", isLoadBearing: false,
        trainingFeedback: "Conjunctivitis is not a waterborne illness and is not on the restricted operations exclusion list.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q9-d", label: "Eczema", nextNodeId: "n-q10", isLoadBearing: false,
        trainingFeedback: "Eczema is a skin condition, not an infectious disease associated with waterborne transmission. It is not on the exclusion list for restricted operations.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
    ],
  },

  {
    id: "n-q10",
    type: "CHOICE",
    label: "Q10 — What you need to work on a restricted operation",
    prompt: "What must you have to work on a Restricted Operation?",
    responseType: "closed",
    options: [
      { id: "n-q10-a", label: "A level 3 National Vocational Qualification (NVQ)", nextNodeId: "n-q11", isLoadBearing: false,
        trainingFeedback: "An NVQ is not a requirement for restricted operations. The specific requirement is a valid National Water Hygiene card issued under the EUSR scheme.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q10-b", label: "Employer's permission to operate", nextNodeId: "n-q11", isLoadBearing: false,
        trainingFeedback: "Employer permission alone is not sufficient. You must hold a valid National Water Hygiene card to work on restricted operations.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q10-c", label: "A valid National Water Hygiene card", nextNodeId: "n-q11", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. A valid NWH card, issued under the EUSR scheme, is the mandatory requirement for working on restricted operations.",
        feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q10-d", label: "Successfully completed health questionnaire", nextNodeId: "n-q11", isLoadBearing: false,
        trainingFeedback: "A health questionnaire may be required in some circumstances, but the mandatory qualification to work on restricted operations is a valid National Water Hygiene card.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
    ],
  },

  {
    id: "n-q11",
    type: "CHOICE",
    label: "Q11 — Why birds are a contamination risk at treatment works",
    prompt: "Why can birds be a possible cause of contamination at a water treatment works?",
    responseType: "closed",
    options: [
      { id: "n-q11-a", label: "They can be a major distraction to staff", nextNodeId: "n-q12", isLoadBearing: false,
        trainingFeedback: "Distraction is not the primary concern. The significant water quality risk from birds comes from their faeces, which can contain harmful bacteria.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q11-b", label: "Bird faeces contains harmful bacteria", nextNodeId: "n-q12", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Bird faeces can contain harmful bacteria including Cryptosporidium, making birds a potential contamination risk at water treatment sites.",
        feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q11-c", label: "Birds may carry disease which can affect productivity", nextNodeId: "n-q12", isLoadBearing: false,
        trainingFeedback: "The concern is not productivity but water quality. Bird faeces containing harmful bacteria is the direct contamination risk.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q11-d", label: "Birds are the cause of a number of allergies", nextNodeId: "n-q12", isLoadBearing: false,
        trainingFeedback: "Allergies are not the reason birds are a concern at water treatment sites. The risk is contamination of the water supply through bird faeces.",
        feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
    ],
  },

  {
    id: "n-q12",
    type: "CHOICE",
    label: "Q12 — Where to keep cleaned and disinfected tools",
    prompt: "Cleaned and disinfected tools should be kept:",
    responseType: "closed",
    options: [
      { id: "n-q12-a", label: "Directly on the floor", nextNodeId: "n-q13", isLoadBearing: false,
        trainingFeedback: "Storing tools directly on the floor risks re-contamination. Tools must be stored off the ground on a non-permeable surface.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q12-b", label: "Off the ground on a piece of cloth", nextNodeId: "n-q13", isLoadBearing: false,
        trainingFeedback: "Cloth is a permeable material and could harbour bacteria. Tools must be stored on a non-permeable material or sheet.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q12-c", label: "Off the ground on paper towels", nextNodeId: "n-q13", isLoadBearing: false,
        trainingFeedback: "Paper towels are absorbent and permeable. The correct surface for storing cleaned tools is a non-permeable material.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q12-d", label: "Off the ground on a non-permeable material or sheet", nextNodeId: "n-q13", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Cleaned and disinfected tools must be kept off the ground on a non-permeable material to prevent re-contamination.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q13",
    type: "CHOICE",
    label: "Q13 — Diesel spill near water supply installation",
    prompt: "What should you do if you spill diesel whilst working near a water supply installation?",
    responseType: "closed",
    options: [
      { id: "n-q13-a", label: "Clean it up and carry on working", nextNodeId: "n-q14", isLoadBearing: false,
        trainingFeedback: "Cleaning up alone is not sufficient — diesel can permeate MDPE pipes and contaminate the water supply. You must immediately inform your supervisor or site manager.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q13-b", label: "Neutralize it and dispose of it", nextNodeId: "n-q14", isLoadBearing: false,
        trainingFeedback: "Attempting to neutralise the spill yourself is not the correct first step. You must immediately report it to your supervisor or site manager.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q13-c", label: "Inform the supervisor/site manager immediately", nextNodeId: "n-q14", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. A diesel spill near water supply infrastructure must be reported to your supervisor or site manager immediately — fuel can permeate MDPE pipes and cause contamination.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q13-d", label: "Phone the Police", nextNodeId: "n-q14", isLoadBearing: false,
        trainingFeedback: "Contacting the Police is not the correct first response to a diesel spill near water infrastructure. Report to your supervisor or site manager immediately.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q14",
    type: "CHOICE",
    label: "Q14 — Result of water supply contamination",
    prompt: "Contamination of the water supply could result in:",
    responseType: "closed",
    options: [
      { id: "n-q14-a", label: "Increased public confidence", nextNodeId: "n-q15", isLoadBearing: false,
        trainingFeedback: "Contamination causes the opposite — it destroys public confidence in the water supply. The consequences are serious and far-reaching.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q14-b", label: "Better tasting water", nextNodeId: "n-q15", isLoadBearing: false,
        trainingFeedback: "Contamination does not improve water quality in any way. It can cause taste problems, illness, and regulatory action.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q14-c", label: "Normal service for customers", nextNodeId: "n-q15", isLoadBearing: false,
        trainingFeedback: "Contamination disrupts normal service significantly — customers may receive boil water notices and supply may be interrupted during investigation and remediation.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q14-d", label: "Customers being told to boil their water before use", nextNodeId: "n-q15", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. A boil water notice is one of the most common and serious consequences of water supply contamination — affecting thousands of customers.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q15",
    type: "CHOICE",
    label: "Q15 — Why personal hygiene is important on water supply installations",
    prompt: "Why is personal hygiene so important when working on water supply installations?",
    responseType: "closed",
    options: [
      { id: "n-q15-a", label: "In case your supervisor visits", nextNodeId: "n-q16", isLoadBearing: false,
        trainingFeedback: "Personal hygiene is not about appearances. The real reason is to prevent you from introducing contaminants into the water supply.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q15-b", label: "To ensure you do not contaminate the environment", nextNodeId: "n-q16", isLoadBearing: false,
        trainingFeedback: "Environmental protection is important, but on water supply installations the specific concern is preventing contamination of the drinking water supply itself.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q15-c", label: "To stop metal fittings from rusting", nextNodeId: "n-q16", isLoadBearing: false,
        trainingFeedback: "Personal hygiene has no bearing on metal corrosion. The purpose is to prevent introducing pathogens into the drinking water supply.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q15-d", label: "To ensure you do not contaminate the water supply", nextNodeId: "n-q16", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Personal hygiene on water supply installations is specifically about preventing you from introducing pathogens or contaminants into the drinking water supply.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q16",
    type: "CHOICE",
    label: "Q16 — Using the toilet on site",
    prompt: "What should you do if you are working on a site and need to use the toilet?",
    responseType: "closed",
    options: [
      { id: "n-q16-a", label: "Go behind the nearest bush", nextNodeId: "n-q17", isLoadBearing: false,
        trainingFeedback: "Urinating or defecating outdoors on a restricted operation site creates a direct contamination risk to the water supply. Always use designated welfare facilities.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q16-b", label: "Use a designated welfare facility", nextNodeId: "n-q17", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. You must use a designated welfare facility. Human waste on restricted operation sites is a serious contamination risk.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q16-c", label: "Use an old container", nextNodeId: "n-q17", isLoadBearing: false,
        trainingFeedback: "Using a container creates a disposal problem and a contamination risk. Always use a proper designated welfare facility.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q16-d", label: "Use the excavation in which you are working", nextNodeId: "n-q17", isLoadBearing: false,
        trainingFeedback: "Using the excavation is a serious contamination risk to the water supply infrastructure. Always use a designated welfare facility.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q17",
    type: "CHOICE",
    label: "Q17 — Clothing for water supply and sewage work",
    prompt: "If you are working on both water supply and sewage, you should have:",
    responseType: "closed",
    options: [
      { id: "n-q17-a", label: "One set of clothing for sewage work and another for drinking water", nextNodeId: "n-q18", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. You must use separate sets of clothing for sewage work and drinking water work to prevent cross-contamination.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q17-b", label: "Just one set of clothing that you use for both", nextNodeId: "n-q18", isLoadBearing: false,
        trainingFeedback: "Using the same clothing for both types of work creates a direct cross-contamination risk. Separate sets are mandatory.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q17-c", label: "One set of clothing to be used for both sewage and drinking water work, provided you wipe it down", nextNodeId: "n-q18", isLoadBearing: false,
        trainingFeedback: "Wiping down clothing is not sufficient to remove pathogens. Separate sets of clothing for each type of work are required.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q17-d", label: "Your own clothing", nextNodeId: "n-q18", isLoadBearing: false,
        trainingFeedback: "Personal clothing is not appropriate for restricted operations. Dedicated protective clothing, in separate sets for water and sewage work, is required.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q18",
    type: "CHOICE",
    label: "Q18 — Why pets and livestock are not allowed on restricted operation sites",
    prompt: "Why are pets and livestock NOT allowed on Restricted Operations sites?",
    responseType: "closed",
    options: [
      { id: "n-q18-a", label: "They may distract people", nextNodeId: "n-q19", isLoadBearing: false,
        trainingFeedback: "Distraction is a minor concern. The primary reason is that animals — including pets — are a significant source of pathogens including Cryptosporidium.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q18-b", label: "They may pose a risk to water quality", nextNodeId: "n-q19", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Pets and livestock can carry pathogens including Cryptosporidium. Their presence on restricted operation sites poses a direct risk to water quality.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q18-c", label: "They may damage equipment", nextNodeId: "n-q19", isLoadBearing: false,
        trainingFeedback: "Equipment damage is a minor concern. The primary reason animals are excluded is the contamination risk they pose to the water supply.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q18-d", label: "They may be dangerous and injure staff", nextNodeId: "n-q19", isLoadBearing: false,
        trainingFeedback: "Safety around animals is a general concern, but the specific reason for excluding them from restricted operations is the risk to water quality.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q19",
    type: "CHOICE",
    label: "Q19 — Storing small fittings in a van",
    prompt: "How must small fittings be stored in a van?",
    responseType: "closed",
    options: [
      { id: "n-q19-a", label: "Bagged and labelled", nextNodeId: "n-q20", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Small fittings must be stored in sealed, labelled bags to prevent contamination and ensure they are identifiable before use.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q19-b", label: "Off the ground", nextNodeId: "n-q20", isLoadBearing: false,
        trainingFeedback: "While being off the ground is good practice for larger items, small fittings specifically need to be bagged and labelled to prevent contamination.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q19-c", label: "In a bunded area", nextNodeId: "n-q20", isLoadBearing: false,
        trainingFeedback: "Bunded areas are for fuel and chemicals, not fittings. Small fittings must be stored in sealed, labelled bags.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q19-d", label: "On a paper towel", nextNodeId: "n-q20", isLoadBearing: false,
        trainingFeedback: "Paper towels are not an appropriate storage method for fittings. Small fittings must be stored in sealed, labelled bags.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q20",
    type: "CHOICE",
    label: "Q20 — Where to store fuel in a van",
    prompt: "Where should you store fuel in your van?",
    responseType: "closed",
    options: [
      { id: "n-q20-a", label: "In the passenger footwell, away from fittings", nextNodeId: "n-q21", isLoadBearing: false,
        trainingFeedback: "Fuel must never be stored loose in the vehicle interior. It must be stored in a separate bunded area to contain any spills and prevent contamination of fittings.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q20-b", label: "On a secure shelf with your tools", nextNodeId: "n-q21", isLoadBearing: false,
        trainingFeedback: "Storing fuel with tools creates a contamination risk. Fuel must be stored in a separate bunded area away from water supply fittings and equipment.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q20-c", label: "In a separate bunded area", nextNodeId: "n-q21", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Fuel must be stored in a separate bunded area — this contains any spillage and keeps it away from pipes, fittings and water assets.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q20-d", label: "With your pipes", nextNodeId: "n-q21", isLoadBearing: false,
        trainingFeedback: "Storing fuel with pipes is dangerous — fuel can permeate MDPE pipes and contaminate the water supply. Fuel must be stored in a separate bunded area.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q21",
    type: "CHOICE",
    label: "Q21 — How pipes must be stored",
    prompt: "How must pipes be stored?",
    responseType: "closed",
    options: [
      { id: "n-q21-a", label: "Labelled and stored anywhere safely away from the public", nextNodeId: "n-q22", isLoadBearing: false,
        trainingFeedback: "Simply being away from the public is not sufficient. Pipes must be stored off the ground, with capped ends, in a secure protected area.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q21-b", label: "On the ground, capped and protected", nextNodeId: "n-q22", isLoadBearing: false,
        trainingFeedback: "Pipes must never be stored directly on the ground — they must be off the ground, as well as capped and protected.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q21-c", label: "Neat and tidy", nextNodeId: "n-q22", isLoadBearing: false,
        trainingFeedback: "Being neat and tidy is good practice but does not cover the specific requirements: pipes must be stored in a secure area, off the ground, with capped and protected ends.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q21-d", label: "In a secure area, off the ground, capped and protected", nextNodeId: "n-q22", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Pipes must be stored in a secure area, off the ground, with capped ends and protected from contamination.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q22",
    type: "CHOICE",
    label: "Q22 — Where to find the approved products list",
    prompt: "Where can you find a list of Approved Products for the water sector in the UK?",
    responseType: "closed",
    options: [
      { id: "n-q22-a", label: "Drinking Water Quality Regulator (DWQR) website", nextNodeId: "n-q23", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. The approved products list for the water sector is published on the DWQR website, covering products approved under Regulation 31 (England) and Regulation 33 (Scotland).",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q22-b", label: "The Environmental Regulators website", nextNodeId: "n-q23", isLoadBearing: false,
        trainingFeedback: "Environmental regulators do not maintain the water sector approved products list. It is published by the Drinking Water Quality Regulator (DWQR).",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q22-c", label: "Information Commissioner's Office (ICO) website", nextNodeId: "n-q23", isLoadBearing: false,
        trainingFeedback: "The ICO deals with data protection, not water quality. The approved products list is on the DWQR website.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q22-d", label: "Health & Safety Executive (HSE) website", nextNodeId: "n-q23", isLoadBearing: false,
        trainingFeedback: "The HSE covers workplace health and safety broadly, but the water sector approved products list is maintained by the DWQR.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q23",
    type: "CHOICE",
    label: "Q23 — Process for making bacteria harmless in water",
    prompt: "The process of treating water to remove or make bacteria harmless is called:",
    responseType: "closed",
    options: [
      { id: "n-q23-a", label: "Abstraction", nextNodeId: "n-q24", isLoadBearing: false,
        trainingFeedback: "Abstraction is the process of taking water from a source such as a river or borehole. It does not treat or remove bacteria.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q23-b", label: "Disinfection", nextNodeId: "n-q24", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Disinfection is the process of treating water to remove or make bacteria harmless, typically using chlorine or UV treatment.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q23-c", label: "Sampling", nextNodeId: "n-q24", isLoadBearing: false,
        trainingFeedback: "Sampling tests water quality but does not treat it. Disinfection is the process that removes or neutralises harmful bacteria.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q23-d", label: "Screening", nextNodeId: "n-q24", isLoadBearing: false,
        trainingFeedback: "Screening removes physical debris from water but does not treat bacteria. The process for removing or neutralising bacteria is disinfection.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q24",
    type: "CHOICE",
    label: "Q24 — Disposing of chlorinated water",
    prompt: "Which of the following statements is true regarding the disposal of chlorinated water?",
    responseType: "closed",
    options: [
      { id: "n-q24-a", label: "Chlorinated water can cause pollution to the environment and can kill fish and wildlife", nextNodeId: "n-q25", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Chlorinated water is toxic to aquatic life and must never be discharged to surface drains, watercourses or the environment without appropriate dechlorination.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q24-b", label: "Chlorinated water can be poured down any drain", nextNodeId: "n-q25", isLoadBearing: false,
        trainingFeedback: "Incorrect. Chlorinated water must not be discharged without appropriate treatment — it can cause environmental pollution and harm to aquatic life.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q24-c", label: "Chlorinated water can be disposed of anywhere", nextNodeId: "n-q25", isLoadBearing: false,
        trainingFeedback: "Chlorinated water cannot be disposed of anywhere. It is toxic to aquatic life and improper disposal can result in a pollution incident.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q24-d", label: "Chlorinated water can be disposed of in a surface water drain", nextNodeId: "n-q25", isLoadBearing: false,
        trainingFeedback: "Surface water drains discharge directly to watercourses. Chlorinated water must never be discharged this way as it will kill fish and wildlife.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  {
    id: "n-q25",
    type: "CHOICE",
    label: "Q25 — Purpose of water quality sampling",
    prompt: "What is the purpose of taking drinking water quality samples?",
    responseType: "closed",
    options: [
      { id: "n-q25-a", label: "To check the water flow", nextNodeId: "n-end", isLoadBearing: false,
        trainingFeedback: "Flow monitoring is done separately using flow meters. Water quality sampling is specifically about confirming the water is safe to drink.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q25-b", label: "To confirm that water in the supply is safe for consumption", nextNodeId: "n-end", isLoadBearing: true,
        stateChanges: { score: 1 },
        trainingFeedback: "Correct. Water quality sampling confirms that the water in the supply is safe for human consumption. It is a legal requirement taken from treatment works and service reservoirs.",
        feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q25-c", label: "To check the water pressure", nextNodeId: "n-end", isLoadBearing: false,
        trainingFeedback: "Pressure is monitored using pressure sensors and gauges. Water quality sampling is about confirming the water is safe for consumption.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q25-d", label: "To check for any environmental discharge", nextNodeId: "n-end", isLoadBearing: false,
        trainingFeedback: "Environmental discharge monitoring is a separate activity. Drinking water quality sampling confirms the water is safe for human consumption.",
        feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },

  // ─── ENDPOINT ─────────────────────────────────────────────────────────────

  {
    id: "n-end",
    type: "ENDPOINT",
    label: "Test Complete",
    endpointId: "ep-result",
    outcomeLabel: "Not Yet Passed — Resit Required",
    closingLine:
      "To work on restricted operations you must hold a current NWH card. Please review the modules and arrange a resit with your training coordinator.",
    summaryInstruction:
      "Write two sentences noting the learner did not reach the 80% pass mark and encouraging them to review the modules before resitting.",
    outcomeVariants: [
      {
        counterKey: "score",
        minThreshold: 20,
        outcomeLabel: "Passed — NWH Certificate Awarded",
        closingLine:
          "Your NWH card will be issued through the EUSR scheme and is valid for three years.",
        summaryInstruction:
          "Write two sentences congratulating the learner on passing and noting their certificate will be issued via EUSR.",
      },
    ],
    scoreConfig: {
      counterKey: "score",
      maxScore: 25,
      passMark: 20,
      label: "Test Score",
    },
    outcomeCard: {
      shareable: false,
      showChoiceStats: true,
      showDepthStats: false,
      showReadingTime: false,
    },
  },
]

// ─── SHAPE ────────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 30,
  totalDepthMax: 60,
  endpointCount: 1,
  endpoints: [
    {
      id: "ep-result",
      label: "Test Complete",
      minChoicesToReach: 27,
      maxChoicesToReach: 27,
      narrativeWeight: "earned",
      emotionalTarget:
        "Clear outcome — pass or resit — with specific score, competency breakdown from both evaluative modules, and encouragement to continue.",
    },
  ],
  loadBearingChoices: [],
  convergencePoints: [],
  pacingModel: "competency_build",
  mandatoryNodeIds: [
    "n-intro",
    "n-m1-facts", "d-m1",
    "n-m2-facts", "n-m2-scene", "q-m2", "n-m2-debrief",
    "n-m3-facts", "n-m3-scene", "q-m3", "n-m3-outcome", "ev-m3",
    "n-m4-facts", "d-m4", "n-m4-summary", "ev-m4",
    "n-quiz-intro",
    "n-q1", "n-q2", "n-q3", "n-q4", "n-q5",
    "n-q6", "n-q7", "n-q8", "n-q9", "n-q10",
    "n-q11", "n-q12", "n-q13", "n-q14", "n-q15",
    "n-q16", "n-q17", "n-q18", "n-q19", "n-q20",
    "n-q21", "n-q22", "n-q23", "n-q24", "n-q25",
  ],
}

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding NWH Interactive certification experience...")

  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    create: {
      id: EXPERIENCE_ID,
      title: "National Water Hygiene — Interactive Certification Training",
      slug: "national-water-hygiene-interactive",
      type: "l_and_d",
      renderingTheme: "training",
      authorId: AUTHOR_ID,
      useCasePack: USE_CASE_PACKS["l_and_d"] as object,
      contextPack: contextPack as object,
      nodes: nodes as object[],
      shape: shape as object,
    },
    update: {
      title: "National Water Hygiene — Interactive Certification Training",
      type: "l_and_d",
      renderingTheme: "training",
      useCasePack: USE_CASE_PACKS["l_and_d"] as object,
      contextPack: contextPack as object,
      nodes: nodes as object[],
      shape: shape as object,
    },
  })

  const fixed = nodes.filter((n) => n.type === "FIXED").length
  const generated = nodes.filter((n) => n.type === "GENERATED").length
  const dialogue = nodes.filter((n) => n.type === "DIALOGUE").length
  const evaluative = nodes.filter((n) => n.type === "EVALUATIVE").length
  const checkpoint = nodes.filter((n) => n.type === "CHECKPOINT").length
  const choice = nodes.filter((n) => n.type === "CHOICE").length
  const endpoint = nodes.filter((n) => n.type === "ENDPOINT").length

  console.log(`✓ Experience created: ${EXPERIENCE_ID}`)
  console.log(`  → ${fixed} FIXED nodes (intro, key facts, debriefs)`)
  console.log(`  → ${generated} GENERATED nodes (immersive scenarios)`)
  console.log(`  → ${dialogue} DIALOGUE nodes (Jamie, Pat)`)
  console.log(`  → ${evaluative} EVALUATIVE nodes (contamination response, prevention)`)
  console.log(`  → ${checkpoint} CHECKPOINT nodes`)
  console.log(`  → ${choice} CHOICE nodes (2 scenario + 25 MCQ)`)
  console.log(`  → ${endpoint} ENDPOINT node`)
  console.log("")
  console.log("Visit: /scenario/00000000-0000-0000-0000-000000000041")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
