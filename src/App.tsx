import { useMemo, useState } from "react";
import "./App.css";
import { CoreMetricChart, DailyMetricChart, DailyRangeStrip, ScoreBars, TrendChart } from "./components/Charts";
import { analyseCycle, buildKeyTakeaways, buildScorecard, describeRule, labelCycle } from "./domain/glucoseAnalysis";
import type { CycleAnalysis, Reading, Scorecard } from "./domain/glucoseAnalysis";
import { loadReadingsFromExcel } from "./domain/excel";
import { formatDateTime, formatNumber, formatPct, formatValue, glossaryItems } from "./domain/reportFormat";

type ReportState = {
  readingsA: Reading[];
  readingsB: Reading[];
  cycleA: CycleAnalysis;
  cycleB: CycleAnalysis;
  scorecard: Scorecard;
  generatedAt: Date;
};

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

function KeyMetricTable({ a, b }: { a: CycleAnalysis; b: CycleAnalysis }) {
  const rows = [
    ["样本数", String(a.sampleCount), String(b.sampleCount)],
    ["平均血糖", formatValue(a.meanGlucose, "mmol/L"), formatValue(b.meanGlucose, "mmol/L")],
    ["中位数", formatValue(a.medianGlucose, "mmol/L"), formatValue(b.medianGlucose, "mmol/L")],
    ["最小 / 最大", `${formatValue(a.minGlucose)} / ${formatValue(a.maxGlucose)}`, `${formatValue(b.minGlucose)} / ${formatValue(b.maxGlucose)}`],
    ["P10 / P90", `${formatValue(a.p10)} / ${formatValue(a.p90)}`, `${formatValue(b.p10)} / ${formatValue(b.p90)}`],
    ["CV", formatValue(a.cvPct, "%"), formatValue(b.cvPct, "%")],
    ["估算 GMI / A1c", formatValue(a.gmi, "%"), formatValue(b.gmi, "%")],
    ["TIR 3.9-7.8", formatValue(a.tir3_9To7_8Pct, "%"), formatValue(b.tir3_9To7_8Pct, "%")],
    ["TBR <3.9", formatValue(a.tbrBelow3_9Pct, "%"), formatValue(b.tbrBelow3_9Pct, "%")],
    ["TAR >7.8", formatValue(a.tarAbove7_8Pct, "%"), formatValue(b.tarAbove7_8Pct, "%")],
    ["低血糖分钟数", formatValue(a.lowMinutes, "min"), formatValue(b.lowMinutes, "min")],
    ["高血糖分钟数", formatValue(a.highMinutes, "min"), formatValue(b.highMinutes, "min")],
    ["夜间平均血糖", formatValue(a.nightMean, "mmol/L"), formatValue(b.nightMean, "mmol/L")],
    ["每日 TIR 均值", formatValue(a.dailyTirMean, "%"), formatValue(b.dailyTirMean, "%")],
  ];

  return (
    <table>
      <thead>
        <tr>
          <th>指标</th>
          <th>{a.name}</th>
          <th>{b.name}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            <td>{row[0]}</td>
            <td>{row[1]}</td>
            <td>{row[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScoreTable({ a, b, scorecard }: { a: CycleAnalysis; b: CycleAnalysis; scorecard: Scorecard }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>维度</th>
            <th>判分规则</th>
            <th>权重</th>
            <th>胜者</th>
            <th>{a.name}</th>
            <th>{b.name}</th>
            <th>{a.name}得分</th>
            <th>{b.name}得分</th>
          </tr>
        </thead>
        <tbody>
          {scorecard.comparisons.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{describeRule(item)}</td>
              <td>{item.weight}</td>
              <td>{item.winner}</td>
              <td>{formatValue(item.aValue, item.unit)}</td>
              <td>{formatValue(item.bValue, item.unit)}</td>
              <td>{formatNumber(item.aScore, 1)}</td>
              <td>{formatNumber(item.bScore, 1)}</td>
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
            <td>-</td>
            <td>
              <strong>{formatNumber(scorecard.scoreA, 1)}</strong>
            </td>
            <td>
              <strong>{formatNumber(scorecard.scoreB, 1)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Report({ report }: { report: ReportState }) {
  const { readingsA, readingsB, cycleA, cycleB, scorecard, generatedAt } = report;
  const takeaways = useMemo(() => buildKeyTakeaways(cycleA, cycleB, scorecard), [cycleA, cycleB, scorecard]);

  return (
    <>
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">CGM cycle comparison</p>
          <h1>血糖 Cycle 对比报告</h1>
          <p>
            基于两段连续 CGM 数据，从达标时间、低血糖风险、高血糖暴露、波动性、昼夜表现和每日稳定性做综合判断。
          </p>
        </div>
        <div className="hero-stats" aria-label="报告摘要">
          <MetricCard label="综合更优" value={scorecard.overallWinner === "难分伯仲" ? "整体接近" : scorecard.overallWinner} tone="green" />
          <MetricCard label="TIR 3.9-7.8" value={`${formatPct(cycleA.tir3_9To7_8Pct)} vs ${formatPct(cycleB.tir3_9To7_8Pct)}`} tone="blue" />
          <MetricCard label="TBR <3.9" value={`${formatPct(cycleA.tbrBelow3_9Pct)} vs ${formatPct(cycleB.tbrBelow3_9Pct)}`} tone="pink" />
          <MetricCard label="CV" value={`${formatPct(cycleA.cvPct)} vs ${formatPct(cycleB.cvPct)}`} />
        </div>
      </section>

      <section className="meta-band">
        <div>
          <span>生成时间</span>
          <strong>{formatDateTime(generatedAt)}</strong>
        </div>
        <div>
          <span>Cycle A</span>
          <strong>{cycleA.name}</strong>
        </div>
        <div>
          <span>Cycle B</span>
          <strong>{cycleB.name}</strong>
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
        <TrendChart a={cycleA} b={cycleB} readingsA={readingsA} readingsB={readingsB} />
      </section>

      <section className="chart-grid">
        <div className="chart-panel">
          <h2>核心指标对比</h2>
          <CoreMetricChart a={cycleA} b={cycleB} />
        </div>
        <div className="chart-panel">
          <h2>每日稳定性</h2>
          <DailyMetricChart a={cycleA} b={cycleB} />
        </div>
      </section>

      <section className="section two-column">
        <div>
          <h2>关键指标</h2>
          <KeyMetricTable a={cycleA} b={cycleB} />
        </div>
        <div>
          <h2>每日范围</h2>
          <DailyRangeStrip a={cycleA} b={cycleB} />
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2>综合评分明细</h2>
            <p>总分 = 各评分项得分相加。每个评分项都按对应公式给两个 cycle 各自计分。</p>
          </div>
          <div className="score-summary">
            <strong>{formatNumber(scorecard.scoreA, 1)}</strong>
            <span>{cycleA.name}</span>
            <strong>{formatNumber(scorecard.scoreB, 1)}</strong>
            <span>{cycleB.name}</span>
          </div>
        </div>
        <ScoreBars comparisons={scorecard.comparisons} />
        <ScoreTable a={cycleA} b={cycleB} scorecard={scorecard} />
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
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [report, setReport] = useState<ReportState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCompare() {
    if (!fileA || !fileB) {
      setError("请先选择两份 Excel 文件。");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [readingsA, readingsB] = await Promise.all([loadReadingsFromExcel(fileA), loadReadingsFromExcel(fileB)]);
      const cycleA = analyseCycle(labelCycle(readingsA, "Cycle A"), readingsA);
      const cycleB = analyseCycle(labelCycle(readingsB, "Cycle B"), readingsB);
      const scorecard = buildScorecard(cycleA, cycleB);
      setReport({
        readingsA,
        readingsB,
        cycleA,
        cycleB,
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
            <h1>上传两段血糖数据，直接生成 cycle 对比</h1>
            <p>文件只在浏览器内解析。请选择包含“血糖”工作表的 Excel 文件，时间列在 B 列，血糖值在 C 列。</p>
          </div>
          <div className="upload-controls">
            <FilePicker label="Cycle A" file={fileA} onChange={setFileA} />
            <FilePicker label="Cycle B" file={fileB} onChange={setFileB} />
            <button type="button" onClick={handleCompare} disabled={isLoading || !fileA || !fileB}>
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
            <p>上传两份 cycle 文件后，这里会显示趋势图、关键指标、综合评分和指标释义。</p>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
