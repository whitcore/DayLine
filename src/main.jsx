import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App.jsx";
import { ThemeProvider } from "./ThemeSettings.jsx";
import { MotionProvider } from "./motion.jsx";
import "./theme.css";
import "./programs.css";
import "./motion-polish.css";
import "./themes.css";
createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <MotionProvider>
      <App />
    </MotionProvider>
  </ThemeProvider>,
);
