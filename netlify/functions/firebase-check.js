import { initializeApp, cert, getApps } from "firebase-admin/app";

export default async () => {
try {
const rawCredentials =
process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!rawCredentials) {
        throw new Error("Firebase credentials are not configured");
    }

    const serviceAccount = JSON.parse(rawCredentials);

    if (getApps().length === 0) {
        initializeApp({
            credential: cert(serviceAccount)
        });
    }

    return new Response(
        JSON.stringify({
            success: true,
            message: "Firebase Admin SDK imeunganishwa!"
        }),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        }
    );
} catch (error) {
    console.error("Firebase initialization failed:", error.message);

    return new Response(
        JSON.stringify({
            success: false,
            message: "Muunganisho wa Firebase umeshindwa. Kagua mipangilio ya server."
        }),
        {
            status: 500,
            headers: {
                "Content-Type": "application/json"
            }
        }
    );
}

};

export const config = {
path: "/api/firebase-check"
};
