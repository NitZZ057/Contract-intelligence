import { X } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-slate-900 shadow-xl">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="focus-ring absolute right-3 top-3 rounded-md p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="h-full">
              <Sidebar />
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
