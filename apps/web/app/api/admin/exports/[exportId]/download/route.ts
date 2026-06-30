import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";
const AUTH_ACCESS_COOKIE = "burgoos.admin.access_token";

export async function GET(
  _request: Request,
  { params }: { params: { exportId: string } }
): Promise<NextResponse> {
  const token = cookies().get(AUTH_ACCESS_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "Sessao administrativa ausente" }, { status: 401 });
  }

  const upstream = await fetch(`${apiUrl}/api/admin/exports/${params.exportId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    const error = await upstream.json().catch(() => ({ message: "Falha ao baixar exportacao" }));
    return NextResponse.json(error, { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentDisposition = upstream.headers.get("content-disposition");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (contentDisposition) {
    headers.set("content-disposition", contentDisposition);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
