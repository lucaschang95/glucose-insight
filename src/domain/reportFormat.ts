export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(digits);
}

export function formatPct(value: number): string {
  return `${formatNumber(value, 2)}%`;
}

export function formatValue(value: number, unit = ""): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (Number.isInteger(value) && unit !== "%") {
    return unit ? `${value} ${unit}` : String(value);
  }
  if (unit === "%") {
    return formatPct(value);
  }
  return unit ? `${formatNumber(value, 2)} ${unit}` : formatNumber(value, 2);
}

export function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function formatShortDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export function buildDateRangeLabel(start: Date, end: Date): string {
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

export const glossaryItems: Array<{ term: string; description: string }> = [
  {
    term: "平均血糖",
    description:
      "整个周期内血糖的平均水平。只看高血糖时，平均值更低通常更理想，但也要结合低血糖一起看。",
  },
  {
    term: "GMI / A1c",
    description: "根据 CGM 平均血糖估算出来的长期血糖水平指标，可以粗略对应糖化血红蛋白趋势。",
  },
  {
    term: "TIR 3.9-7.8",
    description: "Time In Range，血糖落在 3.9 到 7.8 mmol/L 的时间占比。一般越高越好。",
  },
  {
    term: "TIR 3.9-7.0",
    description: "更严格版本的达标时间，占比越高说明血糖控制更紧、更接近理想区间。",
  },
  {
    term: "TBR <3.9 / <3.0",
    description: "Time Below Range，低血糖时间占比。<3.9 代表低血糖，<3.0 代表更严重的低血糖。",
  },
  {
    term: "TAR >7.8 / >10.0",
    description: "Time Above Range，高血糖时间占比。>7.8 反映总体偏高时间，>10.0 反映更明显的高血糖暴露。",
  },
  {
    term: "CV",
    description: "变异系数，等于标准差除以平均血糖，用来衡量波动性。数值越低通常说明越稳定。",
  },
  {
    term: "高血糖负担",
    description: "把每个高于 7.8 的采样点超出的幅度累计起来。它不仅看高血糖出现多久，也看高得有多厉害。",
  },
  {
    term: "低血糖分钟数 / 高血糖分钟数",
    description: "把采样点换算成分钟后的暴露时间，更直观地看一个周期里偏低或偏高持续了多久。",
  },
  {
    term: "夜间平均血糖 / 夜间 CV",
    description: "这里按 00:00-06:00 统计，用来观察夜间是否偏高、偏低，或者是否容易波动。",
  },
  {
    term: "每日 TIR 均值 / 波动",
    description: "先按天计算 TIR，再看这些天的平均值和标准差。均值高代表日常更好，波动低代表每天更稳定。",
  },
  {
    term: "无低血糖天数占比 / 无高血糖天数占比",
    description: "看一个周期里有多少天完全没有出现对应问题，能帮助判断控制是否稳定而不是只看均值。",
  },
];
