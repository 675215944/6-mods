import {
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { auth } from "./firebase.js";

const loading = document.getElementById("loading");
const content = document.getElementById("content");
const errorBox = document.getElementById("error");

let currentUser = null;

function showMessage(elementId, text, type = "info") {
    const element = document.getElementById(elementId);
    element.textContent = text;
    element.className = "message " + type;
}

function showUser(user) {
    const name = user.displayName ||
        (user.email ? user.email.split("@")[0] : "Mtumiaji");

    document.getElementById("displayName").textContent = name;
    document.getElementById("infoName").textContent = name;

    document.getElementById("email").textContent = user.email || "";
    document.getElementById("infoEmail").textContent = user.email || "";

    document.getElementById("userId").textContent = user.uid;

    document.getElementById("membership").textContent = "FREE MEMBER";
    document.getElementById("accountStatus").textContent = "FREE";

    document.getElementById("avatar").textContent =
        name.charAt(0).toUpperCase();

    document.getElementById("newName").value = user.displayName || "";
}

onAuthStateChanged(auth, (user) => {
    loading.style.display = "none";

    if (!user) {
        window.location.replace("auth.html");
        return;
    }

    currentUser = user;
    showUser(user);
    content.style.display = "block";

}, (error) => {
    loading.style.display = "none";
    errorBox.textContent =
        "Hitilafu ya Firebase: " + error.message;
});

document.getElementById("nameForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) return;

    const newName = document.getElementById("newName").value.trim();
    const button = document.getElementById("saveNameBtn");

    if (!newName) {
        showMessage("nameMessage", "Tafadhali andika jina.", "error");
        return;
    }

    button.disabled = true;
    showMessage("nameMessage", "Inahifadhi jina...", "info");

    try {
        await updateProfile(currentUser, {
            displayName: newName
        });

        showUser(currentUser);

        showMessage(
            "nameMessage",
            "Jina limebadilishwa kikamilifu!",
            "success"
        );

    } catch (error) {
        showMessage(
            "nameMessage",
            "Imeshindikana kubadilisha jina: " + error.message,
            "error"
        );
    } finally {
        button.disabled = false;
    }
});

document.getElementById("resetPasswordBtn")
    .addEventListener("click", async () => {

        if (!currentUser || !currentUser.email) return;

        const button = document.getElementById("resetPasswordBtn");
        button.disabled = true;

        showMessage(
            "passwordMessage",
            "Inatuma email...",
            "info"
        );

        try {
            await sendPasswordResetEmail(auth, currentUser.email);

            showMessage(
                "passwordMessage",
                "Link ya kubadilisha password imetumwa. Angalia email yako.",
                "success"
            );

        } catch (error) {
            showMessage(
                "passwordMessage",
                "Imeshindikana kutuma email: " + error.message,
                "error"
            );
        } finally {
            button.disabled = false;
        }
    });

document.getElementById("logoutBtn")
    .addEventListener("click", async () => {

        try {
            await signOut(auth);
            window.location.replace("auth.html");
        } catch (error) {
            errorBox.textContent =
                "Logout imeshindikana: " + error.message;
        }
    });

document.getElementById("backBtn")
    .addEventListener("click", () => {
        window.location.href = "user.html";
    });