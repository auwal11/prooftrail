import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const limit = rateLimit(`register:${clientKey(request)}`, 8, 15 * 60 * 1000);
    if (!limit.allowed) {
      throw new ApiError(429, "Too many attempts. Try again later.", "rate_limited");
    }

    const parsed = registerSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Check your details.", "invalid_input");
    }

    const { name, email, password } = parsed.data;
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ApiError(409, "An account with this email already exists.", "email_taken");
    }

    const user = await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
      select: { id: true, email: true, name: true },
    });

    await createSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
