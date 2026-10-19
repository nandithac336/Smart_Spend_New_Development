function ListSkeleton({ count = 3 }) {
  return (
    <div aria-label="Loading list" aria-busy="true" className="space-y-3">
      {Array.from({ length: Math.min(Math.max(count, 1), 8) }, (_, index) => (
        <div
          className="glass flex items-center gap-3 p-4"
          key={index}
        >
          <div className="skeleton-shimmer size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-shimmer h-3 w-2/5 rounded-full" />
            <div className="skeleton-shimmer h-3 w-3/5 rounded-full opacity-70" />
          </div>
          <div className="skeleton-shimmer h-4 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export default ListSkeleton
