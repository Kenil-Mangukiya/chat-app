import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import { response } from "@/util/response"
import { getCloudinaryConfig } from "@/lib/cloudinary"
import cloudinary from "cloudinary"

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return response(403, {}, "Not authorized", false)

    const requestBody = await req.json()
    const { publicId, resourceType, deliveryType, accessMode, version, format, downloadName, expiresInSeconds } = requestBody
    console.log('Download request params:', { publicId, resourceType, deliveryType, accessMode, version, format, downloadName })
    console.log('Full request body:', requestBody)
    if (!publicId) return response(400, {}, "publicId is required", false)
    
    // Extract version from publicId if it contains folder structure
    let actualPublicId = publicId
    let extractedVersion = version
    
    // If publicId contains folder structure like "messager/userId/filename", use it as is
    // If it's just "filename", we might need to reconstruct the full path
    console.log('Processing publicId:', actualPublicId)

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
    
    // For unsigned uploads, use upload type (public access)
    const typeToUse = deliveryType || (resourceTypeToUse === "raw" ? "upload" : "upload")
    const expireAt = Math.floor(Date.now() / 1000) + (Number(expiresInSeconds) > 0 ? Number(expiresInSeconds) : 600)
    
    console.log('Processing logic:', { 
      lowerFormat, 
      isRawFormat: rawFormats.has(lowerFormat), 
      resourceTypeToUse, 
      typeToUse, 
      expireAt 
    })

    // Build delivery URL. For unsigned uploads, no signature needed.
    const urlOptions = {
      resource_type: resourceTypeToUse,
      type: typeToUse,
      secure: true,
    }
    
    console.log('Initial URL options:', urlOptions)
    
    // Only add version if it's provided
    if (extractedVersion) {
      urlOptions.version = extractedVersion
      console.log('Added version to URL options:', extractedVersion)
    }
    
    // Add attachment flags for raw files (PDFs, documents) to ensure proper download
    // Raw files need fl_attachment flag to trigger download instead of inline display
    if (resourceTypeToUse === "raw") {
      // Sanitize filename to remove special characters that break Cloudinary URLs
      // Replace spaces, parentheses, brackets, quotes, and other special chars with underscores
      if (downloadName) {
        // Remove special characters that break Cloudinary URL parsing
        // Keep only alphanumeric, dots, hyphens, and underscores
        const safeName = downloadName.replace(/[^a-zA-Z0-9._-]/g, "_")
        urlOptions.flags = `attachment:${safeName}`
      } else {
        urlOptions.flags = "attachment"
      }
      console.log('Added attachment flags for raw file:', urlOptions.flags)
    }
    
    // Add format if provided
    if (format) {
      urlOptions.format = format
      console.log('Added format to URL options:', format)
    }
    
    console.log('Final URL options:', urlOptions)
    const url = cloudinary.v2.url(actualPublicId, urlOptions)

    console.log('Generated download URL:', url)
    console.log('URL params:', { resourceTypeToUse, typeToUse, expireAt })
    console.log('Public ID being used:', actualPublicId)

    return response(200, { 
      url, 
      type: typeToUse,
      resourceType: resourceTypeToUse
    }, "Signed download URL generated", true)
  } catch (err) {
    return response(500, { error: err?.message }, "Failed to generate signed URL", false)
  }
}


