/**
 * NWH certification training — slide-deck variant (Experience ID: ...0042)
 *
 * Same content and 25-question MCQ as seed-nwh.ts (...0040), but the module
 * content is delivered via SLIDE_DECK nodes (one per module + intro + quiz
 * intro) instead of plain FIXED text nodes. Uses images from the source
 * PPTX media folder, copied to public/uploads/seed/ at seed time.
 */

import { PrismaClient } from "@prisma/client"
import { copyFile, mkdir } from "fs/promises"
import path from "path"
import type { Node, ExperienceContextPack, ShapeDefinition } from "../types/experience"
import { USE_CASE_PACKS } from "../lib/engine/usecases"

const db = new PrismaClient()

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"
const EXPERIENCE_ID = "00000000-0000-0000-0000-000000000042"

const MEDIA_SRC = path.join(__dirname, "..", "thamesWater", "media", "ppt", "media")
const SEED_UPLOADS = path.join(__dirname, "..", "public", "uploads", "seed")

const SLIDE_IMAGES = [
  { src: "image10.jpeg",  dest: "nwh-training-room.jpeg",       url: "/uploads/seed/nwh-training-room.jpeg" },
  { src: "image109.png",  dest: "nwh-hand-washing.png",         url: "/uploads/seed/nwh-hand-washing.png" },
  { src: "image108.png",  dest: "nwh-hand-sanitiser.png",       url: "/uploads/seed/nwh-hand-sanitiser.png" },
  { src: "image113.png",  dest: "nwh-water-clothing.png",       url: "/uploads/seed/nwh-water-clothing.png" },
  { src: "image115.png",  dest: "nwh-dog-in-van.png",           url: "/uploads/seed/nwh-dog-in-van.png" },
  { src: "image116.jpeg", dest: "nwh-livestock.jpeg",           url: "/uploads/seed/nwh-livestock.jpeg" },
  { src: "image123.jpeg", dest: "nwh-container-labelling.jpeg", url: "/uploads/seed/nwh-container-labelling.jpeg" },
  { src: "image124.jpeg", dest: "nwh-water-pipes.jpeg",         url: "/uploads/seed/nwh-water-pipes.jpeg" },
  { src: "image125.jpeg", dest: "nwh-pipe-storage.jpeg",        url: "/uploads/seed/nwh-pipe-storage.jpeg" },
  { src: "image129.jpeg", dest: "nwh-purification-tablets.jpeg", url: "/uploads/seed/nwh-purification-tablets.jpeg" },
  { src: "image130.jpeg", dest: "nwh-sodium-hypochlorite.jpeg", url: "/uploads/seed/nwh-sodium-hypochlorite.jpeg" },
  { src: "image12.jpeg",  dest: "nwh-eusr-card.jpeg",           url: "/uploads/seed/nwh-eusr-card.jpeg" },
]

const [
  IMG_TRAINING_ROOM,
  IMG_HAND_WASHING,
  IMG_HAND_SANITISER,
  IMG_WATER_CLOTHING,
  IMG_DOG_IN_VAN,
  IMG_LIVESTOCK,
  IMG_CONTAINER_LABELLING,
  IMG_WATER_PIPES,
  IMG_PIPE_STORAGE,
  IMG_PURIFICATION_TABLETS,
  IMG_SODIUM_HYPOCHLORITE,
  IMG_EUSR_CARD,
] = SLIDE_IMAGES.map((i) => i.url)

// ─── NODE GRAPH ───────────────────────────────────────────────────────────────

const nodes: Node[] = [

  // ─── INTRO SLIDE DECK ────────────────────────────────────────────────────

  {
    id: "sd-intro",
    type: "SLIDE_DECK",
    label: "Welcome — course introduction",
    nextNodeId: "sd-m1",
    slides: [
      {
        id: "sd-intro-s1",
        template: "title",
        title: "National Water Hygiene",
        body: "EUSR Certification Training\n\nThis course qualifies you to work on restricted operations involving potable water assets.",
      },
      {
        id: "sd-intro-s2",
        template: "image-right",
        title: "What This Course Covers",
        body: "Four training modules followed by a 25-question multiple choice test.\n\n1. The Importance of Water\n2. Water as a Carrier of Disease\n3. Potential Contamination and Its Consequences\n4. Preventing Contamination\n\nYou need to answer at least 20 questions correctly (80%) to receive your NWH card, valid for 3 years.",
        mediaUrl: IMG_TRAINING_ROOM,
        caption: "NWH training centre",
      },
    ],
  },

  // ─── MODULE 1 SLIDE DECK ─────────────────────────────────────────────────

  {
    id: "sd-m1",
    type: "SLIDE_DECK",
    label: "Module 1 — The Importance of Water",
    nextNodeId: "cp-m1",
    slides: [
      {
        id: "sd-m1-s1",
        template: "title",
        title: "Module 1",
        body: "The Importance of Water",
      },
      {
        id: "sd-m1-s2",
        template: "text-only",
        title: "What is Wholesome Water?",
        body: "Wholesome water is water that has been treated and is safe for human consumption. It is the legal standard that all drinking water must meet in the UK.\n\nProducing wholesome water is similar to food production — just as food hygiene removes harmful bacteria from food, water treatment removes bacteria, parasites and contaminants from the water supply.",
      },
      {
        id: "sd-m1-s3",
        template: "text-only",
        title: "Water — A Scarce Resource",
        body: "• 70% of the Earth's surface is covered by water\n• 97% of that is seawater — not suitable for drinking\n• Only 0.5% of all water on Earth is fresh and drinkable\n\nThis scarcity means every litre of drinking water must be protected carefully throughout treatment and distribution.",
      },
      {
        id: "sd-m1-s4",
        template: "text-only",
        title: "Why Water Hygiene Matters",
        body: "Water is the world's largest food industry — more products are made with water than any other ingredient.\n\n• Humans can survive approximately 3 weeks without food\n• Humans can survive only 3 days without water\n\nContaminating the water supply does not just affect drinking water — it affects every food and beverage product that uses it. Protecting water quality is one of the most important responsibilities in the water industry.",
      },
    ],
  },

  {
    id: "cp-m1",
    type: "CHECKPOINT",
    label: "Module 1 complete",
    visible: false,
    marksCompletionOf: "Module 1 — The Importance of Water",
    unlocks: [],
    snapshotsState: false,
    nextNodeId: "sd-m2",
  },

  // ─── MODULE 2 SLIDE DECK ─────────────────────────────────────────────────

  {
    id: "sd-m2",
    type: "SLIDE_DECK",
    label: "Module 2 — Water as a Carrier of Disease",
    nextNodeId: "cp-m2",
    slides: [
      {
        id: "sd-m2-s1",
        template: "title",
        title: "Module 2",
        body: "Water as a Carrier of Disease",
      },
      {
        id: "sd-m2-s2",
        template: "text-only",
        title: "Waterborne Disease: A Historical Lesson",
        body: "In 1854, a cholera outbreak in Soho, London killed over 600 people. Dr John Snow traced the source to a contaminated water pump on Broad Street — demonstrating for the first time that water could transmit fatal disease.\n\nThe risk has not gone away. Contaminated water still causes illness and death worldwide. Your role in protecting the water supply is part of a public health system that protects millions of people.",
      },
      {
        id: "sd-m2-s3",
        template: "text-only",
        title: "Cryptosporidium — A Modern Threat",
        body: "Cryptosporidium is a microscopic parasite that lives in the intestines of animals and humans. It is one of the most significant water safety risks because:\n\n• It is resistant to chlorine — standard disinfection does not kill it\n• It must be physically removed through filtration or destroyed by UV treatment\n• Infection causes severe gastrointestinal illness\n\nIf Cryptosporidium enters the water supply, the consequences are serious. This is why physical containment and hygiene controls around water sources are critical.",
      },
      {
        id: "sd-m2-s4",
        template: "text-only",
        title: "Regulation and Personal Responsibility",
        body: "Water quality in England and Wales is regulated by the Drinking Water Inspectorate (DWI). In Scotland it is regulated by the DWQR.\n\nIf you return from abroad or have been ill:\n\nIf you have had diarrhoea or vomiting — including after travelling to a country with lower sanitation standards — you must report this to your supervisor before working on any water asset. You may be required to undergo a health screen before returning to restricted operations.\n\nFailure to report places public health at risk and may be a disciplinary matter.",
      },
    ],
  },

  {
    id: "cp-m2",
    type: "CHECKPOINT",
    label: "Module 2 complete",
    visible: false,
    marksCompletionOf: "Module 2 — Water as a Carrier of Disease",
    unlocks: [],
    snapshotsState: false,
    nextNodeId: "sd-m3",
  },

  // ─── MODULE 3 SLIDE DECK ─────────────────────────────────────────────────

  {
    id: "sd-m3",
    type: "SLIDE_DECK",
    label: "Module 3 — Potential Contamination and Its Consequences",
    nextNodeId: "cp-m3",
    slides: [
      {
        id: "sd-m3-s1",
        template: "title",
        title: "Module 3",
        body: "Potential Contamination and Its Consequences",
      },
      {
        id: "sd-m3-s2",
        template: "text-only",
        title: "What Are Restricted Operations?",
        body: "A restricted operation is any work that involves:\n• Direct contact with untreated (raw) water sources\n• Work at water treatment works\n• Work on or near any asset in contact with potable (treated, drinkable) water\n\nSites that are restricted operations include:\n• Boreholes and river intakes\n• Raw water reservoirs\n• Water treatment works (including disinfection, screening)\n• Service reservoirs and water towers\n• The distribution network (mains, valves, connections)\n\nTo work on restricted operations, you must hold a current National Water Hygiene card issued under the EUSR scheme.",
      },
      {
        id: "sd-m3-s3",
        template: "text-only",
        title: "Health Exclusion — When You Must Not Work",
        body: "You must not work on restricted operations if you currently have, or have recently had:\n\n• Persistent vomiting or diarrhoea\n• Prolonged unexplained fever\n• Cryptosporidiosis\n• Jaundice\n• Hepatitis A or E\n• Dysentery\n• Typhoid or paratyphoid (including if a family member has been diagnosed)\n\nIf you develop any of these conditions while at work, inform your supervisor immediately and leave the restricted operation site.",
      },
      {
        id: "sd-m3-s4",
        template: "image-right",
        title: "How Contamination Happens",
        body: "Contamination can enter the water supply at different points:\n\n• Water treatment works — poor personal hygiene during maintenance\n• Service reservoirs — animals, livestock, open access hatches\n• Water towers — structural deterioration, bird access\n• Distribution network — pressure fluctuations, illegal cross-connections\n\nEach of these risks can be prevented through training, personal hygiene, and following correct procedures.",
        mediaUrl: IMG_LIVESTOCK,
        caption: "Livestock on or near water catchment areas are a significant contamination risk",
      },
      {
        id: "sd-m3-s5",
        template: "text-only",
        title: "Consequences of Contamination",
        body: "Contaminating the water supply can result in:\n\n• Boil water notices affecting thousands of customers\n• Customer illness — or in severe cases, death\n• Sample failures requiring urgent investigation\n• Regulator investigation by DWI or DWQR\n• Company investigation and disciplinary action\n• Prosecution under the Water Industry Act\n• Significant reputational damage to your employer\n\nThese are not theoretical risks. Water contamination incidents have resulted in criminal prosecutions.",
      },
    ],
  },

  {
    id: "cp-m3",
    type: "CHECKPOINT",
    label: "Module 3 complete",
    visible: false,
    marksCompletionOf: "Module 3 — Potential Contamination and Its Consequences",
    unlocks: [],
    snapshotsState: false,
    nextNodeId: "sd-m4",
  },

  // ─── MODULE 4 SLIDE DECK ─────────────────────────────────────────────────

  {
    id: "sd-m4",
    type: "SLIDE_DECK",
    label: "Module 4 — Preventing Contamination",
    nextNodeId: "cp-m4",
    slides: [
      {
        id: "sd-m4-s1",
        template: "title",
        title: "Module 4",
        body: "Preventing Contamination",
      },
      {
        id: "sd-m4-s2",
        template: "image-left",
        title: "Personal Hygiene",
        body: "Hand washing is the most important personal hygiene action you can take. Wash your hands:\n• Before and after working on restricted operations\n• After using the toilet\n• After contact with soil or contaminated materials\n\nUse soap and water where available. Hand sanitiser should supplement, not replace, hand washing.",
        mediaUrl: IMG_HAND_WASHING,
        caption: "Wash hands before and after restricted operations",
      },
      {
        id: "sd-m4-s3",
        template: "image-right",
        title: "Clothing",
        body: "Use separate sets of clothing for water work and sewage work — never wear the same garments for both.\n\nDedicated protective clothing must be worn at all restricted operation sites.\n\nBlue = water supply work\nGreen = sewage / wastewater work\n\nThis colour convention prevents cross-contamination between the two systems.",
        mediaUrl: IMG_WATER_CLOTHING,
        caption: "Blue protective clothing — for water supply work only",
      },
      {
        id: "sd-m4-s4",
        template: "image-left",
        title: "Vehicles, Pets and Site Controls",
        body: "Vehicles:\n• Keep the vehicle clean and well-organised\n• Use tool racking — do not store tools loose with fittings\n• Risk-assess your vehicle before visiting restricted operation sites\n\nPets and livestock:\n• Pets and livestock are not permitted on restricted operation sites\n• They are a significant source of Cryptosporidium and other pathogens\n• This includes dogs in vehicles parked on site",
        mediaUrl: IMG_DOG_IN_VAN,
        caption: "Pets must not be brought to restricted operation sites",
      },
      {
        id: "sd-m4-s5",
        template: "image-right",
        title: "Fuel, Chemicals and Approved Products",
        body: "Fuel and chemicals can permeate MDPE pipes, causing taste and odour problems. Always:\n• Store fuel and chemicals in a bunded area — separated from pipes, fittings and water assets\n• Label all containers clearly\n• Never store fuel in the footwell or loose in the vehicle\n\nOnly products approved under Regulation 31 (England) or Regulation 33 (Scotland) may be used in contact with the water supply. The approved products list is on the DWQR website.",
        mediaUrl: IMG_CONTAINER_LABELLING,
        caption: "All containers must be clearly labelled — 'Not Drinking Water' containers must never contact the supply",
      },
      {
        id: "sd-m4-s6",
        template: "image-left",
        title: "Pipe and Fitting Storage",
        body: "Pipes and fittings must be stored correctly:\n• Stored off the ground on racking — never on bare soil or a van floor\n• Capped ends on all pipes at all times when not in use\n• Small fittings stored in sealed, labelled bags\n• Protected from fuel, chemicals, herbicides and pesticides\n• Visually inspected for contamination before use",
        mediaUrl: IMG_PIPE_STORAGE,
        caption: "Pipe fittings stored off the ground in sealed bags — a regulatory requirement",
      },
      {
        id: "sd-m4-s7",
        template: "image-right",
        title: "Disinfection and High-Risk Operations",
        body: "Chlorination is required after certain operations:\n• Minimum strength: 1,000 mg/litre chlorine\n• Use only approved products (Regulation 31 / Regulation 33)\n• Prepare fresh solutions daily — do not reuse previous day's solution\n\nHigh-risk operations requiring chlorination:\n• Planned maintenance on supply assets\n• Mains repair (burst main)\n• Tapping a new connection\n\nDisposal: never discharge chlorinated water to surface drains or watercourses — chlorine is toxic to aquatic life.",
        mediaUrl: IMG_SODIUM_HYPOCHLORITE,
        caption: "Sodium hypochlorite solution — approved disinfectant for water supply operations",
      },
      {
        id: "sd-m4-s8",
        template: "image-left",
        title: "Suspected Contamination and Your EUSR Card",
        body: "If you suspect contamination:\n1. Stop work immediately\n2. Isolate the affected asset\n3. Report to your supervisor without delay\n4. Do not attempt to resolve the situation yourself\n\nYour EUSR card:\n• Required to work on restricted operations\n• Valid for 3 years from issue\n• Searchable by employers at eusr.co.uk\n• Must be current before returning to restricted operations after a break in certification",
        mediaUrl: IMG_EUSR_CARD,
        caption: "Your NWH card — issued through EUSR, valid for 3 years",
      },
    ],
  },

  {
    id: "cp-m4",
    type: "CHECKPOINT",
    label: "Module 4 complete",
    visible: false,
    marksCompletionOf: "Module 4 — Preventing Contamination",
    unlocks: [],
    snapshotsState: false,
    nextNodeId: "sd-quiz-intro",
  },

  // ─── QUIZ INTRO SLIDE DECK ───────────────────────────────────────────────

  {
    id: "sd-quiz-intro",
    type: "SLIDE_DECK",
    label: "Test introduction",
    nextNodeId: "n-q1",
    slides: [
      {
        id: "sd-quiz-s1",
        template: "title",
        title: "National Water Hygiene Test",
        body: "25 questions — 80% required to pass\n\nYou have completed all four training modules.\n\nRead each question carefully and select the best answer.",
      },
    ],
  },

  // ─── MCQ QUESTIONS (identical to seed-nwh.ts) ────────────────────────────

  {
    id: "n-q1", type: "CHOICE", label: "Q1 — Wholesome water",
    prompt: "What is the meaning of wholesome water?",
    responseType: "closed",
    options: [
      { id: "n-q1-a", label: "Water that contains parasites", nextNodeId: "n-q2", isLoadBearing: false, trainingFeedback: "Water containing parasites would be unsafe to drink. Wholesome water has been treated to remove such hazards.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q1-b", label: "Water that has a high concentration of chlorine", nextNodeId: "n-q2", isLoadBearing: false, trainingFeedback: "High chlorine concentrations alone do not define wholesome water. The legal standard is about safety for consumption, not chemical content.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q1-c", label: "Water that has medicinal qualities", nextNodeId: "n-q2", isLoadBearing: false, trainingFeedback: "Drinking water is not required to have medicinal properties. Wholesome water simply means it is treated and safe to consume.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q1-d", label: "Water that has been treated and is safe for consumption", nextNodeId: "n-q2", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Wholesome water is the legal standard — water that has been treated and is safe for human consumption.", feedbackTone: "positive", competencySignal: "The Importance of Water" },
    ],
  },
  {
    id: "n-q2", type: "CHOICE", label: "Q2 — Milk and water production",
    prompt: "Why are milk and drinking water similar in their production?",
    responseType: "closed",
    options: [
      { id: "n-q2-a", label: "They both have harmful bacteria removed before being distributed", nextNodeId: "n-q3", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Both milk and drinking water go through treatment processes that remove harmful bacteria before reaching the consumer.", feedbackTone: "positive", competencySignal: "The Importance of Water" },
      { id: "n-q2-b", label: "They both go in containers", nextNodeId: "n-q3", isLoadBearing: false, trainingFeedback: "While both products are often delivered in containers, that is not the meaningful similarity. The key link is the food hygiene process both undergo.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q2-c", label: "There are no similarities", nextNodeId: "n-q3", isLoadBearing: false, trainingFeedback: "There is a direct similarity — both water and milk are subject to treatment processes that remove harmful bacteria before distribution.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q2-d", label: "They're both boiled before being distributed", nextNodeId: "n-q3", isLoadBearing: false, trainingFeedback: "Drinking water is not boiled as part of standard treatment. The similarity is that both undergo processes to remove harmful bacteria.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
    ],
  },
  {
    id: "n-q3", type: "CHOICE", label: "Q3 — Drinkable water percentage",
    prompt: "Water covers 70% of our planet, how much of this water is suitable for use as drinking water?",
    responseType: "closed",
    options: [
      { id: "n-q3-a", label: "97%", nextNodeId: "n-q4", isLoadBearing: false, trainingFeedback: "97% of the Earth's water is seawater, which is not suitable for drinking without treatment.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q3-b", label: "0.5%", nextNodeId: "n-q4", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Only 0.5% of all water on Earth is fresh and drinkable — making it a scarce and precious resource.", feedbackTone: "positive", competencySignal: "The Importance of Water" },
      { id: "n-q3-c", label: "2%", nextNodeId: "n-q4", isLoadBearing: false, trainingFeedback: "The correct figure is 0.5%. Only a tiny fraction of Earth's water is drinkable — highlighting why water hygiene is so critical.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
      { id: "n-q3-d", label: "1%", nextNodeId: "n-q4", isLoadBearing: false, trainingFeedback: "The correct figure is 0.5%. The scarcity of drinkable water is why protecting water quality matters so much.", feedbackTone: "developmental", competencySignal: "The Importance of Water" },
    ],
  },
  {
    id: "n-q4", type: "CHOICE", label: "Q4 — Why sewage causes illness",
    prompt: "Why can sewage cause illness if it contaminates drinking water?",
    responseType: "closed",
    options: [
      { id: "n-q4-a", label: "It seriously discolours the water", nextNodeId: "n-q5", isLoadBearing: false, trainingFeedback: "Discolouration is a visible sign of contamination, but the real health risk comes from the harmful microorganisms that sewage introduces.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q4-b", label: "It gives off a bad smell", nextNodeId: "n-q5", isLoadBearing: false, trainingFeedback: "An unpleasant smell may indicate contamination, but odour alone does not cause illness. The danger lies in the harmful bacteria and viruses sewage contains.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q4-c", label: "It gives water an unpleasant taste", nextNodeId: "n-q5", isLoadBearing: false, trainingFeedback: "Taste changes can be a warning sign, but the health risk comes from the pathogens sewage introduces into the water supply.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q4-d", label: "It contains harmful bacteria and viruses", nextNodeId: "n-q5", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Sewage contains harmful bacteria and viruses that can cause serious illness if they contaminate drinking water.", feedbackTone: "positive", competencySignal: "Water as a Carrier of Disease" },
    ],
  },
  {
    id: "n-q5", type: "CHOICE", label: "Q5 — Cryptosporidium impact",
    prompt: "What could be the impact of Cryptosporidium in the drinking water supply?",
    responseType: "closed",
    options: [
      { id: "n-q5-a", label: "An unpleasant odour", nextNodeId: "n-q6", isLoadBearing: false, trainingFeedback: "Cryptosporidium does not typically cause an odour problem. Its danger is that it causes illness and is resistant to chlorine disinfection.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q5-b", label: "Discolouration of the drinking water", nextNodeId: "n-q6", isLoadBearing: false, trainingFeedback: "Cryptosporidium does not discolour water — it cannot be detected by taste, smell or sight, which makes it particularly dangerous.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q5-c", label: "Illness in the community", nextNodeId: "n-q6", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Cryptosporidium causes severe gastrointestinal illness and is resistant to chlorine, making it one of the most serious waterborne pathogens.", feedbackTone: "positive", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q5-d", label: "A change to the taste of the drinking water", nextNodeId: "n-q6", isLoadBearing: false, trainingFeedback: "Cryptosporidium does not affect taste. It is undetectable by the senses, which is why physical filtration and UV treatment are essential.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
    ],
  },
  {
    id: "n-q6", type: "CHOICE", label: "Q6 — Returning from abroad with diarrhoea",
    prompt: "When returning to work, after travelling abroad, you find that you are experiencing persistent diarrhoea. What must you do?",
    responseType: "closed",
    options: [
      { id: "n-q6-a", label: "Drink plenty of water to avoid becoming dehydrated", nextNodeId: "n-q7", isLoadBearing: false, trainingFeedback: "Staying hydrated is sensible personal advice, but your first duty when experiencing persistent diarrhoea is to report it to your supervisor before working on any water asset.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q6-b", label: "Tell your supervisor immediately and arrange a health screening", nextNodeId: "n-q7", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. You must report persistent diarrhoea to your supervisor immediately and arrange a health screen before returning to restricted operations.", feedbackTone: "positive", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q6-c", label: "Take plenty of vitamins", nextNodeId: "n-q7", isLoadBearing: false, trainingFeedback: "Taking vitamins does not address the public health risk. You must report the illness to your supervisor before working on water assets.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
      { id: "n-q6-d", label: "Carry on working until you feel better", nextNodeId: "n-q7", isLoadBearing: false, trainingFeedback: "Continuing to work on restricted operations while ill with diarrhoea puts the water supply at serious risk. Report to your supervisor immediately.", feedbackTone: "developmental", competencySignal: "Water as a Carrier of Disease" },
    ],
  },
  {
    id: "n-q7", type: "CHOICE", label: "Q7 — Purpose of water quality audits",
    prompt: "Why are water quality audits carried out in the water industry?",
    responseType: "closed",
    options: [
      { id: "n-q7-a", label: "To confirm that procedures and best practice are being followed", nextNodeId: "n-q8", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Audits are carried out to confirm that correct procedures and best practices are being followed throughout the water industry.", feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q7-b", label: "To make sure that the auditors know how to carry out procedures correctly", nextNodeId: "n-q8", isLoadBearing: false, trainingFeedback: "Auditors already have specialist knowledge. The purpose of an audit is to verify that your organisation is following correct procedures.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q7-c", label: "To offer suggestions about new ways of carrying out procedures", nextNodeId: "n-q8", isLoadBearing: false, trainingFeedback: "Audits are primarily a compliance check, not a process improvement exercise. Their purpose is to confirm procedures are being followed.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q7-d", label: "To make sure that operations can be done as quickly and cheaply as possible", nextNodeId: "n-q8", isLoadBearing: false, trainingFeedback: "Speed and cost are not the focus of a water quality audit. The purpose is to confirm that safety procedures and best practices are being adhered to.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
    ],
  },
  {
    id: "n-q8", type: "CHOICE", label: "Q8 — Restricted operation activity",
    prompt: "Under the National Water Hygiene scheme, which of these is classed as a Restricted Operation activity?",
    responseType: "closed",
    options: [
      { id: "n-q8-a", label: "Repairing a pump at a sewage works", nextNodeId: "n-q9", isLoadBearing: false, trainingFeedback: "Sewage works are not potable water assets. Restricted operations relate specifically to work on or near the drinking water supply.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q8-b", label: "Electrical work at a Water Company's head office", nextNodeId: "n-q9", isLoadBearing: false, trainingFeedback: "Office electrical work does not involve contact with water supply assets. Restricted operations are those that could directly affect the drinking water supply.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q8-c", label: "Maintaining equipment at a river intake", nextNodeId: "n-q9", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. River intakes are raw water sources and working there is a restricted operation requiring a valid NWH card.", feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q8-d", label: "Working on a borehole site", nextNodeId: "n-q9", isLoadBearing: false, trainingFeedback: "You're right that boreholes are also restricted operations — this is also a correct answer. The question asks for one example and river intake maintenance is the primary answer given in the assessment.", feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
    ],
  },
  {
    id: "n-q9", type: "CHOICE", label: "Q9 — Reportable illness for restricted operations",
    prompt: "Which of these illnesses would be reportable to your line manager/supervisor if you work on Restricted Operations?",
    responseType: "closed",
    options: [
      { id: "n-q9-a", label: "Hepatitis A or E", nextNodeId: "n-q10", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Hepatitis A and E are among the illnesses that must be reported before working on restricted operations, as they can be spread through contaminated water.", feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q9-b", label: "Measles", nextNodeId: "n-q10", isLoadBearing: false, trainingFeedback: "Measles is not a waterborne disease and is not on the exclusion list for restricted operations. The key illnesses are those associated with gastrointestinal and waterborne transmission.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q9-c", label: "Conjunctivitis", nextNodeId: "n-q10", isLoadBearing: false, trainingFeedback: "Conjunctivitis is not a waterborne illness and is not on the restricted operations exclusion list.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q9-d", label: "Eczema", nextNodeId: "n-q10", isLoadBearing: false, trainingFeedback: "Eczema is a skin condition, not an infectious disease associated with waterborne transmission. It is not on the exclusion list for restricted operations.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
    ],
  },
  {
    id: "n-q10", type: "CHOICE", label: "Q10 — What you need to work on a restricted operation",
    prompt: "What must you have to work on a Restricted Operation?",
    responseType: "closed",
    options: [
      { id: "n-q10-a", label: "A level 3 National Vocational Qualification (NVQ)", nextNodeId: "n-q11", isLoadBearing: false, trainingFeedback: "An NVQ is not a requirement for restricted operations. The specific requirement is a valid National Water Hygiene card issued under the EUSR scheme.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q10-b", label: "Employer's permission to operate", nextNodeId: "n-q11", isLoadBearing: false, trainingFeedback: "Employer permission alone is not sufficient. You must hold a valid National Water Hygiene card to work on restricted operations.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q10-c", label: "A valid National Water Hygiene card", nextNodeId: "n-q11", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. A valid NWH card, issued under the EUSR scheme, is the mandatory requirement for working on restricted operations.", feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q10-d", label: "Successfully completed health questionnaire", nextNodeId: "n-q11", isLoadBearing: false, trainingFeedback: "A health questionnaire may be required in some circumstances, but the mandatory qualification to work on restricted operations is a valid National Water Hygiene card.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
    ],
  },
  {
    id: "n-q11", type: "CHOICE", label: "Q11 — Why birds are a contamination risk at treatment works",
    prompt: "Why can birds be a possible cause of contamination at a water treatment works?",
    responseType: "closed",
    options: [
      { id: "n-q11-a", label: "They can be a major distraction to staff", nextNodeId: "n-q12", isLoadBearing: false, trainingFeedback: "Distraction is not the primary concern. The significant water quality risk from birds comes from their faeces, which can contain harmful bacteria.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q11-b", label: "Bird faeces contains harmful bacteria", nextNodeId: "n-q12", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Bird faeces can contain harmful bacteria including Cryptosporidium, making birds a potential contamination risk at water treatment sites.", feedbackTone: "positive", competencySignal: "Contamination and Consequences" },
      { id: "n-q11-c", label: "Birds may carry disease which can affect productivity", nextNodeId: "n-q12", isLoadBearing: false, trainingFeedback: "The concern is not productivity but water quality. Bird faeces containing harmful bacteria is the direct contamination risk.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
      { id: "n-q11-d", label: "Birds are the cause of a number of allergies", nextNodeId: "n-q12", isLoadBearing: false, trainingFeedback: "Allergies are not the reason birds are a concern at water treatment sites. The risk is contamination of the water supply through bird faeces.", feedbackTone: "developmental", competencySignal: "Contamination and Consequences" },
    ],
  },
  {
    id: "n-q12", type: "CHOICE", label: "Q12 — Where to keep cleaned and disinfected tools",
    prompt: "Cleaned and disinfected tools should be kept:",
    responseType: "closed",
    options: [
      { id: "n-q12-a", label: "Directly on the floor", nextNodeId: "n-q13", isLoadBearing: false, trainingFeedback: "Storing tools directly on the floor risks re-contamination. Tools must be stored off the ground on a non-permeable surface.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q12-b", label: "Off the ground on a piece of cloth", nextNodeId: "n-q13", isLoadBearing: false, trainingFeedback: "Cloth is a permeable material and could harbour bacteria. Tools must be stored on a non-permeable material or sheet.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q12-c", label: "Off the ground on paper towels", nextNodeId: "n-q13", isLoadBearing: false, trainingFeedback: "Paper towels are absorbent and permeable. The correct surface for storing cleaned tools is a non-permeable material.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q12-d", label: "Off the ground on a non-permeable material or sheet", nextNodeId: "n-q13", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Cleaned and disinfected tools must be kept off the ground on a non-permeable material to prevent re-contamination.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q13", type: "CHOICE", label: "Q13 — Diesel spill near water supply installation",
    prompt: "What should you do if you spill diesel whilst working near a water supply installation?",
    responseType: "closed",
    options: [
      { id: "n-q13-a", label: "Clean it up and carry on working", nextNodeId: "n-q14", isLoadBearing: false, trainingFeedback: "Cleaning up alone is not sufficient — diesel can permeate MDPE pipes and contaminate the water supply. You must immediately inform your supervisor or site manager.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q13-b", label: "Neutralize it and dispose of it", nextNodeId: "n-q14", isLoadBearing: false, trainingFeedback: "Attempting to neutralise the spill yourself is not the correct first step. You must immediately report it to your supervisor or site manager.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q13-c", label: "Inform the supervisor/site manager immediately", nextNodeId: "n-q14", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. A diesel spill near water supply infrastructure must be reported to your supervisor or site manager immediately — fuel can permeate MDPE pipes and cause contamination.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q13-d", label: "Phone the Police", nextNodeId: "n-q14", isLoadBearing: false, trainingFeedback: "Contacting the Police is not the correct first response to a diesel spill near water infrastructure. Report to your supervisor or site manager immediately.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q14", type: "CHOICE", label: "Q14 — Result of water supply contamination",
    prompt: "Contamination of the water supply could result in:",
    responseType: "closed",
    options: [
      { id: "n-q14-a", label: "Increased public confidence", nextNodeId: "n-q15", isLoadBearing: false, trainingFeedback: "Contamination causes the opposite — it destroys public confidence in the water supply. The consequences are serious and far-reaching.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q14-b", label: "Better tasting water", nextNodeId: "n-q15", isLoadBearing: false, trainingFeedback: "Contamination does not improve water quality in any way. It can cause taste problems, illness, and regulatory action.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q14-c", label: "Normal service for customers", nextNodeId: "n-q15", isLoadBearing: false, trainingFeedback: "Contamination disrupts normal service significantly — customers may receive boil water notices and supply may be interrupted during investigation and remediation.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q14-d", label: "Customers being told to boil their water before use", nextNodeId: "n-q15", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. A boil water notice is one of the most common and serious consequences of water supply contamination — affecting thousands of customers.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q15", type: "CHOICE", label: "Q15 — Why personal hygiene is important on water supply installations",
    prompt: "Why is personal hygiene so important when working on water supply installations?",
    responseType: "closed",
    options: [
      { id: "n-q15-a", label: "In case your supervisor visits", nextNodeId: "n-q16", isLoadBearing: false, trainingFeedback: "Personal hygiene is not about appearances. The real reason is to prevent you from introducing contaminants into the water supply.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q15-b", label: "To ensure you do not contaminate the environment", nextNodeId: "n-q16", isLoadBearing: false, trainingFeedback: "Environmental protection is important, but on water supply installations the specific concern is preventing contamination of the drinking water supply itself.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q15-c", label: "To stop metal fittings from rusting", nextNodeId: "n-q16", isLoadBearing: false, trainingFeedback: "Personal hygiene has no bearing on metal corrosion. The purpose is to prevent introducing pathogens into the drinking water supply.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q15-d", label: "To ensure you do not contaminate the water supply", nextNodeId: "n-q16", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Personal hygiene on water supply installations is specifically about preventing you from introducing pathogens or contaminants into the drinking water supply.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q16", type: "CHOICE", label: "Q16 — Using the toilet on site",
    prompt: "What should you do if you are working on a site and need to use the toilet?",
    responseType: "closed",
    options: [
      { id: "n-q16-a", label: "Go behind the nearest bush", nextNodeId: "n-q17", isLoadBearing: false, trainingFeedback: "Urinating or defecating outdoors on a restricted operation site creates a direct contamination risk to the water supply. Always use designated welfare facilities.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q16-b", label: "Use a designated welfare facility", nextNodeId: "n-q17", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. You must use a designated welfare facility. Human waste on restricted operation sites is a serious contamination risk.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q16-c", label: "Use an old container", nextNodeId: "n-q17", isLoadBearing: false, trainingFeedback: "Using a container creates a disposal problem and a contamination risk. Always use a proper designated welfare facility.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q16-d", label: "Use the excavation in which you are working", nextNodeId: "n-q17", isLoadBearing: false, trainingFeedback: "Using the excavation is a serious contamination risk to the water supply infrastructure. Always use a designated welfare facility.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q17", type: "CHOICE", label: "Q17 — Clothing for water supply and sewage work",
    prompt: "If you are working on both water supply and sewage, you should have:",
    responseType: "closed",
    options: [
      { id: "n-q17-a", label: "One set of clothing for sewage work and another for drinking water", nextNodeId: "n-q18", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. You must use separate sets of clothing for sewage work and drinking water work to prevent cross-contamination.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q17-b", label: "Just one set of clothing that you use for both", nextNodeId: "n-q18", isLoadBearing: false, trainingFeedback: "Using the same clothing for both types of work creates a direct cross-contamination risk. Separate sets are mandatory.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q17-c", label: "One set of clothing to be used for both sewage and drinking water work, provided you wipe it down", nextNodeId: "n-q18", isLoadBearing: false, trainingFeedback: "Wiping down clothing is not sufficient to remove pathogens. Separate sets of clothing for each type of work are required.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q17-d", label: "Your own clothing", nextNodeId: "n-q18", isLoadBearing: false, trainingFeedback: "Personal clothing is not appropriate for restricted operations. Dedicated protective clothing, in separate sets for water and sewage work, is required.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q18", type: "CHOICE", label: "Q18 — Why pets and livestock are not allowed on restricted operation sites",
    prompt: "Why are pets and livestock NOT allowed on Restricted Operations sites?",
    responseType: "closed",
    options: [
      { id: "n-q18-a", label: "They may distract people", nextNodeId: "n-q19", isLoadBearing: false, trainingFeedback: "Distraction is a minor concern. The primary reason is that animals — including pets — are a significant source of pathogens including Cryptosporidium.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q18-b", label: "They may pose a risk to water quality", nextNodeId: "n-q19", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Pets and livestock can carry pathogens including Cryptosporidium. Their presence on restricted operation sites poses a direct risk to water quality.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q18-c", label: "They may damage equipment", nextNodeId: "n-q19", isLoadBearing: false, trainingFeedback: "Equipment damage is a minor concern. The primary reason animals are excluded is the contamination risk they pose to the water supply.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q18-d", label: "They may be dangerous and injure staff", nextNodeId: "n-q19", isLoadBearing: false, trainingFeedback: "Safety around animals is a general concern, but the specific reason for excluding them from restricted operations is the risk to water quality.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q19", type: "CHOICE", label: "Q19 — Storing small fittings in a van",
    prompt: "How must small fittings be stored in a van?",
    responseType: "closed",
    options: [
      { id: "n-q19-a", label: "Bagged and labelled", nextNodeId: "n-q20", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Small fittings must be stored in sealed, labelled bags to prevent contamination and ensure they are identifiable before use.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q19-b", label: "Off the ground", nextNodeId: "n-q20", isLoadBearing: false, trainingFeedback: "While being off the ground is good practice for larger items, small fittings specifically need to be bagged and labelled to prevent contamination.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q19-c", label: "In a bunded area", nextNodeId: "n-q20", isLoadBearing: false, trainingFeedback: "Bunded areas are for fuel and chemicals, not fittings. Small fittings must be stored in sealed, labelled bags.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q19-d", label: "On a paper towel", nextNodeId: "n-q20", isLoadBearing: false, trainingFeedback: "Paper towels are not an appropriate storage method for fittings. Small fittings must be stored in sealed, labelled bags.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q20", type: "CHOICE", label: "Q20 — Where to store fuel in a van",
    prompt: "Where should you store fuel in your van?",
    responseType: "closed",
    options: [
      { id: "n-q20-a", label: "In the passenger footwell, away from fittings", nextNodeId: "n-q21", isLoadBearing: false, trainingFeedback: "Fuel must never be stored loose in the vehicle interior. It must be stored in a separate bunded area to contain any spills and prevent contamination of fittings.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q20-b", label: "On a secure shelf with your tools", nextNodeId: "n-q21", isLoadBearing: false, trainingFeedback: "Storing fuel with tools creates a contamination risk. Fuel must be stored in a separate bunded area away from water supply fittings and equipment.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q20-c", label: "In a separate bunded area", nextNodeId: "n-q21", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Fuel must be stored in a separate bunded area — this contains any spillage and keeps it away from pipes, fittings and water assets.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q20-d", label: "With your pipes", nextNodeId: "n-q21", isLoadBearing: false, trainingFeedback: "Storing fuel with pipes is dangerous — fuel can permeate MDPE pipes and contaminate the water supply. Fuel must be stored in a separate bunded area.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q21", type: "CHOICE", label: "Q21 — How pipes must be stored",
    prompt: "How must pipes be stored?",
    responseType: "closed",
    options: [
      { id: "n-q21-a", label: "Labelled and stored anywhere safely away from the public", nextNodeId: "n-q22", isLoadBearing: false, trainingFeedback: "Simply being away from the public is not sufficient. Pipes must be stored off the ground, with capped ends, in a secure protected area.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q21-b", label: "On the ground, capped and protected", nextNodeId: "n-q22", isLoadBearing: false, trainingFeedback: "Pipes must never be stored directly on the ground — they must be off the ground, as well as capped and protected.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q21-c", label: "Neat and tidy", nextNodeId: "n-q22", isLoadBearing: false, trainingFeedback: "Being neat and tidy is good practice but does not cover the specific requirements: pipes must be stored in a secure area, off the ground, with capped and protected ends.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q21-d", label: "In a secure area, off the ground, capped and protected", nextNodeId: "n-q22", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Pipes must be stored in a secure area, off the ground, with capped ends and protected from contamination.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q22", type: "CHOICE", label: "Q22 — Where to find the approved products list",
    prompt: "Where can you find a list of Approved Products for the water sector in the UK?",
    responseType: "closed",
    options: [
      { id: "n-q22-a", label: "Drinking Water Quality Regulator (DWQR) website", nextNodeId: "n-q23", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. The approved products list for the water sector is published on the DWQR website, covering products approved under Regulation 31 (England) and Regulation 33 (Scotland).", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q22-b", label: "The Environmental Regulators website", nextNodeId: "n-q23", isLoadBearing: false, trainingFeedback: "Environmental regulators do not maintain the water sector approved products list. It is published by the Drinking Water Quality Regulator (DWQR).", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q22-c", label: "Information Commissioner's Office (ICO) website", nextNodeId: "n-q23", isLoadBearing: false, trainingFeedback: "The ICO deals with data protection, not water quality. The approved products list is on the DWQR website.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q22-d", label: "Health & Safety Executive (HSE) website", nextNodeId: "n-q23", isLoadBearing: false, trainingFeedback: "The HSE covers workplace health and safety broadly, but the water sector approved products list is maintained by the DWQR.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q23", type: "CHOICE", label: "Q23 — Process for making bacteria harmless in water",
    prompt: "The process of treating water to remove or make bacteria harmless is called:",
    responseType: "closed",
    options: [
      { id: "n-q23-a", label: "Abstraction", nextNodeId: "n-q24", isLoadBearing: false, trainingFeedback: "Abstraction is the process of taking water from a source such as a river or borehole. It does not treat or remove bacteria.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q23-b", label: "Disinfection", nextNodeId: "n-q24", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Disinfection is the process of treating water to remove or make bacteria harmless, typically using chlorine or UV treatment.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q23-c", label: "Sampling", nextNodeId: "n-q24", isLoadBearing: false, trainingFeedback: "Sampling tests water quality but does not treat it. Disinfection is the process that removes or neutralises harmful bacteria.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q23-d", label: "Screening", nextNodeId: "n-q24", isLoadBearing: false, trainingFeedback: "Screening removes physical debris from water but does not treat bacteria. The process for removing or neutralising bacteria is disinfection.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q24", type: "CHOICE", label: "Q24 — Disposing of chlorinated water",
    prompt: "Which of the following statements is true regarding the disposal of chlorinated water?",
    responseType: "closed",
    options: [
      { id: "n-q24-a", label: "Chlorinated water can cause pollution to the environment and can kill fish and wildlife", nextNodeId: "n-q25", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Chlorinated water is toxic to aquatic life and must never be discharged to surface drains, watercourses or the environment without appropriate dechlorination.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q24-b", label: "Chlorinated water can be poured down any drain", nextNodeId: "n-q25", isLoadBearing: false, trainingFeedback: "Incorrect. Chlorinated water must not be discharged without appropriate treatment — it can cause environmental pollution and harm to aquatic life.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q24-c", label: "Chlorinated water can be disposed of anywhere", nextNodeId: "n-q25", isLoadBearing: false, trainingFeedback: "Chlorinated water cannot be disposed of anywhere. It is toxic to aquatic life and improper disposal can result in a pollution incident.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q24-d", label: "Chlorinated water can be disposed of in a surface water drain", nextNodeId: "n-q25", isLoadBearing: false, trainingFeedback: "Surface water drains discharge directly to watercourses. Chlorinated water must never be discharged this way as it will kill fish and wildlife.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
    ],
  },
  {
    id: "n-q25", type: "CHOICE", label: "Q25 — Purpose of water quality sampling",
    prompt: "What is the purpose of taking drinking water quality samples?",
    responseType: "closed",
    options: [
      { id: "n-q25-a", label: "To check the water flow", nextNodeId: "n-end", isLoadBearing: false, trainingFeedback: "Flow monitoring is done separately using flow meters. Water quality sampling is specifically about confirming the water is safe to drink.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q25-b", label: "To confirm that water in the supply is safe for consumption", nextNodeId: "n-end", isLoadBearing: true, stateChanges: { score: 1 }, trainingFeedback: "Correct. Water quality sampling confirms that the water in the supply is safe for human consumption. It is a legal requirement taken from treatment works and service reservoirs.", feedbackTone: "positive", competencySignal: "Prevention and Best Practice" },
      { id: "n-q25-c", label: "To check the water pressure", nextNodeId: "n-end", isLoadBearing: false, trainingFeedback: "Pressure is monitored using pressure sensors and gauges. Water quality sampling is about confirming the water is safe for consumption.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
      { id: "n-q25-d", label: "To check for any environmental discharge", nextNodeId: "n-end", isLoadBearing: false, trainingFeedback: "Environmental discharge monitoring is a separate activity. Drinking water quality sampling confirms the water is safe for human consumption.", feedbackTone: "developmental", competencySignal: "Prevention and Best Practice" },
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
    atmosphere: "Professional, formal, compliance-focused. Content is presented via slides then tested via MCQ.",
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
    styleNotes: "Professional, clear, compliance-focused. No narrative embellishment. Present content factually.",
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
      emotionalTarget: "Clear outcome — pass or resit — with specific score.",
    },
  ],
  loadBearingChoices: [],
  convergencePoints: [],
  pacingModel: "competency_build",
  mandatoryNodeIds: [
    "sd-intro", "sd-m1", "sd-m2", "sd-m3", "sd-m4", "sd-quiz-intro",
    "cp-m1", "cp-m2", "cp-m3", "cp-m4",
    "n-q1",  "n-q2",  "n-q3",  "n-q4",  "n-q5",
    "n-q6",  "n-q7",  "n-q8",  "n-q9",  "n-q10",
    "n-q11", "n-q12", "n-q13", "n-q14", "n-q15",
    "n-q16", "n-q17", "n-q18", "n-q19", "n-q20",
    "n-q21", "n-q22", "n-q23", "n-q24", "n-q25",
  ],
}

// ─── SEED ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding NWH slides variant (ID ...0042)…")

  await mkdir(SEED_UPLOADS, { recursive: true })
  for (const img of SLIDE_IMAGES) {
    await copyFile(path.join(MEDIA_SRC, img.src), path.join(SEED_UPLOADS, img.dest))
  }
  console.log(`  ✓ ${SLIDE_IMAGES.length} slide images copied to public/uploads/seed/`)

  await db.user.upsert({
    where: { id: AUTHOR_ID },
    update: {},
    create: { id: AUTHOR_ID, email: "dev@pageengine.local", name: "Dev Author" },
  })

  await db.experience.upsert({
    where: { id: EXPERIENCE_ID },
    create: {
      id: EXPERIENCE_ID,
      title: "National Water Hygiene — Slide-Deck Variant",
      slug: "national-water-hygiene-slides",
      type: "l_and_d",
      renderingTheme: "training",
      authorId: AUTHOR_ID,
      useCasePack: USE_CASE_PACKS["l_and_d"] as object,
      contextPack: contextPack as object,
      nodes: nodes as object[],
      shape: shape as object,
    },
    update: {
      title: "National Water Hygiene — Slide-Deck Variant",
      type: "l_and_d",
      renderingTheme: "training",
      useCasePack: USE_CASE_PACKS["l_and_d"] as object,
      contextPack: contextPack as object,
      nodes: nodes as object[],
      shape: shape as object,
    },
  })

  const deckNodes  = nodes.filter((n) => n.type === "SLIDE_DECK").length
  const choiceNodes = nodes.filter((n) => n.type === "CHOICE").length
  console.log(`  ✓ Experience seeded: ${EXPERIENCE_ID}`)
  console.log(`    Title:   National Water Hygiene — Slide-Deck Variant`)
  console.log(`    Nodes:   ${nodes.length} (${deckNodes} SLIDE_DECK, 4 CHECKPOINT, ${choiceNodes} CHOICE, 1 ENDPOINT)`)
  console.log(`    Slides:  ${nodes.filter((n) => n.type === "SLIDE_DECK").reduce((s, n) => s + (n as any).slides.length, 0)} total across all decks`)
  console.log("")
  console.log("  Run: npx tsx prisma/seed-nwh-slides.ts")
  console.log("  Visit: http://localhost:3000/scenario/" + EXPERIENCE_ID)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
