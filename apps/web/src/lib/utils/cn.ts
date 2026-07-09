/**
 * 조건부 className 병합 유틸 (외부 의존성 없이 자체 구현).
 * falsy 값(false/undefined/null/"")을 걸러 공백으로 합친다. tailwind-merge 같은 충돌 해소는
 * 하지 않으므로, 컴포넌트에서 base 뒤에 override를 두는 순서로 우선순위를 관리한다.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
