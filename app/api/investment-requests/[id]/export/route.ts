import {
  getActorFromRequest,
  getInvestmentRequest,
  getInvestmentRequestExport,
  resolvePlanId,
  toRouteErrorMessage,
} from "../../../../../lib/workspace-store";
import { buildInvestmentRequestWorkbook } from "../../../../../lib/investment-workbook-export";
import { investmentWorkbookProfiles } from "../../../../../lib/workspace-defaults";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await getActorFromRequest(request);
    const { id } = await context.params;
    const url = new URL(request.url);
    const planId = resolvePlanId(url.searchParams.get("planId"));
    if (url.searchParams.get("format") === "xlsx") {
      const profile = investmentWorkbookProfiles[planId];
      if (!profile) {
        throw new Error("No workbook template is configured for this business plan.");
      }
      const investmentRequest = await getInvestmentRequest(id, planId);
      if (!investmentRequest) {
        throw new Error("Investment request not found.");
      }
      const templateResponse = await fetch(new URL(profile.templatePath, request.url));
      if (!templateResponse.ok) {
        throw new Error(`Workbook template could not be loaded: ${profile.workbookName}.`);
      }
      const templateBytes = new Uint8Array(await templateResponse.arrayBuffer());
      const workbook = buildInvestmentRequestWorkbook(templateBytes, investmentRequest, profile);
      const body = new ArrayBuffer(workbook.bytes.byteLength);
      new Uint8Array(body).set(workbook.bytes);
      return new Response(body, {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${workbook.fileName.replace(/"/g, "'")}"`,
          "cache-control": "no-store",
        },
      });
    }
    return Response.json({ export: await getInvestmentRequestExport(id, planId) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
