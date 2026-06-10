"use client";

import React from "react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { readAuthSession } from "../../lib/auth-client";
import { adminNavigation, findNavigationItem, secondaryNavigation } from "./admin-navigation";
import { StoreSwitcher } from "./store-switcher";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const current = findNavigationItem(pathname);

  useEffect(() => {
    if (!readAuthSession()) {
      router.replace("/login");
      return;
    }

    setSessionChecked(true);
  }, [router]);

  if (!sessionChecked) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm font-medium text-slate-600">
        Carregando acesso...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex lg:flex-col ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <SidebarContent collapsed={collapsed} pathname={pathname} />
        <button
          aria-label={collapsed ? "Expandir navegacao" : "Recolher navegacao"}
          className="m-3 flex min-h-10 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-900 hover:text-white"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "Expandir navegacao" : "Recolher navegacao"}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar navegacao"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="relative flex h-full w-[min(88vw,320px)] flex-col bg-slate-950 text-slate-100 shadow-2xl">
            <button
              aria-label="Fechar navegacao"
              className="absolute right-3 top-3 rounded-md p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
              pathname={pathname}
            />
          </aside>
        </div>
      ) : null}

      <div className={collapsed ? "lg:pl-20" : "lg:pl-64"}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3">
            <button
              aria-label="Abrir navegacao"
              className="rounded-md border border-slate-200 p-2 text-slate-700 lg:hidden"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                <span>Administracao</span>
                <ChevronRight className="h-3 w-3" />
                <span className="truncate">{current?.label ?? "Pagina"}</span>
              </div>
              <p className="truncate text-sm font-semibold text-slate-950">
                {current?.description ?? "BurgoOS"}
              </p>
            </div>
            <StoreSwitcher />
          </div>
        </header>
        <div className="admin-shell-content mx-auto max-w-[1600px]">{children}</div>
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <Link
        className={`flex h-16 items-center border-b border-slate-800 px-4 ${collapsed ? "justify-center" : "gap-3"}`}
        href="/admin"
        onClick={onNavigate}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-tomato font-bold text-white">
          B
        </span>
        {!collapsed ? (
          <span>
            <span className="block text-sm font-semibold">BurgoOS</span>
            <span className="block text-xs text-slate-400">Gestao da loja</span>
          </span>
        ) : null}
      </Link>
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        aria-label="Navegacao administrativa"
      >
        {adminNavigation.map((group) => (
          <div className="mb-5" key={group.label}>
            {!collapsed ? (
              <p className="mb-2 px-2 text-xs font-semibold uppercase text-slate-500">
                {group.label}
              </p>
            ) : null}
            <div className="grid gap-1">
              {group.items.map((item) => (
                <NavigationLink
                  collapsed={collapsed}
                  item={item}
                  key={item.href}
                  onNavigate={onNavigate}
                  pathname={pathname}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="border-t border-slate-800 pt-4">
          {secondaryNavigation.map((item) => (
            <NavigationLink
              collapsed={collapsed}
              item={item}
              key={item.href}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavigationLink({
  collapsed,
  item,
  pathname,
  onNavigate,
}: {
  collapsed: boolean;
  item: (typeof adminNavigation)[number]["items"][number];
  pathname: string;
  onNavigate?: () => void;
}) {
  const active =
    pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex min-h-10 items-center rounded-md px-3 text-sm font-medium ${
        collapsed ? "justify-center" : "gap-3"
      } ${active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-900 hover:text-white"}`}
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );
}
