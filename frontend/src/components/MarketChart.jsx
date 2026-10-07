import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  CrosshairMode,
} from "lightweight-charts";

const CHART_HEIGHT = 270;

function ema(values, period) {
  const output = Array(values.length).fill(null);
  if (values.length < period) return output;
  let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  output[period - 1] = previous;
  const alpha = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1) {
    previous = values[index] * alpha + previous * (1 - alpha);
    output[index] = previous;
  }
  return output;
}

function sma(values, period) {
  const output = Array(values.length).fill(null);
  if (values.length < period) return output;
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= period) sum -= values[index - period];
    if (index >= period - 1) output[index] = sum / period;
  }
  return output;
}

function bollinger(values, period = 20, multiplier = 2) {
  const middle = sma(values, period);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);
  for (let index = period - 1; index < values.length; index += 1) {
    const window = values.slice(index - period + 1, index + 1);
    const mean = middle[index];
    const variance = window.reduce((total, value) => total + ((value - mean) ** 2), 0) / period;
    const deviation = Math.sqrt(variance);
    upper[index] = mean + (multiplier * deviation);
    lower[index] = mean - (multiplier * deviation);
  }
  return { middle, upper, lower };
}

const MarketChart = forwardRef(function MarketChart(
  {
    candles = [],
    symbol,
    connected,
    loading,
    error,
    theme = "system",
  },
  ref
) {
  const containerRef = useRef(null);
  const shellRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const lineSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);
  const bbMiddleRef = useRef(null);
  const bbUpperRef = useRef(null);
  const bbLowerRef = useRef(null);
  const hasFittedRef = useRef(false);
  const followRealtimeRef = useRef(true);
  const dataLengthRef = useRef(0);
  const toolStateRef = useRef({
    crosshair: true,
    volume: true,
    candles: true,
    ema20: false,
    ema50: false,
    bollinger: false,
    autoScale: true,
  });

  useImperativeHandle(ref, () => ({
    toggleCrosshair() {
      const chart = chartRef.current;
      if (!chart) return toolStateRef.current.crosshair;
      const next = !toolStateRef.current.crosshair;
      toolStateRef.current.crosshair = next;
      chart.applyOptions({
        crosshair: {
          mode: next ? CrosshairMode.Normal : CrosshairMode.Hidden,
        },
      });
      return next;
    },
    toggleVolume() {
      const series = volumeSeriesRef.current;
      if (!series) return toolStateRef.current.volume;
      const next = !toolStateRef.current.volume;
      toolStateRef.current.volume = next;
      series.applyOptions({ visible: next });
      return next;
    },
    toggleChartType() {
      const candleSeries = candleSeriesRef.current;
      const lineSeries = lineSeriesRef.current;
      if (!candleSeries || !lineSeries) return toolStateRef.current.candles;
      const next = !toolStateRef.current.candles;
      toolStateRef.current.candles = next;
      candleSeries.applyOptions({ visible: next });
      lineSeries.applyOptions({ visible: !next });
      return next;
    },
    toggleIndicator(name) {
      const mapping = {
        ema20: ema20Ref.current,
        ema50: ema50Ref.current,
        bollinger: [bbMiddleRef.current, bbUpperRef.current, bbLowerRef.current],
      };
      const target = mapping[name];
      if (!target) return false;
      const current = toolStateRef.current[name];
      const next = !current;
      toolStateRef.current[name] = next;
      if (Array.isArray(target)) {
        target.forEach((series) => series?.applyOptions({ visible: next }));
      } else {
        target.applyOptions({ visible: next });
      }
      return next;
    },
    zoom(direction) {
      const chart = chartRef.current;
      if (!chart) return;
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      const center = (range.from + range.to) / 2;
      const half = (range.to - range.from) / 2;
      const factor = direction === "in" ? 0.78 : 1.28;
      chart.timeScale().setVisibleLogicalRange({
        from: center - (half * factor),
        to: center + (half * factor),
      });
      followRealtimeRef.current = false;
    },
    reset() {
      const chart = chartRef.current;
      if (!chart) return;
      chart.timeScale().fitContent();
      followRealtimeRef.current = true;
      hasFittedRef.current = true;
    },
    toggleAutoScale() {
      const chart = chartRef.current;
      if (!chart) return toolStateRef.current.autoScale;
      const next = !toolStateRef.current.autoScale;
      toolStateRef.current.autoScale = next;
      chart.priceScale("right").setAutoScale(next);
      return next;
    },
    fullscreen() {
      const node = shellRef.current;
      if (!node) return;
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        node.requestFullscreen?.();
      }
    },
    getState() {
      return { ...toolStateRef.current };
    },
  }), []);

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
    const accent = styles.getPropertyValue("--accent").trim();
    const muted = styles.getPropertyValue("--text-muted").trim();

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
        vertLine: { color: accent, width: 1, labelBackgroundColor: accent },
        horzLine: { color: muted, width: 1, labelBackgroundColor: accent },
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

    const lineSeries = chart.addSeries(LineSeries, {
      color: accent,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      visible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: volumeUp,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const ema20 = chart.addSeries(LineSeries, {
      color: accent,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false,
    });

    const ema50 = chart.addSeries(LineSeries, {
      color: muted,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false,
    });

    const bbMiddle = chart.addSeries(LineSeries, {
      color: accent,
      lineWidth: 1,
      lineStyle: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false,
    });

    const bbUpper = chart.addSeries(LineSeries, {
      color: muted,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false,
    });

    const bbLower = chart.addSeries(LineSeries, {
      color: muted,
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false,
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
    lineSeriesRef.current = lineSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20Ref.current = ema20;
    ema50Ref.current = ema50;
    bbMiddleRef.current = bbMiddle;
    bbUpperRef.current = bbUpper;
    bbLowerRef.current = bbLower;
    toolStateRef.current = {
      crosshair: true,
      volume: true,
      candles: true,
      ema20: false,
      ema50: false,
      bollinger: false,
      autoScale: true,
    };

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
      lineSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      bbMiddleRef.current = null;
      bbUpperRef.current = null;
      bbLowerRef.current = null;
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
        volume: Math.max(Number(item.volume || 0), 0),
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

    const closes = unique.map((item) => item.close);
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const bands = bollinger(closes, 20, 2);

    const asLine = (values) => unique
      .map((item, index) => ({
        time: item.time,
        value: values[index],
      }))
      .filter((item) => Number.isFinite(item.value));

    candleSeriesRef.current.setData(unique);
    lineSeriesRef.current.setData(unique.map((item) => ({ time: item.time, value: item.close })));
    volumeSeriesRef.current.setData(
      unique.map((item) => ({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open
          ? getComputedStyle(document.documentElement).getPropertyValue("--chart-volume-up").trim()
          : getComputedStyle(document.documentElement).getPropertyValue("--chart-volume-down").trim(),
      }))
    );
    ema20Ref.current?.setData(asLine(ema20));
    ema50Ref.current?.setData(asLine(ema50));
    bbMiddleRef.current?.setData(asLine(bands.middle));
    bbUpperRef.current?.setData(asLine(bands.upper));
    bbLowerRef.current?.setData(asLine(bands.lower));

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
    <div ref={shellRef} className="market-chart">
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
  );
});

export default MarketChart;
