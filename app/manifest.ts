import type { MetadataRoute } from "next";

// Teal brand (Tailwind teal-700) on the warm stone background used in globals.css.
const THEME = "#0f766e";
const BACKGROUND = "#f6f6f4";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Good Foreigner",
    short_name: "Good Foreigner",
    description: "Warns US visitors before an email or plan puts their B-1/B-2 or ESTA status at risk.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: THEME,
    background_color: BACKGROUND,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
