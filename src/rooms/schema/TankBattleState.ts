import { Schema, MapSchema, type } from "@colyseus/schema";
import { TankPlayer } from "./TankPlayer";
import { Bullet } from "./Bullet";

export type GamePhase = "lobby" | "playing" | "ended";

export class TankBattleState extends Schema {
    @type("string") phase: GamePhase = "lobby";
    @type("string") hostId: string = "";
    @type("string") winnerId: string = "";
    @type("string") winnerName: string = "";

    @type({ map: TankPlayer }) players = new MapSchema<TankPlayer>();
    @type({ map: Bullet }) bullets = new MapSchema<Bullet>();

    @type("number") mapWidth: number = 1200;
    @type("number") mapHeight: number = 800;

    @type("number") minPlayersToStart: number = 2;
    @type("number") maxPlayers: number = 4;

    // Game timer
    @type("number") gameStartTime: number = 0;
    @type("number") gameTime: number = 0;
}
