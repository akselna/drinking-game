import React, { useEffect, useRef } from "react";

interface LuckyWheelProps {
  categories: string[];
  onFinish: (cat: string) => void;
}

const LuckyWheel: React.FC<LuckyWheelProps> = ({ categories, onFinish }) => {
  const wheelRef = useRef<SVGGElement>(null);

  // Define colors for wheel sectors
  const colors = [
    "#ba4d4e",
    "#1592e8",
    "#14c187",
    "#fc7800",
    "#14c187",
    "#1592e8",
    "#ba4d4e",
    "#1592e8",
    "#14c187",
    "#fc7800",
    "#14c187",
    "#1592e8",
  ];

  // Function to create SVG path for each sector
  const createSectorPath = (
    index: number,
    total: number,
    radius: number = 300
  ) => {
    const centerX = 365;
    const centerY = 365;
    const angleStep = (2 * Math.PI) / total;
    const startAngle = index * angleStep - Math.PI / 2; // Start from top
    const endAngle = (index + 1) * angleStep - Math.PI / 2;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = angleStep > Math.PI ? 1 : 0;

    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  // Function to get text position for each sector
  const getTextPosition = (
    index: number,
    total: number,
    radius: number = 200
  ) => {
    const centerX = 365;
    const centerY = 365;
    const angleStep = (2 * Math.PI) / total;
    const angle = index * angleStep + angleStep / 2 - Math.PI / 2; // Middle of sector, starting from top

    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle) + 5, // Slight offset for better text positioning
    };
  };

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    // Reset the wheel rotation first
    wheel.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";

    // Force a reflow to ensure the reset takes effect
    wheel.getBoundingClientRect();

    // Start spinning after a brief delay
    setTimeout(() => {
      const deg = 360 + Math.floor(Math.random() * 720);
      wheel.style.transition = "transform 5s cubic-bezier(0.2, 0, 0.3, 1)";
      wheel.style.transform = `rotate(${deg}deg)`;

      const timeout = setTimeout(() => {
        const finalDeg = ((deg % 360) + 360) % 360;
        const slice = 360 / categories.length;
        const index =
          Math.floor(categories.length - finalDeg / slice) % categories.length;
        onFinish(categories[index]);
      }, 7000);

      return () => clearTimeout(timeout);
    }, 500);
  }, [categories, onFinish]);

  return (
    <div style={{ margin: "40px auto", width: "80%", textAlign: "center" }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 730 730"
        style={{ width: "100%", maxWidth: "500px" }}
      >
        {/* Wheel sectors */}
        <g
          className="wheel"
          ref={wheelRef}
          style={{ transformOrigin: "50% 50%" }}
        >
          {/* Draw sectors */}
          {categories.map((category, index) => {
            const textPos = getTextPosition(index, categories.length);
            return (
              <g key={index}>
                <path
                  d={createSectorPath(index, categories.length)}
                  fill={colors[index % colors.length]}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <text
                  x={textPos.x}
                  y={textPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize="16"
                  fontWeight="bold"
                  fontFamily="Arial, sans-serif"
                  style={{ textShadow: "1px 1px 1px rgba(0,0,0,0.5)" }}
                >
                  {category}
                </text>
              </g>
            );
          })}

          {/* Center circle */}
          <circle
            cx="365"
            cy="365"
            r="30"
            fill="#fff"
            stroke="#333"
            strokeWidth="3"
          />
          <circle cx="365" cy="365" r="15" fill="#333" />
        </g>

        {/* Pointer/indicator */}
        <g className="pointer">
          <polygon
            points="365,20 380,50 350,50"
            fill="#fff"
            stroke="#333"
            strokeWidth="2"
            style={{ filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))" }}
          />
        </g>

        {/* Outer frame */}
        <circle
          cx="365"
          cy="365"
          r="347"
          fill="none"
          stroke="#333"
          strokeWidth="6"
        />
      </svg>
    </div>
  );
};

export default LuckyWheel;
