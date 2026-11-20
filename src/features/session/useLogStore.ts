import { create } from "zustand"
import type { Workout } from "@/types/workout"
import type { LogSet } from "@/types/log"
import { enqueue } from "@/db/queue"
import { insertSets, loadDerived, resetRows, setAllDoneRows, setDoneRow, setWeightRows, type LoadedLog } from "@/db/log"
import { suggestNext, targetReps, type Perf, type Suggestion } from "./overload"

export type { LogSet }
export const EMPTY: LogSet[] = []

export type ToggleResult =
  | { error: string }
  | { error?: undefined; nowDone: boolean; pr: boolean; finished: boolean; next: Suggestion | null }

type Ctx = { splitId: string | null; dayLabel: string }

type State = {
  sessions: Record<string, Record<string, LogSet[]>> // dateKey -> workoutId -> sets
  history: Record<string, Perf[]> // most recent finished session per workout
  prs: Record<string, number> // best weight (kg) per workout

  ensureSets: (key: string, w: Workout, ctx?: Ctx) => void
  toggleDone: (key: string, w: Workout, setId: string) => ToggleResult
  setAllDone: (key: string, w: Workout, done: boolean) => ToggleResult
  applySuggestion: (key: string, w: Workout) => void
  resetDay: (key: string, workoutIds: string[]) => void
}

const persisted = new Set<string>() // "date:workoutId" rows already in the database
const ctxs: Record<string, Ctx> = {}
const pk = (key: string, id: string) => `${key}:${id}`

export function hydrateLog(data: LoadedLog) {
  for (const [date, day] of Object.entries(data.sessions)) for (const id of Object.keys(day)) persisted.add(pk(date, id))
  useLogStore.setState(data)
}

function persistRows(key: string, w: Workout) {
  if (persisted.has(pk(key, w.id))) return
  persisted.add(pk(key, w.id))
  const sets = useLogStore.getState().sessions[key]?.[w.id]
  if (!sets) return
  const ctx = ctxs[key] ?? { splitId: null, dayLabel: "" }
  void enqueue(() => insertSets(key, ctx, { id: w.id, name: w.name }, sets))
}

function refreshDerived(workoutId: string) {
  void enqueue(async () => {
    const d = await loadDerived(workoutId)
    useLogStore.setState((s: State) => {
      const history = { ...s.history }
      const prs = { ...s.prs }
      if (d.history) history[workoutId] = d.history
      else delete history[workoutId]
      if (d.pr != null) prs[workoutId] = d.pr
      else delete prs[workoutId]
      return { history, prs }
    })
  })
}

function buildSets(w: Workout, last: Perf[] | undefined): LogSet[] {
  const sug = suggestNext(last, targetReps(w), w.overload)
  const planned = w.sets.length
    ? w.sets
    : Array.from({ length: 3 }, () => ({ type: "normal" as const, weightKg: null, reps: null }))
  return planned.map((p) => ({
    id: crypto.randomUUID(),
    type: p.type,
    weightKg: sug && p.type === "normal" ? sug.weightKg : p.weightKg,
    reps: p.reps,
    done: false,
  }))
}

const write = (s: State, key: string, id: string, sets: LogSet[]) => ({
  sessions: { ...s.sessions, [key]: { ...s.sessions[key], [id]: sets } },
})

export const useLogStore = create<State>()((set, get) => ({
  sessions: {},
  history: {},
  prs: {},

  ensureSets: (key: string, w: Workout, ctx?: Ctx) => {
    if (ctx) ctxs[key] = ctx
    if (get().sessions[key]?.[w.id]) return
    set((s: State) => write(s, key, w.id, buildSets(w, s.history[w.id])))
  },

  toggleDone: (key: string, w: Workout, setId: string): ToggleResult => {
    const state = get()
    const sets = state.sessions[key]?.[w.id]
    const target = sets?.find((x) => x.id === setId)
    if (!sets || !target) return { error: "Set not found" }

    const nowDone = !target.done
    if (nowDone && (target.weightKg == null || target.reps == null || target.reps < 1)) {
      return { error: "Add weight and reps for this workout in the Workouts tab first" }
    }

    const need = targetReps(w) ?? 1
    const next = sets.map((x) => (x.id === setId ? { ...x, done: nowDone } : x))

    let pr = false
    const prs = { ...state.prs }
    if (nowDone && target.type === "normal" && (target.reps ?? 0) >= need && (target.weightKg ?? 0) > (prs[w.id] ?? 0)) {
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
        suggestion = suggestNext(perf, targetReps(w), w.overload)
      }
    }

    persistRows(key, w) // must run before the change below
    set((s: State) => ({ ...write(s, key, w.id, next), prs, history }))
    void enqueue(() => setDoneRow(setId, nowDone))
    refreshDerived(w.id)
    return { nowDone, pr, finished, next: suggestion }
  },

  setAllDone: (key: string, w: Workout, done: boolean): ToggleResult => {
    const state = get()
    const sets = state.sessions[key]?.[w.id]
    if (!sets || sets.length === 0) return { error: "This workout has no sets" }

    if (!done) {
      persistRows(key, w)
      set((s: State) => write(s, key, w.id, sets.map((x) => ({ ...x, done: false }))))
      void enqueue(() => setAllDoneRows(key, w.id, false))
      refreshDerived(w.id)
      return { nowDone: false, pr: false, finished: false, next: null }
    }
    if (sets.some((x) => x.weightKg == null || x.reps == null || x.reps < 1)) {
      return { error: "Add weight and reps for this workout in the Workouts tab first" }
    }

    const need = targetReps(w) ?? 1
    const next = sets.map((x) => ({ ...x, done: true }))
    const normal = next.filter((x) => x.type === "normal")
    const best = Math.max(0, ...normal.filter((x) => (x.reps ?? 0) >= need).map((x) => x.weightKg as number))

    const prs = { ...state.prs }
    let pr = false
    if (best > (prs[w.id] ?? 0)) {
      prs[w.id] = best
      pr = true
    }

    const perf: Perf[] = normal.map((x) => ({ weightKg: x.weightKg as number, reps: x.reps as number }))
    const history = perf.length ? { ...state.history, [w.id]: perf } : state.history
    const suggestion = perf.length ? suggestNext(perf, targetReps(w), w.overload) : null

    persistRows(key, w)
    set((s: State) => ({ ...write(s, key, w.id, next), prs, history }))
    void enqueue(() => setAllDoneRows(key, w.id, true))
    refreshDerived(w.id)
    return { nowDone: true, pr, finished: true, next: suggestion }
  },

  applySuggestion: (key: string, w: Workout) => {
    const s0 = get()
    const sets = s0.sessions[key]?.[w.id]
    const sug = suggestNext(s0.history[w.id], targetReps(w), w.overload)
    if (!sets || !sug) return
    persistRows(key, w)
    set((s: State) =>
      write(s, key, w.id, sets.map((x) => (x.type === "normal" && !x.done ? { ...x, weightKg: sug.weightKg } : x)))
    )
    void enqueue(() => setWeightRows(key, w.id, sug.weightKg))
  },

  resetDay: (key: string, workoutIds: string[]) => {
    set((s: State) => {
      const day = s.sessions[key]
      if (!day) return s
      const copy = { ...day }
      for (const id of workoutIds) if (copy[id]) copy[id] = copy[id].map((x) => ({ ...x, done: false }))
      return { sessions: { ...s.sessions, [key]: copy } }
    })
    const saved = workoutIds.filter((id) => persisted.has(pk(key, id)))
    if (saved.length) {
      void enqueue(() => resetRows(key, saved))
      saved.forEach(refreshDerived)
    }
  },
}))