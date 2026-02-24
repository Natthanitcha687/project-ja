import React from 'react'

export default function WelcomeOnboardingModal({ open, onClose, title, description, onStart }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-xl w-full p-6 mx-4">
        <div className="flex items-start gap-4">
          <div className="bg-blue-50 p-3 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-2">{description}</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  if (onStart) onStart()
                  onClose?.()
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md"
              >
                เริ่มต้นเลย
              </button>
              <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md">ดูทีหลัง</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
