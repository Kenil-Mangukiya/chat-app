import { connectDb } from "@/db/connect-db"
import friendRequestModel from "@/model/friend-request-model.js"
import friendModel from "@/model/friend-model.js"
import userModel from "@/model/user-model.js"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"

export async function POST(req) {
    try {
        await connectDb()
        
        const session = await getServerSession(authOptions)
        if (!session) {
            return response(403, {}, "Not authorized", false)
        }
        
        const { targetUsername } = await req.json()
        
        // Find target user
        const targetUser = await userModel.findOne({ username: targetUsername })
        if (!targetUser) {
            return response(404, {}, "Target user not found", false)
        }
        
        // Check existing friend relationship
        const existingFriend = await friendModel.findOne({
            userid: session.user._id,
            friendid: targetUser._id
        })
        
        // Check existing friend requests
        const existingRequests = await friendRequestModel.find({
            $or: [
                { senderId: session.user._id, receiverId: targetUser._id },
                { senderId: targetUser._id, receiverId: session.user._id }
            ]
        })
        
        return response(200, {
            currentUser: {
                id: session.user._id,
                username: session.user.username
            },
            targetUser: {
                id: targetUser._id,
                username: targetUser.username
            },
            existingFriend: !!existingFriend,
            existingRequests: existingRequests.map(req => ({
                id: req._id,
                senderId: req.senderId,
                receiverId: req.receiverId,
                status: req.status,
                createdAt: req.createdAt
            }))
        }, "Debug info retrieved", true)
    } catch (error) {
        console.error("Error in debug-friend-request:", error)
        return response(500, {}, "Internal server error", false)
    }
}
