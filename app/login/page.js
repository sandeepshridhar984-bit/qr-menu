"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push(`/dashboard/${data.slug}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink via-[#1a2318] to-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <BrandMark size={24} className="mx-auto" />
          <h1 className="font-display text-2xl font-bold text-paper mt-3">Restaurant login</h1>
          <p className="text-paper/50 text-sm mt-1">TableServe dashboard access.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-paper rounded-2xl p-6 shadow-2xl grid gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
            />
          </div>

          {error && <p className="text-xs text-chili-dark font-medium">{error}</p>}

          <button
            disabled={loading}
            className="bg-chili hover:bg-chili-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card mt-1"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <p className="text-center text-xs text-clay">
            <Link href="/forgot-password" className="text-chili font-semibold">Forgot password?</Link>
          </p>
          <p className="text-center text-xs text-clay">
            New restaurant?{" "}
            <Link href="/signup" className="text-chili font-semibold">Create an account</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
