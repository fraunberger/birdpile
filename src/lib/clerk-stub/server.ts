// Stub for @clerk/nextjs/server when the package is not installed.

export function auth() {
  return { userId: null };
}

export function clerkClient() {
  return {
    users: {
      getUser: async () => null,
    },
  };
}

export function clerkMiddleware() {
  return async () => {};
}
