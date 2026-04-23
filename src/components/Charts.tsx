import type { CycleAnalysis, Reading, ScoreComparison } from "../domain/glucoseAnalysis";
import { downsampleReadings, THRESHOLDS } from "../domain/glucoseAnalysis";
import { formatNumber, formatShortDate } from "../domain/reportFormat";

type TrendChartProps = {
  cycles: Array<{
    cycle: CycleAnalysis;
    readings: Reading[];
  }>;
};

type BarMetric = {
  label: string;
  values: Array<{
    cycleName: string;
    value: number;
  }>;
};

const chartColors = ["#2563eb", "#db2777", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#dc2626", "#475569"];

function clampLabel(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

export function TrendChart({ cycles }: TrendChartProps) {
  const width = 980;
  const height = 340;
  const padding = { top: 28, right: 26, bottom: 48, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const series = cycles.map((item, index) => ({
    label: item.cycle.name,
    color: chartColors[index % chartColors.length],
    points: downsampleReadings(item.readings),
  }));
  const allPoints = series.flatMap((item) => item.points);
  const minX = Math.min(...allPoints.map((point) => point.time.getTime()));
  const maxX = Math.max(...allPoints.map((point) => point.time.getTime()));
  const rawMinY = Math.min(...allPoints.map((point) => point.glucose), THRESHOLDS.hypo);
  const rawMaxY = Math.max(...allPoints.map((point) => point.glucose), THRESHOLDS.targetHigh);
  const minY = Math.floor((rawMinY - 0.3) * 2) / 2;
  const maxY = Math.ceil((rawMaxY + 0.3) * 2) / 2;
  const xScale = (value: number) => padding.left + ((value - minX) / Math.max(maxX - minX, 1)) * plotWidth;
  const yScale = (value: number) => padding.top + plotHeight - ((value - minY) / Math.max(maxY - minY, 0.1)) * plotHeight;
  const yTicks = Array.from({ length: Math.floor(maxY - minY) + 1 }, (_, index) => Number((minY + index).toFixed(1)));
  const targetTop = yScale(THRESHOLDS.targetHigh);
  const targetHeight = yScale(THRESHOLDS.hypo) - yScale(THRESHOLDS.targetHigh);

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="全周期血糖走势">
      <rect width={width} height={height} fill="#ffffff" />
      <rect x={padding.left} y={targetTop} width={plotWidth} height={targetHeight} fill="#e8f6ef" />
      {yTicks.map((tick) => {
        const y = yScale(tick);
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#d7dde7" />
            <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#667085">
              {tick.toFixed(1)}
            </text>
          </g>
        );
      })}
      <line x1={padding.left} y1={padding.top + plotHeight} x2={width - padding.right} y2={padding.top + plotHeight} stroke="#7d8798" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} stroke="#7d8798" />
      {series.map((item) => {
        const d = item.points
          .map((point, index) => {
            const command = index === 0 ? "M" : "L";
            return `${command}${xScale(point.time.getTime()).toFixed(2)},${yScale(point.glucose).toFixed(2)}`;
          })
          .join(" ");
        return <path key={item.label} d={d} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />;
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const date = new Date(minX + ratio * (maxX - minX));
        const x = padding.left + ratio * plotWidth;
        return (
          <text key={ratio} x={x} y={height - 18} textAnchor="middle" fontSize="12" fill="#667085">
            {date.toISOString().slice(5, 16).replace("T", " ")}
          </text>
        );
      })}
      {series.map((item, index) => (
        <g key={item.label} transform={`translate(${padding.left + (index % 4) * 220}, ${8 + Math.floor(index / 4) * 20})`}>
          <rect width="14" height="14" rx="3" fill={item.color} />
          <text x="22" y="12" fontSize="13" fill="#243044">
            {item.label}
          </text>
        </g>
      ))}
      <text x="18" y={height / 2} textAnchor="middle" fontSize="12" fill="#667085" transform={`rotate(-90 18 ${height / 2})`}>
        血糖 mmol/L
      </text>
    </svg>
  );
}

function MetricBarChart({
  title,
  cycles,
  metrics,
  percent,
}: {
  title: string;
  cycles: CycleAnalysis[];
  metrics: BarMetric[];
  percent: boolean;
}) {
  const width = 620;
  const height = 340;
  const padding = { top: 42, right: 22, bottom: 86, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...metrics.flatMap((metric) => metric.values.map((item) => item.value)), 1);
  const yMax = percent ? Math.max(100, Math.ceil(maxValue / 5) * 5) : Math.ceil(maxValue * 1.15);
  const yScale = (value: number) => padding.top + plotHeight - (value / Math.max(yMax, 0.0001)) * plotHeight;
  const groupWidth = plotWidth / metrics.length;
  const barWidth = Math.min(18, (groupWidth * 0.72) / Math.max(cycles.length, 1));
  const tickStep = percent ? 20 : Math.max(1, Math.ceil(yMax / 5));
  const ticks = Array.from({ length: Math.floor(yMax / tickStep) + 1 }, (_, index) => index * tickStep);

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      <rect width={width} height={height} fill="#ffffff" />
      {ticks.map((tick) => {
        const y = yScale(tick);
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#d7dde7" />
            <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#667085">
              {tick}
              {percent ? "%" : ""}
            </text>
          </g>
        );
      })}
      <line x1={padding.left} y1={padding.top + plotHeight} x2={width - padding.right} y2={padding.top + plotHeight} stroke="#7d8798" />
      {metrics.map((metric, index) => {
        const center = padding.left + groupWidth * index + groupWidth / 2;
        const startX = center - (barWidth * metric.values.length + 4 * (metric.values.length - 1)) / 2;
        return (
          <g key={metric.label}>
            {metric.values.map((item, valueIndex) => {
              const x = startX + valueIndex * (barWidth + 4);
              const y = yScale(item.value);
              return (
                <g key={item.cycleName}>
                  <rect x={x} y={y} width={barWidth} height={padding.top + plotHeight - y} fill={chartColors[valueIndex % chartColors.length]} rx="4" />
                  <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="10" fill="#243044">
                    {formatNumber(item.value, 1)}
                  </text>
                </g>
              );
            })}
            <text x={center} y={height - 40} textAnchor="middle" fontSize="12" fill="#344054" transform={`rotate(-24 ${center} ${height - 40})`}>
              {clampLabel(metric.label)}
            </text>
          </g>
        );
      })}
      {cycles.map((cycle, index) => (
        <g key={cycle.name} transform={`translate(${padding.left + (index % 3) * 180}, ${12 + Math.floor(index / 3) * 18})`}>
          <rect width="14" height="14" rx="3" fill={chartColors[index % chartColors.length]} />
          <text x="22" y="12" fontSize="13" fill="#243044">
            {cycle.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

function metricValues(cycles: CycleAnalysis[], key: keyof CycleAnalysis): BarMetric["values"] {
  return cycles.map((cycle) => ({
    cycleName: cycle.name,
    value: Number(cycle[key]),
  }));
}

export function CoreMetricChart({ cycles }: { cycles: CycleAnalysis[] }) {
  return (
    <MetricBarChart
      title="核心指标对比"
      cycles={cycles}
      percent
      metrics={[
        { label: "TIR 3.9-7.8", values: metricValues(cycles, "tir3_9To7_8Pct") },
        { label: "TBR <3.9", values: metricValues(cycles, "tbrBelow3_9Pct") },
        { label: "TAR >7.8", values: metricValues(cycles, "tarAbove7_8Pct") },
        { label: "CV", values: metricValues(cycles, "cvPct") },
        { label: "夜间CV", values: metricValues(cycles, "nightCvPct") },
        { label: "日间CV", values: metricValues(cycles, "dayCvPct") },
      ]}
    />
  );
}

export function DailyMetricChart({ cycles }: { cycles: CycleAnalysis[] }) {
  return (
    <MetricBarChart
      title="每日稳定性"
      cycles={cycles}
      percent
      metrics={[
        { label: "每日TIR均值", values: metricValues(cycles, "dailyTirMean") },
        { label: "每日TIR波动SD", values: metricValues(cycles, "dailyTirSd") },
        { label: "无低血糖天数%", values: metricValues(cycles, "daysWithoutLowPct") },
        { label: "无高血糖天数%", values: metricValues(cycles, "daysWithoutHighPct") },
      ]}
    />
  );
}

export function ScoreBars({ comparisons }: { comparisons: ScoreComparison[] }) {
  const maxScore = Math.max(...comparisons.flatMap((item) => item.values.map((value) => value.score)), 1);
  return (
    <div className="score-bars">
      {comparisons.map((item) => (
        <div className="score-bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="score-track" aria-hidden="true">
            {item.values.map((value, index) => (
              <i
                className="score-fill"
                key={`${item.label}-${value.cycleName}`}
                style={{
                  width: `${(value.score / maxScore) * 100}%`,
                  background: chartColors[index % chartColors.length],
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DailyRangeStrip({ cycles }: { cycles: CycleAnalysis[] }) {
  const days = cycles.flatMap((cycle) => cycle.dailySummaries);
  const min = Math.min(...days.map((day) => day.min));
  const max = Math.max(...days.map((day) => day.max));
  const scale = (value: number) => ((value - min) / Math.max(max - min, 0.1)) * 100;

  return (
    <div className="daily-strip">
      {cycles.map((cycle, cycleIndex) => (
        <div key={cycle.name} className="daily-strip-group">
          <strong>{cycle.name}</strong>
          <div className="daily-days">
            {cycle.dailySummaries.map((day) => (
              <div className="daily-day" key={`${cycle.name}-${day.day}`} title={`${formatShortDate(new Date(day.day))}: ${formatNumber(day.min, 1)}-${formatNumber(day.max, 1)} mmol/L`}>
                <span
                  style={{
                    left: `${scale(day.min)}%`,
                    width: `${Math.max(scale(day.max) - scale(day.min), 2)}%`,
                    background: chartColors[cycleIndex % chartColors.length],
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
