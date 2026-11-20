import type { SetType } from "@/lib/sets"

export type LogSet = { id: string; type: SetType; weightKg: number | null; reps: number | null; done: boolean }