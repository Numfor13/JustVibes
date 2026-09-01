import "./Equalizer.css";

const BAR_COUNT = { sm: 4, lg: 5 };

export default function Equalizer({ active = false, size = "sm" }) {
  const bars = Array.from({ length: BAR_COUNT[size] });

  return (
    <span
      className={`eq eq--${size} ${active ? "eq--active" : ""}`}
      aria-hidden="true"
    >
      {bars.map((_, i) => (
        <span key={i} className="eq__bar" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}
