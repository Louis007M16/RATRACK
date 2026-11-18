import { ArrowUpDown, Check, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fmtWeight, fromKg, roundWeight } from "@/lib/units"
import { setLabels } from "@/lib/sets"
import { cn } from "@/lib/utils"
import type { Workout } from "@/types/workout"
import { defaultOverload, suggestNext } from "./overload"
import { EMPTY, useLogStore, type ToggleResult } from "./useLogStore"
import { useTimerStore } from "./useTimerStore"
import TimerCard from "./TimerCard"

type Props = { dateKey: string; workout: Workout; onNotice: (m: string) => void }

export default function ExercisePanel({ dateKey, workout, onNotice }: Props) {
  const sets = useLogStore((s) => s.sessions[dateKey]?.[workout.id]) ?? EMPTY
  const history = useLogStore((s) => s.history[workout.id])
  const o = useLogStore((s) => s.settings[workout.id]) ?? defaultOverload
  const timer = useTimerStore()

  const labels = setLabels(sets.map((s) => ({ type: s.type })))
  const sug = suggestNext(history, o)
  const last = history?.length
    ? `${fmtWeight(Math.max(...history.map((h) => h.weightKg)), workout.unit)} x ${history.map((h) => h.reps).join(", ")}`
    : null

  const handle = (res: ToggleResult) => {
    if (res.error) { onNotice(res.error); return }
    const parts: string[] = []
    if (res.pr) parts.push("New PR")
    if (res.finished) {
      parts.push(res.next ? `Next time: ${fmtWeight(res.next.weightKg, workout.unit)} x ${res.next.reps}` : "Workout done")
    } else if (res.nowDone && useTimerStore.getState().mode === "rest") {
      useTimerStore.getState().startRest()
    }
    if (parts.length) onNotice(parts.join(". "))
  }

  const logNext = () => {
    const next = sets.find((s) => !s.done)
    if (next) handle(useLogStore.getState().toggleDone(dateKey, workout, next.id))
  }

  const allDone = sets.length > 0 && sets.every((s) => s.done)

  return (
    <div className="pb-4">
      {o.on && (sug || last) && (
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          {last ? `Last: ${last}` : "No history yet"}
          {sug && (
            <span className={cn("ml-2", sug.increase && "font-semibold text-gold")}>
              Today: {fmtWeight(sug.weightKg, workout.unit)} x {sug.reps}
            </span>
          )}
        </p>
      )}

      <ul aria-label={`${workout.name} sets`}>
        {sets.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No sets planned.</li>}
        {sets.map((s, i) => (
          <li key={s.id}
            className={cn("grid grid-cols-[2.5rem_1fr_1fr_2.75rem] items-center px-4 py-1.5", i % 2 === 0 && "bg-background")}>
            <span className={cn("text-center text-sm font-bold", s.type !== "normal" && "text-primary")}>{labels[i]}</span>
            <span className="text-center text-sm">
              <b className="font-semibold tabular-nums">{s.weightKg == null ? "—" : roundWeight(fromKg(s.weightKg, workout.unit))}</b>{" "}
              <span className="text-[10px] text-muted-foreground">{workout.unit}</span>
            </span>
            <span className="text-center text-sm">
              <b className="font-semibold tabular-nums">{s.reps ?? "—"}</b>{" "}
              <span className="text-[10px] text-muted-foreground">reps</span>
            </span>
            <button type="button" aria-pressed={s.done}
              aria-label={`Set ${labels[i]} ${s.done ? "done, tap to undo" : "not done, tap to complete"}`}
              onClick={() => handle(useLogStore.getState().toggleDone(dateKey, workout, s.id))}
              className="grid size-11 place-items-center">
              <Check className={cn("size-5 transition-colors duration-200", s.done ? "text-primary" : "text-muted-foreground/40")}
                aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4"><TimerCard /></div>

      <div className="mt-4 flex gap-2 px-4">
        <button type="button" aria-label={timer.running ? "Pause timer" : "Start timer"} onClick={timer.toggle}
          className="grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-background text-primary transition-transform duration-200 ease-ios active:scale-95">
          {timer.running ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
        </button>
        {timer.running && (
          <button type="button" aria-label="Switch timer mode"
            onClick={() => timer.setMode(timer.mode === "rest" ? "stopwatch" : "rest")}
            className="grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground transition-transform duration-200 ease-ios active:scale-95">
            <ArrowUpDown className="size-5" aria-hidden="true" />
          </button>
        )}
        <Button className="h-12 flex-1 text-base font-bold" onClick={logNext} disabled={sets.length === 0 || allDone}>
          Log Set
        </Button>
      </div>
    </div>
  )
}