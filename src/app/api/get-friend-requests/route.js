import { connectDb } from "@/db/connect-db"
import friendRequestModel from "@/model/friend-request-model.js"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"

export async function GET(req) {
    await connectDb()

    const session = await getServerSession(authOptions)

    if (!session) {
        return response(403, {}, "Not authorized", false)
    }

    // Get pending friend requests for the current user
    const friendRequests = await friendRequestModel.find({
        receiverId: session.user._id,
        status: 'pending'
    }).populate('senderId', 'username email')

    console.log("Friend requests for user", session.user._id, ":", friendRequests.length)
    console.log("Friend requests data:", friendRequests)

    return response(200, { friendRequests }, "Friend requests retrieved successfully", true)
}