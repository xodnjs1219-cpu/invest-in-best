import { DATA_SOURCE_LABELS, DATA_SOURCE_POLICY_TEXT } from "@iib/domain";

/**
 * 데이터 출처 표기 정책 섹션 (UC-025 plan B-2) — 면책 페이지 전용.
 * 순수 Presenter(props 없음, Server Component 호환) — 출처 3종(BR-7)과 정책 문구를 상수 그대로 표시한다.
 * 화면별 "최종 수집 시각" 표기는 UC-009/020 소관이며 여기 포함하지 않는다(BR-7 경계).
 */
export function DataSourcePolicySection() {
  return (
    <section
      aria-labelledby="data-source-policy-heading"
      className="flex flex-col gap-3 rounded border border-gray-200 p-4"
    >
      <h2 id="data-source-policy-heading" className="text-lg font-semibold">
        데이터 출처 표기 정책
      </h2>
      <p className="text-sm leading-relaxed text-gray-800">{DATA_SOURCE_POLICY_TEXT}</p>
      <ul className="flex flex-wrap gap-2 text-sm text-gray-700">
        {DATA_SOURCE_LABELS.map((label) => (
          <li key={label} className="rounded bg-gray-100 px-2 py-1">
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
