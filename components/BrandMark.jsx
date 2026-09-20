import { UtensilsCrossed } from "lucide-react";

export default function BrandMark({ size = 32, className = "" }) {
  const boxSize = Math.round(size * 1.6);
  return (
    <div
      className={`bg-gradient-to-br from-chili to-chili-dark rounded-xl flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: boxSize, height: boxSize }}
    >
      <UtensilsCrossed size={size * 0.55} className="text-white" strokeWidth={2} />
    </div>
  );
}
