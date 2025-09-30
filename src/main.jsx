import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { EditorPreferencesProvider } from "./hooks/useEditorPreferences";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <EditorPreferencesProvider>
      <App />
    </EditorPreferencesProvider>
  </React.StrictMode>
);
