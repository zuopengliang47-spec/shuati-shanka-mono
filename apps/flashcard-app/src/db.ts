import Dexie, { type Table } from "dexie";
import type { AppSettings, LogRow, Question, StateRow } from "./types";

export class AppDB extends Dexie {
  questions!: Table<Question, string>;
  states!: Table<StateRow, string>;
  logs!: Table<LogRow, number>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("flashcard-app");
    this.version(1).stores({
      questions: "id, type, *tags",
      states: "questionId, due",
      logs: "++id, questionId, review",
      settings: "key",
    });
  }
}

export const db = new AppDB();

export const DEFAULT_SETTINGS: AppSettings = {
  newPerDay: 20,
  reviewLimit: 200,
  mode: "flash",
  tagFilter: "",
};

export async function loadSettings(): Promise<AppSettings> {
  const row = await db.settings.get("app");
  return { ...DEFAULT_SETTINGS, ...((row?.value ?? {}) as Partial<AppSettings>) };
}

export async function saveSettings(value: AppSettings): Promise<void> {
  await db.settings.put({ key: "app", value });
}

interface StreakInfo {
  lastStudyDay: string;
  streak: number;
}

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function loadStreak(): Promise<StreakInfo> {
  const row = await db.settings.get("streak");
  return (row?.value as StreakInfo | undefined) ?? { lastStudyDay: "", streak: 0 };
}

export async function touchStreak(): Promise<StreakInfo> {
  const info = await loadStreak();
  const today = dayKey();
  if (info.lastStudyDay === today) return info;
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const streak = info.lastStudyDay === yesterday ? info.streak + 1 : 1;
  const next = { lastStudyDay: today, streak };
  await db.settings.put({ key: "streak", value: next });
  return next;
}
