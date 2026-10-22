import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { ApiError, assertSameOrigin, jsonError, readJson } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ipKey = clientKey(request);
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new ApiError(400, "Enter a valid email and password.", "invalid_input");
    }

    const { email, password } = parsed.data;
    const limit = rateLimit(`login:${ipKey}:${email}`, 8, 15 * 60 * 1000);
    if (!limit.allowed) {
      throw new ApiError(429, "Too many attempts. Try again later.", "rate_limited");
    }

    const user = await db.user.findUnique({ where: { email } });
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !valid) {
      throw new ApiError(401, "Email or password is incorrect.", "invalid_credentials");
    }

    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    return jsonError(error);
  }
}
