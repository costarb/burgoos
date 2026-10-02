import React from "react";

export type RouteSkeletonVariant = "list" | "panel";

/**
 * Generic loading preview rendered by app/**\/loading.tsx while a route
 * segment's data is still being fetched (see
 * specs/024-navigation-loading-indicator). Deliberately generic - it does
 * not try to replicate each screen's final layout.
 */
export function RouteSkeleton({ variant }: { variant: RouteSkeletonVariant }) {
  return (
    <div aria-hidden className="motion-safe:animate-pulse space-y-6 px-4 py-6 sm:px-6" role="presentation">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-100" />
      </div>
      {variant === "panel" ? <PanelBody /> : <ListBody />}
    </div>
  );
}

function PanelBody() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4" key={index}>
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="h-6 w-24 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-md border border-slate-200 bg-white" />
    </>
  );
}

function ListBody() {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="h-10 border-b border-slate-100 bg-slate-50" />
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0" key={index}>
          <div className="h-4 w-1/4 rounded bg-slate-100" />
          <div className="h-4 w-1/3 rounded bg-slate-100" />
          <div className="ml-auto h-4 w-16 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
