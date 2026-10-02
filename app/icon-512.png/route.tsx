import { renderIcon } from "@/app/_icon/renderIcon";

// Stable URL /icon-512.png for the web manifest (install splash / store-size icon).
export const dynamic = "force-static";

export function GET() {
  return renderIcon(512, { rounded: true });
}
