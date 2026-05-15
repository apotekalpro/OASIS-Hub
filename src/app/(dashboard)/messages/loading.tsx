export default function MessagesLoading() {
  return (
    <div className="h-full flex animate-pulse">
      {/* Channel sidebar */}
      <div className="w-64 border-r border-gray-100 bg-white flex flex-col shrink-0 p-3 space-y-1">
        <div className="h-5 w-24 bg-gray-200 rounded mb-3 mx-2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="h-4 w-4 bg-gray-200 rounded shrink-0" />
            <div className="h-3.5 bg-gray-100 rounded" style={{ width: `${45 + (i * 13) % 40}%` }} />
          </div>
        ))}
        <div className="h-5 w-20 bg-gray-200 rounded mt-4 mb-2 mx-2" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="h-6 w-6 bg-gray-200 rounded-full shrink-0" />
            <div className="h-3.5 bg-gray-100 rounded" style={{ width: `${50 + (i * 19) % 35}%` }} />
          </div>
        ))}
      </div>

      {/* Message feed */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <div className="h-5 w-40 bg-gray-200 rounded" />
        </div>

        {/* Messages */}
        <div className="flex-1 px-5 py-4 space-y-5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`flex gap-3 ${i % 3 === 2 ? 'mt-6' : ''}`}>
              <div className="h-8 w-8 bg-gray-200 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="flex items-baseline gap-2">
                  <div className="h-3.5 w-24 bg-gray-200 rounded" />
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
                <div className="h-3.5 bg-gray-100 rounded" style={{ width: `${35 + (i * 23) % 50}%` }} />
                {i % 2 === 0 && <div className="h-3.5 w-1/3 bg-gray-100 rounded" />}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="h-10 w-full bg-gray-100 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
