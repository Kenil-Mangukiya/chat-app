import { connectDb } from "@/db/connect-db"
import friendRequestModel from "@/model/friend-request-model.js"
import userModel from "@/model/user-model.js"
import friendModel from "@/model/friend-model.js"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import { emitToUser } from "@/lib/socket-server.js"

export async function POST(req) {
    try {
    await connectDb()

    const session = await getServerSession(authOptions)

    if (!session) {
        return response(403, {}, "Not authorized", false)
    }

    const { username } = await req.json()

        console.log("Friend request attempt:", {
            senderId: session.user._id,
            senderUsername: session.user.username,
            targetUsername: username
        })

        // Find user by username
        const findUserByUsername = await userModel.findOne({ username })

        if (!findUserByUsername) {
            console.log("User not found:", username)
            return response(404, {}, "User not found", false)
        }
        
        console.log("Target user found:", {
            targetId: findUserByUsername._id,
            targetUsername: findUserByUsername.username
        })

        // Check if user is trying to add themselves
        if (findUserByUsername._id.toString() === session.user._id) {
            return response(403, {}, "You can't send friend request to yourself", false)
        }

        // Check if they are already friends (excluding blocked friendships)
        const existingFriend = await friendModel.findOne({
            userid: session.user._id,
            friendid: findUserByUsername._id,
            isBlocked: { $ne: true } // Exclude blocked friendships
        })

        console.log("Existing friend check:", {
            existingFriend: !!existingFriend,
            userid: session.user._id,
            friendid: findUserByUsername._id,
            existingFriendData: existingFriend
        })

        if (existingFriend) {
            console.log("Users are already friends")
            return response(400, {}, "You are already friends with this user", false)
        }

        // Check if there's already any request between these users
        const existingRequest = await friendRequestModel.findOne({
            $or: [
                { senderId: session.user._id, receiverId: findUserByUsername._id },
                { senderId: findUserByUsername._id, receiverId: session.user._id }
            ]
        })
        
        console.log("Existing request check:", {
            existingRequest: !!existingRequest,
            senderId: session.user._id,
            receiverId: findUserByUsername._id
        })

        if (existingRequest) {
            const senderIdStr = existingRequest.senderId.toString()
            const receiverIdStr = existingRequest.receiverId.toString()
            const currentUserIdStr = session.user._id.toString()
            const targetUserIdStr = findUserByUsername._id.toString()
            
            console.log("Existing request found:", {
                senderId: senderIdStr,
                receiverId: receiverIdStr,
                currentUserId: currentUserIdStr,
                targetUserId: targetUserIdStr,
                status: existingRequest.status
            })
            
            if (existingRequest.status === 'pending') {
                if (senderIdStr === currentUserIdStr) {
                    // Allow user to cancel their own pending request and send a new one
                    console.log("Deleting user's own pending request to allow new request")
                    await friendRequestModel.findByIdAndDelete(existingRequest._id)
                    // Continue with creating new request
                } else if (senderIdStr === targetUserIdStr) {
            return response(400, {}, "This user has already sent you a friend request", false)
        }
            } else if (existingRequest.status === 'accepted') {
                return response(400, {}, "You are already friends with this user", false)
            } else if (existingRequest.status === 'declined') {
                // If the request was declined, allow sending a new one by deleting the old one
                console.log("Deleting declined request to allow new request")
                await friendRequestModel.findByIdAndDelete(existingRequest._id)
                // Continue with creating new request
            }
        }


        // Create friend request
        console.log("Creating friend request...")
        const friendRequest = await friendRequestModel.create({
            senderId: session.user._id,
            receiverId: findUserByUsername._id,
            senderUsername: session.user.username,
            message: `Friend request from ${session.user.username}`
        })
        
        console.log("Friend request created successfully:", friendRequest._id)
        
        // Check if this replaced an existing request
        const wasReplaced = existingRequest && (existingRequest.status === 'pending' || existingRequest.status === 'declined')

        // Emit notification using server socket instance helper
        console.log("Emitting friend_request_received to user:", findUserByUsername._id)
        emitToUser(findUserByUsername._id, "friend_request_received", {
            senderUsername: session.user.username,
            timestamp: new Date()
        })

        return response(200, { 
            friendRequest,
            receiverId: findUserByUsername._id.toString(),
            senderUsername: session.user.username,
            wasReplaced
        }, wasReplaced ? "Friend request updated successfully" : "Friend request sent successfully", true)
    } catch (error) {
        console.error("Error in send-friend-request:", error)
        return response(500, {}, "Internal server error", false)
    }
}