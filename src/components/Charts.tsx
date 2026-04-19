import type { CycleAnalysis, Reading, ScoreComparison } from "../domain/glucoseAnalysis";
import { downsampleReadings, THRESHOLDS } from "../domain/glucoseAnalysis";
import { formatNumber, formatShortDate } from "../domain/reportFormat";

type TrendChartProps = {
  a: CycleAnalysis;
  b: CycleAnalysis;
  readingsA: Reading[];
  readingsB: Reading[];
};

type BarMetric = {
  label: string;
  aValue: number;
  bValue: number;
};

const colorA = "#2563eb";
const colorB = "#db2777";

function clampLabel(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

export function TrendChart({ a, b, readingsA, readingsB }: TrendChartProps) {
  const width = 980;
  const height = 340;
  const padding = { top: 28, right: 26, bottom: 48, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const series = [
    { label: a.name, color: colorA, points: downsampleReadings(readingsA) },
    { label: b.name, color: colorB, points: downsampleReadings(readingsB) },
  ];
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
        <g key={item.label} transform={`translate(${padding.left + index * 220}, 8)`}>
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
  a,
  b,
  metrics,
  percent,
}: {
  title: string;
  a: CycleAnalysis;
  b: CycleAnalysis;
  metrics: BarMetric[];
  percent: boolean;
}) {
  const width = 620;
  const height = 340;
  const padding = { top: 42, right: 22, bottom: 86, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...metrics.flatMap((metric) => [metric.aValue, metric.bValue]), 1);
  const yMax = percent ? Math.max(100, Math.ceil(maxValue / 5) * 5) : Math.ceil(maxValue * 1.15);
  const yScale = (value: number) => padding.top + plotHeight - (value / Math.max(yMax, 0.0001)) * plotHeight;
  const groupWidth = plotWidth / metrics.length;
  const barWidth = Math.min(24, groupWidth * 0.26);
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
        const ax = center - barWidth - 6;
        const bx = center + 6;
        const ay = yScale(metric.aValue);
        const by = yScale(metric.bValue);
        return (
          <g key={metric.label}>
            <rect x={ax} y={ay} width={barWidth} height={padding.top + plotHeight - ay} fill={colorA} rx="4" />
            <rect x={bx} y={by} width={barWidth} height={padding.top + plotHeight - by} fill={colorB} rx="4" />
            <text x={ax + barWidth / 2} y={ay - 8} textAnchor="middle" fontSize="11" fill="#243044">
              {formatNumber(metric.aValue, 1)}
            </text>
            <text x={bx + barWidth / 2} y={by - 8} textAnchor="middle" fontSize="11" fill="#243044">
              {formatNumber(metric.bValue, 1)}
            </text>
            <text x={center} y={height - 40} textAnchor="middle" fontSize="12" fill="#344054" transform={`rotate(-24 ${center} ${height - 40})`}>
              {clampLabel(metric.label)}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${padding.left}, 12)`}>
        <rect width="14" height="14" rx="3" fill={colorA} />
        <text x="22" y="12" fontSize="13" fill="#243044">
          {a.name}
        </text>
        <rect x="210" width="14" height="14" rx="3" fill={colorB} />
        <text x="232" y="12" fontSize="13" fill="#243044">
          {b.name}
        </text>
      </g>
    </svg>
  );
}

export function CoreMetricChart({ a, b }: { a: CycleAnalysis; b: CycleAnalysis }) {
  return (
    <MetricBarChart
      title="核心指标对比"
      a={a}
      b={b}
      percent
      metrics={[
        { label: "TIR 3.9-7.8", aValue: a.tir3_9To7_8Pct, bValue: b.tir3_9To7_8Pct },
        { label: "TBR <3.9", aValue: a.tbrBelow3_9Pct, bValue: b.tbrBelow3_9Pct },
        { label: "TAR >7.8", aValue: a.tarAbove7_8Pct, bValue: b.tarAbove7_8Pct },
        { label: "CV", aValue: a.cvPct, bValue: b.cvPct },
        { label: "夜间CV", aValue: a.nightCvPct, bValue: b.nightCvPct },
        { label: "日间CV", aValue: a.dayCvPct, bValue: b.dayCvPct },
      ]}
    />
  );
}

export function DailyMetricChart({ a, b }: { a: CycleAnalysis; b: CycleAnalysis }) {
  return (
    <MetricBarChart
      title="每日稳定性"
      a={a}
      b={b}
      percent
      metrics={[
        { label: "每日TIR均值", aValue: a.dailyTirMean, bValue: b.dailyTirMean },
        { label: "每日TIR波动SD", aValue: a.dailyTirSd, bValue: b.dailyTirSd },
        { label: "无低血糖天数%", aValue: a.daysWithoutLowPct, bValue: b.daysWithoutLowPct },
        { label: "无高血糖天数%", aValue: a.daysWithoutHighPct, bValue: b.daysWithoutHighPct },
      ]}
    />
  );
}

export function ScoreBars({ comparisons }: { comparisons: ScoreComparison[] }) {
  const maxScore = Math.max(...comparisons.flatMap((item) => [item.aScore, item.bScore]), 1);
  return (
    <div className="score-bars">
      {comparisons.map((item) => (
        <div className="score-bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="score-track" aria-hidden="true">
            <i className="score-fill score-fill-a" style={{ width: `${(item.aScore / maxScore) * 100}%` }} />
            <i className="score-fill score-fill-b" style={{ width: `${(item.bScore / maxScore) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DailyRangeStrip({ a, b }: { a: CycleAnalysis; b: CycleAnalysis }) {
  const days = [a, b].flatMap((cycle) => cycle.dailySummaries);
  const min = Math.min(...days.map((day) => day.min));
  const max = Math.max(...days.map((day) => day.max));
  const scale = (value: number) => ((value - min) / Math.max(max - min, 0.1)) * 100;

  return (
    <div className="daily-strip">
      {[a, b].map((cycle) => (
        <div key={cycle.name} className="daily-strip-group">
          <strong>{cycle.name}</strong>
          <div className="daily-days">
            {cycle.dailySummaries.map((day) => (
              <div className="daily-day" key={`${cycle.name}-${day.day}`} title={`${formatShortDate(new Date(day.day))}: ${formatNumber(day.min, 1)}-${formatNumber(day.max, 1)} mmol/L`}>
                <span style={{ left: `${scale(day.min)}%`, width: `${Math.max(scale(day.max) - scale(day.min), 2)}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
