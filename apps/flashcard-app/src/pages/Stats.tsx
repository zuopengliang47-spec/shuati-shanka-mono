import { useEffect, useState } from "react";
import { State } from "ts-fsrs";
import { db } from "../db";
import type { LogRow, StateRow } from "../types";

const STATE_LABELS: Record<number, string> = {
  [State.New]: "未学",
  [State.Learning]: "学习中",
  [State.Review]: "复习中",
  [State.Relearning]: "重学中",
};

export default function Stats() {
  const [total, setTotal] = useState(0);
  const [states, setStates] = useState<StateRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    void (async () => {
      const [count, stateRows, logRows] = await Promise.all([
        db.questions.count(),
        db.states.toArray(),
        db.logs.toArray(),
      ]);
      setTotal(count);
      setStates(stateRows);
      setLogs(logRows);
    })();
  }, []);

  const now = Date.now();
  const dueToday = states.filter((s) => s.due <= now).length;
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const start = dayStart.getTime() + i * 86400000;
    const end = start + 86400000;
    const count = states.filter((s) => s.due >= start && s.due < end).length;
    const label = i === 0 ? "今天" : i === 1 ? "明天" : `${i}天后`;
    return { label, count };
  });
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const reviewed = logs.length;
  const correct = logs.filter((l) => l.correct === 1).length;
  const accuracy = reviewed ? Math.round((correct / reviewed) * 100) : 0;
  const avgSeconds = reviewed
    ? Math.round(logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / reviewed / 1000)
    : 0;

  const byState = states.reduce<Record<number, number>>((acc, s) => {
    acc[s.card.state] = (acc[s.card.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="card">
        <h2>总览</h2>
        <div className="row">
          <div className="stat">
            <b>{total}</b>
            <span>题库总量</span>
          </div>
          <div className="stat">
            <b>{states.length}</b>
            <span>已进入曲线</span>
          </div>
          <div className="stat">
            <b>{dueToday}</b>
            <span>现在到期</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <div className="stat">
            <b>{reviewed}</b>
            <span>累计复习次数</span>
          </div>
          <div className="stat">
            <b>{accuracy}%</b>
            <span>记住率</span>
          </div>
          <div className="stat">
            <b>{avgSeconds}s</b>
            <span>平均每题</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>未来 7 天到期分布</h2>
        <div className="bars">
          {buckets.map((bucket) => (
            <div className="bar" key={bucket.label}>
              <span className="muted small">{bucket.count}</span>
              <i style={{ height: `${(bucket.count / maxBucket) * 100}%` }} />
              <span className="muted small">{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>卡片状态</h2>
        {Object.keys(STATE_LABELS).map((key) => {
          const num = Number(key);
          const count = byState[num] ?? 0;
          return (
            <div className="list-item" key={key}>
              <span className="grow">{STATE_LABELS[num]}</span>
              <b>{count}</b>
            </div>
          );
        })}
        <div className="list-item">
          <span className="grow">未开始</span>
          <b>{Math.max(0, total - states.length)}</b>
        </div>
      </div>
    </div>
  );
}
