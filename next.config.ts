import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Cloud Run container image.
  output: "standalone",
  // Firestore loads protobuf files from disk and web-push uses Node crypto; keep both out of the bundle.
  serverExternalPackages: ["@google-cloud/firestore", "web-push"],
};

export default nextConfig;
