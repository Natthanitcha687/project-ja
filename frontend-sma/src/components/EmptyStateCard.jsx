import React from 'react'

export default function EmptyStateCard({ title, message, primaryText, secondaryText, onPrimary }) {
  return (
    <div className="max-w-3xl mx-auto mt-8 p-6 bg-white rounded-xl shadow-md border border-gray-100 text-center wp-tour-empty-state">
      <div className="flex items-center justify-center mb-4">
        <div className="bg-green-100 text-green-700 rounded-full p-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
        </div>
      </div>
      <h3 className="text-2xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onPrimary}
          className="w-full sm:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow"
        >
          {primaryText}
        </button>
        {secondaryText && (
          <button className="w-full sm:w-auto px-5 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border">
            {secondaryText}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-4">{/* tooltip area: optional small hint */}</p>
    </div>
  )
}
