import { useMemo } from "react";
import katex from "katex";

/** 匹配 $$...$$（块级）和 $...$（行内），不跨行匹配行内公式，避免把金额当公式 */
const DELIM = /\$\$([\s\S]+?)\$\$|\$([^$\n]{1,400}?)\$/g;

function render(src: string, display: boolean): string {
  try {
    return katex.renderToString(src, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      output: "html",
    });
  } catch {
    return src;
  }
}

/**
 * 把题库里的 LaTeX 公式（$...$ / $$...$$）渲染成真正的数学排版，其余文本原样输出。
 * 公式解析失败时退化为原始文本，不会让页面崩掉。
 */
export default function MathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const out: { math: boolean; value: string; display?: boolean }[] = [];
    let last = 0;
    for (const m of text.matchAll(DELIM)) {
      const start = m.index ?? 0;
      if (start > last) out.push({ math: false, value: text.slice(last, start) });
      out.push({ math: true, value: m[1] ?? m[2] ?? "", display: m[1] !== undefined });
      last = start + m[0].length;
    }
    if (last < text.length) out.push({ math: false, value: text.slice(last) });
    return out;
  }, [text]);

  if (parts.length <= 1 && !parts.some((p) => p.math)) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.math ? (
          <span key={i} className={p.display ? "math-block" : "math-inline"} dangerouslySetInnerHTML={{ __html: render(p.value, !!p.display) }} />
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </span>
  );
}
