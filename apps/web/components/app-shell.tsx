"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  Film,
  Home,
  Library,
  ListVideo,
  Radio,
  Search,
  Settings,
  Tv,
  Users,
} from "lucide-react";
import { Badge, cn } from "@iptv/ui";

import { BrandLockup, BrandMark } from "@/components/brand-mark";
import { CommandPalette } from "@/components/search/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { useActiveProfile } from "@/stores/profile-store";
import { usePlaylistStore } from "@/stores/playlist-store";
import { initialsOf } from "@/lib/format";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/live", label: "Canlı TV", icon: Radio },
  { href: "/guide", label: "TV Rehberi", icon: CalendarClock },
  { href: "/movies", label: "Filmler", icon: Film },
  { href: "/series", label: "Diziler", icon: Tv },
  { href: "/library", label: "Kitaplığım", icon: Library },
  { href: "/playlists", label: "Playlistler", icon: ListVideo },
  { href: "/profiles", label: "Profiller", icon: Users },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/live", label: "Canlı", icon: Radio },
  { href: "/movies", label: "Filmler", icon: Film },
  { href: "/series", label: "Diziler", icon: Tv },
  { href: "/playlists", label: "Playlist", icon: ListVideo },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
        "duration-fast ease-brand transition-colors",
        active
          ? "bg-accent/60 text-foreground"
          : "text-muted-foreground hover:bg-accent/35 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "bg-primary duration-fast absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
      {item.label}
    </Link>
  );
}

function ProfileChip() {
  const profile = useActiveProfile();
  if (!profile) return null;

  return (
    <Link
      href="/profiles"
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-2",
        "duration-fast hover:bg-accent/35 transition-colors",
      )}
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-md text-xs font-semibold text-white ring-1 ring-inset ring-white/15"
        style={{ backgroundColor: `hsl(var(--accent-${profile.color}))` }}
      >
        {initialsOf(profile.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">{profile.name}</span>
        <span className="text-2xs text-muted-foreground block">Profili değiştir</span>
      </span>
    </Link>
  );
}

function Sidebar({ pathname, onSearch }: { pathname: string; onSearch: () => void }) {
  const sources = usePlaylistStore((state) => state.sources);
  const activeCount = sources.filter((source) => source.enabled).length;

  return (
    <aside className="w-sidebar border-border/70 bg-surface/60 hidden shrink-0 flex-col border-r backdrop-blur-xl lg:flex">
      <div className="h-18 flex items-center px-5">
        <Link href="/" className="focus-visible:ring-ring/70 rounded-md focus-visible:ring-2">
          <BrandLockup />
        </Link>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onSearch}
          className={cn(
            "border-border/70 bg-surface-2/60 flex w-full items-center gap-2.5 rounded-md border px-3 py-2",
            "text-muted-foreground text-left text-sm",
            "duration-fast ease-brand hover:border-border hover:text-foreground transition-colors",
            "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
          )}
        >
          <Search className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Ara…</span>
          <kbd className="border-border/70 bg-surface-3/60 text-2xs shrink-0 rounded border px-1.5 py-0.5 font-medium">
            Ctrl K
          </kbd>
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-3 pb-2">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2 p-3">
        {activeCount > 0 ? (
          <div className="bg-surface-2/70 flex items-center justify-between rounded-md px-3 py-2.5">
            <span className="text-muted-foreground text-xs">Etkin kaynak</span>
            <Badge variant="brand">{activeCount}</Badge>
          </div>
        ) : null}

        <div className="divider-brand my-1" />

        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <ProfileChip />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function MobileBar({ pathname }: { pathname: string }) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-border/70 bg-background/85 border-t backdrop-blur-xl",

        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="grid grid-cols-5">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-2xs duration-fast flex flex-col items-center gap-1 py-2.5 font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export interface AppShellProps {
  children: React.ReactNode;

  bleed?: boolean;
}

export function AppShell({ children, bleed = false }: AppShellProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "k" && event.key !== "K") return;
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setSearchOpen((open) => !open);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app-ambient relative flex h-dvh overflow-hidden">
      <Sidebar pathname={pathname} onSearch={() => setSearchOpen(true)} />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-border/70 bg-background/80 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur-xl lg:hidden">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <span className="text-sm font-semibold tracking-tight">Duthris IPTV</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Ara"
              className={cn(
                "text-muted-foreground grid size-9 place-items-center rounded-md",
                "duration-fast ease-brand hover:bg-accent/50 hover:text-foreground transition-colors",
                "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
              )}
            >
              <Search className="size-4" />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <main
          className={cn(
            "min-h-0 flex-1 pb-16 lg:pb-0",
            bleed
              ? "overflow-hidden"
              : "overflow-y-auto overscroll-contain px-4 py-6 lg:px-8 lg:py-8",
          )}
        >
          {children}
        </main>
      </div>

      <MobileBar pathname={pathname} />

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
