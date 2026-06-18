import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite que el dev server acepte requests del túnel ngrok (pruebas en MiniPay).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok-free.dev"],
};

export default nextConfig;
