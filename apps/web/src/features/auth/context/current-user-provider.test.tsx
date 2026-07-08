// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CurrentUserProvider,
  useCurrentUser,
} from "@/features/auth/context/current-user-provider";

const getUserMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const unsubscribeMock = vi.fn();

vi.mock("@/lib/supabase/browser-client", () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: getUserMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  }),
}));

const Probe = () => {
  const { status, user } = useCurrentUser();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? ""}</span>
    </div>
  );
};

describe("CurrentUserProvider", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("세션이 없으면 unauthenticated로 전환된다", async () => {
    // Arrange
    getUserMock.mockResolvedValue({ data: { user: null } });
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: unsubscribeMock } } });

    // Act
    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );

    // Assert
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
  });

  it("세션이 있으면 authenticated로 전환되고 user가 채워진다", async () => {
    // Arrange
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "a@b.com",
          app_metadata: {},
          user_metadata: {},
        },
      },
    });
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: unsubscribeMock } } });

    // Act
    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );

    // Assert
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("email")).toHaveTextContent("a@b.com");
  });

  it("SIGNED_OUT 이벤트 수신 시 unauthenticated로 전환된다 (탭 간 동기화)", async () => {
    // Arrange
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com", app_metadata: {}, user_metadata: {} } },
    });
    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    onAuthStateChangeMock.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: unsubscribeMock } } };
    });

    const { unmount } = render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    // Act
    act(() => {
      capturedCallback?.("SIGNED_OUT", null);
    });

    // Assert
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    unmount();
  });

  it("언마운트 시 구독을 해제한다", async () => {
    // Arrange
    getUserMock.mockResolvedValue({ data: { user: null } });
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: unsubscribeMock } } });

    // Act
    const { unmount } = render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    unmount();

    // Assert
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
