"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/");
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
