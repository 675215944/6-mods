

import crypto from "node:crypto";

import {
    initializeApp,
    cert,
    getApps
} from "firebase-admin/app";

import {
    getFirestore,
    FieldValue
} from "firebase-admin/firestore";

// FIREBASE ADMIN
function getDatabase() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!raw) {
        throw new Error("Firebase credentials hazijawekwa.");
    }

    if (getApps().length === 0) {
        initializeApp({
            credential: cert(JSON.parse(raw))
        });
    }

    return getFirestore();
}

// JSON RESPONSE
function response(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json"
        }
    });
}

// PREMIUM PLANS
const PLANS = {
    DAILY: {
        name: "Daily",
        amount: 3000,
        days: 1
    },
    WEEKLY: {
        name: "Weekly",
        amount: 10000,
        days: 7
    },
    MONTHLY: {
        name: "Monthly",
        amount: 30000,
        days: 30
    }
};

// CREATE PAYMENT
export default async function handler(request) {
    if (request.method !== "POST") {
        return response({
            success: false,
            message: "Method not allowed."
        }, 405);
    }

    try {
        const apiKey = process.env.ABLINER_API_KEY;
        const webhookSecret =
            process.env.ABLINER_WEBHOOK_SECRET;

        if (!apiKey || !webhookSecret) {
            throw new Error(
                "Abliner environment variables hazijakamilika."
            );
        }

        // VERIFY FIREBASE USER
        const authorization =
            request.headers.get("authorization") || "";

        if (!authorization.startsWith("Bearer ")) {
            return response({
                success: false,
                message: "Tafadhali ingia kwenye akaunti yako."
            }, 401);
        }

        const idToken = authorization.substring(7);

        const db = getDatabase();

        const { getAuth } = await import(
            "firebase-admin/auth"
        );

        const decoded = await getAuth().verifyIdToken(idToken);

        const uid = decoded.uid;

        // READ REQUEST
        const body = await request.json();

        const planKey = body.plan;
        const phone = String(body.phone || "").trim();

        const plan = PLANS[planKey];

        if (!plan) {
            return response({
                success: false,
                message: "Kifurushi hakitambuliki."
            }, 400);
        }

        // ACCEPT ONLY 07XXXXXXXX
        if (!/^07[0-9]{8}$/.test(phone)) {
            return response({
                success: false,
                message:
                    "Weka namba sahihi inayoanzia 07. Mfano 0712345678."
            }, 400);
        }

        // CONVERT 07 TO 255
        const internationalPhone =
            "255" + phone.substring(1);

        // CREATE UNIQUE PAYMENT
        const paymentId = crypto.randomUUID();

        const customerReference =
            "6MODS" + crypto.randomBytes(8).toString("hex");

        const paymentRef = db
            .collection("payments")
            .doc(paymentId);

        // SAVE PENDING PAYMENT FIRST
        await paymentRef.set({
            uid,
            email: decoded.email || "",
            plan: planKey,
            planName: plan.name,
            amount: plan.amount,
            currency: "TZS",
            phone: internationalPhone,
            customerReference,
            status: "initiating",
            createdAt: FieldValue.serverTimestamp()
        });

        // ABLINER REQUEST
        const payload = {
            amount: plan.amount,
            method: "mobile",
            currency: "TZS",
            phone: internationalPhone,
            reference: customerReference,
            callback_url:
                "https://6mods.netlify.app/api/abliner-webhook"
        };

        const rawBody = JSON.stringify(payload);

        const timestamp = Math.floor(
            Date.now() / 1000
        ).toString();

        const signature = crypto
            .createHmac("sha256", webhookSecret)
            .update(timestamp + "." + rawBody)
            .digest("hex");

        const ablinerResponse = await fetch(
            "https://abliner.net/api/v1/deposits",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + apiKey,
                    "Content-Type": "application/json",
                    "Idempotency-Key": paymentId,
                    "x-abliner-timestamp": timestamp,
                    "x-abliner-signature": signature
                },
                body: rawBody
            }
        );

        const result = await ablinerResponse.json();

        if (!ablinerResponse.ok) {
            await paymentRef.update({
                status: "failed",
                providerError: result.code || "payment_error",
                updatedAt: FieldValue.serverTimestamp()
            });

            return response({
                success: false,
                message:
                    result.message ||
                    "Abliner imeshindwa kuanzisha malipo."
            }, 502);
        }

        const transaction = result.data;

        if (!transaction || !transaction.id) {
            await paymentRef.update({
                status: "failed",
                updatedAt: FieldValue.serverTimestamp()
            });

            return response({
                success: false,
                message: "Jibu la malipo halijatambulika."
            }, 502);
        }

        // UPDATE PAYMENT RECORD
        await paymentRef.update({
            status: "pending",
            ablinerTransactionId: transaction.id,
            updatedAt: FieldValue.serverTimestamp()
        });

        return response({
            success: true,
            status: "pending",
            paymentId,
            plan: plan.name,
            amount: plan.amount,
            phone,
            message:
                "Ombi la malipo limetumwa. Angalia simu yako na uthibitishe malipo."
        });

    } catch (error) {
        console.error(
            "CREATE PAYMENT ERROR:",
            error.message
        );

        return response({
            success: false,
            message:
                "Imeshindikana kuanzisha malipo. Tafadhali jaribu tena."
        }, 500);
    }
}

export const config = {
    path: "/api/create-payment"
};
