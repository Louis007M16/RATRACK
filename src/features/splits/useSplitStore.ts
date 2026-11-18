import { create } from "zustand"
import type { Muscle } from "@/lib/constants"
import { emptyDay, type DayPlan, type Split } from "@/types/split"

const day = (label: string, muscles: Muscle[], workoutIds: string[]): DayPlan => ({
  label, isRest: false, muscles, workoutIds,
})
const rest = (): DayPlan => ({ label: "Rest Day", isRest: true, muscles: [], workoutIds: [] })
const cloneDays = (days: DayPlan[]) =>
  days.map((d) => ({ ...d, muscles: [...d.muscles], workoutIds: [...d.workoutIds] }))

type Draft = { sourceId: string | null; origin: "list" | "detail"; name: string; days: DayPlan[] }
type DayDraft = { dow: number; day: DayPlan }

type State = {
  splits: Split[]
  draft: Draft | null
  dayDraft: DayDraft | null

  startDraft: (id?: string, origin?: "list" | "detail") => void
  saveDraft: () => { ok: true; id: string } | { ok: false; error: string }
  setDraftName: (name: string) => void
  discardDraft: () => void

  setActive: (id: string) => void
  duplicate: (id: string) => void
  remove: (id: string) => void

  startDay: (dow: number) => void
  patchDay: (p: Partial<DayPlan>) => void
  toggleMuscle: (m: Muscle) => void
  addWorkouts: (ids: string[]) => void
  moveWorkout: (index: number, dir: -1 | 1) => void
  removeWorkout: (index: number) => void
  commitDay: () => void
  discardDay: () => void
}

export const useSplitStore = create<State>()((set, get) => ({
  splits: [
    {
      id: "s1", name: "Push Pull Legs", kind: "preset", isActive: true,
      days: [
        day("Push Day", ["Chest", "Shoulder", "Tricep"], ["1", "2", "3", "7", "8"]),
        day("Pull Day", ["Back"], ["4", "5", "6"]),
        day("Leg Day", ["Quads", "Hamstring"], []),
        rest(),
        day("Push Day", ["Chest", "Shoulder", "Tricep"], ["1", "2"]),
        day("Pull Day", ["Back"], ["4"]),
        day("Leg Day", ["Quads", "Hamstring"], []),
      ],
    },
    {
      id: "s2", name: "Push Pull Legs Upper/Lower", kind: "preset", isActive: false,
      days: [
        day("Upper", ["Chest", "Back"], ["1", "4"]),
        day("Lower", ["Quads", "Hamstring"], []),
        rest(),
        day("Upper", ["Chest", "Back"], ["2", "5"]),
        day("Lower", ["Quads", "Hamstring"], []),
        rest(),
        rest(),
      ],
    },
    {
      id: "s3", name: "Bro Split", kind: "custom", isActive: false,
      days: [
        day("Chest Day", ["Chest"], ["1", "2", "3"]),
        day("Back Day", ["Back"], ["4", "5", "6"]),
        day("Arm Day", ["Tricep"], ["7", "8"]),
        rest(), emptyDay(), emptyDay(), emptyDay(),
      ],
    },
  ],
  draft: null,
  dayDraft: null,

  startDraft: (id?: string, origin: "list" | "detail" = "list") => {
    const src = id ? get().splits.find((s) => s.id === id) : undefined
    set({
        draft: src
        ? { sourceId: src.id, origin, name: src.name, days: cloneDays(src.days) }
        : { sourceId: null, origin, name: "", days: Array.from({ length: 7 }, emptyDay) },
        dayDraft: null,
    })
  },
  setDraftName: (name: string) => set((s: State) => (s.draft ? { draft: { ...s.draft, name } } : s)),
  discardDraft: () => set({ draft: null, dayDraft: null }),

  saveDraft: () => {
    const { draft, splits } = get()
    if (!draft) return { ok: false, error: "Nothing to save" }
    const name = draft.name.trim()
    if (!name) return { ok: false, error: "Enter a program name" }
    if (splits.some((s) => s.id !== draft.sourceId && s.name.toLowerCase() === name.toLowerCase()))
        return { ok: false, error: "You already have a split with this name" }

    if (draft.sourceId) {
        set({
        splits: splits.map((s) =>
            s.id === draft.sourceId ? { ...s, name, days: cloneDays(draft.days) } : s
        ),
        draft: null,
        dayDraft: null,
        })
        return { ok: true, id: draft.sourceId }
    }

    const id = crypto.randomUUID()
    set({
        splits: [
        ...splits,
        { id, name, kind: "custom", isActive: splits.length === 0, days: cloneDays(draft.days) },
        ],
        draft: null,
        dayDraft: null,
    })
    return { ok: true, id }
  },

  setActive: (id: String) => set((s) => ({ splits: s.splits.map((x) => ({ ...x, isActive: x.id === id })) })),

  duplicate: (id: String) =>
    set((s) => {
      const src = s.splits.find((x) => x.id === id)
      if (!src) return s
      const taken = new Set(s.splits.map((x) => x.name.toLowerCase()))
      let name = `${src.name} copy`
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${src.name} copy ${n}`
      return {
        splits: [...s.splits, { ...src, id: crypto.randomUUID(), name, kind: "custom", isActive: false, days: cloneDays(src.days) }],
      }
    }),

  remove: (id: String) => set((s) => ({ splits: s.splits.filter((x) => x.id !== id) })),

  startDay: (dow: number) => {
    const d = get().draft?.days[dow]
    if (d) set({ dayDraft: { dow, day: cloneDays([d])[0] } })
  },
  patchDay: (p : Partial<DayPlan>) =>
    set((s) => (s.dayDraft ? { dayDraft: { ...s.dayDraft, day: { ...s.dayDraft.day, ...p } } } : s)),
  toggleMuscle: (m: Muscle) =>
    set((s) => {
      if (!s.dayDraft) return s
      const cur = s.dayDraft.day.muscles
      const muscles = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]
      return { dayDraft: { ...s.dayDraft, day: { ...s.dayDraft.day, muscles } } }
    }),
  addWorkouts: (ids: string[]) =>
    set((s: State) => {
      if (!s.dayDraft) return s
      const have = new Set(s.dayDraft.day.workoutIds)
      const workoutIds = [...s.dayDraft.day.workoutIds, ...ids.filter((i: string) => !have.has(i))]
      return { dayDraft: { ...s.dayDraft, day: { ...s.dayDraft.day, workoutIds } } }
    }),
  moveWorkout: (index: number, dir: -1 | 1) =>
    set((s) => {
      if (!s.dayDraft) return s
      const ids = [...s.dayDraft.day.workoutIds]
      const j = index + dir
      if (j < 0 || j >= ids.length) return s
      ;[ids[index], ids[j]] = [ids[j], ids[index]]
      return { dayDraft: { ...s.dayDraft, day: { ...s.dayDraft.day, workoutIds: ids } } }
    }),
  removeWorkout: (index: number) =>
    set((s) => {
      if (!s.dayDraft) return s
      const ids = s.dayDraft.day.workoutIds.filter((_, i) => i !== index)
      return { dayDraft: { ...s.dayDraft, day: { ...s.dayDraft.day, workoutIds: ids } } }
    }),
  commitDay: () =>
    set((s) => {
      if (!s.draft || !s.dayDraft) return s
      const { dow, day: d } = s.dayDraft
      const days = s.draft.days.map((x, i) =>
        i === dow ? { ...d, label: d.label.trim(), muscles: [...d.muscles], workoutIds: [...d.workoutIds] } : x
      )
      return { draft: { ...s.draft, days }, dayDraft: null }
    }),
  discardDay: () => set({ dayDraft: null }),
}))