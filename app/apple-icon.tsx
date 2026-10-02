import { renderIcon } from "@/app/_icon/renderIcon";

// iOS Home Screen icon. Full-bleed square: iOS applies its own rounded mask
// (transparent corners would render black).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderIcon(size.width, { rounded: false });
}
