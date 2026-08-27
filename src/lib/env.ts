export function envValue(name: string) {
  return (process.env[name] ?? "").trim().replace(/^['"]|['"]$/g, "");
}

export type ApiStatus = {
  present: boolean;
  ok: boolean;
  reason: string;
};
