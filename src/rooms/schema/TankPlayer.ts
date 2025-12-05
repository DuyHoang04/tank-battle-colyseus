import { Schema, type } from "@colyseus/schema";

export class TankPlayer extends Schema {
  @type("string") sessionId: string = "";
  @type("string") name: string = "";

  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") angle: number = 0;
  @type("number") turretAngle: number = 0;
  
  @type("number") health: number = 100;
  @type("number") maxHealth: number = 100;
  @type("number") score: number = 0;
  @type("number") kills: number = 0;
  
  @type("boolean") isReady: boolean = false;
  @type("boolean") isAlive: boolean = true;

  @type("number") speed: number = 3;
  @type("number") rotationSpeed: number = 0.05;
  @type("string") color: string = "#00ff00";
  
  @type("number") lastShotTime: number = 0;
  @type("number") shootCooldown: number = 500; // ms
}
