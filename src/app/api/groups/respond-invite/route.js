import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import groupModel from "@/model/group-model"
import groupInviteModel from "@/model/group-invite-model"
import { emitToUser } from "@/lib/socket-server"

export async function POST(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { inviteId, action } = await req.json()
  const invite = await groupInviteModel.findById(inviteId)
  if (!invite) return response(404, {}, "Invite not found", false)
  if (invite.inviteeId.toString() !== session.user._id) return response(403, {}, "Not your invite", false)

  if (invite.status !== "pending") return response(400, {}, "Invite already processed", false)

  if (action === "accept") {
    invite.status = "accepted"
    await invite.save()
    const updatedGroup = await groupModel.findByIdAndUpdate(invite.groupId, {
      $addToSet: { members: { userId: invite.inviteeId, role: "member" } },
    }, { new: true })
    
    // Emit group joined event to the user who accepted
    emitToUser(invite.inviteeId, "group_joined", updatedGroup)
    
    return response(200, {}, "Invite accepted", true)
  }

  if (action === "decline") {
    invite.status = "declined"
    await invite.save()
    return response(200, {}, "Invite declined", true)
  }

  return response(400, {}, "Invalid action", false)
}


