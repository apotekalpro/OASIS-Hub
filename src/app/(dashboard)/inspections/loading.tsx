export default function Loading() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-28" />
        ))}
      </div>
    </div>
  )
}
