import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/constants/site";

/**
 * 루트 OpenGraph 이미지 (App Router 파일 규약).
 * 정적 자산 없이 런타임 렌더링으로 SNS 공유 카드 이미지를 생성한다.
 * 하위 라우트에 별도 `opengraph-image`가 없으면 이 이미지가 상속된다.
 */
export const alt = `${SITE_NAME} — 밸류체인 마인드맵 투자 인사이트`;
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
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.85, marginBottom: 24 }}>{SITE_NAME}</div>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.15, marginBottom: 32 }}>
          밸류체인 마인드맵 투자 인사이트
        </div>
        <div style={{ fontSize: 30, opacity: 0.8, lineHeight: 1.4, maxWidth: 900 }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size },
  );
}
