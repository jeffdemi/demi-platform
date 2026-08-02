import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return componentFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("design tokens", () => {
  it("keeps component colors in the global semantic token system", () => {
    const files = componentFiles(join(process.cwd(), "src"));
    const violations = files.flatMap((file) => {
      const matches = readFileSync(file, "utf8").match(/#[0-9a-fA-F]{3,8}/g) ?? [];
      return file.endsWith("src/app/layout.tsx") ? [] : matches.map((color) => `${file}: ${color}`);
    });

    expect(violations).toEqual([]);
  });
});
