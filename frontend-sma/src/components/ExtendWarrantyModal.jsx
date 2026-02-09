// frontend-sma/src/components/ExtendWarrantyModal.jsx
// Modal for extending warranty expiry date
import { useState } from 'react'
import { api } from '../lib/api'

const DURATION_OPTIONS = [
    { label: '3 เดือน', months: 3 },
    { label: '6 เดือน', months: 6 },
    { label: '12 เดือน', months: 12 },
    { label: '24 เดือน', months: 24 },
]

function addMonths(date, months) {
    const d = new Date(date)
    d.setMonth(d.getMonth() + months)
    return d
}

function formatDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

export default function ExtendWarrantyModal({
    isOpen,
    onClose,
    item,
    onSuccess,
}) {
    const [selectedMonths, setSelectedMonths] = useState(12)
    const [customMonths, setCustomMonths] = useState('')
    const [isCustom, setIsCustom] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    if (!isOpen || !item) return null

    const currentExpiry = item.expiryDate ? new Date(item.expiryDate) : new Date()
    const monthsToAdd = isCustom ? Number(customMonths) || 0 : selectedMonths
    const newExpiry = addMonths(currentExpiry, monthsToAdd)

    const handleExtend = async () => {
        if (monthsToAdd <= 0) {
            setError('กรุณาเลือกระยะเวลาต่ออายุ')
            return
        }

        setLoading(true)
        setError('')

        try {
            await api.patch(`/warranty-items/${item.id}`, {
                expiryDate: newExpiry.toISOString(),
                durationMonths: (item.durationMonths || 0) + monthsToAdd,
            })

            onSuccess?.()
            onClose()
        } catch (err) {
            console.error('Extend warranty error:', err)
            setError(err.response?.data?.message || 'ไม่สามารถต่ออายุได้')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <h3 className="text-lg font-bold text-gray-900">ต่ออายุใบรับประกัน</h3>
                    <button
                        onClick={onClose}
                        className="text-2xl text-gray-400 hover:text-gray-600"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4">
                    {/* Item Info */}
                    <div className="rounded-xl bg-slate-50 p-4">
                        <div className="text-sm text-slate-500">สินค้า</div>
                        <div className="font-semibold text-gray-900">{item.productName || '-'}</div>
                        {item.serial && (
                            <div className="text-sm text-slate-500">Serial: {item.serial}</div>
                        )}
                    </div>

                    {/* Current Expiry */}
                    <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4">
                        <div>
                            <div className="text-sm text-amber-600">วันหมดอายุปัจจุบัน</div>
                            <div className="font-semibold text-amber-800">{formatDate(currentExpiry)}</div>
                        </div>
                        <div className="text-3xl">📅</div>
                    </div>

                    {/* Duration Options */}
                    <div>
                        <div className="text-sm font-medium text-gray-700 mb-2">เลือกระยะเวลาต่อ</div>
                        <div className="grid grid-cols-2 gap-2">
                            {DURATION_OPTIONS.map((opt) => (
                                <button
                                    key={opt.months}
                                    type="button"
                                    onClick={() => {
                                        setSelectedMonths(opt.months)
                                        setIsCustom(false)
                                    }}
                                    className={`rounded-xl px-4 py-3 text-sm font-medium border transition ${!isCustom && selectedMonths === opt.months
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Custom Input */}
                        <div className="mt-3">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isCustom}
                                    onChange={(e) => setIsCustom(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm text-gray-600">กำหนดเอง</span>
                            </label>
                            {isCustom && (
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="120"
                                        value={customMonths}
                                        onChange={(e) => setCustomMonths(e.target.value)}
                                        placeholder="จำนวนเดือน"
                                        className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                    />
                                    <span className="text-sm text-gray-500">เดือน</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview */}
                    {monthsToAdd > 0 && (
                        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
                            <div>
                                <div className="text-sm text-emerald-600">วันหมดอายุใหม่</div>
                                <div className="font-bold text-lg text-emerald-800">{formatDate(newExpiry)}</div>
                            </div>
                            <div className="text-3xl">✅</div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleExtend}
                        disabled={loading || monthsToAdd <= 0}
                        className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow transition ${loading || monthsToAdd <= 0
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                    >
                        {loading ? 'กำลังต่ออายุ...' : 'ยืนยันต่ออายุ'}
                    </button>
                </div>
            </div>
        </div>
    )
}
