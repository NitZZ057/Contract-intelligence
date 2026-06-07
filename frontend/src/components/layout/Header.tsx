import { Activity, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useHealth } from "@/hooks/useContracts";
import { cn } from "@/utils/cn";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/upload": "Upload Contract",
  "/compare": "Change Detection",
  "/qa": "Contract Q&A",
};

function resolveTitle(pathname: string): string {
  if (pathname.startsWith("/contracts/")) {
    return "Contract Detail";
  }
  return titles[pathname] ?? "Contract Intelligence";
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const healthQuery = useHealth();
  const title = resolveTitle(location.pathname);
  const isOnline = healthQuery.data === true;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            className="focus-ring rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div>
            <p className="text-xs font-medium text-slate-500">
              <Link to="/" className="hover:text-blue-600">
                Contract Intelligence
              </Link>
              <span className="mx-2">/</span>
              <span>{title}</span>
            </p>
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          </div>
        </div>

        <div
          className={cn(
            "hidden items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium sm:flex",
            isOnline ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          <Activity className="h-4 w-4" aria-hidden="true" />
          {isOnline ? "API online" : "API offline"}
        </div>
      </div>
    </header>
  );
}
