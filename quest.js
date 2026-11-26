(() => {
    "use strict";

    const game = document.querySelector("#game");
    const portfolio = document.querySelector("#portfolio");
    const dialog = document.querySelector("#quest-dialog");

    // The original portfolio remains readable without JavaScript or dialog support.
    if (typeof dialog.showModal !== "function") return;

    const copy = questMissions[document.documentElement.lang] ?? questMissions.en;
    const world = game.querySelector("[data-world]");
    const rover = game.querySelector("[data-rover]");
    const stations = [...game.querySelectorAll("[data-station]")];
    const missions = [...game.querySelectorAll("[data-mission]")];
    const nextButton = game.querySelector("[data-next]");
    const resetButton = game.querySelector("[data-reset]");
    const saveState = game.querySelector("[data-save-state]");
    const progressBar = game.querySelector("[data-progress]");
    const completedCount = game.querySelector("[data-count]");
    const worldHint = game.querySelector("[data-world-hint]");
    const dialogContext = dialog.querySelector("[data-dialog-context]");
    const dialogBody = dialog.querySelector("[data-dialog-body]");
    const gameLink = document.querySelector('[data-view="game"]');
    const portfolioLink = document.querySelector('[data-view="portfolio"]');
    const languageLinks = [...document.querySelectorAll(".language-nav a")];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const storageKey = "qa-quest.progress.v1";

    const map = { left: 8, right: 92, top: 52, bottom: 91, ratio: 16 / 9 };
    const start = { x: 50, y: 83 };
    const terminals = [
        { x: 20, y: 47, reward: "#stack .content__stack", challenge: "diagnostics" },
        { x: 50, y: 47, reward: "#project-ebay", challenge: "web" },
        { x: 81, y: 47, reward: "#project-api", challenge: "api" },
    ];
    const terminalHintDistance = 8.5;
    const speed = 62;
    const directions = new Map([
        ["ArrowLeft", "left"], ["KeyA", "left"],
        ["ArrowRight", "right"], ["KeyD", "right"],
        ["ArrowUp", "up"], ["KeyW", "up"],
        ["ArrowDown", "down"], ["KeyS", "down"],
    ]);

    const keys = new Set();
    let position = { ...start };
    let frame = 0;
    let lastTime = 0;
    let destination = null;
    let nearby = -1;
    let activeDialog = -1;
    let returnFocus = null;
    let saved = readProgress();
    let completed = saved ?? 0;

    function readProgress() {
        try {
            const value = Number(localStorage.getItem(storageKey));
            return Number.isInteger(value) && value >= 0 && value <= terminals.length ? value : 0;
        } catch {
            return null;
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem(storageKey, String(completed));
            saved = completed;
        } catch {
            saved = null;
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

    function showHint(message) {
        if (worldHint.textContent !== message) worldHint.textContent = message;
    }

    function updateHint() {
        if (nearby > completed) {
            showHint(copy.lockedHint);
        } else if (nearby >= 0) {
            showHint(copy.nearHint);
        } else {
            showHint(completed === terminals.length ? copy.allDone : copy.moveHint);
        }
    }

    function renderProgress() {
        completedCount.textContent = `${completed} / ${terminals.length}`;
        progressBar.value = completed;
        terminals.forEach((_, index) => {
            const state = index < completed ? "done" : index === completed ? "active" : "locked";
            const label = stations[index].querySelector(".station-name").textContent;
            stations[index].dataset.state = state;
            stations[index].disabled = state === "locked";
            stations[index].setAttribute("aria-label", `${label} · ${copy.states[state]}`);
            missions[index].dataset.state = state;
            missions[index].disabled = state === "locked";
            missions[index].querySelector(".mission-state").textContent = copy.states[state];
        });
        nextButton.textContent = copy.start[completed] ?? copy.allMaterials;
        resetButton.hidden = completed === 0;
        saveState.hidden = completed === 0;
        const saveMessage = saved === completed ? copy.saved : copy.sessionOnly;
        saveState.textContent = completed === terminals.length ? `${copy.allDone} ${saveMessage}` : saveMessage;
        updateHint();
    }

    function setCoordinates(target, { x, y }) {
        target.style.setProperty("--map-x", `${x}%`);
        target.style.setProperty("--map-y", `${y}%`);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function distance(x, y) {
        return Math.hypot(x, y / map.ratio);
    }

    function placeRover(x, y) {
        const nextX = clamp(x, map.left, map.right);
        if (nextX !== position.x) rover.style.setProperty("--heading", nextX < position.x ? -1 : 1);
        position = { x: nextX, y: clamp(y, map.top, map.bottom) };
        setCoordinates(rover, position);

        const near = terminals.findIndex(terminal =>
            distance(terminal.x - position.x, terminal.y + 8 - position.y) < terminalHintDistance
        );
        if (near === nearby) return;
        if (nearby >= 0) stations[nearby].removeAttribute("data-near");
        nearby = near;
        if (nearby >= 0) stations[nearby].dataset.near = "true";
        updateHint();
    }

    function stopMoving() {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        destination = null;
        keys.clear();
        rover.removeAttribute("data-moving");
    }

    function tick(time) {
        frame = 0;
        const travel = speed * Math.min((time - lastTime) / 1000 || .016, .1);
        lastTime = time;

        if (destination) {
            const dx = destination.x - position.x;
            const dy = destination.y - position.y;
            const remaining = distance(dx, dy);
            if (remaining <= travel) {
                const arrival = destination;
                destination = null;
                placeRover(arrival.x, arrival.y);
                if (arrival.station !== undefined) openStation(arrival.station);
            } else {
                placeRover(position.x + dx * travel / remaining, position.y + dy * travel / remaining);
            }
        } else if (keys.size) {
            const held = new Set([...keys].map(key => directions.get(key)));
            const dx = Number(held.has("right")) - Number(held.has("left"));
            const dy = Number(held.has("down")) - Number(held.has("up"));
            const length = Math.hypot(dx, dy) || 1;
            placeRover(position.x + travel * dx / length, position.y + travel * dy * map.ratio / length);
        }

        if (destination || keys.size) motionFrame();
        else stopMoving();
    }

    function motionFrame() {
        if (frame) return;
        if (!lastTime) lastTime = performance.now();
        rover.setAttribute("data-moving", "");
        frame = requestAnimationFrame(tick);
    }

    function moveTo(x, y, station) {
        stopMoving();
        const targetX = clamp(x, map.left, map.right);
        const targetY = clamp(y, map.top, map.bottom);
        if (reducedMotion.matches) {
            placeRover(targetX, targetY);
            if (station !== undefined) openStation(station);
            return;
        }
        destination = { x: targetX, y: targetY, station };
        motionFrame();
    }

    function visitStation(index, trigger) {
        if (index > completed || dialog.open) return;
        returnFocus = trigger;
        const terminal = terminals[index];
        moveTo(terminal.x, terminal.y + 8, index);
    }

    function showDialog(context, title, detail, children) {
        stopMoving();
        dialogContext.textContent = context;
        const heading = element("h2", "", title);
        heading.id = "quest-dialog-title";
        heading.tabIndex = -1;
        dialogBody.replaceChildren(heading);
        if (detail) dialogBody.append(element("p", "", detail));
        dialogBody.append(...children);
        if (!dialog.open) dialog.showModal();
        dialog.scrollTop = 0;
        heading.focus({ preventScroll: true });
    }

    function openStation(index) {
        if (index > completed || game.hidden || dialog.open) return;
        activeDialog = index;
        if (index < completed) {
            showReward(index, false);
            return;
        }

        const terminal = terminals[index];
        const scenario = copy[terminal.challenge];
        const feedback = element("p", "challenge-feedback");
        feedback.setAttribute("role", "status");
        const reward = () => completeMission(index);
        const challenge = {
            diagnostics: buildDiagnostics,
            web: buildCatalog,
            api: buildContract,
        }[terminal.challenge](scenario, feedback, reward);
        showDialog(`${copy.mission} 0${index + 1}`, scenario.title, scenario.instruction, [challenge, feedback]);
    }

    function buildDiagnostics(scenario, feedback, reward) {
        const grid = element("div", "challenge");
        const labels = element("div", "diagnostic-grid diagnostic-labels");
        labels.append(...scenario.columns.map(label => element("span", "", label)));
        grid.append(labels);

        scenario.rows.forEach(([name, expected, actual]) => {
            const row = button("", "challenge-option diagnostic-grid", () => {
                if (expected !== actual) reward();
                else feedback.textContent = scenario.retry;
            });
            row.setAttribute("aria-label", `${name}. ${scenario.columns[1]}: ${expected}. ${scenario.columns[2]}: ${actual}.`);
            row.append(...[name, expected, actual].map(label => element("span", "", label)));
            grid.append(row);
        });
        return grid;
    }

    function buildCatalog(scenario, feedback, reward) {
        const catalog = element("div", "challenge catalog");
        const grid = element("div", "catalog-grid");
        let filtered = false;
        const filter = button(scenario.filter, "quest-button", () => {
            filtered = !filtered;
            filter.setAttribute("aria-pressed", String(filtered));
            cards[3].hidden = filtered;
            feedback.textContent = "";
        });
        filter.setAttribute("aria-pressed", "false");

        // The adapter is filtered correctly. The out-of-stock headset is the simulated defect.
        const stock = [true, false, true, false];
        const cards = scenario.items.map((name, index) => {
            const available = stock[index];
            const card = button("", "challenge-option catalog-item", () => {
                if (!filtered) feedback.textContent = scenario.useFilter;
                else if (available) feedback.textContent = scenario.retry;
                else reward();
            });
            card.dataset.inStock = String(available);
            card.append(element("strong", "", name), element("small", "", available ? scenario.inStock : scenario.outOfStock));
            return card;
        });
        grid.append(...cards);
        catalog.append(filter, grid);
        return catalog;
    }

    function buildContract(scenario, feedback, reward) {
        const challenge = element("div", "challenge");
        const contract = element("dl", "contract");
        contract.setAttribute("aria-label", scenario.contract);
        const fields = ["id", "name", "active"];
        const response = { id: 42, name: "Demo", active: "true" };
        const expectedTypes = ["number", "string", "boolean"];
        const terminal = element("div", "response");
        const lines = element("div", "response-lines");

        fields.forEach((field, index) => {
            const expected = element("div");
            expected.append(element("dt", "", field), element("dd", "", scenario.types[index]));
            contract.append(expected);

            const value = response[field];
            const comma = index < fields.length - 1 ? "," : "";
            lines.append(button(`"${field}": ${JSON.stringify(value)}${comma}`, "challenge-option", () => {
                if (typeof value !== expectedTypes[index]) reward();
                else feedback.textContent = scenario.retry;
            }));
        });

        terminal.append(
            element("p", "response-status", "200 OK"),
            element("div", "", "{"),
            lines,
            element("div", "", "}")
        );
        challenge.append(contract, terminal);
        return challenge;
    }

    function completeMission(index) {
        if (index > completed) return;
        if (index === completed) {
            completed += 1;
            saveProgress();
            renderProgress();
        }
        showReward(index, true);
    }

    function showReward(index, justUnlocked) {
        const terminal = terminals[index];
        const heading = missions[index].querySelector(".mission-copy > span").textContent;
        const content = document.querySelector(terminal.reward).cloneNode(true);
        content.removeAttribute("id");
        const reward = element("div", "reward-content");
        reward.append(content);

        const actions = element("div", "dialog-actions");
        actions.append(button(copy.back, "quest-button primary", () => {
            if (justUnlocked && returnFocus !== world) returnFocus = nextButton;
            dialog.close();
            if (justUnlocked && !reducedMotion.matches) {
                world.setAttribute("data-sweep", "");
            }
        }));
        showDialog(copy.reward, heading, null, [
            element("p", "reward-status", justUnlocked ? copy[terminal.challenge].success : copy.states.done),
            reward,
            actions,
        ]);
    }

    function confirmReset() {
        returnFocus = resetButton;
        const actions = element("div", "dialog-actions");
        actions.append(
            button(copy.cancel, "quest-button", () => dialog.close()),
            button(copy.reset, "quest-button primary", () => {
                completed = 0;
                saveProgress();
                placeRover(start.x, start.y);
                renderProgress();
                returnFocus = nextButton;
                dialog.close();
            })
        );
        showDialog(copy.reset, copy.reset, copy.resetDetail, [actions]);
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
        const homeLink = document.querySelector("[data-home]");
        homeLink.href = "#game";

        languageLinks.forEach(link => {
            const page = link.getAttribute("href").split("#")[0];
            link.href = page + (showPortfolio ? location.hash : "");
        });

        if (showPortfolio) {
            stopMoving();
            if (dialog.open) dialog.close();
            const details = anchor.closest("details");
            if (details) details.open = true;
            if (anchor === portfolio) window.scrollTo(0, 0);
            else anchor.scrollIntoView();
        } else {
            window.scrollTo(0, 0);
        }
    }

    stations.forEach((station, index) => {
        setCoordinates(station, terminals[index]);
        station.addEventListener("click", () => visitStation(index, station));
        missions[index].addEventListener("click", () => {
            if (index < completed) {
                returnFocus = missions[index];
                openStation(index);
            } else {
                visitStation(index, missions[index]);
            }
        });
    });

    world.addEventListener("click", event => {
        if (event.target.closest("[data-station]") || dialog.open) return;
        const bounds = world.getBoundingClientRect();
        world.focus({ preventScroll: true });
        moveTo((event.clientX - bounds.left) / bounds.width * 100, (event.clientY - bounds.top) / bounds.height * 100);
    });
    world.addEventListener("animationend", event => {
        if (event.animationName === "sweep") world.removeAttribute("data-sweep");
    });

    nextButton.addEventListener("click", () => {
        if (completed === terminals.length) location.hash = "portfolio";
        else visitStation(completed, nextButton);
    });
    resetButton.addEventListener("click", confirmReset);
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        dialogBody.replaceChildren();
        activeDialog = -1;
        if (!game.hidden) (returnFocus ?? world).focus({ preventScroll: true });
        returnFocus = null;
    });

    document.addEventListener("keydown", event => {
        if (game.hidden || dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.target.closest("a, button, input, select, textarea, [contenteditable]")) return;
        if (directions.has(event.code)) {
            event.preventDefault();
            destination = null;
            keys.add(event.code);
            motionFrame();
        } else if (event.code === "KeyE" && !event.repeat) {
            event.preventDefault();
            returnFocus = world;
            if (nearby < 0) showHint(copy.farHint);
            else if (nearby > completed) showHint(copy.lockedHint);
            else openStation(nearby);
        }
    });
    document.addEventListener("keyup", event => keys.delete(event.code));
    window.addEventListener("blur", stopMoving);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopMoving();
    });
    window.addEventListener("hashchange", syncView);
    window.addEventListener("storage", event => {
        if (event.key !== storageKey && event.key !== null) return;
        saved = readProgress();
        if (saved === null) return;
        completed = saved;
        if (activeDialog > completed && dialog.open) dialog.close();
        renderProgress();
    });

    placeRover(start.x, start.y);
    renderProgress();
    syncView();
})();
