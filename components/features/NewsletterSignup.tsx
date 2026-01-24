"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle } from "lucide-react";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to subscribe");
      }

      setSuccess(true);
      setEmail("");
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          required
          className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-white focus:outline-none"
          disabled={loading || success}
        />
        <button
          type="submit"
          disabled={loading || success}
          className="w-full sm:w-auto bg-white text-primary-600 hover:bg-primary-50 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="hidden sm:inline">Subscribing...</span>
            </>
          ) : success ? (
            <>
              <CheckCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Subscribed!</span>
            </>
          ) : (
            <>
              <Mail className="w-5 h-5" />
              <span className="hidden sm:inline">Subscribe</span>
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-200">{error}</p>
      )}
      {success && (
        <p className="mt-2 text-sm text-green-200">
          Thank you for subscribing! Check your email for confirmation.
        </p>
      )}
    </form>
  );
}
