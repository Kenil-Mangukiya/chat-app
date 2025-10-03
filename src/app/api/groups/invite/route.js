import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import groupModel from "@/model/group-model"
import groupInviteModel from "@/model/group-invite-model"
import friendModel from "@/model/friend-model"
import userModel from "@/model/user-model"
import { emitToUser } from "@/lib/socket-server"

export async function POST(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { groupId, inviteeId } = await req.json()
  if (!groupId || !inviteeId) return response(400, {}, "groupId and inviteeId required", false)

  const group = await groupModel.findById(groupId)
  if (!group) return response(404, {}, "Group not found", false)

  // Only owner/admin can invite
  const me = group.members.find((m) => m.userId.toString() === session.user._id)
  if (!me || (me.role !== "owner" && me.role !== "admin")) return response(403, {}, "Insufficient permissions", false)

  // Invitee must be a friend of inviter
  const isFriend = await friendModel.findOne({ userid: session.user._id, friendid: inviteeId })
  if (!isFriend) return response(400, {}, "Only friends can be invited", false)

  // Disallow inviting AI/bot accounts by heuristic (email or username)
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
    const invite = await groupInviteModel.findOneAndUpdate(
      { groupId, inviteeId },
      { groupId, inviteeId, inviterId: session.user._id, status: "pending" },
      { upsert: true, new: true }
    )
    // Notify invitee in real-time
    emitToUser(inviteeId, "group_invite_received", { ...invite.toObject() })
    return response(200, { invite }, "Invite sent", true)
  } catch (e) {
    return response(500, {}, e.message, false)
  }
}


