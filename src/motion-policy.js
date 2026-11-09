export function motionPolicy(enabled, style, systemReduced) {
  if (!enabled) return "off";
  if (style === "gentle" || (style !== "full" && systemReduced))
    return "reduced";
  return "on";
}
export const easeOut = [0.23, 1, 0.32, 1];
export const easeInOut = [0.77, 0, 0.175, 1];
export const cssEaseOut = "cubic-bezier(0.23,1,0.32,1)";
