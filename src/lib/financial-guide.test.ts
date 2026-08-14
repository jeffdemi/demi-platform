import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  contextualFinancialGuideAnchor,
  financialGuideCategories,
  financialGuideTerms,
  getFinancialGuideTerm,
} from "./financial-guide";

describe("financial guide", () => {
  it("provides unique, categorized definitions for every inline help term", () => {
    const ids = financialGuideTerms.map((term) => term.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(financialGuideTerms.length).toBeGreaterThanOrEqual(60);
    expect(financialGuideCategories.every((category) => financialGuideTerms.some((term) => term.category === category))).toBe(true);
    for (const id of ["total-ler", "roic", "owner-market-salary", "cash-reconciliation", "straight-line-depreciation"]) {
      expect(getFinancialGuideTerm(id)?.definition).toBeTruthy();
    }
  });

  it("links each financial workflow to its relevant guide section", () => {
    expect(contextualFinancialGuideAnchor("/reports/settings")).toBe("owner-compensation");
    expect(contextualFinancialGuideAnchor("/reports")).toBe("reporting-metrics");
    expect(contextualFinancialGuideAnchor("/labor")).toBe("labor-payroll");
    expect(contextualFinancialGuideAnchor("/finance/month-end")).toBe("month-end");
    expect(contextualFinancialGuideAnchor("/expenses/12/edit")).toBe("expense-classifications");
    expect(contextualFinancialGuideAnchor("/equipment/1/financials")).toBe("equipment-finance");
    expect(contextualFinancialGuideAnchor("/jobs/16")).toBe("financial-workflow");
  });

  it("keeps the full guide and global entry point wired into the app", async () => {
    const [page, shell] = await Promise.all([
      readFile(new URL("../app/(app)/help/financial-guide/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8"),
    ]);
    expect(page).toContain("FinancialGlossary");
    expect(page).toContain('id="financial-workflow"');
    expect(page).toContain('id="reporting-metrics"');
    expect(shell).toContain("FinancialHelpLink");
  });
});
