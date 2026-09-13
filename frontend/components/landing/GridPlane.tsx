"use client";

import { useParallaxLayer } from "@/lib/motion";

// The real bundled dataset (data/Sales_Agent.csv). The background plane is
// made of the product's own material rather than decorative gradient blobs.
const HEADERS = ["month", "year", "sales", "expenses", "profit", "csat"];
const ROWS = [
  ["January", "2024", "120000", "80000", "40000", "85.5"],
  ["February", "2024", "150000", "90000", "60000", "88.0"],
  ["March", "2024", "170000", "95000", "75000", "90.2"],
  ["April", "2024", "160000", "100000", "60000", "87.3"],
  ["May", "2024", "180000", "110000", "70000", "92.1"],
  ["June", "2024", "175000", "105000", "70000", "91.5"],
  ["July", "2024", "200000", "120000", "80000", "93.7"],
];

export default function GridPlane() {
  const ref = useParallaxLayer<HTMLDivElement>(0.15);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ willChange: "transform" }}
    >
      <div className="l-gridlines absolute inset-0 -top-[20vh] h-[160vh]" />

      <div className="absolute top-[14vh] right-[-6vw] hidden opacity-[0.07] lg:block">
        <table className="l-machine text-[13px] leading-[2.6]">
          <thead>
            <tr>
              {HEADERS.map((h) => (
                <th
                  key={h}
                  className="px-6 text-left font-medium tracking-[0.18em] uppercase"
                  style={{ color: "var(--agent)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i} className="px-6 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* An even scrim, not a hard vignette — the animated field behind this
          plane needs to stay legible for the full scroll, not fade out after
          one viewport height. */}
      <div className="absolute inset-0" style={{ background: "var(--ink)", opacity: 0.62 }} />
      <div
        className="absolute inset-x-0 top-0 h-[70vh]"
        style={{
          background: "linear-gradient(to bottom, var(--ink) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
