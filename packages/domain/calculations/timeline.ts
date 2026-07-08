import { formatInTimeZone } from "date-fns-tz";
import { TIMELINE_TIMEZONE } from "../constants/timeline";
import type { IsoDate } from "../types/common";

/**
 * chain-view 타임라인의 "오늘" 계산(Asia/Seoul 고정, 결정 C-6).
 * Provider가 렌더 시 1회 계산해 reducer 초기값 팩토리에 주입한다(reducer 순수성 유지).
 */
export function getTimelineToday(now: Date = new Date()): IsoDate {
  return formatInTimeZone(now, TIMELINE_TIMEZONE, "yyyy-MM-dd") as IsoDate;
}
