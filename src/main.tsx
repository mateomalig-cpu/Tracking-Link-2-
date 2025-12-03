import React from "react";
import ReactDOM from "react-dom/client";
import App, { TrackingRouter } from "./App.tsx";
import "./index.css"; // <- IMPORTANTE
import { BrowserRouter, Route, Routes } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/track/:token" element={<TrackingRouterWrapper />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

function TrackingRouterWrapper() {
  const token = window.location.pathname.split("/track/")[1] || "";
  return <TrackingRouter token={token.split(/[/?]/)[0]} />;
}
