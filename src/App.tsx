import { useMemo, useState } from "react";
import "./App.css";
import { CoreMetricChart, DailyMetricChart, DailyRangeStrip, ScoreBars, TrendChart } from "./components/Charts";
import { analyseCycle, buildKeyTakeaways, buildScorecard, describeRule, labelCycle } from "./domain/glucoseAnalysis";
import type { CycleAnalysis, Reading, Scorecard } from "./domain/glucoseAnalysis";
import { loadReadingsFromExcel } from "./domain/excel";
import { formatDateTime, formatNumber, formatPct, formatValue, glossaryItems } from "./domain/reportFormat";

type ReportState = {
  cycles: Array<{
    readings: Reading[];
    cycle: CycleAnalysis;
  }>;
  scorecard: Scorecard;
  generatedAt: Date;
};

type FileSlot = {
  id: string;
  file: File | null;
};

function uniqueCycleName(baseName: string, index: number, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    existingNames.add(baseName);
    return baseName;
  }

  const indexedName = `${baseName} (Cycle ${index + 1})`;
  existingNames.add(indexedName);
  return indexedName;
}

function FilePicker({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="file-picker">
      <span>{label}</span>
      <strong>{file?.name ?? "选择 .xlsx 文件"}</strong>
      <input
        accept=".xlsx,.xls"
        type="file"
        onChange={(event) => onChange(event.target.files?.item(0) ?? null)}
      />
    </label>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "blue" | "pink" | "green" }) {
  return (
    <div className={`metric-card ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function KeyMetricTable({ cycles }: { cycles: CycleAnalysis[] }) {
  const rows = [
    { label: "样本数", value: (cycle: CycleAnalysis) => String(cycle.sampleCount) },
    { label: "平均血糖", value: (cycle: CycleAnalysis) => formatValue(cycle.meanGlucose, "mmol/L") },
    { label: "中位数", value: (cycle: CycleAnalysis) => formatValue(cycle.medianGlucose, "mmol/L") },
    { label: "最小 / 最大", value: (cycle: CycleAnalysis) => `${formatValue(cycle.minGlucose)} / ${formatValue(cycle.maxGlucose)}` },
    { label: "P10 / P90", value: (cycle: CycleAnalysis) => `${formatValue(cycle.p10)} / ${formatValue(cycle.p90)}` },
    { label: "CV", value: (cycle: CycleAnalysis) => formatValue(cycle.cvPct, "%") },
    { label: "估算 GMI / A1c", value: (cycle: CycleAnalysis) => formatValue(cycle.gmi, "%") },
    { label: "TIR 3.9-7.8", value: (cycle: CycleAnalysis) => formatValue(cycle.tir3_9To7_8Pct, "%") },
    { label: "TBR <3.9", value: (cycle: CycleAnalysis) => formatValue(cycle.tbrBelow3_9Pct, "%") },
    { label: "TAR >7.8", value: (cycle: CycleAnalysis) => formatValue(cycle.tarAbove7_8Pct, "%") },
    { label: "低血糖分钟数", value: (cycle: CycleAnalysis) => formatValue(cycle.lowMinutes, "min") },
    { label: "高血糖分钟数", value: (cycle: CycleAnalysis) => formatValue(cycle.highMinutes, "min") },
    { label: "夜间平均血糖", value: (cycle: CycleAnalysis) => formatValue(cycle.nightMean, "mmol/L") },
    { label: "每日 TIR 均值", value: (cycle: CycleAnalysis) => formatValue(cycle.dailyTirMean, "%") },
  ];

  return (
    <table>
      <thead>
        <tr>
          <th>指标</th>
          {cycles.map((cycle) => (
            <th key={cycle.name}>{cycle.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            {cycles.map((cycle) => (
              <td key={`${row.label}-${cycle.name}`}>{row.value(cycle)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScoreTable({ cycles, scorecard }: { cycles: CycleAnalysis[]; scorecard: Scorecard }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>维度</th>
            <th>判分规则</th>
            <th>权重</th>
            <th>胜者</th>
            {cycles.map((cycle) => (
              <th key={`${cycle.name}-value`}>{cycle.name}</th>
            ))}
            {cycles.map((cycle) => (
              <th key={`${cycle.name}-score`}>{cycle.name}得分</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scorecard.comparisons.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{describeRule(item)}</td>
              <td>{item.weight}</td>
              <td>{item.winner}</td>
              {item.values.map((value) => (
                <td key={`${item.label}-${value.cycleName}-value`}>{formatValue(value.value, item.unit)}</td>
              ))}
              {item.values.map((value) => (
                <td key={`${item.label}-${value.cycleName}-score`}>{formatNumber(value.score, 1)}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td>
              <strong>总分</strong>
            </td>
            <td>各项得分求和</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            {cycles.map((cycle) => (
              <td key={`${cycle.name}-empty`}>-</td>
            ))}
            {scorecard.totals.map((total) => (
              <td key={`${total.cycleName}-total`}>
                <strong>{formatNumber(total.score, 1)}</strong>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Report({ report }: { report: ReportState }) {
  const { cycles: reportCycles, scorecard, generatedAt } = report;
  const cycles = reportCycles.map((item) => item.cycle);
  const rankedTotals = [...scorecard.totals].sort((a, b) => b.score - a.score);
  const bestCycle = cycles.find((cycle) => cycle.name === rankedTotals[0]?.cycleName) ?? cycles[0];
  const takeaways = useMemo(() => buildKeyTakeaways(cycles, scorecard), [cycles, scorecard]);

  return (
    <>
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">CGM cycle comparison</p>
          <h1>血糖多 Cycle 对比报告</h1>
          <p>
            基于多段连续 CGM 数据，从达标时间、低血糖风险、高血糖暴露、波动性、昼夜表现和每日稳定性做综合判断。
          </p>
        </div>
        <div className="hero-stats" aria-label="报告摘要">
          <MetricCard label="综合更优" value={scorecard.overallWinner === "难分伯仲" ? "整体接近" : scorecard.overallWinner} tone="green" />
          <MetricCard label="最高得分" value={rankedTotals[0] ? `${formatNumber(rankedTotals[0].score, 1)} / 100` : "-"} tone="blue" />
          <MetricCard label="最佳 TIR" value={bestCycle ? formatPct(bestCycle.tir3_9To7_8Pct) : "-"} tone="pink" />
          <MetricCard label="Cycle 数量" value={String(cycles.length)} />
        </div>
      </section>

      <section className="meta-band">
        <div>
          <span>生成时间</span>
          <strong>{formatDateTime(generatedAt)}</strong>
        </div>
        <div>
          <span>参与 Cycle</span>
          <strong>{cycles.length} 段</strong>
        </div>
        <div>
          <span>综合更优</span>
          <strong>{scorecard.overallWinner === "难分伯仲" ? "整体接近" : scorecard.overallWinner}</strong>
        </div>
        <div>
          <span>采样间隔假设</span>
          <strong>3 分钟/点</strong>
        </div>
      </section>

      <section className="section">
        <h2>一句话结论</h2>
        <div className="takeaways">
          {takeaways.map((takeaway) => (
            <p key={takeaway}>{takeaway}</p>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>全周期血糖走势</h2>
        <TrendChart cycles={reportCycles} />
      </section>

      <section className="chart-grid">
        <div className="chart-panel">
          <h2>核心指标对比</h2>
          <CoreMetricChart cycles={cycles} />
        </div>
        <div className="chart-panel">
          <h2>每日稳定性</h2>
          <DailyMetricChart cycles={cycles} />
        </div>
      </section>

      <section className="section two-column">
        <div>
          <h2>关键指标</h2>
          <div className="table-wrap">
            <KeyMetricTable cycles={cycles} />
          </div>
        </div>
        <div>
          <h2>每日范围</h2>
          <DailyRangeStrip cycles={cycles} />
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2>综合评分明细</h2>
            <p>总分 = 各评分项得分相加。每个评分项都按对应公式给两个 cycle 各自计分。</p>
          </div>
          <div className="score-summary">
            {rankedTotals.map((total) => (
              <div key={total.cycleName}>
                <strong>{formatNumber(total.score, 1)}</strong>
                <span>{total.cycleName}</span>
              </div>
            ))}
          </div>
        </div>
        <ScoreBars comparisons={scorecard.comparisons} />
        <ScoreTable cycles={cycles} scorecard={scorecard} />
      </section>

      <section className="section">
        <h2>指标释义</h2>
        <div className="glossary">
          {glossaryItems.map((item) => (
            <article key={item.term}>
              <strong>{item.term}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

const App = () => {
  const [fileSlots, setFileSlots] = useState<FileSlot[]>([
    { id: crypto.randomUUID(), file: null },
    { id: crypto.randomUUID(), file: null },
  ]);
  const [report, setReport] = useState<ReportState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const selectedFiles = fileSlots.map((slot) => slot.file).filter((file): file is File => file !== null);

  function updateFile(id: string, file: File | null) {
    setFileSlots((slots) => slots.map((slot) => (slot.id === id ? { ...slot, file } : slot)));
  }

  function addCycleSlot() {
    setFileSlots((slots) => [...slots, { id: crypto.randomUUID(), file: null }]);
  }

  function removeCycleSlot(id: string) {
    setFileSlots((slots) => (slots.length <= 2 ? slots : slots.filter((slot) => slot.id !== id)));
  }

  async function handleCompare() {
    if (selectedFiles.length < 2) {
      setError("请至少选择两份 Excel 文件。");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const readingsList = await Promise.all(selectedFiles.map((file) => loadReadingsFromExcel(file)));
      const cycleNames = new Set<string>();
      const cycles = readingsList.map((readings, index) => ({
        readings,
        cycle: analyseCycle(uniqueCycleName(labelCycle(readings, `Cycle ${index + 1}`), index, cycleNames), readings),
      }));
      const scorecard = buildScorecard(cycles.map((item) => item.cycle));
      setReport({
        cycles,
        scorecard,
        generatedAt: new Date(),
      });
    } catch (caught) {
      setReport(null);
      setError(caught instanceof Error ? caught.message : "解析文件时遇到未知错误。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="brand-mark" aria-hidden="true" />
          <strong>Glucose Insight</strong>
        </div>
        <span>Frontend-only CGM report</span>
      </header>

      <main>
        <section className="upload-band">
          <div className="upload-copy">
            <p className="eyebrow">local browser analysis</p>
            <h1>上传多段血糖数据，直接生成 cycle 对比</h1>
            <p>文件只在浏览器内解析。请选择至少两份包含“血糖”工作表的 Excel 文件，时间列在 B 列，血糖值在 C 列。</p>
          </div>
          <div className="upload-controls">
            {fileSlots.map((slot, index) => (
              <div className="file-row" key={slot.id}>
                <FilePicker label={`Cycle ${index + 1}`} file={slot.file} onChange={(file) => updateFile(slot.id, file)} />
                {fileSlots.length > 2 ? (
                  <button className="icon-button" type="button" onClick={() => removeCycleSlot(slot.id)} aria-label={`删除 Cycle ${index + 1}`}>
                    -
                  </button>
                ) : null}
              </div>
            ))}
            <button className="secondary-button" type="button" onClick={addCycleSlot}>
              添加 Cycle
            </button>
            <button type="button" onClick={handleCompare} disabled={isLoading || selectedFiles.length < 2}>
              {isLoading ? "正在分析..." : "生成报告"}
            </button>
          </div>
          {error ? <div className="alert">{error}</div> : null}
        </section>

        {report ? (
          <Report report={report} />
        ) : (
          <section className="empty-state">
            <h2>等待数据</h2>
            <p>上传至少两份 cycle 文件后，这里会显示趋势图、关键指标、综合评分和指标释义。</p>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
