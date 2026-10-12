import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";


// ===================================
// ELEMENTS ZA UKURASA
// ===================================

const loading = document.getElementById("loading");
const content = document.getElementById("content");
const errorBox = document.getElementById("error");

const freeTab = document.getElementById("freeTab");
const vipTab = document.getElementById("vipTab");

const freeSection = document.getElementById("freeSection");
const vipSection = document.getElementById("vipSection");

const tipsGrid = document.getElementById("tipsGrid");
const tipsCount = document.getElementById("tipsCount");
const emptyMessage = document.getElementById("emptyMessage");

const vipTipsGrid = document.getElementById("vipTipsGrid");
const vipTipsCount = document.getElementById("vipTipsCount");
const vipEmptyMessage = document.getElementById("vipEmptyMessage");

const joinVipBtn = document.getElementById("joinVipBtn");
const backBtn = document.getElementById("backBtn");

let unsubscribeTips = null;
let unsubscribeVipMatches = null;

let allTips = [];
let allVipMatches = [];

let countdownInterval = null;


// ===================================
// UJUMBE WA HITILAFU
// ===================================

function showError(message) {
    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.style.display = "block";
}

function hideError() {
    if (!errorBox) return;

    errorBox.textContent = "";
    errorBox.style.display = "none";
}


// ===================================
// MUDA
// ===================================

function getTimestamp(value) {
    if (!value) return 0;

    if (typeof value.toMillis === "function") {
        return value.toMillis();
    }

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    const result = new Date(value).getTime();

    return Number.isNaN(result) ? 0 : result;
}


function getKickoffTimestamp(match) {
    const date = String(match.date || "").trim();
    const time = String(match.time || "").trim();

    if (
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        /^\d{2}:\d{2}$/.test(time)
    ) {
        const timestamp = Date.parse(
            `${date}T${time}:00+03:00`
        );

        if (!Number.isNaN(timestamp)) {
            return timestamp;
        }
    }

    const otherTime =
        match.kickoff ||
        match.kickoffTime ||
        match.matchTime;

    if (otherTime) {
        return getTimestamp(otherTime);
    }

    return 0;
}


function formatDateTime(timestamp) {
    if (!timestamp) {
        return "Muda haujawekwa";
    }

    return new Intl.DateTimeFormat("sw-TZ", {
        timeZone: "Africa/Dar_es_Salaam",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(new Date(timestamp));
}


function formatCountdown(milliseconds) {
    const total = Math.max(
        0,
        Math.floor(milliseconds / 1000)
    );

    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");

    if (days > 0) {
        return `⏳ ${days}d ${hh}h ${mm}m ${ss}s REMAINING`;
    }

    return `⏳ ${hh}h ${mm}m ${ss}s REMAINING`;
}


function getMatchInfo(match) {
    const kickoff = getKickoffTimestamp(match);

    if (!kickoff) {
        return {
            state: "unknown",
            label: "Muda haujawekwa"
        };
    }

    const now = Date.now();
    const duration = Number(match.durationMinutes) || 105;
    const endTime = kickoff + duration * 60 * 1000;

    if (now < kickoff) {
        return {
            state: "upcoming",
            label: formatCountdown(kickoff - now)
        };
    }

    if (now < endTime) {
        return {
            state: "started",
            label: "⚽ MATCH STARTED"
        };
    }

    return {
        state: "ended",
        label: "🏁 GAME ENDED"
    };
}


// ===================================
// MATOKEO YA TIP
// ===================================

function getTipResult(tip) {
    const status = String(
        tip.status || tip.result || "Pending"
    ).trim().toLowerCase();

    if (status === "win" || status === "won") {
        return {
            label: "WIN",
            className: "won"
        };
    }

    if (status === "lost" || status === "lose") {
        return {
            label: "LOST",
            className: "lost"
        };
    }

    if (status === "void") {
        return {
            label: "VOID",
            className: "void"
        };
    }

    return {
        label: "PENDING",
        className: "pending"
    };
}


// ===================================
// KUUNDA KIPENGELE CHA HTML KWA USALAMA
// ===================================

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }

    return element;
}


// ===================================
// KADI ZA FREE TIPS
// ===================================

function createFreeTipCard(tip) {
    const card = createElement("article", "tip-card");

    const top = createElement("div", "tip-top");

    const league = createElement(
        "span",
        "league",
        "🏆 " + (tip.league || tip.category || "Betting Tips")
    );

    const result = getTipResult(tip);

    const status = createElement(
        "span",
        `status ${result.className}`,
        result.label
    );

    top.append(league, status);

    const home = tip.homeTeam || tip.home || "";
    const away = tip.awayTeam || tip.away || "";

    const teams = createElement(
        "div",
        "teams",
        home && away
            ? `${home} VS ${away}`
            : tip.match || tip.title || "Mechi"
    );

    const kickoff = getKickoffTimestamp(tip);

    const matchTime = createElement(
        "div",
        "match-time",
        kickoff
            ? `📅 ${formatDateTime(kickoff)}`
            : "📅 Muda haujawekwa"
    );

    const info = getMatchInfo(tip);

    const matchStatus = createElement(
        "div",
        `match-status ${info.state}`,
        info.label
    );

    matchStatus.dataset.tipId = tip.id;
    matchStatus.dataset.kind = "free";

    const predictionBox = createElement(
        "div",
        "prediction-box"
    );

    const predictionWrap = document.createElement("div");

    predictionWrap.append(
        createElement("span", "label", "PREDICTION"),
        createElement(
            "div",
            "prediction",
            tip.prediction || tip.content || "Utabiri haujawekwa"
        )
    );

    const oddsWrap = document.createElement("div");

    oddsWrap.append(
        createElement("span", "label", "ODDS"),
        createElement("div", "odds", tip.odds ?? "—")
    );

    predictionBox.append(predictionWrap, oddsWrap);

    card.append(
        top,
        teams,
        matchTime,
        matchStatus,
        predictionBox
    );

    return card;
}


// ===================================
// KADI ZA VIP MATCHES
// Taarifa za mechi ni za umma.
// Prediction na odds hazisomwi hapa.
// ===================================

function createVipMatchCard(match) {
    const card = createElement("article", "tip-card vip-card");

    const top = createElement("div", "tip-top");

    const league = createElement(
        "span",
        "league",
        "🏆 " + (match.league || "VIP MATCH")
    );

    const vipBadge = createElement(
        "span",
        "status pending",
        "🔒 VIP"
    );

    top.append(league, vipBadge);

    const home = match.homeTeam || match.home || "";
    const away = match.awayTeam || match.away || "";

    const teams = createElement(
        "div",
        "teams",
        home && away
            ? `${home} VS ${away}`
            : match.match || match.title || "Mechi ya VIP"
    );

    const kickoff = getKickoffTimestamp(match);

    const matchTime = createElement(
        "div",
        "match-time",
        kickoff
            ? `📅 ${formatDateTime(kickoff)}`
            : "📅 Muda haujawekwa"
    );

    const info = getMatchInfo(match);

    const matchStatus = createElement(
        "div",
        `match-status ${info.state}`,
        info.label
    );

    matchStatus.dataset.tipId = match.id;
    matchStatus.dataset.kind = "vip";

    const market = createElement(
        "div",
        "vip-market",
        match.market ? `🎯 ${match.market}` : "🎯 VIP Prediction"
    );

    const lockedBox = createElement(
        "div",
        "prediction-box vip-locked"
    );

    lockedBox.append(
        createElement("div", "prediction", "🔒 Utabiri na Odds zimefungwa"),
        createElement(
            "p",
            "vip-lock-message",
            "Jiunge na VIP ili kupata utabiri na odds za mechi hii."
        )
    );

    const joinButton = createElement(
        "button",
        "join-vip-card-btn",
        "🔓 JIUNGE NA VIP"
    );

    joinButton.type = "button";

    joinButton.addEventListener("click", () => {
        window.location.href = "premium.html";
    });

    card.append(
        top,
        teams,
        matchTime,
        matchStatus,
        market,
        lockedBox,
        joinButton
    );

    return card;
}


// ===================================
// KUONYESHA FREE TIPS
// ===================================

function renderFreeTips() {
    if (!tipsGrid || !tipsCount || !emptyMessage) return;

    const freeTips = allTips.filter(tip => {
        const type = String(tip.type || "FREE")
            .trim()
            .toUpperCase();

        return type === "FREE";
    });

    tipsCount.textContent = `${freeTips.length} Tips`;

    tipsGrid.replaceChildren();

    if (freeTips.length === 0) {
        emptyMessage.hidden = false;
        return;
    }

    emptyMessage.hidden = true;

    freeTips.forEach(tip => {
        tipsGrid.appendChild(createFreeTipCard(tip));
    });
}


// ===================================
// KUONYESHA VIP MATCHES
// ===================================

function renderVipMatches() {
    if (!vipTipsGrid || !vipTipsCount || !vipEmptyMessage) {
        console.error(
            "VIP HTML elements hazipo. Hakikisha tips.html ina vipTipsGrid, vipTipsCount na vipEmptyMessage."
        );
        return;
    }

    // Onyesha mechi zote zilizowekwa kwenye vipMatches.
    // Prediction na odds hazichukuliwi kutoka collection hii.
    const matches = [...allVipMatches].sort((a, b) => {
        return getKickoffTimestamp(a) - getKickoffTimestamp(b);
    });

    vipTipsCount.textContent = `${matches.length} VIP Matches`;

    vipTipsGrid.replaceChildren();

    if (matches.length === 0) {
        vipEmptyMessage.hidden = false;
        return;
    }

    vipEmptyMessage.hidden = true;

    matches.forEach(match => {
        vipTipsGrid.appendChild(createVipMatchCard(match));
    });
}


// ===================================
// COUNTDOWN
// ===================================

function updateCountdowns() {
    document.querySelectorAll(
        ".match-status[data-tip-id]"
    ).forEach(element => {
        const id = element.dataset.tipId;
        const kind = element.dataset.kind;

        const source = kind === "vip"
            ? allVipMatches
            : allTips;

        const match = source.find(item => item.id === id);

        if (!match) return;

        const info = getMatchInfo(match);

        element.textContent = info.label;

        element.classList.remove(
            "upcoming",
            "started",
            "ended",
            "unknown"
        );

        element.classList.add(info.state);
    });
}


// ===================================
// FREE / VIP TABS
// ===================================

function switchTab(type) {
    const showFree = type === "free";

    if (freeSection) {
        freeSection.hidden = !showFree;
    }

    if (vipSection) {
        vipSection.hidden = showFree;
    }

    if (freeTab) {
        freeTab.classList.toggle("active", showFree);
    }

    if (vipTab) {
        vipTab.classList.toggle("active", !showFree);
    }

    if (showFree) {
        renderFreeTips();
    } else {
        renderVipMatches();
    }
}

if (freeTab) {
    freeTab.addEventListener("click", () => {
        switchTab("free");
    });
}

if (vipTab) {
    vipTab.addEventListener("click", () => {
        switchTab("vip");
    });
}


// ===================================
// BUTTONS
// ===================================

if (joinVipBtn) {
    joinVipBtn.addEventListener("click", () => {
        window.location.href = "premium.html";
    });
}

if (backBtn) {
    backBtn.addEventListener("click", () => {
        window.location.href = "user.html";
    });
}


// ===================================
// FIRESTORE: FREE TIPS
// ===================================

function startFreeTipsListener() {
    if (unsubscribeTips) {
        unsubscribeTips();
        unsubscribeTips = null;
    }

    unsubscribeTips = onSnapshot(
        collection(db, "tips"),

        snapshot => {
            allTips = snapshot.docs.map(document => ({
                id: document.id,
                ...document.data()
            }));

            allTips.sort((a, b) => {
                return getTimestamp(b.createdAt) -
                       getTimestamp(a.createdAt);
            });

            renderFreeTips();

            hideError();

            if (loading) {
                loading.style.display = "none";
            }

            if (content) {
                content.style.display = "block";
            }
        },

        error => {
            console.error("Free Tips Firebase error:", error);

            showError(
                "Imeshindikana kupakia Free Tips. " +
                "Angalia Firestore Rules na intaneti."
            );
        }
    );
}


// ===================================
// FIRESTORE: VIP MATCHES
// ===================================

function startVipMatchesListener() {
    if (unsubscribeVipMatches) {
        unsubscribeVipMatches();
        unsubscribeVipMatches = null;
    }

    unsubscribeVipMatches = onSnapshot(
        collection(db, "vipMatches"),

        snapshot => {
            allVipMatches = snapshot.docs.map(document => ({
                id: document.id,
                ...document.data()
            }));

            renderVipMatches();

            hideError();

            if (loading) {
                loading.style.display = "none";
            }

            if (content) {
                content.style.display = "block";
            }
        },

        error => {
            console.error("VIP Matches Firebase error:", error);

            showError(
                "Imeshindikana kupakia VIP Matches. " +
                "Hakikisha Firestore Rules zinaruhusu kusoma vipMatches."
            );
        }
    );
}


// ===================================
// KUHAKIKI LOGIN
// ===================================

onAuthStateChanged(
    auth,

    user => {
        if (!user) {
            if (unsubscribeTips) {
                unsubscribeTips();
                unsubscribeTips = null;
            }

            if (unsubscribeVipMatches) {
                unsubscribeVipMatches();
                unsubscribeVipMatches = null;
            }

            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }

            window.location.replace("auth.html");
            return;
        }

        const params = new URLSearchParams(
            window.location.search
        );

        const requestedType = params.get("type");

        switchTab(
            requestedType === "vip" ? "vip" : "free"
        );

        startFreeTipsListener();
        startVipMatchesListener();

        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        countdownInterval = setInterval(
            updateCountdowns,
            1000
        );
    },

    error => {
        console.error("Authentication error:", error);

        if (loading) {
            loading.style.display = "none";
        }

        showError(
            "Imeshindikana kuthibitisha akaunti yako. " +
            "Tafadhali jaribu tena."
        );
    }
);


// ===================================
// KUSAFISHA LISTENERS
// ===================================

window.addEventListener("pagehide", () => {
    if (unsubscribeTips) {
        unsubscribeTips();
        unsubscribeTips = null;
    }

    if (unsubscribeVipMatches) {
        unsubscribeVipMatches();
        unsubscribeVipMatches = null;
    }

    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
});