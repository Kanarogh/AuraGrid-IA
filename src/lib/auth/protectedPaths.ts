const PROTECTED_PATH_PREFIXES = ["/c/", "/conta"] as const;

const PROTECTED_EXACT = ["/", "/welcome", "/dashboard"] as const;

export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/login") return false;
  if (PROTECTED_EXACT.includes(pathname as (typeof PROTECTED_EXACT)[number])) {
    return true;
  }
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
