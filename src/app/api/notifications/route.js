import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import notificationModel from "@/model/notification-model"
import userModel from "@/model/user-model"

export async function GET(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  try {
    const notifications = await notificationModel
      .find({ userId: session.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('groupId', 'name')
      .populate('senderId', 'username')

    // Filter out notifications where:
    // 1. The sender no longer exists (if senderId was populated but is null)
    // 2. The deleted user referenced in data.deletedUserId no longer exists
    // 3. Chat-related notifications (new_message type or similar)
    // 4. Notifications that reference users that no longer exist
    const validNotifications = []
    const notificationsToDelete = []
    
    for (const notif of notifications) {
      let shouldSkip = false
      
      // Skip if senderId was populated but user doesn't exist
      if (notif.senderId && !notif.senderId.username) {
        notificationsToDelete.push(notif._id)
        continue
      }
      
      // Skip if notification references a deleted user that no longer exists
      if (notif.data?.deletedUserId) {
        const deletedUser = await userModel.findById(notif.data.deletedUserId)
        if (!deletedUser) {
          // Delete this notification as it references a non-existent user
          notificationsToDelete.push(notif._id)
          continue
        }
      }
      
      // Skip chat-related notifications (new message notifications)
      if (notif.type === 'new_message' || notif.type === 'message_received' || notif.title?.toLowerCase().includes('new message') || notif.type === 'message') {
        // Delete these notifications
        notificationsToDelete.push(notif._id)
        continue
      }
      
      // Check if notification references any user IDs in data that no longer exist
      if (notif.data) {
        const userIdFields = ['removerId', 'leftById', 'deletedById', 'addedById', 'senderId']
        for (const field of userIdFields) {
          if (notif.data[field]) {
            const user = await userModel.findById(notif.data[field])
            if (!user) {
              notificationsToDelete.push(notif._id)
              shouldSkip = true
              break
            }
          }
        }
        if (shouldSkip) continue
      }
      
      validNotifications.push(notif)
    }
    
    // Delete invalid notifications in batch
    if (notificationsToDelete.length > 0) {
      await notificationModel.deleteMany({ _id: { $in: notificationsToDelete } })
    }

    return response(200, { notifications: validNotifications }, "Notifications retrieved", true)
  } catch (e) {
    return response(500, {}, e.message, false)
  }
}

export async function PUT(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { notificationId } = await req.json()
  if (!notificationId) return response(400, {}, "notificationId required", false)

  try {
    const notification = await notificationModel.findOneAndUpdate(
      { _id: notificationId, userId: session.user._id },
      { isRead: true },
      { new: true }
    )

    if (!notification) return response(404, {}, "Notification not found", false)

    return response(200, { notification }, "Notification marked as read", true)
  } catch (e) {
    return response(500, {}, e.message, false)
  }
}

export async function DELETE(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { notificationId } = await req.json()
  if (!notificationId) return response(400, {}, "notificationId required", false)

  try {
    const notification = await notificationModel.findOneAndDelete(
      { _id: notificationId, userId: session.user._id }
    )

    if (!notification) return response(404, {}, "Notification not found", false)

    return response(200, {}, "Notification deleted", true)
  } catch (e) {
    return response(500, {}, e.message, false)
  }
}
