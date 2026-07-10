import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/constants/site";

/**
 * 루트 OpenGraph 이미지 (App Router 파일 규약).
 * 정적 자산 없이 런타임 렌더링으로 SNS 공유 카드 이미지를 생성한다.
 * 하위 라우트에 별도 `opengraph-image`가 없으면 이 이미지가 상속된다.
 *
 * ui-exception(hex): next/og는 CSS var를 못 읽어 토큰 값을 hex로 고정한다 —
 * fg(#0f172a)·accent-soft 다크(#1e1b4b)·accent(#818cf8) 계열, DESIGN.md §2와 값 일치.
 */
export const alt = `${SITE_NAME} — 산업의 흐름을 한 장의 마인드맵으로`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, color: "#818cf8", marginBottom: 24 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 68, fontWeight: 300, lineHeight: 1.15, letterSpacing: -1.4, marginBottom: 32 }}>
          산업의 흐름을 한 장의 마인드맵으로
        </div>
        <div style={{ fontSize: 30, opacity: 0.8, lineHeight: 1.4, maxWidth: 900 }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size },
  );
}
