import * as XLSX from "xlsx";
import type { Reading } from "./glucoseAnalysis";

type SheetCell = string | number | boolean | Date | null | undefined;

function toDate(value: SheetCell, rowNumber: number): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`第 ${rowNumber} 行时间无效`);
    }
    return value;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      throw new Error(`第 ${rowNumber} 行无法解析 Excel 时间序号: ${value}`);
    }
    const date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S));
    if (Number.isNaN(date.getTime())) {
      throw new Error(`第 ${rowNumber} 行时间无效`);
    }
    return date;
  }

  const normalized = String(value ?? "").trim().replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`第 ${rowNumber} 行无法解析时间: ${String(value ?? "")}`);
  }
  return date;
}

function toNumber(value: SheetCell, rowNumber: number): number {
  const num = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`第 ${rowNumber} 行无法解析血糖值: ${String(value ?? "")}`);
  }
  return num;
}

function toId(value: SheetCell): string | number | null {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value == null) {
    return null;
  }
  return String(value);
}

export async function loadReadingsFromExcel(file: File): Promise<Reading[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.Sheets["血糖"];

  if (!sheet) {
    throw new Error(`${file.name} 中没有找到名为“血糖”的工作表`);
  }

  const values = XLSX.utils.sheet_to_json<SheetCell[]>(sheet, { header: 1, raw: true, blankrows: false });
  const rows = values.slice(1).filter((row) => row[1] != null && row[2] != null);

  if (rows.length === 0) {
    throw new Error(`${file.name} 的“血糖”工作表没有可用数据`);
  }

  const readings = rows.map((row, index) => ({
    id: toId(row[0]),
    time: toDate(row[1], index + 2),
    glucose: toNumber(row[2], index + 2),
  }));

  readings.sort((a, b) => a.time.getTime() - b.time.getTime());
  return readings;
}
