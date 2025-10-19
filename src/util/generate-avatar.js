/**
 * Generate avatar initials from username
 * @param {string} username - The username to generate initials from
 * @returns {string} - The generated initials
 */
export function generateAvatarInitials(username) {
  if (!username) return '?'
  
  // Clean the username and split by spaces and common separators
  const words = username.trim().toLowerCase().split(/[\s._-]+/).filter(word => word.length > 0)
  
  if (words.length === 1) {
    // Single word: take first character only
    return words[0].charAt(0).toUpperCase()
  } else {
    // Multiple words: take first character of first two words
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
  }
}

/**
 * Generate a color for the avatar based on username
 * @param {string} username - The username to generate color for
 * @returns {string} - The generated color class
 */
export function generateAvatarColor(username) {
  if (!username) return 'from-gray-400 to-gray-600'
  
  // Generate a consistent color based on username
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    'from-red-400 to-red-600',
    'from-orange-400 to-orange-600', 
    'from-yellow-400 to-yellow-600',
    'from-green-400 to-green-600',
    'from-teal-400 to-teal-600',
    'from-blue-400 to-blue-600',
    'from-indigo-400 to-indigo-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-rose-400 to-rose-600'
  ]
  
  return colors[Math.abs(hash) % colors.length]
}
