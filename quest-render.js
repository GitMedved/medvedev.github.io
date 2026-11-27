const drawQuest = (() => {
    "use strict";

    const { height, groundY, playerWidth, bugWidth, bugHeight } = questEngine;

    function drawBackdrop(ctx, width, run, image, camera, motion) {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, run.level.palette.sky);
        sky.addColorStop(1, "#0a101d");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);

        if (image?.complete && image.naturalWidth) {
            const parallax = motion ? camera / (run.level.length - width) : .4;
            const scaledWidth = height * image.naturalWidth / image.naturalHeight * 1.12;
            const artWidth = Math.max(width * 1.1, scaledWidth);
            const artHeight = artWidth * image.naturalHeight / image.naturalWidth;
            ctx.drawImage(image, -(artWidth - width) * parallax, (height - artHeight) * .45, artWidth, artHeight);
        }

        const tint = ctx.createLinearGradient(0, 96, 0, height);
        tint.addColorStop(0, "#0b12241a");
        tint.addColorStop(.59, "#0b11255e");
        tint.addColorStop(1, "#090e1bdd");
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, width, height);
    }

    function drawTerrain(ctx, level, from, to) {
        const { palette } = level;
        for (const [start, end] of level.ground) {
            if (end < from || start > to) continue;
            ctx.fillStyle = palette.shade;
            ctx.fillRect(start, groundY, end - start, height - groundY);
            ctx.fillStyle = palette.panel;
            ctx.fillRect(start, groundY + 8, end - start, 32);
            ctx.fillStyle = palette.rim;
            ctx.fillRect(start, groundY + 3, end - start, 6);
            ctx.fillStyle = palette.accent;
            ctx.fillRect(start, groundY, end - start, 3);

            ctx.save();
            ctx.beginPath();
            ctx.rect(start, groundY, end - start, height - groundY);
            ctx.clip();
            const firstPanel = start + Math.max(0, Math.floor((from - start) / 62)) * 62;
            const lastPanel = Math.min(end, to + 62);
            for (let x = firstPanel; x <= lastPanel; x += 62) {
                ctx.fillStyle = "#0a111c";
                ctx.fillRect(x, groundY + 9, 3, 47);
                ctx.fillStyle = "#6e8d9c6b";
                ctx.fillRect(x + 7, groundY + 15, 4, 4);
                ctx.fillRect(x + 52, groundY + 31, 4, 4);
                ctx.fillStyle = "#10202bc2";
                ctx.fillRect(x + 20, groundY + 23, 22, 3);
                ctx.fillRect(x + 17, groundY + 28, 28, 3);
            }
            ctx.restore();
            ctx.fillStyle = "#f3a66f";
            if (start !== 0) ctx.fillRect(start, groundY + 4, 4, 23);
            if (end !== level.length) ctx.fillRect(end - 4, groundY + 4, 4, 23);
        }

        for (const [x, y, length] of level.ledges) {
            if (x + length < from || x > to) continue;
            ctx.fillStyle = "#0b1422";
            ctx.fillRect(x + 5, y + 17, length - 10, 7);
            ctx.fillStyle = palette.panel;
            ctx.fillRect(x, y, length, 18);
            ctx.fillStyle = palette.rim;
            ctx.fillRect(x, y + 3, length, 6);
            ctx.fillStyle = palette.accent;
            ctx.fillRect(x, y, length, 3);
            for (let joint = x + 12; joint < x + length - 5; joint += 24) {
                ctx.fillStyle = "#c4cce774";
                ctx.fillRect(joint, y + 12, 4, 3);
            }
        }
    }

    function pixelText(ctx, text, x, y, color, size = 16) {
        ctx.font = `700 ${size}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#0a1322";
        ctx.strokeText(text, x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    function drawCheckpoint(ctx, run, copy) {
        const x = run.level.checkpoint;
        const color = run.checkpoint ? "#a4ffd0" : "#82a8ce";
        ctx.fillStyle = "#0c1726";
        ctx.fillRect(x - 7, groundY - 80, 17, 80);
        ctx.fillStyle = "#43506d";
        ctx.fillRect(x - 3, groundY - 75, 7, 71);
        ctx.fillStyle = color;
        ctx.fillRect(x - 5, groundY - 78, 11, 7);
        ctx.fillRect(x, groundY - 71, 31, 19);
        ctx.fillStyle = "#1c3246";
        ctx.fillRect(x + 22, groundY - 60, 9, 8);
        ctx.fillStyle = "#3f5c6d";
        ctx.fillRect(x - 13, groundY - 6, 28, 6);
        pixelText(ctx, copy.flag, x + 6, groundY - 88, color, 13);
    }

    function drawExit(ctx, run, copy) {
        const x = run.level.length - 102;
        const open = run.collected.size === run.level.pickups.length;
        const color = open ? "#a9ffce" : "#f3ac83";
        const top = groundY - 94;
        ctx.fillStyle = "#070e19";
        ctx.fillRect(x - 12, top - 5, 81, 99);
        ctx.fillStyle = "#46536c";
        ctx.fillRect(x - 7, top, 71, 94);
        ctx.fillStyle = color;
        ctx.fillRect(x - 1, top + 8, 59, 86);
        ctx.fillStyle = open ? "#2c625d" : "#233047";
        ctx.fillRect(x + 3, top + 12, 51, 82);
        ctx.fillStyle = open ? "#142d38" : "#151f34";
        ctx.fillRect(x + 7, top + 17, 43, 72);
        ctx.fillStyle = color;
        if (open) {
            ctx.fillRect(x + 20, top + 53, 17, 4);
            ctx.fillRect(x + 32, top + 47, 5, 16);
        } else {
            ctx.fillRect(x + 20, top + 50, 17, 14);
            ctx.fillRect(x + 23, top + 44, 11, 8);
            ctx.fillStyle = "#253046";
            ctx.fillRect(x + 26, top + 47, 5, 5);
        }
        pixelText(ctx, copy.exit, x + 28, top - 13, color);
    }

    function drawRobot(ctx, player, time, motion) {
        const walking = motion && player.grounded && Math.abs(player.vx) > 32;
        const stride = walking ? Math.round(Math.sin(time * 26) * 5) : 0;
        ctx.save();
        ctx.translate(Math.round(player.x) + playerWidth / 2, Math.round(player.y));
        ctx.scale(player.facing, 1);
        if (player.immunity > 0) {
            ctx.globalAlpha = .82;
            ctx.fillStyle = "#b5f3f335";
            ctx.fillRect(-23, -9, 46, 61);
        }

        ctx.fillStyle = "#091425";
        ctx.fillRect(-20, 7, 40, 21);
        ctx.fillRect(-16, 2, 32, 31);
        ctx.fillRect(-15, 28, 30, 12);
        ctx.fillRect(-12, 37, 12, 7 + stride);
        ctx.fillRect(5, 37, 12, 7 - stride);
        ctx.fillStyle = "#698b9c";
        ctx.fillRect(-11, 36, 8, 6 + stride);
        ctx.fillRect(6, 36, 8, 6 - stride);
        ctx.fillStyle = "#c8ffed";
        ctx.fillRect(-17, 12, 35, 12);
        ctx.fillRect(-13, 5, 27, 23);
        ctx.fillStyle = "#7cb9ae";
        ctx.fillRect(-12, 23, 25, 11);
        ctx.fillStyle = "#244457";
        ctx.fillRect(-9, 10, 24, 13);
        ctx.fillStyle = "#89ffdf";
        ctx.fillRect(3, 13, 9, 5);
        ctx.fillStyle = "#effff1";
        ctx.fillRect(7, 13, 5, 2);
        ctx.fillRect(1, 2, 8, 3);
        ctx.fillStyle = "#f6c37c";
        ctx.fillRect(-20, 25, 8, 12);
        ctx.fillRect(-7, 35, 13, 4);
        ctx.fillStyle = "#f8e2b1";
        ctx.fillRect(-6, -3, 3, 7);
        ctx.fillRect(-8, -6, 7, 3);
        ctx.restore();
    }

    function drawBug(ctx, bug, time, motion) {
        const stride = motion ? Math.round(Math.sin(time * 28 + bug.offset) * 4) : 0;
        ctx.save();
        ctx.translate(Math.round(bug.x) + bugWidth / 2, groundY - bugHeight);
        ctx.scale(bug.facing, 1);
        ctx.fillStyle = "#18172a";
        ctx.fillRect(-20, 7, 40, 17);
        ctx.fillRect(-15, 3, 29, 25);
        ctx.fillStyle = "#a64468";
        ctx.fillRect(-17, 10, 35, 13);
        ctx.fillRect(-13, 5, 25, 18);
        ctx.fillStyle = "#ff8a9b";
        ctx.fillRect(-12, 7, 20, 5);
        ctx.fillRect(-10, 13, 5, 4);
        ctx.fillRect(-17, 21, 7, 5 + stride);
        ctx.fillRect(-4, 21, 7, 5 - stride);
        ctx.fillRect(9, 21, 7, 5 + stride);
        ctx.fillStyle = "#f7ccac";
        ctx.fillRect(9, 13, 5, 4);
        ctx.fillRect(14, 3, 3, 8);
        ctx.fillRect(17, 0, 5, 3);
        ctx.restore();
    }

    function drawPickup(ctx, item, image, time, motion, copy) {
        const [id, x, y] = item;
        const file = id === "file";
        const bop = motion ? Math.round(Math.sin(time * 4 + x / 130) * 4) : 0;
        const color = file ? "#ffdb9c" : "#b4ffdf";
        ctx.save();
        ctx.translate(x, y + bop);
        ctx.fillStyle = file ? "#ffd38e39" : "#93ffe135";
        ctx.fillRect(-20, -20, 40, 40);
        ctx.fillStyle = "#111b2c";
        ctx.fillRect(-17, -17, 34, 34);
        ctx.fillStyle = color;
        ctx.fillRect(-15, -15, 30, 30);
        ctx.fillStyle = "#f5fff9";
        ctx.fillRect(-12, -12, 24, 24);
        if (file) {
            ctx.fillStyle = "#ad673e";
            ctx.fillRect(-8, -8, 15, 17);
            ctx.fillStyle = "#ffe3b0";
            ctx.fillRect(-5, -5, 9, 2);
            ctx.fillRect(-5, 0, 9, 2);
            ctx.fillRect(-5, 5, 6, 2);
        } else if (image?.complete && image.naturalWidth) {
            ctx.drawImage(image, -10, -10, 20, 20);
        } else {
            ctx.fillStyle = "#32594b";
            ctx.fillRect(-5, -5, 10, 10);
        }
        pixelText(ctx, file ? copy.file : questSkillNames[id], 0, 34, color, 15);
        ctx.restore();
    }

    function drawParticles(ctx, run, motion) {
        if (!motion) return;
        for (const { x, y, expires, file } of run.particles) {
            const life = Math.max(0, (expires - run.time) / .46);
            const distance = 13 + (1 - life) * 42;
            ctx.globalAlpha = life;
            ctx.fillStyle = file ? "#ffdb9c" : "#bcffe3";
            for (let dot = 0; dot < 9; dot++) {
                const angle = dot * Math.PI * 2 / 9;
                ctx.fillRect(Math.round(x + Math.cos(angle) * distance), Math.round(y + Math.sin(angle) * distance), 5, 5);
            }
        }
        ctx.globalAlpha = 1;
    }

    return (ctx, run, image, icons, copy, motion) => {
        const width = ctx.canvas.width;
        const camera = Math.round(Math.min(Math.max(run.player.x - width * .34, 0), run.level.length - width));
        const to = camera + width;

        drawBackdrop(ctx, width, run, image, camera, motion);
        ctx.save();
        ctx.translate(-camera, 0);
        drawTerrain(ctx, run.level, camera, to);
        if (run.level.checkpoint >= camera - 70 && run.level.checkpoint <= to + 70) drawCheckpoint(ctx, run, copy);
        if (to >= run.level.length - 210) drawExit(ctx, run, copy);

        for (const pickup of run.level.pickups) {
            const [id, x] = pickup;
            if (!run.collected.has(id) && x >= camera - 60 && x <= to + 60) {
                drawPickup(ctx, pickup, icons.get(id), run.time, motion, copy);
            }
        }
        for (const bug of run.bugs) {
            if (bug.x >= camera - 48 && bug.x <= to + 48) drawBug(ctx, bug, run.time, motion);
        }
        drawRobot(ctx, run.player, run.time, motion);
        drawParticles(ctx, run, motion);
        ctx.restore();
    };
})();
