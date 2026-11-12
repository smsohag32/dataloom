/// <reference types="vite/client" />

declare module "*?worker" {
  const WorkerCtor: new () => Worker;
  export default WorkerCtor;
}
declare module "*.wasm?url" {
  const url: string;
  export default url;
}
declare module "monaco-editor/esm/vs/editor/edcore.main";
declare module "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
declare module "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";

