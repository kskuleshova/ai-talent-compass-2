import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { LayoutDashboard, LogOut, Sparkles, Briefcase, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVacancies } from "@/lib/vacancies.functions";

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const fn = useServerFn(listVacancies);
  const { data: vacancies } = useQuery({ queryKey: ["vacancies"], queryFn: () => fn() });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  const initials = (user.user_metadata?.full_name ?? user.email ?? "U")
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">AI-screening</span>
            <span className="text-xs text-muted-foreground font-normal">by Kiruka</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {/* Vacancies header row */}
          <div className="flex items-center justify-between px-3 py-1.5">
            <Link
              to="/dashboard"
              className={`flex items-center gap-2 text-sm font-medium transition ${
                pathname === "/dashboard"
                  ? "text-accent-foreground"
                  : "text-sidebar-foreground/80 hover:text-accent-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Vacancies
            </Link>
            <Link
              to="/vacancies/new"
              title="Створити вакансію"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Vacancy list */}
          <ul className="mt-1 space-y-0.5">
            {vacancies === undefined ? (
              // Loading skeletons
              Array.from({ length: 2 }).map((_, i) => (
                <li key={i} className="h-8 mx-1 animate-pulse rounded-md bg-accent/40" />
              ))
            ) : vacancies.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">No vacancies yet</li>
            ) : (
              vacancies.map((v: any) => {
                const isActive = pathname === `/vacancies/${v.id}`;
                return (
                  <li key={v.id}>
                    <Link
                      to="/vacancies/$id"
                      params={{ id: v.id }}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-accent/60 hover:text-accent-foreground"
                      }`}
                    >
                      <Briefcase className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{v.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{v.candidate_count}</span>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.user_metadata?.full_name ?? "Recruiter"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button onClick={signOut} title="Sign out" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">AI-screening</span>
              <span className="text-xs text-muted-foreground font-normal">by Kiruka</span>
            </div>
          </div>
          <button onClick={signOut} className="text-sm text-muted-foreground">Sign out</button>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
