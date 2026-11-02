import { useCallback, useEffect, useState } from "react";
import Today from "./pages/Today";
import Review from "./pages/Review";
import Deck from "./pages/Deck";
import Stats from "./pages/Stats";
import SettingsPage from "./pages/Settings";
import { db, DEFAULT_SETTINGS, loadSettings, loadStreak, saveSettings } from "./db";
import type { AppSettings, Counts } from "./types";
import { scopedQuestions } from "./scope";
import { useDeckIndex } from "./decks";

type Tab = "today" | "review" | "deck" | "stats" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "review", label: "复习" },
  { key: "deck", label: "题库" },
  { key: "stats", label: "统计" },
  { key: "settings", label: "设置" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [counts, setCounts] = useState<Counts>({ total: 0, learned: 0, due: 0, fresh: 0 });
  const [streak, setStreak] = useState(0);
  const [version, setVersion] = useState(0);
  const { index } = useDeckIndex();

  const refresh = useCallback(async () => {
    const next = await loadSettings();
    setSettings(next);
    const [questions, states] = await Promise.all([db.questions.toArray(), db.states.toArray()]);
    const scope = scopedQuestions(questions, next.tagFilter);
    const scopeIds = new Set(scope.map((q) => q.id));
    const scopedStates = states.filter((s) => scopeIds.has(s.questionId));
    const now = Date.now();
    setCounts({
      total: scope.length,
      learned: scopedStates.length,
      due: scopedStates.filter((s) => s.due <= now).length,
      fresh: Math.max(0, scope.length - scopedStates.length),
    });
    setStreak((await loadStreak()).streak);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, version, tab]);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveSettings(next);
    },
    [settings]
  );

  /** 「刷这科」：切复习范围 + 直接进复习页 */
  const startSubject = useCallback(
    async (tag: string) => {
      setSettings((prev) => {
        const next = { ...prev, tagFilter: tag };
        void saveSettings(next);
        return next;
      });
      setTab("review");
    },
    []
  );

  const scopeLabel = settings.tagFilter
    ? (() => {
        const deck = index?.decks.find((d) => d.tag === settings.tagFilter);
        return deck ? `${deck.code} ${deck.name}` : settings.tagFilter;
      })()
    : "全部题目";

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          闪卡刷题<small>记忆曲线 · FSRS</small>
        </div>
        <div className="muted small">🔥 连续 {streak} 天</div>
      </div>

      {tab === "today" && (
        <Today
          counts={counts}
          mode={settings.mode}
          streak={streak}
          scopeLabel={scopeLabel}
          newPerDay={settings.newPerDay}
          onStart={() => setTab("review")}
          onGoDeck={() => setTab("deck")}
        />
      )}

      {tab === "review" && (
        <Review
          settings={settings}
          onModeChange={(mode) => void updateSettings({ mode })}
          onExit={() => {
            setVersion((v) => v + 1);
            setTab("today");
          }}
        />
      )}

      {tab === "deck" && (
        <Deck onChange={() => setVersion((v) => v + 1)} onStartSubject={(tag) => void startSubject(tag)} />
      )}
      {tab === "stats" && <Stats />}
      {tab === "settings" && (
        <SettingsPage settings={settings} onChange={updateSettings} onChangeData={() => setVersion((v) => v + 1)} />
      )}

      <nav className="tabs">
        {TABS.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? "active" : ""}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
