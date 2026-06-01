export default function AnalyticsLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-32 bg-gray-200 rounded-md" />
        <div className="h-4 w-64 bg-gray-100 rounded-md" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {[72, 60, 88, 72, 96].map((w, i) => (
          <div key={i} className={`h-9 rounded-t-md ${i === 0 ? 'bg-indigo-100' : 'bg-gray-100'}`} style={{ width: w }} />
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-48 bg-gray-50 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
          {[180, 100, 80, 100].map((w, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50">
            <div className="h-3.5 bg-gray-200 rounded" style={{ width: `${30 + (i * 17) % 30}%` }} />
            <div className="h-4 w-16 bg-gray-100 rounded-full ml-auto" />
            <div className="h-4 w-16 bg-gray-100 rounded-full" />
            <div className="h-4 w-12 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
