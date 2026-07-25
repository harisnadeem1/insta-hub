import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  AtSign,
  History,
  Settings as SettingsIcon,
  Search,
  RefreshCw,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
} from "lucide-react";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { currentUser } from "@/lib/mock-data";

type NavItem = {
  to: "/" | "/members" | "/profiles" | "/snapshots" | "/settings";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};
const navItems: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/members", label: "Members", icon: Users },
  { to: "/profiles", label: "Profiles", icon: AtSign },
  { to: "/snapshots", label: "Snapshots", icon: History },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {navItems.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"}`}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-4 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
          Workspace
        </div>
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-md bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
          <div className="font-medium text-sidebar-foreground">Public metrics only</div>
          <p className="mt-1 leading-relaxed">
            Tracked profiles are added by username only. Private accounts are out of scope.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:block md:w-60 lg:w-64 shrink-0">
        <div className="fixed inset-y-0 left-0 w-60 lg:w-64">
          <Sidebar />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-foreground sm:text-[15px]">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
            )}
          </div>

          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search profiles, members…"
              className="h-8 w-56 pl-8 text-xs lg:w-72"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => toast.success("Sync started", { description: "Refreshing latest stats…" })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2 text-xs transition-colors hover:bg-accent">
                <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                  {currentUser.full_name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </div>
                <span className="hidden max-w-[120px] truncate sm:inline">{currentUser.full_name}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">
                <div className="font-medium">{currentUser.full_name}</div>
                <div className="text-muted-foreground">{currentUser.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <User className="mr-2 h-3.5 w-3.5" /> Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/auth" className="cursor-pointer">
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            {(title || actions) && (
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                  )}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}