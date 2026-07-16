import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { buildPayrollHeadcountWorkbook } from "../lib/investment-workbook-export";
import { investmentWorkbookProfiles, type InvestmentRequestLine } from "../lib/workspace-defaults";

const templates = [
  ["2027-data-center-business-plan", "Data Centers", "G&A 2027 Plan - Data Centers - 3YR BP Memo.xlsx", "G&A 2027 Plan - Data Centers - 3YR BP Memo.xlsx"],
  ["2027-prologis-energy-solutions-business-plan", "Energy Solutions", "G&A 2027 Plan - Energy Solutions - 3YR BP Memo.xlsx", "G&A 2027 Plan - Energy Solutions - 3YR BP Memo.xlsx"],
  ["2027-business-plan", "Essentials Operations", "G&A 2027 Plan - Essentials Operations - 3YR BP Memo.xlsx", "G&A 2027 Plan - Essentials Operations - 3YR BP Memo.xlsx"],
  ["2027-strategic-capital-business-plan", "Strategic Capital", "G&A 2027 Plan - Strategic Capital - 3YR BP Memo.xlsx", "G&A 2027 Plan - Strategic Capital - 3YR BP Memo.xlsx"],
] as const;

const officialRoot = process.env.OFFICIAL_TEMPLATE_ROOT;
const templatePath = (folder: string, officialName: string, fallbackName: string) => officialRoot
  ? join(officialRoot, folder, officialName)
  : new URL(`../public/templates/${fallbackName}`, import.meta.url);

for (const [planId, folder, officialName, fallbackName] of templates) {
  test(`${planId} Payroll export preserves workbook formulas and writes only a role row`, async () => {
    const input = new Uint8Array(await readFile(templatePath(folder, officialName, fallbackName)));
    const profile = investmentWorkbookProfiles[planId];
    const line: InvestmentRequestLine = { id: "line", lineType: "Payroll / Headcount", jobTitle: "Role: Growth / Operations", group: profile.groups[0] ?? "", roleHire: "New role", location: "Paris, France", responsibilities: "• Own execution\n• Support customers\n• Coordinate delivery\n• Report progress", hireDate: "2027-01-15", expenseDescription: "", expenseType: "", vendor: "", annualizedSpend: null, notesRationale: "Capacity is needed for the approved business plan." };
    const output = buildPayrollHeadcountWorkbook(input, [line], profile).bytes;
    assert.deepEqual([...output.slice(0, 4)], [80, 75, 3, 4]);
    const before = unzipSync(input);
    const after = unzipSync(output);
    assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
    for (const path of Object.keys(before).filter((path) => path.startsWith("xl/worksheets/"))) {
      const formulas = (strFromU8(before[path]).match(/<f[^>]*>[\s\S]*?<\/f>/g) ?? []).sort();
      assert.deepEqual((strFromU8(after[path]).match(/<f[^>]*>[\s\S]*?<\/f>/g) ?? []).sort(), formulas);
    }
  });
}

test("Payroll export blocks roles that exceed the verified 16-row capacity", async () => {
  const input = new Uint8Array(await readFile(templatePath("Data Centers", "G&A 2027 Plan - Data Centers - 3YR BP Memo.xlsx", "G&A 2027 Plan - Data Centers - 3YR BP Memo.xlsx")));
  const line = { id: "line", lineType: "Payroll / Headcount", jobTitle: "Role", group: "", roleHire: "New role", location: "France", responsibilities: "Responsibilities", hireDate: "2027-01-15", expenseDescription: "", expenseType: "", vendor: "", annualizedSpend: null, notesRationale: "Rationale" } as InvestmentRequestLine;
  assert.throws(() => buildPayrollHeadcountWorkbook(input, Array.from({ length: 17 }, () => line), investmentWorkbookProfiles["2027-data-center-business-plan"]), /space for 16 headcount requests, but the plan contains 17/);
});
