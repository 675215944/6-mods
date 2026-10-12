import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import { auth } from "./firebase.js";

const loading = document.getElementById("loading");
const content = document.getElementById("content");
const errorBox = document.getElementById("error");

const searchInput = document.getElementById("searchInput");
const productsGrid = document.getElementById("productsGrid");
const emptyMessage = document.getElementById("emptyMessage");

let selectedCategory = "All";

// BIDHAA ZA MFANO
// Admin ataongeza bidhaa halisi kupitia Firestore baadaye.

const products = [
    {
        id: 1,
        name: "Premium Digital Service",
        description: "Huduma maalumu za kidijitali.",
        category: "Digital",
        price: 10000,
        icon: "💎"
    },
    {
        id: 2,
        name: "App Installation Service",
        description: "Huduma ya kusaidia kusakinisha Apps.",
        category: "Services",
        price: 5000,
        icon: "📱"
    },
    {
        id: 3,
        name: "Digital Support",
        description: "Msaada wa huduma mbalimbali za kidijitali.",
        category: "Services",
        price: 3000,
        icon: "🛠️"
    }
];

onAuthStateChanged(auth, (user) => {
    loading.style.display = "none";

    if (!user) {
        window.location.replace("auth.html");
        return;
    }

    content.style.display = "block";
    renderProducts();

}, (error) => {
    loading.style.display = "none";
    errorBox.textContent = "Firebase error: " + error.message;
});

function renderProducts() {
    const search = searchInput.value.trim().toLowerCase();

    const filtered = products.filter(product => {
        const matchesSearch =
            product.name.toLowerCase().includes(search) ||
            product.description.toLowerCase().includes(search);

        const matchesCategory =
            selectedCategory === "All" ||
            product.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    productsGrid.innerHTML = "";
    emptyMessage.hidden = filtered.length > 0;

    filtered.forEach(product => {
        const card = document.createElement("div");
        card.className = "product";

        const icon = document.createElement("div");
        icon.className = "product-icon";
        icon.textContent = product.icon;

        const name = document.createElement("h3");
        name.textContent = product.name;

        const description = document.createElement("p");
        description.textContent = product.description;

        const price = document.createElement("div");
        price.className = "price";
        price.textContent = "TZS " + product.price.toLocaleString("en-TZ");

        const button = document.createElement("button");
        button.className = "buy-btn";
        button.textContent = "🛒 NUNUA SASA";

        button.addEventListener("click", () => {
            alert(
                "Huduma: " + product.name +
                "\nBei: TZS " + product.price.toLocaleString("en-TZ") +
                "\n\nMfumo wa malipo bado haujaunganishwa."
            );
        });

        card.append(icon, name, description, price, button);
        productsGrid.appendChild(card);
    });
}

searchInput.addEventListener("input", renderProducts);

document.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".category").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");
        selectedCategory = button.dataset.category;
        renderProducts();
    });
});

document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = "user.html";
});