-- CreateTable
CREATE TABLE "OwnerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'owner',
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "heightCm" REAL,
    "baselineWeightKg" REAL,
    "baselineWeightNote" TEXT,
    "goalText" TEXT,
    "initialMilestoneKg" REAL,
    "planningHorizonWeeks" INTEGER,
    "calorieTargetKcal" INTEGER,
    "proteinTargetG" INTEGER,
    "weightChangeRefLow" REAL,
    "weightChangeRefHigh" REAL,
    "units" TEXT NOT NULL DEFAULT 'kg,cm,minutes',
    "programStartDate" TEXT,
    "notificationPrivacy" TEXT NOT NULL DEFAULT 'detailed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProgramVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionNumber" INTEGER NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "planningHorizonWeeks" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExerciseDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loadBasis" TEXT NOT NULL,
    "repStyle" TEXT NOT NULL,
    "cues" TEXT,
    "defaultIncrementKg" REAL,
    "equipmentLabel" TEXT
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programVersionId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "dayType" TEXT NOT NULL,
    "plannedCardioMinutesLow" INTEGER,
    "plannedCardioMinutesHigh" INTEGER,
    "cardioMandatory" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WorkoutTemplate_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutTemplateId" TEXT NOT NULL,
    "exerciseDefinitionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "workingSets" INTEGER NOT NULL,
    "targetRepsLow" INTEGER,
    "targetRepsHigh" INTEGER,
    "targetSecondsLow" INTEGER,
    "targetSecondsHigh" INTEGER,
    "restSeconds" INTEGER NOT NULL DEFAULT 120,
    CONSTRAINT "TemplateExercise_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TemplateExercise_exerciseDefinitionId_fkey" FOREIGN KEY ("exerciseDefinitionId") REFERENCES "ExerciseDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduledOccurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programVersionId" TEXT NOT NULL,
    "workoutTemplateId" TEXT NOT NULL,
    "originalDate" TEXT NOT NULL,
    "currentDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "rescheduleHistory" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledOccurrence_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduledOccurrence_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occurrenceId" TEXT NOT NULL,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "WorkoutSession_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "ScheduledOccurrence" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseDefinitionId" TEXT NOT NULL,
    "setIndex" INTEGER NOT NULL,
    "side" TEXT,
    "equipmentKey" TEXT,
    "actualWeightKg" REAL,
    "actualReps" INTEGER,
    "actualSeconds" INTEGER,
    "rir" INTEGER,
    "isWarmup" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "painFlag" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExerciseSet_exerciseDefinitionId_fkey" FOREIGN KEY ("exerciseDefinitionId") REFERENCES "ExerciseDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "localDate" TEXT NOT NULL,
    "weightKg" REAL,
    "waistCm" REAL,
    "calories" INTEGER,
    "proteinG" INTEGER,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CardioLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occurrenceId" TEXT,
    "localDate" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "actualMinutes" INTEGER,
    "effort" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardioLog_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "ScheduledOccurrence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "localTime" TEXT NOT NULL,
    "activeDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "privacy" TEXT NOT NULL DEFAULT 'detailed',
    "snoozedUntil" TEXT
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "logicalKey" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outboxId" TEXT NOT NULL,
    "pushSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationDelivery_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "NotificationOutbox" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerProfile_email_key" ON "OwnerProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramVersion_versionNumber_key" ON "ProgramVersion"("versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseDefinition_key_key" ON "ExerciseDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplate_programVersionId_dayNumber_key" ON "WorkoutTemplate"("programVersionId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledOccurrence_currentDate_key" ON "ScheduledOccurrence"("currentDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_occurrenceId_key" ON "WorkoutSession"("occurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSet_clientId_key" ON "ExerciseSet"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_localDate_key" ON "DailyLog"("localDate");

-- CreateIndex
CREATE UNIQUE INDEX "CardioLog_occurrenceId_key" ON "CardioLog"("occurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_logicalKey_key" ON "NotificationOutbox"("logicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_outboxId_pushSubscriptionId_key" ON "NotificationDelivery"("outboxId", "pushSubscriptionId");
