import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
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

// ==================================================
// 1. ELEMENTS
// ==================================================

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

const adminManagementNav =
    document.getElementById("adminManagementNav");

const adminsList = document.getElementById("adminsList");
const addAdminForm = document.getElementById("addAdminForm");
const newAdminEmail = document.getElementById("newAdminEmail");
const addAdminBtn = document.getElementById("addAdminBtn");
const refreshAdminsBtn = document.getElementById("refreshAdminsBtn");
const adminManagementMessage =
    document.getElementById("adminManagementMessage");

// ==================================================
// 2. GLOBAL VARIABLES
// ==================================================

let currentAdmin = null;
let currentAdminRole = null;

let editingTipId = null;
let editingTipCollection = null;

let messageTimer = null;
let authCheckNumber = 0;

const FREE_TIPS = "tips";
const PREMIUM_TIPS = "premiumTips";
const VIP_MATCHES = "vipMatches";

const ADMIN_API = "/api/admin-management";

// ==================================================
// 3. LOADING
// ==================================================

function showLoading() {
    if (loading) loading.style.display = "block";
    if (loginBox) loginBox.style.display = "none";
    if (dashboard) dashboard.style.display = "none";
    if (logoutBtn) logoutBtn.hidden = true;
}

function hideLoading() {
    if (loading) loading.style.display = "none";
}

// ==================================================
// 4. UJUMBE
// ==================================================

function showMessage(message, type = "success") {
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `message ${type}`;

    clearTimeout(messageTimer);

    messageTimer = setTimeout(() => {
        messageBox.className = "message";
        messageBox.textContent = "";
    }, 7000);
}

function showAdminMessage(message, type = "success") {
    if (!adminManagementMessage) {
        showMessage(message, type);
        return;
    }

    adminManagementMessage.textContent = message;
    adminManagementMessage.className = `message ${type}`;
}

// ==================================================
// 5. LOGIN NA DASHBOARD
// ==================================================

function showLogin() {
    hideLoading();

    if (dashboard) dashboard.style.display = "none";
    if (loginBox) loginBox.style.display = "block";
    if (logoutBtn) logoutBtn.hidden = true;

    hideAdminManagement();
}

function showDashboard() {
    hideLoading();

    if (loginBox) loginBox.style.display = "none";
    if (dashboard) dashboard.style.display = "block";
    if (logoutBtn) logoutBtn.hidden = false;

    applyRolePermissions();
}

// ==================================================
// 6. PERMISSIONS
// ==================================================

function isSuperAdmin() {
    return currentAdminRole === "super_admin";
}

function applyRolePermissions() {
    const superAdmin = isSuperAdmin();

    // Admin Management ni kwa Super Admin pekee.
    if (adminManagementNav) {
        adminManagementNav.hidden = !superAdmin;
        adminManagementNav.style.display =
            superAdmin ? "" : "none";
    }

    // Pricing ni kwa Super Admin pekee.
    document.querySelectorAll('[data-section="pricingSection"]')
        .forEach(button => {
            button.hidden = !superAdmin;
            button.style.display = superAdmin ? "" : "none";
        });

    const pricingSection = document.getElementById("pricingSection");

    if (!superAdmin && pricingSection) {
        pricingSection.classList.remove("active");
    }

    // Kama Admin wa kawaida alikuwa kwenye sehemu iliyofichwa,
    // mrudishe kwenye sehemu ya Tips.
    if (!superAdmin) {
        const activeButton = document.querySelector(
            '.nav-button.active[data-section="pricingSection"],' +
            '.nav-button.active[data-section="adminManagementSection"]'
        );

        if (activeButton) {
            activeButton.classList.remove("active");
            document.querySelectorAll(".section").forEach(section => {
                section.classList.remove("active");
            });

            const tipsButton = document.querySelector(
                '[data-section="tipsSection"]'
            );

            if (tipsButton) tipsButton.classList.add("active");

            const tipsSection =
                document.getElementById("tipsSection");

            if (tipsSection) tipsSection.classList.add("active");
        }
    }
}

// ==================================================
// 7. THIBITISHA ADMIN KUTOKA FIRESTORE
// ==================================================

async function checkAdmin(user) {
    const adminRef = doc(db, "admins", user.uid);
    const snapshot = await getDoc(adminRef);

    if (!snapshot.exists()) {
        return null;
    }

    const data = snapshot.data();

    if (
        data.active !== true ||
        !["admin", "super_admin"].includes(data.role)
    ) {
        return null;
    }

    return data;
}

// ==================================================
// 8. LOGIN
// ==================================================

if (loginForm) {
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

        if (button) {
            button.disabled = true;
            button.textContent = "INAINGIA...";
        }

        try {
            await signInWithEmailAndPassword(
                auth,
                email,
                password
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
            if (button) {
                button.disabled = false;
                button.textContent = "INGIA KWENYE ADMIN";
            }
        }
    });
}

// ==================================================
// 9. LOGOUT
// ==================================================

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            showMessage("Umetoka kwenye akaunti.");

        } catch (error) {
            console.error("Logout error:", error);
            showMessage("Imeshindikana kutoka. Jaribu tena.", "error");
        }
    });
}

// ==================================================
// 10. NAVIGATION
// ==================================================

document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => {
        const targetId = button.dataset.section;

        // Zuia Admin wa kawaida kufungua sehemu za Super Admin.
        if (
            !isSuperAdmin() &&
            (
                targetId === "pricingSection" ||
                targetId === "adminManagementSection"
            )
        ) {
            showMessage("Huna ruhusa ya sehemu hii.", "error");
            return;
        }

        document.querySelectorAll(".nav-button").forEach(item => {
            item.classList.remove("active");
        });

        document.querySelectorAll(".section").forEach(section => {
            section.classList.remove("active");
        });

        button.classList.add("active");

        const section = document.getElementById(targetId);

        if (section) {
            section.classList.add("active");
        }

        if (targetId === "adminManagementSection") {
            loadAdmins();
        }
    });
});

// ==================================================
// 11. ADMIN MANAGEMENT API
// ==================================================

async function callAdminManagement(action, extraData = {}) {
    if (!currentAdmin) {
        throw new Error("Ingia tena kwenye akaunti yako.");
    }

    const idToken = await currentAdmin.getIdToken(true);

    const response = await fetch(ADMIN_API, {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
        },

        body: JSON.stringify({
            action,
            ...extraData
        })
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error(
            "Server imerudisha majibu yasiyo sahihi."
        );
    }

    if (!response.ok || result.success !== true) {
        throw new Error(
            result.message || "Ombi halikufanikiwa."
        );
    }

    return result;
}

// ==================================================
// 12. KUONYESHA / KUFICHA ADMIN MANAGEMENT
// ==================================================

function hideAdminManagement() {
    const section = document.getElementById(
        "adminManagementSection"
    );

    if (section) {
        section.classList.remove("active");
    }

    if (adminManagementNav) {
        adminManagementNav.hidden = true;
        adminManagementNav.style.display = "none";
    }
}

// ==================================================
// 13. KUPAKIA ORODHA YA ADMINS
// ==================================================

async function loadAdmins() {
    if (!isSuperAdmin() || !adminsList) return;

    adminsList.replaceChildren();

    const loadingItem = document.createElement("div");
    loadingItem.className = "empty";
    loadingItem.textContent = "Inapakia...";
    adminsList.appendChild(loadingItem);

    try {
        const result = await callAdminManagement("list");

        adminsList.replaceChildren();

        const admins = result.admins || [];

        if (admins.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "Hakuna Admin waliopatikana.";
            adminsList.appendChild(empty);
            return;
        }

        admins.forEach(admin => {
            const item = document.createElement("article");
            item.className = "item";

            const title = document.createElement("div");
            title.className = "item-title";

            title.textContent = admin.email || admin.uid;

            const badge = document.createElement("span");
            badge.className = "badge";

            if (admin.role === "super_admin") {
                badge.textContent = "SUPER ADMIN";
                badge.classList.add("green");
            } else {
                badge.textContent = admin.active
                    ? "ADMIN ACTIVE"
                    : "ADMIN INACTIVE";
            }

            const meta = document.createElement("div");
            meta.className = "item-meta";

            meta.textContent =
                `Role: ${admin.role} | ` +
                `Hali: ${admin.active ? "Active" : "Inactive"}`;

            item.append(title, badge, meta);

            // Super Admin wawili hawawezi kusimamishwa
            // au kuondolewa kupitia paneli hii.
            if (admin.role === "super_admin") {
                adminsList.appendChild(item);
                return;
            }

            const actions = document.createElement("div");
            actions.className = "item-actions";

            const toggleButton = document.createElement("button");

            toggleButton.className = admin.active
                ? "secondary-button"
                : "primary-button";

            toggleButton.textContent = admin.active
                ? "SIMAMISHA ADMIN"
                : "WASHA ADMIN";

            toggleButton.addEventListener("click", async () => {
                const nextState = !admin.active;

                const confirmed = confirm(
                    nextState
                        ? `Unataka kumwasha Admin ${admin.email}?`
                        : `Unataka kumsimamisha Admin ${admin.email}?`
                );

                if (!confirmed) return;

                toggleButton.disabled = true;

                try {
                    await callAdminManagement("setActive", {
                        uid: admin.uid,
                        active: nextState
                    });

                    showAdminMessage(
                        nextState
                            ? "Admin amewashwa."
                            : "Admin amesimamishwa."
                    );

                    await loadAdmins();

                } catch (error) {
                    console.error("Change admin status:", error);
                    showAdminMessage(error.message, "error");

                } finally {
                    toggleButton.disabled = false;
                }
            });

            const removeButton = document.createElement("button");
            removeButton.className = "danger-button";
            removeButton.textContent = "ONDOA ADMIN";

            removeButton.addEventListener("click", async () => {
                const confirmed = confirm(
                    `Una uhakika unataka kumwondoa Admin ${admin.email}? ` +
                    "Akaunti yake ya Firebase Authentication pia itafutwa."
                );

                if (!confirmed) return;

                removeButton.disabled = true;

                try {
                    await callAdminManagement("remove", {
                        uid: admin.uid
                    });

                    showAdminMessage("Admin ameondolewa.");
                    await loadAdmins();

                } catch (error) {
                    console.error("Remove admin:", error);
                    showAdminMessage(error.message, "error");

                } finally {
                    removeButton.disabled = false;
                }
            });

            actions.append(toggleButton, removeButton);
            item.appendChild(actions);
            adminsList.appendChild(item);
        });

    } catch (error) {
        console.error("Load admins error:", error);

        adminsList.replaceChildren();

        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent =
            error.message || "Imeshindikana kupakia Admin.";

        adminsList.appendChild(empty);
    }
}

// ==================================================
// 14. KUONGEZA ADMIN KWA EMAIL
// ==================================================

if (addAdminForm) {
    addAdminForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!isSuperAdmin()) {
            showAdminMessage(
                "Super Admin pekee anaweza kuongeza Admin.",
                "error"
            );
            return;
        }

        const email = (newAdminEmail?.value || "")
            .trim()
            .toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAdminMessage("Weka email sahihi.", "error");
            return;
        }

        if (addAdminBtn) {
            addAdminBtn.disabled = true;
            addAdminBtn.textContent = "INAONGEZA...";
        }

        try {
            // Backend huunda akaunti na kuiweka role = admin.
            const result = await callAdminManagement("invite", {
                email
            });

            let resetEmailSent = false;

            // Tuma barua ya kuweka nenosiri.
            // Backend yenyewe haiitumi barua hii.
            try {
                await sendPasswordResetEmail(auth, email);
                resetEmailSent = true;

            } catch (emailError) {
                console.error(
                    "Password reset email error:",
                    emailError
                );
            }

            if (newAdminEmail) {
                newAdminEmail.value = "";
            }

            if (resetEmailSent) {
                showAdminMessage(
                    `${result.email} ameongezwa. Barua ya kuweka nenosiri imetumwa. ` +
                    "Admin bado hajawashwa; mwashe kwenye orodha baada ya kukamilisha maandalizi."
                );
            } else {
                showAdminMessage(
                    `${result.email} ameongezwa lakini barua ya kuweka nenosiri haikutumwa. ` +
                    "Angalia Firebase Authentication na mipangilio ya email.",
                    "error"
                );
            }

            await loadAdmins();

        } catch (error) {
            console.error("Add admin error:", error);
            showAdminMessage(error.message, "error");

        } finally {
            if (addAdminBtn) {
                addAdminBtn.disabled = false;
                addAdminBtn.textContent = "ONGEZA ADMIN";
            }
        }
    });
}

if (refreshAdminsBtn) {
    refreshAdminsBtn.addEventListener("click", loadAdmins);
}

// ==================================================
// 15. VIP PUBLIC DATA
// ==================================================

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
    await deleteDoc(doc(db, VIP_MATCHES, tipId));
}

// ==================================================
// 16. KUCHAPISHA NA KUHARIRI TIPS
// ==================================================

if (tipForm) {
    tipForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!currentAdmin) {
            showMessage("Ingia tena kwenye akaunti yako.", "error");
            return;
        }

        const type = document.getElementById("tipType").value;

        const targetCollection =
            type === "PREMIUM" ? PREMIUM_TIPS : FREE_TIPS;

        const odds = Number(
            document.getElementById("tipOdds").value
        );

        if (!Number.isFinite(odds) || odds < 1) {
            showMessage("Weka odds halali.", "error");
            return;
        }

        const data = {
            type,

            league: document.getElementById("tipLeague").value.trim(),
            homeTeam: document.getElementById("tipHomeTeam").value.trim(),
            awayTeam: document.getElementById("tipAwayTeam").value.trim(),

            date: document.getElementById("tipDate").value,
            time: document.getElementById("tipTime").value,
            market: document.getElementById("tipMarket").value,

            prediction: document
                .getElementById("tipPrediction").value.trim(),

            odds,

            status: document.getElementById("tipStatus").value,

            description: document
                .getElementById("tipDescription").value.trim(),

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
            if (editingTipId) {
                const oldCollection = editingTipCollection;
                const oldId = editingTipId;

                const oldRef = doc(db, oldCollection, oldId);
                const oldSnapshot = await getDoc(oldRef);

                if (!oldSnapshot.exists()) {
                    throw new Error("Tip ya awali haipatikani.");
                }

                const oldData = oldSnapshot.data();

                data.createdAt =
                    oldData.createdAt || serverTimestamp();

                data.createdBy =
                    oldData.createdBy || currentAdmin.uid;

                if (oldCollection === targetCollection) {
                    const batch = writeBatch(db);

                    batch.update(oldRef, data);

                    if (targetCollection === PREMIUM_TIPS) {
                        batch.set(
                            doc(db, VIP_MATCHES, oldId),
                            makeVipPublicData(data),
                            { merge: true }
                        );
                    } else {
                        batch.delete(doc(db, VIP_MATCHES, oldId));
                    }

                    await batch.commit();

                } else {
                    const newRef = doc(collection(db, targetCollection));
                    const batch = writeBatch(db);

                    batch.set(newRef, data);
                    batch.delete(oldRef);

                    if (oldCollection === PREMIUM_TIPS) {
                        batch.delete(doc(db, VIP_MATCHES, oldId));
                    }

                    if (targetCollection === PREMIUM_TIPS) {
                        batch.set(
                            doc(db, VIP_MATCHES, newRef.id),
                            makeVipPublicData(data)
                        );
                    }

                    await batch.commit();
                }

                showMessage("Tip imesasishwa.");

            } else {
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

                    showMessage("VIP Tip imehifadhiwa.");

                } else {
                    await addDoc(collection(db, FREE_TIPS), data);
                    showMessage("Free Tip imehifadhiwa.");
                }
            }

            resetTipForm();
            await loadAllData();

        } catch (error) {
            console.error("Save tip error:", error);
            showMessage(
                "Imeshindikana kuhifadhi Tip. Jaribu tena.",
                "error"
            );

        } finally {
            publishTipBtn.disabled = false;

            publishTipBtn.textContent = wasEditing
                ? "HIFADHI MABADILIKO"
                : "🚀 CHAPISHA TIP";
        }
    });
}

// ==================================================
// 17. RESET TIP FORM
// ==================================================

function resetTipForm() {
    if (!tipForm) return;

    tipForm.reset();

    editingTipId = null;
    editingTipCollection = null;

    if (cancelTipEdit) cancelTipEdit.hidden = true;

    if (publishTipBtn) {
        publishTipBtn.disabled = false;
        publishTipBtn.textContent = "🚀 CHAPISHA TIP";
    }
}

if (cancelTipEdit) {
    cancelTipEdit.addEventListener("click", resetTipForm);
}

// ==================================================
// 18. MUDA WA FIRESTORE
// ==================================================

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

// ==================================================
// 19. KUPAKIA TIPS
// ==================================================

async function loadTips(collectionName, container, type) {
    if (!container) return;

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
            return getTime(b.createdAt) - getTime(a.createdAt);
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
        console.error(`Load ${collectionName} error:`, error);

        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent =
            "Imeshindikana kupakia Tips. Jaribu tena.";

        container.appendChild(empty);
    }
}

// ==================================================
// 20. KADI YA TIP
// ==================================================

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

    if (tip.status === "Won") badge.classList.add("green");
    if (tip.status === "Lost") badge.classList.add("red");

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
            showMessage("Ingia tena kwenye akaunti yako.", "error");
            return;
        }

        deleteButton.disabled = true;

        try {
            if (collectionName === PREMIUM_TIPS) {
                const batch = writeBatch(db);

                batch.delete(doc(db, PREMIUM_TIPS, tip.id));
                batch.delete(doc(db, VIP_MATCHES, tip.id));

                await batch.commit();

            } else {
                const batch = writeBatch(db);

                batch.delete(doc(db, collectionName, tip.id));
                batch.delete(doc(db, VIP_MATCHES, tip.id));

                await batch.commit();
            }

            showMessage("Tip imefutwa.");
            await loadAllData();

        } catch (error) {
            console.error("Delete tip error:", error);
            showMessage("Imeshindikana kufuta Tip.", "error");

        } finally {
            deleteButton.disabled = false;
        }
    });

    actions.append(editButton, deleteButton);
    item.append(title, badge, meta, actions);

    return item;
}

// ==================================================
// 21. KUHARIRI TIP
// ==================================================

function editTip(tip, collectionName) {
    editingTipId = tip.id;
    editingTipCollection = collectionName;

    document.getElementById("tipType").value =
        collectionName === PREMIUM_TIPS ? "PREMIUM" : "FREE";

    document.getElementById("tipLeague").value = tip.league || "";
    document.getElementById("tipHomeTeam").value = tip.homeTeam || "";
    document.getElementById("tipAwayTeam").value = tip.awayTeam || "";
    document.getElementById("tipDate").value = tip.date || "";
    document.getElementById("tipTime").value = tip.time || "";
    document.getElementById("tipMarket").value = tip.market || "1X2";
    document.getElementById("tipPrediction").value =
        tip.prediction || "";

    document.getElementById("tipOdds").value = tip.odds ?? "";
    document.getElementById("tipStatus").value =
        tip.status || "Pending";

    document.getElementById("tipDescription").value =
        tip.description || "";

    publishTipBtn.textContent = "HIFADHI MABADILIKO";

    if (cancelTipEdit) cancelTipEdit.hidden = false;

    tipForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ==================================================
// 22. URL SALAMA
// ==================================================

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

// ==================================================
// 23. KUONGEZA APP
// ==================================================

if (appForm) {
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

        if ((iconValue && !icon) || (imageValue && !image)) {
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
                .getElementById("appCategory").value.trim(),

            icon,
            image,

            description: document
                .getElementById("appDescription").value.trim(),

            instructions: document
                .getElementById("appInstructions").value.trim(),

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
            showMessage("Imeshindikana kuhifadhi App.", "error");

        } finally {
            button.disabled = false;
            button.textContent = "HIFADHI APP";
        }
    });
}

// ==================================================
// 24. KUPAKIA APPS
// ==================================================

async function loadApps() {
    if (!appsList) return;

    appsList.replaceChildren();

    try {
        const snapshot = await getDocs(collection(db, "apps"));

        const count = document.getElementById("appsCount");
        if (count) count.textContent = snapshot.size;

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
                    showMessage("Imeshindikana kufuta App.", "error");

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
        empty.textContent = "Imeshindikana kusoma Apps.";

        appsList.appendChild(empty);
    }
}

// ==================================================
// 25. KUPAKIA BEI ZA PREMIUM
// ==================================================

async function loadPricing() {
    if (!isSuperAdmin()) return;

    try {
        const snapshot = await getDoc(
            doc(db, "settings", "premium")
        );

        const prices = snapshot.exists() ? snapshot.data() : {};

        document.getElementById("dailyPrice").value =
            prices.daily ?? 3000;

        document.getElementById("weeklyPrice").value =
            prices.weekly ?? 10000;

        document.getElementById("monthlyPrice").value =
            prices.monthly ?? 30000;

    } catch (error) {
        console.error("Load pricing error:", error);
        showMessage("Imeshindikana kupakia bei za Premium.", "error");
    }
}

// ==================================================
// 26. KUBADILISHA BEI
// ==================================================

if (pricingForm) {
    pricingForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!isSuperAdmin()) {
            showMessage(
                "Super Admin pekee anaweza kubadilisha bei.",
                "error"
            );
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
            showMessage("Weka bei sahihi kwa namba nzima.", "error");
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
            showMessage("Imeshindikana kuhifadhi bei.", "error");

        } finally {
            button.disabled = false;
            button.textContent = "HIFADHI BEI";
        }
    });
}

// ==================================================
// 27. KUPAKIA MALIPO
// ==================================================

async function loadPayments() {
    if (!paymentsList) return;

    paymentsList.replaceChildren();

    try {
        const snapshot = await getDocs(
            collection(db, "payments")
        );

        const count = document.getElementById("paymentsCount");
        if (count) count.textContent = snapshot.size;

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
            title.textContent = `Malipo: TSh ${payment.amount ?? "-"}`;

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
        empty.textContent = "Imeshindikana kusoma malipo.";

        paymentsList.appendChild(empty);
    }
}

// ==================================================
// 28. KUPAKIA TAARIFA ZOTE
// ==================================================

async function loadAllData() {
    await Promise.all([
        loadTips(FREE_TIPS, freeTipsList, "FREE"),
        loadTips(PREMIUM_TIPS, premiumTipsList, "PREMIUM"),
        loadApps(),
        loadPayments()
    ]);
}

// ==================================================
// 29. FIREBASE AUTHENTICATION
// ==================================================

onAuthStateChanged(auth, async user => {
    const thisCheck = ++authCheckNumber;

    currentAdmin = null;
    currentAdminRole = null;

    showLoading();

    if (!user) {
        showLogin();
        return;
    }

    try {
        const adminData = await checkAdmin(user);

        if (thisCheck !== authCheckNumber) return;

        if (!adminData) {
            await signOut(auth);

            if (thisCheck !== authCheckNumber) return;

            currentAdmin = null;
            currentAdminRole = null;

            showLogin();

            showMessage(
                "Akaunti hii haijaidhinishwa kuwa Admin.",
                "error"
            );

            return;
        }

        currentAdmin = user;
        currentAdminRole = adminData.role;

        showDashboard();

        await loadAllData();

        if (thisCheck !== authCheckNumber) return;

        if (isSuperAdmin()) {
            await loadPricing();
        }

    } catch (error) {
        console.error("Admin authentication error:", error);

        if (thisCheck !== authCheckNumber) return;

        currentAdmin = null;
        currentAdminRole = null;

        showLogin();

        showMessage(
            "Imeshindikana kuthibitisha akaunti. Jaribu tena.",
            "error"
        );
    }
});
