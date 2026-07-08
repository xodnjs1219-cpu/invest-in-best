import Link from "next/link";

/**
 * 체인 없음 폴백 (plan 모듈 C6) — E1·E12·C-2 공용. 재시도 버튼 없음(존재하지 않음이 재시도로
 * 해결되지 않는 상태이므로). 메인(`/`) 이동 버튼만 제공한다.
 */
export const ChainNotFoundFallback = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-6 py-16 text-center">
      <p className="text-base font-medium text-gray-900">체인을 찾을 수 없습니다.</p>
      <p className="text-sm text-gray-500">
        요청하신 밸류체인이 존재하지 않거나 접근할 수 없습니다.
      </p>
      <Link
        href="/"
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        메인으로 이동
      </Link>
    </div>
  );
};
