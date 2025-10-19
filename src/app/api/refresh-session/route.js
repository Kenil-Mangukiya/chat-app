import { getServerSession } from "next-auth/next"
import { authOption } from "../auth/[...nextauth]/option"
import { response } from "@/util/response"
import { connectDb } from "@/db/connect-db"
import userModel from "@/model/user-model"

export async function POST(req) {
    try {
        await connectDb()
        
        // Get the current session
        const session = await getServerSession(authOption)
        
        if (!session?.user?._id) {
            return response(401, {}, "Unauthorized", false)
        }

        // Fetch the latest user data from database
        const user = await userModel.findById(session.user._id)
        
        if (!user) {
            return response(404, {}, "User not found", false)
        }

        // Return the updated user data
        return response(200, {
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture
            },
            message: "Session refreshed successfully"
        }, "Session refreshed successfully", true)

    } catch (error) {
        console.error("Error refreshing session:", error)
        return response(500, {}, error.message, false)
    }
}
