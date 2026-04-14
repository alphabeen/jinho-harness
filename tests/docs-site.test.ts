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
      'id="skills"',
      'id="commands"',
      'id="faq"',
      'pi install git:alphabeen/oh-my-jinho',
      '/clarify [주제]',
      '/plan [주제]',
      '설치',
      '빠른 시작',
      '실무형 스킬 안내 (Option 3)',
      '추천 사용 순서',
      '실패 방지 팁',
      '핵심 커맨드',
    ];

    for (const token of required) {
      expect(html.includes(token), `missing token: ${token}`).toBe(true);
    }
  });
});
