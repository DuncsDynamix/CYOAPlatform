import { PrismaClient } from "@prisma/client"
import type {
  Node,
  Segment,
  ExperienceContextPack,
  ShapeDefinition,
} from "../types/experience"
import { USE_CASE_PACKS } from "../lib/engine/usecases"

const db = new PrismaClient()

// ─── SEED USER ────────────────────────────────────────────────

const AUTHOR_ID = "00000000-0000-0000-0000-000000000001"

// ─── SIX TINY SHELF BOOKS ──────────────────────────────────────
//
// Each story is the same small graph shape, all-FIXED so it plays
// without any generation calls:
//
//   n1 (FIXED intro) → n2 (CHOICE, 2 closed options)
//     → opt A → n3a (FIXED ending) → ep1 (ENDPOINT)
//     → opt B → n3b (FIXED ending) → ep2 (ENDPOINT)

interface StorySpec {
  idSuffix: string
  title: string
  slug: string
  genre: string
  description: string
  publishedAt: Date
  world: { description: string; rules: string; atmosphere: string }
  protagonist: { role: string; knowledge: string; goal: string }
  intro: string
  choicePrompt: string
  optionALabel: string
  optionBLabel: string
  endingA: { label: string; content: string; endpointLabel: string; closingLine: string; summary: string }
  endingB: { label: string; content: string; endpointLabel: string; closingLine: string; summary: string }
}

const STORIES: StorySpec[] = [
  {
    idSuffix: "50",
    title: "The Hollow Crown",
    slug: "the-hollow-crown",
    genre: "fantasy",
    description:
      "A dead king's crown turns up in a burial mound, and someone has to decide whether to wear it.",
    publishedAt: new Date("2026-06-25T09:00:00Z"),
    world: {
      description:
        "A fractured kingdom two generations past its civil war. The old capital is a ruin no faction will claim, ringed by barrows nobody has opened in three hundred years.",
      rules:
        "Low fantasy. Magic is old and mostly asleep, but objects carry weight from what was done with them. Nothing is confirmed supernatural until it acts.",
      atmosphere: "Mythic, quiet, elegiac. The tone of an old ballad rather than a battle scene.",
    },
    protagonist: {
      role: "A hedge-scholar hired to catalogue whatever the dig crew pulls out of the barrow.",
      knowledge: "Knows the local histories of the three claimant houses, but nothing about this particular barrow.",
      goal: "Finish the catalogue and get paid, until the dig turns up something that isn't on any inventory form.",
    },
    intro:
      "The dig foreman sends for you before dawn, before the rest of the crew is awake to see. Three weeks cutting into the barrow, and they have finally reached the chamber at its heart. Inside, wrapped in linen that should have rotted to nothing, sits a crown.\n\nIt should not still shine. Old gold does not usually forgive its grave like this.\n\nThe foreman wants your opinion, scholar to scholar: is it safe to move? You crouch at the edge of the pit and understand, before your fingers even reach the metal, that safety was never the real question. The crown is waiting on you to decide something.",
    choicePrompt: "What do you do with the crown?",
    optionALabel: "Lift it free of the barrow",
    optionBLabel: "Seal the chamber and report the dig a loss",
    endingA: {
      label: "The crown chooses",
      content:
        "You lift the crown clear, and it settles onto your hands as though it has been waiting for exactly this grip. Word travels faster than any of you intended. Within a season, three claimants to the old throne are dead by each other's hand, and the crown has passed, quietly, into yours. You did not ask to be a king. It turns out the crown never asked either.",
      endpointLabel: "The Hollow Throne",
      closingLine: "You wear it because someone must, and because, by now, it will not come off.",
      summary:
        "Write two sentences: the scholar lifted the crown from the barrow against their better judgement, and inherited a throne they never sought.",
    },
    endingB: {
      label: "Left in the dark",
      content:
        "You tell the foreman the chamber ceiling is unstable, better to brick it up than risk a life for gold no one has claimed in three centuries. He believes you, mostly. The barrow is sealed again, and the crown goes back into its dark. You walk away from the dig with nothing but the memory of how it felt to almost be chosen. Some nights, that is enough to keep you awake.",
      endpointLabel: "What Was Left Buried",
      closingLine: "The crown is still down there. You are the only one who knows it was ever awake.",
      summary:
        "Write two sentences: the scholar chose to reseal the barrow rather than disturb the crown, and now carries the secret of what almost happened alone.",
    },
  },
  {
    idSuffix: "51",
    title: "Starfall Protocol",
    slug: "starfall-protocol",
    genre: "sci-fi",
    description:
      "A maintenance shift turns up a shutdown order the ship's captain was never told about.",
    publishedAt: new Date("2026-06-28T09:00:00Z"),
    world: {
      description:
        "Generation ship Ansel Wren, six generations into a one-way transit, now closing on a system that was flagged for avoidance at launch and nobody remembers why.",
      rules:
        "Hard-edged near-future sci-fi. No aliens confirmed. Tension comes from what the ship's founders knew and chose not to pass down.",
      atmosphere: "Cold corridors, old machinery, the particular dread of institutional secrets outliving their reasons.",
    },
    protagonist: {
      role: "Night-shift maintenance technician, deck twelve.",
      knowledge: "Knows the ship's systems intimately. Knows nothing about Starfall until tonight.",
      goal: "Finish the diagnostic run and go off shift, until the archive throws up a file that was never meant to be opened.",
    },
    intro:
      "You are running a routine diagnostic on the deck twelve archive when a file surfaces that should not exist: STARFALL, timestamped to the ship's launch, access log empty. Inside is a shutdown protocol for the primary reactor, keyed to the exact star system the Ansel Wren is now three days from entering.\n\nSomeone at the very beginning knew something about where this ship was headed, and hid the warning where nobody would find it until it was almost too late to matter. The bridge has not seen this file. You have maybe an hour before your shift ends and someone else picks up the console.",
    choicePrompt: "What do you do with Starfall?",
    optionALabel: "Run the protocol yourself, now",
    optionBLabel: "Take it straight to the captain",
    endingA: {
      label: "Silent running",
      content:
        "You run it yourself. The reactor throttles down to a whisper, external transmissions cut, the ship goes dark and quiet as it slips past the system unseen and unheard. It works, whatever it was for. But there is no undoing an emergency shutdown mid-transit, and when the crew wakes to find the engines cold and your name alone on the log, no one is going to thank you for a threat they never got to see.",
      endpointLabel: "Dead Reckoning",
      closingLine: "The ship is safe. Nobody trusts you enough to ask why.",
      summary:
        "Write two sentences: the technician ran the hidden shutdown protocol alone, keeping the ship safe at the cost of the crew's trust.",
    },
    endingB: {
      label: "The captain's gamble",
      content:
        "You take the file to the captain instead. She reads it twice, then does the one thing Starfall was clearly built to prevent: she orders a hail broadcast toward the system, betting that sixty years of silence was the founders' mistake, not their wisdom. The channel opens. Somewhere out past the hull, something is now listening back, and you will not know until morning whether that was the right call.",
      endpointLabel: "The Open Channel",
      closingLine: "Whatever answers, it answers to all of you now, not just to you.",
      summary:
        "Write two sentences: the technician reported the hidden protocol to the captain, who chose to break the silence instead of obeying it.",
    },
  },
  {
    idSuffix: "52",
    title: "The House on Wren Lane",
    slug: "the-house-on-wren-lane",
    genre: "horror",
    description: "Your great-aunt left you her house, and one door in it that she always kept locked.",
    publishedAt: new Date("2026-07-01T09:00:00Z"),
    world: {
      description:
        "A quiet street of Victorian terraces in a town that has not changed much in fifty years. The house at the end has been in the family since it was built.",
      rules:
        "Restrained domestic horror. Nothing supernatural is confirmed outright, only implied through small wrongness. The house does not explain itself.",
      atmosphere: "Close, still, patient. Dread accumulates through detail, not incident.",
    },
    protagonist: {
      role: "The niece or nephew who inherited the house, clearing it out before selling.",
      knowledge: "Knows the house from childhood visits. Never once saw inside the locked room upstairs.",
      goal: "Empty the house and put it on the market, until the locked door becomes impossible to ignore.",
    },
    intro:
      "The solicitor hands over one key ring and a warning that isn't really a warning: your great-aunt asked, more than once, that the room at the end of the upstairs hall be left as it was. You find the door on your second afternoon in the house, painted over so many times the frame barely opens.\n\nThere is no lock, in the end, just old paint sealing it shut. You stand in the hallway with a screwdriver in your hand and the house very quiet around you, and you realise you have already decided what you are going to do. You are just taking a moment before you do it.",
    choicePrompt: "What do you do with the locked room?",
    optionALabel: "Force the door open",
    optionBLabel: "Call a builder and wall it over instead",
    endingA: {
      label: "What was left facing the wall",
      content:
        "You break the old paint seal and the door swings in on a room that is, by every reasonable measure, empty. Bare boards, a single chair facing the far wall, decades of dust undisturbed. Undisturbed except for one thing: a fresh set of footprints in the dust, leading from the doorway to the chair, and they were not there a second ago. You are quite sure of that. You are less sure of anything else.",
      endpointLabel: "The Chair by the Wall",
      closingLine: "You close the door again. It does not need painting shut a second time. It shuts itself.",
      summary:
        "Write two sentences: the heir forced open the sealed room and found it empty except for footprints that appeared as they watched.",
    },
    endingB: {
      label: "A new door",
      content:
        "You call a builder instead, and by the following week the doorway is bricked over and plastered flush, one more blank wall in a house full of them. You sleep well for a few nights. Then you notice the hallway is one door longer than it used to be, identical to the one you just sealed, sitting at the far end where the wall used to simply end. It is already locked.",
      endpointLabel: "The Wall Remembers",
      closingLine: "You have not called the builder back. You are not sure what you would tell him.",
      summary:
        "Write two sentences: the heir had the sealed room bricked over instead of opened, only for an identical locked door to appear elsewhere in the house.",
    },
  },
  {
    idSuffix: "53",
    title: "The Butler's Second Letter",
    slug: "the-butlers-second-letter",
    genre: "mystery",
    description:
      "A second letter surfaces that contradicts everything the butler swore to, and someone has to act on it.",
    publishedAt: new Date("2026-07-03T09:00:00Z"),
    world: {
      description:
        "Ashcombe Hall, an English country house, three days after the murder of its owner, Sir Edmund Ashcombe. The household staff have already given their statements.",
      rules:
        "Classic fair-play mystery. No supernatural elements. The truth is always findable, but not always the truth anyone wants delivered.",
      atmosphere: "Drawing-room tension, formal language, everyone perfectly polite and no one telling the whole truth.",
    },
    protagonist: {
      role: "An investigator called in by the family solicitor to review the case before it goes to the local inspector.",
      knowledge: "Has read every statement taken so far. The butler's places him firmly in the wine cellar at the time of the killing.",
      goal: "Confirm the official account, until a second letter in the butler's own hand says something else entirely.",
    },
    intro:
      "You find the letter tucked inside the household ledger, in the butler's own careful hand, dated the night of the murder. It is addressed to no one, more confession than correspondence, and it describes him standing on the terrace at the exact hour his sworn statement places him in the wine cellar.\n\nEither the statement is a lie, or the letter is, and only one of those possibilities lets an innocent man keep his position in this house. You fold the letter back into the ledger and consider your two remaining hours before the local inspector arrives to close the case on the account already given.",
    choicePrompt: "What do you do with the letter?",
    optionALabel: "Confront the butler with it directly",
    optionBLabel: "Take it straight to the inspector",
    endingA: {
      label: "A loyalty, not a guilt",
      content:
        "You show him the letter in private, and he does not deny a word of it. He was on the terrace, not the cellar, covering not for himself but for the housekeeper, who has nowhere else to go if suspicion ever lands on her. It is a coverup built from decades of loyalty rather than murder, and it leaves you exactly where you started: certain the official account is false, and no closer to who actually killed Sir Edmund.",
      endpointLabel: "A Confidence Kept",
      closingLine: "You have the truth of one lie now. The larger one is still walking the halls of this house.",
      summary:
        "Write two sentences: the investigator confronted the butler privately and uncovered a loyal cover-up rather than a confession, leaving the real killer still unidentified.",
    },
    endingB: {
      label: "The easy answer",
      content:
        "You hand the letter to the inspector the moment he arrives, and he does exactly what the letter's existence invites him to do: he arrests the butler on the strength of it alone, satisfied to have his contradiction and his culprit in the same document. You try to explain that a lie about the terrace is not the same as a confession to murder. He is not interested in the difference. An innocent man is going to hang for a killing someone else in this house is still free to have committed.",
      endpointLabel: "The Wrong Man",
      closingLine: "The case is closed. You do not believe, for a moment, that it is solved.",
      summary:
        "Write two sentences: the investigator handed the contradictory letter to the inspector, who arrested the butler on it alone, leaving the true killer free.",
    },
  },
  {
    idSuffix: "54",
    title: "A Letter Never Sent",
    slug: "a-letter-never-sent",
    genre: "romance",
    description:
      "Your grandmother's letter to a man she never married turns up forty years too late to send.",
    publishedAt: new Date("2026-07-05T09:00:00Z"),
    world: {
      description:
        "A grandmother's house being cleared out after her funeral, in the present day. The letter is dated 1986, addressed to a man named Thomas, never posted.",
      rules:
        "Grounded contemporary romance, no genre conceits. The story is about what gets said, or left unsaid, between real people over decades.",
      atmosphere: "Tender, wistful, unhurried. Small rooms, old paper, the particular quiet of sorting through someone else's life.",
    },
    protagonist: {
      role: "The grandchild clearing the house, going through a hatbox of old correspondence.",
      knowledge: "Knew her grandmother married someone else entirely. Has never heard the name Thomas before this afternoon.",
      goal: "Finish sorting the house before the estate sale, until one letter changes what the afternoon is actually about.",
    },
    intro:
      "The letter is at the bottom of a hatbox full of gloves and pressed flowers, sealed but never stamped, addressed in your grandmother's young handwriting to a man named Thomas. You did not know this name. You knew the man she married, your grandfather, for forty years of Sunday dinners, and never once heard her mention anyone who came before him.\n\nYou sit on the floor of her bedroom with the letter in your lap, unopened, and understand that whatever choice you make next is really about whether some things are yours to finish for her, now that she cannot finish them herself.",
    choicePrompt: "What do you do with the letter?",
    optionALabel: "Try to find Thomas and deliver it",
    optionBLabel: "Leave it exactly where she left it",
    endingA: {
      label: "Both letters, finally read",
      content:
        "It takes three weeks and one very patient librarian to find him: Thomas, ninety-one now, a widower two towns over. You hand him the letter in his kitchen and watch an old man's hands shake reading forty-year-old words meant only for him. He tells you he wrote back once, to an address that had already changed, and his letter came home to him unopened. Neither of you can undo the forty years between two letters that never found their reader in time, but both letters have been read now, and that turns out to matter more than either of you expected.",
      endpointLabel: "Both Letters Read",
      closingLine: "Nothing is undone. Something, at least, is finished.",
      summary:
        "Write two sentences: the grandchild tracked down the letter's intended recipient decades later, and both of them finally learned what the other had once tried to say.",
    },
    endingB: {
      label: "Hers to keep",
      content:
        "You put the letter back into the hatbox, unopened, and set the box aside for yourself rather than the estate sale. She had forty years in which she could have sent it, and chose, every one of those years, not to. That choice was hers before it was yours, and you decide the kindest thing you can do now is not undo it on her behalf. Some letters are written to be finished in the writing, not the sending.",
      endpointLabel: "What She Chose",
      closingLine: "You never learn who Thomas was. You decide that not knowing was her right, not just yours.",
      summary:
        "Write two sentences: the grandchild chose to leave the unsent letter unopened and untouched, honouring a decision their grandmother made decades before.",
    },
  },
  {
    idSuffix: "55",
    title: "The Meridian Expedition",
    slug: "the-meridian-expedition",
    genre: "adventure",
    description:
      "The survey team's old map ends at a ridge that, on the ground, keeps going.",
    publishedAt: new Date("2026-07-06T09:00:00Z"),
    world: {
      description:
        "A high mountain range on the edge of any accurate map, where a 1911 survey expedition vanished without ever filing its final report.",
      rules:
        "Grounded adventure, no fantasy elements. Danger comes from terrain, weather, and time, not monsters.",
      atmosphere: "Physical, breathless, driven by curiosity as much as duty. Wide skies, thin air, old mysteries.",
    },
    protagonist: {
      role: "Assistant cartographer on a modern survey expedition, sent to relocate a missing 1911 marker.",
      knowledge: "Knows the official maps by heart. Has just found a carved path that isn't on any of them.",
      goal: "Relocate the missing marker and complete the survey on schedule, until the ridge offers a route nobody planned for.",
    },
    intro:
      "You find the marker's approximate coordinates exactly where the 1911 survey logged them, and nothing else: no marker, no cairn, just a blank slope and, cut into the rock further up, a path that predates your expedition by a lot more than a century. It is not on any chart your team is carrying.\n\nThe rest of the party is a half-day behind, and radio contact up here is unreliable at the best of times. You have maybe two hours of daylight to decide whether to follow the carved path off the surveyed route, or hold to the plan and make camp where you are meant to.",
    choicePrompt: "What do you do about the carved path?",
    optionALabel: "Follow the path off the mapped route",
    optionBLabel: "Stick to the route and make camp on schedule",
    endingA: {
      label: "The lost camp",
      content:
        "The path climbs into a hidden fold of the mountain and opens onto a valley no map shows, and there, weathered but unmistakable, is the remains of the 1911 expedition's final camp, and the marker they never got to place. You find enough of their record to piece together what happened to them. Radio contact is out for two days while you document it, and camp spends those two days assuming the worst, but you come down the mountain with the one thing that expedition never managed: proof of where they got to, and why they stopped.",
      endpointLabel: "The Marker Found",
      closingLine: "Your name goes into the record next to theirs. It feels like the least you owe them.",
      summary:
        "Write two sentences: the cartographer followed an unmapped carved path and found the site of the vanished 1911 expedition, at the cost of two anxious days out of contact.",
    },
    endingB: {
      label: "By the book",
      content:
        "You hold to the route, make camp on schedule, and complete the survey exactly as planned, safe and accounted for the whole way down. It is the right call by every rule of expedition conduct. Ten years later you read, in a rival team's published account, a description of a hidden valley and a marker that was never yours to find, because you were the one who chose not to look. Your name is in the footnotes of someone else's discovery.",
      endpointLabel: "The Footnote",
      closingLine: "You made the safe choice. You have thought about the other one ever since.",
      summary:
        "Write two sentences: the cartographer stayed on the surveyed route rather than risk the unmapped path, only to see a rival team make the discovery years later.",
    },
  },
]

function buildNodes(spec: StorySpec): Node[] {
  return [
    {
      id: "n1",
      type: "FIXED",
      label: "Opening",
      content: spec.intro,
      mandatory: true,
      nextNodeId: "n2",
    },
    {
      id: "n2",
      type: "CHOICE",
      label: "The choice",
      responseType: "closed",
      prompt: spec.choicePrompt,
      options: [
        {
          id: "opt-a",
          label: spec.optionALabel,
          nextNodeId: "n3a",
          isLoadBearing: true,
        },
        {
          id: "opt-b",
          label: spec.optionBLabel,
          nextNodeId: "n3b",
          isLoadBearing: true,
        },
      ],
    },
    {
      id: "n3a",
      type: "FIXED",
      label: spec.endingA.label,
      content: spec.endingA.content,
      mandatory: false,
      nextNodeId: "ep1",
    },
    {
      id: "n3b",
      type: "FIXED",
      label: spec.endingB.label,
      content: spec.endingB.content,
      mandatory: false,
      nextNodeId: "ep2",
    },
    {
      id: "ep1",
      type: "ENDPOINT",
      label: `Endpoint: ${spec.endingA.endpointLabel}`,
      endpointId: "ep-a",
      outcomeLabel: spec.endingA.endpointLabel,
      closingLine: spec.endingA.closingLine,
      summaryInstruction: spec.endingA.summary,
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
      label: `Endpoint: ${spec.endingB.endpointLabel}`,
      endpointId: "ep-b",
      outcomeLabel: spec.endingB.endpointLabel,
      closingLine: spec.endingB.closingLine,
      summaryInstruction: spec.endingB.summary,
      outcomeCard: {
        shareable: true,
        showChoiceStats: true,
        showDepthStats: false,
        showReadingTime: true,
      },
    },
  ]
}

function buildContextPack(spec: StorySpec): ExperienceContextPack {
  return {
    world: spec.world,
    actors: [],
    protagonist: {
      perspective: "you",
      role: spec.protagonist.role,
      knowledge: spec.protagonist.knowledge,
      goal: spec.protagonist.goal,
    },
    style: {
      tone: spec.world.atmosphere,
      language: "en-GB",
      register: "literary",
      targetLength: { min: 80, max: 250 },
      styleNotes: "Second person, present or near-present tense. Short, tiny story: no generation, all fixed prose.",
    },
    groundTruth: [],
    scripts: [],
  }
}

function buildShape(): ShapeDefinition {
  return {
    totalDepthMin: 1,
    totalDepthMax: 1,
    endpointCount: 2,
    endpoints: [
      {
        id: "ep-a",
        label: "Ending A",
        minChoicesToReach: 1,
        maxChoicesToReach: 1,
        narrativeWeight: "earned",
        emotionalTarget: "Consequence of the bolder choice",
      },
      {
        id: "ep-b",
        label: "Ending B",
        minChoicesToReach: 1,
        maxChoicesToReach: 1,
        narrativeWeight: "bittersweet",
        emotionalTarget: "Consequence of the cautious choice",
      },
    ],
    loadBearingChoices: [1],
    convergencePoints: [],
    pacingModel: "narrative_arc",
    mandatoryNodeIds: ["n1"],
  }
}

// ─── SEED ─────────────────────────────────────────────────────

async function main() {
  console.log("Seeding library shelf books…")

  const useCasePack = USE_CASE_PACKS.cyoa_story
  if (!useCasePack) throw new Error('USE_CASE_PACK "cyoa_story" not found in lib/engine/usecases')

  // Upsert the dev author
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

  for (const spec of STORIES) {
    const id = `00000000-0000-0000-0000-0000000000${spec.idSuffix}`
    const nodes = buildNodes(spec)
    const segments: Segment[] = [
      {
        id: "seg-main",
        label: spec.title,
        description: "The complete story in a single segment.",
        order: 0,
        nodes: [...nodes],
      },
    ]
    const contextPack = buildContextPack(spec)
    const shape = buildShape()

    await db.experience.upsert({
      where: { id },
      update: {
        title: spec.title,
        slug: spec.slug,
        description: spec.description,
        genre: spec.genre,
        status: "published",
        publishedAt: spec.publishedAt,
        type: "cyoa_story",
        renderingTheme: "retro-book",
        useCasePack: USE_CASE_PACKS.cyoa_story as object,
        contextPack: contextPack as object,
        shape: shape as object,
        nodes: nodes as object[],
        segments: segments as object[],
      },
      create: {
        id,
        authorId: AUTHOR_ID,
        title: spec.title,
        slug: spec.slug,
        description: spec.description,
        genre: spec.genre,
        status: "published",
        publishedAt: spec.publishedAt,
        type: "cyoa_story",
        renderingTheme: "retro-book",
        useCasePack: USE_CASE_PACKS.cyoa_story as object,
        contextPack: contextPack as object,
        shape: shape as object,
        nodes: nodes as object[],
        segments: segments as object[],
      },
    })
    console.log(`  ✓ ${spec.title} seeded (${spec.slug})`)
  }

  console.log("")
  console.log("Done. Six shelf books seeded.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
