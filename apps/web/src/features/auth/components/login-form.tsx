"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sanitizeReturnTo } from "@/lib/utils/safe-redirect";
import { AUTH_LOGIN_MESSAGES } from "@/features/auth/constants";
import { useCurrentUser } from "@/features/auth/context/current-user-provider";
import { loginErrorMessage, useLogin } from "@/features/auth/hooks/useLogin";
import {
  loginFormSchema,
  toLoginRequest,
  type LoginFormValues,
} from "@/features/auth/lib/login-form";

type LoginFormProps = {
  returnTo?: string;
};

/**
 * 로그인 폼 Presenter. react-hook-form + zodResolver로 필드 검증하고,
 * 제출 로직은 useLogin 훅에, 성공 시 CurrentUserProvider 갱신 + returnTo 이동을 담당한다.
 */
export function LoginForm({ returnTo }: LoginFormProps) {
  const router = useRouter();
  const { setUser } = useCurrentUser();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });
  const loginMutation = useLogin();

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(toLoginRequest(values), {
      onSuccess: (response) => {
        setUser({ id: response.userId, email: response.email, role: response.role });
        router.replace(sanitizeReturnTo(returnTo));
      },
    });
  };

  const passwordResetHref = returnTo
    ? `/auth/reset-password?returnTo=${encodeURIComponent(returnTo)}`
    : "/auth/reset-password";
  const signupHref = returnTo ? `/auth/signup?returnTo=${encodeURIComponent(returnTo)}` : "/auth/signup";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {loginMutation.isError && (
        <p role="alert" className="text-red-600">
          {loginErrorMessage(loginMutation.error)}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="login-email">{AUTH_LOGIN_MESSAGES.emailLabel}</label>
        <input id="login-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-red-600">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="login-password">{AUTH_LOGIN_MESSAGES.passwordLabel}</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && <p className="text-red-600">{errors.password.message}</p>}
      </div>

      <button type="submit" disabled={isSubmitting || loginMutation.isPending}>
        {isSubmitting || loginMutation.isPending
          ? AUTH_LOGIN_MESSAGES.submittingLabel
          : AUTH_LOGIN_MESSAGES.submitLabel}
      </button>

      <div className="flex justify-between text-sm">
        <Link href={signupHref} className="underline">
          {AUTH_LOGIN_MESSAGES.goToSignup}
        </Link>
        <Link href={passwordResetHref} className="underline">
          {AUTH_LOGIN_MESSAGES.goToPasswordReset}
        </Link>
      </div>
    </form>
  );
}
