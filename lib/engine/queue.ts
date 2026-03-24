import PQueue from "p-queue"

const concurrency = parseInt(process.env.GENERATION_CONCURRENCY ?? "5", 10)

/** Module-level singleton queue for all Anthropic generation calls. */
export const generationQueue = new PQueue({ concurrency })
