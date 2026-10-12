import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { auth } from "./firebase.js";

// HTML elements
const loading = document.getElementById("loading");
const content = document.getElementById("content");
const errorBox = document.getElementById("error");
const backBtn = document.getElementById("backBtn");

// Hakikisha ukurasa una vitu vinavyohitajika
if (!loading || !content || !errorBox || !backBtn) {
    console.error("Baadhi ya HTML elements hazijapatikana.");
}

// Vifurushi vinavyopatikana
const plans = {
    DAILY: {
        name: "Daily",
        price: 3000,
        days: 1
    },

    WEEKLY: {
        name: "Weekly",
        price: 10000,
        days: 7
    },

    MONTHLY: {
        name: "Monthly",
        price: 30000,
        days: 30
    }
};

// Thibitisha kama mtumiaji ameingia
onAuthStateChanged(auth, (user) => {
    loading.style.display = "none";

    if (!user) {
        window.location.replace("auth.html");
        return;
    }

    content.style.display = "block";

}, (error) => {
    loading.style.display = "none";
    content.style.display = "none";
    errorBox.style.display = "block";

    errorBox.textContent =
        "Imeshindikana kuthibitisha akaunti yako. Tafadhali jaribu tena. " +
        error.message;
});

// Vitufe vya kuchagua vifurushi
document.querySelectorAll(".subscribe-btn").forEach((button) => {

    button.addEventListener("click", () => {

        const planKey = button.dataset.plan;
        const selectedPlan = plans[planKey];

        // Hakikisha kifurushi kinatambulika
        if (!selectedPlan) {
            alert(
                "Kifurushi hiki hakijatambulika. " +
                "Tafadhali refresh ukurasa ujaribu tena."
            );
            return;
        }

        const formattedPrice =
            selectedPlan.price.toLocaleString("en-TZ");

        const confirmed = window.confirm(
            "6+MODS PREMIUM\n\n" +
            "Kifurushi: " + selectedPlan.name + "\n" +
            "Bei: TSh " + formattedPrice + "\n" +
            "Muda: Siku " + selectedPlan.days + "\n\n" +
            "Je, unataka kuendelea na kifurushi hiki?"
        );

        if (!confirmed) {
            return;
        }

        alert(
            "UMECHAGUA KIFURUSHI CHA " +
            selectedPlan.name.toUpperCase() + "\n\n" +

            "Bei: TSh " + formattedPrice + "\n" +
            "Muda: Siku " + selectedPlan.days + "\n\n" +

            "Mfumo wa malipo bado haujaunganishwa.\n" +
            "Hujatozwa fedha, na uanachama wako wa Premium " +
            "bado haujawashwa.\n\n" +

            "Tutaunganisha mfumo wa malipo katika hatua inayofuata."
        );

    });

});

// Kitufe cha kurudi kwenye dashboard
backBtn.addEventListener("click", () => {
    window.location.href = "user.html";
});