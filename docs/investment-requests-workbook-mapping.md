# Investment Requests Workbook Mapping

## Workbook Inventory

Source templates:

- `G&A 2027 Plan - Data Centers - Final.xlsx`
- `G&A 2027 Plan - Energy Solutions - Final.xlsx`
- `G&A 2027 Plan - Essentials - Final.xlsx`
- `G&A 2027 Plan - Strategic Capital - Final.xlsx`

Shared sheets:

- `Summary`
- `Investment Case Asks - Summary`
- `Investment Case Asks - Monthly`
- `Questions to Ask`
- `Baseline Support -->`
- `Base - Payroll`
- `Base - Non-Payroll`

The Phase 1 intake is derived from `Investment Case Asks - Monthly`. `Investment Case Asks - Summary` and `Summary` are calculated workbook outputs.

## Canonical Fields

Request-level fields:

- Request type: `Payroll / Headcount` or `Non-Payroll`
- Status: `Draft` or `Submitted`
- Owner name and owner email
- Title
- Strategic objective or growth opportunity
- Business milestone
- Alternatives considered
- Measurable business outcome
- Impact if not approved

Payroll / Headcount line fields:

- Job Title
- Group, only for Energy Solutions and Strategic Capital
- Role / Hire
- Location (City/Country)
- Key Job Responsibilities
- Hire Date
- Notes / Rationale

The Workspace does not collect or expose compensation-sensitive payroll detail. Job level, base salary, bonus, payroll taxes, benefits, vacation, other payroll costs, and payroll annualized spend remain in the restricted Excel or HR/FP&A process outside this app.

Non-Payroll line fields:

- Expense Description
- Group, only for Energy Solutions and Strategic Capital
- Type of Expense
- Vendor
- Annualized Spend
- Notes / Rationale

## Workbook Compatibility

Phase 2 export generates a populated `.xlsx` from the matching uploaded template and also keeps the paste-ready TSV preview for auditability.

- Data Centers and Essentials omit the Group column.
- Energy Solutions uses groups: Energy, Mobility, Energy Finance, ES Leadership.
- Strategic Capital uses groups: Fund Management, Global Strategy and Analytics, Client Relations, Strategic Capital Leadership.
- Expense type values come from the workbook's Base - Non-Payroll category list.

Compensation-sensitive payroll inputs and workbook formulas remain in Excel for:

- Job Level
- Base Salary
- Bonus
- Payroll Taxes
- Benefits
- Vacation
- Other
- Annualized Spend
- Monthly spread
- Annual incremental spend
- Summary totals

## Export Behavior

The generated workbook preserves the template workbook structure, tabs, formatting, validations, and formulas. The app writes only the non-sensitive user-input cells in `Investment Case Asks - Monthly`; payroll compensation cells are left blank for completion in the restricted Excel or HR/FP&A process.
