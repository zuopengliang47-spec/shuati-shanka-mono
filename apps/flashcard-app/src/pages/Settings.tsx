import { db } from "../db";
import type { AppSettings } from "../types";
import { useDeckIndex } from "../decks";

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => Promise<void>;
  onChangeData: () => void;
}

export default function Settings({ settings, onChange, onChangeData }: Props) {
  const { index } = useDeckIndex();

  async function resetProgress() {
    if (!confirm("重置所有复习进度与日志？题库会保留。")) return;
    await Promise.all([db.states.clear(), db.logs.clear(), db.settings.delete("streak")]);
    onChangeData();
  }

  return (
    <div>
      <div className="card">
        <h2>每日配额</h2>
        <div className="list-item">
          <span className="grow">每天新题上限</span>
          <input
            className="input"
            type="number"
            min={0}
            max={500}
            value={settings.newPerDay}
            onChange={(event) => void onChange({ newPerDay: Math.max(0, Number(event.target.value) || 0) })}
          />
        </div>
        <div className="list-item">
          <span className="grow">单次复习上限</span>
          <input
            className="input"
            type="number"
            min={1}
            max={2000}
            value={settings.reviewLimit}
            onChange={(event) => void onChange({ reviewLimit: Math.max(1, Number(event.target.value) || 1) })}
          />
        </div>
        <p className="muted small">新题按顺序进入记忆曲线；复习上限用于防止堆积的到期卡片一次性刷爆。</p>
      </div>

      <div className="card">
        <h2>默认复习模式</h2>
        <div className="row">
          <button
            className={`btn ${settings.mode === "flash" ? "primary" : "ghost"}`}
            onClick={() => void onChange({ mode: "flash" })}
          >
            闪卡
          </button>
          <button
            className={`btn ${settings.mode === "quiz" ? "primary" : "ghost"}`}
            onClick={() => void onChange({ mode: "quiz" })}
          >
            刷题
          </button>
        </div>
      </div>

      <div className="card">
        <h2>复习范围</h2>
        <p className="muted small">
          选定之后，「今日」和「复习」只统计、只推送这一科的题。想换科随时切回来，记忆曲线各自保留。
        </p>
        <select
          className="input select"
          value={settings.tagFilter}
          onChange={(event) => void onChange({ tagFilter: event.target.value })}
        >
          <option value="">全部科目（{index?.total ?? "…"} 题）</option>
          {(index?.decks ?? []).map((deck) => (
            <option key={deck.id} value={deck.tag}>
              {deck.code} {deck.name}（{deck.count} 题）
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <h2>数据</h2>
        <p className="muted small">所有题库、进度、日志都存在本机浏览器的 IndexedDB 里，不上传任何服务器。</p>
        <button className="btn danger" onClick={() => void resetProgress()}>
          重置复习进度
        </button>
      </div>

      <div className="card">
        <h2>关于</h2>
        <p className="muted small">
          闪卡刷题 v{__APP_VERSION__}，内置题库 {index?.total ?? "…"} 题（{index?.decks.length ?? "…"} 套），
          断网也能刷；装新版本直接覆盖安装即可，学习记录存在本机，不会丢。
        </p>
      </div>
    </div>
  );
}
