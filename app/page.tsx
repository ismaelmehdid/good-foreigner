import Dashboard from "@/components/Dashboard";

// Read GOOGLE_CLIENT_ID at request time (Cloud Run env), not at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return <Dashboard googleClientId={process.env.GOOGLE_CLIENT_ID ?? null} />;
}
