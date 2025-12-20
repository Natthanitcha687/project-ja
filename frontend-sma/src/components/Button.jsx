export default function Button({ as:Tag='button', className='', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium shadow-sm transition active:scale-[.98]'
  const styles = 'bg-[color:var(--brand)] hover:bg-[color:var(--brand-600)]'
  return <Tag className={`${base} ${styles} ${className}`} {...props} />
}
