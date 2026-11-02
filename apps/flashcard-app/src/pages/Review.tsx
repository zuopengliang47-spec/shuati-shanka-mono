import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rating } from "ts-fsrs";
import { answerKeys, applyRating, createCard, formatDelta, isCorrect, previewDue, RATING_OPTIONS, type Grade } from "../scheduler";
import { db, touchStreak } from "../db";
import { typeLabel, type AppSettings, type QueueItem, type Question } from "../types";
import MathText from "../MathText";
import { scopedQuestions } from "../scope";

interface Props {
  settings: AppSettings;
  onExit: () => void;
  onModeChange: (mode: "flash" | "quiz") => void;
}

function answerText(question: Question): string {
  if (question.options && question.options.length > 0) {
    return optionTexts(question).join(" / ");
  }
  return question.answer.join(" / ");
}

/** 解析里混着 Markdown 标记（加粗、表格分隔行、竖线），清理后交给 MathText 渲染公式 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*\s*(.+?)\s*\*\*/g, "$1")
    .split("\n")
    .filter((line) => !/^\s*\|?[\s:|-]{3,}\|?\s*$/.test(line))
    .map((line) => line.replace(/\s*\|\s*/g, "　").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** 答案 -> 选项下标（兼容字母/原文/下标），供高亮正确答案用 */
function answerIndexes(question: Question): string[] {
  return answerKeys(question.answer, question.options);
}

/** 下标 -> 选项原文，便于在答案区直接看到内容而不是 "C" */
function optionTexts(question: Question): string[] {
  const indexes = answerIndexes(question);
  const opts = question.options ?? [];
  if (indexes.length === 0) return question.answer;
  return indexes.map((k) => {
    const i = Number(k);
    return Number.isFinite(i) && opts[i] ? opts[i] : k;
  });
}

export default function Review({ settings, onExit, onModeChange }: Props) {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [graded, setGraded] = useState<boolean | null>(null);
  const [session, setSession] = useState({ answered: 0, correct: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    void (async () => {
      const now = Date.now();
      const [all, states] = await Promise.all([db.questions.toArray(), db.states.toArray()]);
      const questions = scopedQuestions(all, settings.tagFilter);
      const map = new Map(states.map((s) => [s.questionId, s]));
      const due = questions
        .filter((q) => {
          const s = map.get(q.id);
          return !!s && s.due <= now;
        })
        .sort((a, b) => (map.get(a.id)?.due ?? 0) - (map.get(b.id)?.due ?? 0));
      const fresh = questions.filter((q) => !map.has(q.id));
      const queue: QueueItem[] = [
        ...due.slice(0, settings.reviewLimit).map((q) => ({ question: q, state: map.get(q.id) })),
        ...fresh.slice(0, settings.newPerDay).map((q) => ({ question: q })),
      ];
      setItems(queue);
      setCursor(0);
      startedAt.current = Date.now();
    })();
  }, [settings.newPerDay, settings.reviewLimit, settings.tagFilter]);

  const current = items?.[cursor];

  const answer = useCallback(
    async (rating: Grade) => {
      if (!items || !current) return;
      const base = current.state?.card ?? createCard();
      const { card, log } = applyRating(base, rating);
      const nextState = {
        questionId: current.question.id,
        card,
        due: card.due.getTime(),
        wrongCount: (current.state?.wrongCount ?? 0) + (rating === Rating.Again ? 1 : 0),
        lastRating: rating,
        updatedAt: Date.now(),
      };
      await db.states.put(nextState);
      await db.logs.add({
        questionId: current.question.id,
        rating,
        review: log.review.getTime(),
        correct: rating >= Rating.Good ? 1 : 0,
        durationMs: Date.now() - startedAt.current,
      });
      await touchStreak();
      setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (rating >= Rating.Good ? 1 : 0) }));
      setItems((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        if (rating === Rating.Again) next.push({ question: current.question, state: nextState });
        return next;
      });
      setCursor((c) => c + 1);
      setRevealed(false);
      setPicked([]);
      setGraded(null);
      startedAt.current = Date.now();
    },
    [current, items]
  );

  // 有选项且有答案的题才走「刷题」判分，其余（问答卡、缺答案）一律闪卡自评
  const showQuiz = !!current && (current.question.options?.length ?? 0) > 0 && answerIndexes(current.question).length > 0;
  const canGrade = settings.mode === "quiz" && showQuiz ? graded !== null : revealed;

  /** 多选题：勾选多个选项后统一判分 */
  const submitMulti = useCallback(() => {
    if (!current || picked.length === 0) return;
    setGraded(isCorrect(current.question, picked.map(String)));
  }, [current, picked]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!current) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (settings.mode === "quiz" && showQuiz) {
          if (graded === null && picked.length > 0) setGraded(isCorrect(current.question, picked.map(String)));
        } else if (!revealed) setRevealed(true);
        return;
      }
      if (!canGrade) return;
      const option = RATING_OPTIONS.find((o) => o.key === event.key);
      if (option) {
        event.preventDefault();
        void answer(option.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, canGrade, current, graded, picked, revealed, settings.mode, showQuiz]);

  const preview = useMemo(() => {
    if (!current) return null;
    const base = current.state?.card ?? createCard();
    return previewDue(base, new Date());
  }, [current]);

  const onPointerDown = (event: React.PointerEvent) => {
    dragStart.current = { x: event.clientX, y: event.clientY };
    setDrag({ x: 0, y: 0 });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragStart.current) return;
    setDrag({ x: event.clientX - dragStart.current.x, y: event.clientY - dragStart.current.y });
  };

  const onPointerUp = () => {
    const { x, y } = drag;
    dragStart.current = null;
    setDrag({ x: 0, y: 0 });
    if (!canGrade) return;
    if (Math.abs(x) < 70 && Math.abs(y) < 70) return;
    if (Math.abs(x) > Math.abs(y)) void answer(x < 0 ? Rating.Again : Rating.Good);
    else void answer(y < 0 ? Rating.Hard : Rating.Easy);
  };

  if (!items) {
    return <div className="card center">正在准备今天的队列…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="card center">
        <h2>今天没有要复习的题</h2>
        <p className="muted">
          既没有到期卡片，也没有新题配额。去「题库」按科目导入内置题库，或导入自己的 JSON / CSV 题库。
        </p>
        <button className="btn" onClick={onExit}>
          返回
        </button>
      </div>
    );
  }

  if (cursor >= items.length) {
    const rate = session.answered ? Math.round((session.correct / session.answered) * 100) : 0;
    return (
      <div className="card center">
        <h2>本轮完成 🎉</h2>
        <div className="row" style={{ justifyContent: "center", margin: "14px 0" }}>
          <div className="stat">
            <b>{session.answered}</b>
            <span>复习卡片</span>
          </div>
          <div className="stat">
            <b>{rate}%</b>
            <span>记住率</span>
          </div>
        </div>
        <p className="muted small">忘记的题已经按记忆曲线排进后面的队里了，稍后会再次出现。</p>
        <button className="btn primary" onClick={onExit}>
          回到今日
        </button>
      </div>
    );
  }

  if (!current) {
    return <div className="card center">正在准备今天的队列…</div>;
  }

  const question = current.question;
  const isMulti = question.type === "multi";
  const percent = Math.round((cursor / items.length) * 100);
  const transform = `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 24}deg)`;

  return (
    <div>
      <div className="progress">
        <div style={{ width: `${percent}%` }} />
      </div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="muted small">
          剩余 {items.length - cursor} 张 · 已答 {session.answered}
        </span>
        <div className="row tight">
          <button className={`btn small ${settings.mode === "flash" ? "primary" : "ghost"}`} onClick={() => onModeChange("flash")}>
            闪卡
          </button>
          <button className={`btn small ${settings.mode === "quiz" ? "primary" : "ghost"}`} onClick={() => onModeChange("quiz")}>
            刷题
          </button>
          <button className="btn small ghost" onClick={onExit}>
            退出
          </button>
        </div>
      </div>

      <div
        className="flashcard"
        style={{ transform, transition: dragStart.current ? "none" : "transform 0.18s" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="row tight">
          <span className={`tag type-tag${isMulti ? " highlight" : ""}`}>{typeLabel(question.type)}</span>
          {question.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="stem">
          <MathText text={question.stem} />
        </div>

        {settings.mode === "quiz" && showQuiz && (
          <div>
            {(question.options ?? []).map((option, index) => {
              const isPicked = picked.includes(index);
              const isAnswer = answerIndexes(question).includes(String(index));
              const showResult = graded !== null;
              const cls = showResult && isAnswer ? "correct" : isPicked ? (showResult ? "wrong" : "picked") : "";
              return (
                <button
                  key={option}
                  className={`option ${cls}`}
                  disabled={graded !== null}
                  onClick={() => {
                    if (isMulti) {
                      setPicked((prev) =>
                        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
                      );
                    } else {
                      setPicked([index]);
                      setGraded(isCorrect(question, [String(index)]));
                    }
                  }}
                >
                  {String.fromCharCode(65 + index)}. <MathText text={option} />
                </button>
              );
            })}
            {isMulti && graded === null && (
              <button className="btn primary" disabled={picked.length === 0} onClick={submitMulti}>
                提交（已选 {picked.length} 项）
              </button>
            )}
          </div>
        )}

        {(!showQuiz || settings.mode === "flash") && !revealed && (
          <button className="btn primary" onClick={() => setRevealed(true)}>
            显示答案（空格）
          </button>
        )}

        {(!showQuiz || settings.mode === "flash") && revealed && (
          <div className="answer-box">
            {question.answer.length > 0 ? (
              <>
                <b>答案{isMulti ? "（多选）" : ""}：</b>
                <MathText text={answerText(question)} />
              </>
            ) : (
              <b className="no-answer">【无答案】源站没有收录这道题的答案，按「记住 / 模糊」自评即可。</b>
            )}
            {question.explanation ? <MathText text={`\n\n解析：${cleanMarkdown(question.explanation)}`} /> : ""}
            {question.answerSource ? <div className="answer-source">答案来源：{question.answerSource}</div> : null}
          </div>
        )}

        {settings.mode === "quiz" && graded !== null && (
          <div className="answer-box">
            <b>{graded ? "答对了 ✅" : "答错了 ❌"}　正确答案：</b>
            {question.answer.length > 0 ? (
              <MathText text={answerText(question)} />
            ) : (
              <span className="no-answer">【无答案】源站没有收录这道题的答案，按「记住 / 模糊」自评即可</span>
            )}
            {question.explanation ? <MathText text={`\n\n解析：${cleanMarkdown(question.explanation)}`} /> : ""}
            {question.answerSource ? <div className="answer-source">答案来源：{question.answerSource}</div> : null}
          </div>
        )}
      </div>

      {canGrade ? (
        <>
          <div className="rating-bar">
            {RATING_OPTIONS.map((option) => (
              <button
                key={option.key}
                className={`rate-btn ${option.tone}`}
                onClick={() => void answer(option.rating)}
                title={option.hint}
              >
                <b>{option.label}</b>
                <span>{preview ? formatDelta(new Date(), preview[option.rating]) : ""}</span>
              </button>
            ))}
          </div>
          <div className="swipe-tip">也可以滑动卡片评分：左滑忘记 · 上滑模糊 · 右滑记住 · 下滑太简单</div>
        </>
      ) : settings.mode === "quiz" && showQuiz ? (
        <div className="swipe-tip">{isMulti ? "多选题：勾选全部正确选项后点「提交」" : "选一个选项作答"}</div>
      ) : (
        <div className="swipe-tip">先想答案，再点「显示答案」</div>
      )}
    </div>
  );
}
