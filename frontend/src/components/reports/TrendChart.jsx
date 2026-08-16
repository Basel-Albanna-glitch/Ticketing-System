import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

// Two series, so a legend is always present and both lines carry an end label. The hues are
// validated for CVD separation and for contrast against each mode's surface — light steps on
// white, darker-surface steps under `dark:`. Never restyle these by rank; created is always
// indigo and resolved is always green, however the data sorts.
const SERIES = [
  { key: 'created', labelKey: 'reports.trend.created', stroke: 'stroke-[#6366f1] dark:stroke-[#6366f1]', fill: 'fill-[#6366f1] dark:fill-[#6366f1]', swatch: 'bg-[#6366f1]' },
  { key: 'resolved', labelKey: 'reports.trend.resolved', stroke: 'stroke-[#059669] dark:stroke-[#199e70]', fill: 'fill-[#059669] dark:fill-[#199e70]', swatch: 'bg-[#059669] dark:bg-[#199e70]' },
]

const W = 760
const H = 250
const PAD = { top: 16, right: 46, bottom: 26, left: 34 }

// Round the axis top up to something a reader can divide by eye.
function niceMax(value) {
  if (value <= 4) return Math.max(1, value)
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / (magnitude / 2)) * (magnitude / 2)
}

export default function TrendChart({ trend }) {
  const { t, lang } = useI18n()
  const containerRef = useRef(null)
  const [active, setActive] = useState(null)
  const [showTable, setShowTable] = useState(false)

  const points = trend?.points || []
  const granularity = trend?.granularity || 'day'

  const formatDate = useMemo(() => {
    const options =
      granularity === 'month'
        ? { month: 'short', year: '2-digit' }
        : { month: 'short', day: 'numeric' }
    const formatter = new Intl.DateTimeFormat(lang, options)
    return (iso) => formatter.format(new Date(`${iso}T00:00:00`))
  }, [granularity, lang])

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-400">{t('reports.noData')}</p>
  }

  const max = niceMax(Math.max(1, ...points.flatMap((p) => [p.created, p.resolved])))
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (v) => PAD.top + plotH - (v / max) * plotH

  const path = (key) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join(' ')

  // Four gridlines including the baseline, on whole numbers only.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f)).filter(
    (v, i, all) => all.indexOf(v) === i
  )
  // Roughly six x labels, however many buckets there are. The final bucket is always
  // labelled; if that lands too close to the previous tick, drop the previous one rather
  // than let two dates overlap.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))
  const labelIndices = points.map((_, i) => i).filter((i) => i % labelEvery === 0)
  const lastIndex = points.length - 1
  if (labelIndices[labelIndices.length - 1] !== lastIndex) {
    const previous = labelIndices[labelIndices.length - 1]
    if (x(lastIndex) - x(previous) < 40) labelIndices.pop()
    labelIndices.push(lastIndex)
  }

  const last = points.length - 1
  const endLabels = SERIES.map((s) => ({
    key: s.key,
    fill: s.fill,
    value: points[last][s.key],
    y: y(points[last][s.key]),
    labelY: y(points[last][s.key]) + 3.5,
  }))
  const [upper, lower] =
    endLabels[0].y <= endLabels[1].y ? [endLabels[0], endLabels[1]] : [endLabels[1], endLabels[0]]
  if (lower.y - upper.y < 12) {
    upper.labelY = upper.y - 3
    lower.labelY = lower.y + 11
  }

  function pickNearest(clientX) {
    const box = containerRef.current?.getBoundingClientRect()
    if (!box) return
    const ratio = (clientX - box.left) / box.width
    const svgX = ratio * W
    const index = Math.round(((svgX - PAD.left) / plotW) * (points.length - 1))
    setActive(Math.min(points.length - 1, Math.max(0, index)))
  }

  function onKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setActive((current) => {
      const from = current ?? points.length - 1
      const next = event.key === 'ArrowLeft' ? from - 1 : from + 1
      return Math.min(points.length - 1, Math.max(0, next))
    })
  }

  const activePoint = active != null ? points[active] : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-4">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className={`h-0.5 w-4 rounded-full ${s.swatch}`} />
              {t(s.labelKey)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {showTable ? t('reports.trend.hideTable') : t('reports.trend.showTable')}
        </button>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        role="img"
        aria-label={t('reports.trend.title')}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((c) => c ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onPointerMove={(e) => pickNearest(e.clientX)}
        onPointerLeave={() => setActive(null)}
        className="relative rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                strokeWidth={1}
                className="stroke-gray-200 dark:stroke-white/10"
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 3.5}
                textAnchor="end"
                className="fill-gray-400 text-[10px] dark:fill-gray-500"
              >
                {tick}
              </text>
            </g>
          ))}

          {labelIndices.map((i) => (
            <text
              key={points[i].date}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-gray-400 text-[10px] dark:fill-gray-500"
            >
              {formatDate(points[i].date)}
            </text>
          ))}

          {activePoint && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              strokeWidth={1}
              className="stroke-gray-300 dark:stroke-white/20"
            />
          )}

          {SERIES.map((s) => (
            <path
              key={s.key}
              d={path(s.key)}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={s.stroke}
            />
          ))}

          {/* End marker + direct label: the only values written on the plot. When the two
              series finish level the labels would sit on top of each other, so nudge them
              apart — a clipped or overlapping label is worse than no label. */}
          {endLabels.map((label) => (
            <g key={label.key}>
              <circle
                cx={x(points.length - 1)}
                cy={label.y}
                r={4}
                strokeWidth={2}
                className={`${label.fill} stroke-white dark:stroke-gray-900`}
              />
              <text
                x={x(points.length - 1) + 9}
                y={label.labelY}
                className="fill-gray-700 text-[11px] font-medium dark:fill-gray-200"
              >
                {label.value}
              </text>
            </g>
          ))}

          {activePoint &&
            SERIES.map((s) => (
              <circle
                key={s.key}
                cx={x(active)}
                cy={y(activePoint[s.key])}
                r={4}
                strokeWidth={2}
                className={`${s.fill} stroke-white dark:stroke-gray-900`}
              />
            ))}
        </svg>

        {activePoint && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-32 -translate-x-1/2 rounded-xl border border-gray-200/70 bg-white/95 px-3 py-2 shadow-soft-lg backdrop-blur dark:border-white/10 dark:bg-gray-900/95"
            style={{
              left: `${Math.min(88, Math.max(12, (x(active) / W) * 100))}%`,
            }}
          >
            <p className="mb-1 text-[11px] text-gray-500 dark:text-gray-300">
              {formatDate(activePoint.date)}
            </p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 text-xs">
                <span className={`h-0.5 w-3 shrink-0 rounded-full ${s.swatch}`} />
                <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {activePoint[s.key]}
                </span>
                <span className="text-gray-500 dark:text-gray-300">{t(s.labelKey)}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Every plotted value stays reachable without hovering. */}
      {showTable && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200/70 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t('reports.trend.date')}</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-end font-medium">
                    {t(s.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {points.map((p) => (
                <tr key={p.date}>
                  <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{formatDate(p.date)}</td>
                  <td className="px-3 py-1.5 text-end tabular-nums text-gray-900 dark:text-gray-100">
                    {p.created}
                  </td>
                  <td className="px-3 py-1.5 text-end tabular-nums text-gray-900 dark:text-gray-100">
                    {p.resolved}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
