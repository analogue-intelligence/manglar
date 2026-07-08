// AI assisted recode of my first ever Processing Sketch (April 2012)

// Module aliases for Matter.js
let Engine = Matter.Engine,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Body = Matter.Body;

let engine;
let world;

// Elements from the original code
let particles = []; // Array to hold all particles in the simulation
let nails = []; // Array to hold all nails (pegs) in the simulation
let walls = []; // Array to hold all walls in the simulation
let floor; // Variable to hold the floor body

// GLOBALS
let topMargin = 40;
let leftMargin = 20;
let rightMargin = 20;
let wallWidth = 2;
let d = 3; // Nail diameter
let s = 2 * d; // Particle diameter
let r = 10 * d; // Diagonal of the square
let nbLines;
let highThreshold, lowThreshold;
let minFramerate = 40;
let currentFrame = 0;
let maxKill = 10;
let freq = 20;
let wallHeight;
let particleNearTopFrameCount = 0;
let stopDropping = false;
let lowVelocityFrames = new Map(); // Map to keep track of how long particles have had low velocity
let velocityThresholdSquared = 0.1 ** 2; // Squared threshold for considering a particle as having low velocity
let dampingThreshold = 120; // 2 seconds at 60 FPS

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 255);
  frameRate(60);
  
  // Initialize the Matter.js engine
  engine = Engine.create();
  world = engine.world;
  
  // Calculate number of lines and wall height
  nbLines = int((width - leftMargin - rightMargin) / (2 * r));
  let lastPegY = nbLines * r + topMargin;
  wallHeight = height - lastPegY;

  // Define the "full" zone
  highThreshold = nbLines * r + topMargin;
  lowThreshold = nbLines * r + r + topMargin + 2 * s;

  // Create nails (pegs)
  let lastRowPegCount = 1;
  for (let i = 0; i < nbLines; i++) {
    for (let j = 0; j <= i; j++) {
      let x = width / 2 - i * r + 2 * j * r;
      let y = i * r + topMargin;
      let nail = Bodies.circle(x, y, d, { isStatic: true, restitution: 0.9 });
      nails.push(nail);
      World.add(world, nail);
      lastRowPegCount = i;
    }
  }

  // Create evenly spaced walls
  let numWalls = lastRowPegCount + 1;
  let spacing = width / (numWalls + 1);
  for (let i = 0; i < numWalls; i++) {
    let x = spacing * (i + 1);
    let y = height - wallHeight / 2;
    let wall = Bodies.rectangle(x, y, wallWidth, wallHeight, { isStatic: true });
    walls.push(wall);
    World.add(world, wall);
  }

  // Create floor
  floor = Bodies.rectangle(width / 2, height + 10, width, 20, { isStatic: true, restitution: 0.8 });
  World.add(world, floor);
}

function draw() {
  background(0);

  // Update the physics engine
  Engine.update(engine, 1000 / 60, 1);

  // Check if any particle is near the top of the wall
  let particleNearTop = false;
  for (let p of particles) {
    if (p.position.y > height - wallHeight && p.position.y < height - wallHeight + 20) {
      particleNearTop = true;
      break;
    }
  }

  // Increment or reset the counter if a particle is near the top of the wall
  if (particleNearTop) {
    particleNearTopFrameCount++;
  } else {
    particleNearTopFrameCount = 0;
  }

  // If particles have stayed near the top for too long, stop dropping new particles and remove the floor
  if (particleNearTopFrameCount > 60) {
    stopDropping = true;
    if (Matter.Composite.allBodies(world).includes(floor)) {
      World.remove(world, floor);
    }
  }

  // If all particles are out of bounds, reset the floor and allow dropping again
  if (stopDropping) {
    let allOutOfBounds = particles.every(p => isParticleOutOfBounds(p));
    if (allOutOfBounds) {
      stopDropping = false;
      floor = Bodies.rectangle(width / 2, height + 10, width, 20, { isStatic: true, restitution: 0.8 });
      World.add(world, floor);
    }
  }

  // Launch particles based on the frame rate if not stopped
  if (!stopDropping && currentFrame % freq == 0 && frameRate() > minFramerate) {
    launchParticle();
  }

  // Remove out-of-bounds particles using filter instead of splice to improve performance
  particles = particles.filter(p => {
    if (isParticleOutOfBounds(p)) {
      World.remove(world, p);
      lowVelocityFrames.delete(p); // Remove particle from low velocity tracking map
      return false;
    }
    return true;
  });

  // Track particle velocities to determine when to apply damping
  for (let p of particles) {
    let velocityMagnitudeSquared = p.velocity.x ** 2 + p.velocity.y ** 2;
    if (velocityMagnitudeSquared < velocityThresholdSquared) {
      // Increment the low velocity frame count for the particle
      if (!lowVelocityFrames.has(p)) {
        lowVelocityFrames.set(p, 1);
      } else {
        lowVelocityFrames.set(p, lowVelocityFrames.get(p) + 1);
      }
    } else {
      // Reset the low velocity frame count if the particle's velocity increases
      lowVelocityFrames.set(p, 0);
    }

    // Reduce the restitution of particles that have been moving slowly for too long
    if (lowVelocityFrames.get(p) > dampingThreshold) {
      let currentRestitution = p.restitution;
      let newRestitution = max(0, currentRestitution - 0.01);
      p.restitution = newRestitution;
    }
  }

  // Display the nails
  noStroke();
  fill(150, 255);
  for (let nail of nails) {
    let pos = nail.position;
    ellipse(pos.x, pos.y, d * 2);
  }

  // Display the particles
  fill(255);
  for (let p of particles) {
    let pos = p.position;
    ellipse(pos.x, pos.y, s * 2);
  }

  // Display the walls
  fill(255);
  for (let wall of walls) {
    let pos = wall.position;
    rectMode(CENTER);
    rect(pos.x, pos.y, wallWidth, wallHeight);
  }

  currentFrame++;
}

function launchParticle() {
  let x = width / 2;
  let y = s * 2;
  let particle = Bodies.circle(x, y, s, { restitution: 0.8, friction: 0.1, density: 0.002 });
  
  // Give it a random initial velocity (and angular velocity)
  Matter.Body.setVelocity(particle, { x: random(-0.5, 0.5), y: 0 });
  Matter.Body.setAngularVelocity(particle, 0);
  
  particles.push(particle);
  World.add(world, particle);
}

function isParticleOutOfBounds(p) {
  return p.position.y > height + s * 2;
}