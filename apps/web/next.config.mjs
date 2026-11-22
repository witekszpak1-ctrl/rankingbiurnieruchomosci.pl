/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Czcionki okładek bloga czytane z dysku w route (assets/fonts) muszą trafić do paczki funkcji na Vercelu.
  outputFileTracingIncludes: { "/blog/okladka/[file]": ["./assets/fonts/**"] },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
