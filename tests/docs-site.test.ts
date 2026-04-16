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
      'id="highlights"',
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
      'subagent는 별도 pi 프로세스로 실행됩니다',
      'IDS.md',
      'IDS Soft Mode',
      '/resume은 어디까지 복원하나요?',
      'footer 지표는 어떻게 읽나요?',
      '핵심 커맨드',
    ];

    for (const token of required) {
      expect(html.includes(token), `missing token: ${token}`).toBe(true);
    }
  });
});
