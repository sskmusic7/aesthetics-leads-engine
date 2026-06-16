import Link from 'next/link'

async function getDashboardStats() {
  // In production, this would fetch from your API
  // For now, return mock data
  return {
    total_clinics: 0,
    scored_clinics: 0,
    high_priority: 0,
    pending_outreach: 0,
    sent_today: 0,
    by_borough: []
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Clinics</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_clinics}</p>
            </div>
            <div className="text-blue-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scored Clinics</p>
              <p className="text-3xl font-bold text-gray-900">{stats.scored_clinics}</p>
            </div>
            <div className="text-green-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Priority</p>
              <p className="text-3xl font-bold text-gray-900">{stats.high_priority}</p>
            </div>
            <div className="text-yellow-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* London Map */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">London Clinic Map</h2>
          <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
            <p className="text-gray-500">Map component will be added here</p>
            <p className="text-sm text-gray-400 ml-2">(Leaflet integration pending)</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-600">System initialized</p>
              <p className="text-xs text-gray-500">Dashboard ready for data</p>
            </div>
            <div className="border-l-4 border-gray-300 pl-4">
              <p className="text-sm text-gray-600">Awaiting first scraper run</p>
              <p className="text-xs text-gray-500">Run scrapers to populate data</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/api/scrape/all" className="block w-full text-center bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Run All Scrapers
              </Link>
              <Link href="/api/scores/generate" className="block w-full text-center bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                Generate Scores
              </Link>
              <Link href="/outreach" className="block w-full text-center bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
                View Outreach Queue
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started Guide */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Getting Started</h2>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Configure API keys in <code className="bg-blue-100 px-1 rounded">.env</code> file</li>
          <li>Setup PostgreSQL database and run migrations</li>
          <li>Run initial scrapers to populate data</li>
          <li>Wait for deduplication to process records</li>
          <li>Generate AI scores for qualified clinics</li>
          <li>Review and approve outreach drafts</li>
        </ol>
      </div>
    </div>
  )
}
