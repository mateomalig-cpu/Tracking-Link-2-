import React, { useEffect, useMemo, useState } from "react";
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

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);
const uid = () => Math.random().toString(36).slice(2);

type InventoryRow = {
  id: string;
  ubicacion: string;
  bodega: string;
  planta: string;
  produccion: string;
  eta: string;
  status: string;
  po: string;
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
  // NUEVO: control de vida del lote
  activo: boolean;
  fechaCierre?: string;
};

type OrderItem = {
  inventoryId: string;
  po: string;
  material: string;
  producto: string;
  cajas: number;
};

type SalesOrder = {
  id: string;
  salesRep: string;
  demandId: string;
  tos: string;
  shipTo: string;
  pickUpDate: string;
  brand1: string;
  material: string;
  description: string;
  cases: number;
  price: number;
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

type AssignmentTipo = "ORDEN" | "SPOT";

export type AssignmentStatus =
  | "CONFIRMADO"
  | "EN_TRANSITO"
  | "LISTO_ENTREGA"
  | "ENTREGADO"
  | "RETRASO"
  | "INCIDENCIA";

type NotificationChannel = "EMAIL";

type NotificationRule = {
  enabled: boolean;
  milestones: AssignmentStatus[];
  recipientEmail?: string;
};

type NotificationLog = {
  id: string;
  at: string;
  milestone: AssignmentStatus;
  channel: NotificationChannel;
  success: boolean;
  detail?: string;
  payloadPreview?: string;
};

interface Assignment {
  id: string;
  fecha: string;
  tipo: AssignmentTipo;
  salesOrderId?: string;
  spotCliente?: string;
  spotRef?: string;
  cliente: string;
  estado: "PENDIENTE" | "COMPLETADA" | "ANULADA";
  items: OrderItem[];
  status?: AssignmentStatus;
  statusHistory?: { at: string; status: AssignmentStatus }[];
  notifyRule?: NotificationRule;
  notificationsLog?: NotificationLog[];
  trackingToken?: string;
}

/** Persistencia básica en localStorage (mismo navegador) */
const ASSIGNMENTS_LS_KEY = "assignments_v1";

function loadAssignmentsFromStorage(): Assignment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ASSIGNMENTS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAssignmentsToStorage(list: Assignment[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASSIGNMENTS_LS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

const sampleInventory: InventoryRow[] = [
  {
    id: "row-1",
    ubicacion: "Miami, FL",
    bodega: "MIA-1",
    planta: "Magallanes",
    produccion: "2025-11-03",
    eta: "2025-11-10",
    status: "EN TRÁNSITO",
    po: "40538940",
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
  },
  {
    id: "row-2",
    ubicacion: "Miami, FL",
    bodega: "MIA-1",
    planta: "Magallanes",
    produccion: "2025-11-03",
    eta: "2025-11-10",
    status: "EN TRÁNSITO",
    po: "40538940",
    time: "AM",
    awb: null,
    clientePrincipal: "AquaChile MIA",
    clientes: ["AquaChile MIA", "CUSTOMER2"],
    material: "1113198",
    descripcion: "SA TD Pr 3-4 LB#Bo Cp 35LB AQ",
    producto: "TD 3-4 35",
    sector: "SA",
    trim: "TD",
    size: "3-4",
    escamas: null,
    formatoCaja: 35,
    totalLbs: 150 * 35,
    empacado: "FILETES",
    cajasOrden: 150,
    cajasInv: 150,
    activo: true,
  },
  {
    id: "row-3",
    ubicacion: "Miami, FL",
    bodega: "MIA-2",
    planta: "Cardonal",
    produccion: "2025-11-04",
    eta: "2025-11-12",
    status: "EN BODEGA",
    po: "40538656",
    time: "PM",
    awb: "123-45678901",
    clientePrincipal: "Santa Monica",
    clientes: ["Santa Monica", "CUSTOMER3"],
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
  },
];

const sampleSalesOrders: SalesOrder[] = [
  {
    id: "DEM-1001",
    salesRep: "Juan Pérez",
    demandId: "DEM-1001",
    tos: "FOB",
    shipTo: "AquaChile MIA",
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
  },
  {
    id: "DEM-1002",
    salesRep: "María López",
    demandId: "DEM-1002",
    tos: "CFR",
    shipTo: "Santa Monica Seafood",
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
  },
];

const kpiCards = [
  { id: "stock", label: "Cajas inventario (disponibles)", icon: Package },
  { id: "pendingOrders", label: "Órdenes pendientes", icon: FileText },
  { id: "assignments", label: "Asignaciones creadas", icon: ClipboardList },
  { id: "totalLbs", label: "Lbs totales disponibles", icon: Layers },
];

const CATEGORY_COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#eab308",
  "#14b8a6",
  "#facc15",
];

const clientDirectory: Record<string, { email: string }> = {
  "AquaChile MIA": { email: "logistica@aquachile.com" },
  "Santa Monica Seafood": { email: "ops@sms.com" },
};

function Badge({ text }: { text: string }) {
  const colors: Record<string, string> = {
    "EN TRÁNSITO": "bg-amber-100 text-amber-700",
    "EN BODEGA": "bg-green-100 text-green-700",
    PLANIFICADO: "bg-gray-100 text-gray-700",
    PENDIENTE: "bg-amber-100 text-amber-700",
    COMPLETADA: "bg-green-100 text-green-700",
    ANULADA: "bg-gray-200 text-gray-700",
    APROBADA: "bg-green-100 text-green-700",
    "EN REVISIÓN": "bg-amber-100 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[text] || "bg-gray-100 text-gray-700"
      }`}
    >
      {text}
    </span>
  );
}

function Header() {
  return (
    <div className="w-full flex items-center gap-3 px-6 py-3 border-b bg-white">
      <img
        src="/aquachile_logo.png"
        alt="AquaChile"
        className="h-9 object-contain"
      />
      <div className="flex flex-col">
        <span className="font-semibold">Inventory & Orders Tracker</span>
      </div>
    </div>
  );
}

type AssignmentFormProps = {
  mode: AssignmentTipo;
  inventory: InventoryRow[];
  salesOrders: SalesOrder[];
  onCreate: (data: {
    tipo: AssignmentTipo;
    salesOrderId?: string;
    spotCliente?: string;
    spotRef?: string;
    items: OrderItem[];
  }) => void;
  onCancel: () => void;
};

function AssignmentForm({
  mode,
  inventory,
  salesOrders,
  onCreate,
  onCancel,
}: AssignmentFormProps) {
  const [salesOrderId, setSalesOrderId] = useState(salesOrders[0]?.id ?? "");
  const [spotCliente, setSpotCliente] = useState("");
  const [spotRef, setSpotRef] = useState("");
  const [items, setItems] = useState<OrderItem[]>([
    {
      inventoryId: inventory[0]?.id ?? "",
      po: inventory[0]?.po ?? "",
      material: inventory[0]?.material ?? "",
      producto: inventory[0]?.producto ?? "",
      cajas: 0,
    },
  ]);

  const selectedSO =
    mode === "ORDEN"
      ? salesOrders.find((s) => s.id === salesOrderId)
      : undefined;

  const handleChangeInventory = (idx: number, id: string) => {
    const row = inventory.find((r) => r.id === id);
    if (!row) return;
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              inventoryId: row.id,
              po: row.po,
              material: row.material,
              producto: row.producto,
            }
          : it
      )
    );
  };

  const handleChangeCajas = (idx: number, value: number) => {
    const row = inventory.find((r) => r.id === items[idx].inventoryId);
    const max = row?.cajasInv ?? 0;
    const v = clamp(Number.isFinite(value) ? value : 0, 0, max);
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, cajas: v } : it))
    );
  };

  const handleAddLine = () => {
    const first = inventory[0];
    if (!first) return;
    setItems((prev) => [
      ...prev,
      {
        inventoryId: first.id,
        po: first.po,
        material: first.material,
        producto: first.producto,
        cajas: 0,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = items.filter((i) => i.cajas > 0);
    if (clean.length === 0) return;

    if (mode === "ORDEN") {
      if (!salesOrderId) return;
      onCreate({ tipo: "ORDEN", salesOrderId, items: clean });
    } else {
      if (!spotCliente.trim()) {
        alert("Ingresa el cliente de la venta spot.");
        return;
      }
      onCreate({
        tipo: "SPOT",
        spotCliente: spotCliente.trim(),
        spotRef: spotRef.trim() || undefined,
        items: clean,
      });
    }
  };

  const totalCajas = items.reduce((s, i) => s + i.cajas, 0);
  const totalLbs = items.reduce((s, i) => {
    const row = inventory.find((r) => r.id === i.inventoryId);
    return s + (row ? i.cajas * row.formatoCaja : 0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "ORDEN"
                ? "Nueva asignación de inventario"
                : "Nueva venta spot"}
            </h2>
            <p className="text-xs text-gray-500">
              {mode === "ORDEN"
                ? "Relacionada a una orden de venta de la pestaña Órdenes."
                : "Venta directa que no pasa por el módulo de Órdenes."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "ORDEN" ? (
            <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Orden de venta (Demand ID)
              </label>
              <select
                value={salesOrderId}
                onChange={(e) => setSalesOrderId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-xs"
              >
                {salesOrders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.demandId} • {s.shipTo} • {s.material} • {s.cases} cj
                  </option>
                ))}
              </select>

              {selectedSO && (
                <div className="grid sm:grid-cols-3 gap-2 text-[11px] text-gray-600 mt-2">
                  <div>
                    <span className="font-medium">ShipTo:</span>{" "}
                    {selectedSO.shipTo}
                  </div>
                  <div>
                    <span className="font-medium">Customer PO:</span>{" "}
                    {selectedSO.customerPO}
                  </div>
                  <div>
                    <span className="font-medium">Pick up:</span>{" "}
                    {selectedSO.pickUpDate} ({selectedSO.week})
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Cliente spot
                  </label>
                  <input
                    value={spotCliente}
                    onChange={(e) => setSpotCliente(e.target.value)}
                    className="w-full rounded-lg border px-3 py-1.5 text-xs"
                    placeholder="Ej: Cliente walk-in"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Referencia spot (opcional)
                  </label>
                  <input
                    value={spotRef}
                    onChange={(e) => setSpotRef(e.target.value)}
                    className="w-full rounded-lg border px-3 py-1.5 text-xs"
                    placeholder="Ej: SPOT-001"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Líneas asignadas (puedes mezclar distintos POs / bodegas)
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900"
              >
                <Plus className="h-3 w-3" />
                Añadir línea
              </button>
            </div>

            {items.map((item, idx) => {
              const row = inventory.find((r) => r.id === item.inventoryId);
              const maxCajas = row?.cajasInv ?? 0;
              return (
                <div
                  key={idx}
                  className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)_auto] gap-2 items-center border rounded-xl p-2 bg-gray-50"
                >
                  <select
                    value={item.inventoryId}
                    onChange={(e) =>
                      handleChangeInventory(idx, e.target.value)
                    }
                    className="rounded-lg border px-2 py-1.5 text-xs"
                  >
                    {inventory.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.po} • {r.material} • {r.producto} • {r.bodega} •{" "}
                        {r.cajasInv} cj disp.
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col text-xs">
                    <input
                      type="number"
                      min={0}
                      max={maxCajas}
                      step={1}
                      value={item.cajas}
                      onChange={(e) =>
                        handleChangeCajas(idx, Number(e.target.value) || 0)
                      }
                      className="rounded-lg border px-2 py-1.5 text-xs"
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5">
                      Máx: {maxCajas} cajas
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="text-[11px] text-gray-500 hover:text-red-600 px-2"
                    disabled={items.length === 1}
                  >
                    borrar
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
            <span>
              Total seleccionado: <strong>{totalCajas}</strong> cajas •{" "}
              <strong>{totalLbs.toLocaleString()}</strong> lb
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl border text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-sky-600 text-white text-sm font-medium"
            >
              {mode === "ORDEN" ? "Crear asignación" : "Crear venta spot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type TabId =
  | "dashboard"
  | "inventory"
  | "orders"
  | "assignments"
  | "categories"
  | "warehouse"
  | "clientUpdate";

const DEFAULT_MILESTONES: AssignmentStatus[] = [
  "CONFIRMADO",
  "EN_TRANSITO",
  "LISTO_ENTREGA",
  "ENTREGADO",
  "RETRASO",
  "INCIDENCIA",
];

function composeEmailPayload(asg: Assignment, inventory: InventoryRow[]): string {
  const lines = asg.items.map((it) => {
    const row = inventory.find((r) => r.id === it.inventoryId);
    const calibre = row?.size ?? "?";
    const eta = row?.eta ?? "?";
    const awb = row?.awb ?? "-";
    return `PO ${it.po} | Material ${it.material} | Cajas ${it.cajas} | Calibre ${calibre} | ETA ${eta} | AWB ${awb}`;
  });
  const status = asg.status ?? "CONFIRMADO";
  const link = getTrackingLink(asg);
  return [
    `Cliente: ${asg.cliente}`,
    `Asignación: ${asg.id}`,
    `Status: ${status}`,
    `Detalle:`,
    ...lines,
    link ? `Tracking: ${link}` : undefined,
  ]
    .filter((x): x is string => Boolean(x))
    .join("\n");
}

function getTrackingLink(asg: Assignment): string | undefined {
  if (!asg.trackingToken) return undefined;
  try {
    const origin =
      typeof window !== "undefined" && window.location
        ? window.location.origin
        : "https://tracking.example";
    return `${origin}/track/${asg.trackingToken}`;
  } catch {
    return `https://tracking.example/track/${asg.trackingToken}`;
  }
}

/** Types y agregados para dashboard */
type DashboardAgg = {
  byWarehouse: { bodega: string; totalCajas: number; totalLbs: number }[];
  byStatus: { status: string; cajas: number }[];
  assignmentsByStatus: { status: string; count: number }[];
};

export default function App() {
  const [tab, setTab] = useState<TabId>("inventory");
  const [search, setSearch] = useState("");
  const [inventory, setInventory] = useState<InventoryRow[]>(sampleInventory);
  const [salesOrders] = useState<SalesOrder[]>(sampleSalesOrders);
  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    loadAssignmentsFromStorage()
  );
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentTipo>("ORDEN");

  const path =
    typeof window !== "undefined" ? window.location.pathname : "/";

  // Si estamos en modo tracking (link externo)
  if (path.startsWith("/track/")) {
    const token = path.split("/track/")[1] || "";
    const inv = inventory.length ? inventory : sampleInventory;

    const existing = assignments.find((a) => a.trackingToken === token);

    if (existing) {
      return <ClientTrackingView assignment={existing} inventory={inv} />;
    }

    // fallback demo si no encuentra la asignación real
    const baseRow = inv[0] ?? sampleInventory[0];

    const trackingAssignment: Assignment = {
      id: token ? `ASG-${token}` : "ASG-DEMO",
      fecha: new Date().toISOString().slice(0, 10),
      tipo: "ORDEN",
      cliente: baseRow?.clientePrincipal ?? "Cliente",
      estado: "PENDIENTE",
      items: baseRow
        ? [
            {
              inventoryId: baseRow.id,
              po: baseRow.po,
              material: baseRow.material,
              producto: baseRow.producto,
              cajas: 50,
            },
          ]
        : [],
      status: "EN_TRANSITO",
      statusHistory: [
        { at: new Date().toISOString(), status: "CONFIRMADO" },
        { at: new Date().toISOString(), status: "EN_TRANSITO" },
      ],
      notifyRule: undefined,
      notificationsLog: [],
      trackingToken: token || undefined,
    };

    return (
      <ClientTrackingView
        assignment={trackingAssignment}
        inventory={inv}
      />
    );
  }

  const filteredInventory = useMemo(() => {
    const q = search.toLowerCase();
    return inventory
      .filter((row) => row.activo) // solo lotes vivos
      .filter((row) =>
        [
          row.po,
          row.material,
          row.descripcion,
          row.producto,
          row.clientePrincipal,
          row.clientes.join(" "),
          row.bodega,
          row.sector,
          row.trim,
          row.size,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
  }, [inventory, search]);

  const shouldNotify = (asg: Assignment, milestone: AssignmentStatus) =>
    !!(asg.notifyRule?.enabled && asg.notifyRule.milestones.includes(milestone));

  const updateAssignment = (id: string, mut: (a: Assignment) => Assignment) => {
    setAssignments((prev) => {
      const next = prev.map((a) => (a.id === id ? mut({ ...a }) : a));
      saveAssignmentsToStorage(next);
      return next;
    });
  };

  const ensureRecipient = (asg: Assignment): string | undefined => {
    const preset =
      asg.notifyRule?.recipientEmail ||
      clientDirectory[asg.cliente]?.email ||
      "";
    if (preset) return preset;
    alert(
      "Este cliente no tiene correo configurado. Ingrésalo para enviar la notificación."
    );
    const entered = window.prompt(`Correo para ${asg.cliente}:`, preset);
    if (!entered) return undefined;
    const ok = /.+@.+\..+/.test(entered);
    if (!ok) {
      alert("Correo inválido.");
      return undefined;
    }
    updateAssignment(asg.id, (a) => ({
      ...a,
      notifyRule: {
        ...(a.notifyRule ?? {
          enabled: true,
          milestones: DEFAULT_MILESTONES,
        }),
        recipientEmail: entered,
      },
    }));
    return entered;
  };

  const sendEmailSim = (to: string, subject: string, body: string) => {
    console.log("EMAIL >>", { to, subject, body });
    if (typeof window !== "undefined") {
      (window as any).__lastMail = {
        to,
        subject,
        body,
        at: new Date().toISOString(),
      };
    }
    return { ok: true, id: uid() };
  };

  const pushLog = (
    asg: Assignment,
    milestone: AssignmentStatus,
    payloadPreview: string,
    success: boolean,
    detail?: string
  ): NotificationLog => ({
    id: uid(),
    at: new Date().toISOString(),
    milestone,
    channel: "EMAIL",
    success,
    detail,
    payloadPreview,
  });

  const setNotifyEnabled = (id: string, enabled: boolean) => {
    updateAssignment(id, (a) => ({
      ...a,
      notifyRule: {
        ...(a.notifyRule ?? {
          milestones: DEFAULT_MILESTONES,
          enabled,
          recipientEmail: undefined,
        }),
        enabled,
      },
    }));
  };

  const notifyConfirmForRow = (rowId: string) => {
    const affected = assignments.filter(
      (a) =>
        a.items.some((it) => it.inventoryId === rowId) &&
        a.estado !== "ANULADA"
    );
    if (affected.length === 0) {
      alert(
        "No hay asignaciones para este PO/material aún. Crea la asignación o usa 'Órdenes' para preparar una."
      );
      return;
    }
    affected.forEach((a) => {
      const milestone: AssignmentStatus = "CONFIRMADO";
      if (!shouldNotify(a, milestone)) return;
      const to = ensureRecipient(a);
      if (!to) return;
      const payload = composeEmailPayload(
        { ...a, status: milestone },
        inventory
      );
      const res = sendEmailSim(to, `[${a.id}] ${milestone}`, payload);
      updateAssignment(a.id, (x) => ({
        ...x,
        notificationsLog: [
          ...(x.notificationsLog ?? []),
          {
            id: uid(),
            at: new Date().toISOString(),
            milestone,
            channel: "EMAIL",
            success: !!res.ok,
            detail: res.id,
            payloadPreview: payload,
          },
        ],
      }));
    });
  };

  const updateMilestone = (id: string, newStatus: AssignmentStatus) => {
    const asg = assignments.find((x) => x.id === id);
    if (!asg) return;

    const payload = composeEmailPayload(
      { ...asg, status: newStatus },
      inventory
    );

    updateAssignment(id, (a) => {
      const next = { ...a };
      next.status = newStatus;
      next.statusHistory = [
        ...(next.statusHistory ?? []),
        { at: new Date().toISOString(), status: newStatus },
      ];
      if (shouldNotify(next, newStatus)) {
        const to = ensureRecipient(next);
        if (to) {
          const res = sendEmailSim(
            to,
            `[${next.id}] ${newStatus}`,
            payload
          );
          next.notificationsLog = [
            ...(next.notificationsLog ?? []),
            pushLog(next, newStatus, payload, !!res.ok, res.id),
          ];
        }
      }
      return next;
    });
  };

  const sendNow = (id: string) => {
    const asg = assignments.find((x) => x.id === id);
    if (!asg || !asg.notifyRule?.enabled) return;
    const to = ensureRecipient(asg);
    if (!to) return;
    const payload = composeEmailPayload(asg, inventory);
    const res = sendEmailSim(
      to,
      `[${asg.id}] ${asg.status ?? "CONFIRMADO"}`,
      payload
    );
    updateAssignment(id, (a) => ({
      ...a,
      notificationsLog: [
        ...(a.notificationsLog ?? []),
        pushLog(a, a.status ?? "CONFIRMADO", payload, !!res.ok, res.id),
      ],
    }));
  };

  const markEnTransitoForRow = (rowId: string) => {
    const affected = assignments.filter(
      (a) =>
        a.items.some((it) => it.inventoryId === rowId) &&
        a.estado !== "ANULADA"
    );
    if (affected.length === 0) {
      alert(
        "No hay asignaciones vinculadas a este lote para actualizar a EN_TRANSITO."
      );
      return;
    }
    affected.forEach((a) => updateMilestone(a.id, "EN_TRANSITO"));
  };

  const kpis = useMemo(() => {
    const vivos = inventory.filter((r) => r.activo);
    const totalCajasInv = vivos.reduce((s, r) => s + r.cajasInv, 0);
    const totalLbsAvailable = vivos.reduce(
      (s, r) => s + r.cajasInv * r.formatoCaja,
      0
    );
    const totalAssignments = assignments.length;

    const assignedBySO = new Map<string, number>();
    for (const asg of assignments) {
      if (asg.estado === "ANULADA") continue;
      if (asg.tipo !== "ORDEN" || !asg.salesOrderId) continue;
      const prev = assignedBySO.get(asg.salesOrderId) ?? 0;
      const extra = asg.items.reduce((s, it) => s + it.cajas, 0);
      assignedBySO.set(asg.salesOrderId, prev + extra);
    }

    const pendingOrders = salesOrders.filter((so) => {
      const assigned = assignedBySO.get(so.id) ?? 0;
      return assigned < so.cases;
    }).length;

    return {
      totalCajasInv,
      totalAssignments,
      pendingOrders,
      totalLbsAvailable,
    };
  }, [inventory, assignments, salesOrders]);

  const dashboardAgg: DashboardAgg = useMemo(() => {
    const vivos = inventory.filter((r) => r.activo);

    const byWarehouseMap = new Map<
      string,
      { bodega: string; totalCajas: number; totalLbs: number }
    >();
    const byStatusMap = new Map<string, { status: string; cajas: number }>();
    const byAsgStatusMap = new Map<
      string,
      { status: string; count: number }
    >();

    for (const r of vivos) {
      const wh =
        byWarehouseMap.get(r.bodega) ?? {
          bodega: r.bodega,
          totalCajas: 0,
          totalLbs: 0,
        };
      wh.totalCajas += r.cajasInv;
      wh.totalLbs += r.cajasInv * r.formatoCaja;
      byWarehouseMap.set(r.bodega, wh);

      const st = byStatusMap.get(r.status) ?? {
        status: r.status,
        cajas: 0,
      };
      st.cajas += r.cajasInv;
      byStatusMap.set(r.status, st);
    }

    for (const a of assignments) {
      const stId = a.status ?? "SIN_STATUS";
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
    type Row = {
      key: string;
      sector: string;
      trim: string;
      size: string;
      cajas: number;
    };
    const map = new Map<string, Row>();
    for (const r of inventory.filter((x) => x.activo)) {
      const key = `${r.sector}-${r.trim}-${r.size}`;
      const existing =
        map.get(key) || {
          key,
          sector: r.sector,
          trim: r.trim,
          size: r.size,
          cajas: 0,
        };
      existing.cajas += r.cajasInv;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        a.sector.localeCompare(b.sector) ||
        a.trim.localeCompare(b.trim) ||
        a.size.localeCompare(b.size)
    );
  }, [inventory]);

  const handleAddCustomerToRow = (rowId: string) => {
    const name = window.prompt("Nombre del nuevo cliente para este PO:");
    if (!name) return;
    setInventory((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              clientes: r.clientes.includes(name)
                ? r.clientes
                : [...r.clientes, name],
            }
          : r
      )
    );
  };

  const createNotifyRuleForClient = (cliente: string): NotificationRule => ({
    enabled: true,
    milestones: DEFAULT_MILESTONES,
    recipientEmail: clientDirectory[cliente]?.email,
  });

  const handleCreateAssignment = (data: {
    tipo: AssignmentTipo;
    salesOrderId?: string;
    spotCliente?: string;
    spotRef?: string;
    items: OrderItem[];
  }) => {
    let cliente = "";
    let salesOrderId: string | undefined = undefined;
    let so: SalesOrder | undefined;

    if (data.tipo === "ORDEN") {
      if (!data.salesOrderId) {
        alert("Orden de venta no encontrada.");
        return;
      }
      salesOrderId = data.salesOrderId;
      so = salesOrders.find((s) => s.id === salesOrderId);
      if (!so) {
        alert("Orden de venta no encontrada.");
        return;
      }
      cliente = so.shipTo;
    } else {
      if (!data.spotCliente) {
        alert("Cliente spot inválido.");
        return;
      }
      cliente = data.spotCliente;
    }

    const invMap = new Map(inventory.map((r) => [r.id, r] as const));
    for (const it of data.items) {
      const row = invMap.get(it.inventoryId);
      if (!row || it.cajas > row.cajasInv) {
        alert(
          `No hay stock suficiente para PO ${it.po} / ${it.material}. Disponible: ${
            row?.cajasInv ?? 0
          } cajas`
        );
        return;
      }
    }

    const nowIso = new Date().toISOString();

    // Nuevo: marcar activo=false cuando llegue a 0 y fechaCierre
    const newInventory = inventory.map((r) => {
      const assignedForRow = data.items
        .filter((it) => it.inventoryId === r.id)
        .reduce((s, it) => s + it.cajas, 0);
      if (!assignedForRow) return r;

      const newCajasInv = r.cajasInv - assignedForRow;
      const stillActive = newCajasInv > 0;
      const fechaCierre =
        !stillActive && r.activo ? nowIso : r.fechaCierre;

      return {
        ...r,
        cajasInv: newCajasInv,
        activo: stillActive,
        fechaCierre,
      };
    });

    const newAssignment: Assignment = {
      id: `ASG-${String(assignments.length + 1).padStart(4, "0")}`,
      fecha: nowIso.slice(0, 10),
      tipo: data.tipo,
      salesOrderId,
      spotCliente: data.spotCliente,
      spotRef: data.spotRef,
      cliente,
      estado: "PENDIENTE",
      items: data.items,
      notifyRule: createNotifyRuleForClient(cliente),
      status: "LISTO_ENTREGA",
      statusHistory: [{ at: nowIso, status: "LISTO_ENTREGA" }],
      notificationsLog: [],
      trackingToken: uid(),
    };

    setInventory(newInventory);
    setAssignments((prev) => {
      const next = [newAssignment, ...prev];
      saveAssignmentsToStorage(next);
      return next;
    });
    setShowAssignmentForm(false);

    if (
      newAssignment.notifyRule?.enabled &&
      newAssignment.notifyRule.milestones.includes("LISTO_ENTREGA")
    ) {
      const to = ensureRecipient(newAssignment);
      if (to) {
        const payload = composeEmailPayload(newAssignment, newInventory);
        const res = sendEmailSim(
          to,
          `[${newAssignment.id}] LISTO_ENTREGA`,
          payload
        );
        updateAssignment(newAssignment.id, (a) => ({
          ...a,
          notificationsLog: [
            ...(a.notificationsLog ?? []),
            {
              id: uid(),
              at: new Date().toISOString(),
              milestone: "LISTO_ENTREGA",
              channel: "EMAIL",
              success: !!res.ok,
              detail: res.id,
              payloadPreview: payload,
            },
          ],
        }));
      }
    }
  };

  const handleCancelAssignment = (id: string) => {
    const asg = assignments.find((a) => a.id === id);
    if (!asg) return;
    if (
      !window.confirm(
        "¿Anular esta asignación y devolver cajas al inventario?"
      )
    )
      return;

    // si vuelve a haber cajas, reactivamos el lote y limpiamos fechaCierre
    const newInventory = inventory.map((r) => {
      const toReturn = asg.items
        .filter((it) => it.inventoryId === r.id)
        .reduce((s, it) => s + it.cajas, 0);
      if (!toReturn) return r;

      const newCajasInv = r.cajasInv + toReturn;
      const stillActive = newCajasInv > 0;
      const fechaCierre = stillActive ? undefined : r.fechaCierre;

      return {
        ...r,
        cajasInv: newCajasInv,
        activo: stillActive,
        fechaCierre,
      };
    });

    const newAssignments = assignments.map((a) =>
      a.id === id ? { ...a, estado: "ANULADA" } : a
    );

    setInventory(newInventory);
    setAssignments(newAssignments);
    saveAssignmentsToStorage(newAssignments);
  };

  useEffect(() => {
    try {
      console.assert(clamp(10, 0, 5) === 5, "clamp limita por arriba");
      console.assert(clamp(-1, 0, 5) === 0, "clamp limita por abajo");

      const fakeAsg: Assignment = {
        id: "ASG-T1",
        fecha: "2025-11-12",
        tipo: "ORDEN",
        cliente: "Santa Monica Seafood",
        estado: "PENDIENTE",
        items: [
          {
            inventoryId: sampleInventory[2].id,
            po: sampleInventory[2].po,
            material: sampleInventory[2].material,
            producto: sampleInventory[2].producto,
            cajas: 10,
          },
        ],
        status: "EN_TRANSITO",
      };
      const payload = composeEmailPayload(fakeAsg, sampleInventory);
      console.assert(payload.includes("PO"), "payload incluye PO");
      console.assert(payload.includes("Material"), "payload incluye material");
      console.assert(
        payload.includes("Status: EN_TRANSITO"),
        "payload incluye status"
      );
      console.assert(payload.includes("ETA"), "payload incluye ETA");
      console.assert(payload.includes("AWB"), "payload incluye AWB");
    } catch (e) {
      console.warn("DEV TESTS fallo:", e);
    }
  }, []);

  return (
    <>
      <Header />

      <div className="min-h-screen bg-gray-50">
        <header className="bg-slate-900 text-white sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
            <nav className="flex flex-wrap gap-2 text-xs sm:text-sm">
              <NavButton
                active={tab === "dashboard"}
                onClick={() => setTab("dashboard")}
                icon={Layers}
                label="Dashboard"
              />
              <NavButton
                active={tab === "orders"}
                onClick={() => setTab("orders")}
                icon={FileText}
                label="Orders"
              />
              <NavButton
                active={tab === "inventory"}
                onClick={() => setTab("inventory")}
                icon={Warehouse}
                label="Inventory"
              />
              <NavButton
                active={tab === "warehouse"}
                onClick={() => setTab("warehouse")}
                icon={Warehouse}
                label="Warehouses"
              />
              <NavButton
                active={tab === "assignments"}
                onClick={() => setTab("assignments")}
                icon={ClipboardList}
                label="Allocations"
              />
              <NavButton
                active={tab === "clientUpdate"}
                onClick={() => setTab("clientUpdate")}
                icon={Mail}
                label="Tracking"
              />
              <NavButton
                active={tab === "categories"}
                onClick={() => setTab("categories")}
                icon={PieChartIcon}
                label="Categories"
              />
            </nav>

            {tab === "inventory" && (
              <div className="ml-auto relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="pl-8 pr-3 py-2 rounded-xl bg-white/90 text-xs text-black w-64 border border-slate-700"
                />
              </div>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {tab === "dashboard" && (
            <DashboardView kpis={kpis} agg={dashboardAgg} />
          )}

          {tab === "orders" && <SalesOrdersView orders={salesOrders} />}

          {tab === "inventory" && (
            <InventoryView
              rows={filteredInventory}
              onAddCustomer={handleAddCustomerToRow}
            />
          )}

          {tab === "warehouse" && (
            <WarehouseView inventory={inventory.filter((r) => r.activo)} />
          )}

          {tab === "assignments" && (
            <AssignmentsView
              assignments={assignments}
              salesOrders={salesOrders}
              inventory={inventory}
              onCancel={handleCancelAssignment}
              onNewAssignmentOrden={() => {
                if (salesOrders.length === 0) {
                  alert(
                    "Primero debes tener órdenes de venta (pestaña Órdenes)."
                  );
                  return;
                }
                if (inventory.filter((r) => r.activo).length === 0) {
                  alert("No hay inventario disponible para asignar.");
                  return;
                }
                setAssignmentMode("ORDEN");
                setShowAssignmentForm(true);
              }}
              onNewAssignmentSpot={() => {
                if (inventory.filter((r) => r.activo).length === 0) {
                  alert("No hay inventario disponible para asignar.");
                  return;
                }
                setAssignmentMode("SPOT");
                setShowAssignmentForm(true);
              }}
              onToggleNotify={(id, enabled) =>
                setNotifyEnabled(id, enabled)
              }
              onStatusChange={updateMilestone}
              onSendNow={sendNow}
            />
          )}

          {tab === "clientUpdate" && (
            <ClientUpdateView
              inventory={inventory.filter((r) => r.activo)}
              assignments={assignments}
              onNotifyConfirm={notifyConfirmForRow}
              onMarkEnTransito={markEnTransitoForRow}
            />
          )}

          {tab === "categories" && (
            <CategoriesView summary={categorySummary} />
          )}
        </main>
      </div>

      {showAssignmentForm && inventory.filter((r) => r.activo).length > 0 && (
        <AssignmentForm
          mode={assignmentMode}
          inventory={inventory.filter((r) => r.activo)}
          salesOrders={salesOrders}
          onCreate={handleCreateAssignment}
          onCancel={() => setShowAssignmentForm(false)}
        />
      )}
    </>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
        active ? "bg-white text-slate-900" : "bg-white/5"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function DashboardView({
  kpis,
  agg,
}: {
  kpis: {
    totalCajasInv: number;
    totalAssignments: number;
    pendingOrders: number;
    totalLbsAvailable: number;
  };
  agg: DashboardAgg;
}) {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ id, label, icon: Icon }) => {
          const value =
            id === "stock"
              ? kpis.totalCajasInv
              : id === "pendingOrders"
              ? kpis.pendingOrders
              : id === "assignments"
              ? kpis.totalAssignments
              : kpis.totalLbsAvailable;
          const formatted =
            id === "totalLbs"
              ? `${value.toLocaleString()} lb`
              : value.toLocaleString();
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 shadow-sm border flex items-center gap-3"
            >
              <div className="p-2 rounded-xl bg-gray-50 border">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-xl font-semibold">{formatted}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Gráficos inventario */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Inventario por bodega */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <h3 className="text-xs font-semibold text-gray-600 mb-2">
            Inventario por bodega (cajas)
          </h3>
          <div className="h-64">
            {agg.byWarehouse.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agg.byWarehouse}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bodega" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalCajas" name="Cajas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Sin datos de bodegas.
              </div>
            )}
          </div>
        </div>

        {/* Inventario por status */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <h3 className="text-xs font-semibold text-gray-600 mb-2">
            Inventario por status (cajas)
          </h3>
          <div className="h-64">
            {agg.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agg.byStatus}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cajas" name="Cajas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Sin datos de status.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asignaciones por estado */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">
          Asignaciones por estado
        </h3>
        <div className="h-64">
          {agg.assignmentsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.assignmentsByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Asignaciones" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Aún no hay asignaciones.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SalesOrdersView({ orders }: { orders: SalesOrder[] }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border">
      <h2 className="font-semibold text-sm mb-3">
        Órdenes de venta 
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1300px]">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 px-2">Sales Rep</th>
              <th className="px-2">Demand ID</th>
              <th className="px-2">ToS</th>
              <th className="px-2">ShipTo</th>
              <th className="px-2">Pick up Date</th>
              <th className="px-2">Brand1</th>
              <th className="px-2">Material</th>
              <th className="px-2">Description</th>
              <th className="px-2 text-right">Cases</th>
              <th className="px-2 text-right">Price</th>
              <th className="px-2">Flex</th>
              <th className="px-2">Incoterm</th>
              <th className="px-2">Truck</th>
              <th className="px-2">Customer PO</th>
              <th className="px-2">Port Entry</th>
              <th className="px-2">Week</th>
              <th className="px-2">Estado aprobación</th>
              <th className="px-2">Estado progreso</th>
              <th className="px-2">UM precio</th>
              <th className="px-2">Orden</th>
              <th className="px-2">Estado planificación</th>
              <th className="px-2">Especie</th>
              <th className="px-2">Desc. especie</th>
              <th className="px-2">Estado det. precio</th>
              <th className="px-2">Incoterms</th>
              <th className="px-2">Brand</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="py-2 px-2 whitespace-nowrap">
                  {o.salesRep}
                </td>
                <td className="px-2 whitespace-nowrap">{o.demandId}</td>
                <td className="px-2 whitespace-nowrap">{o.tos}</td>
                <td className="px-2 whitespace-nowrap">{o.shipTo}</td>
                <td className="px-2 whitespace-nowrap">
                  {o.pickUpDate}
                </td>
                <td className="px-2 whitespace-nowrap">{o.brand1}</td>
                <td className="px-2 font-mono whitespace-nowrap">
                  {o.material}
                </td>
                <td className="px-2">
                  <span>{o.description}</span>
                </td>
                <td className="px-2 text-right">{o.cases}</td>
                <td className="px-2 text-right">
                  {o.price.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-2 whitespace-nowrap">{o.flex}</td>
                <td className="px-2 whitespace-nowrap">{o.incoterm}</td>
                <td className="px-2 whitespace-nowrap">{o.truck}</td>
                <td className="px-2 whitespace-nowrap">
                  {o.customerPO}
                </td>
                <td className="px-2 whitespace-nowrap">
                  {o.portEntry}
                </td>
                <td className="px-2 whitespace-nowrap">{o.week}</td>
                <td className="px-2 whitespace-nowrap">
                  <Badge text={o.estadoAprobacion} />
                </td>
                <td className="px-2 whitespace-nowrap">
                  {o.estadoProgreso}
                </td>
                <td className="px-2 whitespace-nowrap">
                  {o.unidadPrecio}
                </td>
                <td className="px-2 whitespace-nowrap">{o.orden}</td>
                <td className="px-2 whitespace-nowrap">
                  {o.estadoPlanificacion}
                </td>
                <td className="px-2 whitespace-nowrap">{o.especie}</td>
                <td className="px-2 whitespace-nowrap">
                  {o.especieDescripcion}
                </td>
                <td className="px-2 whitespace-nowrap">
                  {o.estadoDetPrecio}
                </td>
                <td className="px-2 whitespace-nowrap">
                  {o.incoterms2}
                </td>
                <td className="px-2 whitespace-nowrap">{o.brand}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td
                  colSpan={26}
                  className="text-center py-6 text-gray-400"
                >
                  Aún no hay órdenes de venta cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryView({
  rows,
  onAddCustomer,
}: {
  rows: InventoryRow[];
  onAddCustomer: (rowId: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h2 className="font-semibold text-sm">Inventory</h2>
          <p className="text-xs text-gray-500">

          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 px-2">Ubicación</th>
              <th className="px-2">Bodega</th>
              <th className="px-2">Planta</th>
              <th className="px-2">Prod</th>
              <th className="px-2">ETA</th>
              <th className="px-2">Status</th>
              <th className="px-2">PO</th>
              <th className="px-2">AWB</th>
              <th className="px-2">Cliente(s)</th>
              <th className="px-2">Material</th>
              <th className="px-2">Descripción</th>
              <th className="px-2">Producto</th>
              <th className="px-2">Sector</th>
              <th className="px-2">Trim</th>
              <th className="px-2">Calibre</th>
              <th className="px-2">Escamas</th>
              <th className="px-2 text-right">Formato</th>
              <th className="px-2 text-right">Cajas PO</th>
              <th className="px-2 text-right">Cajas disp.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2 px-2 whitespace-nowrap">
                  {r.ubicacion}
                </td>
                <td className="px-2 whitespace-nowrap">{r.bodega}</td>
                <td className="px-2 whitespace-nowrap">{r.planta}</td>
                <td className="px-2 whitespace-nowrap">
                  {r.produccion}
                </td>
                <td className="px-2 whitespace-nowrap">{r.eta}</td>
                <td className="px-2 whitespace-nowrap">
                  <Badge text={r.status} />
                </td>
                <td className="px-2 font-mono whitespace-nowrap">
                  {r.po}
                </td>
                <td className="px-2 font-mono whitespace-nowrap">
                  {r.awb ?? "--"}
                </td>
                <td className="px-2">
                  <div className="flex flex-wrap gap-1">
                    {r.clientes.map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded-full bg-gray-50 border text-[10px]"
                      >
                        {c}
                      </span>
                    ))}
                    <button
                      onClick={() => onAddCustomer(r.id)}
                      className="text-[10px] text-sky-700 hover:text-sky-900"
                    >
                      + cliente
                    </button>
                  </div>
                </td>
                <td className="px-2 font-mono whitespace-nowrap">
                  {r.material}
                </td>
                <td className="px-2">{r.descripcion}</td>
                <td className="px-2 whitespace-nowrap">
                  {r.producto}
                </td>
                <td className="px-2 whitespace-nowrap">{r.sector}</td>
                <td className="px-2 whitespace-nowrap">{r.trim}</td>
                <td className="px-2 whitespace-nowrap">{r.size}</td>
                <td className="px-2 whitespace-nowrap">
                  {r.escamas ?? "-"}
                </td>
                <td className="px-2 text-right whitespace-nowrap">
                  {r.formatoCaja} lb/cj
                </td>
                <td className="px-2 text-right whitespace-nowrap">
                  {r.cajasOrden.toLocaleString()}
                </td>
                <td className="px-2 text-right whitespace-nowrap font-semibold">
                  {r.cajasInv.toLocaleString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={19}
                  className="text-center py-6 text-gray-400"
                >
                  No hay filas que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500 mt-3">
        Más adelante este inventario se va a cargar automáticamente desde tus
        planillas (Ubicación, Bodega, Planta, ETA, Status, PO, Material SAP,
        etc.).
      </p>
    </div>
  );
}

function WarehouseView({ inventory }: { inventory: InventoryRow[] }) {
  type WHRow = {
    bodega: string;
    ubicacion: string;
    totalCajas: number;
    totalLbs: number;
    productos: {
      key: string;
      producto: string;
      material: string;
      cajas: number;
    }[];
  };

  const data: WHRow[] = useMemo(() => {
    const map = new Map<string, WHRow>();

    for (const r of inventory) {
      const key = r.bodega;
      const wh =
        map.get(key) ??
        {
          bodega: r.bodega,
          ubicacion: r.ubicacion,
          totalCajas: 0,
          totalLbs: 0,
          productos: [],
        };

      wh.totalCajas += r.cajasInv;
      wh.totalLbs += r.cajasInv * r.formatoCaja;

      const prodKey = `${r.material}-${r.producto}`;
      const existingProd =
        wh.productos.find((p) => p.key === prodKey) ??
        {
          key: prodKey,
          producto: r.producto,
          material: r.material,
          cajas: 0,
        };
      existingProd.cajas += r.cajasInv;
      if (!wh.productos.some((p) => p.key === prodKey)) {
        wh.productos.push(existingProd);
      }

      map.set(key, wh);
    }

    return Array.from(map.values());
  }, [inventory]);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border">
      <h2 className="font-semibold text-sm mb-3">Bodegas</h2>
      <p className="text-xs text-gray-500 mb-3">
        Resumen de inventario por bodega y producto.
      </p>

      {data.length === 0 && (
        <div className="text-center text-gray-400 text-xs py-6">
          No hay inventario cargado.
        </div>
      )}

      <div className="space-y-4">
        {data.map((wh) => (
          <div
            key={wh.bodega}
            className="border rounded-2xl p-3 bg-gray-50"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold">
                  {wh.bodega}
                </div>
                <div className="text-[11px] text-gray-500">
                  {wh.ubicacion}
                </div>
              </div>
              <div className="text-right text-xs text-gray-600">
                <div>
                  Cajas:{" "}
                  <strong>{wh.totalCajas.toLocaleString()}</strong>
                </div>
                <div>
                  Lbs:{" "}
                  <strong>{wh.totalLbs.toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse min-w-[400px] bg-white rounded-xl">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-1.5 px-2">Material</th>
                    <th className="px-2">Producto</th>
                    <th className="px-2 text-right">Cajas</th>
                  </tr>
                </thead>
                <tbody>
                  {wh.productos.map((p) => (
                    <tr key={p.key} className="border-b last:border-0">
                      <td className="py-1.5 px-2 font-mono whitespace-nowrap">
                        {p.material}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {p.producto}
                      </td>
                      <td className="px-2 text-right">
                        {p.cajas.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {wh.productos.length === 0 && (
                    <tr>
                      <td
                        className="py-2 px-2 text-center text-gray-400"
                        colSpan={3}
                      >
                        Sin productos en esta bodega.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentsView({
  assignments,
  salesOrders,
  inventory,
  onCancel,
  onNewAssignmentOrden,
  onNewAssignmentSpot,
  onToggleNotify,
  onStatusChange,
  onSendNow,
}: {
  assignments: Assignment[];
  salesOrders: SalesOrder[];
  inventory: InventoryRow[];
  onCancel: (id: string) => void;
  onNewAssignmentOrden: () => void;
  onNewAssignmentSpot: () => void;
  onToggleNotify: (id: string, enabled: boolean) => void;
  onStatusChange: (id: string, status: AssignmentStatus) => void;
  onSendNow: (id: string) => void;
}) {
  const withSO = assignments.map((a) => ({
    asg: a,
    so:
      a.tipo === "ORDEN" && a.salesOrderId
        ? salesOrders.find((s) => s.id === a.salesOrderId)
        : undefined,
  }));

  const statusOptions: AssignmentStatus[] = [
    "CONFIRMADO",
    "EN_TRANSITO",
    "LISTO_ENTREGA",
    "ENTREGADO",
    "RETRASO",
    "INCIDENCIA",
  ];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h2 className="font-semibold text-sm">
            Asignaciones 
          </h2>
          <p className="text-xs text-gray-500">
            Registro de cómo se asignó el inventario a órdenes formales y
            ventas spot.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNewAssignmentSpot}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-slate-800 text-xs"
          >
            <Plus className="h-3 w-3" />
            Venta spot
          </button>
          <button
            onClick={onNewAssignmentOrden}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-600 text-white text-xs"
          >
            <Plus className="h-3 w-3" />
            Nueva asignación (orden)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 px-2">Asignación</th>
              <th className="px-2">Tipo</th>
              <th className="px-2">Fecha</th>
              <th className="px-2">Demand ID / Ref</th>
              <th className="px-2">Cliente</th>
              <th className="px-2">Customer PO</th>
              <th className="px-2">Estado</th>
              <th className="px-2">Notif.</th>
              <th className="px-2">Hito</th>
              <th className="px-2 text-right">Líneas</th>
              <th className="px-2 text-right">Cajas totales</th>
              <th className="px-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {withSO.map(({ asg, so }) => {
              const cajas = asg.items.reduce((s, it) => s + it.cajas, 0);
              const demandOrRef =
                asg.tipo === "ORDEN"
                  ? so?.demandId ?? "-"
                  : asg.spotRef || "SPOT";
              const customerPO =
                asg.tipo === "ORDEN" ? so?.customerPO ?? "-" : "-";

              return (
                <tr key={asg.id} className="border-b last:border-0">
                  <td className="py-2 px-2 font-mono whitespace-nowrap">
                    {asg.id}
                  </td>
                  <td className="px-2 whitespace-nowrap">{asg.tipo}</td>
                  <td className="px-2 whitespace-nowrap">
                    {asg.fecha}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    {demandOrRef}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    {asg.cliente}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    {customerPO}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-50 border">
                      {asg.status ?? "-"}
                    </span>
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    <label className="inline-flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={!!asg.notifyRule?.enabled}
                        onChange={(e) =>
                          onToggleNotify(asg.id, e.target.checked)
                        }
                      />
                      on
                    </label>
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    <select
                      value={asg.status ?? "CONFIRMADO"}
                      onChange={(e) =>
                        onStatusChange(
                          asg.id,
                          e.target.value as AssignmentStatus
                        )
                      }
                      className="border rounded px-2 py-0.5 text-[11px]"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 text-right">
                    {asg.items.length}
                  </td>
                  <td className="px-2 text-right font-semibold">
                    {cajas.toLocaleString()}
                  </td>
                  <td className="px-2 text-right">
                    <div className="flex gap-2 justify-end">
                      {asg.estado !== "ANULADA" && (
                        <button
                          onClick={() => onCancel(asg.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Anular / deshacer
                        </button>
                      )}
                      <button
                        onClick={() => onSendNow(asg.id)}
                        className="text-xs text-sky-700 hover:text-sky-900"
                      >
                        Enviar email ahora
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="text-center py-6 text-gray-400"
                >
                  Aún no hay asignaciones. Usa los botones de arriba para
                  crear una asignación o venta spot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {assignments.some((a) => (a.notificationsLog ?? []).length > 0) && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-gray-600 mb-2">
            Historial de notificaciones
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse min-w-[800px]">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 px-2">Asignación</th>
                  <th className="px-2">Fecha</th>
                  <th className="px-2">Hito</th>
                  <th className="px-2">Canal</th>
                  <th className="px-2">OK</th>
                  <th className="px-2">Detalle</th>
                  <th className="px-2">Payload</th>
                </tr>
              </thead>
              <tbody>
                {assignments.flatMap((a) =>
                  (a.notificationsLog ?? []).map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 px-2 font-mono whitespace-nowrap">
                        {a.id}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {new Date(l.at).toLocaleString()}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {l.milestone}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {l.channel}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {l.success ? "✔" : "✖"}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {l.detail ?? "-"}
                      </td>
                      <td className="px-2 whitespace-pre-wrap max-w-[480px]">
                        {l.payloadPreview}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientUpdateView({
  inventory,
  assignments,
  onNotifyConfirm,
  onMarkEnTransito,
}: {
  inventory: InventoryRow[];
  assignments: Assignment[];
  onNotifyConfirm: (rowId: string) => void;
  onMarkEnTransito: (rowId: string) => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border">
      <h2 className="font-semibold text-sm mb-2">Client update</h2>
      <p className="text-xs text-gray-500 mb-3">
        Resumen por PO y cliente para actualizaciones al cliente
        (emails / tracking). La creación de links se basa en las
        asignaciones que ya tienen tracking.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[900px]">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 px-2">PO</th>
              <th className="px-2">Cliente principal</th>
              <th className="px-2">Bodega</th>
              <th className="px-2">ETA</th>
              <th className="px-2">Status inv.</th>
              <th className="px-2 text-right">Cajas disp.</th>
              <th className="px-2">Links tracking</th>
              <th className="px-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((r) => {
              const related = assignments.filter((a) =>
                a.items.some((it) => it.inventoryId === r.id)
              );
              const links = related
                .map((a) => ({
                  id: a.id,
                  url: getTrackingLink(a),
                }))
                .filter((x) => !!x.url) as { id: string; url: string }[];

              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 px-2 font-mono whitespace-nowrap">
                    {r.po}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    {r.clientePrincipal}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    {r.bodega}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    {r.eta}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    <Badge text={r.status} />
                  </td>
                  <td className="px-2 text-right whitespace-nowrap font-semibold">
                    {r.cajasInv.toLocaleString()}
                  </td>
                  <td className="px-2">
                    {links.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {links.map((l) => (
                          <a
                            key={l.id}
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-sky-700 hover:underline"
                          >
                            {l.id}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        Sin asignaciones con tracking todavía
                      </span>
                    )}
                  </td>
                  <td className="px-2 text-right whitespace-nowrap">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => onNotifyConfirm(r.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-slate-800"
                      >
                        <Mail className="h-3 w-3" /> Confirmar
                      </button>
                      <button
                        onClick={() => onMarkEnTransito(r.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-800"
                      >
                        <AlertTriangle className="h-3 w-3" /> En tránsito
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {inventory.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-6 text-gray-400"
                >
                  No hay inventario para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500 mt-3">
        Los links de tracking se generan cuando creas asignaciones con{" "}
        <code>trackingToken</code>. Aquí puedes reutilizarlos para
        enviar updates al cliente.
      </p>
    </div>
  );
}

function CategoriesView({
  summary,
}: {
  summary: {
    key: string;
    sector: string;
    trim: string;
    size: string;
    cajas: number;
  }[];
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border">
      <h2 className="font-semibold text-sm mb-3">
        Categorías (Sector / Trim / Size)
      </h2>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 px-2">Sector</th>
                <th className="px-2">Trim</th>
                <th className="px-2">Size</th>
                <th className="px-2 text-right">
                  Cajas en inventario
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="py-2 px-2 whitespace-nowrap">
                    {r.sector}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    {r.trim}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    {r.size}
                  </td>
                  <td className="px-2 text-right font-semibold">
                    {r.cajas.toLocaleString()}
                  </td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-6 text-gray-400"
                  >
                    No hay inventario para agrupar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 rounded-2xl border p-4 flex flex-col">
          <h3 className="text-xs font-medium text-gray-600 mb-2">
            Distribución por categoría (cajas disponibles)
          </h3>
          <div className="flex-1 min-h-[220px]">
            {summary.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary}
                    dataKey="cajas"
                    nameKey="key"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {summary.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={
                          CATEGORY_COLORS[
                            index % CATEGORY_COLORS.length
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) =>
                      `${(value as number).toLocaleString()} cj`
                    }
                    labelFormatter={(label) => `Cat: ${label}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] text-gray-400">
                Sin datos de inventario para graficar.
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Similar a “Categories” en Glide: ves cuántas cajas hay
            disponibles por combinación Sector / Trim / Size.
          </p>
        </div>
      </div>
    </div>
  );
}

const TRACK_STEPS: { id: AssignmentStatus; label: string }[] = [
  { id: "CONFIRMADO", label: "Confirmado" },
  { id: "EN_TRANSITO", label: "En tránsito" },
  { id: "LISTO_ENTREGA", label: "Listo para entrega" },
  { id: "ENTREGADO", label: "Entregado" },
];

function statusIdx(s?: AssignmentStatus): number {
  if (!s) return 0;
  const i = TRACK_STEPS.findIndex((x) => x.id === s);
  return i === -1 ? 0 : i;
}

function formatDateTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function findRow(inv: InventoryRow[], item: OrderItem) {
  return inv.find((r) => r.id === item.inventoryId);
}

function ClientTrackingView({
  assignment,
  inventory,
}: {
  assignment: Assignment;
  inventory: InventoryRow[];
}) {
  const currentStatus: AssignmentStatus =
    assignment.status ?? "CONFIRMADO";
  const currentIdx = statusIdx(currentStatus);

  const firstRow =
    assignment.items.length > 0
      ? findRow(inventory, assignment.items[0])
      : undefined;

  const isDelayed = currentStatus === "RETRASO";
  const hasIssue = currentStatus === "INCIDENCIA";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-300">
              Tracking de pedido
            </div>
            <div className="text-lg font-semibold">
              {assignment.cliente}
            </div>
            <div className="text-[11px] text-slate-300 mt-1">
              Ref: {assignment.id} • Fecha: {assignment.fecha}
            </div>
          </div>
          <div className="text-right text-xs text-slate-300">
            Estado actual:
            <div
              className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
                currentStatus === "ENTREGADO"
                  ? "bg-emerald-100 text-emerald-800"
                  : currentStatus === "EN_TRANSITO"
                  ? "bg-sky-100 text-sky-800"
                  : currentStatus === "LISTO_ENTREGA"
                  ? "bg-amber-100 text-amber-800"
                  : currentStatus === "CONFIRMADO"
                  ? "bg-slate-100 text-slate-800"
                  : currentStatus === "RETRASO"
                  ? "bg-red-100 text-red-800"
                  : "bg-orange-100 text-orange-800"
              }`}
            >
              {currentStatus.replace("_", " ")}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-b bg-slate-50">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-4 right-4 h-0.5 bg-slate-200 top-1/2 -translate-y-1/2" />
            <div
              className="absolute left-4 h-0.5 bg-sky-500 top-1/2 -translate-y-1/2 transition-all"
              style={{
                right: `${
                  100 -
                  (currentIdx / (TRACK_STEPS.length - 1)) * 100
                }%`,
              }}
            />
            {TRACK_STEPS.map((step, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <div
                  key={step.id}
                  className="relative z-10 flex flex-col items-center w-1/4"
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border ${
                      done
                        ? "bg-sky-600 text-white border-sky-600"
                        : active
                        ? "bg-white text-sky-700 border-sky-600"
                        : "bg-white text-slate-400 border-slate-300"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="mt-2 text-[11px] text-center text-slate-600">
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>

          {(isDelayed || hasIssue) && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {isDelayed && (
                <div>
                  Se ha reportado un <strong>retraso</strong> en este
                  envío.
                </div>
              )}
              {hasIssue && (
                <div>
                  Existe una <strong>incidencia</strong> asociada a este
                  envío.
                </div>
              )}
              <div className="mt-1 text-[11px]">
                Tu ejecutivo de cuenta se pondrá en contacto contigo
                con más detalles.
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 grid sm:grid-cols-3 gap-3 text-[11px] border-b bg-white">
          <div>
            <div className="text-slate-500">Cliente</div>
            <div className="font-semibold text-slate-900">
              {assignment.cliente}
            </div>
          </div>
          <div>
            <div className="text-slate-500">PO(s)</div>
            <div className="font-mono text-slate-900">
              {assignment.items
                .map((i) => i.po)
                .filter(
                  (v, idx, arr) => arr.indexOf(v) === idx
                )
                .join(", ")}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Ubicación destino</div>
            <div className="text-slate-900">
              {firstRow?.ubicacion ?? "-"}
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">
            Detalle del lote
          </h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[11px] border-collapse min-w-[600px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 px-2">PO</th>
                  <th className="px-2">Material</th>
                  <th className="px-2 text-right">Cajas</th>
                  <th className="px-2">Calibre</th>
                  <th className="px-2">ETA</th>
                  <th className="px-2">AWB</th>
                  <th className="px-2">Bodega</th>
                </tr>
              </thead>
              <tbody>
                {assignment.items.map((it, idx) => {
                  const row = findRow(inventory, it);
                  return (
                    <tr
                      key={idx}
                      className="border-b last:border-0"
                    >
                      <td className="py-2 px-2 font-mono whitespace-nowrap">
                        {it.po}
                      </td>
                      <td className="px-2 font-mono whitespace-nowrap">
                        {it.material}
                      </td>
                      <td className="px-2 text-right font-semibold">
                        {it.cajas.toLocaleString()}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {row?.size ?? "-"}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {row?.eta ?? "-"}
                      </td>
                      <td className="px-2 font-mono whitespace-nowrap">
                        {row?.awb ?? "-"}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        {row?.bodega ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-slate-50">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">
            Historial de movimientos
          </h3>
          {assignment.statusHistory &&
          assignment.statusHistory.length > 0 ? (
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {assignment.statusHistory.map((h, idx) => (
                <li
                  key={idx}
                  className="text-[11px] text-slate-700 flex items-start gap-2"
                >
                  <span className="mt-[3px] inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>
                    <span className="font-semibold">
                      {h.status.replace("_", " ")}
                    </span>{" "}
                    <span className="text-slate-500">
                      • {formatDateTime(h.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[11px] text-slate-500">
              Aún no hay más movimientos registrados para este envío.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
