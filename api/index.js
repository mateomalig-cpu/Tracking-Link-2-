const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

// Datos de prueba en memoria
const shipments = {
  "TRACK-123": { status: "En Tránsito", location: "Miami, FL", delivery_date: "2025-12-05" },
  "TRACK-456": { status: "Entregado", location: "Madrid, ES", delivery_date: "2025-12-01" },
  "TRACK-999": { status: "En Aduana", location: "Ciudad de México", delivery_date: "Pendiente" },
};

app.get("/track/:id", (req, res) => {
  const trackingId = req.params.id;
  const info = shipments[trackingId];

  if (info) {
    res.json({ tracking_number: trackingId, ...info });
  } else {
    res.status(404).json({ error: "Tracking number no encontrado. Prueba con TRACK-123" });
  }
});

app.get("/", (_req, res) => {
  res.send("API Tracking v1.0 (Modo Prueba) - Funcionando en Azure 🚀");
});

app.listen(port, () => {
  console.log(`Servidor listo en puerto ${port}`);
});
