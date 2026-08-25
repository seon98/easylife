import type { NextConfig } from "next";
// 브라우저는 같은 출처의 /api만 호출하고 Next.js가 로컬 FastAPI로 전달한다.
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};
export default nextConfig;
