#!/usr/bin/env node
/**
 * 임시 호환성 패치 (env_setupper, 2026-07).
 *
 * 문제: techstack.md는 ESLint 10.6.0을 지정하지만, eslint-config-next@16.2.10이
 * 의존하는 eslint-plugin-react@7.37.5(2026-07-05 기준 npm 최신, ESLint 10 미지원)는
 * ESLint 9에서 제거된 RuleContext#getFilename()을 여전히 호출해 `eslint .` 실행 시
 * "contextOrFilename.getFilename is not a function"으로 즉시 크래시한다.
 *
 * eslint-plugin-react가 ESLint 10을 공식 지원할 때까지, resolveBasedir()의
 * 단일 호출부만 안전하게 patch한다(다른 규칙 로직은 건드리지 않음).
 * 이 스크립트는 root postinstall에서 실행되어 `npm install` 시마다 재적용된다
 * (node_modules는 git에 커밋되지 않으므로).
 *
 * TODO: eslint-plugin-react가 ESLint 10을 지원하는 버전을 배포하면 이 스크립트와
 * package.json의 postinstall 훅을 제거할 것.
 */
const fs = require("node:fs");
const path = require("node:path");

const TARGET = path.join(
  __dirname,
  "..",
  "node_modules",
  "eslint-plugin-react",
  "lib",
  "util",
  "version.js",
);

const BROKEN = "contextOrFilename.getFilename();";
const FIXED =
  "(typeof contextOrFilename.getFilename === 'function' ? contextOrFilename.getFilename() : contextOrFilename.filename);";

function main() {
  if (!fs.existsSync(TARGET)) {
    // eslint-plugin-react가 설치되지 않은 워크스페이스(예: worker만 설치)에서는 조용히 스킵.
    return;
  }

  const original = fs.readFileSync(TARGET, "utf8");

  if (original.includes(FIXED)) {
    console.log("[patch-eslint-plugin-react] already patched, skipping.");
    return;
  }

  if (!original.includes(BROKEN)) {
    console.log(
      "[patch-eslint-plugin-react] target string not found — eslint-plugin-react version likely changed. Skipping (verify ESLint 10 compatibility manually).",
    );
    return;
  }

  const patched = original.replace(BROKEN, FIXED);
  fs.writeFileSync(TARGET, patched, "utf8");
  console.log(
    "[patch-eslint-plugin-react] patched getFilename() fallback for ESLint 10 compatibility.",
  );
}

main();
