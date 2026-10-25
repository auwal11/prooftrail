import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const run = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = process.env.BOOTSTRAP_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const logs: string[] = [];
  try {
    const migrate = await run("npx", ["prisma", "migrate", "deploy"], {
      env: process.env,
      timeout: 120_000,
    }).catch((error: { stdout?: string; stderr?: string; message?: string }) => {
      logs.push(error.stdout ?? "", error.stderr ?? "", error.message ?? "");
      throw error;
    });
    logs.push(migrate.stdout, migrate.stderr);

    const seed = await run("npx", ["prisma", "db", "seed"], {
      env: process.env,
      timeout: 180_000,
    }).catch((error: { stdout?: string; stderr?: string; message?: string }) => {
      logs.push(error.stdout ?? "", error.stderr ?? "", error.message ?? "");
      throw error;
    });
    logs.push(seed.stdout, seed.stderr);

    return NextResponse.json({ ok: true, logs: logs.join("\n").slice(-5000) });
  } catch {
    return NextResponse.json(
      { ok: false, logs: logs.join("\n").slice(-5000) },
      { status: 500 },
    );
  }
}
