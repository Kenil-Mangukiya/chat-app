import crypto from "crypto"

const ensureEnv = (key) => {
  if (!process.env[key]) {
    console.warn(`[cloudinary] Missing env: ${key}`)
  }
}

ensureEnv("CLOUDINARY_CLOUD_NAME")
ensureEnv("CLOUDINARY_API_KEY")
ensureEnv("CLOUDINARY_API_SECRET")

export const getCloudinaryConfig = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER,
})

// Build Cloudinary signature without SDK
// Sort params alphabetically, join as key=value&..., append api_secret, sha1
export const signParams = (params, apiSecret) => {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")
  const toSign = `${sorted}${apiSecret ? apiSecret : ""}`
  return crypto.createHash("sha1").update(toSign).digest("hex")
}

export default { getCloudinaryConfig, signParams }

