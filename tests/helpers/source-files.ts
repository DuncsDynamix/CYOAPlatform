import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

/** Source-file helpers for tests that read the codebase (guards, sweeps). */
export const REPO = path.resolve(__dirname, "../..")

export function walk(dir: string): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

export const rel = (file: string) => path.relative(REPO, file)
export const read = (file: string) => readFileSync(file, "utf8")
