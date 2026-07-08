export type CurrentUser = {
  id: string;
  email: string;
  role: "user" | "admin";
};

export type CurrentUserState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: CurrentUser }
  | { status: "unauthenticated"; user: null };

export type CurrentUserAction =
  | { type: "SET_USER"; user: CurrentUser }
  | { type: "CLEAR_USER" };

export const initialCurrentUserState: CurrentUserState = { status: "loading", user: null };

/** 전역 인증 상태 리듀서 — 로그인 성공/탭 간 동기화(onAuthStateChange)가 소비한다. */
export const currentUserReducer = (
  _state: CurrentUserState,
  action: CurrentUserAction,
): CurrentUserState => {
  switch (action.type) {
    case "SET_USER":
      return { status: "authenticated", user: action.user };
    case "CLEAR_USER":
      return { status: "unauthenticated", user: null };
    default:
      return _state;
  }
};
