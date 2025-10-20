import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default cloudinary

// Helper function to upload image to Cloudinary
export const uploadToCloudinary = async (file, folder = 'chatly-profiles') => {
  try {
    let result
    
    if (Buffer.isBuffer(file)) {
      // For Buffer objects, use upload_stream
      result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: folder,
            resource_type: 'auto',
            quality: 'auto',
            fetch_format: 'auto',
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        ).end(file)
      })
    } else {
      // For file paths or data URIs, use regular upload
      result = await cloudinary.uploader.upload(file, {
        folder: folder,
        resource_type: 'auto',
        quality: 'auto',
        fetch_format: 'auto',
      })
    }
    
    return result
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error)
    throw error
  }
}

// Helper function to delete image from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId)
    return result
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error)
    throw error
  }
}

// Helper function to extract public ID from Cloudinary URL
export const extractPublicId = (url) => {
  if (!url) return null
  const parts = url.split('/')
  const filename = parts[parts.length - 1]
  const publicId = filename.split('.')[0]
  return `chatly-profiles/${publicId}`
}
