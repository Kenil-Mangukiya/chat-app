import { connectDb } from "@/db/connect-db"
import friendModel from "@/model/friend-model"
import userModel from "@/model/user-model"
import notificationModel from "@/model/notification-model"
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

        const { friendId, action } = await req.json() // action: 'block' or 'unblock'

        if (!friendId || !action) {
            return response(400, {}, "Friend ID and action are required", false)
        }

        if (!['block', 'unblock'].includes(action)) {
            return response(400, {}, "Invalid action. Must be 'block' or 'unblock'", false)
        }

        // Find the friendship relationship
        const friendship = await friendModel.findOne({
            userid: session.user._id,
            friendid: friendId
        })

        if (!friendship) {
            return response(404, {}, "Friendship not found", false)
        }

        // Update the friendship based on action
        if (action === 'block') {
            friendship.isBlocked = true
            friendship.blockedBy = session.user._id
        } else {
            friendship.isBlocked = false
            friendship.blockedBy = null
        }

        await friendship.save()

        // Also update the reverse friendship (friend's perspective)
        const reverseFriendship = await friendModel.findOne({
            userid: friendId,
            friendid: session.user._id
        })

        if (reverseFriendship) {
            if (action === 'block') {
                reverseFriendship.isBlocked = true
                reverseFriendship.blockedBy = session.user._id
            } else {
                reverseFriendship.isBlocked = false
                reverseFriendship.blockedBy = null
            }
            await reverseFriendship.save()
        }

        const message = action === 'block' ? 'Friend blocked successfully' : 'Friend unblocked successfully'

        // Get friend's username for notification
        const friend = await userModel.findById(friendId).select('username')
        const friendUsername = friend ? friend.username : 'Unknown'

        // Create notification for the friend
        const notificationType = action === 'block' ? 'friend_blocked' : 'friend_unblocked'
        const notificationTitle = action === 'block' ? 'You have been blocked' : 'You have been unblocked'
        const notificationMessage = action === 'block' 
            ? `${session.user.username} has blocked you`
            : `${session.user.username} has unblocked you`

        await notificationModel.create({
            userId: friendId,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            data: {
                blockerId: session.user._id,
                blockerUsername: session.user.username,
                action: action
            },
            senderId: session.user._id
        })

        return response(200, { 
            isBlocked: friendship.isBlocked,
            action,
            friendId,
            friendUsername,
            blockerUsername: session.user.username
        }, message, true)

    } catch (error) {
        console.error('Error in block-friend API:', error)
        return response(500, { error: error.message }, "Internal server error", false)
    }
}
