import { afterEach, describe, expect, it } from "vitest";
import { ApiError, assertSameOrigin } from "@/lib/http";

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
});

function request(headers: Record<string, string>, url = "http://localhost:8080/api/auth/login"): Request {
  return new Request(url, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("accepts a proxy-forwarded public origin when the request URL is internal", () => {
    process.env.APP_URL = "http://localhost:3000";
    expect(() =>
      assertSameOrigin(
        request({
          origin: "https://prooftrail.rumptycloud.app",
          "x-forwarded-host": "prooftrail.rumptycloud.app",
          "x-forwarded-proto": "https",
        }),
      ),
    ).not.toThrow();
  });

  it("accepts an origin configured through APP_URL", () => {
    process.env.APP_URL = "https://prooftrail.example/";
    expect(() =>
      assertSameOrigin(request({ origin: "https://prooftrail.example" }, "http://internal:3000/api/auth/login")),
    ).not.toThrow();
  });

  it("rejects an unrelated origin", () => {
    process.env.APP_URL = "https://prooftrail.rumptycloud.app";
    try {
      assertSameOrigin(request({ origin: "https://attacker.example" }));
      throw new Error("expected assertSameOrigin to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("origin_rejected");
      expect((error as ApiError).status).toBe(403);
    }
  });

  it("leaves non-browser requests without an Origin header to session auth", () => {
    expect(() => assertSameOrigin(request({}))).not.toThrow();
  });
});
