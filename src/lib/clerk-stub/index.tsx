"use client";

import React from "react";

// Stub for @clerk/nextjs when the package is not installed.
// All auth features degrade gracefully when Clerk is absent.

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SignInButton({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function SignUpButton({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function SignedOut({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function useUser() {
  return { isLoaded: true, user: null };
}

export function useClerk() {
  return { signOut: async () => {} };
}
