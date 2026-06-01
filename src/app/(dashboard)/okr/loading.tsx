export default function OkrLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-16 bg-gray-200 rounded-md" />
          <div className="h-4 w-72 bg-gray-100 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-indigo-100 rounded-lg" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-64 bg-gray-100 rounded-lg" />
        <div className="h-9 w-28 bg-gray-100 rounded-lg" />
        <div className="h-9 w-28 bg-gray-100 rounded-lg" />
      </div>

      {/* Objective cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded" style={{ width: `${45 + (i * 19) % 40}%` }} />
              <div className="h-3 w-1/3 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-20 bg-gray-100 rounded-full shrink-0" />
          </div>
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="h-3 w-10 bg-gray-100 rounded" />
            </div>
            <div className="h-2 bg-gray-100 rounded-full">
              <div className="h-2 bg-indigo-100 rounded-full" style={{ width: `${20 + (i * 17) % 60}%` }} />
            </div>
          </div>
          {/* Key results */}
          <div className="space-y-2 pl-4 border-l-2 border-gray-100">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-3 flex-1 bg-gray-100 rounded" style={{ width: `${40 + j * 20}%` }} />
                <div className="h-4 w-16 bg-gray-50 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
