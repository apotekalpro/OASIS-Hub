export default function UsersLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-gray-200 rounded-md" />
          <div className="h-4 w-72 bg-gray-100 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-100 rounded-lg" />
          <div className="h-9 w-24 bg-indigo-100 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
            <div className="h-7 w-12 bg-gray-200 rounded" />
            <div className="h-3.5 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 space-y-1">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3.5 w-56 bg-gray-100 rounded" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="h-9 w-9 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-36 bg-gray-200 rounded" />
                <div className="h-3 w-48 bg-gray-100 rounded" />
              </div>
              <div className="h-5 w-24 bg-gray-100 rounded-full" />
              <div className="h-4 w-28 bg-gray-100 rounded" />
              <div className="h-5 w-14 bg-gray-100 rounded-full" />
              <div className="h-4 w-20 bg-gray-100 rounded ml-auto" />
              <div className="h-7 w-7 bg-gray-100 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
