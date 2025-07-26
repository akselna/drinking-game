// Based on matter.js plinko example
const { Engine, Runner, Bodies, World, Events, Constraint } = Matter;

const svg = document.getElementById('svg');
const modeSelect = document.getElementById('mode_select');
const dropSlider = document.getElementById('drop_slider');
const dropButton = document.getElementById('drop_button');
const scoreText = document.getElementById('scoreText');

const engine = Engine.create();
const runner = Runner.create();

const vbWidth = 1000;
const vbHeight = 1000;

let ballBody, anchorBody, anchorConstraint;
let sensors = [];
let dropped = false;

const mildScores = [10,20,30,20,10,10,20,30,20,10];
const hardcoreScores = [30,50,100,50,30,30,50,100,50,30];

function initSVG() {
  svg.setAttribute('viewBox', '0 0 1000 1000');
  // basic board from provided HTML
  svg.innerHTML = `
    <defs>
      <filter id="shadow" width="140%" height="140%">
        <feDropShadow dx="10" dy="10" stdDeviation="0" flood-color="black" flood-opacity=".3" />
      </filter>
      <radialGradient id="ball_gradient" cx="20%" cy="20%" fx="20%" fy="20%">
        <stop offset="0%" stop-color="#FF7373" />
        <stop offset="100%" stop-color="#790202" />
      </radialGradient>
    </defs>
    <rect width="1000" height="1000" fill="#555" />
    <path id="chain" d="" stroke="white" stroke-width="3" />
    <g id="pegs" fill="#FEFF9F"></g>
    <g id="sensors"></g>
    <g id="points" fill="darkgreen"></g>
    <g id="cupwalls"></g>
    <circle id="ballGraphic" cx="500" cy="50" r="20" fill="url(#ball_gradient)"/>
    <circle id="anchorGraphic" cx="500" cy="10" r="7" fill="white" stroke="black"/>
  `;
}

function createBoard() {
  const pegGroup = svg.querySelector('#pegs');
  pegGroup.innerHTML = '';
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 11; c++) {
      const offset = (r % 2) * 45;
      const cx = 58 + c * 79 + offset;
      const cy = 210 + r * 70;
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', 10);
      pegGroup.appendChild(circle);
    }
  }

  const cupGroup = svg.querySelector('#cupwalls');
  cupGroup.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', 95 + i*100);
    rect.setAttribute('y', 890);
    rect.setAttribute('width', 10);
    rect.setAttribute('height', 110);
    rect.setAttribute('fill', '#202020');
    cupGroup.appendChild(rect);
  }
}

function createSensors(scores) {
  const sensorGroup = svg.querySelector('#sensors');
  sensorGroup.innerHTML = '';
  const pointsGroup = svg.querySelector('#points');
  pointsGroup.innerHTML = '';
  // remove old bodies
  sensors.forEach(b => World.remove(engine.world, b));
  sensors = [];
  scores.forEach((score, i) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', i*100);
    rect.setAttribute('y', 900);
    rect.setAttribute('width', 100);
    rect.setAttribute('height', 100);
    rect.setAttribute('data-score', score);
    rect.setAttribute('fill', '#95FFCC');
    rect.id = `sensor_${i}`;
    sensorGroup.appendChild(rect);

    const body = Bodies.rectangle(i*100+50, 950, 100, 50, {
      isStatic: true,
      isSensor: true
    });
    body.element = rect;
    sensors.push(body);
    World.add(engine.world, body);

    const text = document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x', i*100 + 50);
    text.setAttribute('y', 965);
    text.setAttribute('text-anchor', 'middle');
    text.classList.add('points');
    text.textContent = score;
    pointsGroup.appendChild(text);
  });
}

function initBodies() {
  const ballGraphic = document.getElementById('ballGraphic');
  const r = parseInt(ballGraphic.getAttribute('r'));
  ballBody = Bodies.circle(500, 50, r, { restitution:0.6 });

  const anchorGraphic = document.getElementById('anchorGraphic');
  anchorBody = Bodies.circle(500, 10, 7, { isStatic:true });

  anchorConstraint = Constraint.create({
    bodyA: anchorBody,
    bodyB: ballBody,
    stiffness:0.1,
    length:75
  });

  const floor = Bodies.rectangle(500, vbHeight+25, vbWidth, 50, { isStatic:true });
  const leftWall = Bodies.rectangle(-25, vbHeight/2, 50, vbHeight, { isStatic:true });
  const rightWall = Bodies.rectangle(vbWidth+25, vbHeight/2, 50, vbHeight, { isStatic:true });

  World.add(engine.world, [ballBody, anchorBody, anchorConstraint, floor, leftWall, rightWall]);
}

function init() {
  initSVG();
  createBoard();
  createSensors(mildScores);
  initBodies();
  Runner.run(runner, engine);
  requestAnimationFrame(update);
}

function dropBall() {
  dropped = true;
  const x = parseInt(dropSlider.value);
  Matter.Body.setPosition(ballBody,{x:x,y:50});
  Matter.Body.setPosition(anchorBody,{x:x,y:10});
  World.remove(engine.world, anchorConstraint);
  dropButton.textContent = 'RESET';
}

function reset() {
  dropped = false;
  World.add(engine.world, anchorConstraint);
  Matter.Body.setPosition(ballBody,{x:parseInt(dropSlider.value),y:50});
  Matter.Body.setPosition(anchorBody,{x:parseInt(dropSlider.value),y:10});
  dropButton.textContent = 'DROP';
  scoreText.textContent = '~ 0 ~';
}

function update() {
  const pos = ballBody.position;
  document.getElementById('ballGraphic').setAttribute('cx', pos.x);
  document.getElementById('ballGraphic').setAttribute('cy', pos.y);
  document.getElementById('anchorGraphic').setAttribute('cx', anchorBody.position.x);
  const chain = document.getElementById('chain');
  if(!dropped){
    chain.setAttribute('d',`M${pos.x},${pos.y} L${anchorBody.position.x},${anchorBody.position.y}`);
  } else {
    chain.setAttribute('d','');
  }
  requestAnimationFrame(update);
}

modeSelect.addEventListener('change', e=>{
  const mode = modeSelect.value;
  const scores = mode==='hardcore' ? hardcoreScores : mildScores;
  createSensors(scores);
});

dropSlider.addEventListener('input', e=>{
  if(dropped) return;
  const x = parseInt(dropSlider.value);
  Matter.Body.setPosition(ballBody,{x:x,y:50});
  Matter.Body.setPosition(anchorBody,{x:x,y:10});
});

dropButton.addEventListener('click', ()=>{
  if(!dropped){
    dropBall();
  } else {
    reset();
  }
});

Events.on(engine, 'collisionStart', event=>{
  event.pairs.forEach(pair=>{
    const {bodyA, bodyB} = pair;
    const sensor = sensors.find(s=>s === bodyA || s === bodyB);
    if(sensor){
      const score = sensor.element.getAttribute('data-score');
      scoreText.textContent = `~ ${score} ~`;
    }
  });
});

init();
