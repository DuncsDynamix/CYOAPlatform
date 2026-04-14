import { PrismaClient } from "@prisma/client"
import type {
  Node,
  ExperienceContextPack,
  ShapeDefinition,
} from "../types/experience"
import { USE_CASE_PACKS } from "../lib/engine/usecases"

const db = new PrismaClient()

// ─── IDs ────────────────────────────────────────────────────────────────────

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000040"

// ─── NODE GRAPH — National Water Hygiene Certification ──────────────────────
//
// Structure:
//   n-intro (FIXED: welcome + course overview)
//   ── Module 1: The Importance of Water ──
//   n-m1a (FIXED: What is wholesome water?)
//   n-m1b (FIXED: Water scarcity)
//   n-m1c (FIXED: Why water hygiene matters)
//   cp-m1 (CHECKPOINT: Module 1 complete)
//   ── Module 2: Water as a Carrier of Disease ──
//   n-m2a (FIXED: Waterborne disease — historical context)
//   n-m2b (FIXED: Cryptosporidium)
//   n-m2c (FIXED: Regulation and personal risk)
//   cp-m2 (CHECKPOINT: Module 2 complete)
//   ── Module 3: Potential Contamination and Its Consequences ──
//   n-m3a (FIXED: What are restricted operations?)
//   n-m3b (FIXED: Health exclusion criteria)
//   n-m3c (FIXED: Contamination sources by site)
//   n-m3d (FIXED: Consequences of contamination)
//   cp-m3 (CHECKPOINT: Module 3 complete)
//   ── Module 4: Preventing Contamination ──
//   n-m4a (FIXED: Personal hygiene and clothing)
//   n-m4b (FIXED: Vehicles, pets and site controls)
//   n-m4c (FIXED: Fuel, chemicals and approved products)
//   n-m4d (FIXED: Pipe and fitting storage)
//   n-m4e (FIXED: Disinfection and high-risk operations)
//   n-m4f (FIXED: Suspected contamination, sampling and EUSR card)
//   cp-m4 (CHECKPOINT: Module 4 complete)
//   n-quiz-intro (FIXED: test introduction)
//   n-q1 … n-q25 (CHOICE: 25 MCQ questions — all converge, score counter accumulates)
//   n-end (ENDPOINT: pass ≥ 20/25, fail < 20/25)

const nodes: Node[] = [

  // ─── INTRO ───────────────────────────────────────────────────────────────

  {
    id: "n-intro",
    type: "FIXED",
    label: "Welcome",
    mandatory: true,
    content: `# National Water Hygiene Certification

Welcome to the National Water Hygiene (NWH) certification training.

This course is delivered under the **EUSR scheme**. On successful completion you will receive an NWH card valid for **3 years**, registerable at eusr.co.uk.

**The course covers four modules:**
1. The Importance of Water
2. Water as a Carrier of Disease
3. Potential Contamination and Its Consequences
4. Preventing Contamination

After the training you will complete a **25-question multiple choice test**. You need to answer at least **20 questions correctly (80%)** to pass.`,
    nextNodeId: "n-m1a",
  },

  // ─── MODULE 1: THE IMPORTANCE OF WATER ───────────────────────────────────

  {
    id: "n-m1a",
    type: "FIXED",
    label: "Module 1 — What is wholesome water?",
    mandatory: true,
    content: `## Module 1: The Importance of Water

### What is Wholesome Water?

**Wholesome water** is water that has been treated and is safe for human consumption. It is the legal standard that all drinking water must meet in the UK.

Producing wholesome water is similar to food production — just as food hygiene removes harmful bacteria from food, water treatment removes bacteria, parasites and contaminants from the water supply.`,
    nextNodeId: "n-m1b",
  },

  {
    id: "n-m1b",
    type: "FIXED",
    label: "Module 1 — Water scarcity",
    mandatory: true,
    content: `### Water — A Scarce Resource

- **70%** of the Earth's surface is covered by water
- **97%** of that is seawater — not suitable for drinking
- Only **0.5%** of all water on Earth is fresh and drinkable

This scarcity means every litre of drinking water must be protected carefully throughout treatment and distribution.`,
    nextNodeId: "n-m1c",
  },

  {
    id: "n-m1c",
    type: "FIXED",
    label: "Module 1 — Why water hygiene matters",
    mandatory: true,
    content: `### Why Water Hygiene Matters

Water is the **world's largest food industry** — more products are made with water than any other ingredient.

- Humans can survive approximately **3 weeks without food**
- Humans can survive only **3 days without water**

Contaminating the water supply does not just affect drinking water — it affects every food and beverage product that uses it. Protecting water quality is one of the most important responsibilities in the water industry.`,
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
    nextNodeId: "n-m2a",
  },

  // ─── MODULE 2: WATER AS A CARRIER OF DISEASE ─────────────────────────────

  {
    id: "n-m2a",
    type: "FIXED",
    label: "Module 2 — Waterborne disease: historical context",
    mandatory: true,
    content: `## Module 2: Water as a Carrier of Disease

### Waterborne Disease: A Historical Lesson

In **1854**, a cholera outbreak in Soho, London killed over 600 people. Dr John Snow traced the source to a contaminated water pump on Broad Street — demonstrating for the first time that water could transmit fatal disease.

The risk has not gone away. Contaminated water still causes illness and death worldwide. Your role in protecting the water supply is part of a public health system that protects millions of people.`,
    nextNodeId: "n-m2b",
  },

  {
    id: "n-m2b",
    type: "FIXED",
    label: "Module 2 — Cryptosporidium",
    mandatory: true,
    content: `### Cryptosporidium — A Modern Threat

**Cryptosporidium** is a microscopic parasite that lives in the intestines of animals and humans. It is one of the most significant water safety risks because:

- It is **resistant to chlorine** — standard disinfection does not kill it
- It must be **physically removed** through filtration or destroyed by UV treatment
- Infection causes severe gastrointestinal illness

If Cryptosporidium enters the water supply, the consequences are serious. This is why physical containment and hygiene controls around water sources are critical.`,
    nextNodeId: "n-m2c",
  },

  {
    id: "n-m2c",
    type: "FIXED",
    label: "Module 2 — Regulation and personal risk",
    mandatory: true,
    content: `### Regulation and Personal Responsibility

Water quality in England and Wales is regulated by the **Drinking Water Inspectorate (DWI)**. In Scotland it is regulated by the **DWQR**.

**If you return from abroad or have been ill:**

If you have had diarrhoea or vomiting — including after travelling to a country with lower sanitation standards — you **must report this to your supervisor** before working on any water asset. You may be required to undergo a health screen before returning to restricted operations.

Failure to report places public health at risk and may be a disciplinary matter.`,
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
    nextNodeId: "n-m3a",
  },

  // ─── MODULE 3: POTENTIAL CONTAMINATION AND ITS CONSEQUENCES ──────────────

  {
    id: "n-m3a",
    type: "FIXED",
    label: "Module 3 — What are restricted operations?",
    mandatory: true,
    content: `## Module 3: Potential Contamination and Its Consequences

### What Are Restricted Operations?

A **restricted operation** is any work that involves:
- Direct contact with untreated (raw) water sources
- Work at water treatment works
- Work on or near any asset in contact with potable (treated, drinkable) water

**Sites that are restricted operations include:**
- Boreholes
- Rivers and raw water intakes
- Raw water reservoirs
- Water treatment works (including disinfection, screening)
- Service reservoirs and water towers
- The distribution network (mains, valves, connections)

To work on restricted operations, you must hold a current **National Water Hygiene card** issued under the EUSR scheme.`,
    nextNodeId: "n-m3b",
  },

  {
    id: "n-m3b",
    type: "FIXED",
    label: "Module 3 — Health exclusion criteria",
    mandatory: true,
    content: `### Health Exclusion — When You Must Not Work

You **must not work on restricted operations** if you currently have, or have recently had, any of the following:

- Persistent vomiting or diarrhoea
- Prolonged unexplained fever
- Cryptosporidiosis
- Jaundice
- Hepatitis A or E
- Dysentery
- Typhoid or paratyphoid (this applies even if a **family member** has been diagnosed — cross-infection risk)

If you develop any of these conditions while at work, inform your supervisor immediately and leave the restricted operation site.

These exclusions exist because contaminated individuals can shed pathogens that are extremely difficult to remove from the water supply once introduced.`,
    nextNodeId: "n-m3c",
  },

  {
    id: "n-m3c",
    type: "FIXED",
    label: "Module 3 — Contamination sources by site",
    mandatory: true,
    content: `### How Contamination Happens

Contamination can enter the water supply at different points in the system:

| Site | Contamination risk |
|------|--------------------|
| Water treatment works | Poor personal hygiene during maintenance |
| Service reservoirs | Animals, livestock, open access hatches |
| Water towers | Structural deterioration, bird access |
| Distribution network | Pressure fluctuations, illegal cross-connections |

Each of these risks can be prevented through training, personal hygiene, and following correct procedures.`,
    nextNodeId: "n-m3d",
  },

  {
    id: "n-m3d",
    type: "FIXED",
    label: "Module 3 — Consequences of contamination",
    mandatory: true,
    content: `### Consequences of Contamination

Contaminating the water supply can result in:

- **Boil water notices** affecting thousands of customers
- **Customer illness** — or in severe cases, death
- **Sample failures** requiring urgent investigation
- **Regulator investigation** by DWI or DWQR
- **Company investigation** and disciplinary action
- **Prosecution** under the Water Industry Act
- **Significant reputational damage** to your employer

These are not theoretical risks. Water contamination incidents have resulted in criminal prosecutions. The consequences are severe because the harm is so widespread.`,
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
    nextNodeId: "n-m4a",
  },

  // ─── MODULE 4: PREVENTING CONTAMINATION ──────────────────────────────────

  {
    id: "n-m4a",
    type: "FIXED",
    label: "Module 4 — Personal hygiene and clothing",
    mandatory: true,
    content: `## Module 4: Preventing Contamination

### Personal Hygiene

**Hand washing** is the most important personal hygiene action you can take. Wash your hands:
- Before and after working on restricted operations
- After using the toilet
- After contact with soil or contaminated materials

**Clothing:**
- Use **separate sets of clothing** for water work and sewage work — never wear the same garments for both
- Dedicated protective clothing must be worn at all restricted operation sites`,
    nextNodeId: "n-m4b",
  },

  {
    id: "n-m4b",
    type: "FIXED",
    label: "Module 4 — Vehicles, pets and site controls",
    mandatory: true,
    content: `### Vehicles, Pets and Site Controls

**Vehicles:**
- Keep the vehicle clean and well-organised
- Use tool racking — do not store tools loose with fittings
- Risk-assess your vehicle before visiting restricted operation sites

**Pets and livestock:**
- **Pets and livestock are not permitted** on restricted operation sites
- They are a significant source of Cryptosporidium and other pathogens`,
    nextNodeId: "n-m4c",
  },

  {
    id: "n-m4c",
    type: "FIXED",
    label: "Module 4 — Fuel, chemicals and approved products",
    mandatory: true,
    content: `### Fuel, Chemicals and Approved Products

**Fuel and chemicals can permeate MDPE pipes**, causing taste and odour problems that are very difficult to resolve. Always:
- Store fuel and chemicals in a **bunded area** — separated from pipes, fittings and water assets
- Label all containers clearly
- Never store fuel in the footwell or loose in the vehicle

**Approved Products:**
Only products approved under:
- **Regulation 31** — Water Supply (Water Quality) Regulations 2018 (England)
- **Regulation 33** — Public Water Supplies (Scotland) Regulations 2014

must be used in contact with the water supply. The approved products list is published on the **DWQR website**.`,
    nextNodeId: "n-m4d",
  },

  {
    id: "n-m4d",
    type: "FIXED",
    label: "Module 4 — Pipe and fitting storage",
    mandatory: true,
    content: `### Pipe and Fitting Storage

Pipes and fittings that contact the water supply must be stored correctly:

- Stored **off the ground** on racking — never on bare soil or a van floor
- **Capped ends** on all pipes at all times when not in use
- Small fittings stored in **sealed, labelled bags**
- Protected from fuel, chemicals, herbicides and pesticides
- **Visually inspected** for signs of contamination before use — never use a fitting that has been exposed to contaminants`,
    nextNodeId: "n-m4e",
  },

  {
    id: "n-m4e",
    type: "FIXED",
    label: "Module 4 — Disinfection and high-risk operations",
    mandatory: true,
    content: `### Disinfection and High-Risk Operations

**Chlorination/disinfection** is required after certain operations. Requirements:
- Minimum strength: **1,000 mg/litre** chlorine
- Use only **approved products** (see Regulation 31 / Regulation 33)
- Prepare fresh solutions **daily** — do not reuse previous day's solution

**High-risk operations** requiring chlorination and testing before returning supply:
- Planned maintenance on supply assets
- Mains repair (burst main)
- Tapping a new connection

After completing these operations, the asset must be **flushed, chlorinated and sampled** before being returned to supply.

**Disposal of chlorinated water:** Never discharge to surface drains or watercourses — chlorine is toxic to aquatic life and can cause a pollution incident.`,
    nextNodeId: "n-m4f",
  },

  {
    id: "n-m4f",
    type: "FIXED",
    label: "Module 4 — Suspected contamination, sampling and EUSR card",
    mandatory: true,
    content: `### Suspected Contamination, Sampling and Your EUSR Card

**If you suspect contamination:**
1. Stop work immediately
2. Isolate the affected asset
3. Report to your supervisor without delay
4. Do not attempt to resolve the situation yourself

**Water quality sampling:**
- A legal requirement taken from treatment works and service reservoirs
- Confirms that water leaving the system is safe for consumption
- Also taken after any high-risk operation before supply is returned

**Your EUSR card:**
- Required to work on restricted operations
- Valid for **3 years** from issue
- Searchable by employers at eusr.co.uk
- You must hold a current card before returning to restricted operations after a break in certification`,
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

  // ─── QUIZ INTRO ──────────────────────────────────────────────────────────

  {
    id: "n-quiz-intro",
    type: "FIXED",
    label: "Test introduction",
    mandatory: true,
    content: `## National Water Hygiene Test

You have completed all four training modules.

The test contains **25 questions**. You need to answer at least **20 correctly (80%)** to pass and receive your NWH card.

Read each question carefully and select the best answer.`,
    nextNodeId: "n-q1",
  },

  // ─── MCQ QUESTIONS ───────────────────────────────────────────────────────

  {
    id: "n-q1",
    type: "CHOICE",
    label: "Q1 — Wholesome water",
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

  // ─── ENDPOINT ────────────────────────────────────────────────────────────

  {
    id: "n-end",
    type: "ENDPOINT",
    label: "Test Complete",
    endpointId: "ep-result",
    outcomeLabel: "Not Yet Passed — Resit Required",
    closingLine: "To work on restricted operations you must hold a current NWH card. Please review the modules and arrange a resit with your training coordinator.",
    summaryInstruction: "Write two sentences noting the learner did not reach the 80% pass mark and encouraging them to review the modules before resitting.",
    outcomeVariants: [
      {
        counterKey: "score",
        minThreshold: 20,
        outcomeLabel: "Passed — NWH Certificate Awarded",
        closingLine: "Your NWH card will be issued through the EUSR scheme and is valid for three years.",
        summaryInstruction: "Write two sentences congratulating the learner on passing and noting their certificate will be issued via EUSR.",
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

// ─── CONTEXT PACK ────────────────────────────────────────────────────────────

const contextPack: ExperienceContextPack = {
  world: {
    description: "National Water Hygiene (NWH) certification training delivered under the EUSR scheme. Learners are water industry operatives seeking certification to work on restricted operations involving potable water assets.",
    rules: "Training content is factual and compliance-driven. MCQ questions have one correct answer. All content is based on the NWH syllabus as required by the EUSR scheme.",
    atmosphere: "Professional, formal, compliance-focused. No narrative embellishment — content is presented directly and factually.",
  },
  protagonist: {
    perspective: "you",
    role: "Water industry operative seeking NWH certification",
    knowledge: "General awareness of water industry work. Seeking the knowledge and certification to work on restricted operations.",
    goal: "Complete the NWH training modules and pass the 25-question test with at least 20 correct answers to receive an NWH card.",
  },
  actors: [],
  style: {
    tone: "formal",
    language: "en-GB",
    register: "professional",
    targetLength: { min: 80, max: 200 },
    styleNotes: "Professional, clear, compliance-focused. No narrative embellishment. Present content factually. Questions are direct and unambiguous.",
  },
  groundTruth: [],
  scripts: [],
}

// ─── SHAPE ───────────────────────────────────────────────────────────────────

const shape: ShapeDefinition = {
  totalDepthMin: 25,
  totalDepthMax: 50,
  endpointCount: 1,
  endpoints: [
    {
      id: "ep-result",
      label: "Test Complete",
      minChoicesToReach: 25,
      maxChoicesToReach: 25,
      narrativeWeight: "earned",
      emotionalTarget: "Clear outcome — pass or resit — with specific score and encouragement to continue.",
    },
  ],
  loadBearingChoices: [],
  convergencePoints: [],
  pacingModel: "competency_build",
  mandatoryNodeIds: [
    "n-intro",
    "n-m1a", "n-m1b", "n-m1c",
    "n-m2a", "n-m2b", "n-m2c",
    "n-m3a", "n-m3b", "n-m3c", "n-m3d",
    "n-m4a", "n-m4b", "n-m4c", "n-m4d", "n-m4e", "n-m4f",
    "n-quiz-intro",
    "n-q1", "n-q2", "n-q3", "n-q4", "n-q5",
    "n-q6", "n-q7", "n-q8", "n-q9", "n-q10",
    "n-q11", "n-q12", "n-q13", "n-q14", "n-q15",
    "n-q16", "n-q17", "n-q18", "n-q19", "n-q20",
    "n-q21", "n-q22", "n-q23", "n-q24", "n-q25",
  ],
}

// ─── SEED ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding National Water Hygiene certification experience...")

  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    create: {
      id: EXPERIENCE_ID,
      title: "National Water Hygiene — Certification Training",
      slug: "national-water-hygiene-certification",
      type: "l_and_d",
      renderingTheme: "training",
      authorId: AUTHOR_ID,
      useCasePack: USE_CASE_PACKS["l_and_d"] as object,
      contextPack: contextPack as object,
      nodes: nodes as object[],
      shape: shape as object,
    },
    update: {
      title: "National Water Hygiene — Certification Training",
      type: "l_and_d",
      renderingTheme: "training",
      useCasePack: USE_CASE_PACKS["l_and_d"] as object,
      contextPack: contextPack as object,
      nodes: nodes as object[],
      shape: shape as object,
    },
  })

  console.log(`✓ Experience created: ${EXPERIENCE_ID}`)
  console.log(`  → ${nodes.filter((n) => n.type === "FIXED").length} FIXED nodes (content sections)`)
  console.log(`  → ${nodes.filter((n) => n.type === "CHECKPOINT").length} CHECKPOINT nodes`)
  console.log(`  → ${nodes.filter((n) => n.type === "CHOICE").length} CHOICE nodes (MCQ questions)`)
  console.log(`  → ${nodes.filter((n) => n.type === "ENDPOINT").length} ENDPOINT node`)
  console.log("")
  console.log("Visit: /scenario/00000000-0000-0000-0000-000000000040")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
