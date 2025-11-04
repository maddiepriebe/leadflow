import * as React from 'react';
import { Link } from 'react-router-dom';

// ==========================================
// LAYOUT COMPONENT
// ==========================================
// Wrapper around all pages (nav bar + content)

interface LayoutProps {
  children: React.ReactNode;  // The page content
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8 h-16 items-center">
            {/* Logo/Brand */}
            <Link 
              to="/" 
              className="text-xl font-bold text-blue-600"
            >
              LeadFlow
            </Link>
            
            {/* Nav Links */}
            <Link 
              to="/icp" 
              className="text-gray-600 hover:text-gray-900"
            >
              ICP
            </Link>
            <Link 
              to="/leads" 
              className="text-gray-600 hover:text-gray-900"
            >
              Leads
            </Link>
            <Link 
              to="/sequences" 
              className="text-gray-600 hover:text-gray-900"
            >
              Sequences
            </Link>
            <Link 
              to="/inbox" 
              className="text-gray-600 hover:text-gray-900"
            >
              Inbox
            </Link>
            <Link 
              to="/analytics" 
              className="text-gray-600 hover:text-gray-900"
            >
              Analytics
            </Link>
          </div>
        </div>
      </nav>
      
      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto py-6 px-4">
        {children}
      </main>
    </div>
  );
}