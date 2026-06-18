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
  parseAppearanceColor,
  type TastingEnvelope,
  type TastingSectionKey,
} from "@/app/_lib/wine";

type TastingEnvelopeChartProps = {
  appearanceColor?: string;
  disabled?: boolean;
  onChange?: (nextValue: TastingEnvelope) => void;
  value: TastingEnvelope;
  variant?: "editor" | "preview";
};

type ChartPoint = {
  x: number;
  y: number;
};

const CHART_WIDTH = 360;
const CHART_HEIGHT = 220;
const CHART_TOP = 28;
const CHART_BOTTOM = 184;
const AROMA_X = 76;
const PALATE_X = 180;
const FINISH_LEFT = 250;
const FINISH_RIGHT = 322;

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function intensityToCanvasY(value: number) {
  return CHART_BOTTOM - clampUnit(value) * (CHART_BOTTOM - CHART_TOP);
}

function finishToCanvasX(value: number) {
  return FINISH_LEFT + clampUnit(value) * (FINISH_RIGHT - FINISH_LEFT);
}

function getEnvelopePoints(value: TastingEnvelope): Record<TastingSectionKey, ChartPoint> {
  return {
    aroma: {
      x: AROMA_X,
      y: intensityToCanvasY(value.aroma.y),
    },
    palate: {
      x: PALATE_X,
      y: intensityToCanvasY(value.palate.y),
    },
    finish: {
      x: finishToCanvasX(value.finish.x),
      y: intensityToCanvasY(value.finish.y),
    },
  };
}

function buildEnvelopePath(value: TastingEnvelope) {
  const points = getEnvelopePoints(value);

  return [
    `M ${points.aroma.x} ${points.aroma.y}`,
    `C ${points.aroma.x + 44} ${points.aroma.y}, ${points.palate.x - 42} ${points.palate.y}, ${points.palate.x} ${points.palate.y}`,
    `S ${points.finish.x - 40} ${points.finish.y}, ${points.finish.x} ${points.finish.y}`,
  ].join(" ");
}

function buildEnvelopeAreaPath(value: TastingEnvelope) {
  const points = getEnvelopePoints(value);

  return [
    `M ${points.aroma.x} ${CHART_BOTTOM}`,
    `L ${points.aroma.x} ${points.aroma.y}`,
    `C ${points.aroma.x + 44} ${points.aroma.y}, ${points.palate.x - 42} ${points.palate.y}, ${points.palate.x} ${points.palate.y}`,
    `S ${points.finish.x - 40} ${points.finish.y}, ${points.finish.x} ${points.finish.y}`,
    `L ${points.finish.x} ${CHART_BOTTOM}`,
    "Z",
  ].join(" ");
}

export function TastingEnvelopeChart({
  appearanceColor,
  disabled = false,
  onChange,
  value,
  variant = "editor",
}: TastingEnvelopeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePoint, setActivePoint] = useState<TastingSectionKey | null>(null);
  const backgroundGradientId = useId();
  const areaGradientId = useId();

  const points = getEnvelopePoints(value);
  const path = buildEnvelopePath(value);
  const areaPath = buildEnvelopeAreaPath(value);
  const isPreview = variant === "preview";
  const chartColor = parseAppearanceColor(appearanceColor);

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
      (CHART_BOTTOM - canvasY) / (CHART_BOTTOM - CHART_TOP),
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

    onChange({
      ...value,
      finish: {
        x: clampUnit((canvasX - FINISH_LEFT) / (FINISH_RIGHT - FINISH_LEFT)),
        y: nextY,
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
    point: TastingSectionKey,
    event: ReactPointerEvent<SVGCircleElement>,
  ) {
    if (disabled || !onChange) {
      return;
    }

    event.preventDefault();
    setActivePoint(point);
  }

  const containerClassName = isPreview ? "h-40" : "h-64";

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${containerClassName} overflow-hidden rounded-[1.5rem] border border-black/8 bg-neutral-50`}
    >
      <svg
        aria-label="Tasting envelope chart"
        className="h-full w-full"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        <rect
          fill={`url(#${backgroundGradientId})`}
          height={CHART_HEIGHT}
          rx="24"
          width={CHART_WIDTH}
          x="0"
          y="0"
        />

        <defs>
          <linearGradient id={backgroundGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>

          <linearGradient id={areaGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.1" />
            <stop offset="70%" stopColor={chartColor} stopOpacity="0.36" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0.78" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = CHART_BOTTOM - ratio * (CHART_BOTTOM - CHART_TOP);

          return (
            <line
              key={ratio}
              stroke="rgba(15, 23, 42, 0.08)"
              strokeDasharray="4 8"
              x1="36"
              x2="332"
              y1={y}
              y2={y}
            />
          );
        })}

        <line
          stroke="rgba(15, 23, 42, 0.1)"
          x1="36"
          x2="332"
          y1={CHART_BOTTOM}
          y2={CHART_BOTTOM}
        />

        <path d={areaPath} fill={`url(#${areaGradientId})`} />

        <path
          d={path}
          fill="none"
          stroke="#111827"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />

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
                        ? "grab"
                        : "ns-resize",
                }}
              />
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
              y={CHART_TOP + 4}
            >
              강함
            </text>
            <text
              fill="#9ca3af"
              fontSize={11}
              fontWeight={500}
              x="20"
              y={CHART_BOTTOM - 2}
            >
              섬세함
            </text>
            <text
              fill="#9ca3af"
              fontSize={11}
              fontWeight={500}
              textAnchor="start"
              x={FINISH_LEFT}
              y={CHART_BOTTOM + 42}
            >
              짧음
            </text>
            <text
              fill="#6b7280"
              fontSize={11}
              fontWeight={500}
              textAnchor="end"
              x={FINISH_RIGHT}
              y={CHART_BOTTOM + 42}
            >
              김
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
