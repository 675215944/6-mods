import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { auth } from "./firebase.js";

// 6+MODS FAST DASHBOARD

const loading = document.getElementById("loading");
const dashboard = document.getElementById("dashboard");
const errorBox = document.getElementById("error");

const authStart = performance.now();

let authReady = false;

// ONESHA DASHBOARD
function showDashboard(user) {

    const username =
        user.displayName ||
        (user.email
            ? user.email.split("@")[0]
            : "Mtumiaji");

    document.getElementById("username").textContent =
        username;

    document.getElementById("userEmail").textContent =
        user.email || "";

    document.getElementById("accountStatus").textContent =
        "FREE MEMBER";

    dashboard.style.display = "block";
    loading.style.display = "none";
}

// FIREBASE AUTH
onAuthStateChanged(auth, (user) => {

    authReady = true;

    const duration =
        ((performance.now() - authStart) / 1000)
        .toFixed(2);

    console.log(
        "6+MODS Firebase Auth callback:",
        duration,
        "seconds"
    );

    if (!user) {
        window.location.replace("auth.html");
        return;
    }

    showDashboard(user);

}, (error) => {

    authReady = true;
    loading.style.display = "none";

    errorBox.textContent =
        "Hitilafu ya Firebase: " + error.message;

});

// ONYO IKIWA AUTH INACHELEWA
setTimeout(() => {

    if (!authReady) {
        console.warn(
            "Firebase Auth bado inasubiri baada ya sekunde 4."
        );
    }

}, 4000);

// NAVIGATION
function openPage(buttonId, page) {

    const button = document.getElementById(buttonId);

    if (!button) {
        console.warn(
            "Button haijapatikana:",
            buttonId
        );
        return;
    }

    button.addEventListener("click", () => {
        window.location.href = page;
    });
}

openPage("freeTipsBtn", "tips.html?type=free");
openPage("vipTipsBtn", "tips.html?type=vip");
openPage("modsBtn", "mods.html");
openPage("marketBtn", "market.html");
openPage("premiumBtn", "premium.html");
openPage("profileBtn", "profile.html");

// LOGOUT
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

        logoutBtn.disabled = true;

        try {

            await signOut(auth);

            window.location.replace("auth.html");

        } catch (error) {

            errorBox.textContent =
                "Logout imeshindikana: " + error.message;

            logoutBtn.disabled = false;
        }

    });
}