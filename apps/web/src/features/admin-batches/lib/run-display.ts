import { BATCH_TIMEZONE } from "@iib/domain";
import { formatInTimeZone } from "date-fns-tz";

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** running 행의 경과 시간 표기(E10·R-11) — 순수 함수, `now`는 호출부(FE) 주입. */
export const formatElapsed = (startedAtIso: string, now: Date): string => {
  const elapsedMs = Math.max(0, now.getTime() - new Date(startedAtIso).getTime());
  const hours = Math.floor(elapsedMs / MS_PER_HOUR);
  const minutes = Math.floor((elapsedMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((elapsedMs % MS_PER_MINUTE) / MS_PER_SECOND);

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 경과`;
  }
  if (minutes > 0) {
    return `${minutes}분 경과`;
  }
  return `${seconds}초 경과`;
};

/** 종료된 실행의 소요 시간 표기(예: "41분 12초"). */
export const formatRunDuration = (startedAtIso: string, finishedAtIso: string): string => {
  const durationMs = Math.max(
    0,
    new Date(finishedAtIso).getTime() - new Date(startedAtIso).getTime(),
  );
  const hours = Math.floor(durationMs / MS_PER_HOUR);
  const minutes = Math.floor((durationMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((durationMs % MS_PER_MINUTE) / MS_PER_SECOND);

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}시간`);
  }
  if (hours > 0 || minutes > 0) {
    parts.push(`${minutes}분`);
  }
  parts.push(`${seconds}초`);

  return parts.join(" ");
};

/** 백필 진행률(%) + 라벨(BR-9, E11) — total=0이면 미실행 취급(percent 0). */
export const formatBackfillProgress = (
  completed: number,
  total: number,
): { percent: number; label: string } => {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const label = `${completed.toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")}`;
  return { percent, label };
};

/** KST(Asia/Seoul) 고정 포맷 헬퍼 — 어드민 운영 화면 표시 시간대(결정 C-6과 일관). */
export const formatKstDateTime = (iso: string): string =>
  formatInTimeZone(new Date(iso), BATCH_TIMEZONE, "yyyy-MM-dd HH:mm");
