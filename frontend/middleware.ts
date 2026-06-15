import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const backend = process.env.BACKEND_URL ?? "http://localhost:4000";
  const url = new URL(
    request.nextUrl.pathname + request.nextUrl.search,
    backend,
  );

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: request.headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const res = await fetch(url, init);
  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export const config = {
  matcher: ["/api/:path*", "/health"],
};
