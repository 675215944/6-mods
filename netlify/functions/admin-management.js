import {
    initializeApp,
    cert,
    getApps
} from "firebase-admin/app";

import {
    getAuth
} from "firebase-admin/auth";

import {
    getFirestore,
    FieldValue
} from "firebase-admin/firestore";

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}

function getFirebaseAdmin() {
    if (!getApps().length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

        if (!raw) {
            throw new Error(
                "FIREBASE_SERVICE_ACCOUNT_JSON haijawekwa Netlify."
            );
        }

        const serviceAccount = JSON.parse(raw);

        initializeApp({
            credential: cert(serviceAccount)
        });
    }

    return {
        auth: getAuth(),
        db: getFirestore()
    };
}

function getAllowedSuperAdminUIDs() {
    return (process.env.SUPER_ADMIN_UIDS || "")
        .split(",")
        .map(uid => uid.trim())
        .filter(Boolean);
}

export default async function handler(req) {
    if (req.method !== "POST") {
        return json({
            success: false,
            message: "Method hairuhusiwi."
        }, 405);
    }

    try {
        const { auth, db } = getFirebaseAdmin();

        // Thibitisha token ya Firebase Authentication.
        const authorization = req.headers.get("authorization") || "";
        const match = authorization.match(/^Bearer (.+)$/);

        if (!match) {
            return json({
                success: false,
                message: "Tafadhali ingia tena."
            }, 401);
        }

        const decoded = await auth.verifyIdToken(match[1]);
        const callerUID = decoded.uid;

        // Ruhusu UID mbili zilizowekwa na mmiliki kwenye Netlify.
        const allowedUIDs = getAllowedSuperAdminUIDs();

        if (
            allowedUIDs.length !== 2 ||
            new Set(allowedUIDs).size !== 2 ||
            !allowedUIDs.includes(callerUID)
        ) {
            return json({
                success: false,
                message: "Huna ruhusa ya kusimamia Admin."
            }, 403);
        }

        // UID iliyoruhusiwa lazima pia iwe Super Admin kwenye Firestore.
        const callerRef = db.collection("admins").doc(callerUID);
        const callerSnapshot = await callerRef.get();

        if (
            !callerSnapshot.exists ||
            callerSnapshot.data().active !== true ||
            callerSnapshot.data().role !== "super_admin"
        ) {
            return json({
                success: false,
                message: "Akaunti hii haijaidhinishwa kama Super Admin."
            }, 403);
        }

        const body = await req.json();
        const action = body.action;

        // Orodha ya Admins.
        if (action === "list") {
            const snapshot = await db.collection("admins").get();

            const admins = snapshot.docs.map(item => {
                const data = item.data();

                return {
                    uid: item.id,
                    email: data.email || "",
                    role: data.role || "admin",
                    active: data.active === true,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || null
                };
            });

            return json({
                success: true,
                admins
            });
        }

        // Ongeza Admin kwa Gmail.
        if (action === "invite") {
            const email = String(body.email || "")
                .trim()
                .toLowerCase();

            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {
                return json({
                    success: false,
                    message: "Weka Gmail/email sahihi."
                }, 400);
            }

            let newUser;

            try {
                newUser = await auth.createUser({
                    email,
                    emailVerified: false
                });
            } catch (error) {
                if (error.code === "auth/email-already-exists") {
                    return json({
                        success: false,
                        message: "Email hii tayari ina akaunti ya Firebase."
                    }, 409);
                }

                throw error;
            }

            try {
                await db.collection("admins").doc(newUser.uid).set({
                    email,
                    role: "admin",
                    active: false,
                    createdAt: FieldValue.serverTimestamp(),
                    createdBy: callerUID
                });
            } catch (error) {
                // Ikiwa kuhifadhi Firestore kumeshindwa,
                // futa akaunti iliyotengenezwa ili kuepuka akaunti hewa.
                await auth.deleteUser(newUser.uid).catch(() => {});
                throw error;
            }

            return json({
                success: true,
                uid: newUser.uid,
                email,
                message: "Admin ameongezwa, lakini bado hajawashwa."
            });
        }

        // Washa au simamisha Admin wa kawaida.
        if (action === "setActive") {
            const uid = String(body.uid || "").trim();
            const active = body.active;

            if (!uid || typeof active !== "boolean") {
                return json({
                    success: false,
                    message: "Taarifa za Admin hazijakamilika."
                }, 400);
            }

            if (allowedUIDs.includes(uid)) {
                return json({
                    success: false,
                    message: "Huwezi kusimamisha Super Admin."
                }, 403);
            }

            const targetRef = db.collection("admins").doc(uid);
            const targetSnapshot = await targetRef.get();

            if (
                !targetSnapshot.exists ||
                targetSnapshot.data().role !== "admin"
            ) {
                return json({
                    success: false,
                    message: "Admin wa kawaida hajapatikana."
                }, 404);
            }

            await auth.updateUser(uid, {
                disabled: !active
            });

            await targetRef.update({
                active,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: callerUID
            });

            return json({
                success: true,
                message: active
                    ? "Admin amewashwa."
                    : "Admin amesimamishwa."
            });
        }

        // Ondoa Admin wa kawaida.
        if (action === "remove") {
            const uid = String(body.uid || "").trim();

            if (!uid) {
                return json({
                    success: false,
                    message: "UID ya Admin haipo."
                }, 400);
            }

            if (allowedUIDs.includes(uid)) {
                return json({
                    success: false,
                    message: "Huwezi kufuta Super Admin."
                }, 403);
            }

            const targetRef = db.collection("admins").doc(uid);
            const targetSnapshot = await targetRef.get();

            if (
                !targetSnapshot.exists ||
                targetSnapshot.data().role !== "admin"
            ) {
                return json({
                    success: false,
                    message: "Admin wa kawaida hajapatikana."
                }, 404);
            }

            // Usifute document ya Super Admin kupitia endpoint hii.
            await auth.deleteUser(uid);
            await targetRef.delete();

            return json({
                success: true,
                message: "Admin ameondolewa."
            });
        }

        return json({
            success: false,
            message: "Kitendo hakitambuliki."
        }, 400);

    } catch (error) {
        console.error("Admin management error:", error);

        return json({
            success: false,
            message: "Hitilafu imetokea. Kagua Netlify Function logs."
        }, 500);
    }
}

export const config = {
    path: "/api/admin-management"
};
