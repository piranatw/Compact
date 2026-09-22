"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Owner {
  timezone: string;
  heightCm: number | null;
  baselineWeightKg: number | null;
  baselineWeightNote: string | null;
  goalText: string | null;
  initialMilestoneKg: number | null;
  planningHorizonWeeks: number | null;
  calorieTargetKcal: number | null;
  proteinTargetG: number | null;
  weightChangeRefLow: number | null;
  weightChangeRefHigh: number | null;
  notificationPrivacy: "detailed" | "generic";
  priorLoadReferenceNotes: string | null;
  programStartDate: string | null;
}
interface ExerciseDef {
  id: string;
  key: string;
  name: string;
  equipmentLabel: string | null;
  defaultIncrementKg: number | null;
}
interface ReminderRule {
  id: string;
  type: string;
  localTime: string;
  enabled: boolean;
  privacy: string;
}
interface PushSub {
  id: string;
  endpointTail: string;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function SettingsPage() {
  const router = useRouter();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [exercises, setExercises] = useState<ExerciseDef[]>([]);
  const [reminders, setReminders] = useState<ReminderRule[]>([]);
  const [pushSubs, setPushSubs] = useState<PushSub[]>([]);
  const [pushStatus, setPushStatus] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return "Push is not supported in this browser context.";
    }
    return Notification.permission === "granted" ? "Permission granted." : "Permission not yet granted.";
  });
  const [savingOwner, setSavingOwner] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    const [ownerRes, exRes, remRes, subRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/exercises"),
      fetch("/api/reminders"),
      fetch("/api/push/subscribe"),
    ]);
    if (ownerRes.status === 401) {
      router.replace("/sign-in");
      return;
    }
    setOwner(await ownerRes.json());
    setExercises(await exRes.json());
    setReminders(await remRes.json());
    setPushSubs(await subRes.json());
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount; state updates happen after the async await, not synchronously
    load();
  }, [load]);

  async function saveOwner(patch: Partial<Owner>) {
    setSavingOwner(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setOwner(await res.json());
    } finally {
      setSavingOwner(false);
    }
  }

  async function saveExercise(key: string, patch: Partial<ExerciseDef>) {
    const res = await fetch(`/api/exercises/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const updated = await res.json();
    setExercises((prev) => prev.map((e) => (e.key === key ? updated : e)));
  }

  async function saveReminder(id: string, patch: Partial<ReminderRule>) {
    const res = await fetch("/api/reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const updated = await res.json();
    setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function enablePush() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("Permission denied. Enable notifications for this site in your browser/OS settings to retry.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setPushStatus("Server is missing a VAPID public key.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setPushStatus("Push notifications enabled on this device.");
      const subRes = await fetch("/api/push/subscribe");
      setPushSubs(await subRes.json());
    } catch (err) {
      setPushStatus(`Could not enable push: ${(err as Error).message}`);
    }
  }

  async function sendTestPush() {
    const res = await fetch("/api/push/test", { method: "POST" });
    const body = await res.json();
    setPushStatus(res.ok ? "Test notification sent." : body.error);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/sign-in");
  }

  async function doReset() {
    setResetting(true);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationPhrase: resetPhrase }),
      });
      if (res.ok) {
        router.replace("/setup");
      } else {
        const body = await res.json();
        alert(body.error);
      }
    } finally {
      setResetting(false);
    }
  }

  if (!owner) return <p className="text-neutral-400">Loading...</p>;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <p className="font-medium">Editable starting settings</p>
        <p className="text-xs text-neutral-500">
          These are editable planning defaults, not measured requirements. Changing them here never rewrites historical logs.
        </p>
        <NumberField label="Initial weight milestone (kg)" value={owner.initialMilestoneKg} onSave={(v) => saveOwner({ initialMilestoneKg: v })} />
        <NumberField label="Review period (weeks)" value={owner.planningHorizonWeeks} onSave={(v) => saveOwner({ planningHorizonWeeks: v })} />
        <NumberField label="Daily calorie target (kcal)" value={owner.calorieTargetKcal} onSave={(v) => saveOwner({ calorieTargetKcal: v })} />
        <NumberField label="Daily protein target (g)" value={owner.proteinTargetG} onSave={(v) => saveOwner({ proteinTargetG: v })} />
        <div className="flex gap-2">
          <NumberField label="Weight change ref low (kg/wk)" value={owner.weightChangeRefLow} onSave={(v) => saveOwner({ weightChangeRefLow: v })} />
          <NumberField label="high" value={owner.weightChangeRefHigh} onSave={(v) => saveOwner({ weightChangeRefHigh: v })} />
        </div>
        {savingOwner && <p className="text-xs text-neutral-500">Saving...</p>}
      </section>

      <section className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <p className="font-medium">Reported profile</p>
        <p className="text-xs text-neutral-500">Height and baseline weight are your previously reported information, editable if you want to correct them.</p>
        <NumberField label="Height (cm)" value={owner.heightCm} onSave={(v) => saveOwner({ heightCm: v })} />
        <NumberField label="Baseline weight reference (kg)" value={owner.baselineWeightKg} onSave={(v) => saveOwner({ baselineWeightKg: v })} />
        <p className="text-xs text-neutral-600">{owner.baselineWeightNote}</p>
        <p className="text-xs text-neutral-600">{owner.priorLoadReferenceNotes}</p>
        <p className="text-xs text-neutral-600">Program start date: {owner.programStartDate ?? "not set"}</p>
        <p className="text-xs text-neutral-600">Timezone: {owner.timezone}</p>
      </section>

      <section className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <p className="font-medium">Equipment / load settings</p>
        <p className="text-xs text-neutral-500">
          Machine identity and load increments are editable per exercise. No increment recommendation is made until you set one.
        </p>
        {exercises.map((ex) => (
          <div key={ex.key} className="flex flex-col gap-1 border-b border-neutral-800 pb-2 last:border-0">
            <p className="text-sm text-neutral-300">{ex.name}</p>
            <div className="flex gap-2">
              <input
                defaultValue={ex.equipmentLabel ?? ""}
                placeholder="equipment label"
                onBlur={(e) => saveExercise(ex.key, { equipmentLabel: e.target.value || null })}
                className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-sm"
              />
              <input
                type="number"
                defaultValue={ex.defaultIncrementKg ?? ""}
                placeholder="increment kg"
                onBlur={(e) => saveExercise(ex.key, { defaultIncrementKg: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-28 rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-sm"
              />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <p className="font-medium">Reminders</p>
        <p className="text-xs text-neutral-500">{pushStatus}</p>
        <div className="flex gap-2">
          <button onClick={enablePush} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm flex-1">Enable notifications</button>
          <button onClick={sendTestPush} className="rounded-lg bg-neutral-700 px-3 py-2 text-sm">Send test</button>
        </div>
        <p className="text-xs text-neutral-600">{pushSubs.length} active device(s) subscribed.</p>
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <label className="flex items-center gap-2 flex-1">
              <input type="checkbox" checked={r.enabled} onChange={(e) => saveReminder(r.id, { enabled: e.target.checked })} />
              <span className="text-sm capitalize">{r.type.replace(/_/g, " ")}</span>
            </label>
            <input
              type="time"
              defaultValue={r.localTime}
              onBlur={(e) => saveReminder(r.id, { localTime: e.target.value })}
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-1 text-sm"
            />
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={owner.notificationPrivacy === "generic"}
            onChange={(e) => saveOwner({ notificationPrivacy: e.target.checked ? "generic" : "detailed" })}
          />
          Private/generic notification text (no plan or task names on the lock screen)
        </label>
      </section>

      <section className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <p className="font-medium">Data export</p>
        <div className="flex flex-col gap-2">
          <a href="/api/export/json" className="rounded-lg bg-neutral-700 px-3 py-2 text-sm text-center">Full JSON export</a>
          <a href="/api/export/csv?type=daily_logs" className="rounded-lg bg-neutral-700 px-3 py-2 text-sm text-center">Daily logs CSV</a>
          <a href="/api/export/csv?type=cardio_logs" className="rounded-lg bg-neutral-700 px-3 py-2 text-sm text-center">Cardio logs CSV</a>
          <a href="/api/export/csv?type=exercise_sets" className="rounded-lg bg-neutral-700 px-3 py-2 text-sm text-center">Exercise sets CSV</a>
        </div>
      </section>

      <section className="rounded-xl bg-neutral-900 p-4 flex flex-col gap-3">
        <button onClick={signOut} className="rounded-lg bg-neutral-700 py-2 text-sm">Sign out</button>
      </section>

      <section className="rounded-xl bg-red-950 border border-red-800 p-4 flex flex-col gap-3">
        <p className="font-medium text-red-300">Reset / delete data</p>
        <p className="text-xs text-red-400">
          Removes all logs, sessions, occurrences, push subscriptions, and disables reminders. Your account stays; you will redo first-run setup.
          Type DELETE MY DATA to confirm.
        </p>
        <input
          value={resetPhrase}
          onChange={(e) => setResetPhrase(e.target.value)}
          className="rounded-lg bg-neutral-900 border border-red-800 px-3 py-2 text-sm"
        />
        <button onClick={doReset} disabled={resetting || resetPhrase !== "DELETE MY DATA"} className="rounded-lg bg-red-700 py-2 text-sm disabled:opacity-40">
          {resetting ? "Resetting..." : "Confirm reset"}
        </button>
      </section>
    </div>
  );
}

function NumberField({ label, value, onSave }: { label: string; value: number | null; onSave: (v: number | null) => void }) {
  // Uncontrolled + keyed on `value`: remounts (resetting to the latest saved
  // value) whenever the prop changes from outside, without a state-syncing effect.
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500 flex-1">
      {label}
      <input
        key={value ?? "empty"}
        type="number"
        defaultValue={value?.toString() ?? ""}
        onBlur={(e) => onSave(e.target.value === "" ? null : Number(e.target.value))}
        className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-2 text-base text-neutral-100"
      />
    </label>
  );
}
