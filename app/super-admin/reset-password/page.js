"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reset password.");
      setDone(true);
      setTimeout(() => router.push("/super-admin/login"), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-center text-sm text-chili-dark">This reset link is missing its token. Request a new one from the forgot-password page.</p>;
  }

  if (done) {
    return <p className="text-center text-sm text-herb font-medium">Password updated! Redirecting to log in...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <label className="block text-xs font-semibold text-ink mb-1.5">New password</label>
        <input
          required
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-ink mb-1.5">Confirm new password</label>
        <input
          required
          type="password"
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white outline-none focus:border-chili"
        />
      </div>
      {error && <p className="text-xs text-chili-dark font-medium">{error}</p>}
      <button
        disabled={loading}
        className="bg-chili hover:bg-chili-dark disabled:opacity-60 transition-colors text-white font-semibold py-3 rounded-card"
      >
        {loading ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}

export default function SuperAdminResetPasswordPage() {
  return (
    <main className="min-h-screen bg-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto">
            <ShieldCheck size={24} className="text-turmeric" />
          </div>
          <h1 className="font-display text-2xl font-bold text-paper mt-3">Set a new password</h1>
        </div>
        <div className="bg-paper rounded-2xl p-6 shadow-2xl">
          <Suspense fallback={<p className="text-sm text-clay text-center">Loading...</p>}>
            <ResetForm />
          </Suspense>
          <p className="text-center text-xs text-clay mt-4">
            <Link href="/super-admin/login" className="text-chili font-semibold">Back to log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
