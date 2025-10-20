import { generateAvatarInitials } from "@/util/generate-avatar"
import { getSafeProfilePictureUrl } from "@/util/profile-picture-utils"
import { User } from "lucide-react"

export function Avatar({ 
  user, 
  size = "md", 
  showStatus = false, 
  status = "offline",
  className = "",
  onClick,
  showUserIcon = false
}) {
  const sizeClasses = {
    xs: "w-6 h-6 text-xs",
    sm: "w-8 h-8 text-sm", 
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
    xl: "w-16 h-16 text-xl"
  }

  const statusColors = {
    online: "bg-green-500",
    offline: "bg-gray-400", 
    away: "bg-yellow-500",
    busy: "bg-red-500"
  }

  const initials = generateAvatarInitials(user?.username || user?.name || "")
  // Use consistent purple background instead of random colors
  const colorClass = "from-purple-400 to-purple-600"
  
  // Only use explicit profilePicture; do NOT fallback to provider image
  const rawProfileUrl = user?.profilePicture
  // Get safe profile picture URL (handles local paths that cause 404s)
  const safeProfilePicture = getSafeProfilePictureUrl(rawProfileUrl)
  
  // Debug logging
  console.log('Avatar Debug:', {
    username: user?.username,
    originalUrl: rawProfileUrl,
    safeUrl: safeProfilePicture,
    showUserIcon: showUserIcon
  })

  return (
    <div className={`relative ${className}`} onClick={onClick}>
      {safeProfilePicture ? (
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden shadow-lg`}>
          <img
            src={safeProfilePicture}
            alt={`${user.username || user.name}'s avatar`}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              console.log('Image failed to load:', safeProfilePicture)
              // Fallback to user icon if image fails to load (404, network error, etc.)
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', safeProfilePicture)
            }}
          />
          <div 
            className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold shadow-lg hidden`}
          >
            {showUserIcon ? (
              <User size={size === "xs" ? 12 : size === "sm" ? 14 : size === "md" ? 16 : size === "lg" ? 18 : 20} />
            ) : (
              initials
            )}
          </div>
        </div>
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold shadow-lg`}>
          {showUserIcon ? (
            <User size={size === "xs" ? 12 : size === "sm" ? 14 : size === "md" ? 16 : size === "lg" ? 18 : 20} />
          ) : (
            initials
          )}
        </div>
      )}
      
      {showStatus && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColors[status]}`}></div>
      )}
    </div>
  )
}
