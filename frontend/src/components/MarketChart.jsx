import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  CrosshairMode,
} from "lightweight-charts";

const CHART_HEIGHT = 420;

export default function MarketChart({ candles = [], symbol, connected, loading, error }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const initializedRef = useRef(false);
  const hasFittedRef = useRef(false);
  const followRealtimeRef = useRef(true);
  const dataLengthRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = createChart(container, {
      width: container.clientWidth || 700,
      height: CHART_HEIGHT,
      layout: {
        background: { type: "solid", color: "#0a0c0f" },
        textColor: "#7f8790",
      },
      grid: {
        vertLines: { color: "#171a1f" },
        horzLines: { color: "#171a1f" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(185,238,69,0.35)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#b9ee45",
        },
        horzLine: {
          color: "rgba(185,238,69,0.35)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#b9ee45",
        },
      },
      rightPriceScale: {
        borderColor: "#20242a",
        scaleMargins: {
          top: 0.08,
          bottom: 0.25,
        },
      },
      timeScale: {
        borderColor: "#20242a",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        minBarSpacing: 3,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#b9ee45",
      downColor: "#ef7777",
      borderVisible: false,
      wickUpColor: "#b9ee45",
      wickDownColor: "#ef7777",
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
      base: 0,
    });

    chart.priceScale("").applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    initializedRef.current = true;

    const resize = () => {
      const width = container.clientWidth;
      if (width > 0) chart.applyOptions({ width, height: CHART_HEIGHT });
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const handleVisibleRangeChange = () => {
      const previousLength = dataLengthRef.current;
      if (!previousLength) return;
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      followRealtimeRef.current = range.to >= previousLength - 4;
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      initializedRef.current = false;
      hasFittedRef.current = false;
      followRealtimeRef.current = true;
      dataLengthRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (!initializedRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const valid = candles
      .map((item) => ({
        time: Math.floor(Number(item.timestamp) / 1000),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.time) &&
          Number.isFinite(item.open) &&
          Number.isFinite(item.high) &&
          Number.isFinite(item.low) &&
          Number.isFinite(item.close)
      )
      .sort((a, b) => a.time - b.time);

    const unique = [];
    for (const item of valid) {
      const last = unique[unique.length - 1];
      if (last && last.time === item.time) unique[unique.length - 1] = item;
      else unique.push(item);
    }

    const volume = unique.map((item) => {
      const source = candles.find(
        (candle) => Math.floor(Number(candle.timestamp) / 1000) === item.time
      );
      return {
        time: item.time,
        value: Math.max(Number(source?.volume || 0), 0),
        color: item.close >= item.open ? "rgba(185,238,69,0.28)" : "rgba(239,119,119,0.28)",
      };
    });

    if (!unique.length) {
      hasFittedRef.current = false;
      dataLengthRef.current = 0;
      return;
    }

    if (dataLengthRef.current > 0) {
      const range = chartRef.current?.timeScale().getVisibleLogicalRange();
      if (range) {
        followRealtimeRef.current = range.to >= dataLengthRef.current - 4;
      }
    }

    candleSeriesRef.current.setData(unique);
    volumeSeriesRef.current.setData(volume);

    if (!hasFittedRef.current) {
      chartRef.current.timeScale().fitContent();
      hasFittedRef.current = true;
      followRealtimeRef.current = true;
    } else if (followRealtimeRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
    }

    dataLengthRef.current = unique.length;
  }, [candles]);

  return (
    <div className="real-chart-shell">
      <div className="real-chart-header">
        <div className="real-chart-symbol">
          <strong>{symbol}</strong>
          <span>Live market chart</span>
        </div>
        <div className="real-chart-status">
          <i className={connected ? "live-dot live" : "live-dot"} />
          <span>{connected ? "Live" : loading ? "Loading" : "Reconnecting"}</span>
        </div>
      </div>

      <div className="real-chart-canvas-wrap">
        <div ref={containerRef} className="real-chart-canvas" />
        {loading && !candles.length && <div className="chart-state">Loading live candles…</div>}
        {!loading && error && !candles.length && <div className="chart-state error">{error}</div>}
        <div className="tradingview-attribution">
          Charts by{" "}
          <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
            TradingView
          </a>
        </div>
      </div>
    </div>
  );
}
