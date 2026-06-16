import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UK Aesthetics Lead Engine',
  description: 'Autonomous lead generation for London aesthetic clinics',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <div className="min-h-screen">
          {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">UK Aesthetics Lead Engine</h1>
                <p className="text-sm text-gray-600">London aesthetic clinic intelligence & outreach</p>
              </div>
              <nav className="flex space-x-4">
                <a href="/" className="text-gray-700 hover:text-gray-900">Dashboard</a>
                <a href="/clinics" className="text-gray-700 hover:text-gray-900">Clinics</a>
                <a href="/outreach" className="text-gray-700 hover:text-gray-900">Outreach</a>
                <a href="/settings" className="text-gray-700 hover:text-gray-900">Settings</a>
              </nav>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main>{children}</main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-sm text-gray-600">© 2024 Playbook MPR. All rights reserved.</p>
          </div>
        </footer>
      </div>
      </body>
    </html>
  )
}
