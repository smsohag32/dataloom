type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Flatten nested objects into dot-notation keys. Arrays are kept as JSON strings. */
export function flattenObject(obj: Json, prefix = "", out: Record<string, Json> = {}): Record<string, Json> {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    out[prefix || "value"] = Array.isArray(obj) ? JSON.stringify(obj) : obj;
    return out;
  }
  const entries = Object.entries(obj);
  if (entries.length === 0 && prefix) out[prefix] = null;
  for (const [k, v] of entries) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) flattenObject(v, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

/**
 * Normalise a parsed JSON document into an array of records.
 * Accepts a flat array, a single object, or an object wrapping one array of records.
 */
export function toRecords(doc: Json): Json[] {
  if (Array.isArray(doc)) return doc;
  if (doc && typeof doc === "object") {
    const arrays = Object.values(doc).filter(
      (v): v is Json[] => Array.isArray(v) && v.length > 0 && typeof v[0] === "object",
    );
    if (arrays.length === 1) return arrays[0];
    return [doc];
  }
  return [doc];
}

/** Returns newline-delimited JSON with flattened records. */
export function flattenToNdjson(text: string, isLines: boolean): string {
  const records: Json[] = isLines
    ? text
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as Json)
    : toRecords(JSON.parse(text) as Json);
  // Unify keys so every record has every column (DuckDB infers types from all rows).
  const flat = records.map((r) => flattenObject(r));
  const keys = new Set<string>();
  flat.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
  return flat
    .map((r) => JSON.stringify(Object.fromEntries([...keys].map((k) => [k, r[k] ?? null]))))
    .join("\n");
}

