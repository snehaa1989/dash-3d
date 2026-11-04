
import * as THREE from 'three';
import './style.css';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ==========================================
// GAME STATE & STORAGE
// ==========================================

const STORAGE_KEY = 'dash3d_save';

function loadGameData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load game data:', e);
  }
  return {
    highScore: 0,
    totalCoins: 0,
    achievements: [],
    settings: {
      sound: true,
      music: true,
      quality: 'high'
    },
    dailyChallenges: {}
  };
}

function saveGameData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save game data:', e);
  }
}

let gameData = loadGameData();

// ==========================================
// AUDIO SYSTEM
// ==========================================

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = gameData.settings.sound;
let musicEnabled = gameData.settings.music;

function playSound(type) {
  if (!soundEnabled) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  switch (type) {
    case 'coin':
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      break;
    case 'jump':
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
      break;
    case 'collision':
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
    case 'powerup':
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.2);
      oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      break;
  }
}

// ==========================================
// SCENE SETUP
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 120);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

camera.position.set(0, 5, 9);
camera.lookAt(0, 1, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

// ==========================================
// LIGHTING
// ==========================================

const ambientLight = new THREE.HemisphereLight(
  0xffffff,
  0x444444,
  2
);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(-5, 10, 5);
sun.castShadow = true;
scene.add(sun);

// ==========================================
// ENVIRONMENT THEMES
// ==========================================

const themes = {
  day: {
    sky: 0x87ceeb,
    fog: 0x87ceeb,
    fogNear: 30,
    fogFar: 120,
    ambientIntensity: 2,
    sunIntensity: 3
  },
  sunset: {
    sky: 0xff7f50,
    fog: 0xff7f50,
    fogNear: 30,
    fogFar: 120,
    ambientIntensity: 1.5,
    sunIntensity: 2.5
  },
  night: {
    sky: 0x1a1a2e,
    fog: 0x1a1a2e,
    fogNear: 20,
    fogFar: 80,
    ambientIntensity: 0.5,
    sunIntensity: 1
  }
};

let currentTheme = 'day';
let dayNightCycle = 0;

function updateEnvironment(theme) {
  const t = themes[theme];
  scene.background.setHex(t.sky);
  scene.fog.color.setHex(t.fog);
  scene.fog.near = t.fogNear;
  scene.fog.far = t.fogFar;
  ambientLight.intensity = t.ambientIntensity;
  sun.intensity = t.sunIntensity;
  currentTheme = theme;
}

// ==========================================
// WEATHER SYSTEM
// ==========================================

let weather = 'clear';
let rainParticles = null;

function createRain() {
  const rainGeometry = new THREE.BufferGeometry();
  const rainCount = 1000;
  const positions = new Float32Array(rainCount * 3);
  
  for (let i = 0; i < rainCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 1] = Math.random() * 30;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100 - 50;
  }
  
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const rainMaterial = new THREE.PointsMaterial({
    color: 0xaaaaaa,
    size: 0.1,
    transparent: true,
    opacity: 0.6
  });
  
  rainParticles = new THREE.Points(rainGeometry, rainMaterial);
  scene.add(rainParticles);
}

function updateRain() {
  if (!rainParticles || weather !== 'rain') return;
  
  const positions = rainParticles.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] -= 0.5;
    if (positions[i + 1] < 0) {
      positions[i + 1] = 30;
    }
  }
  rainParticles.geometry.attributes.position.needsUpdate = true;
}

function setWeather(type) {
  weather = type;
  if (type === 'rain' && !rainParticles) {
    createRain();
  } else if (type !== 'rain' && rainParticles) {
    scene.remove(rainParticles);
    rainParticles = null;
  }
  
  if (type === 'rain') {
    scene.fog.far = 60;
  } else {
    scene.fog.far = themes[currentTheme].fogFar;
  }
}

// ==========================================
// TRACK
// ==========================================

const track = new THREE.Mesh(
  new THREE.BoxGeometry(9, 0.3, 150),
  new THREE.MeshStandardMaterial({ color: 0x333344 })
);

track.position.set(0, -0.15, -50);
track.receiveShadow = true;
scene.add(track);

// Lane markers
for (let z = 10; z > -130; z -= 5) {
  for (const x of [-1.5, 1.5]) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.02, 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );

    marker.position.set(x, 0.02, z);
    scene.add(marker);
  }
}

// ==========================================
// BACKGROUND ELEMENTS
// ==========================================

const backgroundElements = [];

function createTree(x, z) {
  const tree = new THREE.Group();
  
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2, 8),
    new THREE.MeshStandardMaterial({ color: 0x8B4513 })
  );
  trunk.position.y = 1;
  trunk.castShadow = true;
  tree.add(trunk);
  
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x228B22 })
  );
  leaves.position.y = 3.5;
  leaves.castShadow = true;
  tree.add(leaves);
  
  tree.position.set(x, 0, z);
  scene.add(tree);
  backgroundElements.push({ mesh: tree, type: 'tree' });
}

function createBuilding(x, z) {
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(2, 8, 2),
    new THREE.MeshStandardMaterial({ color: 0x666666 })
  );
  building.position.set(x, 4, z);
  building.castShadow = true;
  scene.add(building);
  backgroundElements.push({ mesh: building, type: 'building' });
}

function createCloud(x, y, z) {
  const cloud = new THREE.Group();
  
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 + Math.random() * 0.5, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    puff.position.set(i * 1.5 - 1.5, Math.random() * 0.5, Math.random() * 0.5);
    cloud.add(puff);
  }
  
  cloud.position.set(x, y, z);
  scene.add(cloud);
  backgroundElements.push({ mesh: cloud, type: 'cloud', speed: 0.02 + Math.random() * 0.02 });
}

// Spawn initial background elements
for (let i = 0; i < 20; i++) {
  const side = Math.random() > 0.5 ? 1 : -1;
  const x = side * (8 + Math.random() * 10);
  const z = -10 - i * 8;
  
  if (Math.random() > 0.5) {
    createTree(x, z);
  } else {
    createBuilding(x, z);
  }
}

for (let i = 0; i < 10; i++) {
  createCloud(
    (Math.random() - 0.5) * 40,
    15 + Math.random() * 10,
    -20 - i * 15
  );
}

// ==========================================
// PARTICLE SYSTEM
// ==========================================

const particles = [];

function createParticle(position, color, velocity) {
  const geometry = new THREE.SphereGeometry(0.1, 4, 4);
  const material = new THREE.MeshBasicMaterial({ color: color });
  const particle = new THREE.Mesh(geometry, material);
  particle.position.copy(position);
  particle.velocity = velocity;
  particle.life = 1.0;
  scene.add(particle);
  particles.push(particle);
}

function spawnCoinParticles(position) {
  for (let i = 0; i < 10; i++) {
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      Math.random() * 0.3,
      (Math.random() - 0.5) * 0.3
    );
    createParticle(position.clone(), 0xffd700, velocity);
  }
}

function spawnDustParticles(position) {
  for (let i = 0; i < 5; i++) {
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.1,
      Math.random() * 0.1,
      (Math.random() - 0.5) * 0.1
    );
    createParticle(position.clone(), 0x8B4513, velocity);
  }
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.position.add(p.velocity);
    p.velocity.y -= 0.01;
    p.life -= delta * 2;
    p.scale.setScalar(p.life);
    
    if (p.life <= 0) {
      scene.remove(p);
      particles.splice(i, 1);
    }
  }
}

// ==========================================
// PLAYER
// ==========================================

const player = new THREE.Group();
player.position.set(0, 0, 3);
scene.add(player);

const loader = new GLTFLoader();

let mixer = null;

loader.load(
  '/models/player.glb',
  (gltf) => {
    const playerModel = gltf.scene;

    playerModel.scale.set(1, 1, 1);
    playerModel.position.set(0, 0, 0);

    playerModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    player.add(playerModel);

    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(playerModel);

      const runAnimation =
        gltf.animations.find((animation) =>
          animation.name.toLowerCase().includes('run')
        ) || gltf.animations[0];

      mixer.clipAction(runAnimation).play();
    }

    console.log('Player model loaded successfully!');
  },
  undefined,
  (error) => {
    console.error('Failed to load player model:', error);
  }
);

// ==========================================
// GAME CONFIGURATION
// ==========================================

const lanePositions = [-3, 0, 3];

let currentLane = 1;
let targetX = 0;

let velocityY = 0;
let isJumping = false;
let jumpCount = 0;
const maxJumps = 2;

let isSliding = false;
let slideTimer = 0;
const slideDuration = 0.5;

let gameOver = false;
let gameStarted = false;
let isPaused = false;
let score = 0;
let coinsCollected = 0;
let combo = 0;
let comboTimer = 0;
const comboTimeout = 2.0;
let speed = 0.25;
let level = 1;

const gravity = -0.025;
const jumpForce = 0.45;

// Power-up states
let activePowerup = null;
let powerupTimer = 0;
let invincible = false;
let magnetActive = false;
let speedBoost = false;

// Achievements
const achievementDefinitions = [
  { id: 'first_coin', name: 'First Coin', description: 'Collect your first coin', condition: () => coinsCollected >= 1 },
  { id: 'score_100', name: 'Century', description: 'Score 100 points', condition: () => score >= 100 },
  { id: 'score_500', name: 'Half Thousand', description: 'Score 500 points', condition: () => score >= 500 },
  { id: 'score_1000', name: 'Thousand Club', description: 'Score 1000 points', condition: () => score >= 1000 },
  { id: 'coins_50', name: 'Coin Collector', description: 'Collect 50 coins total', condition: () => gameData.totalCoins >= 50 },
  { id: 'combo_10', name: 'Combo Master', description: 'Reach 10x combo', condition: () => combo >= 10 },
  { id: 'level_5', name: 'Level Up', description: 'Reach level 5', condition: () => level >= 5 },
  { id: 'survivor', name: 'Survivor', description: 'Play for 60 seconds', condition: () => false } // Track time
];

let gameTime = 0;

function checkAchievements() {
  achievementDefinitions.forEach(achievement => {
    if (!gameData.achievements.includes(achievement.id) && achievement.condition()) {
      gameData.achievements.push(achievement.id);
      saveGameData(gameData);
      console.log('Achievement unlocked:', achievement.name);
    }
  });
}

// Daily Challenges
function getDailyChallengeId() {
  const today = new Date().toDateString();
  return `challenge_${today}`;
}

function generateDailyChallenges() {
  const id = getDailyChallengeId();
  if (!gameData.dailyChallenges[id]) {
    gameData.dailyChallenges[id] = [
      { type: 'score', target: 200, progress: 0, completed: false },
      { type: 'coins', target: 20, progress: 0, completed: false }
    ];
    saveGameData(gameData);
  }
  return gameData.dailyChallenges[id];
}

let dailyChallenges = generateDailyChallenges();

function updateDailyChallenges() {
  dailyChallenges.forEach(challenge => {
    if (challenge.completed) return;
    
    switch (challenge.type) {
      case 'score':
        challenge.progress = score;
        break;
      case 'coins':
        challenge.progress = coinsCollected;
        break;
    }
    
    if (challenge.progress >= challenge.target) {
      challenge.completed = true;
    }
  });
  saveGameData(gameData);
}

// ==========================================
// HUD
// ==========================================

const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('hud-high-score');
const coinsElement = document.getElementById('coins');
const comboElement = document.getElementById('combo');
const levelElement = document.getElementById('level');
const powerupIndicator = document.getElementById('powerup-indicator');
const gameOverElement = document.getElementById('game-over');
const startScreen = document.getElementById('start-screen');
const pauseMenu = document.getElementById('pause-menu');
const settingsPanel = document.getElementById('settings-panel');
const achievementsPanel = document.getElementById('achievements-panel');
const challengesPanel = document.getElementById('challenges-panel');

function updateHUD() {
  if (scoreElement) scoreElement.textContent = score;
  if (highScoreElement) highScoreElement.textContent = gameData.highScore;
  if (coinsElement) coinsElement.textContent = coinsCollected;
  if (comboElement) comboElement.textContent = combo;
  if (levelElement) levelElement.textContent = level;
  
  if (powerupIndicator) {
    if (activePowerup) {
      powerupIndicator.textContent = `${activePowerup.toUpperCase()}: ${Math.ceil(powerupTimer)}s`;
      powerupIndicator.classList.add('active');
    } else {
      powerupIndicator.classList.remove('active');
    }
  }
}

function updateStartScreen() {
  const highScoreDisplay = document.getElementById('high-score');
  if (highScoreDisplay) {
    highScoreDisplay.textContent = gameData.highScore;
  }
}

updateStartScreen();

// ==========================================
// OBSTACLES
// ==========================================

const obstacles = [];

function randomLane() {
  return lanePositions[
    Math.floor(Math.random() * lanePositions.length)
  ];
}

function spawnObstacle(z = -40) {
  const type = Math.random();
  let obstacle;
  
  if (type < 0.5) {
    // Normal obstacle
    obstacle = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xff4444 })
    );
    obstacle.position.y = 0.7;
    obstacle.userData = { type: 'normal', height: 1.4 };
  } else if (type < 0.75) {
    // Tall obstacle (can't jump over)
    obstacle = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 3, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    obstacle.position.y = 1.5;
    obstacle.userData = { type: 'tall', height: 3 };
  } else {
    // Flying obstacle (must slide under)
    obstacle = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xff8800 })
    );
    obstacle.position.y = 1.8;
    obstacle.userData = { type: 'flying', height: 1, baseY: 1.8 };
  }
  
  obstacle.position.set(randomLane(), obstacle.position.y, z);
  obstacle.castShadow = true;
  
  scene.add(obstacle);
  obstacles.push(obstacle);
}

for (let i = 0; i < 8; i++) {
  spawnObstacle(-15 - i * 15);
}

// ==========================================
// COIN SYSTEM
// ==========================================

const coins = [];

let coinTemplate = null;
const coinCount = 15;

function createCoin(z) {
  if (!coinTemplate) return;

  const coinGroup = new THREE.Group();

  const coinModel = coinTemplate.clone(true);
  coinGroup.add(coinModel);

  coinGroup.position.set(randomLane(), 1.1, z);

  scene.add(coinGroup);

  coins.push({
    mesh: coinGroup,
    collected: false,
    rotationSpeed: 0.04 + Math.random() * 0.03,
    floatOffset: Math.random() * Math.PI * 2
  });
}

// Load the 3D coin model.
loader.load(
  '/models/coin.glb',
  (gltf) => {
    coinTemplate = gltf.scene;

    // Normalize the model so it has a predictable size.
    const box = new THREE.Box3().setFromObject(coinTemplate);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDimension = Math.max(size.x, size.y, size.z);

    if (maxDimension > 0) {
      const scale = 1 / maxDimension;

      coinTemplate.scale.setScalar(scale);

      coinTemplate.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      );
    }

    coinTemplate.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Spawn the initial coins.
    for (let i = 0; i < coinCount; i++) {
      createCoin(-12 - i * 9);
    }

    console.log('Coin model loaded successfully!');
    console.log('Spawned', coinCount, 'coins.');
  },
  undefined,
  (error) => {
    console.error('Failed to load coin model:', error);
    console.error('Check that public/models/coin.glb exists.');
  }
);

// ==========================================
// POWER-UP SYSTEM
// ==========================================

const powerups = [];
const powerupTypes = ['speed', 'invincibility', 'magnet'];
const powerupColors = {
  speed: 0x00ff00,
  invincibility: 0xff00ff,
  magnet: 0x00ffff
};

function createPowerup(z) {
  const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
  const geometry = new THREE.OctahedronGeometry(0.5);
  const material = new THREE.MeshStandardMaterial({ 
    color: powerupColors[type],
    emissive: powerupColors[type],
    emissiveIntensity: 0.5
  });
  const powerup = new THREE.Mesh(geometry, material);
  
  powerup.position.set(randomLane(), 1.5, z);
  powerup.castShadow = true;
  powerup.userData = { type, collected: false };
  
  scene.add(powerup);
  powerups.push(powerup);
}

// Spawn initial powerups
for (let i = 0; i < 3; i++) {
  createPowerup(-30 - i * 40);
}

function activatePowerup(type) {
  activePowerup = type;
  powerupTimer = 5; // 5 seconds
  playSound('powerup');
  
  switch (type) {
    case 'speed':
      speedBoost = true;
      speed *= 1.5;
      break;
    case 'invincibility':
      invincible = true;
      break;
    case 'magnet':
      magnetActive = true;
      break;
  }
}

function deactivatePowerup() {
  switch (activePowerup) {
    case 'speed':
      speedBoost = false;
      speed /= 1.5;
      break;
    case 'invincibility':
      invincible = false;
      break;
    case 'magnet':
      magnetActive = false;
      break;
  }
  activePowerup = null;
  powerupTimer = 0;
}

// ==========================================
// PLAYER MOVEMENT
// ==========================================

function moveLeft() {
  if (currentLane > 0 && !gameOver && !isPaused) {
    currentLane--;
    targetX = lanePositions[currentLane];
  }
}

function moveRight() {
  if (currentLane < 2 && !gameOver && !isPaused) {
    currentLane++;
    targetX = lanePositions[currentLane];
  }
}

function jump() {
  if (!gameOver && !isPaused) {
    if (jumpCount < maxJumps) {
      isJumping = true;
      velocityY = jumpForce;
      jumpCount++;
      playSound('jump');
      spawnDustParticles(player.position);
    }
  }
}

function slide() {
  if (!isSliding && !isJumping && !gameOver && !isPaused) {
    isSliding = true;
    slideTimer = slideDuration;
    player.scale.y = 0.5;
    player.position.y = -0.25;
  }
}

// ==========================================
// GAME STATE MANAGEMENT
// ==========================================

const hudElement = document.getElementById('hud');

function startGame() {
  gameStarted = true;
  gameOver = false;
  isPaused = false;
  
  score = 0;
  coinsCollected = 0;
  combo = 0;
  speed = 0.25;
  level = 1;
  gameTime = 0;
  
  currentLane = 1;
  targetX = 0;
  velocityY = 0;
  isJumping = false;
  jumpCount = 0;
  isSliding = false;
  
  activePowerup = null;
  powerupTimer = 0;
  invincible = false;
  magnetActive = false;
  speedBoost = false;
  
  player.position.set(0, 0, 3);
  player.scale.set(1, 1, 1);
  
  obstacles.forEach((obstacle, index) => {
    obstacle.position.z = -15 - index * 15;
    obstacle.position.x = randomLane();
  });
  
  coins.forEach((coin, index) => {
    coin.collected = false;
    coin.mesh.visible = true;
    coin.mesh.position.z = -12 - index * 9;
    coin.mesh.position.x = randomLane();
  });
  
  powerups.forEach((powerup, index) => {
    powerup.userData.collected = false;
    powerup.visible = true;
    powerup.position.z = -30 - index * 40;
    powerup.position.x = randomLane();
  });
  
  updateEnvironment('day');
  setWeather('clear');
  
  if (startScreen) startScreen.classList.add('hidden');
  if (gameOverElement) gameOverElement.classList.add('hidden');
  if (pauseMenu) pauseMenu.classList.add('hidden');
  if (hudElement) hudElement.classList.remove('hidden');
  
  updateHUD();
}

function restartGame() {
  startGame();
}

function pauseGame() {
  if (!gameOver && gameStarted) {
    isPaused = true;
    pauseMenu.classList.remove('hidden');
  }
}

function resumeGame() {
  isPaused = false;
  pauseMenu.classList.add('hidden');
}

function quitToMenu() {
  gameStarted = false;
  gameOver = false;
  isPaused = false;
  
  pauseMenu.classList.add('hidden');
  gameOverElement.classList.add('hidden');
  hudElement.classList.add('hidden');
  startScreen.classList.remove('hidden');
  
  updateStartScreen();
}

function endGame() {
  gameOver = true;
  playSound('collision');
  
  // Update high score
  if (score > gameData.highScore) {
    gameData.highScore = score;
  }
  gameData.totalCoins += coinsCollected;
  saveGameData(gameData);
  
  // Update game over screen
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-coins').textContent = coinsCollected;
  document.getElementById('final-high-score').textContent = gameData.highScore;
  
  // Check for newly unlocked achievements
  const newAchievements = achievementDefinitions.filter(a => 
    gameData.achievements.includes(a.id) && !a.previouslyUnlocked
  );
  
  if (newAchievements.length > 0) {
    const achievementsDiv = document.getElementById('achievements-unlocked');
    achievementsDiv.innerHTML = '<p>Achievements Unlocked:</p>' +
      newAchievements.map(a => `<p>🏆 ${a.name}</p>`).join('');
  }
  
  gameOverElement.classList.remove('hidden');
}

// ==========================================
// KEYBOARD CONTROLS
// ==========================================

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (isPaused) {
      resumeGame();
    } else if (gameStarted && !gameOver) {
      pauseGame();
    }
    return;
  }
  
  if (isPaused || !gameStarted) return;

  switch (event.key.toLowerCase()) {
    case 'a':
    case 'arrowleft':
      moveLeft();
      break;

    case 'd':
    case 'arrowright':
      moveRight();
      break;

    case 'w':
    case 'arrowup':
    case ' ':
      event.preventDefault();
      jump();
      break;
      
    case 's':
    case 'arrowdown':
      event.preventDefault();
      slide();
      break;
  }
});

// ==========================================
// UI EVENT LISTENERS
// ==========================================

document.getElementById('start-btn')?.addEventListener('click', startGame);
document.getElementById('restart')?.addEventListener('click', restartGame);
document.getElementById('menu-btn')?.addEventListener('click', quitToMenu);
document.getElementById('resume-btn')?.addEventListener('click', resumeGame);
document.getElementById('settings-btn')?.addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  settingsPanel.classList.remove('hidden');
});
document.getElementById('quit-btn')?.addEventListener('click', quitToMenu);
document.getElementById('settings-back')?.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
});
document.getElementById('sound-toggle')?.addEventListener('click', (e) => {
  soundEnabled = !soundEnabled;
  e.target.textContent = soundEnabled ? 'ON' : 'OFF';
  gameData.settings.sound = soundEnabled;
  saveGameData(gameData);
});
document.getElementById('music-toggle')?.addEventListener('click', (e) => {
  musicEnabled = !musicEnabled;
  e.target.textContent = musicEnabled ? 'ON' : 'OFF';
  gameData.settings.music = musicEnabled;
  saveGameData(gameData);
});
document.getElementById('quality-btn')?.addEventListener('click', (e) => {
  const qualities = ['low', 'medium', 'high'];
  const current = qualities.indexOf(gameData.settings.quality);
  const next = (current + 1) % qualities.length;
  gameData.settings.quality = qualities[next];
  e.target.textContent = qualities[next].toUpperCase();
  
  const pixelRatio = gameData.settings.quality === 'high' ? 2 : gameData.settings.quality === 'medium' ? 1.5 : 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatio));
  saveGameData(gameData);
});
document.getElementById('achievements-close')?.addEventListener('click', () => {
  achievementsPanel.classList.add('hidden');
});
document.getElementById('challenges-close')?.addEventListener('click', () => {
  challengesPanel.classList.add('hidden');
});

// ==========================================
// MOBILE CONTROLS
// ==========================================

document.getElementById('mobile-left')?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  moveLeft();
});
document.getElementById('mobile-right')?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  moveRight();
});
document.getElementById('mobile-jump')?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  jump();
});
document.getElementById('mobile-slide')?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  slide();
});

// Show mobile controls on touch devices
if ('ontouchstart' in window) {
  document.getElementById('mobile-controls')?.classList.remove('hidden');
}

// ==========================================
// MAIN GAME LOOP
// ==========================================

const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);

  if (!isPaused && gameStarted && !gameOver) {
    gameTime += delta;
    
    // Update combo timer
    if (combo > 0) {
      comboTimer -= delta;
      if (comboTimer <= 0) {
        combo = 0;
      }
    }
    
    // Update power-up timer
    if (activePowerup) {
      powerupTimer -= delta;
      if (powerupTimer <= 0) {
        deactivatePowerup();
      }
    }
    
    // Update slide timer
    if (isSliding) {
      slideTimer -= delta;
      if (slideTimer <= 0) {
        isSliding = false;
        player.scale.y = 1;
        player.position.y = 0;
      }
    }

    // Smooth lane movement.
    player.position.x += (targetX - player.position.x) * 0.2;

    // Jump physics.
    if (isJumping) {
      player.position.y += velocityY;
      velocityY += gravity;

      if (player.position.y <= 0) {
        player.position.y = 0;
        velocityY = 0;
        isJumping = false;
        jumpCount = 0;
        spawnDustParticles(player.position);
      }
    }

    // Move obstacles.
    obstacles.forEach((obstacle) => {
      obstacle.position.z += speed;

      // Recycle obstacles.
      if (obstacle.position.z > 10) {
        obstacle.position.z = -110;
        obstacle.position.x = randomLane();
        
        // Randomize obstacle type on respawn
        const type = Math.random();
        if (type < 0.5) {
          obstacle.userData.type = 'normal';
          obstacle.userData.height = 1.4;
          obstacle.scale.y = 1;
          obstacle.position.y = 0.7;
        } else if (type < 0.75) {
          obstacle.userData.type = 'tall';
          obstacle.userData.height = 3;
          obstacle.scale.y = 1;
          obstacle.position.y = 1.5;
        } else {
          obstacle.userData.type = 'flying';
          obstacle.userData.height = 1;
          obstacle.scale.y = 1;
          obstacle.position.y = 1.8;
        }

        score += 10;
        speed = Math.min(speed + 0.001, 0.6);
        
        // Level progression
        if (score >= level * 200) {
          level++;
          
          // Change environment based on level
          if (level % 3 === 0) {
            const themes = ['day', 'sunset', 'night'];
            updateEnvironment(themes[level % 3]);
          }
          
          // Random weather
          if (level % 5 === 0 && Math.random() > 0.5) {
            setWeather('rain');
          }
        }
      }

      // Obstacle collision detection.
      const sameLane = Math.abs(player.position.x - obstacle.position.x) < 1;
      const closeEnough = Math.abs(player.position.z - obstacle.position.z) < 1.3;
      
      let collision = false;
      
      if (sameLane && closeEnough) {
        const obstacleType = obstacle.userData.type;
        const playerHeight = isSliding ? 0.5 : player.position.y + 1;
        
        if (obstacleType === 'flying') {
          // Flying obstacle - must slide under
          if (playerHeight > 1.2) {
            collision = true;
          }
        } else if (obstacleType === 'tall') {
          // Tall obstacle - can't jump over
          if (player.position.y < 2.5) {
            collision = true;
          }
        } else {
          // Normal obstacle
          if (player.position.y < 0.8) {
            collision = true;
          }
        }
      }
      
      if (collision && !invincible) {
        endGame();
      }
    });

    // Move and animate coins.
    coins.forEach((coin) => {
      if (coin.collected) return;

      const coinMesh = coin.mesh;

      // Move coin towards player.
      coinMesh.position.z += speed;

      // Rotate coin.
      coinMesh.rotation.y += coin.rotationSpeed;

      // Floating animation.
      coinMesh.position.y = 1.1 + Math.sin(clock.elapsedTime * 3 + coin.floatOffset) * 0.15;

      // Magnet effect
      if (magnetActive) {
        const dx = player.position.x - coinMesh.position.x;
        const dz = player.position.z - coinMesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < 5) {
          coinMesh.position.x += dx * 0.1;
          coinMesh.position.z += dz * 0.1;
        }
      }

      // Collect coin when player reaches it.
      const sameLane = Math.abs(player.position.x - coinMesh.position.x) < 1.5;
      const closeEnough = Math.abs(player.position.z - coinMesh.position.z) < 1.5;

      if (sameLane && closeEnough) {
        coin.collected = true;
        coinMesh.visible = false;
        coinsCollected++;
        combo++;
        comboTimer = comboTimeout;
        score += 10 * combo;
        
        playSound('coin');
        spawnCoinParticles(coinMesh.position);
        checkAchievements();
        updateDailyChallenges();
        updateHUD();
      }

      // Respawn collected or passed coins.
      if (coinMesh.position.z > 10) {
        coin.collected = false;
        coinMesh.visible = true;
        coinMesh.position.z = -120 - Math.random() * 25;
        coinMesh.position.x = randomLane();
      }
    });
    
    // Move and animate power-ups
    powerups.forEach((powerup) => {
      if (powerup.userData.collected) return;
      
      powerup.position.z += speed;
      powerup.rotation.y += 0.05;
      powerup.rotation.x += 0.02;
      
      const sameLane = Math.abs(player.position.x - powerup.position.x) < 1.5;
      const closeEnough = Math.abs(player.position.z - powerup.position.z) < 1.5;
      
      if (sameLane && closeEnough) {
        powerup.userData.collected = true;
        powerup.visible = false;
        activatePowerup(powerup.userData.type);
        updateHUD();
      }
      
      // Respawn power-ups
      if (powerup.position.z > 10) {
        powerup.userData.collected = false;
        powerup.visible = true;
        powerup.position.z = -150 - Math.random() * 50;
        powerup.position.x = randomLane();
        powerup.userData.type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        powerup.material.color.setHex(powerupColors[powerup.userData.type]);
        powerup.material.emissive.setHex(powerupColors[powerup.userData.type]);
      }
    });
    
    // Update background elements
    backgroundElements.forEach((element) => {
      element.mesh.position.z += speed * 0.5;
      
      if (element.type === 'cloud') {
        element.mesh.position.x += element.speed;
      }
      
      // Recycle background elements
      if (element.mesh.position.z > 20) {
        element.mesh.position.z = -100 - Math.random() * 50;
        if (element.type !== 'cloud') {
          const side = Math.random() > 0.5 ? 1 : -1;
          element.mesh.position.x = side * (8 + Math.random() * 10);
        }
      }
    });
    
    // Update particles
    updateParticles(delta);
    
    // Update rain
    updateRain();
    
    // Day/night cycle (slow transition)
    dayNightCycle += delta * 0.01;
    if (dayNightCycle > 1) {
      dayNightCycle = 0;
      const cycle = Math.floor(gameTime / 30) % 3;
      const themes = ['day', 'sunset', 'night'];
      updateEnvironment(themes[cycle]);
    }

    updateHUD();
  }

  // Update player animation.
  if (mixer && !gameOver && !isPaused) {
    mixer.update(delta);
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// ==========================================
// RESPONSIVE WINDOW
// ==========================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
