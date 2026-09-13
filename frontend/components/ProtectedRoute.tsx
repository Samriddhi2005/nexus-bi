"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";

export default function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (requireAdmin && profile && profile.role !== "admin") {
      router.replace("/chat");
    }
  }, [loading, firebaseUser, profile, requireAdmin, router]);

  if (loading || !firebaseUser || (requireAdmin && profile?.role !== "admin")) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b0f19] text-slate-400">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
