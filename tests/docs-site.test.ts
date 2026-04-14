import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const htmlPath = "docs/index.html";

describe("Korean landing page", () => {
  it("has required quickstart sections", () => {
    expect(existsSync(htmlPath)).toBe(true);
    const html = readFileSync(htmlPath, "utf-8");

    const required = [
      'lang="ko"',
      'id="install"',
      'id="quickstart"',
      'id="commands"',
      'id="faq"',
      'pi install git:alphabeen/oh-my-jinho',
      '/clarify [주제]',
      '/plan [주제]',
      '설치',
      '빠른 시작',
      '핵심 커맨드',
    ];

    for (const token of required) {
      expect(html.includes(token), `missing token: ${token}`).toBe(true);
    }
  });
});
