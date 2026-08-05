/**
 * Fisher-Yates with an injectable rng. Used to shuffle choice options per
 * session so the correct answer isn't always option A — the display-order
 * cousin of "same rubric, never the same script". Routing is by option id,
 * so display order is free to vary.
 */
export function shuffleWith<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
