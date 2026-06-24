export type PeriodsRemoteChangeKind = "listOnly" | "activeSwitch";

export type ParsedPeriodsToken = {
  activeId: string;
  maxUpdatedAt: string;
  count: number;
};

export function parsePeriodsToken(token: string): ParsedPeriodsToken {
  const lastColon = token.lastIndexOf(":");
  const count = Number(token.slice(lastColon + 1));
  const rest = token.slice(0, lastColon);
  const firstColon = rest.indexOf(":");
  if (firstColon === -1) {
    return { activeId: rest || "0", maxUpdatedAt: "0", count };
  }
  return {
    activeId: rest.slice(0, firstColon) || "0",
    maxUpdatedAt: rest.slice(firstColon + 1) || "0",
    count,
  };
}

export function classifyPeriodsRemoteChange(
  prev: string,
  next: string
): PeriodsRemoteChangeKind {
  const p = parsePeriodsToken(prev);
  const n = parsePeriodsToken(next);
  if (n.count > p.count) return "listOnly";
  if (n.activeId !== p.activeId && n.count === p.count) return "activeSwitch";
  return "listOnly";
}
