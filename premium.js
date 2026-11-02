
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { auth } from "./firebase.js";

// HTML ELEMENTS
const loading = document.getElementById("loading");
const content = document.getElementById("content");
const errorBox = document.getElementById("error");
const backBtn = document.getElementById("backBtn");
const phoneInput = document.getElementById("paymentPhone");
const paymentMessage = document.getElementById("paymentMessage");

// CURRENT USER
let currentUser = null;
let authReady = false;

// PREMIUM PLANS
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

// SHOW PAYMENT MESSAGE
function showMessage(message, type = "info") {
    if (!paymentMessage) return;

    paymentMessage.textContent = message;
    paymentMessage.className = type;
    paymentMessage.style.display = "block";
}

// FORMAT PRICE
function formatPrice(price) {
    return price.toLocaleString("en-TZ");
}

// CHECK REQUIRED HTML ELEMENTS
if (
    !loading ||
    !content ||
    !errorBox ||
    !backBtn ||
    !phoneInput ||
    !paymentMessage
) {
    console.error("Baadhi ya HTML elements hazijapatikana.");
}

// PHONE INPUT VALIDATION
phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value
        .replace(/\D/g, "")
        .slice(0, 10);
});

// AUTHENTICATION
onAuthStateChanged(
    auth,

    (user) => {
        loading.style.display = "none";

        if (!user) {
            window.location.replace("auth.html");
            return;
        }

        currentUser = user;
        authReady = true;

        content.style.display = "block";
    },

    (error) => {
        loading.style.display = "none";
        content.style.display = "none";
        errorBox.style.display = "block";

        console.error("AUTH ERROR:", error);

        errorBox.textContent =
            "Imeshindikana kuthibitisha akaunti yako. Tafadhali jaribu tena.";
    }
);

// CREATE PAYMENT
async function createPayment(button) {

    if (!authReady || !currentUser) {
        showMessage(
            "Akaunti yako bado inathibitishwa. Subiri kidogo.",
            "error"
        );
        return;
    }

    const planKey = button.dataset.plan;
    const selectedPlan = plans[planKey];

    if (!selectedPlan) {
        showMessage(
            "Kifurushi hiki hakitambuliki.",
            "error"
        );
        return;
    }

    // GET PHONE NUMBER
    const phone = phoneInput.value.trim();

    if (!/^07[0-9]{8}$/.test(phone)) {
        showMessage(
            "Tafadhali weka namba sahihi inayoanzia 07. Mfano 0712345678.",
            "error"
        );

        phoneInput.focus();
        return;
    }

    // CONFIRM PAYMENT
    const confirmed = window.confirm(
        "6+MODS PREMIUM\n\n" +
        "Kifurushi: " + selectedPlan.name + "\n" +
        "Bei: TSh " + formatPrice(selectedPlan.price) + "\n" +
        "Muda: Siku " + selectedPlan.days + "\n" +
        "Namba: " + phone + "\n\n" +
        "Je, unataka kutuma ombi la malipo?"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "INATUMA OMBI...";

    showMessage(
        "Tafadhali subiri. Tunatuma ombi lako la malipo.",
        "info"
    );

    try {

        // GET FIREBASE ID TOKEN
        const idToken = await currentUser.getIdToken();

        // SEND REQUEST TO NETLIFY BACKEND
        const paymentResponse = await fetch(
            "/api/create-payment",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + idToken
                },

                body: JSON.stringify({
                    plan: planKey,
                    phone: phone
                })
            }
        );

        let result;

        try {
            result = await paymentResponse.json();
        } catch {
            throw new Error(
                "Server imerudisha jibu lisilotambulika."
            );
        }

        if (!paymentResponse.ok || !result.success) {
            throw new Error(
                result.message ||
                "Imeshindikana kuanzisha malipo."
            );
        }

        // PAYMENT COMPLETED
        if (result.status === "completed") {

            showMessage(
                "Malipo yamethibitishwa. " +
                "Uanachama wako wa Premium umewashwa. " +
                "Tafadhali refresh dashboard yako.",
                "success"
            );

            button.textContent = "MALIPO YAMETHIBITISHWA";
            return;
        }

        // PAYMENT FAILED
        if (result.status === "failed") {

            showMessage(
                "Malipo hayakukamilika. " +
                "Tafadhali hakikisha taarifa zako na ujaribu tena.",
                "error"
            );

            button.disabled = false;
            button.textContent = "JARIBU TENA";
            return;
        }

        // PAYMENT PENDING
        showMessage(
            "OMBI LA MALIPO LIMETUMWA!\n\n" +
            "Kifurushi: " + selectedPlan.name + "\n" +
            "Kiasi: TSh " + formatPrice(selectedPlan.price) + "\n" +
            "Namba: " + phone + "\n\n" +
            "Angalia simu yako. Ikiwa utapokea ombi la malipo, " +
            "fuata maelekezo ya mtandao wako na uthibitishe kwa PIN yako.\n\n" +
            "Premium itawashwa baada ya malipo kuthibitishwa.",
            "info"
        );

        button.textContent = "OMBI LIMETUMWA";

    } catch (error) {

        console.error("PAYMENT ERROR:", error);

        showMessage(
            error.message ||
            "Imeshindikana kuanzisha malipo. Tafadhali jaribu tena.",
            "error"
        );

        button.disabled = false;
        button.textContent = "JARIBU TENA";

    }
}

// SUBSCRIBE BUTTONS
document.querySelectorAll(".subscribe-btn").forEach((button) => {

    button.addEventListener("click", async () => {
        await createPayment(button);
    });

});

// BACK TO DASHBOARD
backBtn.addEventListener("click", () => {
    window.location.href = "user.html";
});
