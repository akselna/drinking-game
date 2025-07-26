import React, { useEffect, useRef } from "react";
import "../styles/LuckyWheel.css";

interface LuckyWheelProps {
  categories: string[];
  onFinish: (cat: string) => void;
}

const LuckyWheel: React.FC<LuckyWheelProps> = ({ categories, onFinish }) => {
  const wheelRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const deg = 360 + Math.floor(Math.random() * 720);
    wheel.style.transition = "transform 5s cubic-bezier(0.2, 0, 0.3, 1)";
    wheel.style.transform = `rotate(${deg}deg)`;
    const timeout = setTimeout(() => {
      const finalDeg = ((deg % 360) + 360) % 360;
      const slice = 360 / categories.length;
      const index = Math.floor((categories.length - finalDeg / slice)) % categories.length;
      onFinish(categories[index]);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [categories, onFinish]);

  return (
    <div className="luckywheel-container">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 730 730"
        className="luckywheel-svg"
      >
        <g className="wheel" ref={wheelRef}>
          <circle className="frame" cx="365" cy="365" r="347.6" />
          <g className="sticks">
            <rect x="360.4" width="9.3" height="24.33" rx="4" ry="4" />
            <rect
              x="352.8"
              y="713.2"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(1082.8 352.8) rotate(90)"
            />
            <rect
              x="176.4"
              y="54.8"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(145.8 -133.6) rotate(60)"
            />
            <rect
              x="529.2"
              y="665.9"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(851.4 -133.6) rotate(60)"
            />
            <rect
              x="47.3"
              y="183.9"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(102.3 -4.5) rotate(30)"
            />
            <rect
              x="658.4"
              y="536.8"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(360.5 -262.7) rotate(30)"
            />
            <rect y="360.4" width="24.3" height="9.27" rx="4" ry="4" />
            <rect x="705.7" y="360.4" width="24.3" height="9.27" rx="4" ry="4" />
            <rect
              x="47.3"
              y="536.8"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(-262.7 102.3) rotate(-30)"
            />
            <rect
              x="658.4"
              y="183.9"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(-4.5 360.5) rotate(-30)"
            />
            <rect
              x="176.4"
              y="665.9"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(-486.4 498.6) rotate(-60)"
            />
            <rect
              x="529.2"
              y="54.8"
              width="24.3"
              height="9.27"
              rx="4"
              ry="4"
              transform="translate(219.2 498.6) rotate(-60)"
            />
          </g>
          <g className="sectors">
            {categories.map((c, i) => (
              <g key={i}>
                <path id={`s${i}`} d="" />
                <text className="sector-label" x="365" y="365">
                  {c}
                </text>
              </g>
            ))}
          </g>
          <g className="middle">
            <circle cx="365" cy="365" r="54.5" fill="#fff" />
            <circle cx="365" cy="365" r="11.6" fill="#ccc" />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default LuckyWheel;
