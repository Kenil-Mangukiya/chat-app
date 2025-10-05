import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import groupModel from "@/model/group-model"
import friendModel from "@/model/friend-model"
import userModel from "@/model/user-model"
import notificationModel from "@/model/notification-model"
import { emitToUser } from "@/lib/socket-server"

export async function POST(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { groupId, inviteeId } = await req.json()
  if (!groupId || !inviteeId) return response(400, {}, "groupId and inviteeId required", false)

  const group = await groupModel.findById(groupId)
  if (!group) return response(404, {}, "Group not found", false)

  // Only owner/admin can add members
  const me = group.members.find((m) => m.userId.toString() === session.user._id)
  if (!me || (me.role !== "owner" && me.role !== "admin")) return response(403, {}, "Insufficient permissions", false)

  // Invitee must be a friend of inviter
  const isFriend = await friendModel.findOne({ userid: session.user._id, friendid: inviteeId })
  if (!isFriend) return response(400, {}, "Only friends can be added to groups", false)

  // Disallow adding AI/bot accounts by heuristic (email or username)
  const invitee = await userModel.findById(inviteeId)
  const lowerName = (invitee?.username || "").toLowerCase()
  if (invitee?.email === "ai@gmail.com" || lowerName.includes("ai")) {
    return response(400, {}, "AI cannot be added to groups", false)
  }

  // If already member
  if (group.members.some((m) => m.userId.toString() === inviteeId)) {
    return response(400, {}, "User already in group", false)
  }

  try {
    // Automatically add the member to the group
    const updatedGroup = await groupModel.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: { userId: inviteeId, role: "member" } } },
      { new: true }
    )

    // Create notification for the added member (check for duplicates first)
    const existingNotification = await notificationModel.findOne({
      userId: inviteeId,
      groupId: group._id,
      type: "group_added",
      senderId: session.user._id
    })
    
    if (!existingNotification) {
      await notificationModel.create({
        userId: inviteeId,
        type: "group_added",
        title: "Added to Group",
        message: `${session.user.username} has added you to the group "${group.name}"`,
        data: {
          groupId: group._id,
          groupName: group.name,
          addedBy: session.user.username,
          addedById: session.user._id
        },
        groupId: group._id,
        senderId: session.user._id
      })
    }

    // Notify the added member in real-time (only if notification was created)
    if (!existingNotification) {
      emitToUser(inviteeId, "group_added", {
        group: updatedGroup,
        addedBy: session.user.username,
        message: `${session.user.username} has added you to the group "${group.name}"`
      })
    }

    // Notify all other group members about the new member
    group.members.forEach(member => {
      if (member.userId.toString() !== session.user._id && member.userId.toString() !== inviteeId) {
        emitToUser(member.userId, "group_member_added", {
          group: updatedGroup,
          newMember: invitee.username,
          addedBy: session.user.username
        })
      }
    })

    return response(200, { group: updatedGroup }, "Member added successfully", true)
  } catch (e) {
    return response(500, {}, e.message, false)
  }
}


