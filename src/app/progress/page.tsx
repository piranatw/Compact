"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface WeightTrend {
  endDate: string;
  comparison: {
    status: "ok" | "insufficient";
    currentWindow: { from: string; to: string; mean: number | null; count: number };
    previousWindow: { from: string; to: string; mean: number | null; count: number };
    deltaKg: number | null;
  };
  baseline: { weightKg: number | null; note: string | null };
  initialMilestoneKg: number | null;
  milestoneReached: boolean;
  series: Array<{ localDate: string; weightKg: number | null }>;
}

interface ExerciseDef {
  key: string;
  name: string;
}

interface ExerciseHistory {
  exercise: { key: string; name: string; loadBasis: string; repStyle: string };
  equipmentHistories: Array<{
    equipmentKey: string;
    entries: Array<{ localDate: string; setIndex: number; side: string | null; actualWeightKg: number | null; actualReps: number | null; actualSeconds: number | null; rir: number | null }>;
  }>;
}

export default function ProgressPage() {
  const router = useRouter();
  const [trend, setTrend] = useState<WeightTrend | null>(null);
  const [exercises, setExercises] = useState<ExerciseDef[]>([]);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [history, setHistory] = useState<ExerciseHistory | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [trendRes, exRes] = await Promise.all([fetch("/api/progress/weight-trend"), fetch("/api/exercises")]);
    if (trendRes.status === 401) {
      router.replace("/sign-in");
      return;
    }
    setTrend(await trendRes.json());
    const exList = await exRes.json();
    setExercises(exList);
    if (exList.length > 0) setSelectedExercise(exList[0].key);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount; state updates happen after the async await, not synchronously
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedExercise) return;
    fetch(`/api/progress/exercise-history?exerciseKey=${selectedExercise}`)
      .then((r) => r.json())
      .then(setHistory);
  }, [selectedExercise]);

  if (loading || !trend) return <p className="text-neutral-400">Loading...</p>;

  const maxWeight = Math.max(1, ...trend.series.map((s) => s.weightKg ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Progress</h1>

      <div className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <p className="font-medium">Weight trend</p>
        <p className="text-xs text-neutral-500">{trend.baseline.note}</p>

        {trend.comparison.status === "insufficient" ? (
          <p className="text-sm text-neutral-400">Not enough measurements yet (need at least 3 days logged in each 7-day window).</p>
        ) : (
          <p className="text-sm text-neutral-300">
            7-day mean: {trend.comparison.currentWindow.mean?.toFixed(1)} kg (n={trend.comparison.currentWindow.count}) vs prior week{" "}
            {trend.comparison.previousWindow.mean?.toFixed(1)} kg ({trend.comparison.deltaKg! > 0 ? "+" : ""}
            {trend.comparison.deltaKg} kg)
          </p>
        )}

        {trend.initialMilestoneKg != null && (
          <p className="text-sm text-neutral-400">
            Editable milestone: {trend.initialMilestoneKg} kg{trend.milestoneReached ? " — reached in the recorded trend. Review time." : ""}
          </p>
        )}

        {trend.series.length === 0 ? (
          <p className="text-sm text-neutral-500">No weight entries yet.</p>
        ) : (
          <>
            <div className="flex items-end gap-1 h-24" role="img" aria-label="Weight over time chart">
              {trend.series.map((s) => (
                <div
                  key={s.localDate}
                  title={`${s.localDate}: ${s.weightKg} kg`}
                  className="flex-1 bg-emerald-600 rounded-t"
                  style={{ height: `${((s.weightKg ?? 0) / maxWeight) * 100}%` }}
                />
              ))}
            </div>
            <details>
              <summary className="text-xs text-neutral-500 cursor-pointer">View as table</summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs text-neutral-400">
                  <thead>
                    <tr className="text-left">
                      <th>Date</th>
                      <th>Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.series.map((s) => (
                      <tr key={s.localDate}>
                        <td>{s.localDate}</td>
                        <td>{s.weightKg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>

      <div className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <p className="font-medium">Strength history</p>
        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
        >
          {exercises.map((e) => (
            <option key={e.key} value={e.key}>
              {e.name}
            </option>
          ))}
        </select>

        {history && history.equipmentHistories.length === 0 && (
          <p className="text-sm text-neutral-500">No completed sets logged yet for this exercise.</p>
        )}

        {history?.equipmentHistories.map((eq) => (
          <div key={eq.equipmentKey} className="flex flex-col gap-1">
            <p className="text-sm text-neutral-300">{eq.equipmentKey}</p>
            <div className="overflow-x-auto">
            <table className="w-full text-xs text-neutral-400">
              <thead>
                <tr className="text-left">
                  <th>Date</th>
                  <th>Set</th>
                  <th>Load</th>
                  <th>Reps/Sec</th>
                  <th>RIR</th>
                </tr>
              </thead>
              <tbody>
                {eq.entries.map((entry, i) => (
                  <tr key={i}>
                    <td>{entry.localDate}</td>
                    <td>
                      {entry.setIndex}
                      {entry.side ? ` (${entry.side})` : ""}
                    </td>
                    <td>{entry.actualWeightKg ?? "-"}</td>
                    <td>{entry.actualSeconds ?? entry.actualReps ?? "-"}</td>
                    <td>{entry.rir ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
