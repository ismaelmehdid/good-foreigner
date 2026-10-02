import Dashboard from "@/components/Dashboard";

// Read config at request time (Cloud Run env), not at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <Dashboard
      googleClientId={process.env.GOOGLE_CLIENT_ID ?? null}
      vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
      realtimeEnabled={process.env.REALTIME_ENABLED === "true"}
    />
  );
}
