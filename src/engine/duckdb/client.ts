import * as duckdb from "@duckdb/duckdb-wasm";
import mvpWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasm from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

/**
 * DuckDB-Wasm runs inside a dedicated Web Worker (spawned by AsyncDuckDB), so
 * analytical queries never block the UI thread. Bundles are served from the app
 * itself — nothing is fetched from a CDN, keeping the app fully offline-capable.
 */
const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

export interface DuckDBHandle {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}

let handlePromise: Promise<DuckDBHandle> | null = null;

export function getDuckDB(): Promise<DuckDBHandle> {
  if (!handlePromise) {
    handlePromise = (async () => {
      const bundle = await duckdb.selectBundle(BUNDLES);
      if (!bundle.mainWorker) throw new Error("No compatible DuckDB-Wasm bundle for this browser");
      const worker = new Worker(bundle.mainWorker);
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      const conn = await db.connect();
      return { db, conn };
    })().catch((err) => {
      handlePromise = null; // allow retry
      throw err;
    });
  }
  return handlePromise;
}

export { duckdb };

