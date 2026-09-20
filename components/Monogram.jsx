const GRADIENTS = [
  "from-chili to-chili-dark",
  "from-turmeric to-chili",
  "from-herb to-[#2a4a34]",
  "from-clay to-ink",
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export default function Monogram({ name = "", size = "md", className = "" }) {
  const letter = (name.trim()[0] || "?").toUpperCase();
  const gradient = GRADIENTS[hashString(name) % GRADIENTS.length];
  const sizeClasses = {
    sm: "w-11 h-11 text-sm rounded-lg",
    md: "w-16 h-16 text-xl rounded-xl",
    lg: "w-full h-full text-5xl rounded-none",
  };

  return (
    <div
      className={`bg-gradient-to-br ${gradient} text-white font-display font-bold flex items-center justify-center flex-shrink-0 ${sizeClasses[size]} ${className}`}
    >
      {letter}
    </div>
  );
}
