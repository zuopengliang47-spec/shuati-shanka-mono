import type { Counts } from "../types";

interface Props {
  counts: Counts;
  mode: "flash" | "quiz";
  streak: number;
  scopeLabel: string;
  newPerDay: number;
  onStart: () => void;
  onGoDeck: () => void;
}

export default function Today({ counts, mode, streak, scopeLabel, newPerDay, onStart, onGoDeck }: Props) {
  const todayTotal = counts.due + Math.min(counts.fresh, newPerDay);
  const empty = counts.total === 0;

  return (
    <div>
      <div className="card">
        <h2>今天要复习</h2>
        <div className="row">
          <div className="stat">
            <b>{counts.due}</b>
            <span>到期卡片</span>
          </div>
          <div className="stat">
            <b>{counts.fresh}</b>
            <span>未学新题</span>
          </div>
          <div className="stat">
            <b>{counts.learned}</b>
            <span>已进入记忆曲线</span>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          复习范围：{scopeLabel}　·　{mode === "flash" ? "闪卡（先想答案再看）" : "刷题（选项作答自动判分）"}　·　连续打卡 {streak} 天
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary grow" onClick={onStart} disabled={empty}>
            {empty ? "先导入题库" : `开始复习（约 ${todayTotal} 张）`}
          </button>
          <button className="btn" onClick={onGoDeck}>
            {scopeLabel === "全部题目" ? "题库" : "换科目"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>它是怎么安排复习的</h2>
        <ul className="muted small" style={{ paddingLeft: 18, lineHeight: 1.9, margin: 0 }}>
          <li>每道题都有一条独立的记忆曲线，答完就更新下次到期时间。</li>
          <li>「忘记」的卡片会在几分钟内重新出现，直到你答对为止。</li>
          <li>每天只推当天到期的题 + 配额内的新题，不做无意义的顺序刷题。</li>
          <li>「题库」里可以按科目导入、按科目聚焦复习，一次只推一科的题。</li>
          <li>全部数据存在你自己的浏览器里（IndexedDB），断网也能用。</li>
        </ul>
      </div>
    </div>
  );
}
