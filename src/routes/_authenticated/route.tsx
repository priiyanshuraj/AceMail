import { createFileRoute, Outlet, redirect, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Mail, Megaphone, Settings, LogOut, Inbox, Send, AtSign, Sun, Moon } from "lucide-react";
import logoUrl from "@/assets/acemail-logo.png";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/outbox", label: "Outbox", icon: Send },
  { to: "/mailboxes", label: "Mailboxes", icon: AtSign },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/templates", label: "Templates", icon: Mail },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("acemail-theme", next ? "dark" : "light"); } catch {}
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="px-4 pb-2 pt-5">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoUrl} alt="AceMail logo" className="h-8 w-8 rounded-lg" width={32} height={32} />
              <span className="text-[1.05rem] font-semibold tracking-tight text-sidebar-foreground">AceMail</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <p className="eyebrow px-2 pb-2">Workspace</p>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={pathname.startsWith(item.to)} className="relative h-9 font-medium data-[active=true]:before:absolute data-[active=true]:before:-left-2 data-[active=true]:before:top-2 data-[active=true]:before:h-5 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary">
                        <Link to={item.to}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>
        <main className="relative min-w-0 flex-1 overflow-x-hidden">
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/80 px-3 py-2.5 backdrop-blur-xl sm:px-8">
            <SidebarTrigger className="shrink-0" />
            <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md md:hidden" width={28} height={28} />
            <span className="font-semibold md:hidden">AceMail</span>
            <p className="eyebrow hidden min-w-0 flex-1 truncate md:block">
              {navItems.find((n) => pathname.startsWith(n.to))?.label ?? "AceMail"}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0"
              onClick={toggleTheme}
              aria-label={dark ? "Switch to day mode" : "Switch to night mode"}
              title={dark ? "Day mode" : "Night mode"}
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
          <div className="relative mx-auto w-full max-w-[1400px] p-3 sm:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
