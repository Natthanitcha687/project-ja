import React from 'react'

// SimpleDonut: lightweight SVG donut showing three segments (active, nearing, expired)
// props: counts = { active, nearing, expired }, size (px), thickness (px)
export default function SimpleDonut({ counts = {}, size = 120, thickness = 18 }) {
  const active = Number(counts.active || 0)
  const nearing = Number(counts.nearing || 0)
  const expired = Number(counts.expired || 0)
  const total = Math.max(1, active + nearing + expired)

  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const cx = size / 2
  const cy = size / 2

  const segments = [
    { value: active, color: '#10B981' }, // emerald
    { value: nearing, color: '#F59E0B' }, // amber
    { value: expired, color: '#EF4444' }, // rose
  ]

  // compute dasharray for each segment based on cumulative offset
  let offset = 0
  const segProps = segments.map((s) => {
    const fraction = s.value / total
    const dash = fraction * circumference
    const prop = { dash, offset, color: s.color }
    offset += dash
    return prop
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* background ring */}
      <circle cx={cx} cy={cy} r={radius} stroke="#F1F5F9" strokeWidth={thickness} fill="none" />

      {/* segments */}
      {segProps.map((p, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={radius}
          stroke={p.color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeDasharray={`${p.dash} ${circumference - p.dash}`}
          strokeDashoffset={-p.offset}
          style={{ filter: 'url(#shadow)' }}
        />
      ))}

      {/* inner circle (hole) */}
      <circle cx={cx} cy={cy} r={Math.max(0, radius - thickness / 2)} fill="#ffffff" />

      {/* center text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fill="#0F172A" fontWeight="700">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#64748B">รวมรายการ</text>
    </svg>
  )
}
