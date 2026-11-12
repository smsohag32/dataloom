import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import { store } from "./store";
import { initPersistence } from "./store/persistence";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

void initPersistence();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ErrorBoundary label="DataLoom hit an unexpected error">
        <App />
      </ErrorBoundary>
    </Provider>
  </React.StrictMode>,
);

