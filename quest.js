(() => {
    "use strict";

    const game = document.querySelector("#game");
    const portfolio = document.querySelector("#portfolio");
    const dialog = document.querySelector("#quest-dialog");
    const canvas = game.querySelector("[data-canvas]");
    const context = canvas.getContext?.("2d");
    if (!context || typeof dialog.showModal !== "function") return;

    const copy = questWords[document.documentElement.lang] ?? questWords.en;
    const stage = game.querySelector("[data-stage]");
    const overlay = game.querySelector("[data-overlay]");
    const overlayTitle = overlay.querySelector("[data-overlay-title]");
    const overlayText = overlay.querySelector("[data-overlay-text]");
    const playButton = game.querySelector("[data-play]");
    const pauseButton = game.querySelector("[data-pause]");
    const resetButton = game.querySelector("[data-reset]");
    const status = game.querySelector("[data-status]");
    const chapterID = game.querySelector("[data-chapter-label]");
    const levelName = game.querySelector("[data-level-name]");
    const chapterCount = game.querySelector("[data-count]");
    const progressBar = game.querySelector("[data-progress]");
    const chapters = [...game.querySelectorAll("[data-chapter]")];
    const inventory = game.querySelector("[data-inventory]");
    const inventoryCount = game.querySelector("[data-inventory-count]");
    const gameLink = document.querySelector('[data-view="game"]');
    const portfolioLink = document.querySelector('[data-view="portfolio"]');
    const homeLink = document.querySelector("[data-home]");
    const languageLinks = [...document.querySelectorAll(".language-nav a")];
    const dialogBody = dialog.querySelector("[data-dialog-body]");
    const dialogContext = dialog.querySelector("[data-dialog-context]");
    const skillIcons = new Map([...portfolio.querySelectorAll("[data-skill]")].map(
        node => [node.dataset.skill, node.querySelector("img")]
    ));
    const art = new Map();
    const smallScreen = window.matchMedia("(max-width: 42rem)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const storageKey = "qa-quest.platformer.v1";
    const leftCodes = ["ArrowLeft", "KeyA"];
    const rightCodes = ["ArrowRight", "KeyD"];
    const jumpCodes = ["Space", "ArrowUp", "KeyW"];
    const movementCodes = new Set([...leftCodes, ...rightCodes, ...jumpCodes]);

    const keys = new Set();
    const pointers = new Map();
    let progress = readProgress();
    let index = 0;
    let run;
    let phase = "ready";
    let nextJump = false;
    let frame = 0;
    let lastTick = 0;
    let focusAfterDialog = null;

    function cleanProgress(value) {
        const completed = Number.isInteger(value?.completed) ?
            Math.max(0, Math.min(value.completed, questLevels.length)) : 0;
        const inventory = questLevels.map((level, chapter) => {
            const found = Array.isArray(value?.inventory?.[chapter]) ? value.inventory[chapter] : [];
            return level.pickups.map(([id]) => id).filter(id =>
                chapter < completed || (chapter === completed && found.includes(id))
            );
        });
        return { completed, inventory };
    }

    function readProgress() {
        try {
            return cleanProgress(JSON.parse(localStorage.getItem(storageKey)));
        } catch {
            return cleanProgress(null);
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(progress));
        } catch {
            // The full game remains playable for this visit when storage is disabled.
        }
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function button(text, className, handler) {
        const node = element("button", className, text);
        node.type = "button";
        node.addEventListener("click", handler);
        return node;
    }

    function link(text, className, href) {
        const node = element("a", className, text);
        node.href = href;
        return node;
    }

    function speak(message, kind) {
        status.textContent = message;
        status.dataset.notice = kind ?? "";
    }

    function requestArt(id) {
        if (art.has(id)) return;
        const image = new Image();
        image.addEventListener("load", paint);
        image.src = `assets/img/quest-${id}-side.webp`;
        art.set(id, image);
    }

    function paint() {
        if (run && !game.hidden) {
            drawQuest(context, run, art.get(run.level.id), skillIcons, copy, !reducedMotion.matches);
        }
    }

    function sizeStage() {
        canvas.width = smallScreen.matches ? questEngine.height * 4 / 3 : questEngine.width;
        canvas.height = questEngine.height;
        context.imageSmoothingEnabled = false;
        paint();
    }

    function cardIcon(id) {
        if (id === "file") {
            const icon = element("span", "file-icon", "▤");
            icon.setAttribute("aria-hidden", "true");
            return icon;
        }
        const icon = skillIcons.get(id).cloneNode();
        icon.alt = "";
        icon.removeAttribute("title");
        return icon;
    }

    function renderInventory() {
        inventoryCount.textContent = `${run.collected.size} / ${run.level.pickups.length}`;
        inventory.replaceChildren(...run.level.pickups.map(([id]) => {
            const found = run.collected.has(id);
            const item = element("li");
            item.dataset.collected = String(found);
            const mark = element("span", "inventory-mark", found ? "✓" : "○");
            mark.setAttribute("aria-label", found ? copy.unlocked : copy.locked);
            item.append(cardIcon(id), element("span", "", id === "file" ? copy.file : questSkillNames[id]), mark);
            return item;
        }));
        resetButton.hidden = progress.completed === 0 && progress.inventory.every(items => items.length === 0);
    }

    function renderChapters() {
        chapterCount.textContent = `${progress.completed} / ${questLevels.length}`;
        progressBar.value = progress.completed;
        chapters.forEach((chapter, i) => {
            const state = i < progress.completed ? "done" : i === progress.completed ? "active" : "locked";
            chapter.dataset.state = state;
            chapter.disabled = state === "locked";
            if (state === "active") chapter.setAttribute("aria-current", "step");
            else chapter.removeAttribute("aria-current");
            chapter.querySelector("[data-chapter-state]").textContent = {
                done: copy.unlocked, active: copy.active, locked: copy.locked,
            }[state];
        });
    }

    function clearControls() {
        keys.clear();
        pointers.clear();
        nextJump = false;
    }

    function setPhase(nextPhase) {
        phase = nextPhase;
        overlay.hidden = phase === "playing";
        pauseButton.hidden = phase !== "playing";
        if (phase === "playing") return;
        cancelAnimationFrame(frame);
        frame = 0;
        lastTick = 0;
        clearControls();
        overlayTitle.textContent = phase === "done" ? copy.done :
            phase === "paused" ? copy.paused : copy.chapters[index].title;
        overlayText.textContent = phase === "done" ? copy.completion : copy.goal;
        playButton.textContent = phase === "done" ? copy.portfolio :
            phase === "paused" ? copy.resume : copy.play;
    }

    function loadChapter() {
        index = Math.min(progress.completed, questLevels.length - 1);
        const level = questLevels[index];
        run = questEngine.create(level, progress.inventory[index]);
        requestArt(level.id);
        game.style.setProperty("--chapter-accent", level.palette.accent);
        chapterID.textContent = `${copy.chapter} 0${index + 1} / 0${questLevels.length}`;
        levelName.textContent = copy.chapters[index].title;
        setPhase(progress.completed === questLevels.length ? "done" : "ready");
        speak(progress.completed === questLevels.length ? copy.completion : copy.stageHint);
        renderChapters();
        renderInventory();
        paint();
    }

    function pause(focus = false) {
        if (phase !== "playing") return;
        setPhase("paused");
        if (focus) playButton.focus({ preventScroll: true });
    }

    function isHeld(codes, touch) {
        return codes.some(code => keys.has(code)) || [...pointers.values()].includes(touch);
    }

    function advance(now) {
        frame = 0;
        if (phase !== "playing") return;
        const elapsed = Math.min(Math.max((now - lastTick) / 1000, 0), .13);
        lastTick = now;
        const input = {
            axis: Number(isHeld(rightCodes, "right")) - Number(isHeld(leftCodes, "left")),
            jump: nextJump,
            hold: isHeld(jumpCodes, "jump"),
        };
        nextJump = false;
        for (const event of questEngine.step(run, input, elapsed)) handleEvent(event);
        paint();
        if (phase === "playing") frame = requestAnimationFrame(advance);
    }

    function play() {
        if (phase === "done") {
            location.hash = "portfolio";
            return;
        }
        if (phase === "playing" || dialog.open || game.hidden) return;
        setPhase("playing");
        stage.focus({ preventScroll: true });
        lastTick = performance.now();
        frame = requestAnimationFrame(advance);
    }

    function showDialog(kicker, title, content, focusTarget) {
        pause();
        focusAfterDialog = focusTarget;
        dialogContext.textContent = kicker;
        const heading = element("h2", "", title);
        heading.id = "quest-dialog-title";
        heading.tabIndex = -1;
        dialogBody.replaceChildren(heading, ...content);
        if (!dialog.open) dialog.showModal();
        dialog.scrollTop = 0;
        heading.focus({ preventScroll: true });
    }

    function showDossier(chapterIndex, justUnlocked) {
        const level = questLevels[chapterIndex];
        const chapter = copy.chapters[chapterIndex];
        const portrait = game.querySelector(".quest-profile img").cloneNode();
        const biography = portfolio.querySelector(`[data-bio-chapter="${chapterIndex}"]`).textContent;
        const bio = element("div", "bio-card");
        const bioText = element("div");
        bioText.append(element("h3", "", chapter.bio), element("p", "", biography));
        bio.append(portrait, bioText);
        const skills = element("ul", "dossier-skills");
        for (const [id] of level.pickups) {
            if (id === "file") continue;
            const li = element("li");
            li.append(cardIcon(id), element("span", "", questSkillNames[id]));
            skills.append(li);
        }

        const reward = element("div", "dossier-content");
        if (chapterIndex > 0) {
            const project = document.getElementById(level.section).cloneNode(true);
            project.removeAttribute("id");
            reward.append(project);
        }
        const actions = element("div", "dialog-actions");
        if (justUnlocked && progress.completed < questLevels.length) {
            actions.append(button(copy.next, "quest-button primary", () => {
                dialog.close();
                play();
            }));
        } else if (justUnlocked) {
            actions.append(link(copy.portfolio, "quest-button primary", "#portfolio"));
        } else {
            actions.append(button(copy.back, "quest-button primary", () => dialog.close()));
        }
        actions.append(link(copy.viewSection, "quest-button", `#${level.section}`));
        showDialog(
            justUnlocked ? `${copy.won} · ${chapterIndex + 1} / ${questLevels.length}` : copy.unlocked,
            chapter.reward,
            [bio, skills, reward, actions],
            justUnlocked ? playButton : chapters[chapterIndex]
        );
    }

    function handleEvent(event) {
        switch (event.kind) {
            case "pickup":
                progress.inventory[index] = [...run.collected];
                saveProgress();
                renderInventory();
                speak(event.id === "file" ? copy.fileCollected : copy.found(questSkillNames[event.id]), event.kind);
                break;
            case "checkpoint":
                speak(copy.checkpoint, event.kind);
                break;
            case "bug":
            case "fall":
                speak(copy[event.kind], event.kind);
                break;
            case "missing":
                speak(copy.incomplete(event.remaining), event.kind);
                break;
            case "finish": {
                const finished = index;
                progress.completed = finished + 1;
                saveProgress();
                loadChapter();
                showDossier(finished, true);
                break;
            }
        }
    }

    function confirmReset() {
        const actions = element("div", "dialog-actions");
        actions.append(
            button(copy.cancel, "quest-button", () => dialog.close()),
            button(copy.startOver, "quest-button primary", () => {
                progress = cleanProgress(null);
                saveProgress();
                loadChapter();
                focusAfterDialog = playButton;
                dialog.close();
            })
        );
        showDialog(copy.startOver, copy.startOver, [element("p", "", copy.resetDetail), actions], resetButton);
    }

    function syncView() {
        const anchor = document.getElementById(location.hash.slice(1));
        const showPortfolio = Boolean(anchor && portfolio.contains(anchor));
        game.hidden = showPortfolio;
        portfolio.hidden = !showPortfolio;
        gameLink.hidden = false;
        const currentLink = showPortfolio ? portfolioLink : gameLink;
        const otherLink = showPortfolio ? gameLink : portfolioLink;
        currentLink.setAttribute("aria-current", "page");
        otherLink.removeAttribute("aria-current");
        homeLink.href = "#game";

        for (const link of languageLinks) {
            const path = link.getAttribute("href").split("#")[0];
            link.href = path + (showPortfolio ? location.hash : "");
        }
        if (showPortfolio) {
            pause();
            if (dialog.open) dialog.close();
            const details = anchor.closest("details");
            if (details) details.open = true;
            if (anchor === portfolio) window.scrollTo(0, 0);
            else anchor.scrollIntoView();
        } else {
            window.scrollTo(0, 0);
            paint();
        }
    }

    playButton.addEventListener("click", play);
    pauseButton.addEventListener("click", () => pause(true));
    resetButton.addEventListener("click", confirmReset);
    canvas.addEventListener("pointerdown", () => {
        if (phase === "playing") stage.focus({ preventScroll: true });
    });
    chapters.forEach((chapter, chapterIndex) => {
        chapter.addEventListener("click", () => {
            if (chapterIndex < progress.completed) showDossier(chapterIndex, false);
            else if (chapterIndex === index) {
                stage.scrollIntoView({ block: "nearest" });
                play();
            }
        });
    });
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        dialogBody.replaceChildren();
        if (!game.hidden && phase !== "playing") focusAfterDialog?.focus({ preventScroll: true });
        focusAfterDialog = null;
    });

    document.addEventListener("keydown", event => {
        if (game.hidden || dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.code === "Escape" && phase === "playing") {
            pause(true);
            return;
        }
        if (phase === "done" || !movementCodes.has(event.code) ||
            event.target.closest?.("a, button, input, select, textarea, [contenteditable]")) return;
        event.preventDefault();
        if (phase !== "playing") play();
        if (jumpCodes.includes(event.code) && !isHeld(jumpCodes, "jump")) nextJump = true;
        keys.add(event.code);
    });
    document.addEventListener("keyup", event => keys.delete(event.code));
    game.querySelectorAll("[data-touch]").forEach(control => {
        control.addEventListener("pointerdown", event => {
            if (dialog.open || phase === "done" || event.button > 0) return;
            event.preventDefault();
            if (phase !== "playing") play();
            const direction = control.dataset.touch;
            if (direction === "jump" && !isHeld(jumpCodes, "jump")) nextJump = true;
            pointers.set(event.pointerId, direction);
            control.setPointerCapture(event.pointerId);
        });
        for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
            control.addEventListener(type, event => pointers.delete(event.pointerId));
        }
    });

    window.addEventListener("blur", () => pause());
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pause();
    });
    window.addEventListener("hashchange", syncView);
    window.addEventListener("storage", event => {
        if (event.key !== storageKey && event.key !== null) return;
        progress = readProgress();
        if (dialog.open) dialog.close();
        loadChapter();
    });
    smallScreen.addEventListener("change", sizeStage);
    reducedMotion.addEventListener("change", paint);

    sizeStage();
    loadChapter();
    syncView();
})();
