export default function Card({ className='', children }) {
  return (
    <div className={`rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 ${className}`}>
      {children}
    </div>
  )
}
