import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/session";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, "You must sign in to continue.", "unauthenticated");
  }
  return user;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const expected = new URL(request.url).origin;
  const configured = process.env.APP_URL;
  const allowed = new Set([expected]);
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // Ignore malformed APP_URL; same-origin check still applies.
    }
  }

  if (!allowed.has(origin)) {
    throw new ApiError(403, "Cross-origin request rejected.", "origin_rejected");
  }
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Request body could not be parsed.", code: "invalid_body" },
      { status: 400 },
    );
  }

  console.error("[api]", error);
  return NextResponse.json(
    { error: "Something went wrong on our side. Please try again.", code: "internal" },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new ApiError(415, "Expected a JSON request body.", "unsupported_media_type");
  }
  return request.json();
}
