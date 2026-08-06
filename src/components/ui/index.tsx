/* ============================================================================
   UI primitives
   ----------------------------------------------------------------------------
   Small, unopinionated building blocks. No domain knowledge lives here — that is
   what keeps the page components readable and the visual language consistent.
   ========================================================================= */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import './ui.css'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

/* ================================================================== Card == */

export function Card({
  children,
  variant = 'default',
  className = '',
  style,
  onClick,
  id,
}: {
  children: ReactNode
  variant?: 'default' | 'flush' | 'inset' | 'accent'
  className?: string
  style?: CSSProperties
  onClick?: () => void
  id?: string
}) {
  const variantClass = variant === 'default' ? '' : ` card--${variant}`
  const interactive = onClick ? ' card--interactive' : ''

  if (onClick) {
    return (
      <div
        id={id}
        className={`card${variantClass}${interactive} ${className}`}
        style={style}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {children}
      </div>
    )
  }

  return (
    <div id={id} className={`card${variantClass} ${className}`} style={style}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  actions,
  help,
  plain,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  help?: ReactNode
  plain?: boolean
}) {
  return (
    <div className={`card__header${plain ? ' card__header--plain' : ''}`}>
      <div className="card__titles">
        <div className="card__title">
          <span className="truncate">{title}</span>
          {help ? <HelpDot>{help}</HelpDot> : null}
        </div>
        {subtitle ? <div className="card__subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="card__actions">{actions}</div> : null}
    </div>
  )
}

export function CardBody({
  children,
  padding = 'default',
  className = '',
}: {
  children: ReactNode
  padding?: 'default' | 'tight' | 'none'
  className?: string
}) {
  const mod = padding === 'default' ? '' : ` card__body--${padding}`
  return <div className={`card__body${mod} ${className}`}>{children}</div>
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <div className="card__footer">{children}</div>
}

/* ================================================================ Button == */

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly,
  onClick,
  disabled,
  title,
  type = 'button',
  kbd,
  className = '',
  fullWidth,
}: {
  children?: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  iconOnly?: boolean
  onClick?: (event: React.MouseEvent) => void
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
  kbd?: string
  className?: string
  fullWidth?: boolean
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size}${iconOnly ? ' btn--icon' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={iconOnly && typeof title === 'string' ? title : undefined}
      style={fullWidth ? { width: '100%' } : undefined}
    >
      {icon}
      {!iconOnly && children}
      {kbd ? <span className="btn__kbd">{kbd}</span> : null}
    </button>
  )
}

export function IconButton({
  children,
  onClick,
  title,
  tone,
  active,
  className = '',
}: {
  children: ReactNode
  onClick?: (event: React.MouseEvent) => void
  title: string
  tone?: 'danger'
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={`icon-btn${tone === 'danger' ? ' icon-btn--danger' : ''}${active ? ' icon-btn--active' : ''} ${className}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  )
}

/* ================================================================= Badge == */

export function Badge({
  children,
  tone = 'neutral',
  size = 'sm',
  dot,
  title,
}: {
  children: ReactNode
  tone?: Tone
  size?: 'sm' | 'lg'
  dot?: boolean
  title?: string
}) {
  return (
    <span className={`badge badge--${tone}${size === 'lg' ? ' badge--lg' : ''}`} title={title}>
      {dot ? <span className="badge__dot" /> : null}
      {children}
    </span>
  )
}

/* ============================================================== Progress == */

export function ProgressBar({
  value,
  size = 'md',
  tone,
  gradient,
  live,
  marker,
  className = '',
  ariaLabel,
}: {
  /** 0–100. Values outside the range are clamped. */
  value: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  tone?: 'success' | 'warning' | 'danger' | 'info'
  gradient?: boolean
  /** Adds a subtle sheen. Only use while work is genuinely in flight. */
  live?: boolean
  /** Position of a reference marker, 0–100 — e.g. where the calendar says you are. */
  marker?: number
  className?: string
  ariaLabel?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const toneClass = gradient ? ' progress__fill--gradient' : tone ? ` progress__fill--${tone}` : ''

  return (
    <div
      className={`progress progress--${size} ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={`progress__fill${toneClass}${live && pct > 0 && pct < 100 ? ' progress__fill--live' : ''}`}
        style={{ width: `${pct}%` }}
      />
      {marker !== undefined && marker > 0 && marker < 100 ? (
        <div className="progress__marker" style={{ left: `${marker}%` }} title={`Expected: ${Math.round(marker)}%`} />
      ) : null}
    </div>
  )
}

export function ProgressRow({
  label,
  value,
  max = 100,
  display,
  tone,
  help,
}: {
  label: ReactNode
  value: number
  max?: number
  display?: ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'info'
  help?: ReactNode
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="progress-row">
        <span className="progress-row__label truncate">
          {label}
          {help ? <HelpDot>{help}</HelpDot> : null}
        </span>
        <span className="progress-row__value">{display ?? `${Math.round(pct)}%`}</span>
      </div>
      <ProgressBar value={pct} size="sm" tone={tone} />
    </div>
  )
}

/* ================================================================== Ring == */

export function Ring({
  value,
  size = 72,
  thickness = 6,
  tone,
  label,
  display,
  valueSize,
  className = '',
}: {
  /** 0–100. */
  value: number
  size?: number
  thickness?: number
  tone?: 'success' | 'warning' | 'danger' | 'info'
  label?: string
  display?: ReactNode
  valueSize?: number
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)

  return (
    <div className={`ring ${className}`} style={{ width: size, height: size }}>
      <svg className="ring__svg" width={size} height={size} aria-hidden="true">
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={thickness} />
        <circle
          className={`ring__fill${tone ? ` ring__fill--${tone}` : ''}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring__center">
        <span className="ring__value" style={{ fontSize: valueSize ?? size * 0.26 }}>
          {display ?? Math.round(pct)}
        </span>
        {label ? <span className="ring__label">{label}</span> : null}
      </div>
    </div>
  )
}

/* =============================================================== Tooltip == */

/**
 * Fixed-position tooltip rendered into a portal, so it is never clipped by an
 * ancestor's `overflow: hidden` — the failure mode of every CSS-only tooltip in
 * a scrolling dashboard.
 */
export function Tooltip({
  children,
  content,
  title,
  placement = 'top',
  delay = 220,
}: {
  children: ReactNode
  content: ReactNode
  title?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)

  const show = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), delay)
  }, [delay])

  const hide = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setOpen(false)
  }, [])

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  // Measure after paint, then clamp inside the viewport.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return
    const anchor = anchorRef.current.getBoundingClientRect()
    const tip = tipRef.current.getBoundingClientRect()
    const gap = 8
    let top: number
    let left: number

    switch (placement) {
      case 'bottom':
        top = anchor.bottom + gap
        left = anchor.left + anchor.width / 2 - tip.width / 2
        break
      case 'left':
        top = anchor.top + anchor.height / 2 - tip.height / 2
        left = anchor.left - tip.width - gap
        break
      case 'right':
        top = anchor.top + anchor.height / 2 - tip.height / 2
        left = anchor.right + gap
        break
      default:
        top = anchor.top - tip.height - gap
        left = anchor.left + anchor.width / 2 - tip.width / 2
    }

    const margin = 8
    left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin))
    // Flip above/below rather than let it hang off the edge.
    if (top < margin) top = anchor.bottom + gap
    if (top + tip.height > window.innerHeight - margin) top = Math.max(margin, anchor.top - tip.height - gap)

    setCoords({ top, left })
  }, [open, placement])

  return (
    <>
      <span
        ref={anchorRef}
        className="tooltip-wrap"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open
        ? createPortal(
            <div ref={tipRef} className="tooltip" style={{ top: coords.top, left: coords.left }} role="tooltip">
              {title ? <span className="tooltip__title">{title}</span> : null}
              <div className="tooltip__body">{content}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

/** The small `?` affordance. Wraps `Tooltip` with the standard trigger. */
export function HelpDot({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <Tooltip content={children} title={title}>
      <span className="help-dot" role="img" aria-label="Help">
        ?
      </span>
    </Tooltip>
  )
}

/* ================================================================== Stat == */

export function Stat({
  label,
  value,
  unit,
  size = 'md',
  meta,
  delta,
  help,
  tone,
}: {
  label: ReactNode
  value: ReactNode
  unit?: string
  size?: 'md' | 'lg' | 'hero'
  meta?: ReactNode
  delta?: { value: number; suffix?: string; invert?: boolean }
  help?: ReactNode
  tone?: Tone
}) {
  const sizeClass = size === 'md' ? '' : ` stat__value--${size}`
  const colour =
    tone === 'success'
      ? 'var(--success-text)'
      : tone === 'warning'
        ? 'var(--warning-text)'
        : tone === 'danger'
          ? 'var(--danger-text)'
          : tone === 'accent'
            ? 'var(--accent-text)'
            : undefined

  let deltaClass = 'stat__delta--flat'
  let arrow = '→'
  if (delta && delta.value !== 0) {
    const good = delta.invert ? delta.value < 0 : delta.value > 0
    deltaClass = good ? 'stat__delta--up' : 'stat__delta--down'
    arrow = delta.value > 0 ? '↑' : '↓'
  }

  return (
    <div className="stat">
      <span className="stat__label">
        {label}
        {help ? <HelpDot>{help}</HelpDot> : null}
      </span>
      <span className={`stat__value${sizeClass}`} style={colour ? { color: colour } : undefined}>
        {value}
        {unit ? <span className="stat__unit">{unit}</span> : null}
      </span>
      {(meta || delta) && (
        <span className="stat__meta">
          {delta ? (
            <span className={`stat__delta ${deltaClass}`}>
              {arrow} {Math.abs(delta.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              {delta.suffix ?? ''}
            </span>
          ) : null}
          {meta}
        </span>
      )}
    </div>
  )
}

/* ================================================================= Field == */

export function Field({
  label,
  hint,
  children,
  help,
}: {
  label?: ReactNode
  hint?: ReactNode
  children: ReactNode
  help?: ReactNode
}) {
  return (
    <label className="field">
      {label ? (
        <span className="field__label">
          {label}
          {help ? <HelpDot>{help}</HelpDot> : null}
        </span>
      ) : null}
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  size = 'md',
  numeric,
  min,
  max,
  step,
  onKeyDown,
  autoFocus,
  className = '',
}: {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  size?: 'sm' | 'md'
  numeric?: boolean
  min?: number
  max?: number
  step?: number
  onKeyDown?: (e: React.KeyboardEvent) => void
  autoFocus?: boolean
  className?: string
}) {
  return (
    <input
      className={`input${size === 'sm' ? ' input--sm' : ''}${numeric ? ' input--num' : ''} ${className}`}
      type={type}
      value={value}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
    />
  )
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows,
  onKeyDown,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  onKeyDown?: (e: React.KeyboardEvent) => void
  autoFocus?: boolean
}) {
  return (
    <textarea
      className="textarea"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
    />
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className = '',
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <select
      className={`select${size === 'sm' ? ' select--sm' : ''} ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* =========================================================== InlineEdit === */

/**
 * Click-to-edit text. Commits on blur and on Enter; Escape reverts.
 * Preferred over a modal for single-value edits — the brief asks for exactly
 * this, and it is genuinely faster.
 */
export function InlineEdit({
  value,
  onCommit,
  placeholder = 'Empty',
  multiline,
  numeric,
  className = '',
  ariaLabel,
}: {
  value: string | number
  onCommit: (value: string) => void
  placeholder?: string
  multiline?: boolean
  numeric?: boolean
  className?: string
  ariaLabel?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  // Re-sync when the underlying value changes while not editing.
  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    const trimmed = multiline ? draft : draft.trim()
    if (trimmed !== String(value)) onCommit(trimmed)
  }

  const cancel = () => {
    setDraft(String(value))
    setEditing(false)
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          className="inline-edit__textarea"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
            // Enter inserts a newline; Cmd/Ctrl+Enter commits.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              commit()
            }
          }}
        />
      )
    }
    return (
      <input
        className="inline-edit__input"
        type={numeric ? 'number' : 'text'}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
      />
    )
  }

  const isEmpty = String(value).trim() === ''
  const baseClass = multiline ? 'inline-edit-block' : 'inline-edit'
  const emptyClass = isEmpty ? ` ${baseClass}--empty` : ''

  return (
    <button
      type="button"
      className={`${baseClass}${emptyClass} ${className}`}
      onClick={() => setEditing(true)}
      aria-label={ariaLabel ?? 'Edit'}
      title="Click to edit"
    >
      {isEmpty ? placeholder : String(value)}
    </button>
  )
}

/* ============================================================== Checkbox == */

export function Checkbox({
  checked,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: 'md' | 'lg'
  ariaLabel?: string
}) {
  return (
    <input
      type="checkbox"
      className={`checkbox${size === 'lg' ? ' checkbox--lg' : ''}`}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
}) {
  return (
    <input
      type="checkbox"
      className="toggle"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      role="switch"
      aria-checked={checked}
    />
  )
}

/* ============================================================= Segmented == */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; count?: number; icon?: ReactNode }[]
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`segmented__item${value === o.value ? ' segmented__item--active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
          {o.count !== undefined ? <span className="segmented__count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; count?: number; icon?: ReactNode }[]
}) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`tabs__item${value === o.value ? ' tabs__item--active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
          {o.count !== undefined ? <Badge tone={value === o.value ? 'accent' : 'neutral'}>{o.count}</Badge> : null}
        </button>
      ))}
    </div>
  )
}

/* ============================================================ EmptyState == */

export function EmptyState({
  icon = '○',
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <div className="empty__title">{title}</div>
      {body ? <div className="empty__body">{body}</div> : null}
      {action}
    </div>
  )
}

/* ================================================================ Drawer == */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    // Prevent the page behind from scrolling while the drawer is open.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Details'}
        style={width ? { width: `min(${width}px, 100vw)` } : undefined}
      >
        <div className="drawer__header">
          <div className="col" style={{ minWidth: 0 }}>
            <div className="drawer__title">{title}</div>
            {subtitle ? <div className="drawer__subtitle">{subtitle}</div> : null}
          </div>
          <IconButton title="Close" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="drawer__body">{children}</div>
        {footer ? <div className="drawer__footer">{footer}</div> : null}
      </div>
    </>,
    document.body,
  )
}

/* ================================================================= Modal == */

export function Modal({
  open,
  onClose,
  children,
  width,
  label,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
  label?: string
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}>
        {children}
      </div>
    </>,
    document.body,
  )
}

/* ============================================================== Sparkline == */

export function Sparkline({
  values,
  width = 68,
  height = 22,
  tone = 'var(--accent)',
  fill,
  strokeWidth = 1.5,
}: {
  values: number[]
  width?: number
  height?: number
  tone?: string
  fill?: boolean
  strokeWidth?: number
}) {
  if (values.length < 2) return <svg className="sparkline" width={width} height={height} aria-hidden="true" />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = strokeWidth
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`
  const gradientId = `spark-${Math.round(values[0] * 1000)}-${values.length}`

  return (
    <svg className="sparkline" width={width} height={height} aria-hidden="true">
      {fill ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
              <stop offset="100%" stopColor={tone} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <path d={line} fill="none" stroke={tone} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ============================================================== Skeleton == */

export function Skeleton({ width, height = 14, radius }: { width?: number | string; height?: number; radius?: number }) {
  return <div className="skeleton" style={{ width: width ?? '100%', height, borderRadius: radius }} />
}

/* =========================================================== Confirmable == */

/**
 * Two-step destructive action. The first click arms it, the second commits, and
 * it disarms itself after three seconds. Cheaper than a modal for row deletes,
 * and it still prevents the accidental click.
 */
export function DeleteButton({
  onDelete,
  label = 'Delete',
  size = 'sm',
}: {
  onDelete: () => void
  label?: string
  size?: 'sm' | 'md'
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  const handle = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (armed) {
      if (timer.current !== null) window.clearTimeout(timer.current)
      setArmed(false)
      onDelete()
      return
    }
    setArmed(true)
    timer.current = window.setTimeout(() => setArmed(false), 3000)
  }

  if (armed) {
    return (
      <Button variant="danger" size={size} onClick={handle} title="Click again to confirm">
        Sure?
      </Button>
    )
  }

  return (
    <IconButton title={label} tone="danger" onClick={handle}>
      ✕
    </IconButton>
  )
}

/* ============================================================ Collapsible == */

export function Collapsible({
  open,
  onToggle,
  header,
  children,
  className = '',
}: {
  open: boolean
  onToggle: () => void
  header: ReactNode
  children: ReactNode
  className?: string
}) {
  const contentId = useId()
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        style={{ display: 'block', width: '100%', textAlign: 'left' }}
      >
        {header}
      </button>
      {open ? (
        <div id={contentId} className="animate-in">
          {children}
        </div>
      ) : null}
    </div>
  )
}

/* ========================================================== Drag helpers == */

interface DragContextValue {
  draggingId: string | null
  overId: string | null
  setDragging: (id: string | null) => void
  setOver: (id: string | null) => void
}

const DragContext = createContext<DragContextValue | null>(null)

/**
 * Minimal HTML5 drag-and-drop reordering. No dependency, works with keyboard
 * fallbacks (the caller supplies move-up/move-down actions), and degrades to
 * plain rows when dragging is not available.
 */
export function useReorder<T extends { id: string; order: number }>(
  items: T[],
  onReorder: (orderedIds: string[]) => void,
) {
  const [draggingId, setDragging] = useState<string | null>(null)
  const [overId, setOver] = useState<string | null>(null)

  const sorted = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items])

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!draggingId || draggingId === targetId) {
        setDragging(null)
        setOver(null)
        return
      }
      const ids = sorted.map((i) => i.id)
      const from = ids.indexOf(draggingId)
      const to = ids.indexOf(targetId)
      if (from === -1 || to === -1) return
      ids.splice(to, 0, ids.splice(from, 1)[0])
      onReorder(ids)
      setDragging(null)
      setOver(null)
    },
    [draggingId, onReorder, sorted],
  )

  const dragProps = useCallback(
    (id: string) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDragging(id)
        e.dataTransfer.effectAllowed = 'move'
        // Firefox requires data to be set or the drag never starts.
        e.dataTransfer.setData('text/plain', id)
      },
      onDragEnd: () => {
        setDragging(null)
        setOver(null)
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (overId !== id) setOver(id)
      },
      onDragLeave: () => {
        if (overId === id) setOver(null)
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        handleDrop(id)
      },
      'data-dragging': draggingId === id || undefined,
      'data-drag-over': overId === id && draggingId !== id ? true : undefined,
    }),
    [draggingId, handleDrop, overId],
  )

  /** Keyboard-accessible alternative to dragging. */
  const move = useCallback(
    (id: string, direction: -1 | 1) => {
      const ids = sorted.map((i) => i.id)
      const from = ids.indexOf(id)
      const to = from + direction
      if (from === -1 || to < 0 || to >= ids.length) return
      ;[ids[from], ids[to]] = [ids[to], ids[from]]
      onReorder(ids)
    },
    [onReorder, sorted],
  )

  return { sorted, dragProps, move, draggingId, overId }
}

export function useDragContext() {
  return useContext(DragContext)
}

/* ============================================================ misc icons == */

/**
 * Inline SVG icon set. Bundling these rather than pulling an icon library keeps
 * the install to two dependencies, and every glyph inherits `currentColor` so it
 * theme-switches for free.
 */
export function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  const path = ICONS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {path}
    </svg>
  )
}

export type IconName = keyof typeof ICONS

const ICONS = {
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m18 15-6-6-6 6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  filter: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M19 6l-.9 13a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  external: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </>
  ),
  drag: (
    <>
      <circle cx="9" cy="6" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="18" r="1" fill="currentColor" />
      <circle cx="15" cy="6" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="18" r="1" fill="currentColor" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </>
  ),
  undo: (
    <>
      <path d="M3 7v6h6" />
      <path d="M3.5 13a9 9 0 1 0 2.6-8.5L3 7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  flame: <path d="M12 22c4-1 7-4 7-8 0-3-2-5-3-7-1 2-2 3-4 3 1-3-1-6-4-8 1 4-1 6-2 8-1 2-2 3-2 6 0 4 4 6 8 6z" />,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  trending: <path d="m22 7-8.5 8.5-4-4L2 19M16 7h6v6" />,
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  command: <path d="M15 6a3 3 0 1 1 3-3v18a3 3 0 1 1-3-3V6zM9 6a3 3 0 1 0-3-3v18a3 3 0 1 0 3-3V6z" />,
  arrowRight: <path d="M5 12h14M13 5l7 7-7 7" />,
  arrowUpRight: <path d="M7 17 17 7M7 7h10v10" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  folder: <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.9 3.9A2 2 0 0 0 8.2 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  refresh: <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />,
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12.2 19" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  play: <path d="m6 3 14 9-14 9V3z" fill="currentColor" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
} as const
