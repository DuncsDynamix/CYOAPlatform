// TEMPORARY (Task 8 deletes this): the seeds still author v1-shaped context
// packs, which the engine normalises on read. Task 8 rewrites them to v2 and
// types them as ContextPack.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExperienceContextPack = Record<string, any>
