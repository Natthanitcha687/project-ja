// src/components/BarChart.jsx
// Bar chart with optional line overlay (matches Figma design)
import { useMemo } from 'react'

export default function BarChart({
    data = [],
    height = 300,
    title = '',
    subtitle = '',
    barColor = '#0071EB',
    lineColor = '#E53E3E',
    showLine = true,
    lineLabel = '',
    yAxisMax = null, // New prop for fixed Y-axis max
}) {
    const chartData = useMemo(() => {
        if (!data?.length) return { max: yAxisMax || 0, bars: [], linePoints: '' }
        // Use yAxisMax if provided, otherwise find data max (min 1 to avoid /0)
        const max = yAxisMax || Math.max(...data.map((d) => d.value), 1)

        const bars = data.map((d, i) => ({
            ...d,
            height: (d.value / max) * 100, // Percentage of max
            percent: d.percent ?? null,
        }))
        // Line points for secondary metric (percent)
        const linePoints = bars
            .map((b, i) => {
                const x = (i / (bars.length - 1 || 1)) * 100
                const y = 100 - (b.percent ?? b.height)
                return `${x},${y}`
            })
            .join(' ')
        return { max, bars, linePoints }
    }, [data, yAxisMax])

    if (!data?.length) return null

    // Generate Y-axis labels
    const yAxisLabels = useMemo(() => {
        if (yAxisMax) {
            // If fixed max, generate 5 steps (including 0)
            const step = yAxisMax / 5
            return [
                yAxisMax,
                yAxisMax - step,
                yAxisMax - step * 2,
                yAxisMax - step * 3,
                yAxisMax - step * 4,
                0
            ]
        }
        // Dynamic labels based on max
        return [
            chartData.max,
            Math.round(chartData.max * 0.75),
            Math.round(chartData.max * 0.5),
            Math.round(chartData.max * 0.25),
            0
        ]
    }, [chartData.max, yAxisMax])

    return (
        <div className="rounded-xl bg-white border border-black/10 p-6 shadow-sm">
            {title && (
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-black">{title}</h3>
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
            )}

            <div className="relative" style={{ height }}>
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-slate-400">
                    {yAxisLabels.map((val, idx) => (
                        <div key={idx}>{val}</div>
                    ))}
                </div>

                {/* Percent Y-axis on right */}
                {showLine && (
                    <div className="absolute right-0 top-0 bottom-8 w-10 flex flex-col justify-between text-xs text-rose-400 text-right pr-1">
                        <div>20%</div>
                        <div>15%</div>
                        <div>10%</div>
                        <div>5%</div>
                        <div>0%</div>
                    </div>
                )}

                {/* Grid lines */}
                <div className="absolute left-10 right-12 top-0 bottom-8">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        {yAxisLabels.map((_, i) => (
                            <div key={i} className="border-t border-slate-100" />
                        ))}
                    </div>

                    {/* Bars */}
                    <div className="absolute inset-0 flex justify-around gap-1 pb-0">
                        {chartData.bars.map((bar, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                    {bar.label}: {bar.value} ใบ
                                </div>
                                <div
                                    className="w-full max-w-[40px] rounded-t-md transition-all duration-300"
                                    style={{
                                        height: `${bar.height}%`, // Simple percentage height
                                        minHeight: bar.value > 0 ? '4px' : '0px',
                                        background: barColor,
                                        opacity: bar.value > 0 ? 1 : 0.3,
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Line overlay */}
                    {showLine && chartData.bars.some((b) => b.percent != null) && (
                        <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                        >
                            <polyline
                                points={chartData.linePoints}
                                fill="none"
                                stroke={lineColor}
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                            />
                            {chartData.bars.map((b, i) => {
                                const x = (i / (chartData.bars.length - 1 || 1)) * 100
                                const y = 100 - (b.percent ?? 0)
                                return <circle key={i} cx={x} cy={y} r="3" fill={lineColor} />
                            })}
                        </svg>
                    )}
                </div>

                {/* X-axis labels */}
                <div className="absolute left-10 right-12 bottom-0 flex justify-around text-xs text-slate-500">
                    {chartData.bars.map((bar, i) => (
                        <div key={i} className="text-center flex-1">
                            {bar.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            {showLine && lineLabel && (
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                        <span className="inline-block w-4 h-3 rounded" style={{ background: barColor }} />
                        <span>จำนวน</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="inline-block w-4 h-0.5" style={{ background: lineColor }} />
                        <span>{lineLabel}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
