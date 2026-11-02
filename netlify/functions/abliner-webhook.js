

import crypto from "node:crypto";

import {
    initializeApp,
    cert,
    getApps
} from "firebase-admin/app";

import {
    getFirestore,
    Timestamp,
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

// RESPONSE
function response(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json"
        }
    });
}

// WEBHOOK HANDLER
export default async function handler(request) {

    if (request.method !== "POST") {
        return response({
            success: false,
            message: "Method not allowed."
        }, 405);
    }

    try {
        const secret = process.env.ABLINER_WEBHOOK_SECRET;

        if (!secret) {
            throw new Error("Webhook secret haijawekwa.");
        }

        // READ EXACT RAW BODY
        const rawBody = await request.text();

        const timestamp =
            request.headers.get("x-webhook-timestamp");

        const signature =
            request.headers.get("x-webhook-signature");

        // CHECK REQUIRED HEADERS
        if (!timestamp || !signature) {
            return response({
                success: false,
                message: "Webhook signature haipo."
            }, 401);
        }

        // REJECT OLD WEBHOOKS (5 MINUTES)
        const timestampNumber = Number(timestamp);

        if (
            !Number.isFinite(timestampNumber) ||
            Math.abs(Date.now() / 1000 - timestampNumber) > 300
        ) {
            return response({
                success: false,
                message: "Webhook timestamp imepitwa na muda."
            }, 401);
        }

        // VERIFY HMAC SIGNATURE
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(timestamp + "." + rawBody)
            .digest("hex");

        const expectedBuffer = Buffer.from(
            expectedSignature,
            "utf8"
        );

        const receivedBuffer = Buffer.from(
            signature,
            "utf8"
        );

        if (
            expectedBuffer.length !== receivedBuffer.length ||
            !crypto.timingSafeEqual(
                expectedBuffer,
                receivedBuffer
            )
        ) {
            return response({
                success: false,
                message: "Webhook signature si sahihi."
            }, 401);
        }

        // PARSE EVENT
        const webhook = JSON.parse(rawBody);

        const eventId =
            webhook.id ||
            request.headers.get("x-webhook-id");

        const eventType = webhook.event;
        const data = webhook.data || {};

        if (!eventId || !eventType || !data.id) {
            return response({
                success: false,
                message: "Webhook data haijakamilika."
            }, 400);
        }

        // ACCEPT ONLY DEPOSIT EVENTS
        if (
            eventType !== "transaction.completed" &&
            eventType !== "transaction.failed"
        ) {
            return response({
                success: true,
                message: "Event imepokelewa lakini haitumiki."
            });
        }

        if (
            data.type !== "deposit" ||
            data.currency !== "TZS"
        ) {
            return response({
                success: false,
                message: "Transaction type au currency si sahihi."
            }, 400);
        }

        const customerReference =
            data.customer_reference;

        if (!customerReference) {
            return response({
                success: false,
                message: "Customer reference haipo."
            }, 400);
        }

        const db = getDatabase();

        // FIND ORIGINAL PAYMENT
        const paymentQuery = await db
            .collection("payments")
            .where(
                "customerReference",
                "==",
                customerReference
            )
            .limit(1)
            .get();

        if (paymentQuery.empty) {
            return response({
                success: false,
                message: "Malipo haya hayajapatikana."
            }, 404);
        }

        const paymentDocument = paymentQuery.docs[0];
        const paymentRef = paymentDocument.ref;

        const payment = paymentDocument.data();

        // VERIFY AMOUNT AND TRANSACTION
        if (
            Number(data.amount) !== Number(payment.amount) ||
            payment.currency !== "TZS" ||
            !payment.uid
        ) {
            return response({
                success: false,
                message: "Taarifa za malipo hazilingani."
            }, 400);
        }

        if (
            payment.ablinerTransactionId &&
            payment.ablinerTransactionId !== data.id
        ) {
            return response({
                success: false,
                message: "Transaction ID haifanani."
            }, 400);
        }

        // VERIFY PLAN FROM SERVER RECORD
        const planDays = {
            DAILY: 1,
            WEEKLY: 7,
            MONTHLY: 30
        };

        const days = planDays[payment.plan];

        if (!days) {
            return response({
                success: false,
                message: "Premium plan si sahihi."
            }, 400);
        }

        const eventRef = db
            .collection("ablinerWebhookEvents")
            .doc(eventId);

        const userRef = db
            .collection("users")
            .doc(payment.uid);

        // PROCESS ONCE USING FIRESTORE TRANSACTION
        await db.runTransaction(async (transaction) => {

            const eventSnapshot =
                await transaction.get(eventRef);

            if (eventSnapshot.exists) {
                return;
            }

            const currentPayment =
                await transaction.get(paymentRef);

            const currentUser =
                await transaction.get(userRef);

            if (!currentPayment.exists) {
                throw new Error("Payment record haipo.");
            }

            const currentData = currentPayment.data();

            // CHECK PAYMENT DETAILS AGAIN
            if (
                currentData.customerReference !== customerReference ||
                Number(currentData.amount) !== Number(data.amount) ||
                currentData.uid !== payment.uid
            ) {
                throw new Error("Payment verification failed.");
            }

            // FAILED PAYMENT
            if (eventType === "transaction.failed") {

                if (currentData.status !== "completed") {
                    transaction.update(paymentRef, {
                        status: "failed",
                        ablinerTransactionId: data.id,
                        failedAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }

                transaction.set(eventRef, {
                    eventType,
                    paymentId: paymentRef.id,
                    processedAt: FieldValue.serverTimestamp()
                });

                return;
            }

            // DO NOT DOWNGRADE OR EXTEND TWICE
            if (
                currentData.status === "completed" ||
                currentData.status === "failed"
            ) {
                transaction.set(eventRef, {
                    eventType,
                    paymentId: paymentRef.id,
                    ignored: true,
                    processedAt: FieldValue.serverTimestamp()
                });

                return;
            }

            if (
                currentData.status !== "pending" &&
                currentData.status !== "initiating"
            ) {
                throw new Error("Payment status si sahihi.");
            }

            // CALCULATE PREMIUM EXPIRY
            const now = Date.now();

            const existingExpiry =
                currentUser.exists
                    ? currentUser.data().premiumExpiresAt
                    : null;

            const existingExpiryMs =
                existingExpiry &&
                typeof existingExpiry.toMillis === "function"
                    ? existingExpiry.toMillis()
                    : 0;

            const startFrom = Math.max(
                now,
                existingExpiryMs
            );

            const expiresAt = Timestamp.fromMillis(
                startFrom + days * 24 * 60 * 60 * 1000
            );

            // CREATE OR UPDATE USER PREMIUM
            transaction.set(userRef, {
                email: currentData.email || "",
                premium: true,
                premiumPlan: currentData.plan,
                premiumExpiresAt: expiresAt,
                premiumUpdatedAt: FieldValue.serverTimestamp()
            }, {
                merge: true
            });

            // MARK PAYMENT COMPLETED
            transaction.update(paymentRef, {
                status: "completed",
                ablinerTransactionId: data.id,
                completedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            // SAVE EVENT TO PREVENT DUPLICATES
            transaction.set(eventRef, {
                eventType,
                paymentId: paymentRef.id,
                processedAt: FieldValue.serverTimestamp()
            });

        });

        return response({
            success: true,
            message: "Webhook imepokelewa."
        });

    } catch (error) {

        console.error(
            "ABLINER WEBHOOK ERROR:",
            error.message
        );

        return response({
            success: false,
            message: "Webhook processing imeshindwa."
        }, 500);
    }
}

export const config = {
    path: "/api/abliner-webhook"
};
