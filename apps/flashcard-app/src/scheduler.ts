import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";
import type { Question } from "./types";

export const scheduler = fsrs();

/** FSRS 的四个评分档（不含 Manual） */
export type Grade = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;

export interface RatingOption {
  rating: Grade;
  label: string;
  hint: string;
  key: string;
  tone: "danger" | "warn" | "ok" | "info";
  gesture: string;
}

export const RATING_OPTIONS: RatingOption[] = [
  { rating: Rating.Again, label: "忘记", hint: "完全不会，稍后重来", key: "1", tone: "danger", gesture: "左滑" },
  { rating: Rating.Hard, label: "模糊", hint: "想起来了，但很费劲", key: "2", tone: "warn", gesture: "上滑" },
  { rating: Rating.Good, label: "记住", hint: "正常答对", key: "3", tone: "ok", gesture: "右滑" },
  { rating: Rating.Easy, label: "太简单", hint: "一眼就会", key: "4", tone: "info", gesture: "下滑" },
];

export function createCard(now = new Date()): Card {
  return createEmptyCard(now);
}

/** 预览四个评分各自的下次到期时间，用于显示在按钮上 */
export function previewDue(card: Card, now = new Date()): Record<number, Date> {
  const preview = scheduler.repeat(card, now);
  const out: Record<number, Date> = {};
  for (const option of RATING_OPTIONS) {
    out[option.rating] = preview[option.rating].card.due;
  }
  return out;
}

export function applyRating(card: Card, rating: Grade, now = new Date()) {
  return scheduler.next(card, now, rating);
}

export function formatDelta(from: Date, to: Date): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const minutes = ms / 60000;
  if (minutes < 1) return "<1 分钟";
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} 小时`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} 天`;
  const months = days / 30;
  if (months < 12) return `${months.toFixed(1)} 个月`;
  return `${(days / 365).toFixed(1)} 年`;
}

/**
 * 把答案规整成可比较的键。
 * 兼容三种写法：选项下标（"2"）、选项字母（"C"）、选项原文（"时效性"）。
 * 这样任何来源的题库 JSON 都能直接导入刷题模式，不必先手工改答案格式。
 */
export function answerKeys(answer: string[], options?: string[]): string[] {
  const opts = (options ?? []).map((o) => o.trim());
  return answer
    .map((raw) => {
      const s = String(raw).trim();
      if (!s) return "";
      if (/^[A-Ha-h]$/.test(s)) {
        const i = s.toUpperCase().charCodeAt(0) - 65;
        if (i < opts.length) return String(i);
      }
      const textIdx = opts.findIndex((o) => o === s);
      if (textIdx >= 0) return String(textIdx);
      return s;
    })
    .filter(Boolean)
    .sort();
}

/** 判断作答是否正确（用于刷题模式自动评分） */
export function isCorrect(question: Question, picked: string[]): boolean {
  const a = answerKeys(question.answer, question.options);
  const b = answerKeys(picked, question.options);
  return a.length > 0 && a.join("|") === b.join("|");
}

export function hashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return `q${(hash >>> 0).toString(36)}`;
}
