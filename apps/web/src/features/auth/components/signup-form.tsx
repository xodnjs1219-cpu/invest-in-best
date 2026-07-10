"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, Input } from "@/components/ui";
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
        <p role="alert" className="text-danger">
          {signupErrorMessage(signupMutation.error)}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-email">{AUTH_SIGNUP_MESSAGES.emailLabel}</label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="signup-email-error" className="text-danger">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-password">{AUTH_SIGNUP_MESSAGES.passwordLabel}</label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "signup-password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="signup-password-error" className="text-danger">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-password-confirm">{AUTH_SIGNUP_MESSAGES.passwordConfirmLabel}</label>
        <Input
          id="signup-password-confirm"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.passwordConfirm)}
          aria-describedby={errors.passwordConfirm ? "signup-password-confirm-error" : undefined}
          {...register("passwordConfirm")}
        />
        {errors.passwordConfirm && (
          <p id="signup-password-confirm-error" className="text-danger">
            {errors.passwordConfirm.message}
          </p>
        )}
      </div>

      <div data-testid="terms-field" className="flex flex-col gap-1">
        <label htmlFor="signup-agree-terms" className="flex items-center gap-2">
          <input
            id="signup-agree-terms"
            type="checkbox"
            className="accent-accent"
            {...register("agreeTerms")}
          />
          {AUTH_SIGNUP_MESSAGES.agreeTermsLabel}
        </label>
        <a
          href="/legal/terms"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:text-accent-hover underline underline-offset-2"
        >
          이용약관 보기
        </a>
        {errors.agreeTerms && <p className="text-danger">{errors.agreeTerms.message}</p>}
      </div>

      <div data-testid="privacy-field" className="flex flex-col gap-1">
        <label htmlFor="signup-agree-privacy" className="flex items-center gap-2">
          <input
            id="signup-agree-privacy"
            type="checkbox"
            className="accent-accent"
            {...register("agreePrivacy")}
          />
          {AUTH_SIGNUP_MESSAGES.agreePrivacyLabel}
        </label>
        <a
          href="/legal/privacy"
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:text-accent-hover underline underline-offset-2"
        >
          개인정보처리방침 보기
        </a>
        {errors.agreePrivacy && <p className="text-danger">{errors.agreePrivacy.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting || signupMutation.isPending}>
        {isSubmitting || signupMutation.isPending
          ? AUTH_SIGNUP_MESSAGES.submittingLabel
          : AUTH_SIGNUP_MESSAGES.submitLabel}
      </Button>
    </form>
  );
}
