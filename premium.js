
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

// SHOW MESSAGE
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

// CHECK HTML
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

// PHONE INPUT
phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value
        .replace(/\D/g, "")
        .slice(0, 10);
});

// CONVERT PHONE TO INTERNATIONAL FORMAT
function formatPhone(phone) {
    const clean = phone.replace(/\D/g, "");

    if (/^0[67][0-9]{8}$/.test(clean)) {
        return "255" + clean.substring(1);
    }

    if (/^255[67][0-9]{8}$/.test(clean)) {
        return clean;
    }

    if (/^[67][0-9]{8}$/.test(clean)) {
        return "255" + clean;
    }

    return null;
}

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
        showMessage("Kifurushi hiki hakitambuliki.", "error");
        return;
    }

    // VALIDATE PHONE
    const phone = phoneInput.value.trim();
    const internationalPhone = formatPhone(phone);

    if (!internationalPhone) {
        showMessage(
            "Weka namba sahihi ya Tanzania. Mfano 0712345678 au 0612345678.",
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
        "Namba: " + internationalPhone + "\n\n" +
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

        const idToken = await currentUser.getIdToken();

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
                    phone: internationalPhone
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

        // COMPLETED
        if (result.status === "completed") {

            showMessage(
                "Malipo yamethibitishwa. Premium yako imewashwa. Tafadhali refresh dashboard.",
                "success"
            );

            button.textContent = "MALIPO YAMETHIBITISHWA";
            return;
        }

        // FAILED
        if (result.status === "failed") {

            showMessage(
                "Malipo hayakukamilika. Tafadhali jaribu tena.",
                "error"
            );

            button.disabled = false;
            button.textContent = "JARIBU TENA";
            return;
        }

        // PENDING
        showMessage(
            "OMBI LA MALIPO LIMETUMWA!\n\n" +
            "Kifurushi: " + selectedPlan.name + "\n" +
            "Kiasi: TSh " + formatPrice(selectedPlan.price) + "\n" +
            "Namba: " + internationalPhone + "\n\n" +
            "Angalia simu yako. Ikiwa utapokea ombi la malipo, fuata maelekezo ya mtandao wako na uthibitishe kwa PIN yako.\n\n" +
            "Premium itawashwa baada ya malipo kuthibitishwa.",
            "info"
        );

        button.textContent = "OMBI LIMETUMWA";

    } catch (error) {

        console.error("PAYMENT ERROR:", error);

        showMessage(
            error.message ||
            "Imeshindikana kuanzisha malipo.",
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

// BACK BUTTON
backBtn.addEventListener("click", () => {
    window.location.href = "user.html";
});
