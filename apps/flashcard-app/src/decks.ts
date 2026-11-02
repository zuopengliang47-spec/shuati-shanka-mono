import { useEffect, useState } from "react";
import { db } from "./db";
import { parseQuestionJson } from "./importer";
import type { Question } from "./types";

export interface DeckMeta {
  id: string;
  /** 科目代码，如 00023、00147；计算机等级考试显示为 "NCRE 一级" */
  code: string;
  name: string;
  /** 用于"按科目聚焦复习"的唯一标签，与题库 JSON 里的 tags 一致 */
  tag: string;
  file: string;
  group: string;
  note?: string;
  count: number;
  noAnswer?: number;
  byType: Record<string, number>;
}

interface DeckIndex {
  total: number;
  selfStudyTotal: number;
  notice?: string;
  decks: DeckMeta[];
}

const base = import.meta.env.BASE_URL || "/";
const INDEX_URL = `${base}decks/index.json`;
const deckUrl = (file: string) => `${base}decks/${file}`;

let cached: DeckIndex | null = null;

export async function loadDeckIndex(): Promise<DeckIndex> {
  if (cached) return cached;
  const res = await fetch(INDEX_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`内置题库清单加载失败（HTTP ${res.status}）`);
  cached = (await res.json()) as DeckIndex;
  return cached;
}

export function useDeckIndex() {
  const [index, setIndex] = useState<DeckIndex | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    loadDeckIndex()
      .then((data) => alive && setIndex(data))
      .catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, []);
  return { index, error };
}

export interface DeckImportResult {
  total: number;
  added: number;
  /** 已存在但内容有更新、被覆盖的题数（记忆曲线保留） */
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * 拉取内置题库 JSON 并入库。
 * - 新题：直接写入；
 * - 已有同 id 的题：内容有变化就覆盖（题库修错后能自动升级），复习状态另存于 states 表，不受影响；
 * - 内容完全一致的题不动，避免无谓写入。
 */
export async function importDeck(meta: DeckMeta): Promise<DeckImportResult> {
  const res = await fetch(deckUrl(meta.file));
  if (!res.ok) throw new Error(`题库文件加载失败：${meta.file}（HTTP ${res.status}）`);
  const { questions, errors } = parseQuestionJson(await res.text());
  if (questions.length === 0) throw new Error(`${meta.name} 没有解析出题目`);
  const { added, updated, skipped } = await upsertQuestions(questions);
  return { total: questions.length, added, updated, skipped, errors };
}

/**
 * 入库并处理重复：新题写入；同 id 且内容有变化的覆盖（题库修错后能自动升级，
 * 复习状态另存于 states 表，不受影响）；内容一致的跳过。
 */
export async function upsertQuestions(
  questions: Question[]
): Promise<{ added: number; updated: number; skipped: number }> {
  const existing = await db.questions.bulkGet(questions.map((q) => q.id));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const toWrite: Question[] = [];
  questions.forEach((q, i) => {
    const old = existing[i];
    if (!old) {
      added++;
      toWrite.push(q);
    } else if (sameQuestion(old, q)) {
      skipped++;
    } else {
      updated++;
      toWrite.push(q);
    }
  });
  if (toWrite.length) await db.questions.bulkPut(toWrite);
  return { added, updated, skipped };
}

/** 逐字段比较（顺序无关），判断两道题是否完全一致 */
function sameQuestion(a: Question, b: Question): boolean {
  const norm = (q: Question) => ({
    type: q.type,
    stem: q.stem,
    options: q.options ?? [],
    answer: q.answer,
    explanation: q.explanation ?? "",
    tags: [...q.tags].sort(),
    source: q.source ?? "",
    answerSource: q.answerSource ?? "",
  });
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/** 已导入多少题（按标签统计，清空题库后会自动归零） */
export async function countImported(tag: string): Promise<number> {
  return db.questions.where("tags").equals(tag).count();
}

export async function countImportedAll(decks: DeckMeta[]): Promise<Record<string, number>> {
  const entries = await Promise.all(decks.map(async (d) => [d.id, await countImported(d.tag)] as const));
  return Object.fromEntries(entries);
}

/** 题型摘要：single 80、card 96 → "单选 80 · 问答 96" */
const TYPE_LABEL: Record<string, string> = {
  single: "单选",
  multi: "多选",
  judge: "判断",
  blank: "填空",
  card: "问答",
};

export function typeSummary(byType: Record<string, number>): string {
  return Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${TYPE_LABEL[type] ?? type} ${n}`)
    .join(" · ");
}
