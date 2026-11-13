import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const AUTH_ACCESS_COOKIE = "rrfive.admin.access_token";
const KINDS = new Set(["xml", "danfe"]);

/** Proxies the NFC-e XML (stored copy) and DANFE (Bling print page, served by redirect). */
export async function GET(
  _request: Request,
  { params }: { params: { documentId: string; kind: string } }
): Promise<NextResponse> {
  const token = cookies().get(AUTH_ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Sessao administrativa ausente" }, { status: 401 });
  }
  if (!KINDS.has(params.kind) || !/^[0-9a-f-]{36}$/i.test(params.documentId)) {
    return NextResponse.json({ message: "Arquivo invalido" }, { status: 404 });
  }

  const upstream = await fetch(`${apiUrl}/api/admin/fiscal/documents/${params.documentId}/${params.kind}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "manual",
  });

  const location = upstream.headers.get("location");
  if (upstream.status >= 300 && upstream.status < 400 && location?.startsWith("https://")) {
    return NextResponse.redirect(location, 302);
  }
  if (!upstream.ok) {
    const error = await upstream.json().catch(() => ({ message: "Arquivo indisponivel" }));
    return NextResponse.json(error, { status: upstream.status });
  }

  const headers = new Headers({ "cache-control": "private, no-store" });
  for (const name of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
