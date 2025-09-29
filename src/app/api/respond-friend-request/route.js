import { connectDb } from "@/db/connect-db"
import friendRequestModel from "@/model/friend-request-model.js"
import friendModel from "@/model/friend-model.js"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import userModel from "@/model/user-model.js"
import { emitToUser } from "@/lib/socket-server.js"

export async function POST(req) {
    await connectDb()

    const session = await getServerSession(authOptions)

    if (!session) {
        return response(403, {}, "Not authorized", false)
    }

    const { requestId, action } = await req.json() // action: 'accept' or 'decline'

    // Find the friend request
    const friendRequest = await friendRequestModel.findById(requestId)

    if (!friendRequest) {
        return response(404, {}, "Friend request not found", false)
    }

    // Check if the current user is the receiver
    if (friendRequest.receiverId.toString() !== session.user._id) {
        return response(403, {}, "Not authorized to respond to this request", false)
    }

    // Check if request is still pending
    if (friendRequest.status !== 'pending') {
        return response(400, {}, "Friend request has already been responded to", false)
    }

    if (action === 'accept') {
        // Fetch sender user to get email
        const senderUser = await userModel.findById(friendRequest.senderId)

        // Add both users as friends (guard against duplicates via unique index)
        try {
            await friendModel.create({
                userid: friendRequest.senderId,
                friendid: friendRequest.receiverId,
                friendusername: session.user.username,
                friendemail: session.user.email
            })
        } catch (e) {}

        try {
            await friendModel.create({
                userid: friendRequest.receiverId,
                friendid: friendRequest.senderId,
                friendusername: friendRequest.senderUsername,
                friendemail: senderUser?.email || ""
            })
        } catch (e) {}

        // Update request status
        friendRequest.status = 'accepted'
        await friendRequest.save()

        // Notify sender that their request was accepted
        emitToUser(friendRequest.senderId, "friend_request_responded", {
            status: "accepted",
            receiverUsername: session.user.username,
            receiverId: session.user._id
        })

        return response(200, { senderId: friendRequest.senderId.toString() }, "Friend request accepted successfully", true)
    } else if (action === 'decline') {
        // Update request status
        friendRequest.status = 'declined'
        await friendRequest.save()

        // Notify sender that their request was declined
        emitToUser(friendRequest.senderId, "friend_request_responded", {
            status: "declined",
            receiverUsername: session.user.username,
            receiverId: session.user._id
        })

        return response(200, { senderId: friendRequest.senderId.toString() }, "Friend request declined", true)
    } else {
        return response(400, {}, "Invalid action", false)
    }
}