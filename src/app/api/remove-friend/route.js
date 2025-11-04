import { connectDb } from "@/db/connect-db"
import friendModel from "@/model/friend-model"
import userModel from "@/model/user-model"
import notificationModel from "@/model/notification-model"
import friendRequestModel from "@/model/friend-request-model"
import conversationModel from "@/model/conversation-model"
import messageModel from "@/model/message-model"
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

        const { friendId } = await req.json()

        if (!friendId) {
            return response(400, {}, "Friend ID is required", false)
        }

        // Find the friendship relationships
        const friendship = await friendModel.findOne({
            userid: session.user._id,
            friendid: friendId
        })

        const reverseFriendship = await friendModel.findOne({
            userid: friendId,
            friendid: session.user._id
        })

        if (!friendship) {
            return response(404, {}, "Friendship not found", false)
        }

        // Get friend's username for notification
        const friend = await userModel.findById(friendId).select('username')
        const friendUsername = friend ? friend.username : 'Unknown'

        // Delete both friendship relationships
        console.log('Deleting friendship:', { userid: session.user._id, friendid: friendId })
        const deleteResult1 = await friendModel.deleteOne({
            userid: session.user._id,
            friendid: friendId
        })
        console.log('Delete result 1:', deleteResult1)

        if (reverseFriendship) {
            console.log('Deleting reverse friendship:', { userid: friendId, friendid: session.user._id })
            const deleteResult2 = await friendModel.deleteOne({
                userid: friendId,
                friendid: session.user._id
            })
            console.log('Delete result 2:', deleteResult2)
        }

        // Clean up any pending friend requests between these users
        console.log('Cleaning up friend requests between users:', { userid: session.user._id, friendid: friendId })
        const deletedRequests = await friendRequestModel.deleteMany({
            $or: [
                { senderId: session.user._id, receiverId: friendId },
                { senderId: friendId, receiverId: session.user._id }
            ]
        })
        console.log('Deleted friend requests:', deletedRequests.deletedCount)

        // Delete all direct conversations between these two users
        console.log('Deleting conversations between users:', { userid: session.user._id, friendid: friendId })
        const conversations = await conversationModel.find({
            participants: { $all: [session.user._id, friendId] },
            type: "direct"
        })
        console.log('Found conversations to delete:', conversations.length)

        if (conversations.length > 0) {
            const conversationIds = conversations.map(c => c._id)
            
            // Delete all messages in these conversations
            const deletedMessages = await messageModel.deleteMany({
                conversationid: { $in: conversationIds }
            })
            console.log('Deleted messages:', deletedMessages.deletedCount)

            // Delete the conversations
            const deletedConversations = await conversationModel.deleteMany({
                _id: { $in: conversationIds }
            })
            console.log('Deleted conversations:', deletedConversations.deletedCount)
        }

        // Create notification for the removed friend
        await notificationModel.create({
            userId: friendId,
            type: 'friend_removed',
            title: 'You have been removed from friends',
            message: `${session.user.username} has removed you from friends`,
            data: {
                removerId: session.user._id,
                removerUsername: session.user.username
            },
            senderId: session.user._id
        })

        // Return success response with friend info for notification
        return response(200, { 
            removedFriendId: friendId,
            removedFriendUsername: friendUsername,
            removerUsername: session.user.username
        }, "Friend removed successfully", true)

    } catch (error) {
        console.error('Error in remove-friend API:', error)
        return response(500, { error: error.message }, "Internal server error", false)
    }
}
