import Link from "next/link";
import { ROUTES } from "@/constants/routes";

/**
 * 전역 404 안내 페이지 (UC-025 plan B-6, E2) — Next.js App Router 규약 파일.
 * 앱 전역 공통 자산(최초 정의) — `/legal/*` 등 미매칭 경로를 포함한 모든 라우트의 폴백.
 * 순수 Presenter(상태 없음). 이후 다른 UC의 페이지 레벨 `notFound()` 호출도 이 파일을 재사용한다.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-gray-600">요청하신 경로가 존재하지 않거나 이동되었습니다.</p>
      <Link href={ROUTES.home} className="underline hover:text-gray-700">
        메인으로 돌아가기
      </Link>
    </div>
  );
}
