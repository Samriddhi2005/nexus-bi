"use client";

const KEYWORD_SOURCE =
  "SELECT|FROM|WHERE|ORDER\\s+BY|GROUP\\s+BY|AVG|SUM|COUNT|AS|AND|OR|NOT|LIMIT|WITH|DROP|TABLE|DELETE|UPDATE|INSERT";

// Split keeps the captured keywords in the output array. The test regex is
// anchored and non-global on purpose: `.test()` on a /g regex advances
// lastIndex between calls and returns inconsistent results.
const SPLIT_RE = new RegExp(`\\b(${KEYWORD_SOURCE})\\b`, "gi");
const TEST_RE = new RegExp(`^(${KEYWORD_SOURCE})$`, "i");

/**
 * Minimal SQL colouring: keywords take the agent colour so the machine's
 * voice stays visually consistent everywhere SQL appears on the page.
 */
export default function SqlLine({ sql, tone }: { sql: string; tone?: string }) {
  const parts = sql.split(SPLIT_RE);

  return (
    <>
      {parts.map((part, i) =>
        part && TEST_RE.test(part) ? (
          <span key={i} style={{ color: tone ?? "var(--agent)" }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
