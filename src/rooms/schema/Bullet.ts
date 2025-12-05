import { Schema, type } from "@colyseus/schema";

export class Bullet extends Schema {
    @type("string") id: string = "";
    @type("string") ownerId: string = "";

    @type("number") x: number = 0;
    @type("number") y: number = 0;

    @type("number") angle: number = 0;
    @type("number") speed: number = 8;

    @type("number") damage: number = 25;
    @type("number") createdAt: number = 0;
    @type("number") lifetime: number = 2000; 
}
