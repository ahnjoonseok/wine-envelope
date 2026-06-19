"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  getAppearanceGradientColors,
  type TastingEnvelope,
  type TastingSectionKey,
} from "@/app/_lib/wine";

type TastingEnvelopeChartProps = {
  appearanceColor?: string;
  className?: string;
  disabled?: boolean;
  onChange?: (nextValue: TastingEnvelope) => void;
  surface?: "default" | "plain";
  showBottomAxis?: boolean;
  showSectionLabels?: boolean;
  value: TastingEnvelope;
  variant?: "editor" | "preview";
};

type ChartPoint = {
  x: number;
  y: number;
};

type ActiveHandleKey = TastingSectionKey | "finishCurve";

const CHART_WIDTH = 360;
const CHART_HEIGHT = 220;
const CHART_TOP = 28;
const CHART_BOTTOM = 184;
const COMPACT_PREVIEW_CHART_TOP = 18;
const COMPACT_PREVIEW_CHART_BOTTOM = 218;
const AXIS_LEFT = 24;
const AXIS_RIGHT = 336;
const SECTION_WIDTH = (AXIS_RIGHT - AXIS_LEFT) / 3;
const AROMA_X = AXIS_LEFT + SECTION_WIDTH * 0.5;
const PALATE_X = AXIS_LEFT + SECTION_WIDTH * 1.5;
const FINISH_CENTER_X = AXIS_LEFT + SECTION_WIDTH * 2.5;
const FINISH_RANGE = 72;
const FINISH_LEFT = FINISH_CENTER_X - FINISH_RANGE / 2;
const FINISH_RIGHT = FINISH_CENTER_X + FINISH_RANGE / 2;
const FINISH_CURVE_ENTRY_OFFSET = 38;
const FINISH_CURVE_HANDLE_MIN_X = PALATE_X + 22;
const FINISH_CURVE_HANDLE_END_PADDING = 12;

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function intensityToCanvasY(
  value: number,
  chartTop: number,
  chartBottom: number,
) {
  return chartBottom - clampUnit(value) * (chartBottom - chartTop);
}

function finishToCanvasX(value: number) {
  return FINISH_LEFT + clampUnit(value) * (FINISH_RIGHT - FINISH_LEFT);
}

function getFinishCurveXBounds(finishX: number) {
  const minX = FINISH_CURVE_HANDLE_MIN_X;
  const maxX = Math.max(minX + 12, finishX - FINISH_CURVE_HANDLE_END_PADDING);

  return { maxX, minX };
}

function finishCurveToCanvasX(value: number, finishX: number) {
  const { maxX, minX } = getFinishCurveXBounds(finishX);
  return minX + clampUnit(value) * (maxX - minX);
}

function canvasXToFinishCurve(value: number, finishX: number) {
  const { maxX, minX } = getFinishCurveXBounds(finishX);

  if (maxX === minX) {
    return 1;
  }

  return clampUnit((value - minX) / (maxX - minX));
}

export function getTastingSectionAnchorPercentages() {
  return {
    aroma: (AROMA_X / CHART_WIDTH) * 100,
    palate: (PALATE_X / CHART_WIDTH) * 100,
    finish: (FINISH_CENTER_X / CHART_WIDTH) * 100,
  };
}

function getEnvelopePoints(
  value: TastingEnvelope,
  chartTop: number,
  chartBottom: number,
): Record<ActiveHandleKey | TastingSectionKey, ChartPoint> {
  const finishX = finishToCanvasX(value.finish.x);

  return {
    aroma: {
      x: AROMA_X,
      y: intensityToCanvasY(value.aroma.y, chartTop, chartBottom),
    },
    palate: {
      x: PALATE_X,
      y: intensityToCanvasY(value.palate.y, chartTop, chartBottom),
    },
    finish: {
      x: finishX,
      y: chartBottom,
    },
    finishCurve: {
      x: finishCurveToCanvasX(value.finish.curve.x, finishX),
      y: intensityToCanvasY(value.finish.curve.y, chartTop, chartBottom),
    },
  };
}

function buildEnvelopePath(
  value: TastingEnvelope,
  chartTop: number,
  chartBottom: number,
) {
  const points = getEnvelopePoints(value, chartTop, chartBottom);

  return [
    `M ${points.aroma.x} ${points.aroma.y}`,
    `C ${points.aroma.x + 44} ${points.aroma.y}, ${points.palate.x - 42} ${points.palate.y}, ${points.palate.x} ${points.palate.y}`,
    `C ${points.palate.x + FINISH_CURVE_ENTRY_OFFSET} ${points.palate.y}, ${points.finishCurve.x} ${points.finishCurve.y}, ${points.finish.x} ${points.finish.y}`,
  ].join(" ");
}

function buildEnvelopeAreaPath(
  value: TastingEnvelope,
  chartTop: number,
  chartBottom: number,
) {
  const points = getEnvelopePoints(value, chartTop, chartBottom);

  return [
    `M ${points.aroma.x} ${chartBottom}`,
    `L ${points.aroma.x} ${points.aroma.y}`,
    `C ${points.aroma.x + 44} ${points.aroma.y}, ${points.palate.x - 42} ${points.palate.y}, ${points.palate.x} ${points.palate.y}`,
    `C ${points.palate.x + FINISH_CURVE_ENTRY_OFFSET} ${points.palate.y}, ${points.finishCurve.x} ${points.finishCurve.y}, ${points.finish.x} ${points.finish.y}`,
    `L ${points.finish.x} ${chartBottom}`,
    "Z",
  ].join(" ");
}

export function TastingEnvelopeChart({
  appearanceColor,
  className,
  disabled = false,
  onChange,
  surface = "default",
  showBottomAxis = true,
  showSectionLabels = true,
  value,
  variant = "editor",
}: TastingEnvelopeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePoint, setActivePoint] = useState<ActiveHandleKey | null>(null);
  const backgroundGradientId = useId();
  const areaGradientId = useId();
  const isPreview = variant === "preview";
  const {
    base: chartColor,
    end: chartColorEnd,
    isLight: isLightAppearance,
    start: chartColorStart,
  } = getAppearanceGradientColors(appearanceColor);
  const isPlainSurface = surface === "plain";
  const usesCompactPreviewLayout =
    isPreview && isPlainSurface && !showBottomAxis && !showSectionLabels;
  const chartTop = usesCompactPreviewLayout ? COMPACT_PREVIEW_CHART_TOP : CHART_TOP;
  const chartBottom = usesCompactPreviewLayout
    ? COMPACT_PREVIEW_CHART_BOTTOM
    : CHART_BOTTOM;
  const points = getEnvelopePoints(value, chartTop, chartBottom);
  const path = buildEnvelopePath(value, chartTop, chartBottom);
  const areaPath = buildEnvelopeAreaPath(value, chartTop, chartBottom);

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    if (!activePoint || disabled || !onChange) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const canvasX = ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH;
    const canvasY =
      ((event.clientY - bounds.top) / bounds.height) * CHART_HEIGHT;
    const nextY = clampUnit(
      (chartBottom - canvasY) / (chartBottom - chartTop),
    );

    if (activePoint === "aroma") {
      onChange({
        ...value,
        aroma: {
          y: nextY,
        },
      });
      return;
    }

    if (activePoint === "palate") {
      onChange({
        ...value,
        palate: {
          y: nextY,
        },
      });
      return;
    }

    if (activePoint === "finishCurve") {
      const finishX = finishToCanvasX(value.finish.x);

      onChange({
        ...value,
        finish: {
          ...value.finish,
          curve: {
            x: canvasXToFinishCurve(canvasX, finishX),
            y: nextY,
          },
        },
      });
      return;
    }

    onChange({
      ...value,
      finish: {
        ...value.finish,
        x: clampUnit((canvasX - FINISH_LEFT) / (FINISH_RIGHT - FINISH_LEFT)),
        y: 0,
      },
    });
  });

  useEffect(() => {
    if (!activePoint) {
      return;
    }

    function handlePointerUp() {
      setActivePoint(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activePoint, handlePointerMove]);

  function handlePointerDown(
    point: ActiveHandleKey,
    event: ReactPointerEvent<SVGCircleElement>,
  ) {
    if (disabled || !onChange) {
      return;
    }

    event.preventDefault();
    setActivePoint(point);
  }

  const containerClassName = className ?? (isPreview ? "h-40" : "h-64");

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${containerClassName} ${
        isPlainSurface
          ? ""
          : "overflow-hidden rounded-[1.5rem] border border-black/8 bg-neutral-50"
      }`}
    >
      <svg
        aria-label="Tasting envelope chart"
        className="h-full w-full"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        {!isPlainSurface && (
          <rect
            fill={`url(#${backgroundGradientId})`}
            height={CHART_HEIGHT}
            rx="24"
            width={CHART_WIDTH}
            x="0"
            y="0"
          />
        )}

        <defs>
          <linearGradient id={backgroundGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>

          <linearGradient id={areaGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor={isLightAppearance ? chartColorStart : chartColor}
              stopOpacity={isLightAppearance ? "0.92" : "0.54"}
            />
            <stop
              offset="62%"
              stopColor={chartColor}
              stopOpacity={isLightAppearance ? "0.78" : "0.82"}
            />
            <stop
              offset="100%"
              stopColor={isLightAppearance ? chartColor : chartColorEnd}
              stopOpacity={isLightAppearance ? "0.92" : "0.98"}
            />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = chartBottom - ratio * (chartBottom - chartTop);

          return (
            <line
              key={ratio}
              stroke="rgba(15, 23, 42, 0.08)"
              strokeDasharray="4 8"
              x1={AXIS_LEFT}
              x2={AXIS_RIGHT}
              y1={y}
              y2={y}
            />
          );
        })}

        {showBottomAxis && (
          <line
            stroke="rgba(15, 23, 42, 0.1)"
            x1={AXIS_LEFT}
            x2={AXIS_RIGHT}
            y1={chartBottom}
            y2={chartBottom}
          />
        )}

        <path d={areaPath} fill={`url(#${areaGradientId})`} />

        {!isPreview && (
          <line
            stroke="rgba(71, 85, 105, 0.42)"
            strokeDasharray="5 5"
            strokeLinecap="round"
            x1={points.finishCurve.x}
            x2={points.finish.x}
            y1={points.finishCurve.y}
            y2={points.finish.y}
          />
        )}

        <path
          d={path}
          fill="none"
          stroke="#111827"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />

        {!isPreview && (
          <circle
            cx={points.finishCurve.x}
            cy={points.finishCurve.y}
            fill="#f8fafc"
            onPointerDown={(event) => handlePointerDown("finishCurve", event)}
            r={activePoint === "finishCurve" ? 10 : 7}
            stroke="#475569"
            strokeWidth={activePoint === "finishCurve" ? 3 : 2.5}
            style={{
              cursor: disabled || !onChange ? "default" : "move",
            }}
          />
        )}

        {(
          [
            { key: "aroma", label: "Aroma" },
            { key: "palate", label: "Palate" },
            { key: "finish", label: "Finish" },
          ] as const
        ).map((item) => {
          const point = points[item.key];
          const isActive = activePoint === item.key;

          return (
            <g key={item.key}>
              <circle
                cx={point.x}
                cy={point.y}
                fill={isPreview ? "#111827" : "#ffffff"}
                onPointerDown={(event) => handlePointerDown(item.key, event)}
                r={isPreview ? 5 : isActive ? 13 : 10}
                stroke={isPreview ? "transparent" : "#111827"}
                strokeWidth={isPreview ? 0 : isActive ? 4 : 3}
                style={{
                  cursor:
                    disabled || !onChange
                      ? "default"
                      : item.key === "finish"
                        ? "ew-resize"
                        : "ns-resize",
                }}
              />
              {showSectionLabels && (
                <text
                  fill="#6b7280"
                  fontSize={12}
                  fontWeight={600}
                  textAnchor="middle"
                  x={point.x}
                  y={CHART_BOTTOM + 22}
                >
                  {item.label}
                </text>
              )}
            </g>
          );
        })}

        {!isPreview && (
          <>
            <text
              fill="#6b7280"
              fontSize={11}
              fontWeight={500}
                  x="20"
              y={chartTop + 4}
            >
              강함
            </text>
            <text
              fill="#9ca3af"
              fontSize={11}
              fontWeight={500}
              x="20"
              y={chartBottom - 2}
            >
              섬세함
            </text>
            <text
              fill="#9ca3af"
              fontSize={11}
              fontWeight={500}
              textAnchor="start"
              x={FINISH_LEFT}
              y={chartBottom + 42}
            >
              짧음
            </text>
            <text
              fill="#6b7280"
              fontSize={11}
              fontWeight={500}
              textAnchor="end"
              x={FINISH_RIGHT}
              y={chartBottom + 42}
            >
              김
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
