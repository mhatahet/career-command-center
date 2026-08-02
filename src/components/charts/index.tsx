/* ============================================================================
   Charts
   ----------------------------------------------------------------------------
   Every chart is a pure function of its props into SVG. They share one visual
   language: 10px tabular labels, token-driven colour, a 1px grid, and hover
   readouts through the same `chart-tip` element.

   Deliberately no charting library — the whole set is smaller than one, every
   mark theme-switches for free, and there is no second theming system to keep
   in sync with the design tokens.
   ========================================================================= */

import { useMemo, useRef, useState, type ReactNode } from 'react'

import { formatCompact } from '../../lib/dates'
import './charts.css'

/** The categorical series palette. Any prefix of this list stays legible. */
export const SERIES = [
  'var(--viz-1)',
  'var(--viz-2)',
  'var(--viz-3)',
  'var(--viz-4)',
  'var(--viz-5)',
  'var(--viz-6)',
  'var(--viz-7)',
  'var(--viz-8)',
] as const

export function seriesColor(index: number): string {
  return SERIES[index % SERIES.length]
}

/* ============================================================== tooltip == */

interface TipState {
  x: number
  y: number
  title: string
  rows: { label: string; value: string; color?: string }[]
}

function ChartTip({ tip }: { tip: TipState | null }) {
  if (!tip) return null
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      <div className="chart-tip__title">{tip.title}</div>
      {tip.rows.map((row) => (
        <div className="chart-tip__row" key={row.label}>
          {row.color ? <span className="chart-tip__swatch" style={{ background: row.color }} /> : null}
          <span>{row.label}</span>
          <strong style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>{row.value}</strong>
        </div>
      ))}
    </div>
  )
}

/* ================================================================ legend == */

export function ChartLegend({
  items,
  variant = 'swatch',
}: {
  items: { label: string; color: string; value?: string }[]
  variant?: 'swatch' | 'line'
}) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span className="chart-legend__item" key={item.label}>
          <span
            className={`chart-legend__swatch${variant === 'line' ? ' chart-legend__swatch--line' : ''}`}
            style={{ background: item.color }}
          />
          <span className="truncate">{item.label}</span>
          {item.value ? <span className="chart-legend__value">{item.value}</span> : null}
        </span>
      ))}
    </div>
  )
}

/* ========================================================== radar chart == */

export interface RadarSeries {
  label: string
  color: string
  /** Values in the same order as `axes`, on the 0…max scale. */
  values: number[]
  fillOpacity?: number
  dashed?: boolean
}

/**
 * Spider chart for the sixteen competencies. Axis labels are placed radially and
 * anchored by quadrant so long names never overlap the shape.
 */
export function RadarChart({
  axes,
  series,
  max = 10,
  size = 340,
  rings = 5,
  /** Axis labels rendered in the danger colour — used for below-target skills. */
  weakAxes = [],
  onAxisClick,
}: {
  axes: string[]
  series: RadarSeries[]
  max?: number
  size?: number
  rings?: number
  weakAxes?: string[]
  onAxisClick?: (axis: string, index: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  // Generous label margin: sixteen axes means labels at every angle.
  const labelMargin = 62
  const radius = (size - labelMargin * 2) / 2
  const cx = size / 2
  const cy = size / 2
  const count = axes.length

  const angleFor = (index: number) => (index / count) * Math.PI * 2 - Math.PI / 2

  const pointAt = (index: number, value: number) => {
    const angle = angleFor(index)
    const r = (Math.max(0, Math.min(max, value)) / max) * radius
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const
  }

  const polygon = (values: number[]) =>
    values.map((v, i) => pointAt(i, v).map((n) => n.toFixed(1)).join(',')).join(' ')

  const weak = new Set(weakAxes)

  return (
    <svg className="chart" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Competency radar">
      {/* Concentric rings */}
      <g className="chart__radar-grid">
        {Array.from({ length: rings }, (_, ring) => {
          const r = ((ring + 1) / rings) * radius
          const points = Array.from({ length: count }, (_, i) => {
            const angle = angleFor(i)
            return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`
          }).join(' ')
          return <polygon key={ring} points={points} />
        })}
      </g>

      {/* Spokes */}
      <g className="chart__radar-spoke">
        {axes.map((axis, i) => {
          const [x, y] = pointAt(i, max)
          return <line key={axis} x1={cx} y1={cy} x2={x} y2={y} />
        })}
      </g>

      {/* Ring scale labels along the vertical axis */}
      <g className="chart__label">
        {Array.from({ length: rings }, (_, ring) => {
          const value = ((ring + 1) / rings) * max
          const r = ((ring + 1) / rings) * radius
          return (
            <text key={ring} x={cx + 4} y={cy - r + 3} textAnchor="start">
              {value % 1 === 0 ? value : value.toFixed(1)}
            </text>
          )
        })}
      </g>

      {/* Series, drawn back to front so the first is on top */}
      {[...series].reverse().map((s) => (
        <polygon
          key={s.label}
          className="chart__radar-shape"
          points={polygon(s.values)}
          fill={s.color}
          fillOpacity={s.fillOpacity ?? 0.16}
          stroke={s.color}
          strokeDasharray={s.dashed ? '5 4' : undefined}
        />
      ))}

      {/* Vertices on the primary series */}
      {series[0]
        ? series[0].values.map((value, i) => {
            const [x, y] = pointAt(i, value)
            return (
              <circle
                key={axes[i]}
                cx={x}
                cy={y}
                r={hover === i ? 4.5 : 3}
                fill={series[0].color}
                className="chart__dot"
              />
            )
          })
        : null}

      {/* Axis labels */}
      {axes.map((axis, i) => {
        const angle = angleFor(i)
        const lx = cx + Math.cos(angle) * (radius + 16)
        const ly = cy + Math.sin(angle) * (radius + 16)
        const cos = Math.cos(angle)
        // Anchor by horizontal position so text grows away from the chart.
        const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end'
        const words = axis.split(' ')
        // Wrap two-word labels onto two lines to keep the footprint tight.
        const lines = words.length > 1 && axis.length > 11 ? [words[0], words.slice(1).join(' ')] : [axis]

        return (
          <text
            key={axis}
            x={lx}
            y={ly + (lines.length > 1 ? -3 : 3)}
            textAnchor={anchor}
            className={`chart__radar-label${weak.has(axis) ? ' chart__radar-label--weak' : ''}`}
            style={{ cursor: onAxisClick ? 'pointer' : 'default' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onAxisClick?.(axis, i)}
          >
            {lines.map((line, li) => (
              <tspan key={line} x={lx} dy={li === 0 ? 0 : 11}>
                {line}
              </tspan>
            ))}
          </text>
        )
      })}
    </svg>
  )
}

/* =========================================================== line chart == */

export interface LineSeries {
  label: string
  color: string
  points: { x: string; y: number }[]
  dashed?: boolean
  fill?: boolean
}

export function LineChart({
  series,
  height = 200,
  yMin,
  yMax,
  yTicks = 4,
  formatY = (v: number) => String(Math.round(v)),
  formatX = (v: string) => v,
  /** Draw a horizontal reference line, e.g. the target score. */
  referenceY,
  referenceLabel,
  xLabelEvery,
}: {
  series: LineSeries[]
  height?: number
  yMin?: number
  yMax?: number
  yTicks?: number
  formatY?: (value: number) => string
  formatX?: (value: string) => string
  referenceY?: number
  referenceLabel?: string
  xLabelEvery?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TipState | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // A fixed viewBox width with `preserveAspectRatio: none` on the x-axis would
  // distort strokes, so instead the chart uses a nominal 640-unit coordinate
  // space and scales via CSS width — strokes stay 2px because vector-effect
  // is not needed at this modest scale factor.
  const width = 640
  const padding = { top: 12, right: 12, bottom: 24, left: 40 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const xLabels = series[0]?.points.map((p) => p.x) ?? []
  const allValues = series.flatMap((s) => s.points.map((p) => p.y))
  if (referenceY !== undefined) allValues.push(referenceY)

  const lo = yMin ?? Math.min(...allValues, 0)
  const hi = yMax ?? Math.max(...allValues, 1)
  const span = hi - lo || 1

  const xAt = (index: number) =>
    padding.left + (xLabels.length <= 1 ? plotW / 2 : (index / (xLabels.length - 1)) * plotW)
  const yAt = (value: number) => padding.top + plotH - ((value - lo) / span) * plotH

  const labelStep = xLabelEvery ?? Math.max(1, Math.ceil(xLabels.length / 8))

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (xLabels.length === 0 || !wrapRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = width / rect.width
    const localX = (event.clientX - rect.left) * scale
    const ratio = (localX - padding.left) / plotW
    const index = Math.round(ratio * Math.max(1, xLabels.length - 1))
    if (index < 0 || index >= xLabels.length) return

    setHoverIndex(index)
    setTip({
      x: (xAt(index) / scale) * 1,
      y: rect.height * (yAt(Math.max(...series.map((s) => s.points[index]?.y ?? lo))) / height),
      title: formatX(xLabels[index]),
      rows: series.map((s) => ({
        label: s.label,
        value: s.points[index] ? formatY(s.points[index].y) : '—',
        color: s.color,
      })),
    })
  }

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        style={{ height }}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => {
          setTip(null)
          setHoverIndex(null)
        }}
        role="img"
      >
        {/* Horizontal grid + y labels */}
        <g className="chart__grid">
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const value = lo + (span * i) / yTicks
            const y = yAt(value)
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
                <text className="chart__label" x={padding.left - 6} y={y + 3} textAnchor="end">
                  {formatY(value)}
                </text>
              </g>
            )
          })}
        </g>

        {/* Reference line */}
        {referenceY !== undefined ? (
          <g>
            <line
              x1={padding.left}
              y1={yAt(referenceY)}
              x2={width - padding.right}
              y2={yAt(referenceY)}
              stroke="var(--success)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.7}
            />
            {referenceLabel ? (
              <text
                className="chart__label chart__label--strong"
                x={width - padding.right}
                y={yAt(referenceY) - 5}
                textAnchor="end"
                fill="var(--success-text)"
              >
                {referenceLabel}
              </text>
            ) : null}
          </g>
        ) : null}

        {/* Hover guide */}
        {hoverIndex !== null ? (
          <line
            className="chart__guide"
            x1={xAt(hoverIndex)}
            y1={padding.top}
            x2={xAt(hoverIndex)}
            y2={padding.top + plotH}
          />
        ) : null}

        {/* Series */}
        {series.map((s, si) => {
          if (s.points.length === 0) return null
          const path = s.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.y).toFixed(1)}`)
            .join(' ')
          const gradientId = `line-fill-${si}`

          return (
            <g key={s.label}>
              {s.fill ? (
                <>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity="0.24" />
                      <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    className="chart__area"
                    d={`${path} L${xAt(s.points.length - 1).toFixed(1)},${padding.top + plotH} L${xAt(0).toFixed(1)},${padding.top + plotH} Z`}
                    fill={`url(#${gradientId})`}
                  />
                </>
              ) : null}
              <path
                className={`chart__line${s.dashed ? ' chart__line--dashed' : ''}`}
                d={path}
                stroke={s.color}
                vectorEffect="non-scaling-stroke"
              />
              {s.points.map((p, i) => (
                <circle
                  key={p.x}
                  className="chart__dot"
                  cx={xAt(i)}
                  cy={yAt(p.y)}
                  r={hoverIndex === i ? 4 : s.points.length > 20 ? 0 : 2.5}
                  fill={s.color}
                />
              ))}
            </g>
          )
        })}

        {/* X labels */}
        <g className="chart__axis">
          <line x1={padding.left} y1={padding.top + plotH} x2={width - padding.right} y2={padding.top + plotH} />
        </g>
        <g>
          {xLabels.map((label, i) =>
            i % labelStep === 0 || i === xLabels.length - 1 ? (
              <text
                key={label}
                className="chart__label chart__label--axis"
                x={xAt(i)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
              >
                {formatX(label)}
              </text>
            ) : null,
          )}
        </g>
      </svg>
      <ChartTip tip={tip} />
    </div>
  )
}

/* ============================================================ bar chart == */

export function BarChart({
  data,
  height = 200,
  color,
  formatValue = (v: number) => formatCompact(v),
  horizontal,
  target,
}: {
  data: { label: string; value: number; color?: string; sublabel?: string }[]
  height?: number
  color?: string
  formatValue?: (value: number) => string
  horizontal?: boolean
  /** Reference line, e.g. the weekly hour target. */
  target?: number
}) {
  const [tip, setTip] = useState<TipState | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const max = Math.max(...data.map((d) => d.value), target ?? 0, 1)

  if (horizontal) {
    // Horizontal bars are laid out with divs: labels wrap naturally and the
    // rows stay readable at any width, which SVG text does not.
    return (
      <div className="col" style={{ gap: 'var(--space-3)' }}>
        {data.map((d, i) => (
          <div key={d.label} className="col" style={{ gap: 4 }}>
            <div className="row row--between">
              <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {d.label}
              </span>
              <span className="text-xs tnum shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                {formatValue(d.value)}
                {d.sublabel ? <span style={{ color: 'var(--text-quaternary)' }}> · {d.sublabel}</span> : null}
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--track)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(d.value / max) * 100}%`,
                  height: '100%',
                  background: d.color ?? color ?? seriesColor(i),
                  borderRadius: 999,
                  transition: 'width var(--dur-slow) var(--ease-out)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const width = 640
  const padding = { top: 12, right: 8, bottom: 26, left: 36 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const slot = plotW / Math.max(1, data.length)
  const barWidth = Math.max(3, Math.min(38, slot * 0.62))
  const labelStep = Math.max(1, Math.ceil(data.length / 12))

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} style={{ height }} preserveAspectRatio="none" role="img">
        <g className="chart__grid">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + plotH - ratio * plotH
            return (
              <g key={ratio}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
                <text className="chart__label" x={padding.left - 6} y={y + 3} textAnchor="end">
                  {formatValue(max * ratio)}
                </text>
              </g>
            )
          })}
        </g>

        {target !== undefined ? (
          <line
            x1={padding.left}
            y1={padding.top + plotH - (target / max) * plotH}
            x2={width - padding.right}
            y2={padding.top + plotH - (target / max) * plotH}
            stroke="var(--warning)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            opacity={0.8}
          />
        ) : null}

        {data.map((d, i) => {
          const barHeight = (d.value / max) * plotH
          const x = padding.left + slot * i + (slot - barWidth) / 2
          const y = padding.top + plotH - barHeight
          return (
            <rect
              key={`${d.label}-${i}`}
              className="chart__bar"
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(0, barHeight)}
              rx={2}
              fill={d.color ?? color ?? 'var(--accent)'}
              onMouseEnter={(event) => {
                const rect = wrapRef.current?.getBoundingClientRect()
                const barRect = event.currentTarget.getBoundingClientRect()
                if (!rect) return
                setTip({
                  x: barRect.left - rect.left + barRect.width / 2,
                  y: barRect.top - rect.top,
                  title: d.label,
                  rows: [{ label: d.sublabel ?? 'Value', value: formatValue(d.value), color: d.color ?? color ?? 'var(--accent)' }],
                })
              }}
              onMouseLeave={() => setTip(null)}
            />
          )
        })}

        <g className="chart__axis">
          <line x1={padding.left} y1={padding.top + plotH} x2={width - padding.right} y2={padding.top + plotH} />
        </g>
        <g>
          {data.map((d, i) =>
            i % labelStep === 0 ? (
              <text
                key={`${d.label}-l-${i}`}
                className="chart__label chart__label--axis"
                x={padding.left + slot * i + slot / 2}
                y={height - 8}
                textAnchor="middle"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </g>
      </svg>
      <ChartTip tip={tip} />
    </div>
  )
}

/* ========================================================= stacked bars == */

export function StackedBarChart({
  data,
  keys,
  height = 200,
  formatValue = (v: number) => formatCompact(v),
}: {
  data: { label: string; values: Record<string, number> }[]
  keys: { key: string; label: string; color: string }[]
  height?: number
  formatValue?: (value: number) => string
}) {
  const [tip, setTip] = useState<TipState | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const totals = data.map((d) => keys.reduce((sum, k) => sum + (d.values[k.key] ?? 0), 0))
  const max = Math.max(...totals, 1)

  const width = 640
  const padding = { top: 12, right: 8, bottom: 26, left: 36 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const slot = plotW / Math.max(1, data.length)
  const barWidth = Math.max(4, Math.min(42, slot * 0.66))
  const labelStep = Math.max(1, Math.ceil(data.length / 12))

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} style={{ height }} preserveAspectRatio="none" role="img">
        <g className="chart__grid">
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + plotH - ratio * plotH
            return (
              <g key={ratio}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
                <text className="chart__label" x={padding.left - 6} y={y + 3} textAnchor="end">
                  {formatValue(max * ratio)}
                </text>
              </g>
            )
          })}
        </g>

        {data.map((d, i) => {
          const x = padding.left + slot * i + (slot - barWidth) / 2
          let cursor = padding.top + plotH

          return (
            <g
              key={d.label}
              onMouseEnter={(event) => {
                const rect = wrapRef.current?.getBoundingClientRect()
                const groupRect = (event.currentTarget as SVGGElement).getBoundingClientRect()
                if (!rect) return
                setTip({
                  x: groupRect.left - rect.left + groupRect.width / 2,
                  y: groupRect.top - rect.top,
                  title: d.label,
                  rows: keys
                    .filter((k) => (d.values[k.key] ?? 0) > 0)
                    .map((k) => ({ label: k.label, value: formatValue(d.values[k.key] ?? 0), color: k.color })),
                })
              }}
              onMouseLeave={() => setTip(null)}
            >
              {keys.map((k) => {
                const value = d.values[k.key] ?? 0
                if (value <= 0) return null
                const segmentHeight = (value / max) * plotH
                cursor -= segmentHeight
                return (
                  <rect
                    key={k.key}
                    className="chart__bar"
                    x={x}
                    y={cursor}
                    width={barWidth}
                    height={segmentHeight}
                    fill={k.color}
                  />
                )
              })}
            </g>
          )
        })}

        <g className="chart__axis">
          <line x1={padding.left} y1={padding.top + plotH} x2={width - padding.right} y2={padding.top + plotH} />
        </g>
        <g>
          {data.map((d, i) =>
            i % labelStep === 0 ? (
              <text
                key={`${d.label}-l`}
                className="chart__label chart__label--axis"
                x={padding.left + slot * i + slot / 2}
                y={height - 8}
                textAnchor="middle"
              >
                {d.label}
              </text>
            ) : null,
          )}
        </g>
      </svg>
      <ChartTip tip={tip} />
    </div>
  )
}

/* ============================================================== donut == */

export function DonutChart({
  data,
  size = 160,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color?: string }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: ReactNode
}) {
  const [hover, setHover] = useState<string | null>(null)
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius

  let offset = 0

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }} role="img">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth={thickness} />
        {total > 0 &&
          data.map((d, i) => {
            const fraction = d.value / total
            const length = fraction * circumference
            const element = (
              <circle
                key={d.label}
                className="chart__donut-segment"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color ?? seriesColor(i)}
                strokeWidth={hover === d.label ? thickness + 3 : thickness}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                onMouseEnter={() => setHover(d.label)}
                onMouseLeave={() => setHover(null)}
              />
            )
            offset += length
            return element
          })}
      </svg>
      {(centerValue || centerLabel) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
          }}
        >
          <span
            className="tnum"
            style={{ fontSize: size * 0.2, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-tight)' }}
          >
            {centerValue}
          </span>
          {centerLabel ? (
            <span
              style={{
                fontSize: 'var(--text-2xs)',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tracking-wide)',
              }}
            >
              {centerLabel}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ================================================== activity heat map == */

/**
 * GitHub-style contribution calendar. Weeks run in columns, days in rows, which
 * is the layout people already know how to read.
 */
export function ActivityCalendar({
  data,
  weeks = 26,
  endDate,
  cellSize = 11,
  gap = 3,
  formatTip,
  weekStartsOn = 1,
}: {
  /** date → intensity source value (hours). */
  data: Map<string, { hours: number; note?: string; tasks?: number }>
  weeks?: number
  endDate: string
  cellSize?: number
  gap?: number
  formatTip?: (date: string, value: { hours: number; note?: string; tasks?: number } | undefined) => TipState['rows']
  weekStartsOn?: 0 | 1
}) {
  const [tip, setTip] = useState<TipState | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { columns, monthMarks } = useMemo(() => {
    const parse = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1, d, 12))
    }
    const toIso = (date: Date) => date.toISOString().slice(0, 10)

    // Walk back to the start of the week containing endDate.
    const end = parse(endDate)
    const endDow = end.getUTCDay()
    const shift = weekStartsOn === 1 ? (endDow === 0 ? 6 : endDow - 1) : endDow
    const lastWeekStart = new Date(end)
    lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - shift)

    const cols: string[][] = []
    const marks: { column: number; label: string }[] = []
    let lastMonth = -1

    for (let w = weeks - 1; w >= 0; w -= 1) {
      const weekStart = new Date(lastWeekStart)
      weekStart.setUTCDate(weekStart.getUTCDate() - w * 7)
      const days: string[] = []
      for (let d = 0; d < 7; d += 1) {
        const day = new Date(weekStart)
        day.setUTCDate(day.getUTCDate() + d)
        days.push(toIso(day))
      }
      const columnIndex = weeks - 1 - w
      const month = weekStart.getUTCMonth()
      if (month !== lastMonth) {
        marks.push({
          column: columnIndex,
          label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month],
        })
        lastMonth = month
      }
      cols.push(days)
    }

    return { columns: cols, monthMarks: marks }
  }, [endDate, weeks, weekStartsOn])

  // Intensity buckets from the data's own distribution, so a light week still
  // shows contrast rather than a uniform pale grid.
  const values = [...data.values()].map((v) => v.hours).filter((h) => h > 0).sort((a, b) => a - b)
  const quantile = (q: number) => (values.length ? values[Math.floor(q * (values.length - 1))] : 0)
  const thresholds = [quantile(0.25), quantile(0.5), quantile(0.75)]

  const bucketOf = (hours: number) => {
    if (hours <= 0) return 0
    if (hours <= thresholds[0]) return 1
    if (hours <= thresholds[1]) return 2
    if (hours <= thresholds[2]) return 3
    return 4
  }

  const dayLabels = weekStartsOn === 1 ? ['M', '', 'W', '', 'F', '', ''] : ['S', 'M', '', 'W', '', 'F', '']
  const leftGutter = 18
  const topGutter = 13
  const width = leftGutter + columns.length * (cellSize + gap)
  const height = topGutter + 7 * (cellSize + gap)

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <div className="scroll-x">
        <svg width={width} height={height} style={{ display: 'block', minWidth: width }} role="img" aria-label="Activity calendar">
          {monthMarks.map((mark) => (
            <text
              key={`${mark.label}-${mark.column}`}
              className="chart__label"
              x={leftGutter + mark.column * (cellSize + gap)}
              y={9}
            >
              {mark.label}
            </text>
          ))}

          {dayLabels.map((label, row) =>
            label ? (
              <text
                key={row}
                className="chart__label"
                x={0}
                y={topGutter + row * (cellSize + gap) + cellSize - 1}
                fontSize={9}
              >
                {label}
              </text>
            ) : null,
          )}

          {columns.map((days, col) =>
            days.map((date, row) => {
              const entry = data.get(date)
              const bucket = bucketOf(entry?.hours ?? 0)
              const future = date > endDate
              return (
                <rect
                  key={date}
                  className="heat-cell"
                  x={leftGutter + col * (cellSize + gap)}
                  y={topGutter + row * (cellSize + gap)}
                  width={cellSize}
                  height={cellSize}
                  fill={future ? 'transparent' : `var(--heat-${bucket})`}
                  stroke={entry?.note ? 'var(--accent)' : undefined}
                  strokeWidth={entry?.note ? 1 : undefined}
                  onMouseEnter={(event) => {
                    if (future) return
                    const rect = wrapRef.current?.getBoundingClientRect()
                    const cell = event.currentTarget.getBoundingClientRect()
                    if (!rect) return
                    setTip({
                      x: cell.left - rect.left + cell.width / 2,
                      y: cell.top - rect.top,
                      title: date,
                      rows: formatTip
                        ? formatTip(date, entry)
                        : [{ label: 'Hours', value: entry ? entry.hours.toFixed(1) : '0' }],
                    })
                  }}
                  onMouseLeave={() => setTip(null)}
                />
              )
            }),
          )}
        </svg>
      </div>
      <ChartTip tip={tip} />
    </div>
  )
}

export function HeatLegend() {
  return (
    <div className="heat-legend">
      <span>Less</span>
      {[0, 1, 2, 3, 4].map((bucket) => (
        <span key={bucket} className="heat-legend__swatch" style={{ background: `var(--heat-${bucket})` }} />
      ))}
      <span>More</span>
    </div>
  )
}

/* ============================================================ burndown == */

/**
 * Remaining work over time against the ideal line. Shows whether the plan is
 * achievable at the current pace, which is the only question a burndown answers.
 */
export function BurndownChart({
  actual,
  ideal,
  height = 220,
  formatY = (v: number) => `${Math.round(v)}h`,
  formatX = (v: string) => v,
  projection,
}: {
  actual: { x: string; y: number }[]
  ideal: { x: string; y: number }[]
  height?: number
  formatY?: (value: number) => string
  formatX?: (value: string) => string
  /** Dotted extrapolation of the current pace. */
  projection?: { x: string; y: number }[]
}) {
  const series: LineSeries[] = [
    { label: 'Remaining', color: 'var(--accent)', points: actual, fill: true },
    { label: 'Ideal pace', color: 'var(--text-quaternary)', points: ideal, dashed: true },
  ]
  if (projection && projection.length > 1) {
    series.push({ label: 'At current pace', color: 'var(--warning)', points: projection, dashed: true })
  }

  return (
    <div className="col" style={{ gap: 'var(--space-3)' }}>
      <LineChart series={series} height={height} yMin={0} formatY={formatY} formatX={formatX} />
      <ChartLegend
        variant="line"
        items={series.map((s) => ({ label: s.label, color: s.color }))}
      />
    </div>
  )
}

/* =============================================================== bullet == */

/**
 * Current value against a target, with the historical baseline marked.
 * The right chart for the sixteen competency rows: it shows position, direction
 * and destination in one 8px-tall row.
 */
export function Bullet({
  value,
  target,
  baseline,
  max = 10,
  color,
  width,
}: {
  value: number
  target: number
  baseline?: number
  max?: number
  color?: string
  width?: number | string
}) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`
  const reached = value >= target

  return (
    <div className="bullet" style={{ width }}>
      <div className="bullet__track">
        <div
          className="bullet__fill"
          style={{
            width: pct(value),
            background: color ?? (reached ? 'var(--success)' : 'var(--accent)'),
          }}
        />
        {baseline !== undefined && Math.abs(baseline - value) > 0.05 ? (
          <div className="bullet__baseline" style={{ left: pct(baseline) }} title={`Baseline ${baseline.toFixed(1)}`} />
        ) : null}
        <div className="bullet__target" style={{ left: pct(target) }} title={`Target ${target.toFixed(1)}`} />
      </div>
    </div>
  )
}

/* ============================================================ gauge arc == */

/**
 * Semicircular gauge — used for the headline readiness score.
 *
 * Geometry is laid out from the outside in. `size` is the total width, and the
 * outermost thing drawn (the band, or the target tick, whichever is wider) is
 * what touches the edge; the main ring's radius falls out of that. Doing it in
 * this order is what guarantees nothing overflows the SVG box.
 *
 * The band and the tick are positioned by *radius*, never by a translate: a
 * vertical shift is only radial at the top of the arc, and turns tangential at
 * the sides, which slides the band along the ring and cuts it straight through.
 */
export function Gauge({
  value,
  max = 100,
  size = 220,
  thickness = 14,
  target,
  segments,
  children,
}: {
  value: number
  max?: number
  size?: number
  thickness?: number
  target?: number
  /** Coloured zones drawn as a thin band outside the ring, e.g. readiness bands. */
  segments?: { from: number; to: number; color: string }[]
  children?: ReactNode
}) {
  const clamped = Math.max(0, Math.min(max, value))

  const BAND_WIDTH = 3
  const BAND_GAP = 6
  const TICK_LENGTH = 11
  /** Pixel gap between adjacent zones, so they read as separate bands. */
  const SEGMENT_GAP_PX = 3

  const hasBand = Boolean(segments?.length) || target !== undefined
  // How far past the ring's centreline anything is drawn.
  const outerReach = hasBand ? BAND_GAP + Math.max(BAND_WIDTH, TICK_LENGTH) / 2 : 0

  const cx = size / 2
  const cy = size / 2
  const radius = Math.max(1, size / 2 - thickness / 2 - outerReach)
  const bandRadius = radius + thickness / 2 + BAND_GAP
  const height = cy + Math.max(thickness, hasBand ? TICK_LENGTH : 0) / 2 + 2

  const angleFor = (v: number) => Math.PI * (1 - Math.max(0, Math.min(max, v)) / max)

  const pointAt = (v: number, r: number) => {
    const a = angleFor(v)
    return [cx + Math.cos(a) * r, cy - Math.sin(a) * r] as const
  }

  const arc = (from: number, to: number, r: number) => {
    const [x1, y1] = pointAt(from, r)
    const [x2, y2] = pointAt(to, r)
    // No sub-arc of a semicircle can exceed 180°, so large-arc is only set for
    // the full sweep — where either flag draws the same shape anyway.
    const large = to - from >= max ? 1 : 0
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r.toFixed(2)},${r.toFixed(2)} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`
  }

  // Convert the pixel gap into a value delta along the band.
  const gapValue = bandRadius > 0 ? (SEGMENT_GAP_PX / (Math.PI * bandRadius)) * max : 0

  return (
    <div style={{ position: 'relative', width: size, height, flexShrink: 0 }}>
      <svg
        width={size}
        height={height}
        viewBox={`0 0 ${size} ${height}`}
        role="img"
        aria-label={`${value} of ${max}`}
      >
        {/* Track */}
        <path d={arc(0, max, radius)} fill="none" stroke="var(--track)" strokeWidth={thickness} strokeLinecap="round" />

        {/* Value */}
        <path
          d={arc(0, clamped, radius)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {/* Zone band, concentric and outside the ring */}
        {segments?.map((segment) => {
          const from = Math.max(0, segment.from) + gapValue / 2
          const to = Math.min(max, segment.to) - gapValue / 2
          if (to <= from) return null
          return (
            <path
              key={`${segment.from}-${segment.to}`}
              d={arc(from, to, bandRadius)}
              fill="none"
              stroke={segment.color}
              strokeWidth={BAND_WIDTH}
              strokeLinecap="round"
              opacity={0.65}
            />
          )
        })}

        {/* Target tick, radial across the band */}
        {target !== undefined ? (
          <line
            x1={pointAt(target, bandRadius - TICK_LENGTH / 2)[0]}
            y1={pointAt(target, bandRadius - TICK_LENGTH / 2)[1]}
            x2={pointAt(target, bandRadius + TICK_LENGTH / 2)[0]}
            y2={pointAt(target, bandRadius + TICK_LENGTH / 2)[1]}
            stroke="var(--success)"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <title>{`Target ${target}`}</title>
          </line>
        ) : null}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
