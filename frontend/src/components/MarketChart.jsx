import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  CrosshairMode,
} from "lightweight-charts";

const CHART_HEIGHT = 270;

export default function MarketChart({
  candles = [],
  symbol,
  connected,
  loading,
  error,
  theme = "system",
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const hasFittedRef = useRef(false);
  const followRealtimeRef = useRef(true);
  const dataLengthRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const styles = getComputedStyle(document.documentElement);
    const background = styles.getPropertyValue("--chart-background").trim();
    const grid = styles.getPropertyValue("--chart-grid").trim();
    const text = styles.getPropertyValue("--text-secondary").trim();
    const border = styles.getPropertyValue("--border").trim();
    const up = styles.getPropertyValue("--chart-up").trim();
    const down = styles.getPropertyValue("--chart-down").trim();
    const volumeUp = styles.getPropertyValue("--chart-volume-up").trim();
    const volumeDown = styles.getPropertyValue("--chart-volume-down").trim();

    const chart = createChart(containerRef.current, {
      height: CHART_HEIGHT,
      layout: {
        background: { type: "solid", color: background },
        textColor: text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: {
        borderColor: border,
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 8,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: grid, width: 1 },
        horzLine: { color: grid, width: 1 },
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
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: volumeUp,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    });

    const rangeListener = (range) => {
      const dataLength = dataLengthRef.current;
      if (!range || !dataLength) return;
      followRealtimeRef.current = range.to >= dataLength - 4;
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeListener);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeListener);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      hasFittedRef.current = false;
      followRealtimeRef.current = true;
      dataLengthRef.current = 0;
    };
  }, [theme]);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;

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
      };
    });

    if (!unique.length) {
      hasFittedRef.current = false;
      dataLengthRef.current = 0;
      return;
    }

    if (dataLengthRef.current > 0) {
      const range = chartRef.current.timeScale().getVisibleLogicalRange();
      if (range) {
        followRealtimeRef.current = range.to >= dataLengthRef.current - 4;
      }
    }

    candleSeriesRef.current.setData(unique);
    volumeSeriesRef.current.setData(
      volume.map((item, index) => ({
        ...item,
        color: unique[index].close >= unique[index].open
          ? getComputedStyle(document.documentElement).getPropertyValue("--chart-volume-up").trim()
          : getComputedStyle(document.documentElement).getPropertyValue("--chart-volume-down").trim(),
      }))
    );

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
          <span>Public market feed</span>
        </div>
        <div className="real-chart-status">
          <i className={connected ? "live-dot live" : "live-dot"} />
          <span>{connected ? "Live" : loading ? "Loading" : error ? "Unavailable" : "Reconnecting"}</span>
        </div>
      </div>

      <div className="real-chart-canvas-wrap">
        <div ref={containerRef} className="real-chart-canvas" />
        {loading && !candles.length && <div className="chart-state">Loading live candles…</div>}
        {!loading && error && !candles.length && (
          <div className="chart-state error">
            <strong>Market data unavailable</strong>
            <span>{error}</span>
          </div>
        )}
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
