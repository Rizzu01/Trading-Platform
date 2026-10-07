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

    return (
    <div className="market-chart">
      <div ref={containerRef} className="real-chart-canvas" />
      {loading && !candles.length && <div className="chart-state">Loading live candles…</div>}
      {!loading && error && !candles.length && (
        <div className="chart-state error">
          <strong>Market data unavailable</strong>
          <span>{error}</span>
        </div>
      )}
      <div className="chart-live-status">
        <i className={connected ? "live-dot live" : "live-dot"} />
        <span>{connected ? "Live" : loading ? "Loading" : error ? "Unavailable" : "Reconnecting"}</span>
      </div>
      <div className="tradingview-attribution">
        Charts by{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a>
      </div>
    </div>
  )
}
