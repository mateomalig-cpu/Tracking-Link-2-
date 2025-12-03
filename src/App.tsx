import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Package,
  Warehouse,
  FileText,
  Layers,
  Plus,
  X,
  PieChart as PieChartIcon,
  ClipboardList,
  AlertTriangle,
  Mail,
  Archive,
  Undo,
  Ship,
  Anchor,
  Edit3,
  Trash2
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

// =====================================================================
// ESTILOS GLOBALES Y FUENTES (Inyección de CSS)
// =====================================================================
// Inyectamos la fuente Quicksand (pág 24 del manual) y definimos variables CSS
const BrandStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&family=Quicksand:wght@400;500;600;700&display=swap');

    :root {
      --aq-blue: #425563;       /* Pantone 7545 C */
      --aq-orange: #FE5000;     /* Pantone 021 C */
      --aq-warm-gray: #D7D2CB;  /* Pantone Warm Gray 1 */
      --aq-dark-gray: #6E6259;  /* Warm Gray 11 (Textos) */
      --aq-turquoise: #279989;  /* Complementario 1 */
      --aq-olive: #76881D;      /* Complementario 2 */
      --aq-yellow: #DAAA00;     /* Complementario 3 */
      --aq-bg-light: #F9F8F6;   /* Versión muy clara de Warm Gray para UI */
    }

    body {
      font-family: 'Merriweather', serif; /* Sustituto web para Charter ITC */
      background-color: var(--aq-bg-light);
      color: var(--aq-blue);
    }

    h1, h2, h3, h4, .brand-font {
      font-family: 'Quicksand', sans-serif; /* Tipografía complementaria del manual */
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Botones Primarios (Naranja Toque) */
    .btn-primary {
      background-color: var(--aq-orange);
      color: white;
      transition: all 0.2s;
    }
    .btn-primary:hover {
      background-color: #e64600;
    }

    /* Botones Secundarios (Azul Corporativo) */
    .btn-secondary {
      background-color: var(--aq-blue);
      color: white;
    }
    .btn-secondary:hover {
      background-color: #354451;
    }

    /* Inputs y Selects estilo "Papelería" */
    .input-brand {
      border: 1px solid #D7D2CB;
      background-color: white;
      font-family: 'Quicksand', sans-serif;
      color: var(--aq-blue);
    }
    .input-brand:focus {
      outline: none;
      border-color: var(--aq-orange);
      ring: 1px solid var(--aq-orange);
    }
    
    /* Tablas */
    .table-header {
      background-color: #F0EFE9; /* Warm gray very light */
      color: var(--aq-blue);
      font-family: 'Quicksand', sans-serif;
      font-weight: 700;
      font-size: 0.75rem;
    }
  `}</style>
);

// =====================================================================
// UTILIDADES GLOBALES
// =====================================================================
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const uid = () => Math.random().toString(36).slice(2);
const getFormatFromDescription = (description: string | undefined, fallback = 35) => {
  if (!description) return fallback;
  const desc = description.toLowerCase();
  if (desc.includes("10")) return 10;
  return fallback;
};

// Colores de Marca para Gráficos (Pág 17 del manual)
const BRAND_CHART_COLORS = [
  "#FE5000", // Naranja
  "#425563", // Azul
  "#279989", // Turquesa
  "#76881D", // Verde Oliva
  "#DAAA00", // Amarillo
  "#6E6259", // Gris Oscuro
];

const TRACK_STEPS: { id: TrackingStatus; label: string }[] = [
  { id: "CONFIRMADO", label: "Confirmed" },
  { id: "EN_TRANSITO", label: "In Transit" },
  { id: "LISTO_ENTREGA", label: "Ready for Delivery" },
  { id: "ENTREGADO", label: "Delivered" },
];

const TRACK_STEP_INDEX: Record<TrackingStatus, number> = TRACK_STEPS.reduce((acc, step, idx) => {
  acc[step.id] = idx;
  return acc;
}, {} as Record<TrackingStatus, number>);

const NON_PIPELINE_STAGE_MAP: Partial<Record<TrackingStatus, TrackingStatus>> = {
  RETRASO: "EN_TRANSITO",
  INCIDENCIA: "EN_TRANSITO",
};

const getPipelineStatusIndex = (
  status: TrackingStatus,
  history: { status: TrackingStatus }[] = []
): number => {
  const mapped = NON_PIPELINE_STAGE_MAP[status];
  if (mapped && typeof TRACK_STEP_INDEX[mapped] === "number") {
    return TRACK_STEP_INDEX[mapped];
  }
  const direct = TRACK_STEP_INDEX[status];
  if (typeof direct === "number") return direct;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const idx = TRACK_STEP_INDEX[history[i].status];
    if (typeof idx === "number") return idx;
  }
  return TRACK_STEP_INDEX["CONFIRMADO"];
};

const TRACKING_SYNC_EVENT = "tracking-sync";
const emitTrackingSync = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TRACKING_SYNC_EVENT));
};

// =====================================================================
// DEFINICIÓN DE TIPOS Y ESTADOS
// =====================================================================

export type TrackingStatus = "CONFIRMADO" | "EN_TRANSITO" | "LISTO_ENTREGA" | "ENTREGADO" | "RETRASO" | "INCIDENCIA";
type AssignmentTipo = "ORDEN" | "SPOT";
type AssignmentEstado = "ACTIVA" | "ANULADA";
type TabId =
  | "dashboard"
  | "inventory"
  | "orders"
  | "assignments"
  | "categories"
  | "warehouse"
  | "clientUpdate"
  | "opsInbox"
  | "controlTower"
  | "salesOverview";
type SectionId = "inventory" | "sales" | "operations";

const MENU_SECTIONS: {
  id: SectionId;
  label: string;
  tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    id: "inventory",
    label: "Inventory",
    tabs: [
      { id: "dashboard", label: "Dashboard", icon: Layers },
      { id: "inventory", label: "Inventory", icon: Warehouse },
      { id: "orders", label: "Orders", icon: FileText },
      { id: "controlTower", label: "Control Tower", icon: Layers },
      { id: "categories", label: "Categories", icon: PieChartIcon },
      { id: "warehouse", label: "Warehouses", icon: Warehouse },
      { id: "assignments", label: "Allocations", icon: ClipboardList },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    tabs: [{ id: "salesOverview", label: "Sales View", icon: Package }],
  },
  {
    id: "operations",
    label: "Operations",
    tabs: [
      { id: "opsInbox", label: "Ops Inbox", icon: ClipboardList },
      { id: "clientUpdate", label: "Tracking", icon: Mail },
    ],
  },
];

type InventoryRow = {
  id: string;
  customId?: string;
  ubicacion: string;
  bodega: string;
  planta: string;
  produccion: string;
  eta: string;
  po: string;
  customerPO: string; 
  time: string;
  awb: string | null;
  clientePrincipal: string;
  clientes: string[];
  material: string;
  descripcion: string;
  producto: string;
  sector: string;
  trim: string;
  size: string;
  escamas: string | null;
  formatoCaja: number;
  totalLbs: number;
  empacado: string;
  cajasOrden: number;
  cajasInv: number;
  activo: boolean;
  fechaCierre?: string;
  status: TrackingStatus;
  statusHistory: { at: string; status: TrackingStatus }[];
  trackingToken: string;
};

type OrderItem = { inventoryId: string; po: string; material: string; producto: string; cajas: number; };

type SalesOrderLine = { id: string; description: string; material: string; cases: number; formatLb: number; product?: string };
type SalesOrder = { id: string; salesRep: string; demandId: string; tos: string; shipTo: string; customerName: string; pickUpDate: string; brand1: string; material: string; description: string; cases: number; price: number; flex: string; incoterm: string; truck: string; customerPO: string; portEntry: string; week: string; estadoAprobacion: string; estadoProgreso: string; unidadPrecio: string; orden: string; estadoPlanificacion: string; especie: string; especieDescripcion: string; estadoDetPrecio: string; incoterms2: string; brand: string; lines: SalesOrderLine[]; trackingToken: string; };

interface Assignment {
  id: string;
  fecha: string;
  tipo: AssignmentTipo;
  salesOrderId?: string;
  spotCliente?: string;
  spotRef?: string;
  cliente: string;
  estado: AssignmentEstado;
  items: OrderItem[];
}

type StoredAssignment = Omit<Assignment, "items"> & { items?: OrderItem[] };
type InventoryFormPayload = Omit<InventoryRow, "totalLbs" | "cajasInv" | "activo" | "clientes" | "statusHistory" | "trackingToken" | "fechaCierre"> & { cajasDisponibles: number; id?: string };

const sanitizeAssignment = (data: StoredAssignment): Assignment => ({
  ...data,
  items: Array.isArray(data.items) ? data.items : [],
});

const getAssignmentItems = (assignment: Pick<Assignment, "items">) =>
  Array.isArray(assignment.items) ? assignment.items : [];

type DashboardAgg = {
  byWarehouse: { bodega: string; totalCajas: number; totalLbs: number }[];
  byStatus: { status: string; cajas: number }[];
  assignmentsByStatus: { status: string; count: number }[];
};

// =====================================================================
// DATOS DE EJEMPLO Y PERSISTENCIA
// =====================================================================

const INVENTORY_LS_KEY = "inventory_v3";
const ASSIGNMENTS_LS_KEY = "assignments_v3";
const SALES_ORDERS_LS_KEY = "sales_orders_v1";
const TRACKING_HISTORY_LS_KEY = "tracking_history_v1";
const TRACKING_API_BASE = "/api";

// =====================================================================
// CONFIGURACIÓN DE NOTIFICACIONES Y DATOS
// =====================================================================

const clientDirectory: Record<string, { email: string }> = {
  "AquaChile MIA": { email: "customer@example.com" },
  "Santa Monica": { email: "santa.monica@example.com" },
  "Pacific Seafood Group": { email: "pacific.seafood@example.com" },
  "Publix": { email: "publix@example.com" },
  "Santa Monica Seafood Co. Inc.": { email: "santa.monica.seafood@example.com" },
  "Tampa Bay Fisheries, Inc.": { email: "tbf@example.com" },
  "Perishable Dist. Of Iowa, Ltd.": { email: "perishable.iowa@example.com" },
  "Costco": { email: "costco@example.com" },
  "Pier Fish Company-Kroger": { email: "pierfish.kroger@example.com" },
};

const STATUS_LABELS: Record<TrackingStatus, string> = {
  CONFIRMADO: "Confirmed",
  EN_TRANSITO: "In Transit",
  LISTO_ENTREGA: "Ready for Delivery",
  ENTREGADO: "Delivered",
  RETRASO: "Delayed",
  INCIDENCIA: "Issue Reported",
};

const TRACKING_BACKGROUND_STYLE: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle at top, #d76935 0%, #772f12 55%, #1a0d08 100%)",
  backgroundAttachment: "fixed",
  backgroundSize: "cover",
  backgroundColor: "#1a0d08",
};

function composeTrackingEmailHTML(inventoryRow: InventoryRow): string {
  const statusLabel = STATUS_LABELS[inventoryRow.status] || inventoryRow.status;
  const trackingLink = getTrackingLink(inventoryRow);

  // Diseño de email adaptado a la marca (Azul corporativo + Naranja)
  return `
    <!DOCTYPE html>
    <html lang="en">
    <body style="font-family: 'Times New Roman', serif; margin: 0; padding: 20px; background-color: #F9F8F6;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-top: 5px solid #FE5000; border-bottom: 1px solid #D7D2CB;">
              <tr>
                <td style="padding: 30px; background-color: #425563; color: #ffffff;" align="center">
                   <!-- En prod: src="https://tuservidor.com/aquachile_logo_white.png" -->
                   <h1 style="margin: 0; font-family: sans-serif; font-weight: 300; letter-spacing: 2px;">AQUACHILE</h1>
                   <p style="margin-top:10px; font-size: 12px; color: #D7D2CB; text-transform: uppercase;">Order Status Update</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <p style="font-size: 16px; color: #425563;">Dear ${inventoryRow.clientePrincipal},</p>
                  <p style="font-size: 16px; color: #6E6259;">This is an update regarding your shipment. The current status is now:</p>
                  <div style="padding: 15px; background-color: #F0EFE9; border-left: 4px solid #FE5000; margin: 25px 0; font-size: 18px; font-weight: bold; color: #425563; font-family: sans-serif;">
                    ${statusLabel}
                  </div>
                  <p style="font-size: 14px; color: #6E6259; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Shipment Details:</p>
                  <ul style="list-style: none; padding: 0; font-size: 15px; color: #425563; line-height: 1.8;">
                    <li style="border-bottom: 1px solid #eee; padding: 5px 0;"><strong>Customer PO:</strong> ${inventoryRow.customerPO}</li>
                    <li style="border-bottom: 1px solid #eee; padding: 5px 0;"><strong>AquaChile Lot:</strong> ${inventoryRow.po}</li>
                    <li style="border-bottom: 1px solid #eee; padding: 5px 0;"><strong>Material:</strong> ${inventoryRow.material}</li>
                    <li style="border-bottom: 1px solid #eee; padding: 5px 0;"><strong>ETA:</strong> ${inventoryRow.eta}</li>
                  </ul>
                  <p style="font-size: 16px; text-align: center; margin-top: 40px;">
                    <a href="${trackingLink}" style="background-color: #FE5000; color: #ffffff; padding: 12px 30px; text-decoration: none; font-weight: bold; font-family: sans-serif; text-transform: uppercase; letter-spacing: 1px;">
                      Track Order
                    </a>
                  </p>
                </td>
              </tr>
              <tr style="background-color: #F9F8F6;">
                <td style="padding: 20px; text-align: center; font-size: 11px; color: #999;">
                  AquaChile Automated Notification. <br/> Please do not reply to this email.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

const sampleInventoryData: InventoryRow[] = [
  {
    id: "row-1",
    customId: "1001",
    ubicacion: "Miami, FL",
    bodega: "MIA-1",
    planta: "Magallanes",
    produccion: "2025-11-03",
    eta: "2025-11-10",
    po: "40538940",
    customerPO: "PO-AC-001",
    time: "AM",
    awb: null,
    clientePrincipal: "AquaChile MIA",
    clientes: ["AquaChile MIA"],
    material: "1113199",
    descripcion: "SA TD Pr 4-5 LB#Bo Cp 35LB AQ",
    producto: "TD 4-5 35",
    sector: "SA",
    trim: "TD",
    size: "4-5",
    escamas: null,
    formatoCaja: 35,
    totalLbs: 175 * 35,
    empacado: "FILETES",
    cajasOrden: 175,
    cajasInv: 175,
    activo: true,
    status: "EN_TRANSITO",
    statusHistory: [{ at: new Date().toISOString(), status: "CONFIRMADO" }, { at: new Date().toISOString(), status: "EN_TRANSITO" }],
    trackingToken: uid(),
  },
  {
    id: "row-3",
    customId: "1002",
    ubicacion: "Miami, FL",
    bodega: "MIA-2",
    planta: "Cardonal",
    produccion: "2025-11-04",
    eta: "2025-11-12",
    po: "40538656",
    customerPO: "PO-SM-002",
    time: "PM",
    awb: "123-45678901",
    clientePrincipal: "Santa Monica",
    clientes: ["Santa Monica"],
    material: "1113198",
    descripcion: "SA TD Pr 3-4 LB#Bo Cp 35LB AQ",
    producto: "TD 3-4 35",
    sector: "SA",
    trim: "TD",
    size: "3-4",
    escamas: "Se",
    formatoCaja: 35,
    totalLbs: 65 * 35,
    empacado: "FILETES",
    cajasOrden: 65,
    cajasInv: 65,
    activo: true,
    status: "CONFIRMADO",
    statusHistory: [{ at: new Date().toISOString(), status: "CONFIRMADO" }],
    trackingToken: uid(),
  },
  {
    id: "row-4",
    customId: "2001",
    ubicacion: "Seattle, WA",
    bodega: "SEA-1",
    planta: "Puerto Montt",
    produccion: "2025-11-01",
    eta: "2025-11-10",
    po: "40550012",
    customerPO: "PO-PSG-009",
    time: "AM",
    awb: "016-98765432",
    clientePrincipal: "Pacific Seafood Group",
    clientes: ["Pacific Seafood Group"],
    material: "1113201",
    descripcion: "SA TD Pr 2-3 LB#Bo Cp 25LB AQ",
    producto: "TD 2-3 25",
    sector: "SA",
    trim: "TD",
    size: "2-3",
    escamas: "Se",
    formatoCaja: 25,
    totalLbs: 140 * 25,
    empacado: "FILETES",
    cajasOrden: 140,
    cajasInv: 140,
    activo: true,
    status: "EN_TRANSITO",
    statusHistory: [
      { at: new Date().toISOString(), status: "CONFIRMADO" },
      { at: new Date().toISOString(), status: "EN_TRANSITO" },
    ],
    trackingToken: uid(),
  },
  {
    id: "row-5",
    customId: "3001",
    ubicacion: "Orlando, FL",
    bodega: "MIA-3",
    planta: "Quellón",
    produccion: "2025-10-30",
    eta: "2025-11-08",
    po: "40560021",
    customerPO: "PO-PUBL-015",
    time: "PM",
    awb: "123-32178945",
    clientePrincipal: "Publix",
    clientes: ["Publix"],
    material: "1113197",
    descripcion: "SA TD Pr 5-6 LB#Bo Cp 35LB AQ",
    producto: "TD 5-6 35",
    sector: "SA",
    trim: "TD",
    size: "5-6",
    escamas: null,
    formatoCaja: 35,
    totalLbs: 90 * 35,
    empacado: "FILETES",
    cajasOrden: 90,
    cajasInv: 90,
    activo: true,
    status: "LISTO_ENTREGA",
    statusHistory: [
      { at: new Date().toISOString(), status: "CONFIRMADO" },
      { at: new Date().toISOString(), status: "EN_TRANSITO" },
      { at: new Date().toISOString(), status: "LISTO_ENTREGA" },
    ],
    trackingToken: uid(),
  },
  {
    id: "row-6",
    customId: "4001",
    ubicacion: "Houston, TX",
    bodega: "HOU-1",
    planta: "Calbuco",
    produccion: "2025-10-28",
    eta: "2025-11-09",
    po: "40570011",
    customerPO: "PO-COST-022",
    time: "AM",
    awb: null,
    clientePrincipal: "Costco",
    clientes: ["Costco"],
    material: "1113205",
    descripcion: "SA TD Pr 6-7 LB#Bo Cp 35LB AQ",
    producto: "TD 6-7 35",
    sector: "SA",
    trim: "TD",
    size: "6-7",
    escamas: null,
    formatoCaja: 35,
    totalLbs: 110 * 35,
    empacado: "FILETES",
    cajasOrden: 110,
    cajasInv: 110,
    activo: true,
    status: "CONFIRMADO",
    statusHistory: [{ at: new Date().toISOString(), status: "CONFIRMADO" }],
    trackingToken: uid(),
  },
];

const sampleSalesOrders: SalesOrder[] = [
  {
    id: "DEM-1001",
    salesRep: "Juan Pérez",
    demandId: "DEM-1001",
    tos: "FOB",
    shipTo: "AquaChile MIA",
    customerName: "AquaChile MIA",
    pickUpDate: "2025-11-12",
    brand1: "AquaChile",
    material: "1113199",
    description: "SA TD Pr 4-5 LB#Bo Cp 35LB AQ",
    cases: 120,
    price: 5.4,
    flex: "Sí",
    incoterm: "FOB MIA",
    truck: "Truck 1",
    customerPO: "PO-AC-001",
    portEntry: "Miami",
    week: "W46",
    estadoAprobacion: "APROBADA",
    estadoProgreso: "PENDIENTE ASIGNACIÓN",
    unidadPrecio: "USD / lb",
    orden: "SO-9001",
    estadoPlanificacion: "PLANIFICADA",
    especie: "SA",
    especieDescripcion: "Salmón Atlántico",
    estadoDetPrecio: "OK",
    incoterms2: "FOB",
    brand: "AquaChile",
    lines: [{ id: `line-${uid()}`, description: "SA TD Pr 4-5 LB#Bo Cp 35LB AQ", material: "1113199", cases: 120, formatLb: 35 }],
    trackingToken: `order-${uid()}`,
  },
  {
    id: "DEM-1002",
    salesRep: "María López",
    demandId: "DEM-1002",
    tos: "CFR",
    shipTo: "Santa Monica",
    customerName: "Santa Monica",
    pickUpDate: "2025-11-13",
    brand1: "AquaChile",
    material: "1113198",
    description: "SA TD Pr 3-4 LB#Bo Cp 35LB AQ",
    cases: 80,
    price: 5.1,
    flex: "No",
    incoterm: "CFR LAX",
    truck: "Truck 2",
    customerPO: "PO-SM-002",
    portEntry: "Los Angeles",
    week: "W46",
    estadoAprobacion: "EN REVISIÓN",
    estadoProgreso: "PENDIENTE APROBACIÓN",
    unidadPrecio: "USD / lb",
    orden: "SO-9002",
    estadoPlanificacion: "PENDIENTE",
    especie: "SA",
    especieDescripcion: "Salmón Atlántico",
    estadoDetPrecio: "PENDIENTE",
    incoterms2: "CFR",
    brand: "AquaChile",
    lines: [{ id: `line-${uid()}`, description: "SA TD Pr 3-4 LB#Bo Cp 35LB AQ", material: "1113198", cases: 80, formatLb: 35 }],
    trackingToken: `order-${uid()}`,
  },
  {
    id: "DEM-1003",
    salesRep: "Carlos Vega",
    demandId: "DEM-1003",
    tos: "FOB",
    shipTo: "Pacific Seafood Group",
    customerName: "Pacific Seafood Group",
    pickUpDate: "2025-11-14",
    brand1: "AquaChile",
    material: "1113201",
    description: "SA TD Pr 2-3 LB#Bo Cp 25LB AQ",
    cases: 140,
    price: 5.2,
    flex: "Sí",
    incoterm: "FOB SEA",
    truck: "Truck 3",
    customerPO: "PO-PSG-009",
    portEntry: "Seattle",
    week: "W46",
    estadoAprobacion: "APROBADA",
    estadoProgreso: "PENDIENTE ASIGNACIÓN",
    unidadPrecio: "USD / lb",
    orden: "SO-9003",
    estadoPlanificacion: "PLANIFICADA",
    especie: "SA",
    especieDescripcion: "Salmón Atlántico",
    estadoDetPrecio: "OK",
    incoterms2: "FOB",
    brand: "AquaChile",
    lines: [{ id: `line-${uid()}`, description: "SA TD Pr 2-3 LB#Bo Cp 25LB AQ", material: "1113201", cases: 140, formatLb: 25 }],
    trackingToken: `order-${uid()}`,
  },
  {
    id: "DEM-1004",
    salesRep: "Ana Torres",
    demandId: "DEM-1004",
    tos: "CFR",
    shipTo: "Publix",
    customerName: "Publix",
    pickUpDate: "2025-11-11",
    brand1: "AquaChile",
    material: "1113197",
    description: "SA TD Pr 5-6 LB#Bo Cp 35LB AQ",
    cases: 90,
    price: 5.6,
    flex: "No",
    incoterm: "CFR MIA",
    truck: "Truck 4",
    customerPO: "PO-PUBL-015",
    portEntry: "Miami",
    week: "W46",
    estadoAprobacion: "EN REVISIÓN",
    estadoProgreso: "PENDIENTE APROBACIÓN",
    unidadPrecio: "USD / lb",
    orden: "SO-9004",
    estadoPlanificacion: "PENDIENTE",
    especie: "SA",
    especieDescripcion: "Salmón Atlántico",
    estadoDetPrecio: "PENDIENTE",
    incoterms2: "CFR",
    brand: "AquaChile",
    lines: [{ id: `line-${uid()}`, description: "SA TD Pr 5-6 LB#Bo Cp 35LB AQ", material: "1113197", cases: 90, formatLb: 35 }],
    trackingToken: `order-${uid()}`,
  },
  {
    id: "DEM-1005",
    salesRep: "Luis Rivas",
    demandId: "DEM-1005",
    tos: "FOB",
    shipTo: "Costco",
    customerName: "Costco",
    pickUpDate: "2025-11-15",
    brand1: "AquaChile",
    material: "1113205",
    description: "SA TD Pr 6-7 LB#Bo Cp 35LB AQ",
    cases: 110,
    price: 5.8,
    flex: "Sí",
    incoterm: "FOB HOU",
    truck: "Truck 5",
    customerPO: "PO-COST-022",
    portEntry: "Houston",
    week: "W46",
    estadoAprobacion: "APROBADA",
    estadoProgreso: "PENDIENTE ASIGNACIÓN",
    unidadPrecio: "USD / lb",
    orden: "SO-9005",
    estadoPlanificacion: "PLANIFICADA",
    especie: "SA",
    especieDescripcion: "Salmón Atlántico",
    estadoDetPrecio: "OK",
    incoterms2: "FOB",
    brand: "AquaChile",
    lines: [{ id: `line-${uid()}`, description: "SA TD Pr 6-7 LB#Bo Cp 35LB AQ", material: "1113205", cases: 110, formatLb: 35 }],
    trackingToken: `order-${uid()}`,
  },
];

function loadInventoryFromStorage(): InventoryRow[] {
  if (typeof window === "undefined") return sampleInventoryData;
  try {
    const raw = window.localStorage.getItem(INVENTORY_LS_KEY);
    if (!raw) {
      window.localStorage.setItem(INVENTORY_LS_KEY, JSON.stringify(sampleInventoryData));
      return sampleInventoryData;
    }
    return JSON.parse(raw) as InventoryRow[];
  } catch { return sampleInventoryData; }
}

function saveInventoryToStorage(list: InventoryRow[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVENTORY_LS_KEY, JSON.stringify(list));
    emitTrackingSync();
  } catch { /* ignore */ }
}

function loadAssignmentsFromStorage(): Assignment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ASSIGNMENTS_LS_KEY);
    if (!raw) {
      window.localStorage.setItem(ASSIGNMENTS_LS_KEY, JSON.stringify([]));
      return [];
    }
    const sanitized = (JSON.parse(raw) as StoredAssignment[]).filter(Boolean).map(sanitizeAssignment);
    window.localStorage.setItem(ASSIGNMENTS_LS_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch { return []; }
}

function saveAssignmentsToStorage(list: Assignment[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASSIGNMENTS_LS_KEY, JSON.stringify(list));
    emitTrackingSync();
  } catch { /* ignore */ }
}

function loadSalesOrdersFromStorage(): SalesOrder[] {
  if (typeof window === "undefined") return sampleSalesOrders;
  try {
    const raw = window.localStorage.getItem(SALES_ORDERS_LS_KEY);
    if (!raw) {
      window.localStorage.setItem(SALES_ORDERS_LS_KEY, JSON.stringify(sampleSalesOrders));
      return sampleSalesOrders;
    }
    const parsed = JSON.parse(raw) as SalesOrder[];
    const normalized = parsed.map(order => {
      const existingLines = Array.isArray(order.lines) && order.lines.length > 0
        ? order.lines
        : [{
            id: `line-${uid()}`,
            description: order.description,
            material: order.material,
            cases: order.cases,
            formatLb: getFormatFromDescription(order.description, 35),
          }];
      return {
        ...order,
        customerName: order.customerName || order.shipTo || "Cliente",
        lines: existingLines.map(line => ({
          ...line,
          id: line.id || `line-${uid()}`,
          formatLb: line.formatLb || getFormatFromDescription(line.description, 35),
        })),
        trackingToken: order.trackingToken || `order-${uid()}`,
      };
    });
    window.localStorage.setItem(SALES_ORDERS_LS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch { return sampleSalesOrders; }
}

function saveSalesOrdersToStorage(list: SalesOrder[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SALES_ORDERS_LS_KEY, JSON.stringify(list));
    emitTrackingSync();
  } catch { /* ignore */ }
}

function loadTrackingHistoryFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TRACKING_HISTORY_LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveTrackingHistoryToStorage(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRACKING_HISTORY_LS_KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
}

function getTrackingLink(invRow: InventoryRow): string {
  if (!invRow.trackingToken) return "";
  const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://tracking.example";
  return `${origin}/track/${invRow.trackingToken}`;
}

type TrackingSnapshot = {
  inventory: InventoryRow[];
  assignments: Assignment[];
  salesOrders: SalesOrder[];
};

const loadTrackingSnapshot = (): TrackingSnapshot => ({
  inventory: loadInventoryFromStorage(),
  assignments: loadAssignmentsFromStorage(),
  salesOrders: loadSalesOrdersFromStorage(),
});

const findSectionForTab = (tabId: TabId): SectionId => {
  const match = MENU_SECTIONS.find(sec => sec.tabs.some(tab => tab.id === tabId));
  return match?.id ?? "inventory";
};

// =====================================================================
// COMPONENTE PRINCIPAL: App
// =====================================================================

export default function App() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [section, setSection] = useState<SectionId>(() => findSectionForTab("dashboard"));
  const [search, setSearch] = useState("");
  const [inventory, setInventory] = useState<InventoryRow[]>(loadInventoryFromStorage);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(loadSalesOrdersFromStorage);
  const [assignments, setAssignments] = useState<Assignment[]>(loadAssignmentsFromStorage);
  
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentTipo>("ORDEN");
  const [showNewPOForm, setShowNewPOForm] = useState(false);
  const [editingInventoryRow, setEditingInventoryRow] = useState<InventoryRow | null>(null);
  const [showArchivedAssignments, setShowArchivedAssignments] = useState(false);
  const [showNewSOForm, setShowNewSOForm] = useState(false);
  const [editingSalesOrder, setEditingSalesOrder] = useState<SalesOrder | null>(null);
  const [trackingHistory, setTrackingHistory] = useState<string[]>(loadTrackingHistoryFromStorage);

  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const isTrackingRoute = path.includes("/track/");
  useEffect(() => {
    if (typeof window === "undefined" || isTrackingRoute) return;
    const syncState = () => {
      setInventory(loadInventoryFromStorage());
      setSalesOrders(loadSalesOrdersFromStorage());
      setAssignments(loadAssignmentsFromStorage());
    };
    window.addEventListener(TRACKING_SYNC_EVENT, syncState);
    window.addEventListener("storage", syncState);
    return () => {
      window.removeEventListener(TRACKING_SYNC_EVENT, syncState);
      window.removeEventListener("storage", syncState);
    };
  }, [isTrackingRoute]);
  if (isTrackingRoute) {
    const tokenWithParams = path.split("/track/")[1] || "";
    const token = tokenWithParams.split(/[/?]/)[0];
    return <TrackingRouter token={token} />;
  }

  const sendTrackingEmail = (inventoryId: string) => {
    const row = inventory.find(r => r.id === inventoryId);
    if (!row) return;
    
    let recipientEmail = clientDirectory[row.clientePrincipal]?.email;
    if (!recipientEmail) {
      const enteredEmail = prompt(`Please enter the email for ${row.clientePrincipal}:`);
      if (!enteredEmail || !enteredEmail.includes('@')) return;
      recipientEmail = enteredEmail;
    }
    
    const emailBody = composeTrackingEmailHTML(row);
    console.log("--- SIMULATING EMAIL ---");
    console.log("Body (HTML):", emailBody);
    alert(`Email simulation sent for PO ${row.po} to ${recipientEmail}.\nCheck the developer console (F12) to see the HTML body.`);
  };

  const filteredInventory = useMemo(() => {
    const q = search.toLowerCase();
    return inventory.filter(row => row.activo).filter(row =>
      [row.po, row.customerPO, row.material, row.descripcion, row.producto, row.clientePrincipal, row.clientes.join(" "), row.bodega].join(" ").toLowerCase().includes(q)
    );
  }, [inventory, search]);

  const kpis = useMemo(() => {
    const vivos = inventory.filter((r) => r.activo);
    const totalCajasInv = vivos.reduce((s, r) => s + r.cajasInv, 0);
    const totalLbsAvailable = vivos.reduce( (s, r) => s + r.cajasInv * r.formatoCaja, 0 );
    const totalAssignments = assignments.length;
    const pendingOrders = salesOrders.filter(so => so.estadoProgreso !== 'COMPLETADA').length; 

    return { totalCajasInv, totalAssignments, pendingOrders, totalLbsAvailable, };
  }, [inventory, assignments, salesOrders]);

  const dashboardAgg: DashboardAgg = useMemo(() => {
    const vivos = inventory.filter((r) => r.activo);
    const byWarehouseMap = new Map<string, { bodega: string; totalCajas: number; totalLbs: number }>();
    const byStatusMap = new Map<string, { status: string; cajas: number }>();
    const byAsgStatusMap = new Map<string, { status: string; count: number }>();

    for (const r of vivos) {
      const wh = byWarehouseMap.get(r.bodega) ?? { bodega: r.bodega, totalCajas: 0, totalLbs: 0 };
      wh.totalCajas += r.cajasInv;
      wh.totalLbs += r.cajasInv * r.formatoCaja;
      byWarehouseMap.set(r.bodega, wh);

      const st = byStatusMap.get(r.status) ?? { status: r.status, cajas: 0 };
      st.cajas += r.cajasInv;
      byStatusMap.set(r.status, st);
    }
    
    for (const a of assignments) {
      const stId = a.estado; 
      const st = byAsgStatusMap.get(stId) ?? { status: stId, count: 0 };
      st.count += 1;
      byAsgStatusMap.set(stId, st);
    }

    return {
      byWarehouse: Array.from(byWarehouseMap.values()),
      byStatus: Array.from(byStatusMap.values()),
      assignmentsByStatus: Array.from(byAsgStatusMap.values()),
    };
  }, [inventory, assignments]);

  const categorySummary = useMemo(() => {
    type Row = { key: string; sector: string; trim: string; size: string; cajas: number };
    const map = new Map<string, Row>();
    for (const r of inventory.filter((x) => x.activo)) {
      const key = `${r.sector}-${r.trim}-${r.size}`;
      const existing = map.get(key) || { key, sector: r.sector, trim: r.trim, size: r.size, cajas: 0 };
      existing.cajas += r.cajasInv;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.sector.localeCompare(b.sector) || a.trim.localeCompare(b.trim) || a.size.localeCompare(b.size)
    );
  }, [inventory]);

  const trackingInventory = useMemo(
    () => inventory.filter(row => !trackingHistory.includes(row.id)),
    [inventory, trackingHistory]
  );
  
  const handleCreateNewSalesOrder = (data: Omit<SalesOrder, 'id'>) => {
    const demandId = data.demandId || `DEM-${uid()}`;
    const newOrder: SalesOrder = { ...data, id: demandId, demandId };
    setSalesOrders(prev => {
      const nextState = [newOrder, ...prev];
      saveSalesOrdersToStorage(nextState);
      return nextState;
    });
    setShowNewSOForm(false);
  };

  const handleUpdateSalesOrder = (data: SalesOrder) => {
    setSalesOrders(prev => {
      const nextState = prev.map(order => order.id === data.id ? data : order);
      saveSalesOrdersToStorage(nextState);
      return nextState;
    });
    setEditingSalesOrder(null);
  };

  const handleCreateNewPO = (data: InventoryFormPayload) => {
    const now = new Date().toISOString();
    const newPO: InventoryRow = {
      ...data,
      id: `row-${uid()}`,
      customId: data.customId || "",
      cajasInv: data.cajasDisponibles,
      totalLbs: data.cajasDisponibles * data.formatoCaja,
      clientes: [data.clientePrincipal],
      activo: data.cajasDisponibles > 0,
      trackingToken: uid(),
      statusHistory: [{ at: now, status: data.status }],
    };
    setInventory(prev => {
      const nextState = [newPO, ...prev];
      saveInventoryToStorage(nextState);
      return nextState;
    });
    setShowNewPOForm(false);
  };

  const handleUpdatePO = (data: InventoryFormPayload) => {
    if (!data.id) return;
    setInventory(prev => {
      const nextState = prev.map(row => {
        if (row.id !== data.id) return row;
        const statusHistory = data.status !== row.status ? [...row.statusHistory, { at: new Date().toISOString(), status: data.status }] : row.statusHistory;
        return {
          ...row,
          ...data,
          cajasInv: data.cajasDisponibles,
          cajasOrden: data.cajasOrden,
          totalLbs: data.cajasDisponibles * data.formatoCaja,
          clientes: [data.clientePrincipal],
          activo: data.cajasDisponibles > 0,
          statusHistory,
        };
      });
      saveInventoryToStorage(nextState);
      return nextState;
    });
    setEditingInventoryRow(null);
  };
  
  const handleUpdateInventoryStatus = (rowId: string, newStatus: TrackingStatus) => {
    setInventory(prev => {
      const nextState = prev.map(row => {
        if (row.id !== rowId) return row;
        return { ...row, status: newStatus, statusHistory: [...row.statusHistory, { at: new Date().toISOString(), status: newStatus }] };
      });
      saveInventoryToStorage(nextState);
      return nextState;
    });
  };

  const persistTrackingSnapshot = useCallback(async () => {
    if (typeof window === "undefined" || isTrackingRoute) return;
    const tokens = Array.from(new Set(inventory.map(row => row.trackingToken).filter(Boolean)));
    if (!tokens.length) return;
    await Promise.allSettled(
      tokens.map(token =>
        fetch(`${TRACKING_API_BASE}/create-tracking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, inventory, salesOrders, assignments }),
        })
          .then(async res => {
            if (!res.ok) {
              const body = await res.text();
              console.error(`[persistTrackingSnapshot] Failed (${res.status}): ${body}`);
            }
          })
          .catch(err => {
            console.error("[persistTrackingSnapshot] Network error:", err);
          })
      )
    );
  }, [assignments, inventory, isTrackingRoute, salesOrders]);

  useEffect(() => {
    persistTrackingSnapshot();
  }, [persistTrackingSnapshot]);

  const handleDeleteInventory = (rowId: string) => {
    if (!window.confirm("¿Eliminar este lote de inventario?")) return;
    setInventory(prev => {
      const nextState = prev.filter(row => row.id !== rowId);
      saveInventoryToStorage(nextState);
      return nextState;
    });
  };

  const handleArchiveTracking = (rowId: string) => {
    setTrackingHistory(prev => {
      if (prev.includes(rowId)) return prev;
      const next = [...prev, rowId];
      saveTrackingHistoryToStorage(next);
      return next;
    });
  };

  const handleCreateAssignment = (data: { tipo: AssignmentTipo; salesOrderId?: string; spotCliente?: string; spotRef?: string; items: OrderItem[] }) => {
    const cliente = data.tipo === "ORDEN" ? (salesOrders.find(s => s.id === data.salesOrderId)?.shipTo ?? "") : (data.spotCliente ?? "");
    if (!cliente) { alert("Cliente no encontrado."); return; }
    
    const hasStock = data.items.every(item => { const invItem = inventory.find(i => i.id === item.inventoryId); return invItem && invItem.cajasInv >= item.cajas; });
    if (!hasStock) { alert("Stock insuficiente."); return; }

    const newAssignment: Assignment = { id: `ASG-${String(assignments.length + 1).padStart(4, "0")}`, fecha: new Date().toISOString().slice(0, 10), ...data, cliente, estado: "ACTIVA", };

    setInventory(prevInv => {
      const nextState = prevInv.map(r => {
        const assignedItem = data.items.find(it => it.inventoryId === r.id);
        if (!assignedItem) return r;
        const newCajasInv = r.cajasInv - assignedItem.cajas;
        return { ...r, cajasInv: newCajasInv, activo: newCajasInv > 0 };
      });
      saveInventoryToStorage(nextState);
      return nextState;
    });

    setAssignments(prev => { const next = [newAssignment, ...prev]; saveAssignmentsToStorage(next); return next; });
    setShowAssignmentForm(false);
  };

  const handleQuickAssignment = (inventoryId: string, salesOrderId: string, orderLineId: string, cajas: number) => {
    const lot = inventory.find(row => row.id === inventoryId);
    const order = salesOrders.find(o => o.id === salesOrderId);
    const line = order?.lines?.find(l => l.id === orderLineId);
    if (!lot || !order || !line) {
      alert("Información incompleta para esta asignación.");
      return;
    }
    if (cajas <= 0) {
      alert("Ingrese una cantidad válida de cajas.");
      return;
    }
    if (cajas > lot.cajasInv) {
      alert("No hay suficientes cajas en el lote seleccionado.");
      return;
    }

    handleCreateAssignment({
      tipo: "ORDEN",
      salesOrderId,
      items: [
        {
          inventoryId,
          po: lot.po,
          material: lot.material,
          producto: lot.producto,
          cajas,
        },
      ],
    });
  };

  const handleToggleAssignmentState = (id: string, to: AssignmentEstado) => {
    const asg = assignments.find(a => a.id === id);
    if (!asg) return;

    if (to === 'ANULADA') {
      if (!window.confirm("¿Anular esta asignación y devolver stock?")) return;
      setInventory(prevInv => {
        const nextState = prevInv.map(r => {
          const returnedItem = getAssignmentItems(asg).find(it => it.inventoryId === r.id);
          if (!returnedItem) return r;
          return { ...r, cajasInv: r.cajasInv + returnedItem.cajas, activo: true };
        });
        saveInventoryToStorage(nextState);
        return nextState;
      });
    } else {
      const hasStock = getAssignmentItems(asg).every(item => { const invItem = inventory.find(i => i.id === item.inventoryId); return invItem && invItem.cajasInv >= item.cajas; });
      if (!hasStock) { alert("Stock insuficiente para reactivar."); return; }
      setInventory(prevInv => {
        const nextState = prevInv.map(r => {
        const assignedItem = getAssignmentItems(asg).find(it => it.inventoryId === r.id);
          if (!assignedItem) return r;
          return { ...r, cajasInv: r.cajasInv - assignedItem.cajas };
        });
        saveInventoryToStorage(nextState);
        return nextState;
      });
    }
    
    setAssignments(prev => { const next = prev.map(a => a.id === id ? { ...a, estado: to } : a); saveAssignmentsToStorage(next); return next; });
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    if (!window.confirm("¿Eliminar esta asignación?")) return;
    const asg = assignments.find(a => a.id === assignmentId);
    if (!asg) return;
    setInventory(prevInv => {
      const nextState = prevInv.map(row => {
        const returnedItem = getAssignmentItems(asg).find(item => item.inventoryId === row.id);
        if (!returnedItem) return row;
        const cajasInv = row.cajasInv + returnedItem.cajas;
        return { ...row, cajasInv, activo: cajasInv > 0 };
      });
      saveInventoryToStorage(nextState);
      return nextState;
    });
    setAssignments(prev => {
      const next = prev.filter(asgItem => asgItem.id !== assignmentId);
      saveAssignmentsToStorage(next);
      return next;
    });
  };

  const handleDeleteSalesOrder = (orderId: string) => {
    if (!window.confirm("¿Eliminar esta orden de venta?")) return;
    setSalesOrders(prev => {
      const next = prev.filter(order => order.id !== orderId);
      saveSalesOrdersToStorage(next);
      return next;
    });
  };

  return (
    <>
      <BrandStyles />
      <Header />
      <div className="min-h-screen">
        <header className="bg-[#425563] text-white sticky top-0 z-20 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-full flex flex-col gap-3">
              <div className="sm:hidden">
                <label className="sr-only" htmlFor="mobile-tab-select">Select section</label>
                <select
                  id="mobile-tab-select"
                  value={tab}
                  onChange={(e) => {
                    const next = e.target.value as TabId;
                    const sec = findSectionForTab(next);
                    setSection(sec);
                    setTab(next);
                  }}
                  className="w-full bg-white/10 text-white uppercase text-xs font-['Quicksand'] tracking-wide px-3 py-2 border border-white/20"
                >
                  {MENU_SECTIONS.map(sec => (
                    <optgroup key={sec.id} label={sec.label}>
                      {sec.tabs.map(({ id, label }) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="hidden sm:flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 text-xs sm:text-sm font-['Quicksand'] tracking-wide overflow-x-auto">
                  {MENU_SECTIONS.map(sec => (
                    <button
                      key={sec.id}
                      onClick={() => {
                        setSection(sec.id);
                        const firstTab = sec.tabs[0]?.id;
                        if (firstTab) {
                          setTab(firstTab);
                        }
                      }}
                      className={`px-4 py-2 uppercase font-bold tracking-wide border ${
                        section === sec.id ? "bg-white text-[#425563] border-[#FE5000]" : "text-white border-white/15 hover:border-white/30"
                      }`}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>
                <nav className="flex flex-wrap gap-2 text-xs sm:text-sm font-['Quicksand'] tracking-wide overflow-x-auto pb-1">
                  {MENU_SECTIONS.find(sec => sec.id === section)?.tabs.map(({ id, label, icon }) => (
                    <NavButton key={id} active={tab === id} onClick={() => { setTab(id); setSection(findSectionForTab(id)); }} icon={icon} label={label} />
                  ))}
                </nav>
              </div>
            </div>
            {tab === "inventory" && (
              <div className="sm:ml-auto relative w-full sm:w-auto">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#D7D2CB]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SEARCH..." className="pl-8 pr-3 py-2 rounded-sm bg-[#354451] text-xs text-white w-full sm:w-64 border border-[#6E6259] focus:border-[#FE5000] focus:outline-none font-['Quicksand'] uppercase" />
              </div>
            )}
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {tab === "dashboard" && ( <DashboardView kpis={kpis} agg={dashboardAgg} /> )}
          {tab === "inventory" && ( <InventoryView rows={filteredInventory} onNewPO={() => setShowNewPOForm(true)} onEdit={setEditingInventoryRow} /> )}
          {tab === "warehouse" && ( <WarehouseView inventory={inventory.filter(r => r.activo)} /> )}
          {tab === "assignments" && ( <AssignmentsView assignments={assignments} salesOrders={salesOrders} onToggleState={handleToggleAssignmentState} onNewAssignmentOrden={() => { setAssignmentMode("ORDEN"); setShowAssignmentForm(true); }} onNewAssignmentSpot={() => { setAssignmentMode("SPOT"); setShowAssignmentForm(true); }} showArchived={showArchivedAssignments} onToggleArchived={() => setShowArchivedAssignments(prev => !prev)} /> )}
          {tab === "salesOverview" && ( <SalesView inventory={inventory} salesOrders={salesOrders} /> )}
          {tab === "clientUpdate" && (
            <ClientUpdateView
              inventory={trackingInventory}
              onStatusChange={handleUpdateInventoryStatus}
              onSendEmail={sendTrackingEmail}
              onArchive={handleArchiveTracking}
            />
          )}
          {tab === 'orders' && <SalesOrdersView orders={salesOrders} onNewOrder={() => setShowNewSOForm(true)} onEditOrder={setEditingSalesOrder} />}
      {tab === "categories" && <CategoriesView summary={categorySummary} />}
      {tab === "controlTower" && (
        <ControlTowerView
          inventory={inventory}
          salesOrders={salesOrders}
          assignments={assignments}
          onQuickAssign={handleQuickAssignment}
          onNewInventory={() => setShowNewPOForm(true)}
          onEditInventory={(row) => setEditingInventoryRow(row)}
          onDeleteInventory={handleDeleteInventory}
          onNewOrder={() => setShowNewSOForm(true)}
          onEditOrder={(order) => setEditingSalesOrder(order)}
          onDeleteOrder={handleDeleteSalesOrder}
          onOpenAssignmentForm={(mode) => { setAssignmentMode(mode); setShowAssignmentForm(true); }}
          onDeleteAssignment={handleDeleteAssignment}
        />
      )}
      {tab === "opsInbox" && (
        <OperationsInboxView
          assignments={assignments}
          inventory={inventory}
          salesOrders={salesOrders}
          onStatusChange={handleUpdateInventoryStatus}
        />
      )}
        </main>
      </div>

      {showAssignmentForm && <AssignmentForm mode={assignmentMode} inventory={inventory.filter(r => r.activo && r.cajasInv > 0)} salesOrders={salesOrders} onCreate={handleCreateAssignment} onCancel={() => setShowAssignmentForm(false)} />}
      {showNewPOForm && <NewPOForm mode="create" onSubmit={handleCreateNewPO} onCancel={() => setShowNewPOForm(false)} />}
      {editingInventoryRow && <NewPOForm mode="edit" initialData={editingInventoryRow} onSubmit={handleUpdatePO} onCancel={() => setEditingInventoryRow(null)} />}
      {showNewSOForm && <NewSalesOrderForm mode="create" onCreate={handleCreateNewSalesOrder} onCancel={() => setShowNewSOForm(false)} />}
      {editingSalesOrder && <NewSalesOrderForm mode="edit" initialData={editingSalesOrder} onUpdate={handleUpdateSalesOrder} onCancel={() => setEditingSalesOrder(null)} />}
    </>
  );
}

function TrackingRouter({ token }: { token: string }) {
  const [state, setState] = useState<{ loading: boolean; snapshot?: TrackingSnapshot; notFound?: boolean }>({
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`${TRACKING_API_BASE}/get-tracking?token=${encodeURIComponent(token)}`);
        if (res.status === 404) {
          if (!cancelled) setState({ loading: false, notFound: true });
          return;
        }
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Fetch failed with ${res.status}: ${body}`);
        }
        const json = await res.json();
        if (cancelled) return;
        setState({
          loading: false,
          snapshot: {
            inventory: json.inventory || [],
            assignments: json.assignments || [],
            salesOrders: json.sales_orders || json.salesOrders || [],
          },
        });
      } catch (err) {
        console.error("[TrackingRouter] Fetch error for token", token, err);
        if (!cancelled) setState({ loading: false, notFound: true });
      }
    };
    fetchSnapshot();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F9F8F6]">
        <div className="p-8 bg-white shadow-sm rounded-none border-t-4 border-[#FE5000]">
          <h1 className="text-[#425563] text-xl font-bold font-['Quicksand']">Cargando tracking…</h1>
        </div>
      </div>
    );
  }

  if (state.notFound || !state.snapshot) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F9F8F6]">
        <div className="p-8 bg-white shadow-sm rounded-none border-t-4 border-[#FE5000]">
          <h1 className="text-[#425563] text-xl font-bold font-['Quicksand']">Link no válido</h1>
        </div>
      </div>
    );
  }

  const { inventory, assignments, salesOrders } = state.snapshot;
  const invRow = inventory.find(i => i.trackingToken === token);
  if (!invRow) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F9F8F6]">
        <div className="p-8 bg-white shadow-sm rounded-none border-t-4 border-[#FE5000]">
          <h1 className="text-[#425563] text-xl font-bold font-['Quicksand']">Link no válido</h1>
        </div>
      </div>
    );
  }

  const relatedAssignments = assignments.filter(a => getAssignmentItems(a).some(it => it.inventoryId === invRow.id));
  const linkedOrderId = relatedAssignments.find(a => a.salesOrderId)?.salesOrderId;
  if (linkedOrderId) {
    const order = salesOrders.find(so => so.id === linkedOrderId);
    if (order) {
      const rowsForOrder = inventory.filter(row =>
        assignments.some(asg => asg.salesOrderId === linkedOrderId && getAssignmentItems(asg).some(item => item.inventoryId === row.id))
      );
      const orderAssignments = assignments.filter(asg => asg.salesOrderId === linkedOrderId);
      return <OrderTrackingView order={order} rows={rowsForOrder} assignments={orderAssignments} />;
    }
  }
  const relatedSalesOrder = salesOrders.find(so => so.customerPO === invRow.customerPO);
  return <ClientTrackingView inventoryRow={invRow} assignments={relatedAssignments} salesOrder={relatedSalesOrder} salesOrders={salesOrders} />;
}

export { TrackingRouter };

// =====================================================================
// COMPONENTES AUXILIARES Y DE VISTAS
// =====================================================================

function Header() {
  return ( 
    <div className="w-full flex items-center gap-3 px-8 py-4 bg-white border-b border-[#D7D2CB]">
        {/* Usamos el texto del logo con la fuente Quicksand si no carga la imagen, o la imagen original */}
        <div className="flex items-center gap-2">
            <img src="/aquachile_logo.png" alt="AquaChile" className="h-10 object-contain" />
            {/* Fallback visual style mimicking logo text */}
            <div className="hidden flex-col">
                <span className="font-['Quicksand'] text-3xl text-[#425563] uppercase tracking-widest font-light">AquaChile</span>
            </div>
        </div>
    </div> 
  );
}

function Badge({ text }: { text: string }) {
  const key = text.toUpperCase();
  const colors: Record<string, string> = { 
    "EN_TRANSITO": "bg-[#FFEEE6] text-[#B93800] border-[#FE5000]",
    "CONFIRMADO": "bg-[#E4ECF2] text-[#1E3A53] border-[#425563]",
    "LISTO_ENTREGA": "bg-[#FFF3CC] text-[#9E7700] border-[#DAAA00]",
    "ENTREGADO": "bg-[#E3F2D9] text-[#4A5B00] border-[#76881D]",
    "RETRASO": "bg-[#FFE3E3] text-[#B42318] border-[#B42318]",
    "INCIDENCIA": "bg-[#FFE3E3] text-[#B42318] border-[#B42318]",
    "ANULADA": "bg-[#E7E2DD] text-[#4C4038] border-[#4C4038]",
    "APROBADA": "bg-[#E3F2D9] text-[#4A5B00] border-[#76881D]",
    "EN REVISIÓN": "bg-[#FFF3CC] text-[#9E7700] border-[#DAAA00]",
    "ORDEN": "bg-[#E4ECF2] text-[#1E3A53] border-[#425563]",
    "SPOT": "bg-[#D9F4EF] text-[#1E7A70] border-[#279989]",
    "ACTIVA": "bg-[#E3F2D9] text-[#4A5B00] border-[#76881D]"
  };
  
  const style = colors[key] || "bg-[#D7D2CB] text-[#6E6259] border-[#6E6259]";
  const label = STATUS_LABELS[key as TrackingStatus] ?? text.replace(/_/g, " ");
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-['Quicksand'] font-bold uppercase tracking-wider border ${style}`}>
        {label}
    </span>
  );
}

function NavButton({ active, onClick, icon: Icon, label,}: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 flex items-center gap-2 text-xs font-bold uppercase transition-all ${ active ? "bg-[#FE5000] text-white" : "text-[#D7D2CB] hover:text-white" }`}>
        <Icon className="h-4 w-4" />{label}
    </button>
  );
}

function DashboardView({ kpis, agg }: { kpis: { totalCajasInv: number; totalAssignments: number; pendingOrders: number; totalLbsAvailable: number; }; agg: DashboardAgg; }) {
  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[{ id: "stock", label: "Cajas en Inventario", icon: Package }, { id: "pendingOrders", label: "Órdenes Pendientes", icon: FileText }, { id: "assignments", label: "Asignaciones", icon: ClipboardList }, { id: "totalLbs", label: "Lbs Disponibles", icon: Layers }].map(({ id, label, icon: Icon }) => {
          const value = id === "stock" ? kpis.totalCajasInv : id === "pendingOrders" ? kpis.pendingOrders : id === "assignments" ? kpis.totalAssignments : kpis.totalLbsAvailable;
          return ( 
            <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 shadow-sm border-t-4 border-[#425563]">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-[#F9F8F6] rounded-full"><Icon className="h-6 w-6 text-[#FE5000]" /></div>
                </div>
                <div>
                    <div className="text-xs font-['Quicksand'] font-bold text-[#6E6259] uppercase tracking-wider mb-1">{label}</div>
                    <div className="text-3xl font-['Merriweather'] text-[#425563]">{id === 'totalLbs' ? value.toLocaleString() : value}</div>
                </div>
            </motion.div> 
          );
        })}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 shadow-sm border border-[#D7D2CB]">
            <h3 className="text-sm font-bold text-[#425563] mb-6 border-b border-[#FE5000] pb-2 inline-block">INVENTARIO POR BODEGA</h3>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={agg.byWarehouse}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" /><XAxis dataKey="bodega" tick={{fill: '#6E6259', fontSize: 10}} axisLine={false} /><YAxis tick={{fill: '#6E6259', fontSize: 10}} axisLine={false} /><Tooltip contentStyle={{backgroundColor: '#425563', color: '#fff', border: 'none'}} /><Bar dataKey="totalCajas" name="Cajas" fill="#425563" barSize={30} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white p-6 shadow-sm border border-[#D7D2CB]">
            <h3 className="text-sm font-bold text-[#425563] mb-6 border-b border-[#FE5000] pb-2 inline-block">ESTADO DE INVENTARIO</h3>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={agg.byStatus}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" /><XAxis dataKey="status" tick={{fill: '#6E6259', fontSize: 10}} axisLine={false} /><YAxis tick={{fill: '#6E6259', fontSize: 10}} axisLine={false} /><Tooltip contentStyle={{backgroundColor: '#425563', color: '#fff', border: 'none'}} /><Bar dataKey="cajas" name="Cajas" fill="#279989" barSize={30} /></BarChart></ResponsiveContainer></div>
        </div>
      </div>
    </div>
  );
}

function SalesView({ inventory, salesOrders }: { inventory: InventoryRow[]; salesOrders: SalesOrder[] }) {
  const available = useMemo(() => inventory.filter(row => row.activo && row.cajasInv > 0), [inventory]);
  const incoming = useMemo(
    () => inventory.filter(row => row.status === "EN_TRANSITO" || row.status === "LISTO_ENTREGA" || row.status === "CONFIRMADO"),
    [inventory]
  );
  const totalAvailable = available.reduce((sum, row) => sum + row.cajasInv, 0);
  const totalIncoming = incoming.reduce((sum, row) => sum + row.cajasInv, 0);

  const soonestByEta = [...incoming].sort((a, b) => a.eta.localeCompare(b.eta)).slice(0, 6);
  const topAvailable = [...available].sort((a, b) => b.cajasInv - a.cajasInv).slice(0, 8);

  const openRequests = salesOrders.flatMap(order =>
    (order.lines || []).map(line => ({
      orderId: order.id,
      demandId: order.demandId,
      customer: order.customerName || order.shipTo || "Cliente",
      material: line.material,
      description: line.description,
      cases: line.cases,
      eta: order.pickUpDate,
    }))
  );

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Available Now", value: totalAvailable.toLocaleString(), hint: "Cajas en bodega", icon: Package },
          { label: "Inbound", value: totalIncoming.toLocaleString(), hint: "Cajas en camino / confirmadas", icon: Ship },
          { label: "Lotes activos", value: available.length.toLocaleString(), hint: "Listos para vender", icon: Warehouse },
          { label: "Open Requests", value: openRequests.length.toLocaleString(), hint: "Líneas de venta abiertas", icon: ClipboardList },
        ].map(card => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="border border-[#D7D2CB] bg-white shadow-sm">
          <div className="p-4 border-b border-[#D7D2CB] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#425563] uppercase">Disponible ahora</h3>
              <p className="text-xs text-[#6E6259]">Lo que ventas puede comprometer al instante.</p>
            </div>
            <Badge text="CONFIRMADO" />
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs text-[#6E6259]">
              <thead>
                <tr className="table-header">
                  <th className="py-2 px-3 text-left">PO</th>
                  <th className="px-3 text-left">Material</th>
                  <th className="px-3 text-left">Warehouse</th>
                  <th className="px-3 text-left">ETA</th>
                  <th className="px-3 text-left">AWB</th>
                  <th className="px-3 text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {topAvailable.map(row => (
                  <tr key={row.id} className="border-b border-[#F0EFE9]">
                    <td className="px-3 py-2 font-bold text-[#425563]">{row.po}</td>
                    <td className="px-3">{row.material}</td>
                    <td className="px-3">{row.bodega}</td>
                    <td className="px-3">{row.eta}</td>
                    <td className="px-3">{row.awb || "Pending"}</td>
                    <td className="px-3 text-right font-bold">{row.cajasInv.toLocaleString()}</td>
                  </tr>
                ))}
                {topAvailable.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-[#B1ABA3] py-3 italic">No hay lotes listos para prometer.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-[#D7D2CB] bg-white shadow-sm">
          <div className="p-4 border-b border-[#D7D2CB] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#425563] uppercase">En camino / próximos</h3>
              <p className="text-xs text-[#6E6259]">Lo que llega pronto, con ETA y estado.</p>
            </div>
            <Badge text="EN_TRANSITO" />
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs text-[#6E6259]">
              <thead>
                <tr className="table-header">
                  <th className="py-2 px-3 text-left">PO</th>
                  <th className="px-3 text-left">Material</th>
                  <th className="px-3 text-left">ETA</th>
                  <th className="px-3 text-left">AWB</th>
                  <th className="px-3 text-left">Status</th>
                  <th className="px-3 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {soonestByEta.map(row => (
                  <tr key={row.id} className="border-b border-[#F0EFE9]">
                    <td className="px-3 py-2 font-bold text-[#425563]">{row.po}</td>
                    <td className="px-3">{row.material}</td>
                    <td className="px-3">{row.eta}</td>
                    <td className="px-3">{row.awb || "Pending"}</td>
                    <td className="px-3"><Badge text={row.status} /></td>
                    <td className="px-3 text-right font-bold">{row.cajasInv.toLocaleString()}</td>
                  </tr>
                ))}
                {soonestByEta.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-[#B1ABA3] py-3 italic">No hay llegadas registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="border border-[#D7D2CB] bg-white shadow-sm">
        <div className="p-4 border-b border-[#D7D2CB] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#425563] uppercase">Solicitudes abiertas</h3>
            <p className="text-xs text-[#6E6259]">Vista rápida para ventas sin pedir stock a inventario.</p>
          </div>
          <ClipboardList className="h-5 w-5 text-[#425563]" />
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-xs text-[#6E6259]">
            <thead>
              <tr className="table-header">
                <th className="py-2 px-3 text-left">Order</th>
                <th className="px-3 text-left">Customer</th>
                <th className="px-3 text-left">Material</th>
                <th className="px-3 text-left">ETA</th>
                <th className="px-3 text-right">Cases</th>
              </tr>
            </thead>
            <tbody>
              {openRequests.map(req => (
                <tr key={`${req.orderId}-${req.material}`} className="border-b border-[#F0EFE9]">
                  <td className="px-3 py-2 font-bold text-[#425563]">{req.demandId}</td>
                  <td className="px-3">{req.customer}</td>
                  <td className="px-3">
                    <div className="font-bold text-[#425563]">{req.material}</div>
                    <div>{req.description}</div>
                  </td>
                  <td className="px-3">{req.eta}</td>
                  <td className="px-3 text-right font-bold">{req.cases.toLocaleString()}</td>
                </tr>
              ))}
              {openRequests.length === 0 && (
                <tr><td colSpan={5} className="text-center text-[#B1ABA3] py-3 italic">No hay solicitudes abiertas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InventoryView({ rows, onNewPO, onEdit }: { rows: InventoryRow[]; onNewPO: () => void; onEdit: (row: InventoryRow) => void; }) {
  return (
    <div className="bg-white shadow-sm border border-[#D7D2CB]">
      <div className="p-6 border-b border-[#D7D2CB] flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-[#425563]">Inventario</h2><p className="text-xs text-[#6E6259] mt-1">Listado de lotes disponibles.</p></div>
        <button onClick={onNewPO} className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Plus className="h-4 w-4" /> Nuevo Lote</button>
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs text-[#6E6259] min-w-[1200px]">
          <thead>
            <tr className="table-header">
              <th className="py-3 px-4 text-left">ID</th>
              <th className="px-4 text-left">AquaChile Lot</th>
              <th className="px-4 text-left">Customer PO</th>
              <th className="px-4 text-left">Material</th>
              <th className="px-4 text-left">Description</th>
              <th className="px-4 text-left">Product</th>
              <th className="px-4 text-left">Trim</th>
              <th className="px-4 text-left">Size</th>
              <th className="px-4 text-left">Sector</th>
              <th className="px-4 text-left">Client</th>
              <th className="px-4 text-left">Warehouse</th>
              <th className="px-4 text-left">Location</th>
              <th className="px-4 text-left">Production Date</th>
              <th className="px-4 text-left">Request ETA</th>
              <th className="px-4 text-left">Time</th>
              <th className="px-4 text-left">AWB</th>
              <th className="px-4 text-left">Status</th>
              <th className="px-4 text-right">Cases Ordered</th>
              <th className="px-4 text-right">Cases Available</th>
              <th className="px-4 text-right">Format (lb)</th>
              <th className="px-4 text-right">Total Lbs</th>
              <th className="px-4 text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="font-['Merriweather']">
            {rows.map(r => {
              const displayId = r.customId || r.id;
              const availableLbs = r.cajasInv * r.formatoCaja;
              return (
                <tr key={r.id} className="border-b border-[#F0EFE9] hover:bg-[#F9F8F6]">
                  <td className="py-3 px-4 font-bold text-[#425563]">{displayId}</td>
                  <td className="px-4">{r.po}</td>
                  <td className="px-4">{r.customerPO}</td>
                  <td className="px-4">{r.material}</td>
                  <td className="px-4">{r.descripcion}</td>
                  <td className="px-4">{r.producto}</td>
                  <td className="px-4">{r.trim}</td>
                  <td className="px-4">{r.size}</td>
                  <td className="px-4">{r.sector}</td>
                  <td className="px-4">{r.clientePrincipal}</td>
                  <td className="px-4">{r.bodega}</td>
                  <td className="px-4">{r.ubicacion}</td>
                  <td className="px-4">{r.produccion}</td>
                  <td className="px-4">{r.eta}</td>
                  <td className="px-4">{r.time}</td>
                  <td className="px-4">{r.awb || "Pending"}</td>
                  <td className="px-4"><Badge text={r.status} /></td>
                  <td className="px-4 text-right font-bold">{r.cajasOrden.toLocaleString()}</td>
                  <td className="px-4 text-right font-bold text-[#425563]">{r.cajasInv.toLocaleString()}</td>
                  <td className="px-4 text-right">{r.formatoCaja.toLocaleString()}</td>
                  <td className="px-4 text-right font-bold text-[#425563]">{availableLbs.toLocaleString()}</td>
                  <td className="px-4 text-right">
                    <button onClick={() => onEdit(r)} className="text-[#FE5000] font-bold text-[10px] uppercase hover:underline">Edit</button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && ( <tr><td colSpan={21} className="text-center py-8 text-[#D7D2CB] italic">No hay datos disponibles.</td></tr> )}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden p-4 space-y-4 bg-[#F9F8F6] border-t border-[#D7D2CB]">
        {rows.map(r => {
          const availableLbs = r.cajasInv * r.formatoCaja;
          return (
            <div key={r.id} className="bg-white shadow-sm border border-[#E5DED5] p-4 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#6E6259] font-['Quicksand']">ID</div>
                  <div className="text-base font-bold text-[#425563]">{r.customId || r.id}</div>
                  <div className="text-xs text-[#6E6259]">{r.po}</div>
                </div>
                <Badge text={r.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] text-[#425563]">
                <div>
                  <div className="font-bold uppercase text-[#6E6259]">Customer</div>
                  <div>{r.clientePrincipal}</div>
                </div>
                <div>
                  <div className="font-bold uppercase text-[#6E6259]">ETA</div>
                  <div>{r.eta}</div>
                </div>
                <div>
                  <div className="font-bold uppercase text-[#6E6259]">Warehouse</div>
                  <div>{r.bodega}</div>
                </div>
                <div>
                  <div className="font-bold uppercase text-[#6E6259]">Available</div>
                  <div className="font-bold">{r.cajasInv.toLocaleString()} cs</div>
                  <div className="text-[10px] text-[#6E6259]">{availableLbs.toLocaleString()} lbs</div>
                </div>
              </div>
              <div className="text-[11px] text-[#6E6259]">
                <div className="font-bold uppercase">Material</div>
                <div>{r.material}</div>
                <div className="font-bold uppercase mt-2">Description</div>
                <div>{r.descripcion}</div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => onEdit(r)} className="text-[#FE5000] font-bold text-[11px] uppercase hover:underline">Edit</button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="text-center text-[#B4AAA1] italic text-sm">No hay datos disponibles.</div>}
      </div>
    </div>
  );
}

function WarehouseView({ inventory }: { inventory: InventoryRow[] }) {
  type WHRow = { bodega: string; ubicacion: string; totalCajas: number; totalLbs: number; productos: { key: string; producto: string; material: string; cajas: number; }[]; };
  const data: WHRow[] = useMemo(() => {
    const map = new Map<string, WHRow>();
    for (const r of inventory) {
      const key = r.bodega;
      const wh = map.get(key) ?? { bodega: r.bodega, ubicacion: r.ubicacion, totalCajas: 0, totalLbs: 0, productos: [], };
      wh.totalCajas += r.cajasInv;
      wh.totalLbs += r.cajasInv * r.formatoCaja;
      const prodKey = `${r.material}-${r.producto}`;
      const existingProd = wh.productos.find((p) => p.key === prodKey) ?? { key: prodKey, producto: r.producto, material: r.material, cajas: 0, };
      existingProd.cajas += r.cajasInv;
      if (!wh.productos.some((p) => p.key === prodKey)) wh.productos.push(existingProd);
      map.set(key, wh);
    }
    return Array.from(map.values());
  }, [inventory]);

  return (
    <div className="bg-white p-6 shadow-sm border border-[#D7D2CB]">
      <h2 className="text-lg font-bold text-[#425563] mb-6 border-b border-[#FE5000] pb-2 inline-block">BODEGAS</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data.map((wh) => (
          <div key={wh.bodega} className="border border-[#D7D2CB] p-0 bg-[#F9F8F6]">
            <div className="p-4 bg-[#425563] text-white">
                <div className="flex justify-between items-center">
                    <span className="font-['Quicksand'] font-bold text-lg">{wh.bodega}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-70">{wh.ubicacion}</span>
                </div>
            </div>
            <div className="p-4">
                <div className="flex justify-between text-xs text-[#6E6259] mb-4 border-b border-[#D7D2CB] pb-2">
                    <span>Total Cajas: <strong className="text-[#425563]">{wh.totalCajas.toLocaleString()}</strong></span>
                    <span>Lbs: <strong className="text-[#425563]">{wh.totalLbs.toLocaleString()}</strong></span>
                </div>
                <div className="space-y-2">
                    {wh.productos.map(p => (
                        <div key={p.key} className="flex justify-between text-[11px]">
                            <span className="text-[#6E6259]">{p.producto}</span>
                            <span className="font-bold text-[#425563]">{p.cajas.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesView({ summary }: { summary: { key: string; sector: string; trim: string; size: string; cajas: number; }[]; }) {
  return (
    <div className="bg-white p-6 shadow-sm border border-[#D7D2CB]">
      <h2 className="text-lg font-bold text-[#425563] mb-6 border-b border-[#FE5000] pb-2 inline-block">CATEGORÍAS</h2>
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-[#6E6259]">
            <thead><tr className="table-header"><th className="py-2 px-4 text-left">Sector</th><th className="px-4 text-left">Trim</th><th className="px-4 text-left">Size</th><th className="px-4 text-right">Stock (Cajas)</th></tr></thead>
            <tbody className="font-['Merriweather']">{summary.map((r) => (<tr key={r.key} className="border-b border-[#F0EFE9] hover:bg-[#F9F8F6]"><td className="py-2 px-4 font-bold">{r.sector}</td><td className="px-4">{r.trim}</td><td className="px-4">{r.size}</td><td className="px-4 text-right font-bold text-[#425563]">{r.cajas.toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
        <div className="bg-[#F9F8F6] border border-[#D7D2CB] p-6 flex items-center justify-center">
          <div className="w-full h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary} dataKey="cajas" nameKey="key" outerRadius={80} innerRadius={50} paddingAngle={2}>{summary.map((entry, index) => (<Cell key={entry.key} fill={BRAND_CHART_COLORS[index % BRAND_CHART_COLORS.length]} strokeWidth={0} />))}</Pie><Tooltip contentStyle={{backgroundColor: '#425563', color: '#fff', border: 'none'}} /></PieChart></ResponsiveContainer></div>
        </div>
      </div>
    </div>
  );
}

function AssignmentsView({ assignments, salesOrders, onToggleState, onNewAssignmentOrden, onNewAssignmentSpot, showArchived, onToggleArchived, }: { assignments: Assignment[]; salesOrders: SalesOrder[]; onToggleState: (id: string, to: AssignmentEstado) => void; onNewAssignmentOrden: () => void; onNewAssignmentSpot: () => void; showArchived: boolean; onToggleArchived: () => void; }) {
  const safeAssignments = assignments.filter((a): a is Assignment => Boolean(a && a.id));
  const filteredAssignments = safeAssignments.filter(a => showArchived ? a.estado === 'ANULADA' : a.estado === 'ACTIVA');
  return (
    <div className="bg-white shadow-sm border border-[#D7D2CB]">
      <div className="p-6 border-b border-[#D7D2CB] flex items-center justify-between flex-wrap gap-4">
        <div><h2 className="text-lg font-bold text-[#425563]">Asignaciones</h2><p className="text-xs text-[#6E6259] mt-1">{showArchived ? "Historial Anulado" : "Asignaciones Activas"}</p></div>
        <div className="flex gap-3">
          <button onClick={onToggleArchived} className="px-4 py-2 border border-[#6E6259] text-[#6E6259] text-xs font-bold uppercase hover:bg-[#6E6259] hover:text-white transition-colors"><Archive className="h-3 w-3 inline mr-1" />{showArchived ? "Ver Activas" : "Historial"}</button>
          <button onClick={onNewAssignmentSpot} className="btn-secondary px-4 py-2 text-xs font-bold uppercase flex items-center gap-2"><Plus className="h-3 w-3" /> Venta Spot</button>
          <button onClick={onNewAssignmentOrden} className="btn-primary px-4 py-2 text-xs font-bold uppercase flex items-center gap-2"><Plus className="h-3 w-3" /> Asignar</button>
        </div>
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs text-[#6E6259]">
          <thead><tr className="table-header"><th className="py-3 px-4 text-left">ID</th><th className="px-4 text-left">Fecha</th><th className="px-4 text-left">Tipo</th><th className="px-4 text-left">Cliente</th><th className="px-4 text-left">Ref</th><th className="px-4 text-right">Cajas</th><th className="px-4 text-right">Acción</th></tr></thead>
          <tbody className="font-['Merriweather']">
            {filteredAssignments.map(asg => {
              const assignmentItems = getAssignmentItems(asg);
              const cajas = assignmentItems.reduce((s, it) => s + it.cajas, 0);
              const ref = asg.tipo === 'ORDEN' ? (salesOrders.find(s => s.id === asg.salesOrderId)?.demandId ?? asg.salesOrderId) : asg.spotRef;
              return (
                <tr key={asg.id} className="border-b border-[#F0EFE9] hover:bg-[#F9F8F6]">
                  <td className="py-3 px-4 font-bold text-[#425563]">{asg.id}</td><td className="px-4">{asg.fecha}</td><td className="px-4"><Badge text={asg.tipo} /></td><td className="px-4">{asg.cliente}</td><td className="px-4">{ref}</td><td className="px-4 text-right font-bold">{cajas}</td>
                  <td className="px-4 text-right">
                    {showArchived ? (<button onClick={() => onToggleState(asg.id, 'ACTIVA')} className="text-[#279989] font-bold hover:underline text-[10px] uppercase"><Undo className="h-3 w-3 inline" /> Reactivar</button>) : (<button onClick={() => onToggleState(asg.id, 'ANULADA')} className="text-red-700 font-bold hover:underline text-[10px] uppercase"><X className="h-3 w-3 inline" /> Anular</button>)}
                  </td>
                </tr>
              );
            })}
            {filteredAssignments.length === 0 && ( <tr><td colSpan={7} className="text-center py-8 text-[#D7D2CB] italic">Sin asignaciones.</td></tr> )}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden p-4 space-y-4 bg-[#F9F8F6] border-t border-[#D7D2CB]">
        {filteredAssignments.map(asg => {
          const assignmentItems = getAssignmentItems(asg);
          const cajas = assignmentItems.reduce((s, it) => s + it.cajas, 0);
          const ref = asg.tipo === "ORDEN" ? (salesOrders.find(s => s.id === asg.salesOrderId)?.demandId ?? asg.salesOrderId) : asg.spotRef;
          return (
            <div key={asg.id} className="bg-white border border-[#E5DED5] shadow-sm p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] uppercase text-[#6E6259] font-bold">Allocation</div>
                  <div className="text-base font-bold text-[#425563]">{asg.id}</div>
                  <div className="text-xs text-[#6E6259]">{asg.fecha}</div>
                </div>
                <Badge text={asg.tipo} />
              </div>
              <div className="text-[11px] text-[#6E6259] space-y-1">
                <div><span className="font-bold uppercase">Client:</span> {asg.cliente}</div>
                <div><span className="font-bold uppercase">Reference:</span> {ref || "—"}</div>
                <div><span className="font-bold uppercase">Cases:</span> <strong className="text-[#425563]">{cajas.toLocaleString()}</strong></div>
              </div>
              <div className="flex items-center justify-between gap-3">
                {showArchived ? (
                  <button onClick={() => onToggleState(asg.id, "ACTIVA")} className="btn-secondary flex-1 text-[10px] font-bold uppercase py-2">
                    <Undo className="h-3 w-3 inline mr-1" /> Reactivar
                  </button>
                ) : (
                  <button onClick={() => onToggleState(asg.id, "ANULADA")} className="btn-primary flex-1 text-[10px] font-bold uppercase py-2 bg-red-600 hover:bg-red-700">
                    <X className="h-3 w-3 inline mr-1" /> Anular
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredAssignments.length === 0 && <div className="text-center text-[#B4AAA1] italic text-sm">Sin asignaciones.</div>}
      </div>
    </div>
  );
}

function ClientUpdateView({ inventory, onStatusChange, onSendEmail, onArchive }: { inventory: InventoryRow[]; onStatusChange: (rowId: string, newStatus: TrackingStatus) => void; onSendEmail: (rowId: string) => void; onArchive: (rowId: string) => void; }) {
  const statusOptions: TrackingStatus[] = [ "CONFIRMADO", "EN_TRANSITO", "LISTO_ENTREGA", "ENTREGADO", "RETRASO", "INCIDENCIA", ];
  return (
    <div className="bg-white shadow-sm border border-[#D7D2CB]">
      <div className="p-6 border-b border-[#D7D2CB]">
        <h2 className="text-lg font-bold text-[#425563]">Tracking Control</h2>
        <p className="text-xs text-[#6E6259] mt-1">Gestión de estado de envíos y notificación a clientes.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#6E6259]">
          <thead><tr className="table-header"><th className="py-3 px-4 text-left">ID</th><th className="px-4 text-left">PO</th><th className="px-4 text-left">Cliente</th><th className="px-4 text-left">Tracking Link</th><th className="px-4 text-left">Status Actual</th><th className="px-4 text-right">Acción Status</th><th className="px-4 text-center">Notificar</th><th className="px-4 text-center">Historial</th></tr></thead>
          <tbody className="font-['Merriweather']">
            {inventory.map(r => (
              <tr key={r.id} className="border-b border-[#F0EFE9] hover:bg-[#F9F8F6]">
                <td className="py-3 px-4 font-bold text-[#425563]">{r.customId || r.id}</td>
                <td className="px-4">{r.po}</td>
                <td className="px-4">{r.clientePrincipal}</td>
                <td className="px-4">
                  <a href={getTrackingLink(r)} target="_blank" rel="noreferrer" className="text-[#FE5000] font-bold hover:underline text-[10px] uppercase font-['Quicksand']">
                    View Link
                  </a>
                </td>
                <td className="px-4"><Badge text={r.status} /></td>
                <td className="px-4 text-right">
                  <select value={r.status} onChange={e => onStatusChange(r.id, e.target.value as TrackingStatus)} className="input-brand px-2 py-1 text-[10px] uppercase">
                    {statusOptions.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td className="px-4 text-center">
                  <button onClick={() => onSendEmail(r.id)} className="p-2 rounded-full hover:bg-[#F0EFE9] text-[#425563] transition-colors" title="Enviar Email">
                    <Mail className="h-4 w-4" />
                  </button>
                </td>
                <td className="px-4 text-center">
                  {r.status === "ENTREGADO" ? (
                    <button
                      onClick={() => onArchive(r.id)}
                      className="text-[10px] font-bold uppercase text-[#425563] border border-[#D7D2CB] px-3 py-1 hover:bg-[#F0EFE9]"
                    >
                      Enviar a historial
                    </button>
                  ) : (
                    <span className="text-[10px] uppercase text-[#B4AAA1]">Pendiente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesOrdersView({ orders, onNewOrder, onEditOrder }: { orders: SalesOrder[], onNewOrder: () => void; onEditOrder: (order: SalesOrder) => void; }) { 
  const summarizeLines = (order: SalesOrder) => order.lines?.map(line => `${line.material} · ${line.description} (${line.cases} cs)`);
  return (
    <div className="bg-white shadow-sm border border-[#D7D2CB]">
      <div className="p-6 border-b border-[#D7D2CB] flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#425563]">Órdenes de Venta</h2>
        <button onClick={onNewOrder} className="btn-primary px-4 py-2 text-xs font-bold uppercase flex items-center gap-2"><Plus className="h-3 w-3" /> Crear Orden</button>
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs text-[#6E6259] min-w-[1100px]">
          <thead>
            <tr className="table-header">
              <th className="py-3 px-4 text-left">Sales Rep</th>
              <th className="px-4 text-left">Demand ID</th>
              <th className="px-4 text-left">Cliente</th>
              <th className="px-4 text-left">Ship To</th>
              <th className="px-4 text-left">Requests</th>
              <th className="px-4 text-right">Total Cases</th>
              <th className="px-4 text-left">Pick Up</th>
              <th className="px-4 text-left">Incoterm</th>
              <th className="px-4 text-left">Week</th>
              <th className="px-4 text-left">Progress</th>
              <th className="px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="font-['Merriweather']">
            {orders.map(o => {
              const requestSummaries = summarizeLines(o);
              const totalCases = o.lines?.reduce((sum, line) => sum + line.cases, 0) ?? o.cases;
              return (
                <tr key={o.id} className="border-b border-[#F0EFE9] hover:bg-[#F9F8F6]">
                  <td className="py-3 px-4 font-bold text-[#425563]">{o.salesRep}</td>
                  <td className="px-4">{o.demandId}</td>
                  <td className="px-4">{o.customerName || o.shipTo}</td>
                  <td className="px-4">{o.shipTo}</td>
                  <td className="px-4">
                    <div className="space-y-1">
                      {requestSummaries?.map((summary, idx) => (
                        <div key={`${o.id}-line-${idx}`}>{summary}</div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 text-right font-bold">{totalCases.toLocaleString()}</td>
                  <td className="px-4">{o.pickUpDate}</td>
                  <td className="px-4">{o.incoterm}</td>
                  <td className="px-4">{o.week}</td>
                  <td className="px-4">{o.estadoProgreso}</td>
                  <td className="px-4 text-right">
                    <button onClick={() => onEditOrder(o)} className="text-[#FE5000] font-bold text-[10px] uppercase hover:underline">Edit</button>
                  </td>
                </tr>
              );
            })}
             {orders.length === 0 && ( <tr><td colSpan={11} className="text-center py-8 text-[#D7D2CB] italic">No hay órdenes de venta.</td></tr> )}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden p-4 space-y-4 bg-[#F9F8F6] border-t border-[#D7D2CB]">
        {orders.map(o => {
          const requestSummaries = summarizeLines(o);
          const totalCases = o.lines?.reduce((sum, line) => sum + line.cases, 0) ?? o.cases;
          return (
            <div key={o.id} className="bg-white border border-[#E5DED5] shadow-sm p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[11px] font-bold uppercase text-[#6E6259]">Demand ID</div>
                  <div className="text-base font-bold text-[#425563]">{o.demandId}</div>
                  <div className="text-xs text-[#6E6259]">{o.customerName || o.shipTo}</div>
                </div>
                <Badge text={o.estadoAprobacion} />
              </div>
              <div className="text-[11px] text-[#6E6259] space-y-1">
                <div><span className="font-bold uppercase">Ship To:</span> {o.shipTo}</div>
                <div><span className="font-bold uppercase">Week:</span> {o.week}</div>
                <div><span className="font-bold uppercase">Requests:</span>
                  <ul className="list-disc ml-4">
                    {requestSummaries?.map((summary, idx) => <li key={`${o.id}-mobile-${idx}`}>{summary}</li>)}
                  </ul>
                </div>
                <div><span className="font-bold uppercase">Total Cases:</span> {totalCases.toLocaleString()}</div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => onEditOrder(o)} className="text-[#FE5000] font-bold text-[11px] uppercase hover:underline">Edit</button>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && <div className="text-center text-[#B4AAA1] italic text-sm">No hay órdenes de venta.</div>}
      </div>
    </div>
  );
}

type InventoryFormState = {
  customId: string;
  po: string;
  customerPO: string;
  material: string;
  descripcion: string;
  producto: string;
  clientePrincipal: string;
  ubicacion: string;
  bodega: string;
  planta: string;
  produccion: string;
  eta: string;
  status: TrackingStatus;
  cajasOrden: string;
  formatoCaja: string;
  cajasDisponibles: string;
  sector: string;
  trim: string;
  size: string;
  escamas: string;
  awb: string;
  time: string;
  empacado: string;
};

function NewPOForm({ mode, initialData, onSubmit, onCancel }: { mode: "create" | "edit"; initialData?: InventoryRow; onSubmit: (data: InventoryFormPayload) => void; onCancel: () => void; }) {
  const warehouses = [ { name: "SUC", location: "Miami, FL" }, { name: "EVO LAX", location: "Los Angeles, CA" }, { name: "EVO DFW", location: "Dallas, TX" }, { name: "CARTYS", location: "New York, NY" }, { name: "CARTYS-RFD", location: "Rockford, IL" }, { name: "SFO-CENTRA FREIGHT", location: "San Francisco, CA" }, { name: "ARAHO", location: "Boston, MA" }, { name: "PRIME", location: "Los Angeles, CA" }, { name: "RFD-Direct", location: "Rockford, IL" }, ];
  const productTypes = ["Filetes", "Hon"];
  const productDescriptions = [ "HON 14-16 55", "R TD 2-3 10", "R TD 2-3 35", "R TD 3-4 10", "R TD 2-4 35", "R TD 3-4 SE 35", "R TD 4-5 35", "R TE 2-3 35", "R TE 3-4 35", "R TF 2-5 35", "SG TD 3-4 35", "SG TD Pr 3-4 35", "SG TD Pr 4-5 35", "TD 2-3 10", "TD 2-3 35", "TD 2-3 SE 10", "TD 2-3 SE 35", "TD 3-4 10", "TD 3-4 35", "TD 3-4 SE 10", "TD 3-4 SE 35", "TE 2-3 35", "TE 3-4 35", "TF 2-5 35" ];
  const isEditing = mode === "edit";

  const buildInitialState = (row?: InventoryRow): InventoryFormState => {
    if (!row) {
      return {
        customId: "",
        po: "",
        customerPO: "",
        material: "",
        descripcion: productDescriptions[0],
        producto: "",
        clientePrincipal: "",
        ubicacion: warehouses[0].location,
        bodega: warehouses[0].name,
        planta: "Magallanes",
        produccion: new Date().toISOString().slice(0, 10),
        eta: new Date().toISOString().slice(0, 10),
        status: "CONFIRMADO",
        cajasOrden: "100",
        formatoCaja: "35",
        cajasDisponibles: "",
        sector: "SA",
        trim: "TD",
        size: "4-5",
        escamas: "",
        awb: "",
        time: "AM",
        empacado: productTypes[0],
      };
    }
    return {
      customId: row.customId || "",
      po: row.po,
      customerPO: row.customerPO,
      material: row.material,
      descripcion: row.descripcion,
      producto: row.producto,
      clientePrincipal: row.clientePrincipal,
      ubicacion: row.ubicacion,
      bodega: row.bodega,
      planta: row.planta,
      produccion: row.produccion,
      eta: row.eta,
      status: row.status,
      cajasOrden: String(row.cajasOrden),
      formatoCaja: String(row.formatoCaja),
      cajasDisponibles: String(row.cajasInv),
      sector: row.sector,
      trim: row.trim,
      size: row.size,
      escamas: row.escamas ?? "",
      awb: row.awb ?? "",
      time: row.time,
      empacado: row.empacado,
    };
  };

  const [formData, setFormData] = useState<InventoryFormState>(() => buildInitialState(initialData));

  useEffect(() => {
    setFormData(buildInitialState(initialData));
  }, [initialData, mode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = warehouses.find(w => w.name === e.target.value);
    if (selected) setFormData(prev => ({ ...prev, bodega: selected.name, ubicacion: selected.location }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customId || !formData.po || !formData.material) return;
    const cajasOrden = Number(formData.cajasOrden) || 0;
    const formatoCaja = Number(formData.formatoCaja) || 0;
    const cajasDisponiblesValue = formData.cajasDisponibles === "" ? cajasOrden : Number(formData.cajasDisponibles);
    const cajasDisponibles = Number.isFinite(cajasDisponiblesValue) ? cajasDisponiblesValue : cajasOrden;
    onSubmit({
      id: initialData?.id,
      customId: formData.customId,
      po: formData.po,
      customerPO: formData.customerPO,
      material: formData.material,
      descripcion: formData.descripcion,
      producto: formData.producto,
      clientePrincipal: formData.clientePrincipal,
      ubicacion: formData.ubicacion,
      bodega: formData.bodega,
      planta: formData.planta,
      produccion: formData.produccion,
      eta: formData.eta,
      status: formData.status,
      cajasOrden,
      formatoCaja,
      cajasDisponibles,
      sector: formData.sector,
      trim: formData.trim,
      size: formData.size,
      escamas: formData.escamas ? formData.escamas : null,
      awb: formData.awb ? formData.awb : null,
      time: formData.time,
      empacado: formData.empacado,
    });
  };

  return (
    <div className="fixed inset-0 bg-[#425563]/80 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white shadow-2xl max-w-3xl w-full p-8 max-h-[90vh] overflow-y-auto border-t-8 border-[#FE5000]">
        <div className="flex items-center justify-between pb-4 border-b border-[#D7D2CB] mb-6">
          <h2 className="text-xl font-bold text-[#425563] font-['Quicksand']">{isEditing ? "EDITAR LOTE DE INVENTARIO" : "NUEVO LOTE DE INVENTARIO"}</h2>
          <button type="button" onClick={onCancel} className="text-[#6E6259] hover:text-[#FE5000]"><X className="h-6 w-6" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-[#6E6259]">
          <div className="space-y-4">
            <div><label className="block font-bold mb-1">Inventory ID (*)</label><input name="customId" value={formData.customId} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            <div><label className="block font-bold mb-1">PO (*)</label><input name="po" value={formData.po} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            <div><label className="block font-bold mb-1">Customer PO</label><input name="customerPO" value={formData.customerPO} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            <div><label className="block font-bold mb-1">Material</label><input name="material" value={formData.material} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            <div><label className="block font-bold mb-1">Descripción</label><select name="descripcion" value={formData.descripcion} onChange={handleChange} className="input-brand w-full px-3 py-2">{productDescriptions.map(desc => (<option key={desc} value={desc}>{desc}</option>))}</select></div>
            <div><label className="block font-bold mb-1">Producto / SKU</label><input name="producto" value={formData.producto} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            <div><label className="block font-bold mb-1">Cliente Principal</label><input name="clientePrincipal" value={formData.clientePrincipal} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            <div><label className="block font-bold mb-1">AWB</label><input name="awb" value={formData.awb} onChange={handleChange} className="input-brand w-full px-3 py-2" placeholder="123-45678901" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block font-bold mb-1">Cajas</label><input type="number" name="cajasOrden" value={formData.cajasOrden} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
              <div><label className="block font-bold mb-1">Formato (Lb)</label><input type="number" name="formatoCaja" value={formData.formatoCaja} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            </div>
            <div><label className="block font-bold mb-1">Cajas Disponibles</label><input type="number" name="cajasDisponibles" value={formData.cajasDisponibles} onChange={handleChange} className="input-brand w-full px-3 py-2" placeholder="Igual a Cajas si se deja vacío" /></div>
          </div>
          <div className="space-y-4">
            <div><label className="block font-bold mb-1">Bodega</label><select onChange={handleWarehouseChange} value={formData.bodega} className="input-brand w-full px-3 py-2">{warehouses.map(wh => (<option key={wh.name} value={wh.name}>{wh.name} / {wh.location}</option>))}</select></div>
            <div><label className="block font-bold mb-1">Ubicación</label><input name="ubicacion" value={formData.ubicacion} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            <div><label className="block font-bold mb-1">Planta</label><input name="planta" value={formData.planta} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block font-bold mb-1">Prod. Date</label><input type="date" name="produccion" value={formData.produccion} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
              <div><label className="block font-bold mb-1">ETA</label><input type="date" name="eta" value={formData.eta} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block font-bold mb-1">Horario</label><select name="time" value={formData.time} onChange={handleChange} className="input-brand w-full px-3 py-2"><option value="AM">AM</option><option value="PM">PM</option></select></div>
              <div><label className="block font-bold mb-1">Empacado</label><select name="empacado" value={formData.empacado} onChange={handleChange} className="input-brand w-full px-3 py-2">{productTypes.map(type => (<option key={type} value={type}>{type}</option>))}</select></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div><label className="block font-bold mb-1">Sector</label><input name="sector" value={formData.sector} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
                <div><label className="block font-bold mb-1">Trim</label><input name="trim" value={formData.trim} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
                <div><label className="block font-bold mb-1">Size</label><input name="size" value={formData.size} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            </div>
            <div><label className="block font-bold mb-1">Escamas</label><input name="escamas" value={formData.escamas} onChange={handleChange} className="input-brand w-full px-3 py-2" placeholder="Opcional" /></div>
            <div><label className="block font-bold mb-1">Status</label><select name="status" value={formData.status} onChange={handleChange} className="input-brand w-full px-3 py-2"><option value="CONFIRMADO">Confirmado</option><option value="EN_TRANSITO">En Tránsito</option></select></div>
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-6 border-t border-[#D7D2CB] mt-6">
          <button type="button" onClick={onCancel} className="text-[#6E6259] font-bold uppercase text-xs hover:text-[#425563]">Cancelar</button>
          <button type="submit" className="btn-primary px-6 py-2 text-xs font-bold uppercase rounded-none">{isEditing ? "Actualizar Lote" : "Guardar Lote"}</button>
        </div>
      </form>
    </div>
  );
}

type SalesOrderFormState = {
  salesRep: string;
  demandId: string;
  tos: string;
  shipTo: string;
  customerName: string;
  pickUpDate: string;
  brand1: string;
  material: string;
  description: string;
  cases: string;
  price: string;
  flex: string;
  incoterm: string;
  truck: string;
  customerPO: string;
  portEntry: string;
  week: string;
  estadoAprobacion: string;
  estadoProgreso: string;
  unidadPrecio: string;
  orden: string;
  estadoPlanificacion: string;
  especie: string;
  especieDescripcion: string;
  estadoDetPrecio: string;
  incoterms2: string;
  brand: string;
};

function NewSalesOrderForm({ mode, initialData, onCreate, onUpdate, onCancel }: { mode: 'create' | 'edit'; initialData?: SalesOrder; onCreate?: (data: Omit<SalesOrder, 'id'>) => void; onUpdate?: (data: SalesOrder) => void; onCancel: () => void; }) {
  const isEditing = mode === 'edit';
  const baseState: SalesOrderFormState = {
    salesRep: 'Juan Pérez',
    demandId: `DEM-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`,
    tos: 'FOB',
    shipTo: '',
    customerName: '',
    pickUpDate: new Date().toISOString().slice(0, 10),
    brand1: 'AquaChile',
    material: '',
    description: '',
    cases: '0',
    price: '0',
    flex: 'No',
    incoterm: 'FOB MIA',
    truck: '',
    customerPO: '',
    portEntry: 'Miami',
    week: `W${Math.ceil((new Date().getDate() + new Date().getDay() + 1) / 7)}`,
    estadoAprobacion: 'EN REVISIÓN',
    estadoProgreso: 'PENDIENTE APROBACIÓN',
    unidadPrecio: 'USD / lb',
    orden: '',
    estadoPlanificacion: 'PENDIENTE',
    especie: 'SA',
    especieDescripcion: 'Salmón Atlántico',
    estadoDetPrecio: 'PENDIENTE',
    incoterms2: 'FOB',
    brand: 'AquaChile',
  };

  const mapFromRow = (row: SalesOrder): SalesOrderFormState => ({
    salesRep: row.salesRep,
    demandId: row.demandId,
    tos: row.tos,
    shipTo: row.shipTo,
    customerName: row.customerName,
    pickUpDate: row.pickUpDate,
    brand1: row.brand1,
    material: row.material,
    description: row.description,
    cases: String(row.cases),
    price: String(row.price),
    flex: row.flex,
    incoterm: row.incoterm,
    truck: row.truck,
    customerPO: row.customerPO,
    portEntry: row.portEntry,
    week: row.week,
    estadoAprobacion: row.estadoAprobacion,
    estadoProgreso: row.estadoProgreso,
    unidadPrecio: row.unidadPrecio,
    orden: row.orden,
    estadoPlanificacion: row.estadoPlanificacion,
    especie: row.especie,
    especieDescripcion: row.especieDescripcion,
    estadoDetPrecio: row.estadoDetPrecio,
    incoterms2: row.incoterms2,
    brand: row.brand,
  });

  const [formData, setFormData] = useState<SalesOrderFormState>(initialData ? mapFromRow(initialData) : baseState);
  type LineFormState = { id: string; description: string; material: string; cases: string; format: string };
  const mapLine = (line: SalesOrderLine): LineFormState => ({ id: line.id, description: line.description, material: line.material, cases: String(line.cases), format: String(line.formatLb) });
  const [lineForms, setLineForms] = useState<LineFormState[]>(initialData?.lines?.map(mapLine) ?? [{ id: `line-${uid()}`, description: '', material: '', cases: '0', format: '35' }]);

  useEffect(() => {
    setFormData(initialData ? mapFromRow(initialData) : baseState);
    setLineForms(initialData?.lines?.map(mapLine) ?? [{ id: `line-${uid()}`, description: '', material: '', cases: '0', format: '35' }]);
  }, [initialData, mode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const updateLine = (id: string, field: keyof LineFormState, value: string) => {
    setLineForms(prev => prev.map(line => line.id === id ? { ...line, [field]: value } : line));
  };

  const addLine = () => {
    setLineForms(prev => [...prev, { id: `line-${uid()}`, description: '', material: '', cases: '0', format: '35' }]);
  };

  const removeLine = (id: string) => {
    setLineForms(prev => prev.length > 1 ? prev.filter(line => line.id !== id) : prev);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shipTo) return;
    const normalizedLines = lineForms
      .map(line => ({
        id: line.id || `line-${uid()}`,
        description: line.description,
        material: line.material,
        cases: Number(line.cases) || 0,
        formatLb: Number(line.format) || getFormatFromDescription(line.description, 35),
      }))
      .filter(line => line.description || line.material);
    if (!normalizedLines.length) {
      alert("Agrega al menos una solicitud.");
      return;
    }
    const demandId = formData.demandId.trim() || `DEM-${uid()}`;
    const totalCases = normalizedLines.reduce((sum, line) => sum + line.cases, 0);
    const primaryLine = normalizedLines[0];
    const payload: Omit<SalesOrder, 'id'> = {
      salesRep: formData.salesRep,
      demandId,
      tos: formData.tos,
      shipTo: formData.shipTo,
      customerName: formData.customerName || formData.shipTo,
      pickUpDate: formData.pickUpDate,
      brand1: formData.brand1,
      material: primaryLine.material,
      description: primaryLine.description,
      cases: totalCases,
      price: Number(formData.price) || 0,
      flex: formData.flex,
      incoterm: formData.incoterm,
      truck: formData.truck,
      customerPO: formData.customerPO,
      portEntry: formData.portEntry,
      week: formData.week,
      estadoAprobacion: formData.estadoAprobacion,
      estadoProgreso: formData.estadoProgreso,
      unidadPrecio: formData.unidadPrecio,
      orden: formData.orden,
      estadoPlanificacion: formData.estadoPlanificacion,
      especie: formData.especie,
      especieDescripcion: formData.especieDescripcion,
      estadoDetPrecio: formData.estadoDetPrecio,
      incoterms2: formData.incoterms2,
      brand: formData.brand,
      lines: normalizedLines,
      trackingToken: initialData?.trackingToken || `order-${uid()}`,
    };
    if (isEditing && initialData && onUpdate) {
      onUpdate({ ...payload, id: initialData.id });
    } else if (!isEditing && onCreate) {
      onCreate(payload);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#425563]/80 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white shadow-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto border-t-8 border-[#FE5000]">
        <div className="flex items-center justify-between pb-4 border-b border-[#D7D2CB] mb-6">
          <h2 className="text-xl font-bold text-[#425563] font-['Quicksand']">{isEditing ? 'EDITAR ORDEN DE VENTA' : 'NUEVA ORDEN DE VENTA'}</h2>
          <button type="button" onClick={onCancel} className="text-[#6E6259] hover:text-[#FE5000]"><X className="h-6 w-6" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-[#6E6259]">
            <div className="space-y-4">
              <div><label className="block font-bold mb-1">Demand ID</label><input name="demandId" value={formData.demandId} onChange={handleChange} className="input-brand w-full px-3 py-2" placeholder="Opcional" /></div>
              <div><label className="block font-bold mb-1">Cliente</label><input name="customerName" value={formData.customerName} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
              <div><label className="block font-bold mb-1">Ship To</label><input name="shipTo" value={formData.shipTo} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
              <div><label className="block font-bold mb-1">Customer PO</label><input name="customerPO" value={formData.customerPO} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            </div>
            <div className="space-y-4">
              <div><label className="block font-bold mb-1">Pick up Date</label><input type="date" name="pickUpDate" value={formData.pickUpDate} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
              <div><label className="block font-bold mb-1">Approval</label><select name="estadoAprobacion" value={formData.estadoAprobacion} onChange={handleChange} className="input-brand w-full px-3 py-2"><option>EN REVISIÓN</option><option>APROBADA</option></select></div>
              <div><label className="block font-bold mb-1">Incoterm</label><input name="incoterm" value={formData.incoterm} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            </div>
            <div className="space-y-4">
              <div><label className="block font-bold mb-1">Port</label><input name="portEntry" value={formData.portEntry} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
              <div><label className="block font-bold mb-1">Sales Order #</label><input name="orden" value={formData.orden} onChange={handleChange} className="input-brand w-full px-3 py-2" placeholder="Opcional" /></div>
              <div><label className="block font-bold mb-1">Precio (USD/Lb)</label><input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} className="input-brand w-full px-3 py-2" /></div>
            </div>
        </div>
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#425563] uppercase">Solicitudes</h3>
            <button type="button" onClick={addLine} className="btn-secondary px-3 py-2 text-[11px] uppercase">Agregar Producto</button>
          </div>
          <div className="space-y-3">
            {lineForms.map((line) => (
              <div key={line.id} className="grid md:grid-cols-5 gap-3 items-end border border-[#E5DED5] p-3">
                <div>
                  <label className="block font-bold text-[11px] uppercase mb-1">Descripción</label>
                  <input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)} className="input-brand w-full px-3 py-2" />
                </div>
                <div>
                  <label className="block font-bold text-[11px] uppercase mb-1">Material</label>
                  <input value={line.material} onChange={e => updateLine(line.id, "material", e.target.value)} className="input-brand w-full px-3 py-2" />
                </div>
                <div>
                  <label className="block font-bold text-[11px] uppercase mb-1">Cajas</label>
                  <input type="number" value={line.cases} onChange={e => updateLine(line.id, "cases", e.target.value)} className="input-brand w-full px-3 py-2" />
                </div>
                <div>
                  <label className="block font-bold text-[11px] uppercase mb-1">Formato</label>
                  <select value={line.format} onChange={e => updateLine(line.id, "format", e.target.value)} className="input-brand w-full px-3 py-2">
                    <option value="35">35 lb</option>
                    <option value="10">10 lb</option>
                  </select>
                </div>
                <div className="text-right">
                  <button type="button" onClick={() => removeLine(line.id)} className="text-red-600 text-[11px] font-bold uppercase underline disabled:text-gray-300" disabled={lineForms.length === 1}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-6 border-t border-[#D7D2CB] mt-6">
          <button type="button" onClick={onCancel} className="text-[#6E6259] font-bold uppercase text-xs hover:text-[#425563]">Cancelar</button>
          <button type="submit" className="btn-primary px-6 py-2 text-xs font-bold uppercase rounded-none">{isEditing ? 'Actualizar Orden' : 'Guardar Orden'}</button>
        </div>
      </form>
    </div>
  );
}

function AssignmentForm({ mode, inventory, salesOrders, onCreate, onCancel }: { mode: AssignmentTipo; inventory: InventoryRow[]; salesOrders: SalesOrder[]; onCreate: (data: { tipo: AssignmentTipo; salesOrderId?: string; spotCliente?: string; spotRef?: string; items: OrderItem[] }) => void; onCancel: () => void; }) {
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<string>(salesOrders[0]?.id ?? "");
  const [spotCliente, setSpotCliente] = useState(inventory[0]?.clientePrincipal ?? "");
  const [spotRef, setSpotRef] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(inventory.map(row => [row.id, 0])));
  const [error, setError] = useState("");

  useEffect(() => {
    setQuantities(Object.fromEntries(inventory.map(row => [row.id, 0])));
    if (mode === "ORDEN" && salesOrders.length > 0) {
      setSelectedSalesOrder(salesOrders[0].id);
    }
    if (mode === "SPOT") {
      setSpotCliente(inventory[0]?.clientePrincipal ?? "");
    }
    setSpotRef("");
    setError("");
  }, [inventory, mode, salesOrders]);

  const handleQtyChange = (inventoryId: string, value: number) => {
    const invRow = inventory.find(r => r.id === inventoryId);
    const maxValue = invRow ? invRow.cajasInv : 0;
    const safeValue = clamp(Number.isNaN(value) ? 0 : value, 0, maxValue);
    setQuantities(prev => ({ ...prev, [inventoryId]: safeValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payloadItems = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([inventoryId, qty]) => {
        const invRow = inventory.find(r => r.id === inventoryId);
        if (!invRow) return null;
        return {
          inventoryId,
          po: invRow.po,
          material: invRow.material,
          producto: invRow.producto,
          cajas: qty,
        };
      })
      .filter((item): item is OrderItem => Boolean(item));

    if (!payloadItems.length) {
      setError("Selecciona al menos un lote con cajas asignadas.");
      return;
    }

    if (mode === "ORDEN" && !selectedSalesOrder) {
      setError("Selecciona la orden de venta que deseas asignar.");
      return;
    }

    if (mode === "SPOT" && (!spotCliente || !spotRef)) {
      setError("Completa los datos de la venta spot.");
      return;
    }

    onCreate({
      tipo: mode,
      salesOrderId: mode === "ORDEN" ? selectedSalesOrder : undefined,
      spotCliente: mode === "SPOT" ? spotCliente : undefined,
      spotRef: mode === "SPOT" ? spotRef : undefined,
      items: payloadItems,
    });
  };

  return (
    <div className="fixed inset-0 bg-[#425563]/80 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white shadow-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto border-t-8 border-[#FE5000]">
        <div className="flex items-center justify-between pb-4 border-b border-[#D7D2CB] mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#425563] font-['Quicksand']">{mode === "ORDEN" ? "Asignar Orden de Venta" : "Crear Venta Spot"}</h2>
            <p className="text-xs text-[#6E6259] uppercase tracking-wider">{mode === "ORDEN" ? "Selecciona la orden y define los lotes" : "Define cliente, referencia y asigna lotes"}</p>
          </div>
          <button type="button" onClick={onCancel} className="text-[#6E6259] hover:text-[#FE5000]"><X className="h-6 w-6" /></button>
        </div>

        {error && <div className="mb-4 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

        {mode === "ORDEN" ? (
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase text-[#6E6259] mb-2">Orden de Venta</label>
            <select value={selectedSalesOrder} onChange={(e) => setSelectedSalesOrder(e.target.value)} className="input-brand w-full px-3 py-2">
              <option value="">Selecciona una orden</option>
              {salesOrders.map(order => (
                <option key={order.id} value={order.id}>
                  {order.demandId} · {order.customerName || order.shipTo} · {order.customerPO}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold uppercase text-[#6E6259] mb-2">Cliente</label>
              <input value={spotCliente} onChange={(e) => setSpotCliente(e.target.value)} className="input-brand w-full px-3 py-2" placeholder="Nombre del cliente" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-[#6E6259] mb-2">Referencia</label>
              <input value={spotRef} onChange={(e) => setSpotRef(e.target.value)} className="input-brand w-full px-3 py-2" placeholder="Referencia interna" />
            </div>
          </div>
        )}

        <div className="border border-[#D7D2CB]">
          <div className="table-header px-4 py-3 text-left">Selecciona los lotes del inventario</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-[#6E6259]">
              <thead>
                <tr className="table-header">
                  <th className="py-3 px-4 text-left">ID</th>
                  <th className="px-4 text-left">PO</th>
                  <th className="px-4 text-left">Cliente</th>
                  <th className="px-4 text-left">Material</th>
                  <th className="px-4 text-left">Bodega</th>
                  <th className="px-4 text-right">Stock</th>
                  <th className="px-4 text-right">Asignar</th>
                </tr>
              </thead>
              <tbody className="font-['Merriweather']">
                {inventory.map(row => (
                  <tr key={row.id} className="border-b border-[#F0EFE9]">
                    <td className="py-3 px-4 font-bold text-[#425563]">{row.customId || row.id}</td>
                    <td className="px-4">{row.po}</td>
                    <td className="px-4">{row.clientePrincipal}</td>
                    <td className="px-4">{row.material}</td>
                    <td className="px-4">{row.bodega}</td>
                    <td className="px-4 text-right font-bold">{row.cajasInv.toLocaleString()}</td>
                    <td className="px-4 text-right">
                      <input
                        type="number"
                        min={0}
                        max={row.cajasInv}
                        value={quantities[row.id] ?? 0}
                        onChange={(e) => handleQtyChange(row.id, Number(e.target.value))}
                        className="input-brand w-24 px-2 py-1 text-right"
                      />
                    </td>
                  </tr>
                ))}
                {inventory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-[#D7D2CB] py-6 italic">No hay inventario disponible.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-6 border-t border-[#D7D2CB] mt-6">
          <button type="button" onClick={onCancel} className="text-[#6E6259] font-bold uppercase text-xs hover:text-[#425563]">Cancelar</button>
          <button type="submit" className="btn-primary px-6 py-2 text-xs font-bold uppercase rounded-none flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}

function ClientTrackingView({ inventoryRow, assignments, salesOrder, salesOrders = [] }: { inventoryRow: InventoryRow, assignments: Assignment[], salesOrder?: SalesOrder, salesOrders?: SalesOrder[] }) {
  const currentStatusIdx = getPipelineStatusIndex(inventoryRow.status, inventoryRow.statusHistory);
  const formatDateTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  const orderMap = useMemo(() => new Map(salesOrders.map(order => [order.id, order])), [salesOrders]);

  const assignedItemDetails = assignments.flatMap(asg =>
    getAssignmentItems(asg)
      .filter(item => item.inventoryId === inventoryRow.id)
      .map(item => {
        const linkedOrder = asg.salesOrderId ? orderMap.get(asg.salesOrderId) : undefined;
        return {
          allocationId: asg.id,
          productionDate: inventoryRow.produccion,
          specification: inventoryRow.descripcion,
          cases: item.cajas,
          lbs: item.cajas * inventoryRow.formatoCaja,
          po: inventoryRow.po,
          id: inventoryRow.customId || inventoryRow.id,
          requestEta: linkedOrder?.pickUpDate || inventoryRow.eta,
          awb: inventoryRow.awb || "Pending",
          location: inventoryRow.ubicacion,
          salesOrder: linkedOrder?.demandId || linkedOrder?.orden || asg.spotRef || "Spot Sale",
        };
      })
  );

  const totalCasesAssigned = assignedItemDetails.reduce((sum, item) => sum + item.cases, 0);
  const totalLbsAssigned = assignedItemDetails.reduce((sum, item) => sum + item.lbs, 0);

  const orderSummary = [
    { label: "Customer PO", value: inventoryRow.customerPO },
    { label: "Sales Order", value: salesOrder?.demandId ?? "Pending" },
    { label: "Incoterm", value: salesOrder?.incoterm ?? "—" },
    { label: "ETA", value: inventoryRow.eta },
  ];

  const allocationSummary = [
    { label: "Warehouse", value: inventoryRow.bodega },
    { label: "Location", value: inventoryRow.ubicacion },
    { label: "Production", value: inventoryRow.produccion },
    { label: "Request ETA", value: salesOrder?.pickUpDate ?? "—" },
    { label: "AWB", value: inventoryRow.awb ?? "Pending" },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-8 flex items-center justify-center font-['Merriweather']" style={TRACKING_BACKGROUND_STYLE}>
      <div className="w-full max-w-5xl bg-white shadow-2xl overflow-hidden border border-[#E1DAD2]">
        <div className="border-t-4 border-[#FE5000] bg-[#3B4A58] text-white px-6 sm:px-10 py-6 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src="/aquachile_logo.png" alt="AquaChile Logo" className="h-8 object-contain" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#C6D2DD] font-['Quicksand']">Customer Name</div>
              <h1 className="text-2xl font-semibold font-['Quicksand']">{(inventoryRow.clientePrincipal || "").toUpperCase()}</h1>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.35em] text-[#C6D2DD] font-['Quicksand']">Current Status</div>
            <div className="mt-2 inline-flex px-4 py-1 border border-white/40 text-xs uppercase tracking-[0.25em] font-bold">
              {STATUS_LABELS[inventoryRow.status]}
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-10 py-10 space-y-10 bg-white">
          <div className="space-y-4">
            <div className="relative pt-6">
              <div className="absolute top-3 left-0 w-full h-px bg-[#E0DAD2]" />
              <div
                className="absolute top-3 left-0 h-px bg-[#FE5000]"
                style={{ width: `${(currentStatusIdx / (TRACK_STEPS.length - 1)) * 100}%` }}
              />
              <div className="flex justify-between items-start relative">
                {TRACK_STEPS.map((step, idx) => (
                  <div key={step.id} className="flex flex-col items-center text-center w-full">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        idx <= currentStatusIdx ? "bg-[#FE5000] text-white" : "bg-white border border-[#C8C1B9] text-[#C8C1B9]"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`mt-3 text-[11px] uppercase tracking-[0.3em] font-['Quicksand'] ${
                        idx <= currentStatusIdx ? "text-[#2D3B46]" : "text-[#C4BCB3]"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-[#E7E1D8] p-6">
              <h3 className="text-xs sm:text-sm font-bold uppercase font-['Quicksand'] text-[#2D3B46] tracking-[0.3em] mb-3 border-b-2 border-[#FE5000] inline-block pb-1">
                Order Overview
              </h3>
              <dl className="space-y-2 text-sm text-[#1E2A33]">
                {orderSummary.map(item => (
                  <div key={item.label} className="flex justify-between border-b border-[#EFECE7] pb-2 last:border-b-0 last:pb-0">
                    <dt className="uppercase tracking-[0.3em] text-[10px] text-[#6A727B] font-['Quicksand']">{item.label}</dt>
                    <dd className="font-semibold">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="border border-[#E7E1D8] p-6">
              <h3 className="text-xs sm:text-sm font-bold uppercase font-['Quicksand'] text-[#2D3B46] tracking-[0.3em] mb-3 border-b-2 border-[#FE5000] inline-block pb-1">
                Allocation Overview
              </h3>
              <dl className="space-y-2 text-sm text-[#1E2A33]">
                {allocationSummary.map(item => (
                  <div key={item.label} className="flex justify-between border-b border-[#EFECE7] pb-2 last:border-b-0 last:pb-0">
                    <dt className="uppercase tracking-[0.3em] text-[10px] text-[#6A727B] font-['Quicksand']">{item.label}</dt>
                    <dd className="font-semibold">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#2D3B46] font-['Quicksand'] uppercase tracking-[0.35em] border-b-2 border-[#FE5000] inline-block pb-1">
              Allocated Cases Detail
            </h3>
            <div className="overflow-x-auto border border-[#E3DDD4]">
              <table className="w-full text-[12px] text-[#1F2533]">
                <thead>
                  <tr className="bg-[#F6F3EE] text-[#2D3B46] uppercase tracking-[0.35em] text-[10px] font-['Quicksand']">
                    <th className="py-3 px-4 text-left">PO</th>
                    <th className="px-4 text-left">Prod. Date</th>
                    <th className="px-4 text-left">Specification</th>
                    <th className="px-4 text-right">Cases</th>
                    <th className="px-4 text-right">Lb</th>
                    <th className="px-4 text-left">ID</th>
                    <th className="px-4 text-left">Request ETA</th>
                    <th className="px-4 text-left">AWB</th>
                    <th className="px-4 text-left">Location</th>
                    <th className="px-4 text-left">Sales Order</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedItemDetails.map((detail, idx) => (
                    <tr key={`${detail.allocationId}-${detail.po}-${detail.id}`} className={idx % 2 ? "bg-[#FCFAF6]" : "bg-white"}>
                      <td className="py-3 px-4 font-semibold">
                        <div>{inventoryRow.customerPO || "—"}</div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-[#394456] font-semibold mt-1">Lot {detail.po}</div>
                      </td>
                      <td className="px-4 text-[#0F172A] font-semibold">{detail.productionDate}</td>
                      <td className="px-4 text-[#0F172A] font-semibold" title={detail.specification}>
                        {detail.specification}
                      </td>
                      <td className="px-4 text-right font-bold text-[#0F172A]">{detail.cases.toLocaleString()}</td>
                      <td className="px-4 text-right font-bold text-[#0F172A]">{detail.lbs.toLocaleString()}</td>
                      <td className="px-4 text-[#0B1324] font-semibold">{detail.id}</td>
                      <td className="px-4 text-[#0B1324] font-semibold">{detail.requestEta}</td>
                      <td className="px-4 text-[#0B1324] font-semibold">{detail.awb}</td>
                      <td className="px-4 text-[#0B1324] font-semibold">{detail.location}</td>
                      <td className="px-4 text-[#0B1324] font-semibold">{detail.salesOrder}</td>
                    </tr>
                  ))}
                  {assignedItemDetails.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center text-[#B1ABA3] py-4 italic">
                        No cases allocated from this lot yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <table className="text-[12px] font-['Quicksand'] uppercase tracking-[0.35em] border border-[#E3DDD4]">
                <tbody>
                  <tr>
                    <td className="px-4 py-2 text-[#6D6B66] font-bold border-b border-[#E3DDD4]">Total Cases Allocated</td>
                    <td className="px-4 py-2 text-[#1F2533] font-extrabold border-b border-[#E3DDD4]">
                      {totalCasesAssigned.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-[#6D6B66] font-bold">Total Pounds Allocated</td>
                    <td className="px-4 py-2 text-[#1F2533] font-extrabold">{totalLbsAssigned.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#2D3B46] font-['Quicksand'] uppercase tracking-[0.35em] border-b-2 border-[#FE5000] inline-block pb-1">
            History
            </h3>
            <ul className="space-y-3 text-sm text-[#2D3B46]">
              {inventoryRow.statusHistory
                .slice()
                .reverse()
                .map((h, i) => (
                  <li key={i} className="px-4 py-3 bg-[#F6F3EE] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="font-semibold">{formatDateTime(h.at)}</span>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-[#3B4A58]">{STATUS_LABELS[h.status]}</span>
                  </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 border border-[#E7E1D8] bg-[#FDF9F5] p-5 text-sm text-[#2D3B46]">
          <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-[#6A727B] mb-2">Need help with this shipment?</h4>
          <p>
            If you notice any inconsistency, please contact your AquaChile sales agent directly so we can review the allocation
            details with you.
          </p>
        </div>
      </div>
    </div>
  </div>
  );
}

const PIPELINE_STAGE_ORDER: TrackingStatus[] = ["CONFIRMADO", "EN_TRANSITO", "LISTO_ENTREGA", "ENTREGADO"];

const OPS_STEPS = [
  { id: "bol", label: "Bill of Lading" },
  { id: "release", label: "Release Issued" },
  { id: "customs", label: "Customs Docs" },
  { id: "notify", label: "Customer Notified" },
];


function OperationsInboxView({
  assignments,
  inventory,
  salesOrders,
  onStatusChange,
}: {
  assignments: Assignment[];
  inventory: InventoryRow[];
  salesOrders: SalesOrder[];
  onStatusChange: (rowId: string, newStatus: TrackingStatus) => void;
}) {
  const [filter, setFilter] = useState<TrackingStatus | "ALL">("ALL");
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [opsChecklist, setOpsChecklist] = useState<Record<string, Record<string, boolean>>>(() => ({}));

  useEffect(() => {
    if (!activeAssignment) return;
    setOpsChecklist(prev => {
      if (prev[activeAssignment.id]) return prev;
      return { ...prev, [activeAssignment.id]: {} };
    });
  }, [activeAssignment]);

  const extendedAssignments = assignments.map(asg => {
    const relatedItems = getAssignmentItems(asg).map(item => ({
      ...item,
      inventoryRow: inventory.find(row => row.id === item.inventoryId),
    }));
    const salesOrderInfo = asg.salesOrderId
      ? salesOrders.find(order => order.id === asg.salesOrderId)
      : undefined;
    const earliestStage = relatedItems.reduce((min, item) => {
      const stage = item.inventoryRow
        ? getPipelineStatusIndex(item.inventoryRow.status, item.inventoryRow.statusHistory)
        : TRACK_STEP_INDEX["CONFIRMADO"];
      return Math.min(min, stage);
    }, TRACK_STEP_INDEX["ENTREGADO"]);
    const status = relatedItems.length > 0
      ? PIPELINE_STAGE_ORDER[earliestStage]
      : "CONFIRMADO";

    return { assignment: asg, relatedItems, salesOrderInfo, status, stageIndex: earliestStage };
  });

  const filteredAssignments = extendedAssignments.filter(entry => {
    if (filter === "ALL") return true;
    return entry.status === filter;
  });

  const handleStepToggle = (assignmentId: string, stepId: string) => {
    setOpsChecklist(prev => ({
      ...prev,
      [assignmentId]: { ...(prev[assignmentId] || {}), [stepId]: !prev[assignmentId]?.[stepId] },
    }));
  };

  const [sort, setSort] = useState<"eta" | "customer">("eta");
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    if (sort === "customer") {
      return a.assignment.cliente.localeCompare(b.assignment.cliente);
    }
    const etaA = a.relatedItems[0]?.inventoryRow?.eta ?? "";
    const etaB = b.relatedItems[0]?.inventoryRow?.eta ?? "";
    return etaA.localeCompare(etaB);
  });

  return (
    <div className="bg-white shadow-sm border border-[#D7D2CB]">
      <div className="p-6 border-b border-[#D7D2CB] flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#425563]">Operations Inbox</h2>
          <p className="text-xs text-[#6E6259] mt-1">
            Lotes listos para gestión operativa: documentos, liberaciones y seguimiento.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="text-[#6E6259] font-bold uppercase">Filter</label>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as TrackingStatus | "ALL")}
            className="input-brand px-3 py-1.5"
          >
            <option value="ALL">All statuses</option>
            {PIPELINE_STAGE_ORDER.map(stage => (
              <option value={stage} key={stage}>
                {STATUS_LABELS[stage]}
              </option>
            ))}
          </select>
          <label className="text-[#6E6259] font-bold uppercase">Sort</label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as "eta" | "customer")}
            className="input-brand px-3 py-1.5"
          >
            <option value="eta">ETA</option>
            <option value="customer">Customer</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-[#6E6259] min-w-[1100px]">
          <thead>
            <tr className="table-header">
              <th className="py-3 px-4 text-left">Assignment</th>
              <th className="px-4 text-left">Customer</th>
              <th className="px-4 text-left">Lot / PO</th>
              <th className="px-4 text-left">Warehouse</th>
              <th className="px-4 text-left">ETA</th>
              <th className="px-4 text-right">Cases</th>
              <th className="px-4 text-left">Status</th>
              <th className="px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="font-['Merriweather']">
            {sortedAssignments.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[#B4AAA1] italic">
                  No assignments found with this filter.
                </td>
              </tr>
            )}
            {sortedAssignments.map(entry => (
              <tr key={entry.assignment.id} className="border-b border-[#F0EFE9] hover:bg-[#F9F8F6]">
                <td className="py-3 px-4 font-bold text-[#425563]">{entry.assignment.id}</td>
                <td className="px-4">{entry.assignment.cliente}</td>
                <td className="px-4">
                  {entry.relatedItems.map(item => (
                    <div key={`${entry.assignment.id}-${item.inventoryId}`}>
                      {item.inventoryRow?.customerPO} / {item.inventoryRow?.po}
                    </div>
                  ))}
                </td>
                <td className="px-4">
                  {entry.relatedItems.map(item => (
                    <div key={`${entry.assignment.id}-${item.inventoryId}-wh`}>
                      {item.inventoryRow?.bodega}
                    </div>
                  ))}
                </td>
                <td className="px-4">
                  {entry.relatedItems.map(item => (
                    <div key={`${entry.assignment.id}-${item.inventoryId}-eta`}>
                      {item.inventoryRow?.eta}
                    </div>
                  ))}
                </td>
                <td className="px-4 text-right font-bold">
                  {entry.relatedItems.reduce((sum, item) => sum + item.cajas, 0).toLocaleString()}
                </td>
                <td className="px-4">
                  <Badge text={entry.status} />
                </td>
                <td className="px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className="text-[10px] font-bold uppercase border px-3 py-1 border-[#425563] text-[#425563]"
                      onClick={() => setActiveAssignment(entry.assignment)}
                    >
                      Details
                    </button>
                    {entry.status !== "ENTREGADO" && (
                      <select
                        className="input-brand text-[10px] px-2 py-1"
                        value={entry.status}
                        onChange={e => {
                          const newStatus = e.target.value as TrackingStatus;
                          entry.relatedItems.forEach(item => {
                            if (item.inventoryRow) {
                              onStatusChange(item.inventoryRow.id, newStatus);
                            }
                          });
                        }}
                      >
                        {PIPELINE_STAGE_ORDER.map(stage => (
                          <option key={stage} value={stage}>
                            {STATUS_LABELS[stage]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeAssignment && (
        <OperationsDetailDrawer
          assignment={activeAssignment}
          onClose={() => setActiveAssignment(null)}
          inventory={inventory}
          salesOrders={salesOrders}
          checklistState={opsChecklist[activeAssignment.id] || {}}
          onToggleStep={handleStepToggle}
          relatedItems={extendedAssignments.find(entry => entry.assignment.id === activeAssignment.id)?.relatedItems || []}
        />
      )}
    </div>
  );
}

function OperationsDetailDrawer({
  assignment,
  onClose,
  inventory,
  salesOrders,
  checklistState,
  onToggleStep,
  relatedItems,
}: {
  assignment: Assignment;
  onClose: () => void;
  inventory: InventoryRow[];
  salesOrders: SalesOrder[];
  checklistState: Record<string, boolean>;
  onToggleStep: (assignmentId: string, stepId: string) => void;
  relatedItems: Array<
    ReturnType<typeof getAssignmentItems>[number] & { inventoryRow?: InventoryRow }
  >;
}) {
  const salesOrder = assignment.salesOrderId ? salesOrders.find(order => order.id === assignment.salesOrderId) : undefined;
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl border-l border-[#D7D2CB]">
        <div className="p-6 border-b border-[#D7D2CB] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#425563]">Assignment {assignment.id}</h3>
            <p className="text-xs text-[#6E6259]">Cliente: {assignment.cliente}</p>
          </div>
          <button onClick={onClose} className="text-[#6E6259] hover:text-[#FE5000]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-6 text-xs text-[#6E6259]">
          <section className="border border-[#E7E1D8] p-4">
            <h4 className="text-[11px] uppercase tracking-[0.3em] text-[#425563] font-bold mb-3">Lot Details</h4>
            <table className="w-full">
              <thead className="table-header">
                <tr>
                  <th className="py-2 px-3 text-left">PO</th>
                  <th className="px-3 text-left">Warehouse</th>
                  <th className="px-3 text-left">ETA</th>
                  <th className="px-3 text-right">Cases</th>
                </tr>
              </thead>
              <tbody>
                {relatedItems.map(item => (
                  <tr key={item.inventoryId}>
                    <td className="py-2 px-3">{item.inventoryRow?.po}</td>
                    <td className="px-3">{item.inventoryRow?.bodega}</td>
                    <td className="px-3">{item.inventoryRow?.eta}</td>
                    <td className="px-3 text-right font-bold">{item.cajas.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="border border-[#E7E1D8] p-4">
            <h4 className="text-[11px] uppercase tracking-[0.3em] text-[#425563] font-bold mb-3">Order & Logistics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-bold uppercase text-[#6E6259]">Sales Order</p>
                <p>{salesOrder?.demandId || "—"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[#6E6259]">Pick-up Date</p>
                <p>{salesOrder?.pickUpDate || "—"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[#6E6259]">Incoterm</p>
                <p>{salesOrder?.incoterm || "—"}</p>
              </div>
              <div>
                <p className="font-bold uppercase text-[#6E6259]">Tracking Link</p>
                <a className="text-[#FE5000] font-bold" href={salesOrder ? getTrackingLink({ ...relatedItems[0].inventoryRow!, trackingToken: salesOrder.trackingToken || relatedItems[0].inventoryRow?.trackingToken || "" }) : "#"} target="_blank" rel="noreferrer">
                  Ver Link
                </a>
              </div>
            </div>
          </section>

          <section className="border border-[#E7E1D8] p-4">
            <h4 className="text-[11px] uppercase tracking-[0.3em] text-[#425563] font-bold mb-3">Ops Checklist</h4>
            <div className="space-y-3">
              {OPS_STEPS.map(step => (
                <label key={step.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(checklistState[step.id])}
                    onChange={() => onToggleStep(assignment.id, step.id)}
                  />
                  <span>{step.label}</span>
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ControlTowerView({
  inventory,
  salesOrders,
  assignments,
  onQuickAssign,
  onNewInventory,
  onEditInventory,
  onDeleteInventory,
  onNewOrder,
  onEditOrder,
  onDeleteOrder,
  onOpenAssignmentForm,
  onDeleteAssignment,
}: {
  inventory: InventoryRow[];
  salesOrders: SalesOrder[];
  assignments: Assignment[];
  onQuickAssign: (inventoryId: string, salesOrderId: string, lineId: string, cajas: number) => void;
  onNewInventory: () => void;
  onEditInventory: (row: InventoryRow) => void;
  onDeleteInventory: (rowId: string) => void;
  onNewOrder: () => void;
  onEditOrder: (order: SalesOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onOpenAssignmentForm: (mode: AssignmentTipo) => void;
  onDeleteAssignment: (assignmentId: string) => void;
}) {
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [customerFilter, setCustomerFilter] = useState<string>("ALL");
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<{ orderId: string; line: SalesOrderLine } | null>(null);
  const [assignCases, setAssignCases] = useState<number>(0);
  const [liveTick, setLiveTick] = useState(() => Date.now());

  const inventoryMap = useMemo(() => new Map(inventory.map(row => [row.id, row])), [inventory]);

  const warehouses = useMemo(() => Array.from(new Set(inventory.map(row => row.bodega))).sort(), [inventory]);
  const customers = useMemo(() => Array.from(new Set(salesOrders.map(order => order.customerName || order.shipTo || "Cliente"))).sort(), [salesOrders]);

  const allocationMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const asg of assignments) {
      if (!asg.salesOrderId) continue;
      for (const item of getAssignmentItems(asg)) {
        const key = `${asg.salesOrderId}-${item.inventoryId}-${item.material}`;
        map.set(key, (map.get(key) || 0) + item.cajas);
      }
    }
    return map;
  }, [assignments]);

  const remainingForLine = (orderId: string, line: SalesOrderLine) => {
    let allocated = 0;
    for (const [key, cajas] of allocationMap.entries()) {
      if (key.startsWith(`${orderId}-`) && key.endsWith(`-${line.material}`)) {
        allocated += cajas;
      }
    }
    return Math.max((line.cases || 0) - allocated, 0);
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter(row => {
      if (warehouseFilter !== "ALL" && row.bodega !== warehouseFilter) return false;
      return true;
    });
  }, [inventory, warehouseFilter]);

  const filteredOrders = useMemo(() => {
    return salesOrders.filter(order => {
      const customerName = order.customerName || order.shipTo || "Cliente";
      if (customerFilter !== "ALL" && customerName !== customerFilter) return false;
      return true;
    });
  }, [salesOrders, customerFilter]);

  const selectedInventory = selectedInventoryId ? inventoryMap.get(selectedInventoryId) : null;

  useEffect(() => {
    const id = window.setInterval(() => setLiveTick(Date.now()), 12000);
    return () => window.clearInterval(id);
  }, []);

  const awbFeed = useMemo(() => {
    return filteredInventory
      .map(row => {
        const assignment = assignments.find(
          asg => asg.salesOrderId && getAssignmentItems(asg).some(item => item.inventoryId === row.id)
        );
        const order = assignment?.salesOrderId ? salesOrders.find(o => o.id === assignment.salesOrderId) : undefined;
        const lastHistory = row.statusHistory[row.statusHistory.length - 1];
        const lastUpdated = lastHistory ? new Date(lastHistory.at).getTime() : null;
        return {
          id: row.id,
          awb: row.awb || "Pending",
          status: row.status,
          stage: getPipelineStatusIndex(row.status, row.statusHistory),
          eta: row.eta,
          po: row.po,
          customer: order?.customerName || order?.shipTo || row.clientePrincipal,
          orderRef: order?.demandId,
          lastUpdated,
        };
      })
      .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  }, [filteredInventory, assignments, salesOrders]);

  const formatAgo = (ts: number | null) => {
    if (!ts) return "No updates yet";
    const diff = Math.max(0, liveTick - ts);
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
    return `${Math.round(diff / 86400000)}d ago`;
  };

  const handleSelectLine = (orderId: string, line: SalesOrderLine) => {
    setSelectedLine({ orderId, line });
    setAssignCases(remainingForLine(orderId, line));
  };

  const handleAssign = () => {
    if (!selectedInventory || !selectedLine) {
      alert("Seleccione un lote y una línea de orden.");
      return;
    }
    if (assignCases <= 0) {
      alert("Ingrese una cantidad de cajas válida.");
      return;
    }
    onQuickAssign(selectedInventory.id, selectedLine.orderId, selectedLine.line.id, assignCases);
  };

  const handleAssist = (orderId: string, line: SalesOrderLine) => {
    const match = filteredInventory
      .filter(row => row.material === line.material && row.cajasInv > 0)
      .sort((a, b) => a.eta.localeCompare(b.eta))[0];
    if (!match) {
      alert("No hay lotes compatibles para esta línea.");
      return;
    }
    setSelectedInventoryId(match.id);
    handleSelectLine(orderId, line);
    setAssignCases(Math.min(match.cajasInv, remainingForLine(orderId, line)));
  };

  const summaryCards = [
    { icon: Warehouse, label: "Lotes", value: filteredInventory.length.toLocaleString() },
    { icon: Package, label: "Cajas Disponibles", value: filteredInventory.reduce((sum, row) => sum + row.cajasInv, 0).toLocaleString() },
    { icon: FileText, label: "Solicitudes", value: filteredOrders.reduce((sum, order) => sum + (order.lines?.length || 0), 0).toLocaleString() },
    { icon: ClipboardList, label: "Asignaciones", value: assignments.length.toLocaleString() },
  ];
  const selectedLineRemaining = selectedLine ? remainingForLine(selectedLine.orderId, selectedLine.line) : 0;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[2fr,1fr] gap-4">
        <div className="bg-white border border-[#D7D2CB] shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#6E6259] font-['Quicksand']">Control Tower</p>
              <h3 className="text-xl font-bold text-[#425563] font-['Quicksand']">Interactive cockpit</h3>
              <p className="text-xs text-[#6E6259]">Move lots, recalibrate orders, and watch AWB live without leaving this view.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary px-4 py-2 text-[10px] uppercase font-bold tracking-wide flex items-center gap-2" onClick={onNewInventory}>
                <Plus className="h-3 w-3" /> New lot
              </button>
              <button className="btn-secondary px-4 py-2 text-[10px] uppercase font-bold tracking-wide flex items-center gap-2" onClick={onNewOrder}>
                <Plus className="h-3 w-3" /> New order
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-xs font-bold uppercase text-[#6E6259]">Warehouse</label>
            <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)} className="input-brand px-3 py-1.5 text-xs">
              <option value="ALL">All</option>
              {warehouses.map(wh => (
                <option key={wh} value={wh}>{wh}</option>
              ))}
            </select>
            <label className="text-xs font-bold uppercase text-[#6E6259]">Customer</label>
            <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="input-brand px-3 py-1.5 text-xs">
              <option value="ALL">All</option>
              {customers.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className={`border border-[#D7D2CB] p-3 ${selectedInventory ? "bg-[#F9F8F6]" : "bg-white"}`}>
              <div className="flex items-center justify-between text-[11px] uppercase text-[#6E6259] font-['Quicksand']">
                <span>Selected lot</span>
                {selectedInventory && <Badge text={selectedInventory.status} />}
              </div>
              <div className="mt-1 text-sm font-bold text-[#425563]">
                {selectedInventory ? `${selectedInventory.po} · ${selectedInventory.material}` : "Pick a lot"}
              </div>
              <p className="text-[11px] text-[#6E6259]">
                {selectedInventory
                  ? `${selectedInventory.cajasInv.toLocaleString()} cs available · ${selectedInventory.bodega}`
                  : "Click any row to anchor the allocation."}
              </p>
            </div>
            <div className={`border border-[#D7D2CB] p-3 ${selectedLine ? "bg-[#F0EFE9]" : "bg-white"}`}>
              <div className="flex items-center justify-between text-[11px] uppercase text-[#6E6259] font-['Quicksand']">
                <span>Selected request</span>
                {selectedLine && <span className="font-bold text-[#425563] text-[10px]">{selectedLine.line.cases.toLocaleString()} cs</span>}
              </div>
              <div className="mt-1 text-sm font-bold text-[#425563]">
                {selectedLine ? selectedLine.line.material : "Pick an order line"}
              </div>
              <p className="text-[11px] text-[#6E6259]">
                {selectedLine
                  ? `${selectedLineRemaining.toLocaleString()} cs pending · ${filteredOrders.find(o => o.id === selectedLine.orderId)?.demandId || ""}`
                  : "Selecciona la línea que quieres abastecer."}
              </p>
            </div>
            <div className="border border-[#D7D2CB] p-3 bg-[#0f172a] text-white">
              <div className="flex items-center justify-between text-[11px] uppercase font-['Quicksand']">
                <span className="text-white/80">Assign now</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#DAAA00]">
                  <span className="h-2 w-2 rounded-full bg-[#DAAA00] animate-ping"></span>
                  Live
                </span>
              </div>
              <div className="mt-1 text-sm font-bold">
                {assignCases || (selectedInventory && selectedLineRemaining ? Math.min(selectedLineRemaining, selectedInventory.cajasInv) : 0)} cs
              </div>
              <p className="text-[11px] text-white/70">
                Ajusta las cajas y presiona para mover inventario a la orden seleccionada.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={assignCases}
                  onChange={e => setAssignCases(Number(e.target.value))}
                  className="w-20 px-2 py-1 text-[#0f172a] text-sm"
                />
                <button className="btn-primary px-3 py-2 text-[10px] uppercase font-bold tracking-wide" onClick={handleAssign}>
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#425563] via-[#2f3b46] to-[#0f172a] text-white border border-[#243140] shadow-lg p-5 rounded-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/70 font-['Quicksand']">Live AWB</p>
              <h4 className="text-lg font-bold font-['Quicksand']">Traffic board</h4>
              <p className="text-xs text-white/80">AWB, ETA y estado en tiempo real.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#DAAA00] animate-pulse"></span>
              Synced
            </div>
          </div>
          <div className="mt-4 space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {awbFeed.slice(0, 6).map(feed => {
              const progress = Math.round((feed.stage / (TRACK_STEPS.length - 1)) * 100);
              return (
                <div key={feed.id} className="bg-white/5 border border-white/10 p-3 rounded-sm">
                  <div className="flex items-center justify-between text-[11px] uppercase text-white/70 font-['Quicksand']">
                    <span className="font-bold text-white">{feed.awb}</span>
                    <span>{formatAgo(feed.lastUpdated)}</span>
                  </div>
                  <div className="text-sm font-semibold">{feed.customer}</div>
                  <div className="flex items-center justify-between text-[11px] text-white/80">
                    <span>{feed.po} · {feed.orderRef || "Unlinked"}</span>
                    <Badge text={feed.status} />
                  </div>
                  <div className="mt-2 h-1.5 bg-white/10">
                    <div className="h-full bg-[#FE5000]" style={{ width: `${clamp(progress, 5, 100)}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-white/70">ETA {feed.eta || "TBD"}</div>
                </div>
              );
            })}
            {awbFeed.length === 0 && (
              <p className="text-sm text-white/70">No AWBs tracked yet. Asigna un lote para comenzar.</p>
            )}
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 xl:grid-cols-[1.1fr_1.1fr_0.95fr] gap-6">
        <section className="border border-[#D7D2CB] bg-white shadow-sm">
          <div className="p-4 border-b border-[#D7D2CB] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#425563] uppercase">Inventory</h3>
              {selectedInventory && (
                <p className="text-[10px] uppercase text-[#6E6259]">Selected: {selectedInventory.cajasInv.toLocaleString()} cs available</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-[10px] uppercase border border-[#425563] px-3 py-1 flex items-center gap-1 font-bold text-[#425563]"
                onClick={onNewInventory}
              >
                <Plus className="h-3 w-3" /> Add lot
              </button>
            </div>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs text-[#6E6259]">
              <thead>
                <tr className="table-header">
                  <th></th>
                  <th className="px-3 text-left">PO</th>
                  <th className="px-3 text-left">Material</th>
                  <th className="px-3 text-left">WH</th>
                  <th className="px-3 text-left">ETA</th>
                  <th className="px-3 text-left">AWB / Status</th>
                  <th className="px-3 text-right">Available</th>
                  <th className="px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(row => {
                  const lastHistory = row.statusHistory[row.statusHistory.length - 1];
                  const lastUpdated = lastHistory ? new Date(lastHistory.at).getTime() : null;
                  const heartbeat = formatAgo(lastUpdated);
                  return (
                    <tr key={row.id} className="border-b border-[#F0EFE9] hover:bg-[#F9F8F6]">
                      <td className="py-2 px-3">
                        <input type="radio" checked={selectedInventoryId === row.id} onChange={() => setSelectedInventoryId(row.id)} />
                      </td>
                      <td className="px-3 font-bold text-[#425563]">{row.po}</td>
                      <td className="px-3">{row.material}</td>
                      <td className="px-3">{row.bodega}</td>
                      <td className="px-3">{row.eta}</td>
                      <td className="px-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-semibold text-[#425563]">{row.awb || "Pending"}</div>
                            <div className="text-[10px] uppercase text-[#6E6259]">{heartbeat}</div>
                          </div>
                          <Badge text={row.status} />
                        </div>
                      </td>
                      <td className="px-3 text-right font-bold">{row.cajasInv.toLocaleString()}</td>
                      <td className="px-3">
                        <div className="flex justify-end gap-1 text-[#425563]">
                          <button
                            type="button"
                            className="p-1 border border-transparent hover:border-[#425563] hover:text-[#FE5000]"
                            onClick={() => onEditInventory(row)}
                            title="Edit lot"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 border border-transparent hover:border-[#FE5000] hover:text-[#FE5000]"
                            onClick={() => onDeleteInventory(row.id)}
                            title="Delete lot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-[#D7D2CB] bg-white shadow-sm">
          <div className="p-4 border-b border-[#D7D2CB] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#425563] uppercase">Orders</h3>
              <p className="text-[11px] text-[#6E6259]">Seleccione y asistimos con la mejor recomendación.</p>
            </div>
            <button
              className="text-[10px] uppercase border border-[#425563] px-3 py-1 flex items-center gap-1 font-bold text-[#425563]"
              onClick={onNewOrder}
            >
              <Plus className="h-3 w-3" /> Add order
            </button>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {filteredOrders.map(order => {
              const awbStatus = awbFeed.find(feed => feed.orderRef === order.demandId);
              return (
                <div key={order.id} className="border-b border-[#F0EFE9]">
                  <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-[#425563]">{order.demandId}</p>
                      <p>{order.customerName || order.shipTo}</p>
                      {awbStatus && (
                        <div className="flex items-center gap-2 text-[10px] uppercase text-[#6E6259] mt-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#DAAA00] animate-pulse"></span>
                          AWB {awbStatus.awb} · {formatAgo(awbStatus.lastUpdated)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-right text-[10px] uppercase text-[#6E6259]">{order.pickUpDate}</span>
                      <button
                        type="button"
                        className="p-1 border border-transparent hover:border-[#425563] hover:text-[#FE5000]"
                        onClick={() => onEditOrder(order)}
                        title="Edit order"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1 border border-transparent hover:border-[#FE5000] hover:text-[#FE5000]"
                        onClick={() => onDeleteOrder(order.id)}
                        title="Delete order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <table className="w-full text-xs text-[#6E6259]">
                    <tbody>
                      {(order.lines || []).map(line => {
                        const remaining = remainingForLine(order.id, line);
                        const isSelected = !!selectedLine && selectedLine.orderId === order.id && selectedLine.line.id === line.id;
                        const progress = clamp((1 - remaining / (line.cases || 1)) * 100, 0, 100);
                        return (
                          <tr key={line.id} className="border-t border-[#F0EFE9]">
                            <td className="px-4 py-2 w-6">
                              <input type="radio" checked={isSelected} onChange={() => handleSelectLine(order.id, line)} />
                            </td>
                            <td className="px-2">
                              <div className="font-bold text-[#425563]">{line.material}</div>
                              <div>{line.description}</div>
                              <div className="mt-1 h-1 bg-[#E7E2DD]">
                                <div className="h-full bg-[#FE5000]" style={{ width: `${progress}%` }} />
                              </div>
                            </td>
                            <td className="px-2 text-right font-bold">
                              {remaining.toLocaleString()} / {line.cases.toLocaleString()} cs
                            </td>
                            <td className="px-2 text-right">
                              <button className="text-[10px] uppercase border border-[#425563] px-2 py-1" onClick={() => handleAssist(order.id, line)}>
                                Assist
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border border-[#D7D2CB] bg-white shadow-sm">
          <div className="p-4 border-b border-[#D7D2CB] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-[#425563] uppercase">Asignaciones</h3>
              <button
                className="text-[10px] uppercase border border-[#425563] px-2 py-1 font-bold text-[#425563]"
                onClick={() => onOpenAssignmentForm("ORDEN")}
              >
                + Order
              </button>
              <button
                className="text-[10px] uppercase border border-[#425563] px-2 py-1 font-bold text-[#425563]"
                onClick={() => onOpenAssignmentForm("SPOT")}
              >
                + Spot
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6259]">
              <div className="px-3 py-1 bg-[#F9F8F6] border border-[#D7D2CB]">
                {selectedInventory && selectedLine ? `${assignCases || selectedLineRemaining} cs ready` : "Selecciona lote y orden"}
              </div>
              <button className="btn-primary px-4 py-2 text-[10px] uppercase font-bold" onClick={handleAssign}>
                Asignar ahora
              </button>
              <span className="text-[10px] uppercase">Usa el dock superior para ajustar cajas.</span>
            </div>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs text-[#6E6259]">
              <thead>
                <tr className="table-header">
                  <th className="py-2 px-3 text-left">Assignment</th>
                  <th className="px-3 text-left">Customer</th>
                  <th className="px-3 text-left">Order</th>
                  <th className="px-3 text-right">Cases</th>
                  <th className="px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(asg => {
                  const totalCases = getAssignmentItems(asg).reduce((sum, item) => sum + item.cajas, 0);
                  const order = asg.salesOrderId ? salesOrders.find(order => order.id === asg.salesOrderId) : undefined;
                  return (
                    <tr key={asg.id} className="border-b border-[#F0EFE9]">
                      <td className="py-2 px-3 font-bold text-[#425563]">{asg.id}</td>
                      <td className="px-3">{asg.cliente}</td>
                      <td className="px-3">{order?.demandId || "Spot"}</td>
                      <td className="px-3 text-right font-bold">{totalCases.toLocaleString()}</td>
                      <td className="px-3 text-right">
                        <button
                          type="button"
                          className="p-1 border border-transparent hover:border-[#FE5000] hover:text-[#FE5000]"
                          onClick={() => onDeleteAssignment(asg.id)}
                          title="Delete assignment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function OrderTrackingView({ order, rows, assignments }: { order: SalesOrder; rows: InventoryRow[]; assignments: Assignment[] }) {
  const lines = order.lines || [];
  const lineSummaries = lines.map(line => ({
    ...line,
    lbs: line.cases * line.formatLb,
  }));
  const totalOrderCases = lineSummaries.reduce((sum, line) => sum + line.cases, 0);
  const totalOrderLbs = lineSummaries.reduce((sum, line) => sum + line.lbs, 0);

  const allocationRows = rows.flatMap(row =>
    assignments.flatMap(asg =>
      getAssignmentItems(asg)
        .filter(item => item.inventoryId === row.id)
        .map(item => ({
          customerPO: row.customerPO,
          lot: row.po,
          productionDate: row.produccion,
          specification: row.descripcion,
          cases: item.cajas,
          lbs: item.cajas * row.formatoCaja,
          id: row.customId || row.id,
          requestEta: order.pickUpDate || row.eta,
          awb: row.awb || "Pending",
          location: row.ubicacion,
          salesOrder: order.demandId,
        }))
    )
  );

  const totalAllocatedCases = allocationRows.reduce((sum, row) => sum + row.cases, 0);
  const totalAllocatedLbs = allocationRows.reduce((sum, row) => sum + row.lbs, 0);

  const warehouses = Array.from(new Set(rows.map(r => r.bodega))).filter(Boolean);
  const locations = Array.from(new Set(rows.map(r => r.ubicacion))).filter(Boolean);
  const awbs = Array.from(new Set(rows.map(r => r.awb || ""))).filter(Boolean);

  const firstRow = rows[0];
  const rowStageDetails = rows.map(row => {
    const stage = getPipelineStatusIndex(row.status, row.statusHistory);
    const lastEntry = row.statusHistory[row.statusHistory.length - 1];
    const lastUpdated = lastEntry ? Date.parse(lastEntry.at) || 0 : 0;
    return { row, stage, lastUpdated };
  });
  const controllingRow = rowStageDetails.reduce<typeof rowStageDetails[number] | undefined>(
    (best, detail) => (!best || detail.lastUpdated > best.lastUpdated ? detail : best),
    rowStageDetails[0]
  );
  const currentStatusIdx = controllingRow?.stage ?? TRACK_STEP_INDEX["CONFIRMADO"];
  const controllingStatus = controllingRow?.row.status ?? firstRow?.status ?? "CONFIRMADO";

  const orderOverview = [
    { label: "Customer PO", value: order.customerPO || "—" },
    { label: "Sales Order", value: order.demandId || "—" },
    { label: "Incoterm", value: order.incoterm || "—" },
    { label: "ETA", value: firstRow?.eta || order.pickUpDate || "—" },
  ];

  const allocationOverview = [
    { label: "Warehouse", value: warehouses.length > 1 ? "Multiple" : warehouses[0] || "—" },
    { label: "Location", value: locations.length > 1 ? "Multiple" : locations[0] || "—" },
    { label: "Production", value: firstRow?.produccion || "—" },
    { label: "Request ETA", value: order.pickUpDate || "—" },
    { label: "AWB", value: awbs.length > 1 ? "Multiple" : awbs[0] || "Pending" },
  ];

  const orderHistory = rows
    .flatMap(row => row.statusHistory.map(entry => ({ ...entry, po: row.po })))
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="min-h-screen p-4 sm:p-8 flex items-center justify-center font-['Merriweather']" style={TRACKING_BACKGROUND_STYLE}>
      <div className="w-full max-w-6xl bg-white shadow-2xl overflow-hidden border border-[#E1DAD2]">
        <div className="border-t-4 border-[#FE5000] bg-[#3B4A58] text-white px-6 sm:px-10 py-6 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src="/aquachile_logo.png" alt="AquaChile Logo" className="h-8 object-contain" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#C6D2DD] font-['Quicksand']">Customer Name</div>
              <h1 className="text-2xl font-semibold font-['Quicksand']">{(order.customerName || "").toUpperCase()}</h1>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.35em] text-[#C6D2DD] font-['Quicksand']">Current Status</div>
            <div className="mt-2 inline-flex px-4 py-1 border border-white/40 text-xs uppercase tracking-[0.25em] font-bold">
              {STATUS_LABELS[controllingStatus as TrackingStatus] ?? controllingStatus}
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-10 py-10 space-y-10 bg-white">
            <div className="space-y-4">
              <div className="relative pt-6">
                <div className="absolute top-3 left-0 w-full h-px bg-[#E0DAD2]" />
                <div className="absolute top-3 left-0 h-px bg-[#FE5000]" style={{ width: `${(currentStatusIdx / (TRACK_STEPS.length - 1)) * 100}%` }} />
                <div className="flex justify-between items-start relative">
                  {TRACK_STEPS.map((step, idx) => (
                    <div key={step.id} className="flex flex-col items-center text-center w-full">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          idx <= currentStatusIdx
                            ? "bg-[#FE5000] text-white border-2 border-[#FE5000] shadow-[0_0_0_2px_rgba(254,80,0,0.35)]"
                            : "bg-white border-2 border-[#C8C1B9] text-[#C8C1B9]"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span
                        className={`mt-3 text-[11px] uppercase tracking-[0.3em] font-['Quicksand'] font-extrabold ${
                          idx <= currentStatusIdx ? "text-[#2D3B46]" : "text-[#C4BCB3]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[orderOverview, allocationOverview].map((group, idx) => (
              <div key={idx} className="border border-[#E7E1D8] p-6">
                <h3 className="text-xs sm:text-sm font-bold uppercase font-['Quicksand'] text-[#2D3B46] tracking-[0.3em] mb-3 border-b-2 border-[#FE5000] inline-block pb-1">
                  {idx === 0 ? "Order Overview" : "Allocation Overview"}
                </h3>
                <dl className="space-y-2 text-sm text-[#1E2A33]">
                  {group.map(item => (
                    <div key={item.label} className="flex justify-between border-b border-[#EFECE7] pb-2 last:border-b-0 last:pb-0">
                      <dt className="uppercase tracking-[0.3em] text-[10px] text-[#6A727B] font-['Quicksand']">{item.label}</dt>
                      <dd className="font-semibold text-right">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#2D3B46] font-['Quicksand'] uppercase tracking-[0.35em] border-b-2 border-[#FE5000] inline-block pb-1">
              Allocated Cases Detail
            </h3>
          <div className="overflow-x-auto border border-[#E3DDD4]">
            <table className="w-full text-[12px] text-[#1F2533]">
              <thead>
                <tr className="bg-[#F6F3EE] text-[#2D3B46] uppercase tracking-[0.35em] text-[10px] font-['Quicksand']">
                  <th className="py-3 px-4 text-left">PO</th>
                  <th className="px-4 text-left">Prod. Date</th>
                  <th className="px-4 text-left">Specification</th>
                  <th className="px-4 text-right">Cases</th>
                  <th className="px-4 text-right">Lb</th>
                  <th className="px-4 text-left">ID</th>
                  <th className="px-4 text-left">Request ETA</th>
                  <th className="px-4 text-left">AWB</th>
                  <th className="px-4 text-left">Location</th>
                  <th className="px-4 text-left">Sales Order</th>
                </tr>
              </thead>
              <tbody>
                {allocationRows.map((detail, idx) => (
                  <tr key={`${detail.lot}-${detail.id}-${idx}`} className={idx % 2 ? "bg-[#FCFAF6]" : "bg-white"}>
                    <td className="py-3 px-4 font-semibold">
                      <div className="text-[#0F172A] font-bold">{detail.customerPO || "—"}</div>
                      <div className="text-[10px] uppercase tracking-[0.3em] text-[#394456] font-semibold mt-1">Lot {detail.lot}</div>
                    </td>
                    <td className="px-4 text-[#0F172A] font-semibold">{detail.productionDate}</td>
                    <td className="px-4 text-[#0F172A] font-semibold" title={detail.specification}>
                      {detail.specification}
                    </td>
                    <td className="px-4 text-right font-bold text-[#0F172A]">{detail.cases.toLocaleString()}</td>
                    <td className="px-4 text-right font-bold text-[#0F172A]">{detail.lbs.toLocaleString()}</td>
                    <td className="px-4 text-[#0B1324] font-semibold">{detail.id}</td>
                    <td className="px-4 text-[#0B1324] font-semibold">{detail.requestEta}</td>
                    <td className="px-4 text-[#0B1324] font-semibold">{detail.awb}</td>
                    <td className="px-4 text-[#0B1324] font-semibold">{detail.location}</td>
                    <td className="px-4 text-[#0B1324] font-semibold">{detail.salesOrder}</td>
                  </tr>
                ))}
                {allocationRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-[#B1ABA3] py-4 italic">
                      No allocations registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <table className="text-[12px] font-['Quicksand'] uppercase tracking-[0.35em] border border-[#E3DDD4]">
              <tbody>
                <tr>
                  <td className="px-4 py-2 text-[#6D6B66] font-bold border-b border-[#E3DDD4]">Total Cases Allocated</td>
                  <td className="px-4 py-2 text-[#1F2533] font-extrabold border-b border-[#E3DDD4]">
                    {totalAllocatedCases.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-[#6D6B66] font-bold">Total Pounds Allocated</td>
                  <td className="px-4 py-2 text-[#1F2533] font-extrabold">{totalAllocatedLbs.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {lineSummaries.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase font-['Quicksand'] text-[#2D3B46] tracking-[0.35em]">Order Requests</h3>
            <div className="border border-[#E7E1D8] divide-y divide-[#E7E1D8] bg-[#FCFAF6]">
              {lineSummaries.map(line => (
                <div key={line.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-4 py-2 text-xs text-[#2D3B46]">
                  <div>
                    <div className="font-bold uppercase text-[#6E6259]">{line.material}</div>
                    <div>{line.description}</div>
                  </div>
                  <div className="sm:text-right">
                    <div className="font-bold">{line.cases.toLocaleString()} cs · {line.formatLb} lb</div>
                    <div className="text-[11px] text-[#6E6259]">{line.lbs.toLocaleString()} lbs</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#2D3B46] font-['Quicksand'] uppercase tracking-[0.35em] border-b-2 border-[#FE5000] inline-block pb-1">
            History
          </h3>
          <ul className="space-y-3 text-sm text-[#2D3B46]">
            {orderHistory.map((entry, idx) => (
              <li key={`${entry.po}-${idx}`} className="px-4 py-3 bg-[#F6F3EE] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="font-semibold">{new Date(entry.at).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#3B4A58]">
                  {STATUS_LABELS[entry.status]} · {entry.po}
                </span>
              </li>
            ))}
            {orderHistory.length === 0 && (
              <li className="text-center text-[#B1ABA3] italic bg-[#F6F3EE] py-3">No status history yet.</li>
            )}
          </ul>
        </div>
        <div className="border border-[#E7E1D8] bg-[#FDF9F5] p-5 text-sm text-[#2D3B46]">
          <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-[#6A727B] mb-2">Need help with this shipment?</h4>
          <p>If you notice any inconsistency, please contact your AquaChile sales agent directly so we can review the allocation details with you.</p>
        </div>
      </div>
    </div>
  </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: SummaryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 shadow-sm border border-[#D7D2CB] flex items-center gap-4"
    >
      <div className="p-3 bg-[#F9F8F6] rounded-full text-[#FE5000]">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-[#6E6259] font-bold">{label}</p>
        <p className="text-2xl font-['Merriweather'] text-[#425563]">{value}</p>
      </div>
    </motion.div>
  );
}
