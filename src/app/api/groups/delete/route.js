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
  if (group.ownerId.toString() !== session.user._id) return response(403, {}, "Only owner can delete group", false)

  await groupModel.findByIdAndDelete(groupId)
  return response(200, {}, "Group deleted", true)
}


