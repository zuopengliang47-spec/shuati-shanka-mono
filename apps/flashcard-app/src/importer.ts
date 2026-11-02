import type { Question, QuestionType } from "./types";
import { hashId } from "./scheduler";

const TYPES: QuestionType[] = ["single", "multi", "judge", "blank", "card"];

export interface ImportResult {
  questions: Question[];
  errors: string[];
}

function coerce(item: unknown, index: number, errors: string[]): Question | null {
  if (typeof item !== "object" || item === null) {
    errors.push(`第 ${index + 1} 条不是对象`);
    return null;
  }
  const obj = item as Record<string, unknown>;
  const stem = typeof obj.stem === "string" ? obj.stem.trim() : "";
  if (!stem) {
    errors.push(`第 ${index + 1} 条缺少 stem（题干）`);
    return null;
  }
  const type = TYPES.includes(obj.type as QuestionType) ? (obj.type as QuestionType) : "card";
  const options = Array.isArray(obj.options) ? obj.options.map(String) : undefined;
  let answer: string[] = [];
  if (Array.isArray(obj.answer)) answer = obj.answer.map(String);
  else if (typeof obj.answer === "string" && obj.answer.trim()) answer = [obj.answer.trim()];
  else if (typeof obj.answer === "number") answer = [String(obj.answer)];
  if (answer.length === 0) errors.push(`第 ${index + 1} 条没有答案，已按待补充处理`);
  const tags = Array.isArray(obj.tags) ? obj.tags.map(String) : [];
  return {
    id: typeof obj.id === "string" && obj.id ? obj.id : hashId(stem),
    type,
    stem,
    options,
    answer,
    explanation: typeof obj.explanation === "string" ? obj.explanation : undefined,
    tags,
    source: typeof obj.source === "string" ? obj.source : undefined,
    answerSource: typeof obj.answerSource === "string" ? obj.answerSource : undefined,
  };
}

export function parseQuestionJson(text: string): ImportResult {
  const errors: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { questions: [], errors: [`JSON 解析失败：${(err as Error).message}`] };
  }
  const list = Array.isArray(data) ? data : Array.isArray((data as { questions?: unknown }).questions) ? (data as { questions: unknown[] }).questions : null;
  if (!list) return { questions: [], errors: ["JSON 顶层必须是数组，或 {questions: [...]}"] };
  const questions: Question[] = [];
  list.forEach((item, index) => {
    const q = coerce(item, index, errors);
    if (q) questions.push(q);
  });
  return { questions, errors };
}

/** 极简 CSV：逗号分隔，首行可选表头。支持「正面,背面,标签」或「题干,选项A,选项B,选项C,选项D,答案,解析,标签」 */
export function parseQuestionCsv(text: string): ImportResult {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { questions: [], errors: ["CSV 为空"] };
  const split = (line: string) =>
    line
      .split(",")
      .map((cell) => cell.replace(/^"|"$/g, "").trim());
  const head = split(lines[0]);
  const start = head.some((h) => /stem|题干|正面|front/i.test(h)) ? 1 : 0;
  const questions: Question[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i]);
    if (cells.length < 2) {
      errors.push(`第 ${i + 1} 行字段不足`);
      continue;
    }
    const looksLikeChoice = cells.length >= 5;
    if (looksLikeChoice) {
      const [stem, a, b, c, d, ans, exp, tags] = cells;
      const options = [a, b, c, d].filter(Boolean);
      questions.push({
        id: hashId(stem),
        type: options.length >= 2 ? "single" : "card",
        stem,
        options: options.length >= 2 ? options : undefined,
        answer: (ans ?? "").split(/[;；|/]/).map((s) => s.trim()).filter(Boolean),
        explanation: exp || undefined,
        tags: tags ? tags.split(/[;；|]/).map((s) => s.trim()) : [],
      });
    } else {
      const [front, back, tags] = cells;
      questions.push({
        id: hashId(front),
        type: "card",
        stem: front,
        answer: [back ?? ""],
        tags: tags ? tags.split(/[;；|]/).map((s) => s.trim()) : [],
      });
    }
  }
  return { questions, errors };
}
