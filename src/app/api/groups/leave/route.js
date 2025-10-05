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
    // Find the group
    const group = await groupModel.findById(groupId)
    if (!group) return response(404, {}, "Group not found", false)
    
    // Check if user is a member
    const memberIndex = group.members.findIndex(member => member.userId.toString() === session.user._id)
    if (memberIndex === -1) {
      return response(403, {}, "You are not a member of this group", false)
    }

    // Get member info before removing
    const memberName = session.user.username || "Member"
    const groupName = group.name

    // Remove the member from the group
    group.members.splice(memberIndex, 1)
    await group.save()

    // Create notification for remaining members about the leave
    const remainingMembers = group.members.map(member => member.userId.toString())
    const notifications = remainingMembers.map(memberId => ({
      userId: memberId,
      type: "group_member_left",
      title: "Member Left Group",
      message: `${memberName} left the group "${groupName}"`,
      data: {
        groupId: groupId,
        groupName: groupName,
        leftBy: memberName,
        leftById: session.user._id
      },
      groupId: groupId,
      senderId: session.user._id
    }))

    if (notifications.length > 0) {
      await notificationModel.insertMany(notifications)
    }

    // Emit realtime event to remaining members so active chats can show system message
    remainingMembers.forEach(uid => {
      emitToUser(uid, "group_member_left", {
        groupId,
        userId: session.user._id,
        username: memberName
      })
    })

    return response(200, {}, "Left group successfully", true)
  } catch (e) {
    console.error('Error leaving group:', e)
    return response(500, {}, e.message, false)
  }
}