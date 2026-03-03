import { NextResponse, type NextRequest } from "next/server";

const upstreamBase =
  process.env.UPSTREAM_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://zf7o4xenif.execute-api.us-east-1.amazonaws.com/dev/v2";

async function proxy(
  req: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  const segments = params.path || [];
  const search = req.nextUrl.search;
  const targetBase = upstreamBase.replace(/\/$/, "");
  const targetPath = segments.join("/");
  const targetUrl = `${targetBase}/${targetPath}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");

  const init: RequestInit = { method: req.method, headers, redirect: "manual" };
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    init.body = await req.arrayBuffer();
  }

  const upstreamRes = await fetch(targetUrl, init);
  const resHeaders = new Headers(upstreamRes.headers);
  resHeaders.delete("content-encoding");
  resHeaders.delete("content-length");
  resHeaders.delete("transfer-encoding");

  const body = await upstreamRes.arrayBuffer();
  return new NextResponse(body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
