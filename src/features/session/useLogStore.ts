import { create } from "zustand"
import type { SetType } from "@/lib/sets"
import type { Workout } from "@/types/workout"
import { defaultOverload, suggestNext, type Overload, type Perf, type Suggestion } from "./overload"

export type LogSet = { id: string; type: SetType; weightKg: number | null; reps: number | null; done: boolean }
export const EMPTY: LogSet[] = []

export type ToggleResult = 
  | { error: string }
  | { error?: undefined; nowDone: boolean; pr: boolean; finished: boolean; next: Suggestion | null }

type State = {
  sessions: Record<string, Record<string, LogSet[]>> // dateKey -> workoutId -> sets
  history: Record<string, Perf[]> // last finished session per workout
  prs: Record<string, number> // best weight (kg) per workout
  settings: Record<string, Overload>

  setAllDone: (key: string, w: Workout, done: boolean) => ToggleResult
  ensureSets: (key: string, w: Workout) => void
  patchSet: (key: string, workoutId: string, setId: string, p: Partial<LogSet>) => void
  addSet: (key: string, workoutId: string, type: SetType) => void
  removeSet: (key: string, workoutId: string, setId: string) => void
  toggleDone: (key: string, w: Workout, setId: string) => ToggleResult
  applySuggestion: (key: string, w: Workout) => void
  resetDay: (key: string, workoutIds: string[]) => void
  saveSettings: (workoutId: string, o: Overload) => void
  
}

function buildSets(w: Workout, last: Perf[] | undefined, o: Overload): LogSet[] {
  const sug = suggestNext(last, o)
  const planned = w.sets.length
    ? w.sets
    : Array.from({ length: 3 }, () => ({ type: "normal" as const, weightKg: null, reps: null }))
  return planned.map((p) => ({
    id: crypto.randomUUID(),
    type: p.type,
    weightKg: sug && p.type === "normal" ? sug.weightKg : p.weightKg,
    reps: sug && p.type === "normal" ? sug.reps : p.reps,
    done: false,
  }))
}

const write = (s: State, key: string, id: string, sets: LogSet[]) => ({
  sessions: { ...s.sessions, [key]: { ...s.sessions[key], [id]: sets } },
})

export const useLogStore = create<State>()((set, get) => ({
  sessions: {},
  history: {
    "1": [{ weightKg: 25, reps: 8 }, { weightKg: 25, reps: 8 }, { weightKg: 25, reps: 8 }],
    "2": [{ weightKg: 40, reps: 6 }, { weightKg: 40, reps: 6 }, { weightKg: 40, reps: 5 }],
    "3": [{ weightKg: 40, reps: 10 }, { weightKg: 40, reps: 9 }, { weightKg: 40, reps: 8 }],
  },
  prs: { "1": 25, "2": 40, "3": 40 },
  settings: {
    "1": { on: true, minReps: 6, maxReps: 8, stepKg: 2.5 },
    "2": { on: true, minReps: 6, maxReps: 8, stepKg: 2.5 },
    "3": { on: true, minReps: 8, maxReps: 10, stepKg: 2.5 },
  },

  ensureSets: (key: string, w: Workout) => {
    if (get().sessions[key]?.[w.id]) return
    const o = get().settings[w.id] ?? defaultOverload
    set((s: State) => write(s, key, w.id, buildSets(w, s.history[w.id], o)))
  },

  patchSet: (key: string, workoutId: string, setId: string, p: Partial<LogSet>) =>
    set((s: State) => {
      const sets = s.sessions[key]?.[workoutId]
      if (!sets) return s
      return write(s, key, workoutId, sets.map((x) => (x.id === setId ? { ...x, ...p } : x)))
    }),

  addSet: (key: string, workoutId: string, type: SetType) =>
    set((s: State) => {
      const sets = s.sessions[key]?.[workoutId]
      if (!sets) return s
      const ref = [...sets].reverse().find((x) => x.type === "normal") ?? sets[sets.length - 1]
      const row: LogSet = {
        id: crypto.randomUUID(),
        type,
        weightKg: ref?.weightKg ?? null,
        reps: ref?.reps ?? null,
        done: false,
      }
      return write(s, key, workoutId, type === "warmup" ? [row, ...sets] : [...sets, row])
    }),

  removeSet: (key: string, workoutId: string, setId: string) =>
    set((s: State) => {
      const sets = s.sessions[key]?.[workoutId]
      if (!sets) return s
      return write(s, key, workoutId, sets.filter((x) => x.id !== setId))
    }),

  toggleDone: (key: string, w: Workout, setId: string): ToggleResult => {
    const state = get()
    const sets = state.sessions[key]?.[w.id]
    const target = sets?.find((x) => x.id === setId)
    if (!sets || !target) return { error: "Set not found" }

    const nowDone = !target.done
    if (nowDone && (target.weightKg == null || target.reps == null || target.reps < 1)) {
      return { error: "Enter weight and reps first" }
    }

    const o = state.settings[w.id] ?? defaultOverload
    const next = sets.map((x) => (x.id === setId ? { ...x, done: nowDone } : x))

    let pr = false
    const prs = { ...state.prs }
    if (
      nowDone && target.type === "normal" &&
      (target.reps ?? 0) >= o.minReps &&
      (target.weightKg ?? 0) > (prs[w.id] ?? 0)
    ) {
      prs[w.id] = target.weightKg as number
      pr = true
    }

    const finished = nowDone && next.every((x) => x.done)
    let history = state.history
    let suggestion: Suggestion | null = null
    if (finished) {
      const perf: Perf[] = next
        .filter((x) => x.type === "normal" && x.weightKg != null && x.reps != null)
        .map((x) => ({ weightKg: x.weightKg as number, reps: x.reps as number }))
      if (perf.length) {
        history = { ...history, [w.id]: perf }
        suggestion = suggestNext(perf, o)
      }
    }

    set((s: State) => ({ ...write(s, key, w.id, next), prs, history }))
    return { nowDone, pr, finished, next: suggestion }
  },

  setAllDone: (key: string, w: Workout, done: boolean): ToggleResult => {
    const state = get()
    const sets = state.sessions[key]?.[w.id]
    if (!sets || sets.length === 0) return { error: "This workout has no sets" }

    if (!done) {
        set((s: State) => write(s, key, w.id, sets.map((x) => ({ ...x, done: false }))))
        return { nowDone: false, pr: false, finished: false, next: null }
    }
    if (sets.some((x) => x.weightKg == null || x.reps == null || x.reps < 1)) {
        return { error: "Add weight and reps for this workout in the Workouts tab first" }
    }

    const o = state.settings[w.id] ?? defaultOverload
    const next = sets.map((x) => ({ ...x, done: true }))
    const normal = next.filter((x) => x.type === "normal")
    const best = Math.max(0, ...normal.filter((x) => (x.reps ?? 0) >= o.minReps).map((x) => x.weightKg as number))

    const prs = { ...state.prs }
    let pr = false
    if (best > (prs[w.id] ?? 0)) {
        prs[w.id] = best
        pr = true
    }

    const perf: Perf[] = normal.map((x) => ({ weightKg: x.weightKg as number, reps: x.reps as number }))
    const history = perf.length ? { ...state.history, [w.id]: perf } : state.history
    const suggestion = perf.length ? suggestNext(perf, o) : null

    set((s: State) => ({ ...write(s, key, w.id, next), prs, history }))
    return { nowDone: true, pr, finished: true, next: suggestion }
    },

  applySuggestion: (key: string, w: Workout) =>
    set((s: State) => {
      const sets = s.sessions[key]?.[w.id]
      const sug = suggestNext(s.history[w.id], s.settings[w.id] ?? defaultOverload)
      if (!sets || !sug) return s
      return write(
        s, key, w.id,
        sets.map((x) =>
          x.type === "normal" && !x.done ? { ...x, weightKg: sug.weightKg, reps: sug.reps } : x
        )
      )
    }),

  resetDay: (key: string, workoutIds: string[]) =>
    set((s: State) => {
      const day = s.sessions[key]
      if (!day) return s
      const copy = { ...day }
      for (const id of workoutIds) if (copy[id]) copy[id] = copy[id].map((x) => ({ ...x, done: false }))
      return { sessions: { ...s.sessions, [key]: copy } }
    }),

  saveSettings: (workoutId: string, o: Overload) =>
    set((s: State) => ({ settings: { ...s.settings, [workoutId]: o } })),
}))