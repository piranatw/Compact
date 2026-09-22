"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface DayEntry {
  localDate: string;
  started: boolean;
  weekNumber?: number;
  dayNumber?: number;
  dayLabel?: string | null;
  dayType?: string | null;
  occurrence?: {
    id: string;
    status: string;
    sessionStatus: string | null;
    exercises: Array<{ name: string; workingSets: number; targetRepsLow: number | null; targetRepsHigh: number | null; targetSecondsLow: number | null; targetSecondsHigh: number | null }>;
    plannedCardioMinutesLow: number | null;
    plannedCardioMinutesHigh: number | null;
  } | null;
}

function statusLabel(day: DayEntry, today: string): string {
  if (!day.occurrence) {
    if (day.localDate < today) return "not-yet-due-passed";
    return "upcoming";
  }
  if (day.occurrence.status === "SKIPPED") return "skipped";
  if (day.occurrence.status === "RESCHEDULED") return "rescheduled";
  if (day.occurrence.sessionStatus === "COMPLETED") return "completed";
  if (day.occurrence.sessionStatus === "PARTIAL") return "partial";
  if (day.localDate < today) return "missed";
  if (day.localDate === today) return "today";
  return "scheduled";
}

export default function PlanPage() {
  const router = useRouter();
  const [days, setDays] = useState<DayEntry[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/plan");
    if (res.status === 401) {
      router.replace("/sign-in");
      return;
    }
    const json = await res.json();
    setDays(json.days);
    setToday(json.today);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount; state updates happen after the async await, not synchronously
    load();
  }, [load]);

  async function skip(occurrenceId: string) {
    await fetch(`/api/occurrences/${occurrenceId}/skip`, { method: "POST" });
    await load();
  }

  async function reschedule(occurrenceId: string) {
    if (!rescheduleDate) return;
    const res = await fetch(`/api/occurrences/${occurrenceId}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toDate: rescheduleDate }),
    });
    if (res.ok) {
      setRescheduling(null);
      setRescheduleDate("");
      await load();
    } else {
      const body = await res.json().catch(() => ({ error: "Failed" }));
      alert(body.error ?? "Could not reschedule");
    }
  }

  if (loading) return <p className="text-neutral-400">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Plan</h1>
      {days.map((day) => {
        if (!day.started) {
          return (
            <div key={day.localDate} className="rounded-xl bg-neutral-900 p-3 opacity-60">
              <p className="text-sm text-neutral-500">{day.localDate} · not started</p>
            </div>
          );
        }
        const status = statusLabel(day, today);
        const isOpen = expanded === day.localDate;
        return (
          <div key={day.localDate} className={`rounded-xl p-3 ${day.localDate === today ? "bg-emerald-950 border border-emerald-700" : "bg-neutral-900"}`}>
            <button className="w-full text-left" onClick={() => setExpanded(isOpen ? null : day.localDate)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">{day.localDate} · Week {day.weekNumber} · Day {day.dayNumber}</p>
                  <p className="font-medium">{day.dayLabel}</p>
                </div>
                <span className="text-xs uppercase tracking-wide text-neutral-500">{status}</span>
              </div>
            </button>
            {isOpen && day.occurrence && (
              <div className="mt-3 flex flex-col gap-2">
                {day.occurrence.exercises.length > 0 && (
                  <ul className="text-sm text-neutral-400 flex flex-col gap-1">
                    {day.occurrence.exercises.map((ex, i) => (
                      <li key={i}>
                        {ex.name} — {ex.workingSets}×{ex.targetSecondsLow != null ? `${ex.targetSecondsLow}-${ex.targetSecondsHigh}s` : ex.targetRepsLow != null ? `${ex.targetRepsLow}-${ex.targetRepsHigh}` : "?"}
                      </li>
                    ))}
                  </ul>
                )}
                {day.occurrence.plannedCardioMinutesLow != null && (
                  <p className="text-sm text-neutral-500">
                    Cardio: {day.occurrence.plannedCardioMinutesLow}-{day.occurrence.plannedCardioMinutesHigh} min
                  </p>
                )}
                {status !== "completed" && status !== "partial" && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => skip(day.occurrence!.id)} className="rounded-lg bg-neutral-700 px-3 py-2 text-sm">
                      Skip
                    </button>
                    <button
                      onClick={() => {
                        setRescheduling(day.occurrence!.id);
                        setRescheduleDate(day.localDate);
                      }}
                      className="rounded-lg bg-neutral-700 px-3 py-2 text-sm"
                    >
                      Reschedule
                    </button>
                  </div>
                )}
                {rescheduling === day.occurrence.id && (
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-sm"
                    />
                    <button onClick={() => reschedule(day.occurrence!.id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm">
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
