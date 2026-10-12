
const startBtn = document.getElementById("startBtn");
const menuBtn = document.getElementById("menuBtn");

startBtn.addEventListener("click", () => {
    window.location.href = "auth.html";
});

menuBtn.addEventListener("click", () => {
    window.location.href = "auth.html";
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js")
            .catch(error => console.error(error));
    });
}
