import { renderIcon } from "@/app/_icon/renderIcon";

// Stable URL /icon-192.png for the web manifest and notification icons.
export const dynamic = "force-static";

export function GET() {
  return renderIcon(192, { rounded: true });
}
