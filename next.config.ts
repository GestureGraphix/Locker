import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SQL_AUTH: process.env.NEXT_PUBLIC_SQL_AUTH ?? "0",
  },
};

export default nextConfig;
