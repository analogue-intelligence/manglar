require('example')
require('Matter')

function setup() {
  createCanvas(400, 400);
  walker = new Walker(color(255,176,217));
  walker2 = new Walker(color(176,207,255, 100));
}

function draw() {
  walker.step();
  walker.show();

  walker2.step();
  walker2.show();

}

function drawNoise() {
  let step = 0.4;
  for (let i = 0; i < width/2; i++) {
    new_x = map(noise(step), 0, 1, 0, height);
    strokeWeight(5);
    stroke(0, 255, 0);
    point(i, new_x);

    step += 0.09;
  }
}

function drawRandom() {
  for (let x = width/2; x < width; x++) {
    strokeWeight(5);
    stroke(255, 0, 0);
    point(x, map(random(), 0, 1, 0, height));
  }
}


class Walker {
  constructor(new_color) {
    this.x = random(0, height);
    this.y = random(0, width);
    this.color = new_color;

    this.xoff = 0;
    this.yoff = 1000;
  }

  step() {
    this.x = map(noise(this.xoff), 0, 1, 0, width);
    this.y = map(noise(this.yoff), 0, 1, 0, height);

    this.xoff += 0.005;
    this.yoff += 0.005;
  }

  show() {
    stroke(this.color);
    rect(this.x, this.y, 30, 30);
  }
}