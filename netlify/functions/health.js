export default async (req) => {
    return new Response(
        JSON.stringify({
            success: true,
            message: "6+MODS Backend iko tayari!"
        }),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        }
    );
};

export const config = {
    path: "/api/health"
};
