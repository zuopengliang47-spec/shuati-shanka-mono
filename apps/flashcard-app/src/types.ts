import type { Card } from "ts-fsrs";

export type QuestionType = "single" | "multi" | "judge" | "blank" | "card";

/** 题型的中文标注，界面和导出里共用 */
export const TYPE_LABEL: Record<QuestionType, string> = {
  single: "单选题",
  multi: "多选题",
  judge: "判断题",
  blank: "填空题",
  card: "问答题",
};

/** 刷题模式下会显示选项、需要勾选/作答的题型 */
export const CHOICE_TYPES: QuestionType[] = ["single", "multi", "judge"];

export function typeLabel(type: QuestionType | string): string {
  return TYPE_LABEL[type as QuestionType] ?? type;
}

export interface Question {
  id: string;
  type: QuestionType;
  stem: string;
  options?: string[];
  answer: string[];
  explanation?: string;
  tags: string[];
  source?: string;
  /** 答案来源标注：源站参考答案（zikaosw.cn）/ AI 补充答案（未经官方核对）…… */
  answerSource?: string;
}

export interface StateRow {
  questionId: string;
  card: Card;
  due: number;
  wrongCount: number;
  lastRating?: number;
  updatedAt: number;
}

export interface LogRow {
  id?: number;
  questionId: string;
  rating: number;
  review: number;
  correct: 0 | 1;
  durationMs: number;
}

export interface AppSettings {
  newPerDay: number;
  reviewLimit: number;
  mode: "flash" | "quiz";
  /** 复习范围：留空=全部题目；否则只复习带此标签的题（如 "00023"） */
  tagFilter: string;
}

export interface QueueItem {
  question: Question;
  state?: StateRow;
}

export interface Counts {
  total: number;
  learned: number;
  due: number;
  fresh: number;
}
