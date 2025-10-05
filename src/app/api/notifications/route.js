import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import notificationModel from "@/model/notification-model"

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

    return response(200, { notifications }, "Notifications retrieved", true)
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
