
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

// JSON RESPONSE
function response(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json"
        }
    });
}

// VERIFY WEBHOOK SIGNATURE
function verifySignature(rawBody, timestamp, signature, secret) {
    if (!timestamp || !signature || !secret) {
        return false;
    }

    const timestampNumber = Number(timestamp);

    if (
        !Number.isFinite(timestampNumber) ||
        Math.abs(Date.now() / 1000 - timestampNumber) > 300
    ) {
        return false;
    }

    const expected = crypto
        .createHmac("sha256", secret)
        .update(timestamp + "." + rawBody)
        .digest("hex");

    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(signature, "utf8");

    return (
        expectedBuffer.length === receivedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    );
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

        // VERIFY SIGNATURE
        if (!verifySignature(rawBody, timestamp, signature, secret)) {
            return response({
                success: false,
                message: "Webhook signature si sahihi au imepitwa na muda."
            }, 401);
        }

        // PARSE EVENT
        let webhook;

        try {
            webhook = JSON.parse(rawBody);
        } catch {
            return response({
                success: false,
                message: "Webhook JSON si sahihi."
            }, 400);
        }

        const eventId =
            webhook.id ||
            request.headers.get("x-webhook-id");

        const eventType = webhook.event;
        const data = webhook.data || {};

        if (
            typeof eventId !== "string" ||
            !eventId ||
            eventId.length > 200 ||
            !eventType ||
            !data.id
        ) {
            return response({
                success: false,
                message: "Webhook data haijakamilika."
            }, 400);
        }

        // IGNORE EVENTS WE DO NOT USE
        if (
            eventType !== "transaction.completed" &&
            eventType !== "transaction.failed"
        ) {
            return response({
                success: true,
                message: "Event imepokelewa lakini haitumiki."
            });
        }

        // VERIFY TRANSACTION DETAILS
        const expectedStatus =
            eventType === "transaction.completed"
                ? "completed"
                : "failed";

        if (
            data.type !== "deposit" ||
            data.method !== "mobile" ||
            data.currency !== "TZS" ||
            data.status !== expectedStatus ||
            !data.customer_reference ||
            !Number.isFinite(Number(data.amount))
        ) {
            return response({
                success: false,
                message: "Taarifa za transaction si sahihi."
            }, 400);
        }

        const db = getDatabase();

        // FIND PAYMENT USING CUSTOMER REFERENCE
        const paymentQuery = await db
            .collection("payments")
            .where(
                "customerReference",
                "==",
                data.customer_reference
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

        // VERIFY PAYMENT AMOUNT
        if (
            Number(data.amount) !== Number(payment.amount) ||
            payment.currency !== "TZS" ||
            !payment.uid
        ) {
            return response({
                success: false,
                message: "Kiasi au taarifa za malipo hazilingani."
            }, 400);
        }

        // VERIFY PLAN
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

        // FIRESTORE REFERENCES
        const eventRef = db
            .collection("ablinerWebhookEvents")
            .doc(eventId);

        const userRef = db
            .collection("users")
            .doc(payment.uid);

        // PROCESS EVENT SAFELY
        await db.runTransaction(async (transaction) => {

            // READ ALL DOCUMENTS BEFORE WRITING
            const eventSnapshot =
                await transaction.get(eventRef);

            if (eventSnapshot.exists) {
                return;
            }

            const currentPaymentSnapshot =
                await transaction.get(paymentRef);

            const currentUserSnapshot =
                await transaction.get(userRef);

            if (!currentPaymentSnapshot.exists) {
                throw new Error("Payment record haipo.");
            }

            const currentPayment =
                currentPaymentSnapshot.data();

            // VERIFY PAYMENT AGAIN
            if (
                currentPayment.customerReference !==
                    data.customer_reference ||
                Number(currentPayment.amount) !==
                    Number(data.amount) ||
                currentPayment.uid !== payment.uid ||
                currentPayment.currency !== "TZS"
            ) {
                throw new Error("Payment verification failed.");
            }

            // TRANSACTION ID MUST MATCH
            if (
                currentPayment.ablinerTransactionId &&
                currentPayment.ablinerTransactionId !== data.id
            ) {
                throw new Error("Transaction ID haifanani.");
            }

            // FAILED EVENT
            if (eventType === "transaction.failed") {

                // NEVER DOWNGRADE A COMPLETED PAYMENT
                if (currentPayment.status !== "completed") {
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

            // COMPLETED EVENT
            // Do not extend membership twice.
            if (currentPayment.status === "completed") {

                transaction.set(eventRef, {
                    eventType,
                    paymentId: paymentRef.id,
                    ignored: true,
                    processedAt: FieldValue.serverTimestamp()
                });

                return;
            }

            // Accept initiating, pending or previously failed.
            if (
                currentPayment.status !== "initiating" &&
                currentPayment.status !== "pending" &&
                currentPayment.status !== "failed"
            ) {
                throw new Error("Payment status si sahihi.");
            }

            // CALCULATE PREMIUM EXPIRY
            const now = Date.now();

            const existingExpiry =
                currentUserSnapshot.exists
                    ? currentUserSnapshot.data().premiumExpiresAt
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

            // ACTIVATE PREMIUM
            transaction.set(userRef, {
                email: currentPayment.email || "",
                premium: true,
                premiumPlan: currentPayment.plan,
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

            // SAVE EVENT
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
