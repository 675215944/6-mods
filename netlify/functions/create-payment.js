
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

import {
    getAuth
} from "firebase-admin/auth";

// ======================================
// FIREBASE ADMIN
// ======================================

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

// ======================================
// JSON RESPONSE
// ======================================

function response(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json"
        }
    });
}

// ======================================
// PREMIUM PLANS
// ======================================

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

// ======================================
// TANZANIA PHONE NORMALIZATION
// ======================================

function normalizePhone(input) {
    const phone = String(input || "").replace(/\D/g, "");

    // 0712345678 or 0612345678
    if (/^0[67][0-9]{8}$/.test(phone)) {
        return "255" + phone.substring(1);
    }

    // 255712345678 or 255612345678
    if (/^255[67][0-9]{8}$/.test(phone)) {
        return phone;
    }

    // 712345678 or 612345678
    if (/^[67][0-9]{8}$/.test(phone)) {
        return "255" + phone;
    }

    return null;
}

// ======================================
// CREATE PAYMENT
// ======================================

export default async function handler(request) {

    if (request.method !== "POST") {
        return response({
            success: false,
            message: "Method not allowed."
        }, 405);
    }

    let paymentRef = null;

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

        const decoded = await getAuth().verifyIdToken(idToken);

        const uid = decoded.uid;

        // READ REQUEST
        let body;

        try {
            body = await request.json();
        } catch {
            return response({
                success: false,
                message: "Taarifa ulizotuma si sahihi."
            }, 400);
        }

        const planKey = body.plan;
        const plan = PLANS[planKey];

        if (!plan) {
            return response({
                success: false,
                message: "Kifurushi hakitambuliki."
            }, 400);
        }

        // NORMALIZE PHONE
        const internationalPhone = normalizePhone(body.phone);

        if (!internationalPhone) {
            return response({
                success: false,
                message:
                    "Weka namba sahihi ya Tanzania. Mfano 0712345678 au 0612345678."
            }, 400);
        }

        // CREATE UNIQUE PAYMENT
        const paymentId = crypto.randomUUID();

        const customerReference =
            "6MODS" + crypto.randomBytes(8).toString("hex");

        paymentRef = db
            .collection("payments")
            .doc(paymentId);

        // SAVE PAYMENT BEFORE REQUEST
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

        let result;

        try {
            result = await ablinerResponse.json();
        } catch {
            throw new Error(
                "Abliner imerudisha jibu lisilotambulika."
            );
        }

        // PROVIDER REJECTED REQUEST
        if (!ablinerResponse.ok) {

            await db.runTransaction(async (transaction) => {

                const snapshot =
                    await transaction.get(paymentRef);

                if (
                    snapshot.exists &&
                    snapshot.data().status === "initiating"
                ) {
                    transaction.update(paymentRef, {
                        status: "failed",
                        providerError:
                            result.code || "payment_error",
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }
            });

            console.error(
                "ABLINER REJECTED:",
                result.code || "unknown_code",
                result.message || "No message"
            );

            return response({
                success: false,
                message:
                    result.message ||
                    "Abliner imeshindwa kuanzisha malipo."
            }, 502);
        }

        // VERIFY PROVIDER RESPONSE
        const providerTransaction =
            result && result.data;

        if (
            !providerTransaction ||
            typeof providerTransaction.id !== "string" ||
            !providerTransaction.id
        ) {
            throw new Error(
                "Jibu la transaction halina ID inayotambulika."
            );
        }

        // SAVE TRANSACTION ID WITHOUT OVERWRITING WEBHOOK STATUS
        let finalStatus = "pending";

        await db.runTransaction(async (transaction) => {

            const snapshot =
                await transaction.get(paymentRef);

            if (!snapshot.exists) {
                throw new Error("Payment record haipo.");
            }

            const currentPayment = snapshot.data();

            // CHECK TRANSACTION ID
            if (
                currentPayment.ablinerTransactionId &&
                currentPayment.ablinerTransactionId !==
                    providerTransaction.id
            ) {
                throw new Error("Transaction ID hazifanani.");
            }

            // WEBHOOK MAY HAVE ARRIVED FIRST
            if (
                currentPayment.status === "completed" ||
                currentPayment.status === "failed"
            ) {

                finalStatus = currentPayment.status;

                // Save missing transaction ID while preserving status
                transaction.update(paymentRef, {
                    ablinerTransactionId: providerTransaction.id,
                    updatedAt: FieldValue.serverTimestamp()
                });

                return;
            }

            if (currentPayment.status !== "initiating") {
                throw new Error("Payment status si sahihi.");
            }

            transaction.update(paymentRef, {
                status: "pending",
                ablinerTransactionId: providerTransaction.id,
                updatedAt: FieldValue.serverTimestamp()
            });

            finalStatus = "pending";
        });

        return response({
            success: true,
            status: finalStatus,
            paymentId,
            plan: plan.name,
            amount: plan.amount,
            phone: internationalPhone,
            message:
                finalStatus === "completed"
                    ? "Malipo yamethibitishwa."
                    : finalStatus === "failed"
                        ? "Malipo hayakukamilika."
                        : "Ombi la malipo limetumwa. Angalia simu yako."
        });

    } catch (error) {

        console.error(
            "CREATE PAYMENT ERROR:",
            error.message
        );

        if (paymentRef) {
            try {
                await paymentRef.update({
                    lastError: "payment_initialization_error",
                    updatedAt: FieldValue.serverTimestamp()
                });
            } catch (updateError) {
                console.error(
                    "PAYMENT RECORD UPDATE ERROR:",
                    updateError.message
                );
            }
        }

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
