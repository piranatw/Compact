import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type ExerciseSeed = {
  key: string;
  name: string;
  loadBasis: string;
  repStyle: string;
  cues?: string;
};

const EXERCISES: ExerciseSeed[] = [
  { key: "chest_press_machine", name: "Chest press machine", loadBasis: "MACHINE_STACK", repStyle: "REPS", cues: "Set seat height so handles align mid-chest. Machine identity and label must be recorded — it defines comparable history." },
  { key: "seated_cable_row", name: "Seated cable row", loadBasis: "MACHINE_STACK", repStyle: "REPS", cues: "Drive elbows back, keep chest tall." },
  { key: "lat_pulldown", name: "Lat pulldown", loadBasis: "MACHINE_STACK", repStyle: "REPS", cues: "Pull to upper chest, avoid leaning back excessively." },
  { key: "dumbbell_shoulder_press", name: "Dumbbell shoulder press", loadBasis: "DUMBBELL_PER_HAND", repStyle: "REPS", cues: "Seated or standing; keep core braced." },
  { key: "dumbbell_biceps_curl", name: "Dumbbell biceps curl", loadBasis: "DUMBBELL_PER_HAND", repStyle: "REPS", cues: "Reps counted per arm; load is per dumbbell." },
  { key: "overhead_dumbbell_triceps_extension", name: "Overhead dumbbell triceps extension", loadBasis: "DUMBBELL_TOTAL", repStyle: "REPS", cues: "One dumbbell held with both hands overhead; load is total dumbbell mass. Replaces triceps pushdown." },
  { key: "goblet_squat", name: "Goblet squat", loadBasis: "DUMBBELL_TOTAL", repStyle: "REPS", cues: "Hold one dumbbell at chest; load is that dumbbell's total mass." },
  { key: "dumbbell_romanian_deadlift", name: "Dumbbell Romanian deadlift", loadBasis: "DUMBBELL_PER_HAND", repStyle: "REPS", cues: "Soft knees, hinge at hips, keep dumbbells close to legs." },
  { key: "leg_extension", name: "Leg extension", loadBasis: "MACHINE_STACK", repStyle: "REPS", cues: "Control the eccentric; avoid locking out hard." },
  { key: "leg_curl", name: "Leg curl", loadBasis: "MACHINE_STACK", repStyle: "REPS", cues: "Full range, avoid hips rising off the pad." },
  { key: "calf_raise", name: "Calf raise", loadBasis: "BODYWEIGHT_PLUS_LOAD", repStyle: "REPS", cues: "Label the actual basis used each session: bodyweight, added total load, or machine stack." },
  { key: "plank", name: "Plank", loadBasis: "BODYWEIGHT", repStyle: "DURATION_SECONDS", cues: "Neutral spine, ribs down, breathe." },
  { key: "push_up", name: "Push-up", loadBasis: "BODYWEIGHT", repStyle: "REPS", cues: "Stop around 2 reps before failure. Record actual reps performed, never a fake 0 kg load." },
  { key: "dumbbell_rear_delt_fly", name: "Dumbbell rear-delt fly", loadBasis: "DUMBBELL_PER_HAND", repStyle: "REPS", cues: "Slight bend in elbows, squeeze shoulder blades." },
  { key: "dead_bug", name: "Dead bug", loadBasis: "BODYWEIGHT", repStyle: "REPS_PER_SIDE", cues: "Keep low back pressed to the floor." },
  { key: "bulgarian_split_squat", name: "Bulgarian split squat", loadBasis: "DUMBBELL_PER_HAND", repStyle: "REPS_PER_SIDE", cues: "Rear foot elevated; reps counted per leg." },
  { key: "hanging_knee_raise", name: "Hanging knee raise", loadBasis: "BODYWEIGHT", repStyle: "REPS", cues: "Control the swing; avoid momentum." },
];

type TemplateExerciseSeed = {
  exerciseKey: string;
  workingSets: number;
  targetRepsLow?: number;
  targetRepsHigh?: number;
  targetSecondsLow?: number;
  targetSecondsHigh?: number;
  restSeconds: number;
};

type DaySeed = {
  dayNumber: number;
  dayLabel: string;
  dayType: "STRENGTH" | "CARDIO_RECOVERY" | "OPTIONAL_RECOVERY" | "REST";
  plannedCardioMinutesLow?: number;
  plannedCardioMinutesHigh?: number;
  cardioMandatory: boolean;
  exercises: TemplateExerciseSeed[];
};

const DAYS: DaySeed[] = [
  {
    dayNumber: 1,
    dayLabel: "Upper A",
    dayType: "STRENGTH",
    plannedCardioMinutesLow: 15,
    plannedCardioMinutesHigh: 25,
    cardioMandatory: false,
    exercises: [
      { exerciseKey: "chest_press_machine", workingSets: 3, targetRepsLow: 8, targetRepsHigh: 12, restSeconds: 120 },
      { exerciseKey: "seated_cable_row", workingSets: 3, targetRepsLow: 8, targetRepsHigh: 12, restSeconds: 120 },
      { exerciseKey: "lat_pulldown", workingSets: 2, targetRepsLow: 8, targetRepsHigh: 12, restSeconds: 90 },
      { exerciseKey: "dumbbell_shoulder_press", workingSets: 2, targetRepsLow: 8, targetRepsHigh: 12, restSeconds: 90 },
      { exerciseKey: "dumbbell_biceps_curl", workingSets: 2, targetRepsLow: 10, targetRepsHigh: 15, restSeconds: 90 },
      { exerciseKey: "overhead_dumbbell_triceps_extension", workingSets: 2, targetRepsLow: 10, targetRepsHigh: 15, restSeconds: 90 },
    ],
  },
  {
    dayNumber: 2,
    dayLabel: "Lower A",
    dayType: "STRENGTH",
    cardioMandatory: false,
    exercises: [
      { exerciseKey: "goblet_squat", workingSets: 3, targetRepsLow: 6, targetRepsHigh: 10, restSeconds: 120 },
      { exerciseKey: "dumbbell_romanian_deadlift", workingSets: 3, targetRepsLow: 8, targetRepsHigh: 10, restSeconds: 120 },
      { exerciseKey: "leg_extension", workingSets: 3, targetRepsLow: 10, targetRepsHigh: 15, restSeconds: 90 },
      { exerciseKey: "leg_curl", workingSets: 3, targetRepsLow: 10, targetRepsHigh: 15, restSeconds: 90 },
      { exerciseKey: "calf_raise", workingSets: 3, targetRepsLow: 12, targetRepsHigh: 20, restSeconds: 90 },
      { exerciseKey: "plank", workingSets: 3, targetSecondsLow: 30, targetSecondsHigh: 60, restSeconds: 90 },
    ],
  },
  {
    dayNumber: 3,
    dayLabel: "Cardio / recovery",
    dayType: "CARDIO_RECOVERY",
    plannedCardioMinutesLow: 30,
    plannedCardioMinutesHigh: 40,
    cardioMandatory: false,
    exercises: [],
  },
  {
    dayNumber: 4,
    dayLabel: "Upper B",
    dayType: "STRENGTH",
    plannedCardioMinutesLow: 15,
    plannedCardioMinutesHigh: 25,
    cardioMandatory: false,
    exercises: [
      { exerciseKey: "chest_press_machine", workingSets: 2, targetRepsLow: 8, targetRepsHigh: 12, restSeconds: 120 },
      { exerciseKey: "seated_cable_row", workingSets: 3, targetRepsLow: 8, targetRepsHigh: 12, restSeconds: 120 },
      { exerciseKey: "lat_pulldown", workingSets: 2, targetRepsLow: 8, targetRepsHigh: 12, restSeconds: 90 },
      { exerciseKey: "push_up", workingSets: 2, restSeconds: 90 },
      { exerciseKey: "dumbbell_rear_delt_fly", workingSets: 2, targetRepsLow: 12, targetRepsHigh: 15, restSeconds: 90 },
      { exerciseKey: "dead_bug", workingSets: 3, targetRepsLow: 8, targetRepsHigh: 12, restSeconds: 90 },
    ],
  },
  {
    dayNumber: 5,
    dayLabel: "Lower B",
    dayType: "STRENGTH",
    cardioMandatory: false,
    exercises: [
      { exerciseKey: "bulgarian_split_squat", workingSets: 3, targetRepsLow: 8, targetRepsHigh: 8, restSeconds: 120 },
      { exerciseKey: "dumbbell_romanian_deadlift", workingSets: 3, targetRepsLow: 8, targetRepsHigh: 10, restSeconds: 120 },
      { exerciseKey: "leg_extension", workingSets: 3, targetRepsLow: 10, targetRepsHigh: 15, restSeconds: 90 },
      { exerciseKey: "leg_curl", workingSets: 3, targetRepsLow: 10, targetRepsHigh: 15, restSeconds: 90 },
      { exerciseKey: "calf_raise", workingSets: 3, targetRepsLow: 15, targetRepsHigh: 20, restSeconds: 90 },
      { exerciseKey: "hanging_knee_raise", workingSets: 3, targetRepsLow: 10, targetRepsHigh: 15, restSeconds: 90 },
    ],
  },
  {
    dayNumber: 6,
    dayLabel: "Optional recovery",
    dayType: "OPTIONAL_RECOVERY",
    cardioMandatory: false,
    exercises: [],
  },
  {
    dayNumber: 7,
    dayLabel: "Rest",
    dayType: "REST",
    cardioMandatory: false,
    exercises: [],
  },
];

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPassword = process.env.OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    throw new Error("OWNER_EMAIL and OWNER_PASSWORD must be set in .env before seeding.");
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  await prisma.ownerProfile.upsert({
    where: { id: "owner" },
    create: {
      id: "owner",
      email: ownerEmail,
      passwordHash,
      timezone: "Asia/Bangkok",
      heightCm: 170,
      baselineWeightKg: 75,
      baselineWeightNote:
        "Starting reference: 75 kg; date not recorded. Previously self-reported, not a measured installation-day weigh-in.",
      goalText:
        "Lean, compact, athletic physique with good strength, inspired by Messi. Not a promise about appearance or body composition, and not football-skills training.",
      initialMilestoneKg: 70,
      planningHorizonWeeks: 12,
      calorieTargetKcal: 2100,
      proteinTargetG: 150,
      weightChangeRefLow: 0.3,
      weightChangeRefHigh: 0.6,
      units: "kg,cm,minutes",
      programStartDate: null,
      notificationPrivacy: "detailed",
      priorLoadReferenceNotes:
        "Unverified prior references only, not prefilled sets: dumbbell bench press 12-14 kg per hand (most recent reference; earlier reference was 12-16 kg per hand); leg extension approximately 55 kg; leg curl approximately 55 kg. Chest-press machine working weight has not yet been established — do not seed 30-35 kg as an actual performance value.",
    },
    update: {}, // do not silently overwrite an existing owner profile on re-seed
  });

  for (const ex of EXERCISES) {
    await prisma.exerciseDefinition.upsert({
      where: { key: ex.key },
      create: {
        key: ex.key,
        name: ex.name,
        loadBasis: ex.loadBasis,
        repStyle: ex.repStyle,
        cues: ex.cues,
        defaultIncrementKg: null,
        equipmentLabel: null,
      },
      update: {},
    });
  }

  const existingVersion = await prisma.programVersion.findFirst({ where: { versionNumber: 1 } });
  const programVersion =
    existingVersion ??
    (await prisma.programVersion.create({
      data: {
        versionNumber: 1,
        effectiveDate: "1970-01-01", // effective from program start; real date chosen at first run
        planningHorizonWeeks: 12,
        notes: "Initial seeded starter program (v1).",
      },
    }));

  for (const day of DAYS) {
    const template = await prisma.workoutTemplate.upsert({
      where: { programVersionId_dayNumber: { programVersionId: programVersion.id, dayNumber: day.dayNumber } },
      create: {
        programVersionId: programVersion.id,
        dayNumber: day.dayNumber,
        dayLabel: day.dayLabel,
        dayType: day.dayType,
        plannedCardioMinutesLow: day.plannedCardioMinutesLow,
        plannedCardioMinutesHigh: day.plannedCardioMinutesHigh,
        cardioMandatory: day.cardioMandatory,
      },
      update: {},
    });

    const existingTemplateExercises = await prisma.templateExercise.findMany({ where: { workoutTemplateId: template.id } });
    if (existingTemplateExercises.length > 0) continue; // idempotent: don't duplicate on re-seed

    let orderIndex = 0;
    for (const te of day.exercises) {
      const exerciseDef = await prisma.exerciseDefinition.findUnique({ where: { key: te.exerciseKey } });
      if (!exerciseDef) throw new Error(`Unknown exercise key ${te.exerciseKey}`);
      await prisma.templateExercise.create({
        data: {
          workoutTemplateId: template.id,
          exerciseDefinitionId: exerciseDef.id,
          orderIndex: orderIndex++,
          workingSets: te.workingSets,
          targetRepsLow: te.targetRepsLow,
          targetRepsHigh: te.targetRepsHigh,
          targetSecondsLow: te.targetSecondsLow,
          targetSecondsHigh: te.targetSecondsHigh,
          restSeconds: te.restSeconds,
        },
      });
    }
  }

  // Default reminder rules, disabled until the owner confirms times and grants permission.
  const reminderDefaults = [
    { type: "morning_preview", localTime: "08:00" },
    { type: "evening_unfinished", localTime: "20:00" },
  ];
  for (const r of reminderDefaults) {
    const existing = await prisma.reminderRule.findFirst({ where: { type: r.type } });
    if (!existing) {
      await prisma.reminderRule.create({
        data: { type: r.type, localTime: r.localTime, activeDays: "1,2,3,4,5,6,7", enabled: false, privacy: "detailed" },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
