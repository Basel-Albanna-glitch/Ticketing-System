export default function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-2xl border border-gray-200/70 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gray-900/70 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
