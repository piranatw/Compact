"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface RemainingItem {
  key: string;
  label: string;
  done: boolean;
}
interface TodayData {
  localDate: string;
  started: boolean;
  daysUntilStart?: number;
  programStartDate?: string | null;
  weekNumber?: number;
  dayNumber?: number;
  dayLabel?: string | null;
  dayType?: string | null;
  occurrence?: {
    id: string;
    status: string;
    plannedCardioMinutesLow: number | null;
    plannedCardioMinutesHigh: number | null;
    cardioMandatory: boolean;
    exerciseCount: number;
    session: { id: string; status: string } | null;
    cardioLog: { mode: string; actualMinutes: number | null } | null;
  } | null;
  dailyLog?: { calories: number | null; proteinG: number | null; weightKg: number | null; waistCm: number | null } | null;
  latestWeight?: { weightKg: number; localDate: string } | null;
  baseline?: { weightKg: number | null; note: string | null };
  calorieTargetKcal?: number | null;
  proteinTargetG?: number | null;
  remaining?: { required: RemainingItem[]; optional: RemainingItem[]; optionalMeasurements: RemainingItem[] };
}

export default function TodayPage() {
  const router = useRouter();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [weight, setWeight] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  const [cardioMinutes, setCardioMinutes] = useState("");
  const [savingCardio, setSavingCardio] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/today");
    if (res.status === 401) {
      router.replace("/sign-in");
      return;
    }
    const json = await res.json();
    setData(json);
    setCalories(json.dailyLog?.calories?.toString() ?? "");
    setProtein(json.dailyLog?.proteinG?.toString() ?? "");
    setWeight(json.dailyLog?.weightKg?.toString() ?? "");
    setCardioMinutes(json.occurrence?.cardioLog?.actualMinutes?.toString() ?? "");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount; state updates happen after the async await, not synchronously
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && data && !data.started && !data.programStartDate) {
      router.replace("/setup");
    }
  }, [loading, data, router]);

  async function startOrResume() {
    if (!data?.occurrence) return;
    setStarting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceId: data.occurrence.id }),
      });
      const session = await res.json();
      router.push(`/workout/${session.id}`);
    } finally {
      setStarting(false);
    }
  }

  async function saveDailyLog() {
    setSavingLog(true);
    try {
      await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localDate: data!.localDate,
          calories: calories === "" ? null : Number(calories),
          proteinG: protein === "" ? null : Number(protein),
          weightKg: weight === "" ? null : Number(weight),
        }),
      });
      await load();
    } finally {
      setSavingLog(false);
    }
  }

  async function saveCardio() {
    if (!data?.occurrence) return;
    setSavingCardio(true);
    try {
      await fetch("/api/cardio-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceId: data.occurrence.id,
          localDate: data.localDate,
          mode: "cycling",
          actualMinutes: cardioMinutes === "" ? null : Number(cardioMinutes),
        }),
      });
      await load();
    } finally {
      setSavingCardio(false);
    }
  }

  if (loading || !data) return <p className="text-neutral-400">Loading...</p>;

  if (!data.started) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-neutral-300">Program starts on {data.programStartDate}.</p>
        <p className="text-neutral-500 text-sm">{data.daysUntilStart} day(s) to go.</p>
      </div>
    );
  }

  const sessionStatus = data.occurrence?.session?.status ?? "NOT_STARTED";
  const isStrength = data.dayType === "STRENGTH";
  const isRest = data.dayType === "REST";
  const isOptionalRecovery = data.dayType === "OPTIONAL_RECOVERY";
  const isCardioDay = data.dayType === "CARDIO_RECOVERY";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-neutral-400 text-sm">{data.localDate} · Week {data.weekNumber} · Day {data.dayNumber}</p>
        <h1 className="text-2xl font-semibold">{data.dayLabel}</h1>
      </div>

      {isRest && (
        <div className="rounded-xl bg-neutral-900 p-4">
          <p className="text-neutral-300">Rest day. No workout or cardio is required.</p>
        </div>
      )}

      {isOptionalRecovery && (
        <div className="rounded-xl bg-neutral-900 p-4">
          <p className="text-neutral-300">Optional recovery. Rest, or an easy activity if you want it — nothing is required today.</p>
        </div>
      )}

      {isStrength && (
        <div className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300">{data.occurrence?.exerciseCount} exercises</span>
            <span className="text-xs uppercase tracking-wide text-neutral-500">{sessionStatus.replace("_", " ")}</span>
          </div>
          <button
            onClick={startOrResume}
            disabled={starting || sessionStatus === "COMPLETED" || sessionStatus === "PARTIAL"}
            className="rounded-lg bg-emerald-600 py-3 font-medium disabled:opacity-50 min-h-[44px]"
          >
            {starting ? "Starting..." : sessionStatus === "IN_PROGRESS" ? "Resume workout" : sessionStatus === "NOT_STARTED" ? "Start workout" : "Session finished"}
          </button>
        </div>
      )}

      {(isStrength || isCardioDay) && data.occurrence?.plannedCardioMinutesLow != null && (
        <div className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-2">
          <p className="text-neutral-300">
            Cardio: {data.occurrence.plannedCardioMinutesLow}-{data.occurrence.plannedCardioMinutesHigh} min
            {data.occurrence.cardioMandatory ? "" : " (optional)"}
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder="minutes"
              value={cardioMinutes}
              onChange={(e) => setCardioMinutes(e.target.value)}
              className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
            />
            <button onClick={saveCardio} disabled={savingCardio} className="rounded-lg bg-neutral-700 px-4 py-2">
              {data.occurrence.cardioLog ? "Update" : "Log"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <p className="text-neutral-300 font-medium">Daily check-in</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Calories
            <input
              type="number"
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Protein (g)
            <input
              type="number"
              inputMode="numeric"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Weight (kg)
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-base"
            />
          </label>
        </div>
        {data.calorieTargetKcal != null && (
          <p className="text-xs text-neutral-500">Editable target: {data.calorieTargetKcal} kcal / {data.proteinTargetG} g protein</p>
        )}
        <button onClick={saveDailyLog} disabled={savingLog} className="rounded-lg bg-neutral-700 py-2 font-medium">
          {savingLog ? "Saving..." : "Save check-in"}
        </button>
      </div>

      <div className="rounded-xl bg-neutral-900 p-4">
        <p className="text-neutral-300 font-medium mb-1">Latest weight</p>
        {data.latestWeight ? (
          <p className="text-neutral-400 text-sm">{data.latestWeight.weightKg} kg on {data.latestWeight.localDate}</p>
        ) : (
          <p className="text-neutral-500 text-sm">{data.baseline?.note ?? "No weigh-in recorded yet."}</p>
        )}
      </div>

      {data.remaining && (
        <div className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-2">
          <p className="text-neutral-300 font-medium">Still to do today</p>
          {data.remaining.required.filter((r) => !r.done).length === 0 && data.remaining.optional.every((o) => o.done) ? (
            <p className="text-emerald-400 text-sm">Everything applicable is done.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {[...data.remaining.required, ...data.remaining.optional].map((item) => (
                <li key={item.key} className={`text-sm ${item.done ? "text-neutral-600 line-through" : "text-neutral-300"}`}>
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
