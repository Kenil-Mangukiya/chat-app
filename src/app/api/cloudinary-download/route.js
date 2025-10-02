import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import { response } from "@/util/response"
import { getCloudinaryConfig } from "@/lib/cloudinary"
import cloudinary from "cloudinary"

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return response(403, {}, "Not authorized", false)

    const { publicId, resourceType, deliveryType, accessMode, version, format, downloadName, expiresInSeconds } = await req.json()
    if (!publicId) return response(400, {}, "publicId is required", false)

    const cfg = getCloudinaryConfig()
    cloudinary.v2.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret,
      secure: true,
    })

    const lowerFormat = (format || "").toLowerCase()
    const rawFormats = new Set(["pdf","doc","docx","xls","xlsx","ppt","pptx","txt","csv","json","zip","rar","7z","xml","md","rtf","odt","ods","odp"]) 
    // Trust reported resourceType when present; only fall back to raw if unknown
    const resourceTypeToUse = resourceType || (lowerFormat && rawFormats.has(lowerFormat) ? "raw" : "image")
    const typeToUse = (deliveryType === "private" || deliveryType === "authenticated") 
      ? deliveryType 
      : (accessMode === "authenticated" ? "authenticated" : "upload")
    const expireAt = Math.floor(Date.now() / 1000) + (Number(expiresInSeconds) > 0 ? Number(expiresInSeconds) : 600)

    // Build a signed delivery URL. For documents, use resource_type raw.
    const url = cloudinary.v2.url(publicId, {
      resource_type: resourceTypeToUse,
      type: typeToUse,
      sign_url: true,
      secure: true,
      flags: "attachment",
      filename_override: downloadName || undefined,
      format: format || undefined,
      expires_at: expireAt,
      version: version || undefined,
    })

    return response(200, { url }, "Signed download URL generated", true)
  } catch (err) {
    return response(500, { error: err?.message }, "Failed to generate signed URL", false)
  }
}


