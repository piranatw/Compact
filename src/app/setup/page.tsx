"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((owner) => {
        if (owner?.timezone) setTimezone(owner.timezone);
        const now = new Intl.DateTimeFormat("en-CA", { timeZone: owner?.timezone ?? "Asia/Bangkok" }).format(new Date());
        setDate(now);
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programStartDate: date }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Could not save" }));
        setError(body.error ?? "Could not save");
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Set up your program</h1>
        <p className="text-neutral-400 text-sm">
          Your profile, goal, targets, and starter routine are already configured from your reported information.
          The only thing left is choosing which local date is Day 1 (Upper A). It does not need to be a Monday.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-300">Day 1 start date ({timezone})</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg bg-neutral-900 border border-neutral-700 px-4 py-3 text-base"
          />
        </label>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 py-3 font-medium disabled:opacity-50 min-h-[44px]"
        >
          {saving ? "Saving..." : "Start program"}
        </button>
      </form>
    </div>
  );
}
