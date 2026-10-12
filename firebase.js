import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import {
getAuth
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
getFirestore
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

export const firebaseConfig = {
apiKey: "AIzaSyCm0Et4fdBefW-dgh-txlUnjdpGURsRQN0",
authDomain: "mods-26551.firebaseapp.com",
projectId: "mods-26551",
storageBucket: "mods-26551.firebasestorage.app",
messagingSenderId: "816867790449",
appId: "1:816867790449:web:3a76c44af22a07cc8255d0"
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
