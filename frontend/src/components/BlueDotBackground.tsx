// src/components/BlueDotBackground.tsx
import React, { useEffect, ReactNode } from "react";
import "../styles/BlueDotBackground.css"; // We'll create this CSS file next

interface BlueDotBackgroundProps {
  children: ReactNode;
  intensity?: string;
}

const BlueDotBackground: React.FC<BlueDotBackgroundProps> = ({ children }) => {
  useEffect(() => {
    const dotsGrid = document.getElementById("dotsGrid");
    if (dotsGrid && dotsGrid.children.length === 0) {
      const numberOfDots = 120; // 15 columns × 8 rows
      for (let i = 0; i < numberOfDots; i++) {
        const dot = document.createElement("div");
        dot.className = "dot";
        dot.style.setProperty("--i", i.toString());
        dotsGrid.appendChild(dot);
      }
    }
  }, []);

  return (
    <div className="background-root">
      <div className="background-container">
        <div className="ambient-light"></div>
        <div className="dots-grid" id="dotsGrid"></div>
      </div>
      <div className="content-overlay">{children}</div>
    </div>
  );
};

export default BlueDotBackground;
