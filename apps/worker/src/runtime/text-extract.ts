/**
 * 문서 텍스트 추출 유틸 (docs/usecases/030/plan.md 모듈 9).
 * 외부 라이브러리 미도입(techstack 원칙 4 최소 인프라) — OpenDART/SEC 원문 어댑터(M7/M8) 공용 순수 함수.
 */

const TRUNCATION_MARKER = "...(truncated)";

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  let result = text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => HTML_ENTITIES[match] ?? match);
  // 수치 문자 참조(&#123; / &#x1F;)도 디코드.
  result = result.replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

export interface ExtractPlainTextOptions {
  maxChars: number;
}

/**
 * `<script>`/`<style>` 블록 제거 → 태그 제거 → 엔티티 디코드 → 공백 정규화 → maxChars 절단.
 */
export function extractPlainText(raw: string, options: ExtractPlainTextOptions): string {
  const withoutScriptsAndStyles = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutScriptsAndStyles.replace(/<[^>]+>/g, " ");
  const decoded = decodeEntities(withoutTags);
  const normalized = decoded.replace(/\s+/g, " ").trim();

  if (normalized.length <= options.maxChars) {
    return normalized;
  }
  return normalized.slice(0, options.maxChars) + TRUNCATION_MARKER;
}

/**
 * 문서 바이트 배열을 문자열로 디코드한다. UTF-8 우선 시도(fatal) 후 실패하면 EUC-KR로 폴백한다
 * (DART 구형 문서 대응). 둘 다 실패할 일은 없다 — EUC-KR 디코더는 임의 바이트를 항상 매핑한다.
 */
export function decodeDocumentBuffer(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("euc-kr").decode(buf);
    } catch {
      return new TextDecoder("utf-8").decode(buf); // 최종 폴백(치환 문자 허용)
    }
  }
}
