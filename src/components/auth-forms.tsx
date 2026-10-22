"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-[#f1c8c3] bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
    >
      {message}
    </div>
  );
}

export function LoginForm({ demoEmail, demoPassword }: { demoEmail?: string; demoPassword?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(demoEmail ?? "");
  const [password, setPassword] = useState(demoPassword ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not sign in.");
        return;
      }
      router.replace("/cases");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className="label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          className="input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
        />
      </div>
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-[12.5px] text-muted">
        No account?{" "}
        <Link href="/register" className="font-semibold text-brand hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not create the account.");
        return;
      }
      router.replace("/cases");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className="label" htmlFor="register-name">
          Name
        </label>
        <input
          id="register-name"
          className="input"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Amina Yusuf"
        />
      </div>
      <div>
        <label className="label" htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="register-password">
          Password
        </label>
        <input
          id="register-password"
          className="input"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 10 characters"
        />
        <p className="hint mt-1.5">Use at least 10 characters. A passphrase is fine.</p>
      </div>
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-[12.5px] text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
