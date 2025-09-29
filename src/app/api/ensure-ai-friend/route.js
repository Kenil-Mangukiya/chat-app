import { connectDb } from "@/db/connect-db";
import { addAiFriendToUser } from "@/util/add-ai-friend";
import { getServerSession } from "next-auth";
import { authOption as authOptions } from "../auth/[...nextauth]/option";
import { response } from "@/util/response";

/**
 * API route to ensure AI friend is added for the current user
 * This can be called after login to make sure AI friend exists
 */
export async function POST(req) {
    await connectDb();

    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?._id) {
            return response(401, {}, "Not authenticated", false);
        }

        // Add AI friend forx the current user
        const result = await addAiFriendToUser(session.user._id);
        
        if (result.success) {
            return response(200, {}, result.message, true);
        } else {
            return response(500, {}, result.message, false);
        }

    } catch (error) {
        console.error("Error in ensure-ai-friend:", error);
        return response(500, {}, "Internal server error", false);
    }
}
