import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer usa pdfkit por debajo, que carga las fuentes
  // estándar (Helvetica, etc.) con fs en tiempo de ejecución, no con un
  // require() estático — el file tracing de Next.js no lo detecta solo y
  // las deja fuera del paquete de la función serverless en Vercel, lo que
  // rompe la generación de PDF con "Cannot find module
  // .../pdfkit/js/standard-fonts/Helvetica.cjs". Se incluyen a mano en
  // todas las rutas porque la generación se dispara tanto desde
  // /api/prefacturas/:id/pdf como desde el Server Action de enviar correo
  // (genera el PDF al vuelo si todavía no existe uno vigente).
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/standard-fonts/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
