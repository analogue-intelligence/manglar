// Created by Raphaël de Courville
// Birb Code Library 🦉

// Originally released on Patreon:
// https://patreon.com/sableraph

// Join the Birb's Nest community:
// https://discord.gg/S8c7qcjw2b

// 📅 Created: 20.01.2018
// 📝 Last updated: 16.05.2022

// Voice-controlled character

var mic;

function setup() { // called once at startup
  createCanvas(windowWidth, windowHeight);
	//frameRate(60);
  noiseDetail(2,0.8);
  
  mic = new p5.AudioIn();
  mic.start();
  
}

function draw() { // called again, and again, and again....
  
  var micLevel = mic.getLevel();
  
	background(	200, 65, 0 );  
	
  strokeWeight(16);
  
  push();
  
  	translate(mouseX,mouseY);
  
  	var bodyVerticalOffset = -200 + sin(frameCount*0.1)*50;
  	var bodyWidth = 300;
    var bodyHeight = windowHeight*2;
  
  	var mouthWidth = 100;
  	var mouthVerticalOffset = 100 + sin(frameCount*0.1)*40;
    var mouthHorizontalOffset = -mouthWidth/2 + 20;
  
  	var eyesVertical0ffset = 30 + sin(frameCount*0.1)*30
  	var leftEyeSize = 130;
  
    var toothWidth = 16;
    var toothHeight = 18;
    var toothRounding = 50;
  
  	// body
  	fill(0, 135, 200);
  	rect( -bodyWidth/2, bodyVerticalOffset, bodyWidth, bodyHeight, bodyWidth/2, bodyWidth/2 )
  
  	// eyes
    fill(255);
    ellipse( -150, eyesVertical0ffset, leftEyeSize );
    ellipse( +150, eyesVertical0ffset, 100 );
		
  	// pupils
  	noStroke();
	  fill(0);
    ellipse( -150, eyesVertical0ffset, 50 );
    ellipse( +150, eyesVertical0ffset, 40 );

  	// eyelids
  	stroke(0);
    fill(255,213,0);	
    if( noise(frameCount*0.05) * 100 < 30 ) {
      // left eyelid
      ellipse( -150, eyesVertical0ffset, leftEyeSize );
      // right eyelid
      ellipse( +150, eyesVertical0ffset, 100 );
    }

    // mouth reacting to the microphone volume
    fill( 240,150,150 );
	  rect(mouthHorizontalOffset, mouthVerticalOffset, mouthWidth, 80 + micLevel*600, 5, 5, 100, 100 );
  	
  	// teeths
  	noStroke();
  	fill(255);
  	rect(mouthHorizontalOffset + 12, mouthVerticalOffset + 8, toothWidth, toothHeight, 0, 0, toothRounding, toothRounding);
		rect(mouthHorizontalOffset + 32, mouthVerticalOffset + 8, toothWidth, toothHeight, 0, 0, toothRounding, toothRounding);
  	rect(mouthHorizontalOffset + 52, mouthVerticalOffset + 8, toothWidth, toothHeight, 0, 0, toothRounding, toothRounding);
  	rect(mouthHorizontalOffset + 72, mouthVerticalOffset + 8, toothWidth, toothHeight, 0, 0, toothRounding, toothRounding);

  pop();
	
	
}