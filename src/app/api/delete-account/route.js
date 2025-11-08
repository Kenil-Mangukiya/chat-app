import { connectDb } from "@/db/connect-db"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import { response } from "@/util/response"
import userModel from "@/model/user-model"
import friendModel from "@/model/friend-model"
import messageModel from "@/model/message-model"
import conversationModel from "@/model/conversation-model"
import groupModel from "@/model/group-model"
import notificationModel from "@/model/notification-model"
import { emitToUser } from "@/lib/socket-server"

export async function POST() {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session?.user?._id) return response(401, {}, "Not authenticated", false)

  const userId = session.user._id

  try {
    // Find all friends to notify
    const friends = await friendModel.find({ $or: [{ userid: userId }, { friendid: userId }] })

    // Build unique target user ids to avoid duplicate notifications per friend
    const targetUserIdsSet = new Set()
    for (const f of friends) {
      const targetId = f.userid.toString() === userId ? f.friendid.toString() : f.userid.toString()
      targetUserIdsSet.add(targetId)
    }

    // Send one notification per unique friend
    const notifications = Array.from(targetUserIdsSet).map(targetUserId => ({
      userId: targetUserId,
      type: "other",
      title: "Friend deleted account",
      message: `${session.user.username} has deleted their account`,
      data: { deletedUserId: userId }
    }))
    if (notifications.length) {
      // Save notifications to database
      await notificationModel.insertMany(notifications, { ordered: false }).catch(() => {})
      
      // Immediately emit socket notifications to all friends
      notifications.forEach(notif => {
        emitToUser(notif.userId, "notification_received", {
          id: notif._id || `deleted_account_${userId}_${notif.userId}_${Date.now()}`,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          timestamp: Date.now(),
          isRead: false,
          data: notif.data
        })
      })
    }

    // Remove user's friendships
    await friendModel.deleteMany({ $or: [{ userid: userId }, { friendid: userId }] })

    // Remove user from groups and delete groups they own
    const groupsOwned = await groupModel.find({ ownerId: userId })
    for (const g of groupsOwned) {
      await groupModel.deleteOne({ _id: g._id })
    }
    await groupModel.updateMany({}, { $pull: { members: { userId } } })

    // Delete conversations and messages involving the user
    const conversations = await conversationModel.find({ participants: userId })
    const convIds = conversations.map(c => c._id)
    if (convIds.length) {
      await messageModel.deleteMany({ conversationid: { $in: convIds } })
      await conversationModel.deleteMany({ _id: { $in: convIds } })
    }

    // Delete all notifications for this user (both received and sent)
    await notificationModel.deleteMany({ 
      $or: [
        { userId: userId },
        { senderId: userId }
      ]
    })

    // Finally remove the user
    await userModel.deleteOne({ _id: userId })

    return response(200, {}, "Account deleted", true)
  } catch (e) {
    console.error("Delete account error:", e)
    return response(500, {}, "Failed to delete account", false)
  }
}


