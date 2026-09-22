"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface LastComparableSet {
  setIndex: number;
  side: string | null;
  equipmentKey: string | null;
  actualWeightKg: number | null;
  actualReps: number | null;
  actualSeconds: number | null;
  rir: number | null;
}
interface ExerciseInfo {
  templateExerciseId: string;
  exerciseDefinitionId: string;
  name: string;
  loadBasis: string;
  repStyle: string;
  cues: string | null;
  equipmentLabel: string | null;
  workingSets: number;
  targetRepsLow: number | null;
  targetRepsHigh: number | null;
  targetSecondsLow: number | null;
  targetSecondsHigh: number | null;
  restSeconds: number;
  loggedSets: Array<{
    clientId: string;
    setIndex: number;
    side: string | null;
    equipmentKey: string | null;
    actualWeightKg: number | null;
    actualReps: number | null;
    actualSeconds: number | null;
    rir: number | null;
    isWarmup: boolean;
    status: string;
    painFlag: boolean;
    note: string | null;
  }>;
  lastComparable: { sessionId: string; finishedAt: string | null; sets: LastComparableSet[] } | null;
  progression: { eligible: boolean; reason: string; suggestedIncrementKg: number | null };
}
interface SessionDetail {
  session: { id: string; status: string; startedAt: string | null; finishedAt: string | null; notes: string | null };
  occurrence: { id: string; currentDate: string; dayLabel: string };
  exercises: ExerciseInfo[];
}

interface SetDraft {
  clientId: string;
  exerciseDefinitionId: string;
  setIndex: number;
  side: string | null;
  equipmentKey: string;
  weight: string;
  reps: string;
  seconds: string;
  rir: string;
  isWarmup: boolean;
  status: "planned" | "completed" | "skipped";
  painFlag: boolean;
  note: string;
  saveState: "idle" | "saving" | "saved" | "offline" | "error";
}

function draftKey(sessionId: string) {
  return `athletic-log:draft:${sessionId}`;
}

export default function WorkoutPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({});
  const [restEndAt, setRestEndAt] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.status === 401) {
      router.replace("/sign-in");
      return;
    }
    const json: SessionDetail = await res.json();
    setDetail(json);

    let localDraft: Record<string, Partial<SetDraft>> = {};
    try {
      const raw = localStorage.getItem(draftKey(sessionId));
      if (raw) localDraft = JSON.parse(raw);
    } catch {
      // ignore corrupt local draft
    }

    const nextDrafts: Record<string, SetDraft> = {};
    for (const ex of json.exercises) {
      for (let i = 1; i <= ex.workingSets; i++) {
        const clientId = `${sessionId}:${ex.exerciseDefinitionId}:${i}`;
        const server = ex.loggedSets.find((s) => s.setIndex === i && !s.isWarmup);
        const local = localDraft[clientId];
        const suggestion = ex.lastComparable?.sets.find((s) => s.setIndex === i);
        nextDrafts[clientId] = {
          clientId,
          exerciseDefinitionId: ex.exerciseDefinitionId,
          setIndex: i,
          side: null,
          equipmentKey: server?.equipmentKey ?? local?.equipmentKey ?? ex.equipmentLabel ?? "",
          weight: server?.actualWeightKg?.toString() ?? local?.weight ?? "",
          reps: server?.actualReps?.toString() ?? local?.reps ?? "",
          seconds: server?.actualSeconds?.toString() ?? local?.seconds ?? "",
          rir: server?.rir?.toString() ?? local?.rir ?? "",
          isWarmup: false,
          status: (server?.status as SetDraft["status"]) ?? local?.status ?? "planned",
          painFlag: server?.painFlag ?? local?.painFlag ?? false,
          note: server?.note ?? local?.note ?? "",
          saveState: server ? "saved" : "idle",
        };
        void suggestion; // shown separately below via ex.lastComparable
      }
    }
    setDrafts(nextDrafts);
  }, [sessionId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount; state updates happen after the async await, not synchronously
    load();
  }, [load]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(sessionId), JSON.stringify(drafts));
    } catch {
      // storage unavailable; drafts remain in memory only
    }
  }, [drafts, sessionId]);

  useEffect(() => {
    if (restEndAt == null || restPaused) return;
    const t = setInterval(() => {
      setRestRemaining(Math.max(0, restEndAt - Date.now()));
    }, 250);
    return () => clearInterval(t);
  }, [restEndAt, restPaused]);

  function updateDraft(clientId: string, patch: Partial<SetDraft>) {
    setDrafts((prev) => ({ ...prev, [clientId]: { ...prev[clientId], ...patch } }));
  }

  async function saveSet(clientId: string, statusOverride?: SetDraft["status"]) {
    const draft = drafts[clientId];
    if (!draft) return;
    const status = statusOverride ?? draft.status;
    updateDraft(clientId, { saveState: "saving", status });
    try {
      const res = await fetch(`/api/sessions/${sessionId}/sets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: draft.clientId,
          exerciseDefinitionId: draft.exerciseDefinitionId,
          setIndex: draft.setIndex,
          side: draft.side,
          equipmentKey: draft.equipmentKey || null,
          actualWeightKg: draft.weight === "" ? null : Number(draft.weight),
          actualReps: draft.reps === "" ? null : Number(draft.reps),
          actualSeconds: draft.seconds === "" ? null : Number(draft.seconds),
          rir: draft.rir === "" ? null : Number(draft.rir),
          isWarmup: draft.isWarmup,
          status,
          painFlag: draft.painFlag,
          note: draft.note || null,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      updateDraft(clientId, { saveState: "saved" });
    } catch {
      updateDraft(clientId, { saveState: navigator.onLine ? "error" : "offline" });
    }
  }

  function markDone(clientId: string, ex: ExerciseInfo) {
    saveSet(clientId, "completed");
    // eslint-disable-next-line react-hooks/purity -- runs only from the onClick handler below, never during render
    setRestEndAt(Date.now() + ex.restSeconds * 1000);
    setRestRemaining(ex.restSeconds * 1000);
    setRestPaused(false);
  }

  function undoDone(clientId: string) {
    saveSet(clientId, "planned");
  }

  async function finishSession() {
    setFinishing(true);
    try {
      await fetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      try {
        localStorage.removeItem(draftKey(sessionId));
      } catch {
        // ignore
      }
      router.push("/");
    } finally {
      setFinishing(false);
    }
  }

  if (!detail) return <p className="text-neutral-400">Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-neutral-400 text-sm">{detail.occurrence.currentDate}</p>
        <h1 className="text-2xl font-semibold">{detail.occurrence.dayLabel}</h1>
      </div>

      {restEndAt != null && restRemaining > 0 && (
        <div className="rounded-xl bg-neutral-900 p-4 flex items-center justify-between sticky top-2 z-10">
          <span className="text-lg font-mono">{Math.ceil(restRemaining / 1000)}s rest</span>
          <button
            onClick={() => {
              if (restPaused) {
                setRestEndAt(Date.now() + restRemaining);
                setRestPaused(false);
              } else {
                setRestPaused(true);
              }
            }}
            className="rounded-lg bg-neutral-700 px-3 py-2 text-sm"
          >
            {restPaused ? "Resume" : "Pause"}
          </button>
        </div>
      )}

      {detail.exercises.map((ex) => (
        <div key={ex.templateExerciseId} className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
          <div>
            <p className="font-medium">{ex.name}</p>
            <p className="text-xs text-neutral-500">
              {ex.workingSets} sets ·{" "}
              {ex.repStyle === "DURATION_SECONDS"
                ? `${ex.targetSecondsLow ?? "?"}-${ex.targetSecondsHigh ?? "?"}s`
                : ex.targetRepsLow != null
                ? `${ex.targetRepsLow}-${ex.targetRepsHigh} reps`
                : "comfortable clean reps, ~2 RIR"}{" "}
              · {ex.loadBasis.replace(/_/g, " ").toLowerCase()}
            </p>
            {ex.cues && <p className="text-xs text-neutral-600 mt-1">{ex.cues}</p>}
            {ex.progression.eligible && (
              <p className="text-xs text-emerald-400 mt-1">
                Consider the next available increment (+{ex.progression.suggestedIncrementKg} kg). {ex.progression.reason}
              </p>
            )}
          </div>

          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Equipment / machine label
            <input
              value={drafts[`${sessionId}:${ex.exerciseDefinitionId}:1`]?.equipmentKey ?? ""}
              onChange={(e) => {
                for (let i = 1; i <= ex.workingSets; i++) {
                  updateDraft(`${sessionId}:${ex.exerciseDefinitionId}:${i}`, { equipmentKey: e.target.value });
                }
              }}
              placeholder="e.g. Gym machine A"
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-sm"
            />
          </label>

          {Array.from({ length: ex.workingSets }, (_, idx) => idx + 1).map((setIndex) => {
            const clientId = `${sessionId}:${ex.exerciseDefinitionId}:${setIndex}`;
            const draft = drafts[clientId];
            if (!draft) return null;
            const suggestion = ex.lastComparable?.sets.find((s) => s.setIndex === setIndex);
            const isTimed = ex.repStyle === "DURATION_SECONDS";
            const isPerSide = ex.repStyle === "REPS_PER_SIDE";
            return (
              <div key={clientId} className="border border-neutral-800 rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">
                    Set {setIndex}
                    {isPerSide ? " (per side)" : ""}
                  </span>
                  {suggestion && (
                    <span className="text-xs text-neutral-500">
                      Last: {suggestion.actualWeightKg ?? "-"}kg × {suggestion.actualSeconds ?? suggestion.actualReps ?? "-"}
                      {suggestion.rir != null ? ` @ ${suggestion.rir} RIR` : ""}
                      {suggestion.equipmentKey && suggestion.equipmentKey !== draft.equipmentKey ? " (different equipment)" : ""}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ex.loadBasis !== "BODYWEIGHT" && (
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="weight kg"
                      value={draft.weight}
                      onChange={(e) => updateDraft(clientId, { weight: e.target.value })}
                      className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-base"
                    />
                  )}
                  {isTimed ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="seconds"
                      value={draft.seconds}
                      onChange={(e) => updateDraft(clientId, { seconds: e.target.value })}
                      className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-base"
                    />
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={isPerSide ? "reps per side" : "reps"}
                      value={draft.reps}
                      onChange={(e) => updateDraft(clientId, { reps: e.target.value })}
                      className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-base"
                    />
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="RIR (optional)"
                    value={draft.rir}
                    onChange={(e) => updateDraft(clientId, { rir: e.target.value })}
                    className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-sm"
                  />
                  <label className="flex items-center gap-1 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={draft.painFlag}
                      onChange={(e) => updateDraft(clientId, { painFlag: e.target.checked })}
                    />
                    Pain
                  </label>
                </div>
                <div className="flex gap-2">
                  {draft.status === "completed" ? (
                    <button onClick={() => undoDone(clientId)} className="flex-1 rounded-lg bg-neutral-700 py-2 text-sm">
                      Undo
                    </button>
                  ) : (
                    <button onClick={() => markDone(clientId, ex)} className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium">
                      Mark set done
                    </button>
                  )}
                  <span className="text-xs text-neutral-500 self-center w-16 text-right">
                    {draft.saveState === "saving" && "Saving..."}
                    {draft.saveState === "saved" && "Saved"}
                    {draft.saveState === "offline" && "Offline"}
                    {draft.saveState === "error" && "Pending sync"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <button
        onClick={finishSession}
        disabled={finishing}
        className="rounded-lg bg-emerald-700 py-3 font-medium disabled:opacity-50 min-h-[44px]"
      >
        {finishing ? "Finishing..." : "Finish session"}
      </button>
    </div>
  );
}
