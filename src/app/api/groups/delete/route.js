import { connectDb } from "@/db/connect-db"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import { response } from "@/util/response"
import groupModel from "@/model/group-model"
import conversationModel from "@/model/conversation-model"
import messageModel from "@/model/message-model"
import notificationModel from "@/model/notification-model"
import { emitToUser } from "@/lib/socket-server"

export async function POST(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { groupId } = await req.json()
  if (!groupId) return response(400, {}, "groupId required", false)

  try {
    // Find the group and verify ownership
    const group = await groupModel.findById(groupId)
    if (!group) return response(404, {}, "Group not found", false)
    
    if (group.ownerId.toString() !== session.user._id) {
      return response(403, {}, "Only group owner can delete the group", false)
    }

    // Get all group members for notification
    const groupMembers = group.members.map(member => member.userId.toString())
    const groupName = group.name
    const ownerName = session.user.username

    // Delete the group
    await groupModel.findByIdAndDelete(groupId)

    // Delete the conversation
    await conversationModel.findOneAndDelete({ groupId: groupId })

    // Delete all messages in the group
    await messageModel.deleteMany({ groupId: groupId })

    // Create notifications for all members about group deletion
    // Exclude owner from notifications
    const notifications = groupMembers.filter(id => id !== session.user._id).map(memberId => ({
      userId: memberId,
      type: "group_deleted",
      title: "Group Deleted",
      message: `${ownerName} deleted the group "${groupName}"`,
      data: {
        groupId: groupId,
        groupName: groupName,
        deletedBy: ownerName,
        deletedById: session.user._id
      },
      groupId: groupId,
      senderId: session.user._id
    }))

    if (notifications.length) await notificationModel.insertMany(notifications)

    // Emit realtime event to all members (excluding owner)
    groupMembers.filter(id => id !== session.user._id).forEach(uid => {
      emitToUser(uid, "group_deleted", {
        groupId,
        groupName: groupName,
        deletedBy: ownerName
      })
    })
    
    // Also emit to owner but with a flag to indicate they deleted it (so frontend can skip notification)
    emitToUser(session.user._id, "group_deleted", {
      groupId,
      groupName: groupName,
      deletedBy: ownerName,
      deletedBySelf: true // Flag to indicate owner deleted it themselves
    })

    return response(200, {}, "Group deleted successfully", true)
  } catch (e) {
    console.error('Error deleting group:', e)
    return response(500, {}, e.message, false)
  }
}