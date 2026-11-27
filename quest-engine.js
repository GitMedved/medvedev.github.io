const questEngine = (() => {
    "use strict";

    const width = 960;
    const height = 540;
    const groundY = 454;
    const playerWidth = 34;
    const playerHeight = 44;
    const bugWidth = 40;
    const bugHeight = 26;
    const spawnX = 65;
    const topSpeed = 292;
    const gravity = 1750;
    const jumpSpeed = 635;
    const pickupRadius = 23;

    function create(level, inventory = []) {
        return {
            level,
            player: { x: spawnX, y: groundY - playerHeight, vx: 0, vy: 0, grounded: true, facing: 1, grace: 0, buffer: 0, immunity: 0 },
            solids: [
                ...level.ground.map(([start, end]) => ({ x: start, end, y: groundY })),
                ...level.ledges.map(([x, y, size]) => ({ x, end: x + size, y })),
            ],
            bugs: level.bugs.map(([start, end, speed], index) => ({
                x: start, start, end, speed, offset: index * 19, facing: 1,
            })),
            collected: new Set(inventory),
            time: 0,
            checkpoint: false,
            atExit: false,
            finished: false,
            particles: [],
        };
    }

    function limit(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function moveBugs(run) {
        for (const bug of run.bugs) {
            const range = bug.end - bug.start;
            const distance = (run.time * bug.speed + bug.offset) % (range * 2);
            bug.x = bug.start + Math.min(distance, range * 2 - distance);
            bug.facing = distance < range ? 1 : -1;
        }
    }

    function movePlayer(run, input, dt) {
        const player = run.player;
        player.immunity = Math.max(0, player.immunity - dt);
        player.grace = player.grounded ? .1 : Math.max(0, player.grace - dt);
        player.buffer = input.jump ? .13 : Math.max(0, player.buffer - dt);
        const desiredVelocity = input.axis * topSpeed;
        const acceleration = player.grounded ? 3100 : 2100;
        const velocityChange = limit(desiredVelocity - player.vx, -acceleration * dt, acceleration * dt);
        player.vx += velocityChange;
        if (input.axis) player.facing = input.axis;
        player.x = limit(player.x + player.vx * dt, 0, run.level.length - playerWidth);

        if (player.buffer && player.grace) {
            player.vy = -jumpSpeed;
            player.grace = 0;
            player.buffer = 0;
        }
        if (!input.hold && player.vy < -265) player.vy = -265;
        const oldBottom = player.y + playerHeight;
        player.vy += gravity * dt;
        player.y += player.vy * dt;
        player.grounded = false;

        if (player.vy >= 0) {
            const newBottom = player.y + playerHeight;
            const surface = run.solids.reduce((highest, plane) => {
                const crossesTop = oldBottom <= plane.y + .5 && newBottom >= plane.y;
                const overSurface = player.x + playerWidth > plane.x && player.x < plane.end;
                return crossesTop && overSurface ? Math.min(highest, plane.y) : highest;
            }, Infinity);
            if (surface !== Infinity) {
                player.y = surface - playerHeight;
                player.vy = 0;
                player.grounded = true;
            }
        }
    }

    function hitsBug(run) {
        const { player } = run;
        return player.immunity === 0 &&
            player.y + playerHeight - 5 > groundY - bugHeight + 5 &&
            player.y + 5 < groundY - 2 &&
            run.bugs.some(bug => player.x + playerWidth - 6 > bug.x + 5 && player.x + 6 < bug.x + bugWidth - 5);
    }

    function respawn(run) {
        Object.assign(run.player, {
            x: run.checkpoint ? run.level.checkpoint + 12 : spawnX,
            y: groundY - playerHeight,
            vx: 0,
            vy: 0,
            grounded: true,
            facing: 1,
            grace: 0,
            buffer: 0,
            immunity: .7,
        });
        run.atExit = false;
    }

    function collectPickups(run, events) {
        const { player } = run;
        for (const [id, x, y] of run.level.pickups) {
            if (run.collected.has(id)) continue;
            const dx = x - limit(x, player.x, player.x + playerWidth);
            const dy = y - limit(y, player.y, player.y + playerHeight);
            if (dx * dx + dy * dy > pickupRadius * pickupRadius) continue;
            run.collected.add(id);
            run.particles.push({ x, y, expires: run.time + .46, file: id === "file" });
            events.push({ kind: "pickup", id });
        }
    }

    function checkExit(run, events) {
        const exitX = run.level.length - 102;
        const near = run.player.x + playerWidth >= exitX - 14 &&
            run.player.y + playerHeight >= groundY - 62;
        if (near && !run.atExit) {
            const remaining = run.level.pickups.length - run.collected.size;
            if (remaining) {
                events.push({ kind: "missing", remaining });
            } else {
                run.finished = true;
                events.push({ kind: "finish" });
            }
        }
        run.atExit = near;
    }

    function step(run, input, elapsed) {
        const events = [];
        const steps = Math.max(1, Math.ceil(elapsed * 90));
        const dt = elapsed / steps;
        let control = input;
        for (let frame = 0; frame < steps && !run.finished; frame++) {
            run.time += dt;
            moveBugs(run);
            movePlayer(run, control, dt);
            if (control.jump) control = { ...control, jump: false };
            const fell = run.player.y > height + 35;
            if (fell || hitsBug(run)) {
                respawn(run);
                events.push({ kind: fell ? "fall" : "bug" });
                break;
            }

            if (!run.checkpoint && run.player.x + playerWidth / 2 >= run.level.checkpoint) {
                run.checkpoint = true;
                events.push({ kind: "checkpoint" });
            }
            collectPickups(run, events);
            checkExit(run, events);
        }
        run.particles = run.particles.filter(particle => particle.expires > run.time);
        return events;
    }

    return { width, height, groundY, playerWidth, playerHeight, bugWidth, bugHeight, create, step };
})();
