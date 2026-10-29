import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";


// ============================================
// 1. ELEMENTS
// ============================================

const loading = document.getElementById("loading");
const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const messageBox = document.getElementById("message");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const tipForm = document.getElementById("tipForm");
const appForm = document.getElementById("appForm");
const pricingForm = document.getElementById("pricingForm");

const freeTipsList = document.getElementById("freeTipsList");
const premiumTipsList = document.getElementById("premiumTipsList");
const appsList = document.getElementById("appsList");
const paymentsList = document.getElementById("paymentsList");

const publishTipBtn = document.getElementById("publishTipBtn");
const cancelTipEdit = document.getElementById("cancelTipEdit");

let currentAdmin = null;
let editingTipId = null;
let editingTipCollection = null;
let messageTimer = null;
let authCheckNumber = 0;


// ============================================
// 2. COLLECTIONS
// ============================================

const FREE_TIPS = "tips";
const PREMIUM_TIPS = "premiumTips";
const VIP_MATCHES = "vipMatches";


// ============================================
// 3. LOADING
// ============================================

function showLoading() {
    loading.style.display = "block";
    loginBox.style.display = "none";
    dashboard.style.display = "none";
    logoutBtn.hidden = true;
}

function hideLoading() {
    loading.style.display = "none";
}


// ============================================
// 4. UJUMBE
// ============================================

function showMessage(message, type = "success") {
    messageBox.textContent = message;
    messageBox.className = `message ${type}`;

    clearTimeout(messageTimer);

    messageTimer = setTimeout(() => {
        messageBox.className = "message";
        messageBox.textContent = "";
    }, 7000);
}


// ============================================
// 5. KUONYESHA LOGIN NA DASHBOARD
// ============================================

function showLogin() {
    hideLoading();

    dashboard.style.display = "none";
    loginBox.style.display = "block";
    logoutBtn.hidden = true;
}

function showDashboard() {
    hideLoading();

    loginBox.style.display = "none";
    dashboard.style.display = "block";
    logoutBtn.hidden = false;
}


// ============================================
// 6. KUKAGUA RUHUSA ZA ADMIN
// ============================================

async function checkAdmin(user) {
    const adminRef = doc(db, "admins", user.uid);
    const snapshot = await getDoc(adminRef);

    return (
        snapshot.exists() &&
        snapshot.data().active === true
    );
}


// ============================================
// 7. LOGIN
// ============================================

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = document
        .getElementById("loginEmail")
        .value.trim();

    const password = document
        .getElementById("loginPassword")
        .value;

    const button = loginForm.querySelector(
        'button[type="submit"]'
    );

    button.disabled = true;
    button.textContent = "INAINGIA...";

    try {
        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        showMessage(
            "Umeingia. Inakagua ruhusa za Admin..."
        );

    } catch (error) {
        console.error("Login error:", error);

        let message =
            "Imeshindikana kuingia. Hakikisha email na nenosiri ni sahihi.";

        if (error.code === "auth/network-request-failed") {
            message = "Tatizo la intaneti. Jaribu tena.";
        } else if (error.code === "auth/too-many-requests") {
            message = "Majaribio yamezidi. Subiri kisha ujaribu tena.";
        } else if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/invalid-login-credentials"
        ) {
            message = "Email au nenosiri si sahihi.";
        }

        showMessage(message, "error");

    } finally {
        button.disabled = false;
        button.textContent = "INGIA KWENYE ADMIN";
    }
});


// ============================================
// 8. KUTOKA KWENYE AKAUNTI
// ============================================

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        showMessage("Umetoka kwenye akaunti.");

    } catch (error) {
        console.error("Logout error:", error);

        showMessage(
            "Imeshindikana kutoka. Jaribu tena.",
            "error"
        );
    }
});


// ============================================
// 9. NAVIGATION
// ============================================

document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".nav-button").forEach(item => {
            item.classList.remove("active");
        });

        document.querySelectorAll(".section").forEach(section => {
            section.classList.remove("active");
        });

        button.classList.add("active");

        const section = document.getElementById(
            button.dataset.section
        );

        if (section) {
            section.classList.add("active");
        }
    });
});


// ============================================
// 10. TAARIFA ZA VIP ZINAZOONEKANA KWA WOTE
// ============================================

// HAPA HATUHIFADHI prediction, odds au description.
// Taarifa za siri zinabaki kwenye premiumTips.

function makeVipPublicData(tip) {
    return {
        type: "PREMIUM",
        league: tip.league || "",
        homeTeam: tip.homeTeam || "",
        awayTeam: tip.awayTeam || "",
        date: tip.date || "",
        time: tip.time || "",
        market: tip.market || "",
        createdAt: tip.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: currentAdmin.uid
    };
}

async function saveVipPublicData(tipId, tipData) {
    await setDoc(
        doc(db, VIP_MATCHES, tipId),
        makeVipPublicData(tipData),
        { merge: true }
    );
}

async function deleteVipPublicData(tipId) {
    await deleteDoc(
        doc(db, VIP_MATCHES, tipId)
    );
}


// ============================================
// 11. KUCHAPISHA NA KUREKEBISHA TIP
// ============================================

tipForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentAdmin) {
        showMessage(
            "Huna ruhusa ya Admin. Ingia tena.",
            "error"
        );
        return;
    }

    const type = document.getElementById("tipType").value;

    const targetCollection =
        type === "PREMIUM"
            ? PREMIUM_TIPS
            : FREE_TIPS;

    const odds = Number(
        document.getElementById("tipOdds").value
    );

    if (!Number.isFinite(odds) || odds < 1) {
        showMessage("Weka odds halali.", "error");
        return;
    }

    const data = {
        type,

        league: document
            .getElementById("tipLeague")
            .value.trim(),

        homeTeam: document
            .getElementById("tipHomeTeam")
            .value.trim(),

        awayTeam: document
            .getElementById("tipAwayTeam")
            .value.trim(),

        date: document.getElementById("tipDate").value,

        time: document.getElementById("tipTime").value,

        market: document.getElementById("tipMarket").value,

        prediction: document
            .getElementById("tipPrediction")
            .value.trim(),

        odds,

        status: document.getElementById("tipStatus").value,

        description: document
            .getElementById("tipDescription")
            .value.trim(),

        updatedAt: serverTimestamp(),
        updatedBy: currentAdmin.uid
    };

    if (
        !data.league ||
        !data.homeTeam ||
        !data.awayTeam ||
        !data.date ||
        !data.time ||
        !data.prediction
    ) {
        showMessage(
            "Jaza taarifa zote zinazohitajika.",
            "error"
        );
        return;
    }

    const wasEditing = Boolean(editingTipId);

    publishTipBtn.disabled = true;
    publishTipBtn.textContent = "INAHIFADHI...";

    try {
        // ------------------------------------
        // KUHARIRI TIP ILIYOPO
        // ------------------------------------

        if (editingTipId) {
            const oldCollection = editingTipCollection;
            const oldId = editingTipId;

            const oldRef = doc(
                db,
                oldCollection,
                oldId
            );

            const oldSnapshot = await getDoc(oldRef);

            if (!oldSnapshot.exists()) {
                throw new Error(
                    "Tip ya awali haipatikani."
                );
            }

            const oldData = oldSnapshot.data();

            data.createdAt =
                oldData.createdAt || serverTimestamp();

            data.createdBy =
                oldData.createdBy || currentAdmin.uid;

            // Tip inabaki kwenye collection ileile.
            if (oldCollection === targetCollection) {
                if (targetCollection === PREMIUM_TIPS) {
                    // Hifadhi siri na metadata kwa batch.
                    const batch = writeBatch(db);

                    batch.update(oldRef, data);

                    batch.set(
                        doc(db, VIP_MATCHES, oldId),
                        makeVipPublicData(data),
                        { merge: true }
                    );

                    await batch.commit();

                } else {
                    // Tip ya kawaida haihitaji VIP metadata.
                    const batch = writeBatch(db);

                    batch.update(oldRef, data);

                    batch.delete(
                        doc(db, VIP_MATCHES, oldId)
                    );

                    await batch.commit();
                }

            } else {
                // Tip inahamishwa kati ya Free na VIP.
                const newRef = doc(
                    collection(db, targetCollection)
                );

                const batch = writeBatch(db);

                batch.set(newRef, data);
                batch.delete(oldRef);

                if (oldCollection === PREMIUM_TIPS) {
                    batch.delete(
                        doc(db, VIP_MATCHES, oldId)
                    );
                }

                if (targetCollection === PREMIUM_TIPS) {
                    batch.set(
                        doc(db, VIP_MATCHES, newRef.id),
                        makeVipPublicData(data)
                    );
                }

                await batch.commit();
            }

            showMessage("Tip imesasishwa kikamilifu.");

        } else {
            // --------------------------------
            // KUONGEZA TIP MPYA
            // --------------------------------

            data.createdAt = serverTimestamp();
            data.createdBy = currentAdmin.uid;

            if (targetCollection === PREMIUM_TIPS) {
                const newRef = doc(
                    collection(db, PREMIUM_TIPS)
                );

                const batch = writeBatch(db);

                batch.set(newRef, data);

                batch.set(
                    doc(db, VIP_MATCHES, newRef.id),
                    makeVipPublicData(data)
                );

                await batch.commit();

                showMessage(
                    "VIP Game na VIP Tip zimehifadhiwa."
                );

            } else {
                await addDoc(
                    collection(db, FREE_TIPS),
                    data
                );

                showMessage("Free Tip imehifadhiwa.");
            }
        }

        resetTipForm();
        await loadAllData();

    } catch (error) {
        console.error("Save tip error:", error);

        showMessage(
            `Imeshindikana kuhifadhi Tip: ${error.message}`,
            "error"
        );

    } finally {
        publishTipBtn.disabled = false;

        publishTipBtn.textContent = wasEditing
            ? "HIFADHI MABADILIKO"
            : "🚀 CHAPISHA TIP";
    }
});


// ============================================
// 12. KUSAFISHA FORM YA TIP
// ============================================

function resetTipForm() {
    tipForm.reset();

    editingTipId = null;
    editingTipCollection = null;

    cancelTipEdit.hidden = true;

    publishTipBtn.disabled = false;
    publishTipBtn.textContent = "🚀 CHAPISHA TIP";
}

cancelTipEdit.addEventListener("click", resetTipForm);


// ============================================
// 13. MUDA WA FIRESTORE
// ============================================

function getTime(value) {
    if (!value) return 0;

    if (typeof value.toMillis === "function") {
        return value.toMillis();
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    const parsed = new Date(value).getTime();

    return Number.isNaN(parsed) ? 0 : parsed;
}


// ============================================
// 14. KUPAKIA TIPS
// ============================================

async function loadTips(collectionName, container, type) {
    container.replaceChildren();

    try {
        const snapshot = await getDocs(
            collection(db, collectionName)
        );

        const tips = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        tips.sort((a, b) => {
            return getTime(b.createdAt) -
                getTime(a.createdAt);
        });

        const countElement = document.getElementById(
            type === "FREE" ? "tipsCount" : "premiumCount"
        );

        if (countElement) {
            countElement.textContent = tips.length;
        }

        if (tips.length === 0) {
            const empty = document.createElement("div");

            empty.className = "empty";
            empty.textContent = "Hakuna Tips zilizowekwa bado.";

            container.appendChild(empty);
            return;
        }

        tips.forEach(tip => {
            container.appendChild(
                createTipItem(tip, collectionName)
            );
        });

    } catch (error) {
        console.error(
            `Load ${collectionName} error:`,
            error
        );

        const empty = document.createElement("div");

        empty.className = "empty";

        empty.textContent =
            error.code === "permission-denied"
                ? "Huna ruhusa ya kusoma sehemu hii. Kagua Firestore Rules."
                : "Imeshindikana kupakia Tips. Kagua intaneti.";

        container.appendChild(empty);
    }
}


// ============================================
// 15. KADI YA TIP NA KUFUTA TIP
// ============================================

function createTipItem(tip, collectionName) {
    const item = document.createElement("article");
    item.className = "item";

    const title = document.createElement("div");
    title.className = "item-title";

    title.textContent =
        `${tip.homeTeam || "-"} VS ${tip.awayTeam || "-"}`;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = tip.status || "Pending";

    if (tip.status === "Won") {
        badge.classList.add("green");
    }

    if (tip.status === "Lost") {
        badge.classList.add("red");
    }

    const meta = document.createElement("div");
    meta.className = "item-meta";

    meta.textContent =
        `Aina: ${tip.type || "FREE"} | ` +
        `Ligi: ${tip.league || "-"} | ` +
        `Tarehe: ${tip.date || "-"} | ` +
        `Muda: ${tip.time || "-"} | ` +
        `Prediction: ${tip.prediction || "-"} | ` +
        `Odds: ${tip.odds ?? "-"}`;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editButton = document.createElement("button");
    editButton.className = "secondary-button";
    editButton.textContent = "Hariri";

    editButton.addEventListener("click", () => {
        editTip(tip, collectionName);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "danger-button";
    deleteButton.textContent = "Futa";

    deleteButton.addEventListener("click", async () => {
        if (!confirm("Una uhakika unataka kufuta Tip hii?")) {
            return;
        }

        if (!currentAdmin) {
            showMessage("Ingia tena kama Admin.", "error");
            return;
        }

        deleteButton.disabled = true;

        try {
            if (collectionName === PREMIUM_TIPS) {
                // Futa VIP Tip na metadata yake kwa pamoja.
                const batch = writeBatch(db);

                batch.delete(
                    doc(db, PREMIUM_TIPS, tip.id)
                );

                batch.delete(
                    doc(db, VIP_MATCHES, tip.id)
                );

                await batch.commit();

            } else {
                // Futa Free Tip.
                await deleteDoc(
                    doc(db, collectionName, tip.id)
                );

                // Ondoa metadata yoyote ya zamani
                // inayoweza kuwa imeachwa kwa ID hii.
                await deleteVipPublicData(tip.id);
            }

            showMessage("Tip imefutwa.");
            await loadAllData();

        } catch (error) {
            console.error("Delete tip error:", error);

            showMessage(
                `Imeshindikana kufuta Tip: ${error.message}`,
                "error"
            );

        } finally {
            deleteButton.disabled = false;
        }
    });

    actions.append(editButton, deleteButton);

    item.append(title, badge, meta, actions);

    return item;
}


// ============================================
// 16. KUHARIRI TIP
// ============================================

function editTip(tip, collectionName) {
    editingTipId = tip.id;
    editingTipCollection = collectionName;

    document.getElementById("tipType").value =
        collectionName === PREMIUM_TIPS
            ? "PREMIUM"
            : "FREE";

    document.getElementById("tipLeague").value =
        tip.league || "";

    document.getElementById("tipHomeTeam").value =
        tip.homeTeam || "";

    document.getElementById("tipAwayTeam").value =
        tip.awayTeam || "";

    document.getElementById("tipDate").value =
        tip.date || "";

    document.getElementById("tipTime").value =
        tip.time || "";

    document.getElementById("tipMarket").value =
        tip.market || "1X2";

    document.getElementById("tipPrediction").value =
        tip.prediction || "";

    document.getElementById("tipOdds").value =
        tip.odds ?? "";

    document.getElementById("tipStatus").value =
        tip.status || "Pending";

    document.getElementById("tipDescription").value =
        tip.description || "";

    publishTipBtn.textContent = "HIFADHI MABADILIKO";
    cancelTipEdit.hidden = false;

    tipForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ============================================
// 17. URL SALAMA
// ============================================

function safeURL(value) {
    if (!value) return "";

    try {
        const url = new URL(value);

        if (
            url.protocol === "https:" ||
            url.protocol === "http:"
        ) {
            return url.href;
        }

        return "";

    } catch {
        return "";
    }
}


// ============================================
// 18. KUONGEZA APP
// ============================================

appForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentAdmin) {
        showMessage("Huna ruhusa ya Admin.", "error");
        return;
    }

    const downloadURL = safeURL(
        document.getElementById("appLink").value.trim()
    );

    const iconValue =
        document.getElementById("appIcon").value.trim();

    const imageValue =
        document.getElementById("appImage").value.trim();

    const icon = iconValue ? safeURL(iconValue) : "";
    const image = imageValue ? safeURL(imageValue) : "";

    if (!downloadURL) {
        showMessage("Download URL si sahihi.", "error");
        return;
    }

    if (
        (iconValue && !icon) ||
        (imageValue && !image)
    ) {
        showMessage("Icon au picha URL si sahihi.", "error");
        return;
    }

    const price = Number(
        document.getElementById("appPrice").value || 0
    );

    if (!Number.isFinite(price) || price < 0) {
        showMessage("Bei ya App si sahihi.", "error");
        return;
    }

    const data = {
        name: document.getElementById("appName").value.trim(),

        category: document
            .getElementById("appCategory")
            .value.trim(),

        icon,
        image,

        description: document
            .getElementById("appDescription")
            .value.trim(),

        instructions: document
            .getElementById("appInstructions")
            .value.trim(),

        type: document.getElementById("appType").value,

        price,
        downloadURL,

        createdAt: serverTimestamp(),
        createdBy: currentAdmin.uid
    };

    if (!data.name || !data.category || !data.description) {
        showMessage(
            "Jaza jina, category na maelezo ya App.",
            "error"
        );
        return;
    }

    const button = appForm.querySelector(
        'button[type="submit"]'
    );

    button.disabled = true;
    button.textContent = "INAHIFADHI...";

    try {
        await addDoc(collection(db, "apps"), data);

        appForm.reset();

        document.getElementById("appPrice").value = "0";

        showMessage("App imeongezwa kikamilifu.");

        await loadApps();

    } catch (error) {
        console.error("Save app error:", error);

        showMessage(
            `Imeshindikana kuhifadhi App: ${error.message}`,
            "error"
        );

    } finally {
        button.disabled = false;
        button.textContent = "HIFADHI APP";
    }
});


// ============================================
// 19. KUPAKIA APPS
// ============================================

async function loadApps() {
    appsList.replaceChildren();

    try {
        const snapshot = await getDocs(
            collection(db, "apps")
        );

        document.getElementById("appsCount").textContent =
            snapshot.size;

        if (snapshot.empty) {
            const empty = document.createElement("div");

            empty.className = "empty";
            empty.textContent = "Hakuna Apps zilizowekwa.";

            appsList.appendChild(empty);
            return;
        }

        snapshot.forEach(documentSnapshot => {
            const app = documentSnapshot.data();

            const item = document.createElement("article");
            item.className = "item";

            const title = document.createElement("div");
            title.className = "item-title";
            title.textContent = app.name || "App";

            const meta = document.createElement("div");
            meta.className = "item-meta";

            meta.textContent =
                `Category: ${app.category || "-"} | ` +
                `Aina: ${app.type || "FREE"} | ` +
                `Bei: TSh ${app.price ?? 0}`;

            const actions = document.createElement("div");
            actions.className = "item-actions";

            const remove = document.createElement("button");
            remove.className = "danger-button";
            remove.textContent = "Futa App";

            remove.addEventListener("click", async () => {
                if (!confirm("Una uhakika unataka kufuta App hii?")) {
                    return;
                }

                remove.disabled = true;

                try {
                    await deleteDoc(
                        doc(db, "apps", documentSnapshot.id)
                    );

                    showMessage("App imefutwa.");

                    await loadApps();

                } catch (error) {
                    console.error("Delete app error:", error);

                    showMessage(
                        `Imeshindikana kufuta App: ${error.message}`,
                        "error"
                    );

                } finally {
                    remove.disabled = false;
                }
            });

            actions.appendChild(remove);

            item.append(title, meta, actions);

            appsList.appendChild(item);
        });

    } catch (error) {
        console.error("Load apps error:", error);

        const empty = document.createElement("div");
        empty.className = "empty";

        empty.textContent =
            "Imeshindikana kusoma Apps. Kagua Firestore Rules na intaneti.";

        appsList.appendChild(empty);
    }
}


// ============================================
// 20. KUPAKIA BEI ZA PREMIUM
// ============================================

async function loadPricing() {
    try {
        const snapshot = await getDoc(
            doc(db, "settings", "premium")
        );

        const prices = snapshot.exists()
            ? snapshot.data()
            : {};

        document.getElementById("dailyPrice").value =
            prices.daily ?? 3000;

        document.getElementById("weeklyPrice").value =
            prices.weekly ?? 10000;

        document.getElementById("monthlyPrice").value =
            prices.monthly ?? 30000;

    } catch (error) {
        console.error("Load pricing error:", error);

        showMessage(
            "Imeshindikana kusoma bei. Kagua ruhusa za settings.",
            "error"
        );
    }
}


// ============================================
// 21. KUBADILISHA BEI ZA PREMIUM
// ============================================

pricingForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentAdmin) {
        showMessage("Huna ruhusa ya Admin.", "error");
        return;
    }

    const daily = Number(
        document.getElementById("dailyPrice").value
    );

    const weekly = Number(
        document.getElementById("weeklyPrice").value
    );

    const monthly = Number(
        document.getElementById("monthlyPrice").value
    );

    if (
        !Number.isSafeInteger(daily) || daily < 1 ||
        !Number.isSafeInteger(weekly) || weekly < 1 ||
        !Number.isSafeInteger(monthly) || monthly < 1
    ) {
        showMessage(
            "Weka bei sahihi kwa namba nzima.",
            "error"
        );
        return;
    }

    const button = pricingForm.querySelector(
        'button[type="submit"]'
    );

    button.disabled = true;
    button.textContent = "INAHIFADHI...";

    try {
        await setDoc(
            doc(db, "settings", "premium"),
            {
                daily,
                weekly,
                monthly,
                updatedAt: serverTimestamp(),
                updatedBy: currentAdmin.uid
            }
        );

        showMessage("Bei za Premium zimehifadhiwa.");

    } catch (error) {
        console.error("Save pricing error:", error);

        showMessage(
            `Imeshindikana kuhifadhi bei: ${error.message}`,
            "error"
        );

    } finally {
        button.disabled = false;
        button.textContent = "HIFADHI BEI";
    }
});


// ============================================
// 22. KUPAKIA REKODI ZA MALIPO
// ============================================

async function loadPayments() {
    paymentsList.replaceChildren();

    try {
        const snapshot = await getDocs(
            collection(db, "payments")
        );

        document.getElementById("paymentsCount").textContent =
            snapshot.size;

        if (snapshot.empty) {
            const empty = document.createElement("div");

            empty.className = "empty";
            empty.textContent = "Hakuna rekodi za malipo.";

            paymentsList.appendChild(empty);
            return;
        }

        snapshot.forEach(paymentDoc => {
            const payment = paymentDoc.data();

            const item = document.createElement("article");
            item.className = "item";

            const title = document.createElement("div");
            title.className = "item-title";

            title.textContent =
                `Malipo: TSh ${payment.amount ?? "-"}`;

            const meta = document.createElement("div");
            meta.className = "item-meta";

            meta.textContent =
                `Hali: ${payment.status || "Haijulikani"} | ` +
                `Njia: ${payment.method || "-"} | ` +
                `Namba ya simu: ${payment.phone || "-"} | ` +
                `Reference: ${payment.reference || "-"}`;

            item.append(title, meta);

            paymentsList.appendChild(item);
        });

    } catch (error) {
        console.error("Load payments error:", error);

        const empty = document.createElement("div");
        empty.className = "empty";

        empty.textContent =
            "Imeshindikana kusoma malipo. Kagua Firestore Rules.";

        paymentsList.appendChild(empty);
    }
}


// ============================================
// 23. KUPAKIA TAARIFA ZOTE
// ============================================

async function loadAllData() {
    await Promise.all([
        loadTips(FREE_TIPS, freeTipsList, "FREE"),
        loadTips(PREMIUM_TIPS, premiumTipsList, "PREMIUM"),
        loadApps(),
        loadPayments()
    ]);
}


// ============================================
// 24. FIREBASE AUTHENTICATION
// ============================================

onAuthStateChanged(auth, async user => {
    const thisCheck = ++authCheckNumber;

    currentAdmin = null;

    showLoading();

    if (!user) {
        showLogin();
        return;
    }

    try {
        const approved = await checkAdmin(user);

        if (thisCheck !== authCheckNumber) {
            return;
        }

        if (!approved) {
            await signOut(auth);

            if (thisCheck !== authCheckNumber) {
                return;
            }

            showLogin();

            showMessage(
                "Akaunti hii haijaidhinishwa kuwa Admin.",
                "error"
            );

            return;
        }

        currentAdmin = user;

        showDashboard();

        showMessage("Karibu kwenye Admin Panel ya 6+MODS.");

        await loadAllData();

        if (thisCheck !== authCheckNumber) {
            return;
        }

        await loadPricing();

    } catch (error) {
        console.error("Admin authentication error:", error);

        if (thisCheck !== authCheckNumber) {
            return;
        }

        currentAdmin = null;

        showLogin();

        showMessage(
            `Imeshindikana kuthibitisha akaunti: ${error.message}`,
            "error"
        );
    }
});
