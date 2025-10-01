import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import { response } from "@/util/response"
import cloudinary from "@/lib/cloudinary"

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { params } = await req.json() || {}
  // Folder scoping
  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || `messager/${session.user._id}`
  const timestamp = Math.floor(Date.now() / 1000)

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, ...params },
    process.env.CLOUDINARY_API_SECRET
  )

  return response(200, { 
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature
  }, "Signature generated", true)
}

