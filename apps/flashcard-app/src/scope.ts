import type { Question } from "./types";

/** 复习范围：tagFilter 为空表示全部题目，否则只保留带该标签的题（如 "00023"） */
export function inScope(question: Question, tagFilter: string): boolean {
  return !tagFilter || question.tags.includes(tagFilter);
}

export function scopedQuestions(questions: Question[], tagFilter: string): Question[] {
  return tagFilter ? questions.filter((q) => inScope(q, tagFilter)) : questions;
}
