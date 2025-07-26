import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import "../styles/Skjenkehjulet.css";
import LuckyWheel from "./LuckyWheel";
import "../styles/BeerAnimation.css"; // Importer stiler

const matterUrl =
  "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js";

declare global {
  interface Window {
    Matter: any;
  }
}

export interface SkjenkehjuletHandle {
  backToConfig: () => void;
}

const Skjenkehjulet = forwardRef<SkjenkehjuletHandle>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<
    | "config"
    | "countdown"
    | "playing"
    | "result"
    | "wheel"
    | "combined-result"
    | "refilling"
  >("config");
  const [countdownValue, setCountdownValue] = useState(10);
  const [rounds, setRounds] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [displayCount, setDisplayCount] = useState(10);
  const [finalScore, setFinalScore] = useState<string | null>(null);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [wheelCategory, setWheelCategory] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(
    "Mild" as "Mild" | "Medium" | "Fyllehund" | "Grøfta"
  );
  const boardFuncs = useRef<{ drop: () => void; reset: () => void } | null>(
    null
  );
  const [fadingCategories, setFadingCategories] = useState<any[]>([]);

  // State-variabler KUN for å styre selve ølanimasjonen
  const [beerHeight, setBeerHeight] = useState("0%");
  const [isGlassVisible, setIsGlassVisible] = useState(false);
  const [isRefilling, setIsRefilling] = useState(false);

  const dangerActive =
    finalScore === "CHUG" &&
    (phase === "result" || phase === "wheel" || phase === "combined-result");

  const backToConfig = () => {
    setPhase("config");
    setCurrentRound(1);
    setFinalScore(null);
    setWheelCategory(null);
    if (boardFuncs.current) {
      boardFuncs.current.reset();
    }
    setIsGlassVisible(false);
    // Clear the container to allow re-initialization
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  };

  useImperativeHandle(ref, () => ({
    backToConfig,
  }));

  // Laster inn Matter.js
  useEffect(() => {
    if (window.Matter) {
      setReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = matterUrl;
    script.async = true;
    script.onload = () => setReady(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Fading categories
  useEffect(() => {
    if (phase !== "countdown") {
      setFadingCategories([]);
      return;
    }
    const categories = [
      "Hvite sokker",
      "Lengst hår",
      "Briller",
      "Høyest",
      "Rød skjorte",
      "Eldst",
      "Yngst",
      "Brune sko",
      "Øredobber",
      "Blå øyne",
    ];
    const animationInterval = setInterval(() => {
      const newCategory = {
        key: Date.now(),
        text: categories[Math.floor(Math.random() * categories.length)],
        style: {
          top: `${Math.random() * 80 + 10}%`,
          left: `${Math.random() * 80 + 10}%`,
          animation: `fadeInOut ${2 + Math.random() * 2}s ease-in-out`,
        },
      };
      setFadingCategories((prev) => [...prev, newCategory]);
      setTimeout(() => {
        setFadingCategories((prev) =>
          prev.filter((c) => c.key !== newCategory.key)
        );
      }, 4000);
    }, 1500);
    return () => clearInterval(animationInterval);
  }, [phase]);

  // Main Game Logic and Animation Controller
  useEffect(() => {
    // 1. NEDTELLING (NEW requestAnimationFrame LOGIC)
    if (phase === "countdown") {
      setIsGlassVisible(true);
      setIsRefilling(false);

      let startTime: number | null = null;
      const totalDuration = countdownValue * 1000;

      const animate = (timestamp: number) => {
        if (!startTime) {
          startTime = timestamp;
        }

        const elapsedTime = timestamp - startTime;
        const progress = Math.min(elapsedTime / totalDuration, 1);

        // Update beer height (from 89% down to 0%)
        const newBeerHeight = 100 * (1 - progress);
        setBeerHeight(`${newBeerHeight}%`);

        // Update countdown number
        const newDisplayCount = Math.ceil(countdownValue - elapsedTime / 1000);
        setDisplayCount(newDisplayCount > 0 ? newDisplayCount : 0);

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animate);
        } else {
          setBeerHeight("0%");
          setDisplayCount(0);
          setPhase("playing");
        }
      };

      animationFrameId.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
      };
    }

    // 2. SKJULER GLASSET UNDER SPILL OG RESULTAT
    if (phase === "playing" || phase === "result" || phase === "wheel") {
      setIsGlassVisible(false);
    }

    // 3. Går fra kombinert resultat til PÅFYLLING
    if (phase === "combined-result") {
      const nextPhaseTimer = setTimeout(() => {
        if (currentRound < rounds) {
          setCurrentRound((c) => c + 1);
          setFinalScore(null);
          setWheelCategory(null);
          if (boardFuncs.current) {
            boardFuncs.current.reset();
          }
          setPhase("refilling"); // Gå til påfylling
        } else {
          backToConfig();
        }
      }, 4000);
      return () => clearTimeout(nextPhaseTimer);
    }

    // 4. PÅFYLLING
    if (phase === "refilling") {
      setIsGlassVisible(true);
      setIsRefilling(true); // Starter CSS-animasjonen for påfylling

      const refillTimer = setTimeout(() => {
        setIsRefilling(false);
        setPhase("countdown"); // Går til neste runde sin nedtelling
      }, 6000); // Må matche varigheten av 'fill' animasjonen i CSS

      return () => clearTimeout(refillTimer);
    }
  }, [phase, countdownValue, rounds, currentRound]);

  // useEffect for Plinko board
  useEffect(() => {
    if (phase !== "playing" || !ready) return;
    initBoard();
    setTimeout(() => {
      if (boardFuncs.current) boardFuncs.current.drop();
    }, 1500);
  }, [phase, ready]);

  // useEffects for Plinko-resultat
  useEffect(() => {
    if (phase !== "result") return;
    const holder = containerRef.current;
    if (!holder) return;
    const rects = holder.querySelectorAll<SVGRectElement>("#sensors rect");
    rects.forEach((r) => {
      const key = r.getAttribute("x") + "_" + r.getAttribute("y");
      if (key === selectedSensor) {
        r.classList.add("highlight");
      } else {
        r.classList.add("dim");
      }
    });
    const svg = holder.querySelector("svg");
    svg?.classList.add("fadeout");
    const toWheel = setTimeout(() => setPhase("wheel"), 1500);
    return () => clearTimeout(toWheel);
  }, [phase, selectedSensor]);

  useEffect(() => {
    if (phase !== "playing" && phase !== "result") {
      const holder = containerRef.current;
      if (!holder) return;
      holder.querySelectorAll("#sensors rect").forEach((r) => {
        r.classList.remove("highlight", "dim");
      });
      holder.querySelector("svg")?.classList.remove("fadeout");
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "wheel" && wheelCategory) {
      const t = setTimeout(() => {
        setPhase("combined-result");
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [phase, wheelCategory]);

  // JSX-komponent for selve ølglasset
  const BeerGlassAnimation = () => (
    <div className={`glass-container ${isGlassVisible ? "visible" : ""}`}>
      <div className={`glass ${isRefilling ? "refilling" : ""}`}>
        <div className="wrapper">
          <div className="contents">
            <div className="beer" style={{ height: beerHeight }}>
              <div className="bubbles">
                <div className="layer"></div>
                <div className="layer more"></div>
              </div>
              <div className="surface">
                <div className="head"></div>
              </div>
            </div>
          </div>
        </div>
        <svg viewBox="0 0 550 980">
          <style type="text/css">{`.st0{fill:url(#SVGID_1_);}.st1{fill:#FFFFFF;}.st2{opacity:0.85;fill:#FFFFFF;}.st3{opacity:0.86;fill:#FFFFFF;}.st4{opacity:0.5;fill:#FFFFFF;}.st5{fill:url(#SVGID_2_);}`}</style>
          <linearGradient
            id="SVGID_1_"
            gradientUnits="userSpaceOnUse"
            x1="399.6879"
            y1="462.5569"
            x2="516.6628"
            y2="462.5569"
          >
            <stop
              offset="0.1021"
              style={{ stopColor: "#FFFFFF", stopOpacity: "0" }}
            ></stop>
            <stop offset="1" style={{ stopColor: "#FFFFFF" }}></stop>
          </linearGradient>
          <path
            className="st0"
            d="M399.69,81.11c39.58-2.26,83.23-10.35,104.66-14.72c6.71-1.37,12.84,4.07,12.28,10.89 c-11.21,135.24-66.63,741.35-68.14,757c-1.57,16.27-35.15,24.66-35.15,24.66C439.56,549.38,399.69,81.11,399.69,81.11z"
          ></path>
          <path className="st1" d="M507.67,73.32"></path>
          <path
            className="st2"
            d="M519.05,43.86c-19.85,4.57-40.18,6.98-60.48,8.99c-20.32,1.97-40.7,3.3-61.1,4.29 c-40.79,1.98-85.04,2.97-122.48,2.97s-81.69-1-122.48-2.97c-20.39-0.99-40.78-2.32-61.1-4.29c-20.3-2.02-40.62-4.42-60.48-8.99 l-0.42,1.67c19.92,5.04,40.25,9.5,60.57,11.97c20.34,2.41,40.74,4.2,61.16,5.63C193.11,66,235.57,67.88,275,67.88 c39.43,0,81.89-1.88,122.74-4.75c20.42-1.43,40.83-3.22,61.16-5.63c20.32-2.47,40.65-6.92,60.57-11.97L519.05,43.86z"
          ></path>
          <path
            className="st3"
            d="M333.03,908.96c-19.07-1.51-41.93-2.67-58.03-2.67s-38.96,1.16-58.03,2.67c-19.06,1.52-38.08,3.67-56.93,6.86 l0.22,1.39c18.88-2.59,37.89-4.14,56.92-5.05c19.03-0.91,34.61-0.87,57.82-0.87s38.79-0.04,57.82,0.87 c19.03,0.92,38.04,2.47,56.92,5.05l0.22-1.39C371.11,912.64,352.09,910.48,333.03,908.96z"
          ></path>
          <path
            className="st4"
            d="M275,829.75c-32.91,0-89.08,3.57-132.66,10.66l0.21,1.39c43.66-5.88,95.72-7.05,132.45-7.05 s88.79,1.17,132.45,7.05l0.21-1.39C364.08,833.32,307.91,829.75,275,829.75z"
          ></path>
          <linearGradient
            id="SVGID_2_"
            gradientUnits="userSpaceOnUse"
            x1="1108.0135"
            y1="462.5569"
            x2="1224.9884"
            y2="462.5569"
            gradientTransform="matrix(-1 0 0 1 1258.3256 0)"
          >
            <stop
              offset="0.1021"
              style={{ stopColor: "#FFFFFF", stopOpacity: "0" }}
            ></stop>
            <stop offset="1" style={{ stopColor: "#FFFFFF" }}></stop>
          </linearGradient>
          <path
            className="st5"
            d="M150.31,81.11c-39.58-2.26-83.23-10.35-104.66-14.72c-6.71-1.37-12.84,4.07-12.28,10.89 c11.21,135.24,66.63,741.35,68.14,757c-1.57,16.27-35.15,24.66-35.15,24.66C110.44,549.38,150.31,81.11,150.31,81.11z"
          ></path>
          <path className="st1" d="M42.33,73.32"></path>
          <path
            className="st1"
            d="M549.97,30.97c-0.02-0.6-0.13-1.13-0.27-1.67c-0.14-0.52-0.29-1.11-0.48-1.54c-0.38-0.87-0.85-1.8-1.32-2.4 c-0.24-0.33-0.48-0.67-0.73-0.98l-0.71-0.77c-1.93-1.96-3.7-3.02-5.41-4C539.34,18.67,444.21,0,275,0S10.66,18.67,8.96,19.62 c-1.7,0.98-3.47,2.04-5.41,4l-0.71,0.77c-0.25,0.3-0.49,0.65-0.73,0.98c-0.47,0.6-0.94,1.52-1.32,2.4c-0.2,0.43-0.35,1.02-0.48,1.54 c-0.14,0.53-0.25,1.07-0.27,1.67C0,31.52-0.01,32.21,0.01,32.65l0.05,0.58l0.37,4.63l1.47,18.54c3.96,49.44,8.46,98.83,13.02,148.18 c2.26,24.68,4.6,49.35,7,74.01l7.16,73.99l7.19,73.99l7.37,73.97L51,574.5l7.52,73.95l7.57,73.95l7.76,73.93l7.75,73.93l6.73,62.36 c1.21,11.23,8.21,21.08,18.52,25.69C134.4,970.62,193.09,980,275,980s140.6-9.38,168.15-21.69c10.31-4.61,17.31-14.45,18.52-25.69 l6.73-62.36l7.75-73.93l7.76-73.93l7.57-73.95L499,574.5l7.37-73.97l7.37-73.97l7.19-73.99l7.16-73.99c2.4-24.66,4.74-49.33,7-74.01 c4.57-49.35,9.06-98.73,13.02-148.18l1.47-18.54l0.37-4.63l0.05-0.58C550.01,32.21,550,31.52,549.97,30.97z M13.75,33.43 c-0.01,0.02-0.04,0.04-0.05,0.04C13.72,33.45,13.74,33.44,13.75,33.43C13.76,33.42,13.75,33.43,13.75,33.43z M14.16,31.57 c0.01,0.04,0.03,0.2,0.03,0.35L14.16,31.57z M535.45,36.78l-1.42,18.52c-3.84,49.36-8.21,98.69-12.66,148.04l-13.3,148.05 l-6.66,74.03l-6.51,74.05l-6.51,74.05l-6.36,74.06l-6.31,74.07l-6.11,74.08l-3.39,41.09h0c-1.33,16.12-11.67,26.49-44.15,38.94 c-10.73,4.12-18.37,13.78-19.84,25.18c-1.01,7.86-2.1,15.18-3.42,22.87c-2.81,16.42-15.03,29.62-31.19,33.64 c-24.33,6.05-58.46,10.27-92.61,10.27s-68.29-4.22-92.61-10.27c-16.16-4.02-28.38-17.22-31.19-33.64 c-1.32-7.69-2.41-15.02-3.42-22.87c-1.46-11.4-9.1-21.06-19.84-25.18c-32.48-12.46-42.82-22.82-44.15-38.94h0l-3.39-41.09 l-6.11-74.08l-6.31-74.07l-6.36-74.06l-6.51-74.05l-6.51-74.05l-6.66-74.03l-13.3-148.05c-4.45-49.35-8.83-98.68-12.66-148.04 l-1.42-18.52l-0.29-3.8c0.39-0.31,0.96-0.69,1.59-1.05c1-0.57,2.2-1.12,3.43-1.65c5.05-2.08,10.86-3.66,16.67-5.03 c5.84-1.38,11.81-2.52,17.81-3.56c12.03-2.02,24.18-3.78,36.39-5.25c12.21-1.5,24.48-2.66,36.76-3.85 C176.07,8.05,226.65,4.23,275,4.23s98.93,3.82,148.08,8.36c12.28,1.19,24.55,2.35,36.76,3.85c12.21,1.47,24.37,3.24,36.39,5.25 c6,1.04,11.97,2.19,17.81,3.56c5.81,1.37,11.62,2.95,16.67,5.03c1.23,0.53,2.43,1.07,3.43,1.65c0.63,0.36,1.2,0.74,1.59,1.05 L535.45,36.78z M535.82,31.92c0-0.15,0.01-0.31,0.03-0.35L535.82,31.92z M536.25,33.43C536.25,33.43,536.24,33.42,536.25,33.43 c0.01,0.01,0.03,0.02,0.05,0.04C536.29,33.47,536.25,33.45,536.25,33.43z"
          ></path>
        </svg>
      </div>
    </div>
  );

  const initBoard = () => {
    // This function remains unchanged...
    if (!ready || !containerRef.current) return;
    if (containerRef.current.innerHTML !== "") return;

    containerRef.current.innerHTML = `
          <div class="container">
            <svg id="svg" width="600" height="600" viewBox="0 0 1000 1000" fill="none">
              <defs>
                <filter id="shadow" width="140%" height="140%">
                  <feDropShadow dx="10" dy="10" stdDeviation="0" flood-color="black" flood-opacity=".3" />
                </filter>
                <radialGradient id="ball_gradient" cx="20%" cy="20%" fx="20%" fy="20%">
                  <stop offset="0%" stop-color="#9575ff" />
                  <stop offset="100%" stop-color="#7c4dff" />
                </radialGradient>
                <radialGradient id="background_gradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(57 82.5) rotate(60.4845) scale(712.461 356.231)">
                  <stop stop-color="#2a2a2a" />
                  <stop offset="1" stop-color="#1a1a1a" />
                </radialGradient>
              </defs>
              <rect id="background" class="innerShadow" width="1000" height="1000" fill="url(#background_gradient)" />
              <text id="scoreText" class="scoreText" x="500" y="115" text-anchor="middle">~ 0 ~</text>
              <path id="chain" d="" stroke="white" stroke-width="3" />
              <g id="pegs" filter="url(#shadow)" fill="#9575ff">
                <circle id="peg_92" cx="137" cy="210" r="10" />
                <circle id="peg_91" cx="216" cy="210" r="10" />
                <circle id="peg_90" cx="295" cy="210" r="10" />
                <circle id="peg_89" cx="374" cy="210" r="10" />
                <circle id="peg_88" cx="453" cy="210" r="10" />
                <circle id="peg_87" cx="532" cy="210" r="10" />
                <circle id="peg_86" cx="611" cy="210" r="10" />
                <circle id="peg_85" cx="690" cy="210" r="10" />
                <circle id="peg_84" cx="769" cy="210" r="10" />
                <circle id="peg_83" cx="848" cy="210" r="10" />
                <circle id="peg_82" cx="927" cy="210" r="10" />
                <circle id="peg_81" cx="58" cy="210" r="10" />
                <circle id="peg_80" cx="184" cy="280" r="10" />
                <circle id="peg_79" cx="263" cy="280" r="10" />
                <circle id="peg_78" cx="342" cy="280" r="10" />
                <circle id="peg_77" cx="421" cy="280" r="10" />
                <circle id="peg_76" cx="500" cy="280" r="10" />
                <circle id="peg_75" cx="579" cy="280" r="10" />
                <circle id="peg_74" cx="658" cy="280" r="10" />
                <circle id="peg_73" cx="737" cy="280" r="10" />
                <circle id="peg_72" cx="816" cy="280" r="10" />
                <circle id="peg_71" cx="895" cy="280" r="10" />
                <circle id="peg_70" cx="105" cy="280" r="10" />
                <circle id="peg_69" cx="137" cy="350" r="10" />
                <circle id="peg_68" cx="216" cy="350" r="10" />
                <circle id="peg_67" cx="295" cy="350" r="10" />
                <circle id="peg_66" cx="374" cy="350" r="10" />
                <circle id="peg_65" cx="453" cy="350" r="10" />
                <circle id="peg_64" cx="532" cy="350" r="10" />
                <circle id="peg_63" cx="611" cy="350" r="10" />
                <circle id="peg_62" cx="690" cy="350" r="10" />
                <circle id="peg_61" cx="769" cy="350" r="10" />
                <circle id="peg_60" cx="848" cy="350" r="10" />
                <circle id="peg_59" cx="927" cy="350" r="10" />
                <circle id="peg_58" cx="58" cy="350" r="10" />
                <circle id="peg_57" cx="184" cy="420" r="10" />
                <circle id="peg_56" cx="263" cy="420" r="10" />
                <circle id="peg_55" cx="342" cy="420" r="10" />
                <circle id="peg_54" cx="421" cy="420" r="10" />
                <circle id="peg_53" cx="500" cy="420" r="10" />
                <circle id="peg_52" cx="579" cy="420" r="10" />
                <circle id="peg_51" cx="658" cy="420" r="10" />
                <circle id="peg_50" cx="737" cy="420" r="10" />
                <circle id="peg_49" cx="816" cy="420" r="10" />
                <circle id="peg_48" cx="895" cy="420" r="10" />
                <circle id="peg_47" cx="105" cy="420" r="10" />
                <circle id="peg_46" cx="137" cy="490" r="10" />
                <circle id="peg_45" cx="216" cy="490" r="10" />
                <circle id="peg_44" cx="295" cy="490" r="10" />
                <circle id="peg_43" cx="374" cy="490" r="10" />
                <circle id="peg_42" cx="453" cy="490" r="10" />
                <circle id="peg_41" cx="532" cy="490" r="10" />
                <circle id="peg_40" cx="611" cy="490" r="10" />
                <circle id="peg_39" cx="690" cy="490" r="10" />
                <circle id="peg_38" cx="769" cy="490" r="10" />
                <circle id="peg_37" cx="848" cy="490" r="10" />
                <circle id="peg_36" cx="927" cy="490" r="10" />
                <circle id="peg_35" cx="58" cy="490" r="10" />
                <circle id="peg_34" cx="184" cy="560" r="10" />
                <circle id="peg_33" cx="263" cy="560" r="10" />
                <circle id="peg_32" cx="342" cy="560" r="10" />
                <circle id="peg_31" cx="421" cy="560" r="10" />
                <circle id="peg_30" cx="500" cy="560" r="10" />
                <circle id="peg_29" cx="579" cy="560" r="10" />
                <circle id="peg_28" cx="658" cy="560" r="10" />
                <circle id="peg_27" cx="737" cy="560" r="10" />
                <circle id="peg_26" cx="816" cy="560" r="10" />
                <circle id="peg_25" cx="895" cy="560" r="10" />
                <circle id="peg_24" cx="105" cy="560" r="10" />
                <circle id="peg_23" cx="137" cy="630" r="10" />
                <circle id="peg_22" cx="216" cy="630" r="10" />
                <circle id="peg_21" cx="295" cy="630" r="10" />
                <circle id="peg_20" cx="374" cy="630" r="10" />
                <circle id="peg_19" cx="453" cy="630" r="10" />
                <circle id="peg_18" cx="532" cy="630" r="10" />
                <circle id="peg_17" cx="611" cy="630" r="10" />
                <circle id="peg_16" cx="690" cy="630" r="10" />
                <circle id="peg_15" cx="769" cy="630" r="10" />
                <circle id="peg_14" cx="848" cy="630" r="10" />
                <circle id="peg_13" cx="927" cy="630" r="10" />
                <circle id="peg_12" cx="58" cy="630" r="10" />
                <circle id="peg_11" cx="184" cy="700" r="10" />
                <circle id="peg_10" cx="263" cy="700" r="10" />
                <circle id="peg_09" cx="342" cy="700" r="10" />
                <circle id="peg_08" cx="421" cy="700" r="10" />
                <circle id="peg_07" cx="500" cy="700" r="10" />
                <circle id="peg_06" cx="579" cy="700" r="10" />
                <circle id="peg_05" cx="658" cy="700" r="10" />
                <circle id="peg_04" cx="737" cy="700" r="10" />
                <circle id="peg_03" cx="816" cy="700" r="10" />
                <circle id="peg_02" cx="895" cy="700" r="10" />
                <circle id="peg_01" cx="105" cy="700" r="10" />
              </g>
              <g id="sensors">
                <rect id="sensor_1" data-score="10" x="0" y="900" width="100" height="100" fill="#D7FFEC" />
                <rect id="sensor_2" data-score="50" x="100" y="900" width="100" height="100" fill="#95FFCC" />
                <rect id="sensor_3" data-score="100" x="200" y="900" width="100" height="100" fill="#00FF85" />
                <rect id="sensor_4" data-score="50" x="300" y="900" width="100" height="100" fill="#95FFCC" />
                <rect id="sensor_5" data-score="10" x="400" y="900" width="100" height="100" fill="#D7FFEC" />
                <rect id="sensor_6" data-score="10" x="500" y="900" width="100" height="100" fill="#D7FFEC" />
                <rect id="sensor_7" data-score="50" x="600" y="900" width="100" height="100" fill="#95FFCC" />
                <rect id="sensor_8" data-score="100" x="700" y="900" width="100" height="100" fill="#00FF85" />
                <rect id="sensor_9" data-score="50" x="800" y="900" width="100" height="100" fill="#95FFCC" />
                <rect id="sensor_10" data-score="10" x="900" y="900" width="100" height="100" fill="#D7FFEC" />
              </g>
              <g id="points" fill="darkgreen" >
                <text class="points" id="10" x="50" y="965" text-anchor="middle">10</text>
                <text class="points" id="50" x="150" y="965" text-anchor="middle">50</text>
                <text class="points" id="100" x="250" y="965" text-anchor="middle">100</text>
                <text class="points" id="50_2" x="350" y="965" text-anchor="middle">50</text>
                <text class="points" id="10_2" x="450" y="965" text-anchor="middle">10</text>
                <text class="points" id="10" x="550" y="965" text-anchor="middle">10</text>
                <text class="points" id="50" x="650" y="965" text-anchor="middle">50</text>
                <text class="points" id="100" x="750" y="965" text-anchor="middle">100</text>
                <text class="points" id="50_2" x="850" y="965" text-anchor="middle">50</text>
                <text class="points" id="10_2" x="950" y="965" text-anchor="middle">10</text>
              </g>
              <g id="cupwalls" filter="url(#shadow)">
                <rect id="cupwall_0" x="95" y="890" width="10" height="110" fill="#202020" />
                <rect id="cupwall_1" x="195" y="890" width="10" height="110" fill="#202020" />
                <rect id="cupwall_2" x="295" y="890" width="10" height="110" fill="#202020" />
                <rect id="cupwall_3" x="395" y="890" width="10" height="110" fill="#202020" />
                <rect id="cupwall_4" x="495" y="890" width="10" height="110" fill="#202020" />
                <rect id="cupwall_5" x="595" y="890" width="10" height="110" fill="#202020" />
                <rect id="cupwall_6" x="695" y="890" width="10" height="110" fill="#202020" />
                <rect id="cupwall_7" x="795" y="890" width="10" height="110" fill="#202020" />
                <rect id="cupwall_8" x="895" y="890" width="10" height="110" fill="#202020" />
              </g>
              <g id="spinners" filter="url(#shadow)">
                <rect id="spinner_3" x="745" y="750" rx="5" ry="5" width="10" height="120" fill="#7c4dff" />
                <rect id="spinner_2" x="496" y="750" rx="5" ry="5" width="10" height="120" fill="#9575ff" />
                <rect id="spinner_1" x="245" y="750" rx="5" ry="5" width="10" height="120" fill="#7c4dff" />
              </g>
              <circle id="ballGraphic" cx="500" cy="50" r="20" fill="url(#ball_gradient)" filter="url(#shadow)" />
              <circle id="anchorGraphic" cx="500" cy="10" r="7" fill="white" stroke="black" filter="url(#shadow)" />
              <g id="shadows">
                <rect id="shadow" width="20" height="1000" fill="black" fill-opacity="0.1" />
                <rect id="shadow_2" x="20" width="980" height="20" fill="black" fill-opacity="0.1" />
              </g>
            </svg>
          </div>`;

    const layouts: Record<string, (string | number)[]> = {
      Mild: [3, 3, 6, 6, 3, 3, 6, 6, 3, 3],
      Medium: [3, 6, 6, 3, 6, 10, 6, 3, 6, 3],
      Fyllehund: [3, 6, 10, 6, "CHUG", 10, 6, 10, 6, 3],
      Grøfta: [3, 6, 10, "CHUG", 10, "CHUG", 10, 10, 6, 3],
    };
    const applyIntensity = () => {
      const layout = layouts[intensity];
      const sensors = containerRef.current?.querySelectorAll("#sensors rect");
      const points = containerRef.current?.querySelectorAll("#points text");
      const getColorForPenalty = (val: string | number) => {
        switch (val) {
          case 3:
            return "#4CAF50";
          case 6:
            return "#FFC107";
          case 10:
            return "#FF9800";
          case "CHUG":
            return "#F44336";
          default:
            return "#4CAF50";
        }
      };
      sensors?.forEach((s, idx) => {
        const val = layout[idx];
        const sensorElement = s as HTMLElement;
        sensorElement.dataset.score = String(val);
        sensorElement.setAttribute("fill", getColorForPenalty(val));
      });
      points?.forEach((p, idx) => {
        const val = layout[idx];
        p.textContent = String(val);
        const pointElement = p as HTMLElement;
        if (val === "CHUG" || val === 10) {
          pointElement.setAttribute("fill", "white");
        } else {
          pointElement.setAttribute("fill", "darkgreen");
        }
      });
    };
    applyIntensity();
    const { Engine, Events, Runner, Bodies, World, Constraint } = window.Matter;
    const svg = document.querySelector("#svg") as SVGSVGElement;
    const viewboxArray = (svg.getAttribute("viewBox") || "0 0 1000 1000").split(
      " "
    );
    const vbWidth = parseInt(viewboxArray[2]);
    const vbHeight = parseInt(viewboxArray[3]);
    const engine = Engine.create();
    const runner = Runner.create();
    const ballGraphic = document.getElementById(
      "ballGraphic"
    ) as unknown as SVGCircleElement;
    let ballBody: any;
    const anchorGraphic = document.getElementById(
      "anchorGraphic"
    ) as unknown as SVGCircleElement;
    let anchorBody: any;
    let anchorConstraint: any;
    const anchorConstraintGraphic = document.querySelector(
      "#chain"
    ) as SVGPathElement;
    let floor: any, right_wall: any, left_wall: any;
    const wallThickness = 50;
    const pegBodies: any[] = [];
    const cup_separators: any[] = [];
    const sensors: any[] = [];
    const spinners: any[] = [];
    const spinnerGraphics: any[] = [];
    const scoreText = document.querySelector("#scoreText") as SVGTextElement;
    let dropped = false;
    const initBallBody = () => {
      const xpos = parseInt(ballGraphic.getAttribute("cx") || "0");
      const ypos = parseInt(ballGraphic.getAttribute("cy") || "0");
      const r = parseInt(ballGraphic.getAttribute("r") || "0");
      ballBody = Bodies.circle(0, 0, r, {
        id: `ball`,
        friction: 0,
        restitution: 0.6,
        isStatic: false,
      });
      window.Matter.Body.setPosition(ballBody, { x: xpos, y: ypos });
    };
    const initAnchorBody = () => {
      const xpos = parseInt(anchorGraphic.getAttribute("cx") || "0");
      const ypos = parseInt(anchorGraphic.getAttribute("cy") || "0");
      const r = parseInt(anchorGraphic.getAttribute("r") || "0");
      anchorBody = Bodies.circle(0, 0, r, {
        id: `anchor`,
        friction: 0,
        restitution: 0,
        isStatic: true,
      });
      window.Matter.Body.setPosition(anchorBody, { x: xpos, y: ypos });
    };
    const initConstraint = () => {
      anchorConstraint = Constraint.create({
        bodyA: anchorBody,
        bodyB: ballBody,
        stiffness: 0.1,
        length: 75,
      });
    };
    const initFloor = () => {
      floor = Bodies.rectangle(0, 0, vbWidth, wallThickness, {
        id: `floor`,
        friction: 0,
        restitution: 0.5,
        isStatic: true,
      });
      window.Matter.Body.setPosition(floor, {
        x: vbWidth / 2,
        y: vbHeight + wallThickness / 2,
      });
    };
    const initWalls = () => {
      right_wall = Bodies.rectangle(0, 0, wallThickness, vbHeight, {
        id: `rightwall`,
        friction: 0,
        restitution: 0.5,
        isStatic: true,
      });
      window.Matter.Body.setPosition(right_wall, {
        x: -wallThickness / 2,
        y: vbHeight / 2,
      });
      left_wall = Bodies.rectangle(0, 0, wallThickness, vbHeight, {
        id: `leftwall`,
        friction: 0,
        restitution: 0.5,
        isStatic: true,
      });
      window.Matter.Body.setPosition(left_wall, {
        x: vbWidth + wallThickness / 2,
        y: vbHeight / 2,
      });
    };
    const initPegs = () => {
      const pegHolder = document.querySelector("#pegs") as SVGGElement;
      const pegs = pegHolder.getElementsByTagName("circle");
      for (const peg of Array.from(pegs)) {
        const xpos = peg.getAttribute("cx") as string;
        const ypos = peg.getAttribute("cy") as string;
        const r = peg.getAttribute("r") as string;
        const pegBody = Bodies.circle(0, 0, parseInt(r), {
          id: `peg_${xpos}_${ypos}`,
          friction: 0,
          restitution: 1,
          isStatic: true,
        });
        window.Matter.Body.setPosition(pegBody, {
          x: parseInt(xpos),
          y: parseInt(ypos),
        });
        pegBodies.push(pegBody);
      }
    };
    const initSensors = () => {
      const sensorHolder = document.querySelector("#sensors") as SVGGElement;
      const sensorGrapghics = sensorHolder.getElementsByTagName("rect");
      for (const graphic of Array.from(sensorGrapghics)) {
        const xpos = graphic.getAttribute("x") as string;
        const ypos = graphic.getAttribute("y") as string;
        const w = graphic.getAttribute("width") as string;
        const h = graphic.getAttribute("height") as string;
        const score = graphic.dataset.score as string;
        const body_x = parseInt(xpos) + parseInt(w) / 2;
        const body_y = parseInt(ypos) + parseInt(h) / 2;
        const sensorBody = Bodies.rectangle(
          0,
          0,
          parseInt(w),
          parseInt(h) / 2,
          {
            id: `sensor_${xpos}_${ypos}_${score}`,
            isSensor: true,
            isStatic: true,
          }
        );
        window.Matter.Body.setPosition(sensorBody, { x: body_x, y: body_y });
        sensors.push(sensorBody);
      }
      Events.on(engine, "collisionStart", (event: any) => {
        var pairs = event.pairs;
        for (var i = 0; i < pairs.length; ++i) {
          var pair = pairs[i];
          if (
            pair.bodyA.id.includes("sensor") ||
            pair.bodyB.id.includes("sensor")
          ) {
            let id = pair.bodyA.id.includes("sensor")
              ? pair.bodyA.id
              : pair.bodyB.id;
            const parts = id.substr(7).split("_");
            const score = parts[2];
            scoreText.textContent = `~ ${score} ~`;
            setSelectedSensor(`${parts[0]}_${parts[1]}`);
            setFinalScore(score);
            setPhase("result");
          }
        }
      });
    };
    const initSeparators = () => {
      const holder = document.querySelector("#cupwalls") as SVGGElement;
      const cupwalls = holder.getElementsByTagName("rect");
      for (const cupwall of Array.from(cupwalls)) {
        const w = cupwall.getAttribute("width") as string;
        const h = cupwall.getAttribute("height") as string;
        const xpos = parseInt(cupwall.getAttribute("x") as string);
        const ypos = parseInt(cupwall.getAttribute("y") as string);
        const sep = Bodies.rectangle(0, 0, parseInt(w), parseInt(h), {
          id: `cupwall_${xpos}`,
          friction: 0,
          restitution: 0.5,
          isStatic: true,
        });
        window.Matter.Body.setPosition(sep, {
          x: xpos + parseInt(w) / 2,
          y: ypos + parseInt(h) / 2,
        });
        cup_separators.push(sep);
      }
    };
    const initSpinners = () => {
      const spinnerHolder = document.querySelector("#spinners") as SVGGElement;
      const sgs = spinnerHolder.getElementsByTagName("rect");
      for (const spinnerGraphic of Array.from(sgs)) {
        const x = parseInt(spinnerGraphic.getAttribute("x") as string);
        const y = parseInt(spinnerGraphic.getAttribute("y") as string);
        const width = parseInt(spinnerGraphic.getAttribute("width") as string);
        const height = parseInt(
          spinnerGraphic.getAttribute("height") as string
        );
        const xpos = x + width / 2;
        const ypos = y + height / 2;
        spinnerGraphics.push(spinnerGraphic);
        const spinnerBody = Bodies.rectangle(0, 0, width, height, {
          id: `spinner_${x}_${y}`,
          friction: 0,
          restitution: 0.5,
          isStatic: true,
        });
        window.Matter.Body.setPosition(spinnerBody, { x: xpos, y: ypos });
        window.Matter.Body.rotate(
          spinnerBody,
          Math.random() * 2 * Math.PI,
          spinnerBody.position,
          true
        );
        spinners.push(spinnerBody);
      }
    };
    const spinSpinners = () => {
      for (let i = 0; i < spinners.length; i++) {
        const spinner = spinners[i];
        const bodyPos = spinner.position;
        const spinnerGraphic = spinnerGraphics[i];
        window.Matter.Body.rotate(spinner, -0.04, bodyPos, true);
        const angle = (spinner.angle * 180) / Math.PI;
        spinnerGraphic.setAttribute(
          "transform",
          `rotate(${angle} ${bodyPos.x}, ${bodyPos.y})`
        );
      }
    };
    const dropBall = () => {
      dropped = true;
      const positions = [250, 350, 450, 550, 650, 750];
      const randomX = positions[Math.floor(Math.random() * positions.length)];
      const finalX = randomX + (Math.random() - 0.5) * 40;
      window.Matter.Composite.remove(engine.world, anchorConstraint);
      window.Matter.Body.setPosition(ballBody, { x: finalX, y: 50 });
      window.Matter.Body.setPosition(anchorBody, { x: finalX, y: 10 });
      ballGraphic.setAttribute("cx", String(finalX));
      anchorGraphic.setAttribute("cx", String(finalX));
      const randomVelocity = (Math.random() - 0.5) * 0.02;
      window.Matter.Body.setVelocity(ballBody, { x: randomVelocity, y: 0 });
    };
    const reset = () => {
      dropped = false;
      window.Matter.Body.setPosition(ballBody, { x: vbWidth / 2, y: 50 });
      window.Matter.Body.setPosition(anchorBody, {
        x: vbWidth / 2,
        y: anchorBody.position.y,
      });
      ballGraphic.setAttribute("cx", String(vbWidth / 2));
      anchorGraphic.setAttribute("cx", String(vbWidth / 2));
      window.Matter.Composite.add(engine.world, anchorConstraint);
      scoreText.textContent = "~ 0 ~";
    };
    boardFuncs.current = { drop: dropBall, reset };
    const drawBall = () => {
      const pos = ballBody.position;
      ballGraphic.setAttribute("cx", String(pos.x));
      ballGraphic.setAttribute("cy", String(pos.y));
    };
    const drawConstrainGraphic = () => {
      const pos = ballBody.position;
      if (!dropped) {
        anchorConstraintGraphic.setAttribute(
          "d",
          `M${pos.x},${pos.y} L${anchorBody.position.x},${anchorBody.position.y}`
        );
      } else {
        anchorConstraintGraphic.setAttribute("d", "");
      }
    };
    const initWorld = () => {
      window.Matter.Composite.add(engine.world, [
        ballBody,
        anchorBody,
        anchorConstraint,
        floor,
        left_wall,
        right_wall,
        ...pegBodies,
        ...cup_separators,
        ...sensors,
        ...spinners,
      ]);
      Runner.run(runner, engine);
    };
    const update = () => {
      spinSpinners();
      drawBall();
      drawConstrainGraphic();
      window.requestAnimationFrame(update);
    };
    initBallBody();
    initAnchorBody();
    initConstraint();
    initFloor();
    initWalls();
    initPegs();
    initSeparators();
    initSensors();
    initSpinners();
    initWorld();
    update();
  };

  return (
    <div className="skjenkehjulet-wrapper">
      {/* 1. Animasjonen rendres alltid i DOM, men er kun synlig når den skal være det */}
      <BeerGlassAnimation />

      {/* 2. Viser riktig spillskjerm basert på 'phase' */}
      {phase === "config" && (
        <div className="skjenkehjulet config-form">
          <h2>Skjenkehjulet</h2>
          <label>
            Nedtelling (sekunder):
            <input
              type="number"
              value={countdownValue}
              onChange={(e) =>
                setCountdownValue(parseInt(e.target.value) || 10)
              }
            />
          </label>
          <label>
            Runder:
            <input
              type="number"
              value={rounds}
              onChange={(e) => setRounds(parseInt(e.target.value) || 1)}
            />
          </label>
          <label>
            Intensitet:
            <select
              value={intensity}
              onChange={(e) => setIntensity(e.target.value as any)}
            >
              <option value="Mild">Mild</option>
              <option value="Medium">Medium</option>
              <option value="Fyllehund">Fyllehund</option>
              <option value="Grøfta">Grøfta</option>
            </select>
          </label>
          <button
            className="plinko-btn"
            onClick={() => setPhase("countdown")}
            disabled={!ready}
          >
            Start spillet
          </button>
        </div>
      )}

      {phase === "countdown" && (
        <div className="skjenkehjulet skjenkehjulet-countdown">
          {fadingCategories.map((cat) => (
            <div
              key={cat.key}
              className="fading-category-text"
              style={cat.style}
            >
              {cat.text}
            </div>
          ))}
          <div className="countdown-display-centered">{displayCount}</div>
        </div>
      )}

      {(phase === "playing" || phase === "result") && (
        <div className="skjenkehjulet">
          <div
            className={`danger-overlay ${dangerActive ? "active" : ""}`}
          ></div>
          <div ref={containerRef}></div>
          {phase === "result" && finalScore && (
            <div
              className={`result-display ${
                finalScore === "CHUG" ? "chug-result" : ""
              }`}
            >
              {finalScore}
            </div>
          )}
        </div>
      )}

      {phase === "wheel" && (
        <div className="skjenkehjulet">
          <div
            className={`danger-overlay ${dangerActive ? "active" : ""}`}
          ></div>
          {wheelCategory ? (
            <div className="result-display">{wheelCategory}</div>
          ) : (
            <LuckyWheel
              key={`wheel-${currentRound}`}
              categories={[
                "Hvite sokker",
                "Lengst hår",
                "Briller",
                "Høyest",
                "Rød skjorte",
                "Eldst",
                "Yngst",
                "Brune sko",
                "Øredobber",
                "Blå øyne",
              ]}
              onFinish={(c) => setWheelCategory(c)}
            />
          )}
        </div>
      )}

      {phase === "combined-result" && (
        <div className="skjenkehjulet">
          <div
            className={`danger-overlay ${dangerActive ? "active" : ""}`}
          ></div>
          <div className="combined-result-display">
            <h2
              style={{
                fontSize: "2.5rem",
                marginBottom: "2rem",
                color: dangerActive ? "#ff4444" : "#fff",
                textAlign: "center",
              }}
            >
              🎯 Endelig Resultat! 🎯
            </h2>
            <div
              style={{
                fontSize: "1.8rem",
                marginBottom: "1.5rem",
                padding: "2rem",
                backgroundColor: "rgba(0,0,0,0.3)",
                borderRadius: "1rem",
                textAlign: "center",
                lineHeight: "1.6",
              }}
            >
              Alle med{" "}
              <span style={{ color: "#ffd700", fontWeight: "bold" }}>
                {wheelCategory}
              </span>{" "}
              må drikke{" "}
              <span
                style={{
                  color: finalScore === "CHUG" ? "#ff4444" : "#4caf50",
                  fontWeight: "bold",
                  fontSize: "2.2rem",
                }}
              >
                {finalScore === "CHUG" ? "CHUG!" : `${finalScore} slurker`}
              </span>
            </div>
            {finalScore === "CHUG" && (
              <div
                className="chug-warning"
                style={{ animation: "chug-blink 1s infinite alternate" }}
              >
                🍺 BÅNN BÅNN BÅNN! 🍺
              </div>
            )}
            <div
              style={{
                fontSize: "1.2rem",
                opacity: 0.8,
                textAlign: "center",
                marginTop: "2rem",
              }}
            >
              {currentRound < rounds
                ? `Runde ${currentRound} av ${rounds} ferdig!`
                : `🎉 Spillet er ferdig! 🎉`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default Skjenkehjulet;
