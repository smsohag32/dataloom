import type { Source } from "@/engine/duckdb/ingest";

export interface SampleDataset {
  id: string;
  title: string;
  description: string;
  filename: string;
  build: () => Source;
}

/** Small deterministic PRNG so samples are identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

function ordersCsv(): string {
  const r = rng(42);
  const products = [
    ["Mechanical Keyboard", "Peripherals", 129.0],
    ["4K Monitor", "Displays", 449.5],
    ["USB-C Hub", "Accessories", 59.99],
    ["Noise-Cancelling Headphones", "Audio", 249.0],
    ["Ergonomic Mouse", "Peripherals", 79.0],
    ["Webcam HD", "Video", 89.9],
    ["Laptop Stand", "Accessories", 45.0],
    ["Standing Desk", "Furniture", 599.0],
  ] as const;
  const countries = ["US", "DE", "GB", "FR", "CA", "BD", "JP", "BR", "IN", "AU"];
  const status = ["delivered", "delivered", "delivered", "shipped", "processing", "cancelled", "refunded"];
  const lines = ["order_id,order_date,customer_name,country,product,category,quantity,unit_price,discount,is_prime,status"];
  const names = ["Ava Chen", "Liam Novak", "Noah Smith", "Mia Rossi", "Zoe Khan", "Ethan Park", "Ivy Garcia", "Omar Ali", "Lena Weber", "Kai Tanaka", "  Sara Lee ", "ruby jones"];
  for (let i = 1; i <= 1500; i++) {
    const [product, category, price] = pick(r, products);
    const d = new Date(Date.UTC(2025, 0, 1) + Math.floor(r() * 365) * 86400000 + Math.floor(r() * 86400) * 1000);
    const disc = r() < 0.7 ? "" : (Math.round(r() * 20) / 100).toFixed(2);
    lines.push(
      [
        1000 + i,
        d.toISOString().slice(0, 19).replace("T", " "),
        pick(r, names),
        pick(r, countries),
        product,
        category,
        1 + Math.floor(r() * 5),
        price,
        disc,
        r() < 0.4 ? "true" : "false",
        pick(r, status),
      ].join(","),
    );
  }
  // A couple of exact duplicates to make "Drop duplicates" demonstrable.
  lines.push(lines[5], lines[9]);
  return lines.join("\n");
}

function webhookLogsJson(): string {
  const r = rng(7);
  const events = ["invoice.paid", "invoice.failed", "customer.created", "charge.refunded", "subscription.updated"];
  const providers = ["stripe", "github", "shopify"];
  const logs = Array.from({ length: 400 }, (_, i) => {
    const status = pick(r, [200, 200, 200, 200, 201, 400, 404, 500, 502]);
    return {
      id: `evt_${(100000 + i).toString(36)}`,
      received_at: new Date(Date.UTC(2025, 5, 1) + i * 137000).toISOString(),
      provider: pick(r, providers),
      event: pick(r, events),
      request: {
        method: "POST",
        path: `/hooks/${pick(r, providers)}`,
        headers: { "user-agent": pick(r, ["Stripe/1.0", "GitHub-Hookshot", "Shopify-Captain-Hook"]), "content-length": 200 + Math.floor(r() * 4000) },
      },
      response: { status, latency_ms: Math.round(20 + r() * (status >= 500 ? 2500 : 300)) },
      payload: {
        customer: { id: `cus_${Math.floor(r() * 90000)}`, plan: pick(r, ["free", "pro", "team"]) },
        amount: Math.round(r() * 50000) / 100,
        currency: pick(r, ["usd", "eur", "gbp"]),
        tags: ["a", "b"].slice(0, 1 + Math.floor(r() * 2)),
      },
      retries: status >= 500 ? Math.floor(r() * 4) : 0,
    };
  });
  return JSON.stringify(logs, null, 2);
}

const BENCHMARKS_MD = `# Project Benchmarks

Results from our nightly performance runs. Every table below is auto-extracted into a
queryable SQL table — try \`SELECT * FROM project_benchmarks_table_1\`.

## Query latency

| engine    | dataset      | rows_millions | p50_ms | p95_ms | passed |
|-----------|--------------|--------------:|-------:|-------:|:------:|
| DuckDB    | taxi_2024    |            12 |   41.5 |  120.2 | true   |
| DuckDB    | clickstream  |            50 |  188.0 |  410.9 | true   |
| SQLite    | taxi_2024    |            12 |  912.4 | 2301.0 | true   |
| SQLite    | clickstream  |            50 | 4410.7 | 9980.1 | false  |
| Postgres  | taxi_2024    |            12 |  260.3 |  655.5 | true   |
| Postgres  | clickstream  |            50 | 1210.0 | 3012.8 | true   |

## Memory footprint

| engine   | peak_mb | build   | released   |
|----------|--------:|---------|------------|
| DuckDB   |     312 | wasm    | 2025-03-14 |
| SQLite   |     148 | wasm    | 2025-02-01 |
| Postgres |     890 | native  | 2025-01-20 |

## Notes

- All runs executed on an M2 laptop, Chrome 130.
- Lower is better for latency and memory.

### Regressions

| week | regression                | severity |
|------|---------------------------|----------|
| 12   | JSON parse slowdown       | medium   |
| 13   | Arrow batch size too big  | low      |
| 14   | Worker startup delay      | high     |
`;

export const SAMPLES: SampleDataset[] = [
  {
    id: "orders",
    title: "E-Commerce Orders",
    description: "1,500 orders · CSV · nulls, duplicates & messy names to clean",
    filename: "orders.csv",
    build: () => ({ name: "orders.csv", kind: "csv", text: ordersCsv() }),
  },
  {
    id: "webhooks",
    title: "API Webhook Logs",
    description: "400 events · nested JSON · auto-flattened to dot-notation",
    filename: "webhook_logs.json",
    build: () => ({ name: "webhook_logs.json", kind: "json", text: webhookLogsJson() }),
  },
  {
    id: "benchmarks",
    title: "Project Benchmarks",
    description: "Markdown report with 3 GFM tables extracted as SQL tables",
    filename: "project_benchmarks.md",
    build: () => ({ name: "project_benchmarks.md", kind: "markdown", text: BENCHMARKS_MD }),
  },
];

export const BIG_TABLE_SQL = `CREATE OR REPLACE TABLE benchmark_100k AS
SELECT
  i AS id,
  'user_' || (i % 5000) AS username,
  round(random() * 1000, 2) AS amount,
  (i % 7) AS bucket,
  (i % 3 = 0) AS flag,
  TIMESTAMP '2025-01-01' + INTERVAL (i) MINUTE AS created_at
FROM range(100000) t(i);`;

