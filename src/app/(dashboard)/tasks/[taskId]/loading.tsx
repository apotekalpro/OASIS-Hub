export default function TaskDetailLoading() {
  return (
    <div className="h-full flex flex-col animate-pulse">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center gap-3">
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        <div className="h-5 w-48 bg-gray-200 rounded" />
        <div className="ml-auto flex gap-2">
          <div className="h-8 w-20 bg-gray-100 rounded-lg" />
          <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="h-7 w-2/3 bg-gray-200 rounded" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-100 rounded" />
            <div className="h-4 w-5/6 bg-gray-100 rounded" />
            <div className="h-4 w-3/4 bg-gray-100 rounded" />
          </div>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-100 pb-0">
            {['Comments', 'Time Log', 'Subtasks'].map(t => (
              <div key={t} className="h-9 w-24 bg-gray-100 rounded-t-lg" />
            ))}
          </div>

          {/* Comment skeletons */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-3/4 bg-gray-100 rounded" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="w-72 border-l border-gray-100 bg-gray-50/50 p-5 space-y-4 overflow-y-auto shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3.5 w-20 bg-gray-200 rounded" />
                <div className="h-3.5 w-24 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="h-4 w-28 bg-gray-200 rounded" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-7 w-7 bg-gray-200 rounded-full" />
                <div className="h-3.5 w-28 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
