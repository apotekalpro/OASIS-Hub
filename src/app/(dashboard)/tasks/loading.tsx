export default function TasksLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-gray-200 rounded-md" />
          <div className="h-4 w-56 bg-gray-100 rounded-md" />
        </div>
        <div className="h-9 w-28 bg-indigo-100 rounded-lg" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-64 bg-gray-100 rounded-lg" />
        <div className="h-9 w-28 bg-gray-100 rounded-lg" />
        <div className="h-9 w-28 bg-gray-100 rounded-lg" />
        <div className="h-9 w-24 bg-gray-100 rounded-lg ml-auto" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
          {[240, 80, 90, 100, 120, 60].map((w, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50">
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-200 rounded" style={{ width: `${50 + (i * 17) % 40}%` }} />
            </div>
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
            <div className="h-5 w-20 bg-gray-100 rounded-full" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="flex -space-x-1.5">
              <div className="h-6 w-6 bg-gray-200 rounded-full ring-2 ring-white" />
              <div className="h-6 w-6 bg-gray-100 rounded-full ring-2 ring-white" />
            </div>
            <div className="h-7 w-7 bg-gray-100 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
