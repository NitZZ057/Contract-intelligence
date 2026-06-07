import { BarChart3, FileQuestion, GitCompare, Scale, UploadCloud } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { NavigationItem } from "@/types/navigation";
import { cn } from "@/utils/cn";

const navigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Upload", href: "/upload", icon: UploadCloud },
  { label: "Compare", href: "/compare", icon: GitCompare },
  { label: "Q&A", href: "/qa", icon: FileQuestion },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30">
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
          <Scale className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-wide">Contract AI</p>
          <p className="text-xs text-slate-400">Intelligence Platform</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Main navigation">
        {navigationItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              cn(
                "focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white",
                isActive && "bg-blue-500 text-white hover:bg-blue-500",
              )
            }
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Compliance context</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">Built for GDPR, EU AI Act, and enterprise contract review workflows.</p>
      </div>
    </aside>
  );
}
