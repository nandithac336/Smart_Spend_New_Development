import ListSkeleton from '@/components/common/ListSkeleton.jsx'

function DashboardLoading() {
  return (
    <div aria-busy="true" className="dashboard-page space-y-6">
      <div className="space-y-2">
        <div className="skeleton-shimmer h-3 w-36 rounded-full" />
        <div className="skeleton-shimmer h-8 w-56 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div className={`dashboard-panel-card h-28 rounded-2xl p-4 ${index === 0 ? 'col-span-2' : ''}`} key={index}>
            <div className="skeleton-shimmer h-3 w-2/3 rounded-full" />
            <div className="skeleton-shimmer mt-5 h-6 w-4/5 rounded-full" />
          </div>
        ))}
      </div>
      <ListSkeleton count={3} />
    </div>
  )
}

export default DashboardLoading
