import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Cloud Run container image.
  output: "standalone",
  // Firestore loads protobuf files from disk and web-push uses Node crypto; keep both out of the bundle.
  serverExternalPackages: ["@google-cloud/firestore", "web-push"],
  // Firestore and google-gax read their .proto/.json descriptors from disk at runtime, which the
  // standalone file tracer cannot see; copy them into the bundle for the real-time routes.
  outputFileTracingIncludes: {
    "/api/realtime/**": [
      "./node_modules/@google-cloud/firestore/build/protos/**/*",
      "./node_modules/google-gax/build/protos/**/*",
    ],
    "/api/gmail/push": [
      "./node_modules/@google-cloud/firestore/build/protos/**/*",
      "./node_modules/google-gax/build/protos/**/*",
    ],
  },
};

export default nextConfig;
