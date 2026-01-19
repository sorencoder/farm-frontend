import { io } from "socket.io-client";

const socket = io("https://farm-dv9a.onrender.com", {
  transports: ["polling", "websocket"],
  timeout: 5000,
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
});

// socket.on("telemetry:init", (data) => {
//   console.log("📦 INIT", data);
// });

socket.on("telemetry:update", (data) => {
  console.log("🔁 UPDATE", data);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("🚨 Connect error:", err.message);
});
