import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "https://app.apidoctorrecetas.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;
