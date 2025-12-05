import { Room, Client } from "@colyseus/core";
import { TankBattleState, GamePhase } from "./schema/TankBattleState";
import { TankPlayer } from "./schema/TankPlayer";
import { Bullet } from "./schema/Bullet";

interface PlayerInput {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    turretAngle: number;
    shooting: boolean;
}

const TANK_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const TANK_SIZE = 40;
const BULLET_SIZE = 8;

export class TankBattleRoom extends Room<TankBattleState> {
    maxClients = 4;
    private playerInputs: Map<string, PlayerInput> = new Map();
    private bulletCounter = 0;

    onCreate(options: any) {
        this.setState(new TankBattleState());

        this.onMessage("ready", (client) => this.handleReady(client));
        this.onMessage("start", (client) => this.handleStart(client));
        this.onMessage("input", (client, input: PlayerInput) => this.handleInput(client, input));
        this.onMessage("rematch", (client) => this.handleRematch(client));

        this.setSimulationInterval((deltaTime) => this.gameLoop(deltaTime), 1000 / 60);

        console.log("TankBattleRoom created!", this.roomId);
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");

        const player = new TankPlayer();
        player.sessionId = client.sessionId;
        player.name = options.name || `Player ${this.state.players.size + 1}`;
        player.color = TANK_COLORS[this.state.players.size % TANK_COLORS.length];

        const spawnPositions = this.getSpawnPositions();
        const spawnIndex = this.state.players.size;
        player.x = spawnPositions[spawnIndex].x;
        player.y = spawnPositions[spawnIndex].y;
        player.angle = spawnPositions[spawnIndex].angle;

        this.state.players.set(client.sessionId, player);

        if (this.state.players.size === 1) {
            this.state.hostId = client.sessionId;
        }

        this.playerInputs.set(client.sessionId, {
            left: false, right: false, up: false, down: false,
            turretAngle: 0, shooting: false
        });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");

        const player = this.state.players.get(client.sessionId);
        if (player) {
            this.state.players.delete(client.sessionId);
            this.playerInputs.delete(client.sessionId);

            if (this.state.hostId === client.sessionId && this.state.players.size > 0) {
                const newHost = this.state.players.keys().next().value;
                this.state.hostId = newHost;
            }
            if (this.state.phase === "playing") {
                this.checkWinCondition();
            }
        }
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }

    private handleReady(client: Client) {
        if (this.state.phase !== "lobby") return;

        const player = this.state.players.get(client.sessionId);
        if (player) {
            player.isReady = !player.isReady;
        }
    }

    private handleStart(client: Client) {
        if (client.sessionId !== this.state.hostId) return;
        if (this.state.phase !== "lobby") return;
        if (this.state.players.size < this.state.minPlayersToStart) return;

        this.startGame();
    }

    private handleInput(client: Client, input: PlayerInput) {
        if (this.state.phase !== "playing") return;

        const player = this.state.players.get(client.sessionId);
        if (!player || !player.isAlive) return;

        this.playerInputs.set(client.sessionId, input);
    }

    private handleRematch(client: Client) {
        if (client.sessionId !== this.state.hostId) return;
        if (this.state.phase !== "ended") return;

        this.resetGame();
    }

    private startGame() {
        this.state.phase = "playing";
        this.state.gameStartTime = Date.now();
        this.state.winnerId = "";
        this.state.winnerName = "";

        const spawnPositions = this.getSpawnPositions();
        let index = 0;
        this.state.players.forEach((player) => {
            player.health = player.maxHealth;
            player.isAlive = true;
            player.isReady = false;
            player.x = spawnPositions[index].x;
            player.y = spawnPositions[index].y;
            player.angle = spawnPositions[index].angle;
            index++;
        });

        this.state.bullets.clear();

        console.log("Game started!");
    }

    private resetGame() {
        this.state.phase = "lobby";
        this.state.winnerId = "";
        this.state.winnerName = "";
        this.state.bullets.clear();

        this.state.players.forEach((player) => {
            player.isReady = false;
        });
    }

    private gameLoop(deltaTime: number) {
        if (this.state.phase !== "playing") return;

        this.state.gameTime = Date.now() - this.state.gameStartTime;

        this.state.players.forEach((player) => {
            if (!player.isAlive) return;

            const input = this.playerInputs.get(player.sessionId);
            if (!input) return;

            let dx = 0;
            let dy = 0;

            if (input.up) dy -= 1;    
            if (input.down) dy += 1;  
            if (input.left) dx -= 1;  
            if (input.right) dx += 1; 

            if (dx !== 0 && dy !== 0) {
                const length = Math.sqrt(dx * dx + dy * dy);
                dx /= length;
                dy /= length;
            }


            if (dx !== 0 || dy !== 0) {
                player.x += dx * player.speed;
                player.y += dy * player.speed;
                player.angle = Math.atan2(dy, dx);
            }

            player.turretAngle = input.turretAngle;

            player.x = Math.max(TANK_SIZE, Math.min(this.state.mapWidth - TANK_SIZE, player.x));
            player.y = Math.max(TANK_SIZE, Math.min(this.state.mapHeight - TANK_SIZE, player.y));

            // Shooting
            const now = Date.now();
            if (input.shooting && now - player.lastShotTime > player.shootCooldown) {
                this.shootBullet(player);
                player.lastShotTime = now;
            }
        });

        const bulletsToRemove: string[] = [];
        this.state.bullets.forEach((bullet, id) => {
            bullet.x += Math.cos(bullet.angle) * bullet.speed;
            bullet.y += Math.sin(bullet.angle) * bullet.speed;


            if (Date.now() - bullet.createdAt > bullet.lifetime) {
                bulletsToRemove.push(id);
                return;
            }

            if (bullet.x < 0 || bullet.x > this.state.mapWidth ||
                bullet.y < 0 || bullet.y > this.state.mapHeight) {
                bulletsToRemove.push(id);
                return;
            }

            this.state.players.forEach((player) => {
                if (!player.isAlive) return;
                if (player.sessionId === bullet.ownerId) return;

                const dx = player.x - bullet.x;
                const dy = player.y - bullet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < TANK_SIZE) {
                    player.health -= bullet.damage;
                    bulletsToRemove.push(id);

                    if (player.health <= 0) {
                        player.health = 0;
                        player.isAlive = false;

                        const shooter = this.state.players.get(bullet.ownerId);
                        if (shooter) {
                            shooter.kills++;
                            shooter.score += 100;
                        }

                        this.checkWinCondition();
                    }
                }
            });
        });

        bulletsToRemove.forEach((id) => this.state.bullets.delete(id));
    }

    private shootBullet(player: TankPlayer) {
        const bullet = new Bullet();
        bullet.id = `bullet_${this.bulletCounter++}`;
        bullet.ownerId = player.sessionId;
        bullet.x = player.x + Math.cos(player.turretAngle) * (TANK_SIZE + 5);
        bullet.y = player.y + Math.sin(player.turretAngle) * (TANK_SIZE + 5);
        bullet.angle = player.turretAngle;
        bullet.createdAt = Date.now();

        this.state.bullets.set(bullet.id, bullet);
    }

    private checkWinCondition() {
        const alivePlayers = Array.from(this.state.players.values()).filter(p => p.isAlive);

        if (alivePlayers.length <= 1) {
            this.state.phase = "ended";

            if (alivePlayers.length === 1) {
                this.state.winnerId = alivePlayers[0].sessionId;
                this.state.winnerName = alivePlayers[0].name;
                alivePlayers[0].score += 200;
            }

            console.log("Game ended! Winner:", this.state.winnerName);
        }
    }

    private getSpawnPositions() {
        const margin = 100;
        return [
            { x: margin, y: margin, angle: Math.PI / 4 },
            { x: this.state.mapWidth - margin, y: margin, angle: (3 * Math.PI) / 4 },
            { x: margin, y: this.state.mapHeight - margin, angle: -Math.PI / 4 },
            { x: this.state.mapWidth - margin, y: this.state.mapHeight - margin, angle: (-3 * Math.PI) / 4 },
        ];
    }
}
