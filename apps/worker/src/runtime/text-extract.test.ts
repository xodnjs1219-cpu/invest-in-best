import { describe, expect, it } from "vitest";
import { decodeDocumentBuffer, extractPlainText } from "./text-extract";

describe("extractPlainText", () => {
  it("removes tags and script/style blocks, keeping only text nodes", () => {
    const html =
      "<html><head><style>.a{color:red}</style></head><body><script>alert(1)</script><p>본문 내용</p></body></html>";
    const result = extractPlainText(html, { maxChars: 1_000 });
    expect(result).not.toMatch(/color:red/);
    expect(result).not.toMatch(/alert/);
    expect(result).toContain("본문 내용");
    expect(result).not.toMatch(/<[^>]+>/);
  });

  it("decodes common HTML entities (&amp; &lt; &#39;)", () => {
    const html = "<p>A&amp;B &lt;tag&gt; it&#39;s</p>";
    const result = extractPlainText(html, { maxChars: 1_000 });
    expect(result).toContain("A&B");
    expect(result).toContain("<tag>");
    expect(result).toContain("it's");
  });

  it("normalizes consecutive whitespace and newlines into a single space", () => {
    const html = "<p>line one\n\n\n   line   two</p>";
    const result = extractPlainText(html, { maxChars: 1_000 });
    expect(result).toBe("line one line two");
  });

  it("truncates input exceeding maxChars with a marker, leaving shorter input unchanged", () => {
    const longText = "가".repeat(100);
    const truncated = extractPlainText(`<p>${longText}</p>`, { maxChars: 10 });
    expect(truncated.length).toBeLessThanOrEqual(10 + "...(truncated)".length);
    expect(truncated).toContain("...(truncated)");

    const shortText = "짧은 텍스트";
    const untouched = extractPlainText(`<p>${shortText}</p>`, { maxChars: 1_000 });
    expect(untouched).toBe(shortText);
  });
});

describe("decodeDocumentBuffer", () => {
  it("decodes a UTF-8 byte array into a normal Korean string", () => {
    const buf = new TextEncoder().encode("안녕하세요");
    expect(decodeDocumentBuffer(buf)).toBe("안녕하세요");
  });

  it("decodes an EUC-KR byte array into a correct Korean string", () => {
    // EUC-KR bytes for "안녕" (0xBE, 0xC8, 0xB3, 0xE7)
    const eucKrBytes = new Uint8Array([0xbe, 0xc8, 0xb3, 0xe7]);
    expect(decodeDocumentBuffer(eucKrBytes)).toBe("안녕");
  });
});
