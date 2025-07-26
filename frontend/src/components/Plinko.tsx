import React, { useEffect, useRef } from 'react';
import './Plinko.css';

declare global {
  interface Window {
    Matter: any;
  }
}

const Plinko: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.12.0/matter.min.js';
    script.onload = () => init();
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const init = () => {
    if (!window.Matter) return;
    const { Engine, Events, Runner, Bodies, World, Constraint } = window.Matter;
    const svg = containerRef.current!.querySelector('#svg') as SVGSVGElement;
    if (!svg) return;

    const namespace = 'http://www.w3.org/2000/svg';
    const viewboxArray = svg.getAttribute('viewBox')!.split(' ');
    const vbWidth = parseInt(viewboxArray[2]);
    const vbHeight = parseInt(viewboxArray[3]);

    const engine = Engine.create();
    const runner = Runner.create();

    const ballGraphic = svg.querySelector('#ballGraphic') as SVGCircleElement;
    let ballBody: any;

    const anchorGraphic = svg.querySelector('#anchorGraphic') as SVGCircleElement;
    let anchorBody: any;
    let anchorConstraint: any;
    const anchorConstraintGraphic = svg.querySelector('#chain') as SVGPathElement;

    let floor: any, right_wall: any, left_wall: any;
    const wallThickness = 50;

    const pegBodies: any[] = [];
    const cup_separators: any[] = [];
    const sensors: any[] = [];
    const spinners: any[] = [];
    const spinnerGraphics: SVGRectElement[] = [];

    const dropSlider = containerRef.current!.querySelector('#drop_slider') as HTMLInputElement;
    const dropButton = containerRef.current!.querySelector('#drop_button') as HTMLButtonElement;
    const scoreText = svg.querySelector('#scoreText') as SVGTextElement;

    let dropped = false;
    let gameOver = true;

    const initBallBody = () => {
      const xpos = parseInt(ballGraphic.getAttribute('cx')!);
      const ypos = parseInt(ballGraphic.getAttribute('cy')!);
      const r = parseInt(ballGraphic.getAttribute('r')!);
      ballBody = Bodies.circle(0, 0, r, { id: 'ball', friction: 0, restitution: 0.6, isStatic: false });
      window.Matter.Body.setPosition(ballBody, { x: xpos, y: ypos });
    };

    const initAnchorBody = () => {
      const xpos = parseInt(anchorGraphic.getAttribute('cx')!);
      const ypos = parseInt(anchorGraphic.getAttribute('cy')!);
      const r = parseInt(anchorGraphic.getAttribute('r')!);
      anchorBody = Bodies.circle(0, 0, r, { id: 'anchor', friction: 0, restitution: 0, isStatic: true });
      window.Matter.Body.setPosition(anchorBody, { x: xpos, y: ypos });
    };

    const initConstraint = () => {
      anchorConstraint = Constraint.create({ bodyA: anchorBody, bodyB: ballBody, stiffness: 0.1, length: 75 });
    };

    const initFloor = () => {
      floor = Bodies.rectangle(0, 0, vbWidth, wallThickness, { id: 'floor', friction: 0, restitution: 0.5, isStatic: true });
      window.Matter.Body.setPosition(floor, { x: vbWidth / 2, y: vbHeight + wallThickness / 2 });
    };

    const initWalls = () => {
      right_wall = Bodies.rectangle(0, 0, wallThickness, vbHeight, { id: 'rightwall', friction: 0, restitution: 0.5, isStatic: true });
      window.Matter.Body.setPosition(right_wall, { x: -wallThickness / 2, y: vbHeight / 2 });
      left_wall = Bodies.rectangle(0, 0, wallThickness, vbHeight, { id: 'leftwall', friction: 0, restitution: 0.5, isStatic: true });
      window.Matter.Body.setPosition(left_wall, { x: vbWidth + wallThickness / 2, y: vbHeight / 2 });
    };

    const initPegs = () => {
      const pegHolder = svg.querySelector('#pegs')!;
      const pegs = pegHolder.getElementsByTagName('circle');
      for (const peg of Array.from(pegs)) {
        const xpos = peg.getAttribute('cx')!;
        const ypos = peg.getAttribute('cy')!;
        const r = peg.getAttribute('r')!;
        const pegBody = Bodies.circle(0, 0, parseInt(r), { id: `peg_${xpos}_${ypos}`, friction: 0, restitution: 1, isStatic: true });
        window.Matter.Body.setPosition(pegBody, { x: parseInt(xpos), y: parseInt(ypos) });
        pegBodies.push(pegBody);
      }
    };

    const initSensors = () => {
      const sensorHolder = svg.querySelector('#sensors')!;
      const sensorGraphics = sensorHolder.getElementsByTagName('rect');
      for (const graphic of Array.from(sensorGraphics)) {
        const xpos = parseInt(graphic.getAttribute('x')!);
        const ypos = parseInt(graphic.getAttribute('y')!);
        const w = parseInt(graphic.getAttribute('width')!);
        const h = parseInt(graphic.getAttribute('height')!);
        const score = graphic.dataset.score;
        const sensorBody = Bodies.rectangle(0, 0, w, h / 2, { id: `sensor_${xpos}_${ypos}_${score}`, isSensor: true, isStatic: true });
        window.Matter.Body.setPosition(sensorBody, { x: xpos + w / 2, y: ypos + h / 2 });
        sensors.push(sensorBody);
      }

      Events.on(engine, 'collisionStart', (event: any) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; ++i) {
          const pair = pairs[i];
          if (pair.bodyA.id.includes('sensor') || pair.bodyB.id.includes('sensor')) {
            const id = pair.bodyA.id.includes('sensor') ? pair.bodyA.id : pair.bodyB.id;
            const score = id.substr(7).split('_')[2];
            scoreText.textContent = `~ ${score} ~`;
          }
        }
      });
    };

    const initSeparators = () => {
      const holder = svg.querySelector('#cupwalls')!;
      const cupwalls = holder.getElementsByTagName('rect');
      for (const cupwall of Array.from(cupwalls)) {
        const w = parseInt(cupwall.getAttribute('width')!);
        const h = parseInt(cupwall.getAttribute('height')!);
        const xpos = parseInt(cupwall.getAttribute('x')!);
        const ypos = parseInt(cupwall.getAttribute('y')!);
        const sep = Bodies.rectangle(0, 0, w, h, { id: `cupwall_${xpos}`, friction: 0, restitution: 0.5, isStatic: true });
        window.Matter.Body.setPosition(sep, { x: xpos + w / 2, y: ypos + h / 2 });
        cup_separators.push(sep);
      }
    };

    const initSpinners = () => {
      const spinnerHolder = svg.querySelector('#spinners')!;
      const sgs = spinnerHolder.getElementsByTagName('rect');
      for (const spinnerGraphic of Array.from(sgs)) {
        const x = parseInt(spinnerGraphic.getAttribute('x')!);
        const y = parseInt(spinnerGraphic.getAttribute('y')!);
        const width = parseInt(spinnerGraphic.getAttribute('width')!);
        const height = parseInt(spinnerGraphic.getAttribute('height')!);
        const xpos = x + width / 2;
        const ypos = y + height / 2;
        spinnerGraphics.push(spinnerGraphic);
        const spinnerBody = Bodies.rectangle(0, 0, width, height, { id: `spinner_${x}_${y}`, friction: 0, restitution: 0.5, isStatic: true });
        window.Matter.Body.setPosition(spinnerBody, { x: xpos, y: ypos });
        window.Matter.Body.rotate(spinnerBody, Math.random() * 2 * Math.PI, spinnerBody.position, true);
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
        spinnerGraphic.setAttribute('transform', `rotate(${angle} ${bodyPos.x}, ${bodyPos.y})`);
      }
    };

    const dropBall = () => {
      dropped = true;
      gameOver = false;
      window.Matter.Composite.remove(engine.world, anchorConstraint);
      dropButton.innerText = 'RESET';
    };

    const reset = () => {
      dropped = false;
      gameOver = true;
      window.Matter.Body.setPosition(ballBody, { x: vbWidth / 2, y: 50 });
      window.Matter.Body.setPosition(anchorBody, { x: vbWidth / 2, y: anchorBody.position.y });
      anchorGraphic.setAttribute('cx', `${vbWidth / 2}`);
      window.Matter.Composite.add(engine.world, anchorConstraint);
      dropButton.innerText = 'DROP';
      dropSlider.value = `${vbWidth / 2}`;
    };

    const drawBall = () => {
      const pos = ballBody.position;
      ballGraphic.setAttribute('cx', `${pos.x}`);
      ballGraphic.setAttribute('cy', `${pos.y}`);
    };

    const drawConstrainGraphic = () => {
      const pos = ballBody.position;
      if (!dropped) {
        anchorConstraintGraphic.setAttribute('d', `M${pos.x},${pos.y} L${anchorBody.position.x},${anchorBody.position.y}`);
      } else {
        anchorConstraintGraphic.setAttribute('d', '');
      }
    };

    const initUI = () => {
      dropSlider.addEventListener('input', (e: any) => {
        if (dropped) return;
        window.Matter.Body.setPosition(anchorBody, { x: e.target.value, y: anchorBody.position.y });
        anchorGraphic.setAttribute('cx', e.target.value);
      });

      dropButton.addEventListener('click', () => {
        if (!dropped) {
          dropBall();
        } else {
          reset();
        }
      });
    };

    const initWorld = () => {
      window.Matter.Composite.add(engine.world, [ballBody, anchorBody, anchorConstraint, floor, left_wall, right_wall, ...pegBodies, ...cup_separators, ...sensors, ...spinners]);
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
    initUI();
    initWorld();
    update();
  };

  return (
    <div ref={containerRef} className="plinko-root">
      <div className="container">
        <svg id="svg" width="600" height="600" viewBox="0 0 1000 1000" fill="none">
          <defs>
            <filter id="shadow" width="140%" height="140%">
              <feDropShadow dx="10" dy="10" stdDeviation="0" floodColor="black" floodOpacity=".3" />
            </filter>
            <radialGradient id="ball_gradient" cx="20%" cy="20%" fx="20%" fy="20%">
              <stop offset="0%" stopColor="#FF7373" />
              <stop offset="100%" stopColor="#790202" />
            </radialGradient>
            <radialGradient id="background_gradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(57 82.5) rotate(60.4845) scale(712.461 356.231)">
              <stop stopColor="#BFBDBD" />
              <stop offset="1" stopColor="#737373" />
            </radialGradient>
          </defs>
          <rect id="background" className="innerShadow" width="1000" height="1000" fill="url(#background_gradient)" />
          <text id="scoreText" className="scoreText" x="500" y="115" textAnchor="middle">~ 0 ~</text>
          <path id="chain" d="" stroke="white" strokeWidth="3" />
          <g id="pegs" filter="url(#shadow)" fill="#FEFF9F">
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
            <rect id="sensor_1" data-score="1" x="0" y="900" width="100" height="100" fill="#D7FFEC" />
            <rect id="sensor_2" data-score="2" x="100" y="900" width="100" height="100" fill="#95FFCC" />
            <rect id="sensor_3" data-score="3" x="200" y="900" width="100" height="100" fill="#00FF85" />
            <rect id="sensor_4" data-score="2" x="300" y="900" width="100" height="100" fill="#95FFCC" />
            <rect id="sensor_5" data-score="1" x="400" y="900" width="100" height="100" fill="#D7FFEC" />
            <rect id="sensor_6" data-score="1" x="500" y="900" width="100" height="100" fill="#D7FFEC" />
            <rect id="sensor_7" data-score="2" x="600" y="900" width="100" height="100" fill="#95FFCC" />
            <rect id="sensor_8" data-score="3" x="700" y="900" width="100" height="100" fill="#00FF85" />
            <rect id="sensor_9" data-score="2" x="800" y="900" width="100" height="100" fill="#95FFCC" />
            <rect id="sensor_10" data-score="1" x="900" y="900" width="100" height="100" fill="#D7FFEC" />
          </g>
          <g id="points" fill="darkgreen">
            <text className="points" id="p1" x="50" y="965" textAnchor="middle">1</text>
            <text className="points" id="p2" x="150" y="965" textAnchor="middle">2</text>
            <text className="points" id="p3" x="250" y="965" textAnchor="middle">3</text>
            <text className="points" id="p4" x="350" y="965" textAnchor="middle">2</text>
            <text className="points" id="p5" x="450" y="965" textAnchor="middle">1</text>
            <text className="points" id="p6" x="550" y="965" textAnchor="middle">1</text>
            <text className="points" id="p7" x="650" y="965" textAnchor="middle">2</text>
            <text className="points" id="p8" x="750" y="965" textAnchor="middle">3</text>
            <text className="points" id="p9" x="850" y="965" textAnchor="middle">2</text>
            <text className="points" id="p10" x="950" y="965" textAnchor="middle">1</text>
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
            <rect id="spinner_3" x="745" y="750" rx="5" ry="5" width="10" height="120" fill="#F64E8B" />
            <rect id="spinner_2" x="496" y="750" rx="5" ry="5" width="10" height="120" fill="#D3EE98" />
            <rect id="spinner_1" x="245" y="750" rx="5" ry="5" width="10" height="120" fill="#F64E8B" />
          </g>
          <circle id="ballGraphic" cx="500" cy="50" r="20" fill="url(#ball_gradient)" filter="url(#shadow)" />
          <circle id="anchorGraphic" cx="500" cy="10" r="7" fill="white" stroke="black" filter="url(#shadow)" />
          <g id="shadows">
            <rect id="shadow" width="20" height="1000" fill="black" fillOpacity="0.1" />
            <rect id="shadow_2" x="20" width="980" height="20" fill="black" fillOpacity="0.1" />
          </g>
        </svg>
        <input id="drop_slider" type="range" min="50" max="950" defaultValue="500" />
        <button id="drop_button">DROP</button>
      </div>
    </div>
  );
};

export default Plinko;
