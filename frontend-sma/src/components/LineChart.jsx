import { useMemo } from 'react'

function LineChart({ data, height = 200, title = '', subtitle = '' }) {
  const chartData = useMemo(() => {
    if (!data?.length) return { max: 0, points: [], normalized: [] }
    const max = Math.max(...data.map(d => d.value))
    const normalized = data.map((d, i) => ({
      ...d,
      y: max === 0 ? height - 40 : height - 40 - ((d.value / max) * (height - 40)),
      x: (i * (100 / (data.length - 1))) + '%'
    }))
    return {
      max,
      normalized,
      points: normalized.map(p => `${p.x},${p.y}`).join(' ')
    }
  }, [data, height])

  if (!data?.length) return null

  return (
    <div className="rounded-3xl bg-white/60 backdrop-blur-sm border border-sky-50 p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      
      <div className="relative" style={{ height: height + 40 }}>
        {/* Y-axis labels */}
        <div className="absolute -left-2 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-slate-400">
          <div>{chartData.max}</div>
          <div>{Math.round(chartData.max * 0.75)}</div>
          <div>{Math.round(chartData.max * 0.5)}</div>
          <div>{Math.round(chartData.max * 0.25)}</div>
          <div>0</div>
        </div>

        {/* Grid lines */}
        <div className="absolute left-10 right-4 top-0 bottom-8">
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="border-t border-slate-100"></div>
            <div className="border-t border-slate-100"></div>
            <div className="border-t border-slate-100"></div>
            <div className="border-t border-slate-100"></div>
            <div className="border-t border-slate-100"></div>
          </div>

          {/* Chart area */}
          <svg
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            style={{ transform: 'scale(1, -1) translateY(-40px)' }}
          >
            {/* Background gradient */}
            <defs>
              <linearGradient id="line-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(56, 189, 248)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="rgb(56, 189, 248)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            <path
              d={`M ${chartData.points} L ${chartData.normalized[chartData.normalized.length-1].x},${height} L 0,${height} Z`}
              fill="url(#line-gradient)"
              className="transition-all duration-300"
            />

            {/* Line */}
            <polyline
              points={chartData.points}
              fill="none"
              stroke="rgb(56, 189, 248)"
              strokeWidth="2"
              className="transition-all duration-300"
            />

            {/* Data points */}
            {chartData.normalized.map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r="3"
                className="fill-sky-500"
              />
            ))}
          </svg>

          {/* X-axis labels */}
          <div className="absolute left-0 right-0 bottom-0 flex justify-between">
            {chartData.normalized.map((point, i) => (
              <div key={i} className="text-xs text-slate-500 text-center" style={{ transform: 'translateX(-50%)', left: point.x }}>
                {point.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LineChart