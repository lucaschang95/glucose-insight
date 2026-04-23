import { buildDateRangeLabel, formatPct, formatValue } from "./reportFormat";

export const SAMPLE_MINUTES = 3;

export const THRESHOLDS = {
  hypo: 3.9,
  severeHypo: 3.0,
  targetHigh: 7.8,
  veryHigh: 10.0,
  tightHigh: 7.0,
} as const;

export type Reading = {
  id: string | number | null;
  time: Date;
  glucose: number;
};

export type EpisodeSummary = {
  count: number;
  count15m: number;
  totalMinutes: number;
  longestMinutes: number;
  worstPoint: number | null;
};

export type DailySummary = {
  day: string;
  mean: number;
  min: number;
  max: number;
  sd: number;
  tirPct: number;
  hasLow: boolean;
  hasHigh: boolean;
};

export type CycleAnalysis = {
  name: string;
  sampleCount: number;
  start: Date;
  end: Date;
  totalDays: number;
  meanGlucose: number;
  medianGlucose: number;
  minGlucose: number;
  maxGlucose: number;
  p10: number;
  p90: number;
  sd: number;
  cvPct: number;
  gmi: number;
  tir3_9To7_8Pct: number;
  tir3_9To7_0Pct: number;
  tbrBelow3_9Pct: number;
  tbrBelow3_0Pct: number;
  tarAbove7_8Pct: number;
  tarAbove10Pct: number;
  lowBurden: number;
  highBurden: number;
  lowMinutes: number;
  severeLowMinutes: number;
  highMinutes: number;
  veryHighMinutes: number;
  lowEpisodes: EpisodeSummary;
  severeLowEpisodes: EpisodeSummary;
  highEpisodes: EpisodeSummary;
  veryHighEpisodes: EpisodeSummary;
  nightMean: number;
  nightCvPct: number;
  dayMean: number;
  dayCvPct: number;
  dailyMeanSd: number;
  dailyTirMean: number;
  dailyTirSd: number;
  daysWithoutLowPct: number;
  daysWithoutHighPct: number;
  dailySummaries: DailySummary[];
};

export type MetricRule = {
  key: keyof Pick<
    CycleAnalysis,
    "tir3_9To7_8Pct" | "tarAbove10Pct" | "tarAbove7_8Pct" | "cvPct" | "meanGlucose" | "highBurden"
  >;
  label: string;
  better: "higher" | "lower";
  weight: number;
  unit: string;
};

export type ScoreComparison = MetricRule & {
  winner: string;
  values: Array<{
    cycleName: string;
    value: number;
    score: number;
  }>;
};

export type Scorecard = {
  comparisons: ScoreComparison[];
  totals: Array<{
    cycleName: string;
    score: number;
  }>;
  overallWinner: string;
};

type Episode = {
  thresholdLabel: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  nadir: number;
  peak: number;
};

export const METRIC_RULES: MetricRule[] = [
  {
    key: "tir3_9To7_8Pct",
    label: "标准达标时间(3.9-7.8)",
    better: "higher",
    weight: 30,
    unit: "%",
  },
  {
    key: "tarAbove10Pct",
    label: "明显高血糖占比(>10.0)",
    better: "lower",
    weight: 24,
    unit: "%",
  },
  {
    key: "tarAbove7_8Pct",
    label: "高血糖占比(>7.8)",
    better: "lower",
    weight: 16,
    unit: "%",
  },
  {
    key: "cvPct",
    label: "变异系数(CV)",
    better: "lower",
    weight: 16,
    unit: "%",
  },
  {
    key: "meanGlucose",
    label: "平均血糖",
    better: "lower",
    weight: 10,
    unit: "mmol/L",
  },
  {
    key: "highBurden",
    label: "高血糖负担",
    better: "lower",
    weight: 4,
    unit: "mmol/L*sample",
  },
];

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function standardDeviation(values: number[], avg = mean(values)): number {
  if (values.length === 0) {
    return 0;
  }
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const ratio = index - lower;
  return sorted[lower] * (1 - ratio) + sorted[upper] * ratio;
}

function minutesBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60000;
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

function cv(values: number[]): number {
  const avg = mean(values);
  return avg === 0 ? 0 : (standardDeviation(values, avg) / avg) * 100;
}

function isNight(date: Date): boolean {
  const hour = date.getHours();
  return hour < 6;
}

function buildEpisodes(readings: Reading[], predicate: (value: number) => boolean, thresholdLabel: string): Episode[] {
  const episodes: Episode[] = [];
  let startIndex: number | null = null;

  const closeEpisode = (endIndex: number) => {
    if (startIndex === null) {
      return;
    }
    const items = readings.slice(startIndex, endIndex + 1);
    episodes.push({
      thresholdLabel,
      start: readings[startIndex].time,
      end: readings[endIndex].time,
      durationMinutes: items.length * SAMPLE_MINUTES,
      nadir: Math.min(...items.map((item) => item.glucose)),
      peak: Math.max(...items.map((item) => item.glucose)),
    });
    startIndex = null;
  };

  for (let i = 0; i < readings.length; i += 1) {
    if (predicate(readings[i].glucose)) {
      if (startIndex === null) {
        startIndex = i;
      }
      continue;
    }
    closeEpisode(i - 1);
  }

  closeEpisode(readings.length - 1);
  return episodes;
}

function summariseEpisodes(episodes: Episode[], kind: "low" | "high" = "low"): EpisodeSummary {
  const longEpisodes = episodes.filter((episode) => episode.durationMinutes >= 15);
  const totalMinutes = episodes.reduce((sum, episode) => sum + episode.durationMinutes, 0);
  const longest = episodes.reduce((max, episode) => Math.max(max, episode.durationMinutes), 0);
  const worstPoint =
    episodes.length === 0
      ? null
      : kind === "low"
        ? Math.min(...episodes.map((episode) => episode.nadir))
        : Math.max(...episodes.map((episode) => episode.peak));

  return {
    count: episodes.length,
    count15m: longEpisodes.length,
    totalMinutes,
    longestMinutes: longest,
    worstPoint,
  };
}

function groupByDay(readings: Reading[]): Map<string, Reading[]> {
  const map = new Map<string, Reading[]>();
  for (const reading of readings) {
    const day = reading.time.toISOString().slice(0, 10);
    const bucket = map.get(day) ?? [];
    bucket.push(reading);
    map.set(day, bucket);
  }
  return map;
}

export function analyseCycle(name: string, readings: Reading[]): CycleAnalysis {
  if (readings.length === 0) {
    throw new Error(`${name} 没有可用数据`);
  }

  const glucoseValues = readings.map((item) => item.glucose);
  const avg = mean(glucoseValues);
  const sd = standardDeviation(glucoseValues, avg);
  const start = readings[0].time;
  const end = readings[readings.length - 1].time;

  let below39Count = 0;
  let below30Count = 0;
  let inRangeCount = 0;
  let inTightRangeCount = 0;
  let above78Count = 0;
  let above100Count = 0;
  let lowBurden = 0;
  let highBurden = 0;

  const nightValues: number[] = [];
  const dayValues: number[] = [];

  for (const reading of readings) {
    const value = reading.glucose;
    if (value < THRESHOLDS.hypo) {
      below39Count += 1;
      lowBurden += THRESHOLDS.hypo - value;
    }
    if (value < THRESHOLDS.severeHypo) {
      below30Count += 1;
    }
    if (value >= THRESHOLDS.hypo && value <= THRESHOLDS.targetHigh) {
      inRangeCount += 1;
    }
    if (value >= THRESHOLDS.hypo && value <= THRESHOLDS.tightHigh) {
      inTightRangeCount += 1;
    }
    if (value > THRESHOLDS.targetHigh) {
      above78Count += 1;
      highBurden += value - THRESHOLDS.targetHigh;
    }
    if (value > THRESHOLDS.veryHigh) {
      above100Count += 1;
    }
    if (isNight(reading.time)) {
      nightValues.push(value);
    } else {
      dayValues.push(value);
    }
  }

  const lowEpisodes = buildEpisodes(readings, (value) => value < THRESHOLDS.hypo, "<3.9");
  const severeLowEpisodes = buildEpisodes(readings, (value) => value < THRESHOLDS.severeHypo, "<3.0");
  const highEpisodes = buildEpisodes(readings, (value) => value > THRESHOLDS.targetHigh, ">7.8");
  const veryHighEpisodes = buildEpisodes(readings, (value) => value > THRESHOLDS.veryHigh, ">10.0");

  const dailySummaries = [...groupByDay(readings).entries()].map(([day, items]) => {
    const vals = items.map((item) => item.glucose);
    const lows = vals.filter((value) => value < THRESHOLDS.hypo).length;
    const highs = vals.filter((value) => value > THRESHOLDS.targetHigh).length;
    return {
      day,
      mean: mean(vals),
      min: Math.min(...vals),
      max: Math.max(...vals),
      sd: standardDeviation(vals),
      tirPct: pct(
        vals.filter((value) => value >= THRESHOLDS.hypo && value <= THRESHOLDS.targetHigh).length,
        vals.length,
      ),
      hasLow: lows > 0,
      hasHigh: highs > 0,
    };
  });

  const dailyMeans = dailySummaries.map((item) => item.mean);
  const dailyTir = dailySummaries.map((item) => item.tirPct);

  return {
    name,
    sampleCount: readings.length,
    start,
    end,
    totalDays: minutesBetween(start, end) / 1440,
    meanGlucose: avg,
    medianGlucose: median(glucoseValues),
    minGlucose: Math.min(...glucoseValues),
    maxGlucose: Math.max(...glucoseValues),
    p10: percentile(glucoseValues, 0.1),
    p90: percentile(glucoseValues, 0.9),
    sd,
    cvPct: avg === 0 ? 0 : (sd / avg) * 100,
    gmi: 3.31 + 0.43056 * avg,
    tir3_9To7_8Pct: pct(inRangeCount, readings.length),
    tir3_9To7_0Pct: pct(inTightRangeCount, readings.length),
    tbrBelow3_9Pct: pct(below39Count, readings.length),
    tbrBelow3_0Pct: pct(below30Count, readings.length),
    tarAbove7_8Pct: pct(above78Count, readings.length),
    tarAbove10Pct: pct(above100Count, readings.length),
    lowBurden,
    highBurden,
    lowMinutes: below39Count * SAMPLE_MINUTES,
    severeLowMinutes: below30Count * SAMPLE_MINUTES,
    highMinutes: above78Count * SAMPLE_MINUTES,
    veryHighMinutes: above100Count * SAMPLE_MINUTES,
    lowEpisodes: summariseEpisodes(lowEpisodes, "low"),
    severeLowEpisodes: summariseEpisodes(severeLowEpisodes, "low"),
    highEpisodes: summariseEpisodes(highEpisodes, "high"),
    veryHighEpisodes: summariseEpisodes(veryHighEpisodes, "high"),
    nightMean: mean(nightValues),
    nightCvPct: cv(nightValues),
    dayMean: mean(dayValues),
    dayCvPct: cv(dayValues),
    dailyMeanSd: standardDeviation(dailyMeans),
    dailyTirMean: mean(dailyTir),
    dailyTirSd: standardDeviation(dailyTir),
    daysWithoutLowPct: pct(dailySummaries.filter((item) => !item.hasLow).length, dailySummaries.length),
    daysWithoutHighPct: pct(dailySummaries.filter((item) => !item.hasHigh).length, dailySummaries.length),
    dailySummaries,
  };
}

export function labelCycle(readings: Reading[], fallback: string): string {
  if (readings.length === 0) {
    return fallback;
  }
  return buildDateRangeLabel(readings[0].time, readings[readings.length - 1].time);
}

function winnersForMetric(rule: MetricRule, cycles: CycleAnalysis[]): string {
  const values = cycles.map((cycle) => cycle[rule.key]);
  const best = rule.better === "higher" ? Math.max(...values) : Math.min(...values);
  const winners = cycles.filter((cycle) => cycle[rule.key] === best).map((cycle) => cycle.name);
  return winners.length === cycles.length ? "平" : winners.join("、");
}

export function buildScorecard(cycles: CycleAnalysis[]): Scorecard {
  const comparisons: ScoreComparison[] = METRIC_RULES.map((rule) => {
    const rawValues = cycles.map((cycle) => cycle[rule.key]);
    const values = cycles.map((cycle) => {
      const value = cycle[rule.key];
      let score = 0;

      if (rule.better === "higher") {
        const maxValue = Math.max(...rawValues);
        score = maxValue === 0 ? rule.weight : (value / maxValue) * rule.weight;
      } else {
        const minValue = Math.min(...rawValues);
        if (minValue === 0) {
          score = value === 0 ? rule.weight : 0;
        } else {
          score = (minValue / value) * rule.weight;
        }
      }

      return {
        cycleName: cycle.name,
        value,
        score,
      };
    });

    return {
      ...rule,
      winner: winnersForMetric(rule, cycles),
      values,
    };
  });

  const totals = cycles.map((cycle) => ({
    cycleName: cycle.name,
    score: comparisons.reduce((sum, item) => {
      const value = item.values.find((entry) => entry.cycleName === cycle.name);
      return sum + (value?.score ?? 0);
    }, 0),
  }));

  const bestScore = Math.max(...totals.map((item) => item.score));
  const winners = totals.filter((item) => item.score === bestScore).map((item) => item.cycleName);

  return {
    comparisons,
    totals,
    overallWinner: winners.length === totals.length ? "难分伯仲" : winners.join("、"),
  };
}

export function describeRule(rule: MetricRule): string {
  if (rule.better === "higher") {
    return `${rule.label} 越高越好。该项满分 ${rule.weight} 分，按“本 cycle 数值 / 两者较大值 x 权重”计分。`;
  }
  return `${rule.label} 越低越好。该项满分 ${rule.weight} 分，按“两者较小值 / 本 cycle 数值 x 权重”计分。`;
}

function bestCycle(
  cycles: CycleAnalysis[],
  key: keyof CycleAnalysis,
  better: "higher" | "lower",
  tieLabel = "整体接近",
): string {
  const values = cycles.map((cycle) => Number(cycle[key]));
  const best = better === "higher" ? Math.max(...values) : Math.min(...values);
  const winners = cycles.filter((cycle) => Number(cycle[key]) === best).map((cycle) => cycle.name);
  return winners.length === cycles.length ? tieLabel : winners.join("、");
}

function formatMetricList(cycles: CycleAnalysis[], key: keyof CycleAnalysis, unit = ""): string {
  return cycles.map((cycle) => `${cycle.name}=${formatValue(Number(cycle[key]), unit)}`).join("；");
}

export function buildKeyTakeaways(cycles: CycleAnalysis[], scorecard: Scorecard): string[] {
  const lines: string[] = [];
  const overall =
    scorecard.overallWinner === "难分伯仲"
      ? "综合评分接近，各 cycle 难分伯仲。"
      : `综合评分更优的是 ${scorecard.overallWinner}。`;
  lines.push(overall);

  const hypoWinner = bestCycle(cycles, "tbrBelow3_9Pct", "lower", "接近");
  const rangeWinner = bestCycle(cycles, "tir3_9To7_8Pct", "higher", "接近");
  const stableWinner = bestCycle(cycles, "cvPct", "lower", "接近");

  lines.push(
    `低血糖风险方面：${hypoWinner === "接近" ? "各 cycle 接近" : `${hypoWinner} 更好`}，TBR <3.9 为 ${formatMetricList(
      cycles,
      "tbrBelow3_9Pct",
      "%",
    )}。`,
  );
  lines.push(
    `达标时间方面：${rangeWinner === "接近" ? "各 cycle 接近" : `${rangeWinner} 更好`}，TIR 3.9-7.8 为 ${formatMetricList(
      cycles,
      "tir3_9To7_8Pct",
      "%",
    )}。`,
  );
  lines.push(
    `波动性方面：${stableWinner === "接近" ? "各 cycle 接近" : `${stableWinner} 更稳`}，CV 为 ${formatMetricList(cycles, "cvPct", "%")}。`,
  );

  const biggestGap = [...scorecard.comparisons]
    .map((item) => {
      const values = item.values.map((entry) => entry.value);
      return { ...item, gap: Math.max(...values) - Math.min(...values) };
    })
    .sort((x, y) => y.weight * y.gap - x.weight * x.gap)[0];

  if (biggestGap) {
    lines.push(
      `最拉开差距的指标是“${biggestGap.label}”，${biggestGap.values
        .map((item) => `${item.cycleName}=${formatValue(item.value, biggestGap.unit)}`)
        .join("；")}。`,
    );
  }

  return lines;
}

export function downsampleReadings(readings: Reading[], maxPoints = 260): Reading[] {
  if (readings.length <= maxPoints) {
    return readings;
  }
  const bucketSize = Math.ceil(readings.length / maxPoints);
  const sampled: Reading[] = [];
  for (let i = 0; i < readings.length; i += bucketSize) {
    const bucket = readings.slice(i, i + bucketSize);
    sampled.push({
      id: bucket[Math.floor(bucket.length / 2)].id,
      time: bucket[Math.floor(bucket.length / 2)].time,
      glucose: mean(bucket.map((item) => item.glucose)),
    });
  }
  return sampled;
}
