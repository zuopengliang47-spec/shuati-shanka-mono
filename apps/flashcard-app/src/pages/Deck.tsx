import { useCallback, useEffect, useState } from "react";
import { db } from "../db";
import { parseQuestionCsv, parseQuestionJson } from "../importer";
import { SAMPLE_QUESTIONS } from "../seed";
import { typeLabel, type Question } from "../types";
import MathText from "../MathText";
import {
  countImportedAll,
  importDeck,
  typeSummary,
  upsertQuestions,
  useDeckIndex,
  type DeckMeta,
} from "../decks";

interface Props {
  onChange: () => void;
  /** 把复习范围切到某一科并跳到复习页 */
  onStartSubject: (tag: string) => void;
}

export default function Deck({ onChange, onStartSubject }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const { index, error: deckError } = useDeckIndex();
  const [deckCounts, setDeckCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");

  const reload = useCallback(async () => {
    const all = await db.questions.toArray();
    setQuestions(all.sort((a, b) => a.stem.localeCompare(b.stem, "zh")));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refreshDeckCounts = useCallback(async () => {
    if (!index) return;
    setDeckCounts(await countImportedAll(index.decks));
  }, [index]);

  useEffect(() => {
    void refreshDeckCounts();
  }, [refreshDeckCounts, questions.length]);

  async function importOne(deck: DeckMeta) {
    setBusy(deck.id);
    try {
      const result = await importDeck(deck);
      setMessage(
        `已导入 ${deck.code} ${deck.name}：新增 ${result.added} 题` +
          (result.updated ? `，更新 ${result.updated} 题` : "") +
          (result.skipped ? `，${result.skipped} 题无变化` : "") +
          (result.errors.length ? `；提示：${result.errors[0]}` : "")
      );
      await reload();
      await refreshDeckCounts();
      onChange();
    } catch (err) {
      setMessage(`导入失败：${(err as Error).message}`);
    } finally {
      setBusy("");
    }
  }

  async function importSelfStudyAll() {
    if (!index) return;
    setBusy("all");
    try {
      let added = 0;
      let skipped = 0;
      let updated = 0;
      for (const deck of index.decks.filter((d) => d.group === "自考")) {
        const result = await importDeck(deck);
        added += result.added;
        updated += result.updated;
        skipped += result.skipped;
      }
      setMessage(
        `自考全部导入完成：新增 ${added} 题` +
          (updated ? `，更新 ${updated} 题` : "") +
          (skipped ? `，${skipped} 题无变化` : "")
      );
      await reload();
      await refreshDeckCounts();
      onChange();
    } catch (err) {
      setMessage(`导入中断：${(err as Error).message}`);
    } finally {
      setBusy("");
    }
  }

  async function importText() {
    const result = format === "json" ? parseQuestionJson(text) : parseQuestionCsv(text);
    if (result.questions.length === 0) {
      setMessage(`没有解析出题目。${result.errors.slice(0, 3).join("；")}`);
      return;
    }
    const { added, updated, skipped } = await upsertQuestions(result.questions);
    setMessage(
      `解析 ${result.questions.length} 条：新增 ${added} 条` +
        (updated ? `，更新 ${updated} 条` : "") +
        (skipped ? `，${skipped} 条无变化` : "") +
        (result.errors.length ? `；提示：${result.errors.slice(0, 2).join("；")}` : "")
    );
    setText("");
    await reload();
    onChange();
  }

  async function loadSample() {
    await db.questions.bulkPut(SAMPLE_QUESTIONS);
    setMessage(`已载入 ${SAMPLE_QUESTIONS.length} 道示例题（医考基础常识）`);
    await reload();
    onChange();
  }

  async function removeOne(id: string) {
    await db.questions.delete(id);
    await db.states.delete(id);
    await reload();
    onChange();
  }

  async function clearAll() {
    if (!confirm("确定清空所有题库和复习进度？此操作不可撤销。")) return;
    await Promise.all([db.questions.clear(), db.states.clear(), db.logs.clear()]);
    setMessage("已清空题库与进度");
    await reload();
    onChange();
  }

  async function exportJson() {
    const data = JSON.stringify(await db.questions.toArray(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const shown = filter
    ? questions.filter((q) => q.tags.some((t) => t.includes(filter)) || q.stem.includes(filter))
    : questions;

  return (
    <div>
      {index && (
        <div className="card">
          <h2>
            内置题库（{index.decks.length} 套 · {index.total} 题）
          </h2>
          <p className="muted small">
            题库已经在 App 里了，点「导入」就行，不用挑文件。导入后点「刷这科」，复习范围会自动切到这一科。
          </p>
          <div className="row" style={{ margin: "10px 0" }}>
            <button className="btn primary" disabled={busy !== ""} onClick={() => void importSelfStudyAll()}>
              {busy === "all" ? "导入中…" : `一键导入全部自考（${index.selfStudyTotal} 题）`}
            </button>
          </div>
          {[...new Set(index.decks.map((d) => d.group))].map((group) => (
            <div key={group}>
              <div className="group-title">{group}</div>
              {index.decks
                .filter((d) => d.group === group)
                .map((deck) => {
                  const imported = deckCounts[deck.id] ?? 0;
                  const done = imported >= deck.count;
                  return (
                    <div className="list-item deck" key={deck.id}>
                      <div className="grow">
                        <div>
                          <b>{deck.code}</b> {deck.name} <span className="muted small">{deck.count} 题</span>
                        </div>
                        <div className="muted small">
                          {typeSummary(deck.byType)}
                          {deck.note ? ` · ${deck.note}` : ""}
                        </div>
                        <div className="muted small">
                          已导入 {imported}/{deck.count}
                          {deck.noAnswer ? ` · ${deck.noAnswer} 题源数据没有答案（按自评背诵）` : ""}
                        </div>
                      </div>
                      <div className="row tight">
                        <button
                          className="btn small primary"
                          disabled={busy !== "" || done}
                          onClick={() => void importOne(deck)}
                        >
                          {busy === deck.id ? "导入中…" : done ? "已导入" : "导入这科"}
                        </button>
                        <button
                          className="btn small ghost"
                          disabled={imported === 0}
                          onClick={() => onStartSubject(deck.tag)}
                        >
                          刷这科
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
          {index.notice && <p className="muted small">{index.notice}</p>}
        </div>
      )}
      {deckError && (
        <div className="card">
          <p className="muted small">内置题库清单没加载出来：{deckError}。手动导入 JSON 仍然可用。</p>
        </div>
      )}
      <div className="card">
        <h2>题库（{questions.length} 题）</h2>
        <div className="row">
          <button className="btn" onClick={() => void loadSample()}>
            载入 20 道示例题
          </button>
          <button className="btn" onClick={() => void exportJson()}>
            导出 JSON
          </button>
          <button className="btn danger" onClick={() => void clearAll()}>
            清空全部
          </button>
        </div>
      </div>

      <div className="card">
        <h2>导入题库</h2>
        <div className="row tight" style={{ marginBottom: 8 }}>
          <button className={`btn small ${format === "json" ? "primary" : "ghost"}`} onClick={() => setFormat("json")}>
            JSON
          </button>
          <button className={`btn small ${format === "csv" ? "primary" : "ghost"}`} onClick={() => setFormat("csv")}>
            CSV
          </button>
          <label className="btn small ghost" style={{ display: "inline-flex", alignItems: "center" }}>
            选择文件
            <input
              type="file"
              accept=".json,.csv,text/plain"
              style={{ display: "none" }}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setText(await file.text());
                setFormat(file.name.endsWith(".csv") ? "csv" : "json");
              }}
            />
          </label>
        </div>
        <textarea
          className="textarea"
          placeholder={
            format === "json"
              ? '[{"type":"single","stem":"题干","options":["A","B"],"answer":["0"],"explanation":"解析","tags":["章节"]}]'
              : "题干,选项A,选项B,选项C,选项D,答案(0 起),解析,标签\n或：正面,背面,标签"
          }
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={() => void importText()} disabled={!text.trim()}>
            导入
          </button>
          <span className="muted small" style={{ alignSelf: "center" }}>
            按题干自动去重；同 id 的题内容有更新会自动覆盖，复习进度不受影响
          </span>
        </div>
        {message && <p className="small" style={{ color: "var(--accent)" }}>{message}</p>}
      </div>

      <div className="card">
        <h2>题目列表</h2>
        <input
          className="input"
          style={{ width: "100%", marginBottom: 8 }}
          placeholder="按标签或题干搜索，如：生理学"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        {shown.slice(0, 60).map((q) => (
          <div className="list-item" key={q.id}>
            <div className="grow">
                <div>
                  <MathText text={q.stem} />
                </div>
              <div className="row tight" style={{ marginTop: 6 }}>
                <span className={`tag type-tag${q.type === "multi" ? " highlight" : ""}`}>{typeLabel(q.type)}</span>
                {q.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {q.answer.length > 0 ? `答案：${q.answer.join(" / ").slice(0, 60)}` : "【无答案】源站没有收录这道题的答案"}
              </div>
            </div>
            <button className="btn small danger" onClick={() => void removeOne(q.id)}>
              删除
            </button>
          </div>
        ))}
        {shown.length > 60 && <p className="muted small">仅显示前 60 条，用搜索缩小范围。</p>}
      </div>
    </div>
  );
}
