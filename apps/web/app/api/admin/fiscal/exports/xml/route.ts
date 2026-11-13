import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const AUTH_ACCESS_COOKIE = "rrfive.admin.access_token";

/** Proxies the accountant ZIP (NFC-e XMLs + summary) for a period. */
export async function GET(request: Request): Promise<NextResponse> {
  const token = cookies().get(AUTH_ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Sessao administrativa ausente" }, { status: 401 });
  }
  const incoming = new URL(request.url);
  const query = new URLSearchParams();
  for (const name of ["from", "to", "environment"]) {
    const value = incoming.searchParams.get(name);
    if (value) query.set(name, value);
  }
  const upstream = await fetch(`${apiUrl}/api/admin/fiscal/exports/xml?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!upstream.ok) {
    const error = await upstream.json().catch(() => ({ message: "Falha ao exportar os XMLs" }));
    return NextResponse.json(error, { status: upstream.status });
  }
  const headers = new Headers({ "cache-control": "private, no-store" });
  for (const name of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(upstream.body, { status: 200, headers });
}
