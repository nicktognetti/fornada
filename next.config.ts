import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Upload de foto do produto (Atendimento) via Server Action — padrão é 1 MB.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
