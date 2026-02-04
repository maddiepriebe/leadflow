import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User } from 'lucide-react';

// ==========================================
// LAYOUT COMPONENT
// ==========================================
// Wrapper around all pages (nav bar + content)

interface LayoutProps {
  children: React.ReactNode;  // The page content
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16 items-center">
            {/* Left side - Logo and Nav Links */}
            <div className="flex space-x-8 items-center">
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
                ICPs
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

            {/* Right side - User info and Logout */}
            {user && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 text-sm"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
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
