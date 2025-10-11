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
    console.log('Download request params:', { publicId, resourceType, deliveryType, accessMode, version, format, downloadName })
    if (!publicId) return response(400, {}, "publicId is required", false)

    const cfg = getCloudinaryConfig()
    console.log('Cloudinary config:', { cloudName: cfg.cloudName, hasApiKey: !!cfg.apiKey, hasApiSecret: !!cfg.apiSecret })
    
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
    
    // For raw files, always use authenticated type to ensure proper access
    const typeToUse = (resourceTypeToUse === "raw") 
      ? "authenticated" 
      : (deliveryType === "private" || deliveryType === "authenticated") 
        ? deliveryType 
        : (accessMode === "authenticated" ? "authenticated" : "upload")
    const expireAt = Math.floor(Date.now() / 1000) + (Number(expiresInSeconds) > 0 ? Number(expiresInSeconds) : 600)
    
    console.log('Processing logic:', { 
      lowerFormat, 
      isRawFormat: rawFormats.has(lowerFormat), 
      resourceTypeToUse, 
      typeToUse, 
      expireAt 
    })

    // Build a signed delivery URL. For documents, use resource_type raw.
    const urlOptions = {
      resource_type: resourceTypeToUse,
      type: typeToUse,
      sign_url: true,
      secure: true,
      expires_at: expireAt,
    }
    
    console.log('Initial URL options:', urlOptions)
    
    // Only add version if it's provided
    if (version) {
      urlOptions.version = version
      console.log('Added version to URL options:', version)
    }
    
    // Only add attachment flags for non-raw files
    if (resourceTypeToUse !== "raw") {
      urlOptions.flags = "attachment"
      urlOptions.filename_override = downloadName || undefined
      console.log('Added attachment flags for non-raw file')
    }
    
    // Add format if provided
    if (format) {
      urlOptions.format = format
      console.log('Added format to URL options:', format)
    }
    
    console.log('Final URL options:', urlOptions)
    const url = cloudinary.v2.url(publicId, urlOptions)

    console.log('Generated download URL:', url)
    console.log('URL params:', { resourceTypeToUse, typeToUse, expireAt })

    return response(200, { url }, "Signed download URL generated", true)
  } catch (err) {
    return response(500, { error: err?.message }, "Failed to generate signed URL", false)
  }
}


