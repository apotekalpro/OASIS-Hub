export default function CalendarLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 bg-gray-200 rounded-md" />
          <div className="h-4 w-48 bg-gray-100 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-indigo-100 rounded-lg" />
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 bg-gray-100 rounded-full" />
        <div className="h-6 w-40 bg-gray-200 rounded-md" />
        <div className="h-8 w-8 bg-gray-100 rounded-full" />
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="h-8 bg-gray-100 rounded text-center" />
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className={`rounded-lg p-2 space-y-1 ${i % 7 >= 5 ? 'bg-gray-50' : 'bg-white border border-gray-100'}`}
            style={{ minHeight: 80 }}
          >
            <div className="h-4 w-6 bg-gray-200 rounded ml-auto" />
            {i % 4 === 0 && <div className="h-5 w-full bg-indigo-100 rounded" />}
            {i % 7 === 2 && <div className="h-5 w-4/5 bg-blue-100 rounded" />}
          </div>
        ))}
      </div>
    </div>
  )
}
