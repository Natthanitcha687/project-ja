export default function TextInput({ label, error, className='', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>}
      <input
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none ring-0 focus:border-gray-400"
        {...props}
      />
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </label>
  )
}
