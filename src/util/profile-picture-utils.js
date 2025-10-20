// Utility functions for handling profile pictures

/**
 * Check if a profile picture URL is a local path that needs migration
 * @param {string} url - The profile picture URL
 * @returns {boolean} - True if it's a local path
 */
export const isLocalProfilePicture = (url) => {
  if (!url) return false
  return url.startsWith('/uploads/') || url.startsWith('uploads/')
}

/**
 * Check if a profile picture URL is a Cloudinary URL
 * @param {string} url - The profile picture URL
 * @returns {boolean} - True if it's a Cloudinary URL
 */
export const isCloudinaryUrl = (url) => {
  if (!url) return false
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com')
}

/**
 * Get a safe profile picture URL that handles both local and Cloudinary URLs
 * @param {string} url - The profile picture URL
 * @returns {string|null} - Safe URL or null if invalid
 */
export const getSafeProfilePictureUrl = (url) => {
  if (!url) return null
  
  // If it's already a Cloudinary URL, return as is
  if (isCloudinaryUrl(url)) {
    return url
  }
  
  // If it's a local path, return null to trigger fallback
  if (isLocalProfilePicture(url)) {
    return null
  }
  
  // For other URLs (external), return as is
  return url
}
