/**
 * Reines SVG-Balkendiagramm (Server Component, kein Chart-Framework).
 * Null-Werte (Zellen unter n = 5) werden bewusst NICHT als 0 gezeichnet,
 * sondern als „–" markiert.
 */

export interface ChartSeries {
  label: string;
  /** CSS-Farbtoken, z. B. "var(--color-fichte)" – nie hartkodierte Farben. */
  color: string;
  values: (number | null)[];
}

const BAR_WIDTH = 14;
const BAR_GAP = 3;
const GROUP_GAP = 16;
const CHART_HEIGHT = 140;
const TOP_PAD = 10;
const LABEL_HEIGHT = 24;

export function BarChart({
  weekLabels,
  series,
  ariaLabel,
}: {
  weekLabels: string[];
  series: ChartSeries[];
  ariaLabel: string;
}) {
  if (weekLabels.length === 0) {
    return <p className="table-empty">Noch keine Daten für diesen Zeitraum vorhanden.</p>;
  }

  const groupWidth = series.length * BAR_WIDTH + (series.length - 1) * BAR_GAP;
  const width = weekLabels.length * (groupWidth + GROUP_GAP) + GROUP_GAP;
  const height = TOP_PAD + CHART_HEIGHT + LABEL_HEIGHT;
  const max = Math.max(
    1,
    ...series.flatMap((s) => s.values.filter((value): value is number => value !== null)),
  );
  const baseline = TOP_PAD + CHART_HEIGHT;

  return (
    <svg
      className="bar-chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      <line x1={0} y1={baseline + 0.5} x2={width} y2={baseline + 0.5} stroke="var(--color-border)" />
      {weekLabels.map((label, weekIndex) => {
        const groupX = GROUP_GAP + weekIndex * (groupWidth + GROUP_GAP);
        return (
          <g key={label}>
            {series.map((s, seriesIndex) => {
              const x = groupX + seriesIndex * (BAR_WIDTH + BAR_GAP);
              const value = s.values[weekIndex] ?? null;
              if (value === null) {
                return (
                  <text
                    key={s.label}
                    x={x + BAR_WIDTH / 2}
                    y={baseline - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--color-muted)"
                  >
                    –<title>{`${s.label}, Woche ab ${label}: – (Zelle unter 5)`}</title>
                  </text>
                );
              }
              const barHeight = value > 0 ? Math.max(2, Math.round((value / max) * CHART_HEIGHT)) : 0;
              return (
                <rect
                  key={s.label}
                  x={x}
                  y={baseline - barHeight}
                  width={BAR_WIDTH}
                  height={barHeight}
                  rx={2}
                  fill={s.color}
                >
                  <title>{`${s.label}, Woche ab ${label}: ${value.toLocaleString("de-DE")}`}</title>
                </rect>
              );
            })}
            <text
              x={groupX + groupWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-muted)"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <p className="chart-legend">
      {series.map((s) => (
        <span key={s.label} className="chart-legend-item">
          <span className="legend-swatch" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </span>
      ))}
    </p>
  );
}
