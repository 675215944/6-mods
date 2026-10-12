import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { auth } from "./firebase.js";

const loading = document.getElementById("loading");
const content = document.getElementById("content");

const searchInput = document.getElementById("searchInput");
const modsGrid = document.getElementById("modsGrid");
const emptyMessage = document.getElementById("emptyMessage");

const categoryButtons = document.querySelectorAll(".category");

// Hizi ni taarifa za mfano kwa sasa.
// Tutaziunganisha na Firestore baadaye.

const mods = [
    {
        id: 1,
        name: "Racing Game",
        description: "Mchezo wa magari wenye burudani.",
        category: "Games",
        type: "FREE",
        icon: "🏎️",
        downloadUrl: ""
    },
    {
        id: 2,
        name: "Football Game",
        description: "Mchezo wa mpira wa miguu.",
        category: "Games",
        type: "PREMIUM",
        icon: "⚽",
        downloadUrl: ""
    },
    {
        id: 3,
        name: "Photo Editor",
        description: "App ya kuhariri picha.",
        category: "Apps",
        type: "FREE",
        icon: "📸",
        downloadUrl: ""
    },
    {
        id: 4,
        name: "File Manager",
        description: "App ya kupanga na kusimamia mafaili.",
        category: "Tools",
        type: "FREE",
        icon: "📂",
        downloadUrl: ""
    }
];

let selectedCategory = "All";

// Hakikisha mtumiaji ameingia.

onAuthStateChanged(auth, (user) => {

    loading.style.display = "none";

    if (user) {
        content.style.display = "block";
        renderMods();
    } else {
        window.location.replace("auth.html");
    }

}, (error) => {
    loading.textContent =
        "Hitilafu ya Firebase: " + error.message;
    loading.style.display = "block";
});

// Onyesha Mods.

function renderMods() {

    const searchText = searchInput.value
        .trim()
        .toLowerCase();

    const filteredMods = mods.filter((mod) => {

        const matchesSearch =
            mod.name.toLowerCase().includes(searchText) ||
            mod.description.toLowerCase().includes(searchText);

        const matchesCategory =
            selectedCategory === "All" ||
            mod.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    modsGrid.innerHTML = "";

    emptyMessage.hidden = filteredMods.length > 0;

    filteredMods.forEach((mod) => {

        const card = document.createElement("div");
        card.className = "mod-card";

        const icon = document.createElement("div");
        icon.className = "mod-icon";
        icon.textContent = mod.icon;

        const title = document.createElement("h3");
        title.textContent = mod.name;

        const description = document.createElement("p");
        description.textContent = mod.description;

        const badge = document.createElement("span");

        badge.className =
            "badge " +
            (mod.type === "FREE" ? "free" : "premium");

        badge.textContent = mod.type;

        const button = document.createElement("button");
        button.className = "download-btn";

        if (mod.type === "PREMIUM") {

            button.textContent = "⭐ Fungua Premium";

            button.addEventListener("click", () => {
                window.location.href = "premium.html";
            });

        } else if (mod.downloadUrl) {

            button.textContent = "⬇ Download";

            button.addEventListener("click", () => {
                window.location.href = mod.downloadUrl;
            });

        } else {

            button.textContent = "Bado Haijapatikana";
            button.disabled = true;
        }

        card.appendChild(icon);
        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(badge);
        card.appendChild(button);

        modsGrid.appendChild(card);
    });
}

// Search.

searchInput.addEventListener("input", renderMods);

// Categories.

categoryButtons.forEach((button) => {

    button.addEventListener("click", () => {

        categoryButtons.forEach((btn) => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        selectedCategory = button.dataset.category;

        renderMods();
    });
});

// Kurudi Dashboard.

document.getElementById("backBtn")
    .addEventListener("click", () => {
        window.location.href = "user.html";
    });