import React, { useEffect, useRef, useState } from "react";
import "../styles/SpinningWheel.css";

interface SpinningWheelProps {
  onComplete: (category: string) => void;
}

const categories = [
  "white socks",
  "longest hair",
  "glasses",
  "tallest",
  "shortest",
  "birthday",
  "brown shoes",
  "tattoos",
  "earrings",
  "first drink",
];

const SpinningWheel: React.FC<SpinningWheelProps> = ({ onComplete }) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const index = Math.floor(Math.random() * categories.length);
    const final = 1080 + (360 / categories.length) * index;
    setRotation(final);
    setTimeout(() => {
      setResult(categories[index]);
      onComplete(categories[index]);
    }, 5000);
  }, [onComplete]);

  return (
    <div className="wheel-container">
      <div
        ref={wheelRef}
        className="wheel-spin"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 730 730"
          className="wheel-svg"
        >
          <g className="wheel">
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
              <path id="_1" d="M365,365V35.9A328.1,328.1,0,0,0,200.5,80Z" />
              <path id="_2" d="M365,365,529.5,80A328.1,328.1,0,0,0,365,35.9Z" />
              <path id="_3" d="M365,365,650,200.5A328.5,328.5,0,0,0,529.5,80Z" />
              <path id="_4" d="M365,365H694.1A328.1,328.1,0,0,0,650,200.5Z" />
              <path id="_5" d="M365,365,650,529.5A328.1,328.1,0,0,0,694.1,365Z" />
              <path id="_6" d="M365,365,529.5,650A328.5,328.5,0,0,0,650,529.5Z" />
              <path id="_7" d="M365,365V694.1A328.1,328.1,0,0,0,529.5,650Z" />
              <path id="_8" d="M365,365,200.5,650A328.1,328.1,0,0,0,365,694.1Z" />
              <path id="_9" d="M365,365,80,529.5A328.5,328.5,0,0,0,200.5,650Z" />
              <path id="_10" d="M365,365H35.9A328.1,328.1,0,0,0,80,529.5Z" />
            </g>
            <g className="middle">
              <circle cx="365" cy="365" r="54.5" fill="#fff" />
              <circle id="middle-3" cx="365" cy="365" r="11.6" fill="#ccc" />
            </g>
          </g>
        </svg>
      </div>
      {result && <div className="wheel-result">{result}</div>}
    </div>
  );
};

export default SpinningWheel;
