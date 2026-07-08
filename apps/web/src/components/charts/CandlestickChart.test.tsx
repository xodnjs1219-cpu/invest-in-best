// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  // jsdom은 ResizeObserver를 구현하지 않는다 — 컨테이너 반응형 리사이즈 관측용 최소 스텁.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

const addSeriesMock = vi.hoisted(() => vi.fn());
const setDataMock = vi.hoisted(() => vi.fn());
const removeMock = vi.hoisted(() => vi.fn());
const resizeMock = vi.hoisted(() => vi.fn());
const applyOptionsMock = vi.hoisted(() => vi.fn());
const createChartMock = vi.hoisted(() => vi.fn());
const setMarkersMock = vi.hoisted(() => vi.fn());
const createSeriesMarkersMock = vi.hoisted(() => vi.fn());

vi.mock("lightweight-charts", () => ({
  createChart: createChartMock,
  createSeriesMarkers: createSeriesMarkersMock,
  CandlestickSeries: "CandlestickSeries",
}));

const { CandlestickChart } = await import("@/components/charts/CandlestickChart");

const buildChartInstance = () => {
  createSeriesMarkersMock.mockReturnValue({ setMarkers: setMarkersMock });
  return {
    addSeries: addSeriesMock.mockReturnValue({
      setData: setDataMock,
    }),
    resize: resizeMock,
    applyOptions: applyOptionsMock,
    remove: removeMock,
    timeScale: () => ({ fitContent: vi.fn() }),
  };
};

describe("CandlestickChart", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("마운트 시 차트를 생성하고 CandlestickSeries를 추가한다", () => {
    createChartMock.mockReturnValue(buildChartInstance());

    render(
      <CandlestickChart
        candles={[
          { time: "2026-07-01", open: 100, high: 110, low: 90, close: 105, isClosingConfirmed: true },
        ]}
      />,
    );

    expect(createChartMock).toHaveBeenCalledTimes(1);
    expect(addSeriesMock).toHaveBeenCalledTimes(1);
    expect(setDataMock).toHaveBeenCalledTimes(1);
  });

  it("데이터 변경 시 차트를 재생성하지 않고 setData만 다시 호출한다", () => {
    createChartMock.mockReturnValue(buildChartInstance());

    const { rerender } = render(
      <CandlestickChart
        candles={[
          { time: "2026-07-01", open: 100, high: 110, low: 90, close: 105, isClosingConfirmed: true },
        ]}
      />,
    );

    rerender(
      <CandlestickChart
        candles={[
          { time: "2026-07-01", open: 100, high: 110, low: 90, close: 105, isClosingConfirmed: true },
          { time: "2026-07-02", open: 105, high: 115, low: 100, close: 110, isClosingConfirmed: false },
        ]}
      />,
    );

    expect(createChartMock).toHaveBeenCalledTimes(1);
    expect(setDataMock).toHaveBeenCalledTimes(2);
  });

  it("언마운트 시 차트 인스턴스를 remove한다", () => {
    createChartMock.mockReturnValue(buildChartInstance());

    const { unmount } = render(<CandlestickChart candles={[]} />);
    unmount();

    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it("빈 배열(0개) 캔들에서도 크래시 없이 렌더한다", () => {
    createChartMock.mockReturnValue(buildChartInstance());

    expect(() => render(<CandlestickChart candles={[]} />)).not.toThrow();
  });

  it("OHLC에 null이 포함된 캔들은 시리즈 데이터에서 제외한다(갭 처리)", () => {
    createChartMock.mockReturnValue(buildChartInstance());

    render(
      <CandlestickChart
        candles={[
          { time: "2026-07-01", open: 100, high: 110, low: 90, close: 105, isClosingConfirmed: true },
          { time: "2026-07-02", open: null, high: null, low: null, close: null, isClosingConfirmed: false },
        ]}
      />,
    );

    const passedData = setDataMock.mock.calls[0][0];
    expect(passedData).toHaveLength(1);
  });
});
