// NOTE: Production-ready, mobile-first dashboard
// Backend-compatible with final Node/MQTT/Mongo architecture
// TailwindCSS + Recharts required

import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  Droplets,
  Thermometer,
  Wind,
  Power,
  AlertCircle,
  CheckCircle2,
  Clock,
  Tractor,
  CloudHail,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

/* ================= CONFIG ================= */
const BACKEND_URL = "http://localhost:5000";

/* ================= SOCKET SINGLETON ================= */
let socket;
const getSocket = () => {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
  }
  return socket;
};

/* ================= DASHBOARD ================= */
export default function Dashboard() {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState({
    soil_raw: 0,
    soil_pct: 0,
    soil_temp: null,
    air_temp: null,
    humidity: null,
    pump_on: false,
    manual: false,
    pump_life: 0,
    ts: null,
  });

  const [miniHistory, setMiniHistory] = useState([]);
  const [charts24h, setCharts24h] = useState([]);
  const [loadingCharts, setLoadingCharts] = useState(true);
  // "air_temp" | "humidity" | "soil_pct" | null

  /* ================= SOCKET ================= */
  useEffect(() => {
    const s = getSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onTelemetry = (payload) => {
      console.log("📡 TELEMETRY RECEIVED", payload);

      setTelemetry({
        ...payload,
        ts: Date.now(), // local receive time (optional)
      });

      setMiniHistory((prev) => [...prev, payload.soil_pct ?? 0].slice(-24));
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("telemetry:init", onTelemetry);
    s.on("telemetry:update", onTelemetry);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("telemetry:init", onTelemetry);
      s.off("telemetry:update", onTelemetry);
    };
  }, []);

  /* ================= CHART DATA ================= */
  useEffect(() => {
    const loadCharts = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/charts/24h`);
        const data = await res.json();

        setCharts24h(
          data.map((d) => ({
            ...d,
            ts: new Date(d.timestamp).getTime(),
          })),
        );
      } catch (e) {
        console.error("Chart fetch failed", e);
      } finally {
        setLoadingCharts(false);
      }
    };

    loadCharts();
  }, []);

  /* ================= DERIVED STATE ================= */
  const pumpLabel = telemetry.pump_on
    ? "ON"
    : telemetry.manual
      ? "FORCED OFF"
      : "OFF";

  const pumpStyle = useMemo(() => {
    if (pumpLabel === "ON")
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (pumpLabel === "FORCED OFF")
      return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  }, [pumpLabel]);

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <Tractor className="text-white" size={18} />
            </div>
            <div>
              <h1 className="font-bold leading-none">AgriSmart</h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
                <span className="text-[10px] uppercase text-slate-400 font-bold">
                  {connected ? "Live" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-full border">
            <Clock size={14} />
            <span className="text-xs font-mono">
              {telemetry.ts
                ? new Date(telemetry.ts).toLocaleTimeString()
                : "--:--"}
            </span>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 grid gap-4">
        {/* CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={<Droplets />} title="Soil Moisture">
            <div className="flex justify-between items-end">
              <div className="text-5xl font-black">
                {telemetry.soil_pct}
                <span className="text-xl">%</span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                RAW {telemetry.soil_raw}
              </div>
            </div>
            <MiniBarGraph values={miniHistory} />
          </Card>

          <Card icon={<Thermometer />} title="Environment">
            <Stat
              label="Air Temperature"
              value={`${telemetry.air_temp ?? "--"} °C`}
            />
            <Stat label="Humidity" value={`${telemetry.humidity ?? "--"} %`} />
            <Stat
              label="Soil Temperature"
              value={`${telemetry.soil_temp ?? "--"} °C`}
            />
          </Card>

          <Card icon={<Power />} title="Irrigation Pump">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold">Relay Controlled</p>
                <p className="text-xs text-slate-400">
                  Mode: {telemetry.manual ? "Manual" : "Auto"}
                </p>
              </div>

              <div
                className={`px-4 py-2 rounded-xl border font-bold flex items-center gap-1 ${pumpStyle}`}
              >
                {pumpLabel === "ON" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                {pumpLabel}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Lifetime: {telemetry.pump_life} min
            </div>
          </Card>
        </section>

        {/* CHART */}
        <Card icon={<Droplets />} title="Soil Moisture · Last 24h">
          <div className="h-56 sm:h-64 lg:h-72">
            {loadingCharts ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts24h}>
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={["auto", "auto"]}
                    hide
                  />

                  <YAxis hide />
                  <Tooltip
                    labelFormatter={(ts) =>
                      new Date(ts).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                  />

                  <Line
                    dataKey="soil_pct"
                    name="Soil Moisture"
                    stroke="#22c55e"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card icon={<Thermometer />} title="Soil Temperature · Last 24h">
          <div className="h-56 sm:h-64 lg:h-72">
            {loadingCharts ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts24h}>
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={["auto", "auto"]}
                    hide
                  />

                  <YAxis hide />
                  <Tooltip
                    labelFormatter={(ts) =>
                      new Date(ts).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                  />

                  <Line
                    dataKey="soil_temp"
                    name="Soil Temperature"
                    stroke="#f97316"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card icon={<CloudHail />} title="Humidity · Last 24h">
          <div className="h-56 sm:h-64 lg:h-72">
            {loadingCharts ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts24h}>
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={["auto", "auto"]}
                    hide
                  />

                  <YAxis hide />
                  <Tooltip
                    labelFormatter={(ts) =>
                      new Date(ts).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                  />

                  <Line
                    dataKey="humidity"
                    name="Humidity"
                    stroke="#0ea5e9"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </main>

      <footer className="text-center text-[10px] text-slate-400 py-6">
        SmartFarm IoT · Node-01
      </footer>
    </div>
  );
}

/* ================= UI HELPERS ================= */
function Card({ icon, title, children }) {
  return (
    <div className="bg-white rounded-3xl p-5 border shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-slate-100 rounded-xl">{icon}</div>
        <h2 className="text-xs uppercase font-bold text-slate-400">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function MiniBarGraph({ values }) {
  return (
    <div className="flex items-end gap-1 h-8 sm:h-10">
      {values.map((v, i) => (
        <div
          key={i}
          className="bg-emerald-400/40 flex-1 rounded"
          style={{ height: `${Math.max(v, 6)}%` }}
        />
      ))}
    </div>
  );
}
