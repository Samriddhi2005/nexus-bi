"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { signOutUser } = useAuth();

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-[#0b0f19] text-slate-100">
        <header className="glass-panel m-4 flex items-center justify-between p-4">
          <div>
            <h1 className="gradient-text text-lg font-extrabold">⚡ NexusBI Admin</h1>
            <p className="text-xs text-slate-500">Usage analytics, users, and security audit log</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/chat" className="text-xs text-blue-400 hover:text-blue-300">
              ← Back to app
            </Link>
            <button onClick={signOutUser} className="text-xs text-slate-500 hover:text-red-400">
              Sign out
            </button>
          </div>
        </header>

        <nav className="mx-4 mb-4 flex gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "border border-slate-800 text-slate-400 hover:bg-slate-800/60"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="mx-4 pb-8">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
