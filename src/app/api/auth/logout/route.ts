import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { assertSameOrigin, jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
