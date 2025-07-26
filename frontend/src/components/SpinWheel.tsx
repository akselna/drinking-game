import React, { useEffect, useRef } from "react";
import "../styles/SpinWheel.css";

interface SpinWheelProps {
  categories: string[];
  onFinish: (category: string) => void;
}

const SpinWheel: React.FC<SpinWheelProps> = ({ categories, onFinish }) => {
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    const segAngle = 360 / categories.length;
    const index = Math.floor(Math.random() * categories.length);
    const finalRotation = 1080 + index * segAngle + segAngle / 2;
    wheel.style.transition = "transform 5s cubic-bezier(0.33,1,0.68,1)";
    wheel.style.transform = `rotate(-${finalRotation}deg)`;

    const timer = setTimeout(() => {
      onFinish(categories[index]);
    }, 5200);
    return () => clearTimeout(timer);
  }, [categories, onFinish]);

  return (
    <div className="wheel-wrapper">
      <div className="wheel" ref={wheelRef}>
        <svg viewBox="0 0 730 730">
          <g className="wheel-group">
            <circle className="frame" cx="365" cy="365" r="347.6" />
            <g className="sectors">
              {categories.map((_, i) => (
                <path
                  key={i}
                  d={`M365,365 L365,35 A328,328 0 0,1 ${365 +
                    328 * Math.cos((2 * Math.PI * (i + 1)) / categories.length)},${365 +
                    328 * Math.sin((2 * Math.PI * (i + 1)) / categories.length)} Z`}
                  className={`sector sector-${i}`}
                />
              ))}
            </g>
          </g>
        </svg>
        {categories.map((c, i) => (
          <div
            key={c}
            className="label"
            style={{
              transform: `rotate(${(360 / categories.length) * i}deg) translateY(-160px) rotate(-${
                (360 / categories.length) * i
              }deg)`
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div className="pointer" />
    </div>
  );
};

export default SpinWheel;
