import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import groupModel from "@/model/group-model"

export async function POST(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { groupId } = await req.json()
  const group = await groupModel.findById(groupId)
  if (!group) return response(404, {}, "Group not found", false)

  // Owner leaving transfers or blocks
  const isOwner = group.ownerId.toString() === session.user._id
  if (isOwner && group.members.length > 1) {
    // Promote the oldest admin/member to owner
    const nextOwner = group.members.find((m) => m.userId.toString() !== session.user._id)
    if (!nextOwner) return response(400, {}, "No member to transfer ownership", false)
    group.ownerId = nextOwner.userId
    group.members = group.members
      .filter((m) => m.userId.toString() !== session.user._id)
      .map((m) => (m.userId.toString() === nextOwner.userId.toString() ? { ...m.toObject(), role: "owner" } : m))
    await group.save()
    return response(200, {}, "Ownership transferred and left group", true)
  }

  // If single member owner, deleting group is better handled by delete endpoint
  group.members = group.members.filter((m) => m.userId.toString() !== session.user._id)
  await group.save()
  return response(200, {}, "Left group", true)
}


