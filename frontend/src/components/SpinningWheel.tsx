import React, { useEffect, useRef, useState } from "react";
import "../styles/SpinningWheel.css";

interface Props {
  onComplete: (category: string) => void;
}

const categories = [
  "White socks",
  "Longest hair",
  "Glasses",
  "Tallest",
  "Red shirt",
  "Oldest",
  "Youngest",
  "Birthday closest",
  "Most pets",
  "Loudest laugh",
];

const SpinningWheel: React.FC<Props> = ({ onComplete }) => {
  const wheelRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const deg = Math.floor(Math.random() * 720) + 360;
    const wheel = wheelRef.current;
    if (wheel) {
      wheel.style.transition = "transform 4s cubic-bezier(0.33, 1, 0.68, 1)";
      wheel.style.transform = `rotate(${deg}deg)`;
    }
    const idx =
      categories.length -
      1 -
      Math.floor(((deg % 360) / 360) * categories.length);
    const t = setTimeout(() => {
      const cat = categories[idx];
      setSelected(cat);
      onComplete(cat);
    }, 4000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="spinning-wheel">
      <svg
        ref={wheelRef}
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
            <path
              id="_1"
              d="M365,365V35.9A328.1,328.1,0,0,0,200.5,80Z"
              fill="#ba4d4e"
            />
            <path
              id="_2"
              d="M365,365,529.5,80A328.1,328.1,0,0,0,365,35.9Z"
              fill="#1592e8"
            />
            <path
              id="_3"
              d="M365,365,650,200.5A328.5,328.5,0,0,0,529.5,80Z"
              fill="#14c187"
            />
            <path
              id="_4"
              d="M365,365H694.1A328.1,328.1,0,0,0,650,200.5Z"
              fill="#fc7800"
            />
            <path
              id="_5"
              d="M365,365,650,529.5A328.1,328.1,0,0,0,694.1,365Z"
              fill="#14c187"
            />
            <path
              id="_6"
              d="M365,365,529.5,650A328.5,328.5,0,0,0,650,529.5Z"
              fill="#1592e8"
            />
            <path
              id="_7"
              d="M365,365V694.1A328.1,328.1,0,0,0,529.5,650Z"
              fill="#ba4d4e"
            />
            <path
              id="_8"
              d="M365,365,200.5,650A328.1,328.1,0,0,0,365,694.1Z"
              fill="#1592e8"
            />
            <path
              id="_9"
              d="M365,365,80,529.5A328.5,328.5,0,0,0,200.5,650Z"
              fill="#14c187"
            />
            <path
              id="_10"
              d="M365,365H35.9A328.1,328.1,0,0,0,80,529.5Z"
              fill="#fc7800"
            />
            <path
              id="_11"
              d="M365,365,80,200.5A328.1,328.1,0,0,0,35.9,365Z"
              fill="#14c187"
            />
            <path
              id="_12"
              d="M365,365,200.5,80A328.5,328.5,0,0,0,80,200.5Z"
              fill="#1592e8"
            />
          </g>
          <g className="middle">
            <g id="shadow-1" opacity="0.2">
              <circle cx="368.5" cy="368.5" r="54.5" />
            </g>
            <g className="wheelMiddle">
              <circle cx="365" cy="365" r="54.5" fill="#fff" />
            </g>
            <circle id="middle-3" cx="365" cy="365" r="11.6" fill="#ccc" />
          </g>
        </g>
      </svg>
      {selected && <div className="wheel-result">{selected}</div>}
    </div>
  );
};

export default SpinningWheel;
