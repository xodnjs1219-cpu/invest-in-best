"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AUTH_SIGNUP_MESSAGES } from "@/features/auth/constants";
import { useSignup, signupErrorMessage } from "@/features/auth/hooks/useSignup";
import {
  signupFormSchema,
  toSignupRequest,
  type SignupFormValues,
} from "@/features/auth/lib/signup-form";

type SignupFormProps = {
  onSuccess: (email: string) => void;
  redirectTo?: string;
};

/**
 * 회원가입 폼 Presenter. react-hook-form + zodResolver로 필드 검증하고,
 * 제출 로직은 useSignup 훅에, 폼 스키마·매핑은 lib/signup-form.ts에 위임한다.
 */
export function SignupForm({ onSuccess, redirectTo }: SignupFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirm: "",
      agreeTerms: false as unknown as true,
      agreePrivacy: false as unknown as true,
    },
  });
  const signupMutation = useSignup();

  const onSubmit = (values: SignupFormValues) => {
    signupMutation.mutate(toSignupRequest(values, redirectTo), {
      onSuccess: (response) => onSuccess(response.email),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {signupMutation.isError && (
        <p role="alert" className="text-red-600">
          {signupErrorMessage(signupMutation.error)}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-email">{AUTH_SIGNUP_MESSAGES.emailLabel}</label>
        <input id="signup-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-red-600">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-password">{AUTH_SIGNUP_MESSAGES.passwordLabel}</label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && <p className="text-red-600">{errors.password.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-password-confirm">{AUTH_SIGNUP_MESSAGES.passwordConfirmLabel}</label>
        <input
          id="signup-password-confirm"
          type="password"
          autoComplete="new-password"
          {...register("passwordConfirm")}
        />
        {errors.passwordConfirm && <p className="text-red-600">{errors.passwordConfirm.message}</p>}
      </div>

      <div data-testid="terms-field" className="flex flex-col gap-1">
        <label htmlFor="signup-agree-terms" className="flex items-center gap-2">
          <input id="signup-agree-terms" type="checkbox" {...register("agreeTerms")} />
          {AUTH_SIGNUP_MESSAGES.agreeTermsLabel}
        </label>
        <a href="/legal/terms" target="_blank" rel="noreferrer" className="underline">
          이용약관 보기
        </a>
        {errors.agreeTerms && <p className="text-red-600">{errors.agreeTerms.message}</p>}
      </div>

      <div data-testid="privacy-field" className="flex flex-col gap-1">
        <label htmlFor="signup-agree-privacy" className="flex items-center gap-2">
          <input id="signup-agree-privacy" type="checkbox" {...register("agreePrivacy")} />
          {AUTH_SIGNUP_MESSAGES.agreePrivacyLabel}
        </label>
        <a href="/legal/privacy" target="_blank" rel="noreferrer" className="underline">
          개인정보처리방침 보기
        </a>
        {errors.agreePrivacy && <p className="text-red-600">{errors.agreePrivacy.message}</p>}
      </div>

      <button type="submit" disabled={isSubmitting || signupMutation.isPending}>
        {isSubmitting || signupMutation.isPending
          ? AUTH_SIGNUP_MESSAGES.submittingLabel
          : AUTH_SIGNUP_MESSAGES.submitLabel}
      </button>
    </form>
  );
}
