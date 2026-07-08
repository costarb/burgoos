import React from "react";
import { redirect } from "next/navigation";
import { getPlatformAdminToken, listPlatformUsers } from "../../../lib/api";
import { PlatformUsersClient } from "./platform-users-client";

export const dynamic = "force-dynamic";

interface PlatformUsersPageProps {
  searchParams?: {
    search?: string;
    active?: string;
    role?: string;
  };
}

export default async function PlatformUsersPage({ searchParams }: PlatformUsersPageProps) {
  const token = await getPlatformAdminToken();
  const search = searchParams?.search?.trim() ?? "";
  const active =
    searchParams?.active === "true" || searchParams?.active === "false" ? searchParams.active : "";
  const role =
    searchParams?.role === "SUPER_ADMIN" || searchParams?.role === "SUPPORT"
      ? searchParams.role
      : "";
  let users;

  try {
    users = await listPlatformUsers(token, { search, active, role });
  } catch (error) {
    if (isPlatformForbidden(error)) {
      redirect("/admin");
    }

    throw error;
  }

  return (
    <PlatformUsersClient
      initialFilters={{ active, role, search }}
      initialUsers={users}
      token={token}
    />
  );
}

function isPlatformForbidden(error: unknown): boolean {
  return error instanceof Error && error.message.includes("[403] /api/platform/users");
}
