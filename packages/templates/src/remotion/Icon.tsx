import { icons, type LucideIcon } from "lucide-react";

const registry = icons as Record<string, LucideIcon>;

/** Lucide icon by kebab-case name ("credit-card"). Unknown names render a plain circle. */
export const Icon: React.FC<{ name?: string; size: number; color: string; strokeWidth?: number }> = ({
  name,
  size,
  color,
  strokeWidth = 2.2,
}) => {
  const key = (name ?? "circle")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  const Component = registry[key] ?? registry.Circle;
  if (!Component) return null;
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
};
