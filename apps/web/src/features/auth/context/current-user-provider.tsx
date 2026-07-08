"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/browser-client";
import {
  currentUserReducer,
  initialCurrentUserState,
  type CurrentUser,
  type CurrentUserState,
} from "@/features/auth/context/current-user-reducer";

type CurrentUserContextValue = CurrentUserState & {
  /** 로그인 성공 직후 헤더 UI를 즉시 갱신하기 위해 서버 응답값으로 상태를 확정한다. */
  setUser: (user: CurrentUser) => void;
  /** 로그아웃/탈퇴 완료 시 즉시 비로그인 상태로 전환한다. */
  clearUser: () => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

/** Supabase Auth User → 앱 CurrentUser로 매핑한다. role은 `app_metadata.role`을 우선 참조, 없으면 'user'. */
const toCurrentUser = (user: User): CurrentUser => ({
  id: user.id,
  email: user.email ?? "",
  role: (user.app_metadata?.role as "user" | "admin" | undefined) ?? "user",
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(currentUserReducer, initialCurrentUserState);
  const [browserClient] = useState(() => createBrowserClient());

  useEffect(() => {
    let active = true;

    browserClient.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) {
        dispatch({ type: "SET_USER", user: toCurrentUser(data.user) });
      } else {
        dispatch({ type: "CLEAR_USER" });
      }
    });

    const { data: subscription } = browserClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        dispatch({ type: "CLEAR_USER" });
        return;
      }
      if (session?.user) {
        dispatch({ type: "SET_USER", user: toCurrentUser(session.user) });
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- browserClient는 ref로 고정된 싱글턴
  }, []);

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      ...state,
      setUser: (user) => dispatch({ type: "SET_USER", user }),
      clearUser: () => dispatch({ type: "CLEAR_USER" }),
    }),
    [state],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export const useCurrentUser = (): CurrentUserContextValue => {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser는 CurrentUserProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
};
