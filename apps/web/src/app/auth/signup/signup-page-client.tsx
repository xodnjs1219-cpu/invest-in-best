"use client";

import { useState } from "react";
import { SignupForm } from "@/features/auth/components/signup-form";
import { SignupSuccessNotice } from "@/features/auth/components/signup-success-notice";

type SignupPageClientProps = {
  redirectTo?: string;
};

/**
 * 폼 ↔ 완료 안내 전환만 담당하는 클라이언트 컴포넌트.
 * 로컬 상태 1개(`submittedEmail`)로 화면을 전환한다(별도 Context+useReducer 불요 — 단일 폼).
 */
export function SignupPageClient({ redirectTo }: SignupPageClientProps) {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  if (submittedEmail) {
    return <SignupSuccessNotice email={submittedEmail} redirectTo={redirectTo} />;
  }

  return <SignupForm onSuccess={setSubmittedEmail} redirectTo={redirectTo} />;
}
