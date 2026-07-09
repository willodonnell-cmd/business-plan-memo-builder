import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { InvestmentRequest, InvestmentWorkbookProfile } from "./workspace-defaults";

type WorkbookBuildResult = {
  bytes: Uint8Array;
  fileName: string;
};

const monthlySheetName = "Investment Case Asks - Monthly";

export function buildInvestmentRequestWorkbook(
  templateBytes: Uint8Array,
  request: InvestmentRequest,
  profile: InvestmentWorkbookProfile,
): WorkbookBuildResult {
  const zip = unzipSync(templateBytes);
  const sheetPath = resolveWorksheetPath(zip, monthlySheetName);
  const sheetBytes = zip[sheetPath];
  if (!sheetBytes) {
    throw new Error(`Could not find ${monthlySheetName} in workbook template.`);
  }

  let sheetXml = strFromU8(sheetBytes);
  const payrollLines = request.lines.filter((line) => line.lineType === "Payroll / Headcount");
  const nonPayrollLines = request.lines.filter((line) => line.lineType === "Non-Payroll");

  if (payrollLines.length > 16) {
    throw new Error("Payroll / Headcount export supports up to 16 workbook rows.");
  }
  if (nonPayrollLines.length > 15) {
    throw new Error("Non-Payroll export supports up to 15 workbook rows.");
  }

  const hasGroups = profile.groups.length > 0;

  payrollLines.forEach((line, index) => {
    const row = 5 + index;
    const cells: Record<string, string | number | null> = hasGroups
      ? {
          A: line.jobTitle,
          B: line.group,
          D: line.roleHire,
          E: line.location,
          F: line.responsibilities,
          G: dateToExcelSerial(line.hireDate),
          BC: line.notesRationale,
        }
      : {
          A: line.jobTitle,
          C: line.roleHire,
          D: line.location,
          E: line.responsibilities,
          F: dateToExcelSerial(line.hireDate),
          BB: line.notesRationale,
        };
    sheetXml = setCells(sheetXml, row, cells);
  });

  nonPayrollLines.forEach((line, index) => {
    const row = 28 + index;
    const cells: Record<string, string | number | null> = hasGroups
      ? {
          A: line.expenseDescription,
          B: line.group,
          C: line.expenseType,
          D: line.vendor,
          E: line.annualizedSpend,
          AS: line.notesRationale,
        }
      : {
          A: line.expenseDescription,
          B: line.expenseType,
          C: line.vendor,
          D: line.annualizedSpend,
          AR: line.notesRationale,
        };
    sheetXml = setCells(sheetXml, row, cells);
  });

  zip[sheetPath] = strToU8(sheetXml);

  return {
    bytes: zipSync(zip),
    fileName: exportFileName(request, profile),
  };
}

function resolveWorksheetPath(zip: Record<string, Uint8Array>, sheetName: string) {
  const workbookXml = strFromU8(requiredZipEntry(zip, "xl/workbook.xml"));
  const relationshipsXml = strFromU8(requiredZipEntry(zip, "xl/_rels/workbook.xml.rels"));
  const sheetMatch = [...workbookXml.matchAll(/<sheet\b[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => tag.includes(`name="${escapeXmlAttribute(sheetName)}"`));
  const relationshipId = sheetMatch?.match(/r:id="([^"]+)"/)?.[1];
  if (!relationshipId) {
    throw new Error(`Could not resolve worksheet relationship for ${sheetName}.`);
  }

  const relMatch = [...relationshipsXml.matchAll(/<Relationship\b[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => tag.includes(`Id="${relationshipId}"`));
  const target = relMatch?.match(/Target="([^"]+)"/)?.[1];
  if (!target) {
    throw new Error(`Could not resolve worksheet target for ${sheetName}.`);
  }

  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\//, "")}`;
}

function requiredZipEntry(zip: Record<string, Uint8Array>, path: string) {
  const entry = zip[path];
  if (!entry) {
    throw new Error(`Workbook template is missing ${path}.`);
  }
  return entry;
}

function setCells(sheetXml: string, row: number, cells: Record<string, string | number | null>) {
  let nextXml = sheetXml;
  for (const [column, value] of Object.entries(cells)) {
    nextXml = setCell(nextXml, `${column}${row}`, value);
  }
  return nextXml;
}

function setCell(sheetXml: string, ref: string, value: string | number | null) {
  const pattern = cellPattern(ref);
  const match = sheetXml.match(pattern)?.[0];
  if (!match) {
    return insertCell(sheetXml, ref, value);
  }

  const openTag = (match.match(/^<c\b([^>]*)/)?.[1] ?? ` r="${ref}"`).replace(/\/\s*$/, "");
  const attrsWithoutType = openTag.replace(/\s+t="[^"]*"/g, "");
  return sheetXml.replace(pattern, buildCellXml(attrsWithoutType, value));
}

function insertCell(sheetXml: string, ref: string, value: string | number | null) {
  const rowNumber = ref.match(/\d+$/)?.[0];
  if (!rowNumber) {
    throw new Error(`Invalid workbook cell reference ${ref}.`);
  }

  const rowPattern = new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*>[\\s\\S]*?<\\/row>`);
  const rowXml = sheetXml.match(rowPattern)?.[0];
  if (!rowXml) {
    throw new Error(`Workbook template is missing row ${rowNumber}.`);
  }

  const cellXml = buildCellXml(` r="${ref}"`, value);
  const targetColumn = columnIndex(ref);
  const existingCells = [...rowXml.matchAll(/<c\b(?=[^>]*\br="([A-Z]+\d+)")[^>]*\/>|<c\b(?=[^>]*\br="([A-Z]+\d+)")[^>]*>[\s\S]*?<\/c>/g)];
  const nextCell = existingCells.find((cell) => columnIndex(cell[1] ?? cell[2] ?? "") > targetColumn)?.[0];
  const nextRowXml = nextCell ? rowXml.replace(nextCell, `${cellXml}${nextCell}`) : rowXml.replace("</row>", `${cellXml}</row>`);
  return sheetXml.replace(rowPattern, nextRowXml);
}

function buildCellXml(attrs: string, value: string | number | null) {
  const attrsWithoutType = attrs.replace(/\s+t="[^"]*"/g, "");
  const normalizedValue = value ?? "";

  if (typeof normalizedValue === "number" && Number.isFinite(normalizedValue)) {
    return `<c${attrsWithoutType}><v>${normalizedValue}</v></c>`;
  }

  const text = String(normalizedValue);
  if (!text) {
    return `<c${attrsWithoutType}/>`;
  }
  return `<c${attrsWithoutType} t="inlineStr"><is><t>${escapeXmlText(text)}</t></is></c>`;
}

function dateToExcelSerial(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round(date.getTime() / 86400000 + 25569);
}

function exportFileName(request: InvestmentRequest, profile: InvestmentWorkbookProfile) {
  const base = profile.workbookName.replace(/\.xlsx$/i, "");
  const suffix = (request.initiative || request.requestType)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return `${base} - ${suffix || "investment-request"}.xlsx`;
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cellPattern(ref: string) {
  const escapedRef = escapeRegExp(ref);
  return new RegExp(
    `<c\\b(?=[^>]*\\br="${escapedRef}")[^>]*\\/>|<c\\b(?=[^>]*\\br="${escapedRef}")[^>]*>[\\s\\S]*?<\\/c>`,
  );
}

function columnIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "";
  return letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}
