"use client"
import { sendMessage } from '@/app/api/message-handler';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import socket from '@/lib/socket';
import { messageSchema } from '@/schema/message-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageCircle, Search, MoreVertical, Paperclip, Smile, Mic, Send, ChevronLeft, User, LogOut, UserPlus, Users, Copy, Delete, Users2, ArrowUpDown, ArrowUp, ArrowDown, Bot, UserMinus, Trash, Bell, Phone, Video } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { signOut, update } from "next-auth/react";
import { generateAvatarInitials, generateAvatarColor } from "@/util/generate-avatar";
import { getSafeProfilePictureUrl } from "@/util/profile-picture-utils";
import { Avatar } from "@/components/ui/avatar";
import { ChatlyLoader } from "@/components/ui/chatly-loader";


export default function ChatlyUI() {
  // Add CSS for search highlight animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .search-highlight {
        animation: searchBlink 2s ease-in-out;
        background-color: #fef3c7image.png !important;
        border-radius: 8px;
        transition: all 0.3s ease;
      }
      
      @keyframes searchBlink {
        0% { background-color: transparent; }
        20% { background-color: #fef3c7; }
        40% { background-color: transparent; }
        60% { background-color: #fef3c7; }
        80% { background-color: transparent; }
        100% { background-color: transparent; }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [editableUsername, setEditableUsername] = useState('');
  const [shouldRemoveProfilePicture, setShouldRemoveProfilePicture] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState('');
  const [readMessages, setReadMessages] = useState(new Set());
  const [activeUsers, setActiveUsers] = useState(new Set());
  const [friendsWithReadMessages, setFriendsWithReadMessages] = useState(new Set());
  const [friends, setFriends] = useState([]);
  // Mobile navigation state
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  
  // Mobile responsive state management
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  // Three dots menu state
  const [showChatOptionsMenu, setShowChatOptionsMenu] = useState(false);
  // Tracks when a chat was cleared for the current user; key is receiverId (friendId or group_*)
  const [clearedAtMap, setClearedAtMap] = useState(() => {
    try { return JSON.parse(typeof window !== 'undefined' ? (sessionStorage.getItem('clearedAtMap') || '{}') : '{}') } catch { return {} }
  });
  const [activeChat, setActiveChat] = useState(null);
  // Keep a live ref of activeChat to avoid stale closures inside socket handlers
  const activeChatRef = useRef(null);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);
  // Short-lived dedupe cache for notification events to avoid double counts
  const recentNotificationsRef = useRef(new Set());
  const isDuplicateNotification = (key) => {
    if (recentNotificationsRef.current.has(key)) return true;
    recentNotificationsRef.current.add(key);
    setTimeout(() => recentNotificationsRef.current.delete(key), 2000);
    return false;
  };
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const [friendsListKey, setFriendsListKey] = useState(0);
  const [forceRerender, setForceRerender] = useState(0);
  const { data: session, update } = useSession();
  const [sessionData, setSessionData] = useState(session);
  const router = useRouter();

  // Sync session data with local state
  useEffect(() => {
    setSessionData(session);
  }, [session]);

  // Screen size detection for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobileView(isMobile);
      if (!isMobile) {
        setShowMobileSidebar(true);
        setIsMobileChatOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Close chat options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChatOptionsMenu && !event.target.closest('.chat-options-menu')) {
        setShowChatOptionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showChatOptionsMenu]);

  // Mobile view detection and responsive logic
  useEffect(() => {
    const checkMobileView = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobileView(isMobile);
      if (isMobile) {
        setShowMobileSidebar(true);
      }
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Handle mobile chat selection
  const handleMobileChatSelect = (chatId) => {
    setActiveChat(chatId);
    if (isMobileView) {
      setShowMobileSidebar(false);
    }
  };

  // Handle mobile back to sidebar
  const handleMobileBackToSidebar = () => {
    setActiveChat(null);
    setMessages([]);
    window.history.pushState(null, '', '/');
    receiverId.current = null;
    setNewMessageCounts({});
    setTotalNewMessages(0);
    if (isMobileView) {
      setShowMobileSidebar(true);
    }
  };

  // Listen for session update events
  useEffect(() => {
    const handleSessionUpdate = (event) => {
      const updatedUser = event.detail.user;
      if (updatedUser) {
        setSessionData(prev => ({
          ...prev,
          user: updatedUser
        }));
      }
    };

    window.addEventListener('session-update', handleSessionUpdate);
    return () => window.removeEventListener('session-update', handleSessionUpdate);
  }, []);

  // Force re-render when friends list changes
  useEffect(() => {
    console.log('Friends list changed, forcing re-render:', friends.length);
    setForceRerender(prev => prev + 1);
  }, [friends]);

  // Listen for profile updates from other users
  useEffect(() => {
    const handleProfileUpdate = (data) => {
      console.log('Profile updated for user:', data);
      console.log('Updating friends list for user:', data.userId);
      // Update friends list if the updated user is in the friends list
      setFriends(prevFriends => {
        console.log('Current friends before update:', prevFriends.map(f => ({ id: f.friendid, username: f.friendusername, profilePicture: f.friendprofilepicture })));
        const updatedFriends = prevFriends.map(friend => {
          console.log('Checking friend:', friend.friendid, 'against userId:', data.userId, 'match:', friend.friendid === data.userId);
          if (friend.friendid === data.userId) {
            console.log('Updating friend:', friend.friendusername, 'with new data:', data);
            return { ...friend, friendusername: data.username, friendprofilepicture: data.profilePicture };
          }
          return friend;
        });
        console.log('Updated friends list:', updatedFriends.map(f => ({ id: f.friendid, username: f.friendusername, profilePicture: f.friendprofilepicture })));
        
        // Force multiple re-renders
        setAvatarRefreshKey(prev => prev + 1);
        setFriendsListKey(prev => prev + 1);
        setForceRerender(prev => prev + 1);
        
        // Force additional re-renders
        setTimeout(() => {
          setAvatarRefreshKey(prev => prev + 1);
          setFriendsListKey(prev => prev + 1);
          setForceRerender(prev => prev + 1);
        }, 50);
        
        setTimeout(() => {
          setAvatarRefreshKey(prev => prev + 1);
          setFriendsListKey(prev => prev + 1);
          setForceRerender(prev => prev + 1);
        }, 150);
        
        return updatedFriends;
      });
    };

    const handleFriendProfileUpdate = (data) => {
      console.log('Friend profile updated:', data);
      
      // Update friends list with the updated friend data
      setFriends(prevFriends => {
        console.log('Current friends before update:', prevFriends.map(f => ({ id: f.friendid, username: f.friendusername, profilePicture: f.friendprofilepicture })));
        const updatedFriends = prevFriends.map(friend => {
          console.log('Checking friend:', friend.friendid, 'against friendId:', data.friendId, 'match:', friend.friendid === data.friendId);
          if (friend.friendid === data.friendId) {
            console.log('Updating friend in handleFriendProfileUpdate:', friend.friendusername, 'with new data:', data);
            return { ...friend, friendusername: data.username, friendprofilepicture: data.profilePicture };
          }
          return friend;
        });
        console.log('Updated friends after profile change:', updatedFriends.map(f => ({ id: f.friendid, username: f.friendusername, profilePicture: f.friendprofilepicture })));
        setAvatarRefreshKey(prev => prev + 1);
        setFriendsListKey(prev => prev + 1);
        setForceRerender(prev => prev + 1);
        // Force a re-render by updating the state with a new reference
        setTimeout(() => {
          setAvatarRefreshKey(prev => prev + 1);
          setFriendsListKey(prev => prev + 1);
          setForceRerender(prev => prev + 1);
        }, 100);
        return updatedFriends;
      });
      
      // Also update groups list if the user is in any groups
      setGroups(prevGroups => 
        prevGroups.map(group => ({
          ...group,
          members: group.members.map(member => 
            member._id === data.friendId 
              ? { ...member, username: data.username, profilePicture: data.profilePicture }
              : member
          )
        }))
      );
    };

    if (socket) {
      console.log('Setting up profile update listeners');
      socket.on('profile_updated', handleProfileUpdate);
      socket.on('friend_profile_updated', handleFriendProfileUpdate);
      
      // Add debugging for all socket events
      socket.onAny((eventName, ...args) => {
        if (eventName === 'profile_updated' || eventName === 'friend_profile_updated') {
          console.log(`Socket event received: ${eventName}`, args);
        }
      });
      
      return () => {
        socket.off('profile_updated', handleProfileUpdate);
        socket.off('friend_profile_updated', handleFriendProfileUpdate);
      };
    }
  }, [socket]);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const searchParams = useSearchParams();
  const receiverId = useRef();
  const [enableSend, setEnableSend] = useState(false);
  const bottomRef = useRef();
  const [showEmojiPicker,setShowEmojiPicker] = useState(false)
  const [searchValue,setSearchValue] = useState("")
  const [filteredFriends,setFilteredFriends] = useState([])
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [sortOrder, setSortOrder] = useState('name'); // 'name', 'recent', 'unread'
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [status, setStatus] = useState("offline")
  const [userStatus, setUserStatus] = useState({}) // Track status of all users
  const [isTyping, setIsTyping] = useState(false)
  const [newMessages,setNewMessages] = useState([])
  const [newMessageCounts, setNewMessageCounts] = useState(() => {
    // Try to restore from sessionStorage on component mount
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('newMessageCounts');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  }) // Track new message counts per sender
  const [totalNewMessages, setTotalNewMessages] = useState(() => {
    // Try to restore from sessionStorage on component mount
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('totalNewMessages');
      return saved ? parseInt(saved) : 0;
    }
    return 0;
  }) // Total count for chat icon
  const [isProcessingMessage, setIsProcessingMessage] = useState(false) // Prevent duplicate processing
  const socketListenersRegistered = useRef(false) // Track if socket listeners are registered
  const processingNotification = useRef(false) // Track if notification is being processed
  const uploadAbortController = useRef(null) // Track upload request for cancellation
  const shownNotificationsRef = useRef(new Set()) // Track shown notifications to prevent duplicates
  // File upload UI state
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  // Preview and pending upload state
  const [pendingAttachment, setPendingAttachment] = useState(null)
  const [uploadingFile, setUploadingFile] = useState(null)

  // Persist notification updates across reloads, respecting dismissals
  const saveGlobalNotifications = (items) => {
    try { sessionStorage.setItem('globalNotifications', JSON.stringify(items || [])) } catch {}
  }
  const loadGlobalNotifications = () => {
    try { return JSON.parse(sessionStorage.getItem('globalNotifications') || '[]') } catch { return [] }
  }

  const openFilePicker = (accept) => {
    if (!fileInputRef.current) return
    fileInputRef.current.value = ""
    fileInputRef.current.setAttribute('accept', accept)
    fileInputRef.current.click()
  }

  const getCloudinarySignature = async (resourceType = 'image') => {
    const res = await fetch('/api/cloudinary-sign', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: {}, resourceType }) 
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Signature failed')
    return data.data
  }


  const handlePickFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check if file is empty
    if (file.size === 0) {
      const fileName = file.name || 'file'
      const fileBaseName = fileName.split('.')[0] || 'document'
      toast.error(`${fileBaseName} is empty`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      })
      // Clear the file input
      e.target.value = ''
      return
    }
    
    // Clean up previous preview URL if exists
    if (pendingAttachment?.url) {
      URL.revokeObjectURL(pendingAttachment.url)
    }
    
    // Create preview object
    const preview = {
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      type: file.type,
      isImage: file.type.startsWith('image/'),
      isVideo: file.type.startsWith('video/'),
      isAudio: file.type.startsWith('audio/'),
      isDocument: !file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')
    }
    
    setPendingAttachment(preview)
    setShowAttachMenu(false)
  }

  const uploadFileToCloudinary = async (file) => {
    try {
      // Check if file is empty before uploading
      if (!file || file.size === 0) {
        const fileName = file?.name || 'file'
        const fileBaseName = fileName.split('.')[0] || 'document'
        toast.error(`${fileBaseName} is empty`, {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        })
        throw new Error('File is empty')
      }
      
      setIsUploading(true)
      setUploadingFile(file)
      setUploadProgress(0)
      
      // Create abort controller for cancellation
      uploadAbortController.current = { controller: new AbortController(), xhr: null }
      
      // Determine resource type based on file type
      const fileType = file.type.toLowerCase()
      let resourceType = 'image' // default
      
      if (fileType.startsWith('video/')) {
        resourceType = 'video'
      } else if (fileType.startsWith('audio/')) {
        resourceType = 'video' // Cloudinary uses 'video' for audio files
      } else if (fileType === 'application/pdf' || 
                 fileType.includes('document') || 
                 fileType.includes('text') ||
                 fileType.includes('application/') ||
                 fileType.includes('spreadsheet') ||
                 fileType.includes('presentation') ||
                 fileType.includes('zip') ||
                 fileType.includes('rar') ||
                 fileType.includes('7z') ||
                 fileType.includes('json') ||
                 fileType.includes('xml') ||
                 fileType.includes('csv') ||
                 fileType.includes('rtf') ||
                 fileType.includes('odt') ||
                 fileType.includes('ods') ||
                 fileType.includes('odp')) {
        resourceType = 'raw'
      }

      // Get cloud name from server (required for both raw and signed uploads)
      // For raw files, we still need cloudName from server, but skip signature generation
      const signatureData = await getCloudinarySignature(resourceType)
      const { cloudName } = signatureData
      
      
      // Create FormData
      const form = new FormData()
      form.append('file', file)
      // DO NOT append resource_type to form - it's already in the URL
      
      if (resourceType === 'raw') {
        // ✅ Unsigned upload for documents - use cloudName from server but skip signature
        form.append('upload_preset', 'chat_app')
        form.append('folder', 'chat_uploads')
        
      } else {
        // ✅ Signed upload for images/videos
        const { apiKey, timestamp, signature, folder } = signatureData
        form.append('api_key', apiKey)
        form.append('timestamp', timestamp)
        form.append('signature', signature)
        form.append('folder', folder)
        
      }

      const xhr = new XMLHttpRequest()
      const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
      
      
      // Store xhr reference for cancellation BEFORE starting the request
      if (uploadAbortController.current) {
        uploadAbortController.current.xhr = xhr
      }
      
      const promise = new Promise((resolve, reject) => {
        xhr.open('POST', url)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            console.error('Upload failed with status:', xhr.status)
            console.error('Response:', xhr.responseText)
            reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`))
          }
        }
        xhr.onerror = () => reject(new Error('Upload error'))
        xhr.onabort = () => reject(new Error('Upload cancelled'))
        xhr.send(form)
      })
      const result = await promise
      
      const attachment = {
        url: result.secure_url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        pageCount: result.pages,
        originalFilename: result.original_filename,
        thumbnailUrl: result.secure_url
      }
      
      return attachment
    } catch (err) {
      // Don't show error toast for cancelled uploads
      if (err.message !== 'Upload cancelled') {
      toast.error('Upload failed')
      }
      throw err
    } finally {
      setIsUploading(false)
      setUploadingFile(null)
      setUploadProgress(0)
      uploadAbortController.current = null
    }
  }

  const sendMessageWithAttachment = async () => {
    if (!pendingAttachment || !receiverId.current || !sessionData?.user?._id) return
    
    try {
      const attachment = await uploadFileToCloudinary(pendingAttachment.file)
      
      // Send as a message with empty content but with attachment
      socket.emit('send_message', {
        senderid: session.user._id,
        receiverid: receiverId.current,
        content: '',
        attachment,
        messageType: 'attachment'
      })
      
      // Clear pending attachment and clean up object URL
      if (pendingAttachment?.url) {
        URL.revokeObjectURL(pendingAttachment.url)
      }
      setPendingAttachment(null)
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      // Don't log error for cancelled uploads
      if (err.message !== 'Upload cancelled') {
      console.error('Failed to send message with attachment:', err)
      }
    }
  }

  const sendGroupMessage = async (groupId, content) => {
    try {
      const response = await fetch('/api/groups/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, content })
      })
      const data = await response.json()
      if (data.success) {
        // Add message to local state immediately
        setMessages(prev => [...prev, data.data.message])
      }
    } catch (err) {
      console.error('Failed to send group message:', err)
    }
  }

  const sendGroupMessageWithAttachment = async (groupId) => {
    if (!pendingAttachment || !sessionData?.user?._id) return
    
    try {
      const attachment = await uploadFileToCloudinary(pendingAttachment.file)
      
      const response = await fetch('/api/groups/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          groupId, 
          content: '', 
          attachment,
          messageType: 'attachment'
        })
      })
      const data = await response.json()
      if (data.success) {
        // Add message to local state immediately
        setMessages(prev => [...prev, data.data.message])
      }
      
      // Clear pending attachment and clean up object URL
      if (pendingAttachment?.url) {
        URL.revokeObjectURL(pendingAttachment.url)
      }
      setPendingAttachment(null)
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Failed to send group message with attachment:', err)
    }
  }
  const [processedMessages, setProcessedMessages] = useState(new Set()) // Track processed message IDs
  const [showSearchModal, setShowSearchModal] = useState(false) // Search modal state
  const [searchQuery, setSearchQuery] = useState("") // Search query
  const [searchResults, setSearchResults] = useState([]) // Search results
  
  // Add Friend Modal State
  const [showAddFriendModal, setShowAddFriendModal] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [friendRequestLoading, setFriendRequestLoading] = useState({})
  const [friendSearchQuery, setFriendSearchQuery] = useState("")
  const [lastNotificationTime, setLastNotificationTime] = useState({})
  const [processingNotifications, setProcessingNotifications] = useState(new Set())
  const processingRef = useRef(new Set())
  const [blockLoading, setBlockLoading] = useState({})
  const [removeLoading, setRemoveLoading] = useState({})
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false)
  const [friendToRemove, setFriendToRemove] = useState(null)
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState(null)

  // Fetch all users for add friend modal
  const fetchAllUsers = async () => {
    try {
      setLoadingUsers(true)
      const response = await fetch('/api/users/list')
      const data = await response.json()
      if (data.success) {
        console.log('Fetched users with status:', data.data.users)
        setAllUsers(data.data.users)
      } else {
        console.error('API Error:', data.message)
        toast.error('Failed to load users: ' + (data.message || 'Unknown error'))
        setAllUsers([])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users. Please try again.')
      setAllUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  // Handle opening add friend modal
  const handleOpenAddFriendModal = () => {
    setShowAddFriendModal(true)
    setFriendSearchQuery("")
    fetchAllUsers()
  }

  // Handle closing add friend modal
  const handleCloseAddFriendModal = () => {
    setShowAddFriendModal(false)
    setFriendSearchQuery("")
  }

  // Filter users based on search query and sort by username
  const filteredUsers = allUsers
    .filter(user => 
      user.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(friendSearchQuery.toLowerCase())
    )
    .sort((a, b) => a.username.localeCompare(b.username))

  // Handle blocking/unblocking friend
  const handleBlockFriend = async (friendId, action) => {
    try {
      setBlockLoading(prev => ({ ...prev, [friendId]: true }))
      
      const response = await fetch('/api/block-friend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          friendId,
          action
        })
      })

      const data = await response.json()

      if (data.success) {
        // Refresh friends list to get updated block status
        socket.emit("get_friends", session.user._id)
        
        // Refresh users list in add friend modal if it's open
        if (showAddFriendModal) {
          fetchAllUsers()
        }
        
        toast.success(data.message)
        
        // Send notification to the friend about block/unblock
        const notificationMessage = data.data.action === 'block' 
          ? `${data.data.blockerUsername} has blocked you`
          : `${data.data.blockerUsername} has unblocked you`
        
        console.log("Sending friend block notification:", {
          receiverId: friendId,
          blockerUsername: data.data.blockerUsername,
          action: data.data.action,
          message: notificationMessage
        })
        
        socket.emit("friend_block_notification", {
          receiverId: friendId,
          blockerUsername: data.data.blockerUsername,
          action: data.data.action,
          message: notificationMessage
        })
      } else {
        toast.error(data.message || 'Failed to update friend status')
      }
    } catch (error) {
      console.error('Error blocking/unblocking friend:', error)
      toast.error('Failed to update friend status')
    } finally {
      setBlockLoading(prev => ({ ...prev, [friendId]: false }))
    }
  }

  // Handle removing friend
  const handleRemoveFriend = async (friendId, friendUsername) => {
    setFriendToRemove({ id: friendId, username: friendUsername })
    setShowRemoveConfirmModal(true)
  }

  // Confirm friend removal
  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return

    try {
      setRemoveLoading(prev => ({ ...prev, [friendToRemove.id]: true }))
      
      const response = await fetch('/api/remove-friend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          friendId: friendToRemove.id
        })
      })

      const data = await response.json()

      if (data.success) {
        // Refresh friends list
        socket.emit("get_friends", session.user._id)
        
        // Refresh users list in add friend modal if it's open
        if (showAddFriendModal) {
          fetchAllUsers()
        }
        
        // If we're currently chatting with this friend, go back to main screen
        if (receiverId.current === friendToRemove.id) {
          setActiveChat(null)
          setMessages([])
          window.history.pushState(null, '', '/')
          receiverId.current = null
        }
        
        toast.success(data.message)
        
        // Send notification to the removed friend
        console.log("Sending friend removal notification:", {
          receiverId: friendToRemove.id,
          removerUsername: data.data.removerUsername,
          message: `${data.data.removerUsername} has removed you from friends`
        })
        
        socket.emit("friend_removed_notification", {
          receiverId: friendToRemove.id,
          removerUsername: data.data.removerUsername,
          message: `${data.data.removerUsername} has removed you from friends`
        })
      } else {
        toast.error(data.message || 'Failed to remove friend')
      }
    } catch (error) {
      console.error('Error removing friend:', error)
      toast.error('Failed to remove friend')
    } finally {
      setRemoveLoading(prev => ({ ...prev, [friendToRemove.id]: false }))
      setShowRemoveConfirmModal(false)
      setFriendToRemove(null)
    }
  }

  // Handle sending friend request
  const handleSendFriendRequest = async (userId, username) => {
    try {
      setFriendRequestLoading(prev => ({ ...prev, [userId]: true }))
      
      const response = await fetch('/api/send-friend-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
      })
      
      const data = await response.json()
      if (data.success) {
        // Update user status to 'sent'
        setAllUsers(prev => prev.map(user => 
          user._id === userId ? { ...user, status: 'sent' } : user
        ))
        toast.success(`Friend request sent to ${username}`)
        
        // No need to refresh the user list - the status is already updated above
      } else {
        toast.error(data.message || 'Failed to send friend request')
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      toast.error('Failed to send friend request')
    } finally {
      setFriendRequestLoading(prev => ({ ...prev, [userId]: false }))
    }
  }
  const [isSearchActive, setIsSearchActive] = useState(false) // Inline search state
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0) // Current search result index
  const [showNotifications, setShowNotifications] = useState(false) // Notification dropdown state
  const [notifications, setNotifications] = useState([]) // Notification messages
  const [friendRequests, setFriendRequests] = useState([]) // Friend requests
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groups, setGroups] = useState([])
  const [newGroupName, setNewGroupName] = useState("")
  const [selectedInviteeIds, setSelectedInviteeIds] = useState([])
  const [groupSubmitAttempted, setGroupSubmitAttempted] = useState(false)
  const [groupSearch, setGroupSearch] = useState("")
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupFilteredFriends, setGroupFilteredFriends] = useState([])
  const [groupNameServerError, setGroupNameServerError] = useState("")
  const [isMuted, setIsMuted] = useState(false) // Mute notifications state
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false)
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false)
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false)
  const [isDeletingGroup, setIsDeletingGroup] = useState(false)
  const [isLeavingGroup, setIsLeavingGroup] = useState(false)

  // Helper function to deduplicate groups
  const deduplicateGroups = (groups) => {
    const seen = new Set()
    return groups.filter(group => {
      if (seen.has(group._id)) {
        return false
      }
      seen.add(group._id)
      return true
    })
  }

  // Function to mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      })
    } catch (e) {
      console.error('Error marking notification as read:', e)
    }
  }

  // Function to delete notification from database
  const deleteNotification = async (notificationId) => {
    try {
      // Only delete from database if it's a real database notification (MongoDB ObjectId format)
      if (notificationId && notificationId.length === 24 && /^[0-9a-fA-F]{24}$/.test(notificationId)) {
        await fetch('/api/notifications', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId })
        })
      }
    } catch (e) {
      console.error('Error deleting notification:', e)
    }
  }

  // Function to toggle mute notifications
  const toggleMuteNotifications = () => {
    setIsMuted(!isMuted)
    // Store mute state in localStorage
    const muteKey = `muted_${receiverId.current}`
    localStorage.setItem(muteKey, (!isMuted).toString())
  }

  // Function to show delete group modal
  const showDeleteGroupConfirmation = () => {
    setShowDeleteGroupModal(true)
  }

  // Function to show leave group confirmation modal
  const showLeaveGroupConfirmation = () => {
    setShowLeaveGroupModal(true)
  }

  // Function to show group members modal
  const showGroupMembers = () => {
    setShowGroupMembersModal(true)
  }

  // Function to confirm delete group
  const confirmDeleteGroup = async () => {
    if (!receiverId.current?.startsWith('group_')) return
    
    const groupId = receiverId.current.replace('group_', '')
    
    try {
      setIsDeletingGroup(true)
      const res = await fetch('/api/groups/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId })
      })
      const data = await res.json()
      
      if (data.success) {
        setShowDeleteGroupModal(false)
        
        // Remove the group from groups list immediately
        setGroups(prev => prev.filter(g => {
          const gid = (g?._id && g._id.toString) ? g._id.toString() : g?._id
          return gid !== groupId
        }))
        
        // Navigate back to main screen
        receiverId.current = null
        setActiveChat(null)
        setMessages([])
        
        // Toast after state updates to avoid race with unmounting
        setTimeout(() => toast.success("Group deleted successfully"), 0)
      } else {
        toast.error(data.message || "Failed to delete group")
      }
    } catch (e) {
      console.error('Error deleting group:', e)
      toast.error("Failed to delete group")
    }
    finally {
      setIsDeletingGroup(false)
    }
  }

  // Function to confirm leave group
  const confirmLeaveGroup = async () => {
    if (!receiverId.current?.startsWith('group_')) return
    
    const groupId = receiverId.current.replace('group_', '')
    
    try {
      setIsLeavingGroup(true)
      const res = await fetch('/api/groups/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId })
      })
      const data = await res.json()
      
      if (data.success) {
        setShowLeaveGroupModal(false)
        
        // Remove the group from groups list immediately
        setGroups(prev => prev.filter(g => {
          const gid = (g?._id && g._id.toString) ? g._id.toString() : g?._id
          return gid !== groupId
        }))
        
        // Navigate back to main screen
        receiverId.current = null
        setActiveChat(null)
        setMessages([])
        // Toast after UI state updates
        setTimeout(() => toast.success("Left group successfully"), 0)
      } else {
        toast.error(data.message || "Failed to leave group")
      }
    } catch (e) {
      console.error('Error leaving group:', e)
      toast.error("Failed to leave group")
    }
    finally {
      setIsLeavingGroup(false)
    }
  }
  const notificationRef = useRef(null)
  const emojiPickerRef = useRef(null)
  const profileFileInputRef = useRef(null)

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setProfilePicture(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfilePicturePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveProfilePicture = () => {
    console.log('Removing profile picture preview...')
    setProfilePicture(null)
    setProfilePicturePreview(null)
    setShouldRemoveProfilePicture(true)
    if (profileFileInputRef.current) {
      profileFileInputRef.current.value = ''
    }
    console.log('Profile picture preview removed')
    
    // Force multiple re-renders to ensure state updates are applied
    setTimeout(() => {
      setForceRerender(prev => prev + 1)
    }, 50)
    
    setTimeout(() => {
      setForceRerender(prev => prev + 1)
    }, 150)
  }

  // Username validation functions
  const validateUsername = (username) => {
    if (!username || username.trim().length === 0) {
      return 'Username is required'
    }
    if (username.trim().length < 3) {
      return 'Username must be at least 3 characters long'
    }
    if (!/^[a-zA-Z_]+$/.test(username.trim())) {
      return 'Username can only contain letters and underscores'
    }
    return null
  }

  const checkUsernameAvailability = async (username) => {
    if (!username || username.trim().length === 0) return false
    
    try {
      setIsCheckingUsername(true)
      const response = await axios.post(`/api/unique-username?username=${encodeURIComponent(username.trim())}`)
      return response.data.success
    } catch (error) {
      console.error('Error checking username availability:', error)
      // If it's a 403 error, it means username is taken
      if (error.response?.status === 403) {
        return false // Username is taken
      }
      return false
    } finally {
      setIsCheckingUsername(false)
    }
  }

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value
    setEditableUsername(newUsername)
    // Clear errors when user types
    setUsernameError('')
    setUsernameStatus('')
  }

  // Function to mark messages as read
  const markMessagesAsRead = async (senderId) => {
    console.log('🔵 MARKING MESSAGES AS READ:', { senderId, currentUser: sessionData?.user?._id });
    
    if (!senderId || !sessionData?.user?._id) {
      console.log('❌ MISSING SENDER ID OR USER ID');
      return;
    }
    
    // Update local state immediately for instant UI feedback
    setMessages(prevMessages => {
      console.log('🔍 CURRENT MESSAGES BEFORE MARKING:', prevMessages.length, 'messages');
      console.log('🔍 LOOKING FOR MESSAGES FROM:', sessionData.user._id, 'TO:', senderId);
      
      const updatedMessages = prevMessages.map(msg => {
        if (msg.senderid === sessionData.user._id && msg.receiverid === senderId) {
          console.log('✅ MARKING MESSAGE AS READ:', msg.content, '(ID:', msg._id, ')');
          return { ...msg, readStatus: { isRead: true, readAt: new Date() } };
        }
        return msg;
      });
      
      const readCount = updatedMessages.filter(m => m.readStatus?.isRead).length;
      console.log('📝 UPDATED MESSAGES COUNT:', readCount);
      
      if (readCount === 0) {
        console.log('⚠️ NO MESSAGES FOUND TO MARK AS READ');
        console.log('📊 ALL MESSAGES:', prevMessages.map(m => ({
          id: m._id,
          content: m.content,
          senderid: m.senderid,
          receiverid: m.receiverid
        })));
      }
      
      return updatedMessages;
    });
    
    try {
      console.log('🌐 CALLING API TO MARK MESSAGES AS READ...');
      const response = await axios.put('/api/mark-messages-read', { senderId });
      console.log('📡 API RESPONSE:', response.data);
      
      if (!response.data.success) {
        console.log('❌ API FAILED, REVERTING LOCAL STATE');
        // If API fails, revert the local state
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.senderid === senderId && msg.receiverid === sessionData.user._id
              ? { ...msg, readStatus: { isRead: false, readAt: null } }
              : msg
          )
        )
      } else {
        console.log('✅ API SUCCESS, READ STATUS PERSISTED');
      }
    } catch (error) {
      console.error('❌ ERROR MARKING MESSAGES AS READ:', error);
      // Revert local state on error
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.senderid === senderId && msg.receiverid === sessionData.user._id
            ? { ...msg, readStatus: { isRead: false, readAt: null } }
            : msg
        )
      )
    }
  }


  // Function to format date for display
  const formatMessageDate = (date) => {
    const messageDate = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    // Reset time to compare only dates
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    
    if (messageDateOnly.getTime() === todayOnly.getTime()) {
      return 'Today'
    } else if (messageDateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday'
    } else {
      return messageDate.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })
    }
  }

  // Function to group messages by date
  const groupMessagesByDate = (messages) => {
    const grouped = []
    let currentDate = null
    
    messages.forEach((message, index) => {
      const messageDate = new Date(message.createdAt || Date.now())
      const dateKey = messageDate.toDateString()
      
      if (currentDate !== dateKey) {
        currentDate = dateKey
        grouped.push({
          type: 'date',
          date: formatMessageDate(messageDate),
          key: `date-${dateKey}`
        })
      }
      
      grouped.push({
        ...message,
        type: 'message',
        key: `message-${index}`
      })
    })
    
    return grouped
  }

  const updateProfile = async () => {
    try {
      setIsUpdatingProfile(true)
      
      // Validate username before submitting
      const usernameValidationError = validateUsername(editableUsername)
      if (usernameValidationError) {
        setUsernameError(usernameValidationError)
        setIsUpdatingProfile(false)
        return
      }

      // Check if username is different and available
      if (editableUsername.trim().toLowerCase() !== sessionData?.user?.username?.toLowerCase()) {
        const isAvailable = await checkUsernameAvailability(editableUsername)
        if (!isAvailable) {
          setUsernameError('Username is already taken')
          setIsUpdatingProfile(false)
          return
        }
      }
      
      const formData = new FormData()
      formData.append('username', editableUsername)
      if (profilePicture) {
        formData.append('profilePicture', profilePicture)
      } else if (shouldRemoveProfilePicture) {
        // If user explicitly removed the profile picture
        formData.append('removeProfilePicture', 'true')
      }
      
      const response = await axios.put('/api/update-profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      if (response.data.success) {
        toast.success('Profile updated successfully!')
        setShowProfileModal(false)
        setProfilePicture(null)
        setProfilePicturePreview(null)
        setShouldRemoveProfilePicture(false)
        
        // Refresh the session with updated data
        try {
          const sessionResponse = await axios.post('/api/refresh-session')
          if (sessionResponse.data.success) {
            // Update the session data in the client
            const updatedUserData = sessionResponse.data.data
            
            // Update the session using NextAuth's update method
            await update({
              user: updatedUserData
            })
            // Proactively sync local sessionData consumers
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('session-update', { detail: { user: updatedUserData } }))
            }
          }
        } catch (sessionError) {
          console.error('Error refreshing session:', sessionError)
          // Fallback to page refresh if session update fails
          window.location.reload()
        }
      } else {
        toast.error(response.data.message || 'Failed to update profile')
        // If it's a username error, show it in the UI
        if (response.data.message?.includes('Username')) {
          setUsernameError(response.data.message)
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      const errorMessage = error.response?.data?.message || 'Failed to update profile'
      toast.error(errorMessage)
      
      // If it's a username error, show it in the UI
      if (errorMessage.includes('Username')) {
        setUsernameError(errorMessage)
      }
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Initialize editable username when modal opens
  useEffect(() => {
    if (showProfileModal && sessionData?.user?.username) {
      setEditableUsername(sessionData.user.username)
      // Reset profile picture state when modal opens
      setProfilePicture(null)
      setProfilePicturePreview(null)
      setShouldRemoveProfilePicture(false)
      // Reset validation errors
      setUsernameError('')
      setUsernameStatus('')
    }
  }, [showProfileModal, sessionData?.user?.username])

  // Mark messages as read when chat is opened (only for single friend chats)
  useEffect(() => {
    console.log('🚀 CHAT OPENED:', { activeChat, isGroup: activeChat?.startsWith('group_'), userId: sessionData?.user?._id });
    
    if (activeChat && !activeChat.startsWith('group_') && sessionData?.user?._id) {
      console.log('👤 OPENING FRIEND CHAT - MARKING MESSAGES AS READ');
      
      // Emit that user joined the chat
      socket.emit('user_joined_chat', { 
        userId: sessionData.user._id, 
        chatId: activeChat 
      });
      console.log('📡 EMITTED user_joined_chat');
      
      // Note: markMessagesAsRead will be called after messages are loaded
      
      // Also add the current user to active users for this chat
      setActiveUsers(prev => {
        const newSet = new Set([...prev, sessionData.user._id]);
        console.log('👥 ACTIVE USERS UPDATED:', Array.from(newSet));
        return newSet;
      });
    } else if (activeChat && activeChat.startsWith('group_')) {
      console.log('👥 OPENING GROUP CHAT');
      // For group chats, just emit join
      socket.emit('user_joined_chat', { 
        userId: sessionData?.user?._id, 
        chatId: activeChat 
      });
      console.log('📡 EMITTED user_joined_chat for group');
    }
  }, [activeChat, sessionData?.user?._id])

  // Clean up when user leaves chat
  useEffect(() => {
    return () => {
      if (activeChat && sessionData?.user?._id) {
        socket.emit('user_left_chat', { 
          userId: sessionData.user._id, 
          chatId: activeChat 
        });
      }
    };
  }, [activeChat, sessionData?.user?._id])

  
  const ChatLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <MessageCircle size={20} className="text-blue-500" />
        </div>
      </div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <p className="text-sm text-gray-600 font-medium">Loading chat...</p>
    </div>
  </div>
);


 const form = useForm({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      content: ""
    }
  });

 const {
  transcript,
  listening,
  resetTranscript,
  browserSupportsSpeechRecognition,
} = useSpeechRecognition();

  const toggleMic = () => {
    console.log("toggleMic is called")
    console.log("listening is : ",listening)

    if (!listening) {
      console.log("on-------------")
      SpeechRecognition.startListening({ continuous: true, language: "en-US" });
    } else {
      console.log("off----------------")
      SpeechRecognition.stopListening();
    }
  };

    useEffect(() => {
  form.setValue('content', transcript);
  setContent(transcript);
}, [transcript]);



  const addEmoji = (emoji) => {
    const emojiSymbol = emoji.native;
    form.setValue('content', form.getValues('content') + emojiSymbol);
    setContent((prev) => prev + emojiSymbol);
};

  useEffect(() => {
    receiverId.current = searchParams.get("receiverId");
  }, [searchParams]);

  useEffect(() => {
    // Enable send if there's content OR a pending attachment, but disable during upload
    const hasContent = content.length > 0
    const hasPendingAttachment = pendingAttachment !== null
    const isUploadingFile = isUploading
    
    // Check if current friend is blocked
    const currentFriend = friends.find(f => f.friendid === receiverId.current);
    const isFriendBlocked = currentFriend?.isBlocked || false;
    
    setEnableSend((hasContent || hasPendingAttachment) && !isUploadingFile && !isFriendBlocked)
  }, [content, pendingAttachment, isUploading, friends, receiverId.current]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (pendingAttachment?.url) {
        URL.revokeObjectURL(pendingAttachment.url)
      }
    }
  }, [pendingAttachment?.url]);

  useEffect(() => {
  if (session) {
    const userId = session.user._id;
    
    // Join room and set initial data
    socket.emit("join_room", userId);
    socket.emit("set_data", { userId: userId });

    // Check status of current receiver
    socket.emit("status", { receiverId: receiverId.current });

    // Load friends and groups in parallel
    const loadFriendsAndGroups = async () => {
      try {
        // Load friends via socket
        socket.emit("get_friends", userId);
        socket.on("friend_list", (friendData) => {
          // Deduplicate friends by friendid to prevent duplicate React keys
          const uniqueFriends = friendData.reduce((acc, friend) => {
            const friendId = friend.friendid.toString()
            if (!acc.some(f => f.friendid.toString() === friendId)) {
              acc.push(friend)
            }
            return acc
          }, [])
          setFriends(uniqueFriends);
        });

        // Load groups via API
        const res = await fetch('/api/groups/list');
        const data = await res.json();
        if (data?.success) {
          setGroups(deduplicateGroups(data.data.groups || []));
        }
      } catch (e) {
        console.error('Error loading friends/groups:', e);
      }
    };
    
    loadFriendsAndGroups();

    setIsInitialLoading(false);
  }

  // Cleanup function
  return () => {
    socket.off("friend_list");
    // Only reset counts when session is completely lost
    // Don't reset on every cleanup to preserve message counts
  };
}, [session])

  useEffect(() => {
    if (receiverId.current && session) {
      socket.emit("status", { receiverId: receiverId.current });
    }
  }, [receiverId.current]);

  // Handle status changes separately to avoid clearing message counts
  useEffect(() => {
    if (!sessionData?.user?._id) return;

    const handleOnlineStatus = ({ userId }) => {
      console.log("receiverId.current is : ",receiverId.current)
      console.log("userId is : ",userId)
      
      // Update user status in the map
      setUserStatus(prev => ({
        ...prev,
        [userId]: "online"
      }));
      
      if(userId == receiverId.current) {  
        console.log("heyyyy--------------")
        setStatus("online");
        console.log("Receiver is online");
      }
    };

    const handleOfflineStatus = ({ userId }) => {
      // Update user status in the map
      setUserStatus(prev => ({
        ...prev,
        [userId]: "offline"
      }));
      
      if(userId === receiverId.current) {
        setStatus("offline");
      }
    };

    const handleUserCameOnline = ({ userId }) => {
      console.log("User came online:", userId)
      
      // Update user status in the map
      setUserStatus(prev => ({
        ...prev,
        [userId]: "online"
      }));
      
      if(userId === receiverId.current) {
        setStatus("online");
      }
    };

    const handleUserWentOffline = ({ userId }) => {
      console.log("User went offline:", userId)
      
      // Update user status in the map
      setUserStatus(prev => ({
        ...prev,
        [userId]: "offline"
      }));
      
      if(userId === receiverId.current) {
        setStatus("offline");
      }
    };

    // Register status event listeners
    socket.on("online", handleOnlineStatus);
    socket.on("offline", handleOfflineStatus);
    socket.on("user_came_online", handleUserCameOnline);
    socket.on("user_went_offline", handleUserWentOffline);

    return () => {
      socket.off("online", handleOnlineStatus);
      socket.off("offline", handleOfflineStatus);
      socket.off("user_came_online", handleUserCameOnline);
      socket.off("user_went_offline", handleUserWentOffline);
    };
  }, [sessionData?.user?._id, receiverId.current]);

  // Handle session changes - only reset counts when session is completely lost
  useEffect(() => {
    if (!sessionData?.user?._id) {
      console.log("Session lost, resetting message counts");
      setNewMessageCounts({});
      setTotalNewMessages(0);
      setProcessedMessages(new Set());
      // Clear sessionStorage as well
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('newMessageCounts');
        sessionStorage.removeItem('totalNewMessages');
      }
    }
  }, [sessionData?.user?._id]);

  useEffect(() => {
    if (!sessionData?.user?._id) return;

    // Prevent duplicate listener registration
    if (socketListenersRegistered.current) {
      console.log("🔧 Socket listeners already registered, skipping...");
      return;
    }

    console.log("🔧 Registering socket listeners for messages");
    socketListenersRegistered.current = true;

    socket.on("send_message_to_sender", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("send_message_to_receiver", (message) => {
      console.log("🔍 RECEIVED MESSAGE TO RECEIVER:", {
        messageSender: message.senderid,
        messageReceiver: message.receiverid,
        currentUser: sessionData?.user?._id,
        activeChat: receiverId.current,
        shouldShow: receiverId.current && (
          (message.senderid === receiverId.current && message.receiverid === sessionData?.user?._id) ||
          (message.receiverid === receiverId.current && message.senderid === sessionData?.user?._id)
        )
      });
      
      // Only add message if it's for the currently active chat
      if (receiverId.current && (
        (message.senderid === receiverId.current && message.receiverid === sessionData?.user?._id) ||
        (message.receiverid === receiverId.current && message.senderid === sessionData?.user?._id)
      )) {
        console.log("✅ ADDING MESSAGE TO CHAT");
        
        // If the current user is the receiver and they're actively in the chat, mark the message as read immediately
        if (message.senderid === receiverId.current && message.receiverid === sessionData?.user?._id) {
          console.log('🔄 MARKING NEW MESSAGE AS READ IMMEDIATELY:', message._id);
          message.readStatus = { isRead: true, readAt: new Date() };
          // Also call the API to persist the read status
          markMessagesAsRead(message.senderid);
        }
        
        setMessages((prev) => {
          const newMessages = [...prev, message];
          
          // If this is a message sent by the current user and the receiver is active, 
          // immediately mark the user's previous messages as read
          if (message.senderid === sessionData?.user?._id && message.receiverid === receiverId.current) {
            console.log('🔄 MARKING USER MESSAGES AS READ FOR NEW MESSAGE');
            return newMessages.map(msg => {
              if (msg.senderid === sessionData?.user?._id && msg.receiverid === receiverId.current) {
                console.log('✅ TURNING USER MESSAGE BLUE:', msg.content, '(ID:', msg._id, ')');
                return { ...msg, readStatus: { isRead: true, readAt: new Date() } };
              }
              return msg;
            });
          }
          
          return newMessages;
        });
      } else {
        console.log("❌ IGNORING MESSAGE - NOT FOR CURRENT CHAT");
      }
    });

    // Listen for messages read notifications
    socket.on("messages_read", (data) => {
      console.log("📖 MESSAGES READ:", data);
      console.log("🔍 UPDATING MESSAGES FOR SENDER:", sessionData?.user?._id, "RECEIVER:", data.receiverId);
      
      // Update messages to show blue ticks
      setMessages(prevMessages => {
        const updatedMessages = prevMessages.map(msg => {
          if (msg.senderid === sessionData?.user?._id && msg.receiverid === data.receiverId) {
            console.log("✅ TURNING MESSAGE BLUE:", msg.content, '(ID:', msg._id, ')');
            return { ...msg, readStatus: { isRead: true, readAt: new Date() } };
          }
          return msg;
        });
        
        const blueCount = updatedMessages.filter(m => m.readStatus?.isRead).length;
        console.log("📊 MESSAGES TURNED BLUE:", blueCount);
        
        return updatedMessages;
      });
      
      // Also mark this friend as having read messages (for sidebar color)
      setFriendsWithReadMessages(prev => {
        const newSet = new Set([...prev, data.receiverId]);
        console.log("👥 FRIENDS WITH READ MESSAGES:", Array.from(newSet));
        return newSet;
      });
    });

    // Listen for user activity in chats
    socket.on("user_joined_chat", (data) => {
      console.log("👤 USER JOINED CHAT:", data);
      setActiveUsers(prev => {
        const newSet = new Set([...prev, data.userId]);
        console.log("👥 ACTIVE USERS AFTER JOIN:", Array.from(newSet));
        return newSet;
      });
    });

    socket.on("user_left_chat", (data) => {
      console.log("👤 USER LEFT CHAT:", data);
      setActiveUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        console.log("👥 ACTIVE USERS AFTER LEAVE:", Array.from(newSet));
        return newSet;
      });
    });

    return () => {
      console.log("🔧 Cleaning up socket listeners for messages");
      socket.off("send_message_to_sender");
      socket.off("send_message_to_receiver");
      socket.off("messages_read");
      socket.off("user_joined_chat");
      socket.off("user_left_chat");
      socketListenersRegistered.current = false;
    };
  }, [sessionData?.user?._id]);

 useEffect(() => {
  if (bottomRef.current) {
    const chatContainer = bottomRef.current.closest('.overflow-y-auto');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
}, [messages]);

  const onSubmit = async (data) => {
    if (receiverId.current && sessionData?.user?._id) {
      // Handle group messages
      if (receiverId.current.startsWith('group_')) {
        const groupId = receiverId.current.replace('group_', '');
        
        // If there's a pending attachment, send it (and ignore text content)
        if (pendingAttachment) {
          await sendGroupMessageWithAttachment(groupId);
        } else if (data.content.length > 0) {
          // Only send text if there's no pending attachment
          await sendGroupMessage(groupId, data.content);
        }
      } else {
        // Handle direct messages
        // If there's a pending attachment, send it (and ignore text content)
        if (pendingAttachment) {
          await sendMessageWithAttachment();
          
          // If the receiver is currently in the chat, mark messages as read immediately
          if (receiverId.current && !receiverId.current.startsWith('group_')) {
            console.log('🔍 CHECKING RECEIVER ACTIVITY:', {
              receiverId: receiverId.current,
              activeUsers: Array.from(activeUsers),
              activeChat,
              isReceiverInActiveUsers: activeUsers.has(receiverId.current),
              isReceiverActiveChat: receiverId.current === activeChat
            });
            
            // Note: Messages will only turn blue when the receiver actually opens the chat
            // This is the correct WhatsApp behavior - blue ticks only appear when friend reads messages
          }
        } else if (data.content.length > 0) {
          // Only send text if there's no pending attachment
          sendMessage(session.user._id, receiverId.current, data.content);
          
          // If the receiver is currently in the chat, mark messages as read immediately
          if (receiverId.current && !receiverId.current.startsWith('group_')) {
            console.log('🔍 CHECKING RECEIVER ACTIVITY:', {
              receiverId: receiverId.current,
              activeUsers: Array.from(activeUsers),
              activeChat,
              isReceiverInActiveUsers: activeUsers.has(receiverId.current),
              isReceiverActiveChat: receiverId.current === activeChat
            });
            
            // Note: Messages will only turn blue when the receiver actually opens the chat
            // This is the correct WhatsApp behavior - blue ticks only appear when friend reads messages
          }
        }
      }
      form.reset();
      setContent("")
    }
  };

  // Handle new messages with proper cleanup
  useEffect(() => {
    if (!sessionData?.user?._id) return;

    console.log("🔔 Setting up new_message listener");

    const handleNewMessage = ({ content, receiverId, senderId }) => {
      // Create a unique message identifier with more precision
      const messageId = `${senderId}-${receiverId}-${content}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      console.log("🔔 === NEW MESSAGE NOTIFICATION DEBUG ===");
      console.log("🔔 New message received:", { content, receiverId, senderId, messageId });
      console.log("🔔 Current activeChat:", activeChatRef.current);
      console.log("🔔 Current session user:", sessionData?.user?._id);
      console.log("🔔 Is group message:", senderId.startsWith('group_'));
      console.log("🔔 Processed messages count:", processedMessages.size);
      console.log("🔔 Already processed?", processedMessages.has(messageId));
      console.log("🔔 ========================================");

      // Check if this message has already been processed FIRST
      if (processedMessages.has(messageId)) {
        console.log("🔔 Message already processed, skipping...");
        return;
      }

      // If we're in the same chat (direct or group), don't increment notifications
      if (activeChatRef.current === senderId) {
        console.log("🔔 User is actively chatting with sender, not incrementing count");
        return;
      }

      // Check if notifications are muted for this chat
      // For direct messages, use senderId (friend's id);
      // for groups, senderId already carries `group_<id>`
      const chatId = senderId;
      const muteKey = `muted_${chatId}`;
      const isMuted = localStorage.getItem(muteKey) === 'true';
      
      if (isMuted) {
        console.log("Notifications are muted for this chat, skipping notification");
        return;
      }

      // Only process if the message is for the current user
      if (receiverId === sessionData?.user?._id) {
        // Prevent duplicate events from double-emits/race conditions
        const dedupeKey = `${senderId}-${receiverId}-${content}`;
        if (isDuplicateNotification(dedupeKey)) {
          console.log("🔔 Duplicate notification suppressed for:", dedupeKey);
          return;
        }
        // Prevent duplicate processing
        if (processingNotification.current) {
          console.log("🔔 Notification already being processed, skipping...");
          return;
        }
        
        processingNotification.current = true;
        
        // Mark this message as processed
        setProcessedMessages(prev => new Set([...prev, messageId]));
        
        // Handle notifications for both group and direct messages
            setTimeout(() => {
              setNewMessageCounts(prev => {
            const isGroup = senderId.startsWith('group_');
            const chatKey = isGroup ? senderId : senderId;
            
            console.log("🔔 Incrementing notification count for:", chatKey, "Previous count:", prev[chatKey] || 0);
                const newCounts = {
                  ...prev,
              [chatKey]: (prev[chatKey] || 0) + 1
                };
                
                // Update total count
                const total = Object.values(newCounts).reduce((sum, count) => sum + count, 0);
                setTotalNewMessages(total);
                
            console.log("🔔 New count for", chatKey, ":", newCounts[chatKey], "Total:", total);
            
            // Reset processing flag
            processingNotification.current = false;
                
                return newCounts;
              });
            }, 50);
      }
    };

    // Remove any existing listeners first to prevent duplicates
    socket.off("new_message");
    // Register the listener
    socket.on("new_message", handleNewMessage);

    // Cleanup function
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [sessionData?.user?._id]); // Remove activeChat dependency to prevent re-registration


  // This is already handled in the main session useEffect above

  useEffect(() => {
  },[newMessages,content])

  // Persist message counts to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('newMessageCounts', JSON.stringify(newMessageCounts));
      sessionStorage.setItem('totalNewMessages', totalNewMessages.toString());
    }
  }, [newMessageCounts, totalNewMessages]);

  // Debug effect for new message counts
  useEffect(() => {
    console.log("=== MESSAGE COUNT DEBUG ===");
    console.log("New message counts:", newMessageCounts);
    console.log("Total new messages:", totalNewMessages);
    console.log("Processed messages count:", processedMessages.size);
    console.log("Active chat:", activeChat);
    console.log("Session user:", sessionData?.user?._id);
    console.log("===========================");
  }, [newMessageCounts, totalNewMessages, processedMessages, activeChat, sessionData?.user?._id])

  const onClick = async (id) => {
    if (id) {
      setIsLoading(true)
      handleMobileChatSelect(id);
      const startTime = Date.now();
      const url = id ? `/?receiverId=${id}` : '/'
      window.history.pushState(null, '', url);
      receiverId.current = id;
      setMessages([]);
      
      // Clear the new message count for this sender when user opens the chat
      if (newMessageCounts[id]) {
        setNewMessageCounts(prev => {
          const newCounts = { ...prev };
          delete newCounts[id];
          
          // Update total count
          const total = Object.values(newCounts).reduce((sum, count) => sum + count, 0);
          setTotalNewMessages(total);
          
          return newCounts;
        });
      }
      
      // Handle group chats differently
      if (id.startsWith('group_')) {
        const groupId = id.replace('group_', '');
        // Load group messages
        try {
          const response = await fetch(`/api/groups/get-messages?groupId=${groupId}`)
          const data = await response.json()
          if (data.success) {
            const filtered = filterClearedMessages(data.data.messages || [], id)
            setMessages(filtered)
          }
        } catch (err) {
          console.error('Failed to load group messages:', err)
          setMessages([])
        }
        setIsLoading(false);
        setStatus("offline"); // Groups don't have online status
      } else {
        // Handle direct messages
        socket.emit("all_messages", {
          senderId: sessionData?.user?._id,
          receiverId: id,
        });
        socket.once("receive_messages", async (msgs) => {
           const elapsedTime = Date.now() - startTime;
           const remainingTime = Math.max(1000 - elapsedTime, 0);
          setTimeout(async () => {
            const filtered = filterClearedMessages(msgs || [], id)
            
            // Load read status from database for these messages
            try {
              const response = await axios.get(`/api/messages-read-status?senderId=${sessionData.user._id}&receiverId=${id}`);
              
              if (response.data.success && response.data.data.readMessages) {
                // Update messages with read status
                const messagesWithReadStatus = filtered.map(msg => {
                  const isRead = response.data.data.readMessages.some(readMsg => readMsg._id === msg._id);
                  if (isRead) {
                    return { ...msg, readStatus: { isRead: true, readAt: new Date() } };
                  }
                  return msg;
                });
                
                setMessages(messagesWithReadStatus);
              } else {
                setMessages(filtered);
              }
            } catch (error) {
              console.error('Error loading read status:', error);
              setMessages(filtered);
            }
            
            // Only mark messages as read if the current user is the RECEIVER (not sender)
            // Check if current user is the receiver (friend) of messages from this chat
            const shouldMarkAsRead = filtered.some(msg => 
              msg.senderid === id && msg.receiverid === sessionData.user._id
            );
            
            if (shouldMarkAsRead) {
              // Only mark as read if there are unread messages from this friend
              const hasUnreadMessages = filtered.some(msg => 
                msg.senderid === id && msg.receiverid === sessionData.user._id && !msg.readStatus?.isRead
              );
              
              if (hasUnreadMessages) {
                markMessagesAsRead(id);
              }
            }
            
            setIsLoading(false);
          }, remainingTime);
      })
      
      // Request status for this user and reset status
      if (receiverId.current && session) {
        socket.emit("status", { receiverId: receiverId.current });
        // Reset status to offline initially, will be updated by server response
        setStatus("offline");
      }
      }
    }
  };

  useEffect(() => {
  if (!sessionData?.user?._id) return;

  // Call functionality removed
}, [session]);


  // Video call functionality removed

  const copyMessage = async (message) => {
    if (message.attachment) {
      // For messages with attachments, copy the attachment URL
      const attachmentUrl = message.attachment.secureUrl || message.attachment.url
      await navigator.clipboard.writeText(attachmentUrl)
      setCopiedMessageId(message._id)
      setTimeout(() => setCopiedMessageId(null), 1500)
    } else {
      // For text messages, copy the content
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message._id)
      setTimeout(() => setCopiedMessageId(null), 1500)
    }
  }

  useEffect(() => {
    // console.log("receiverId.current : ",receiverId.current)
    // console.log("session.user._id : ",sessionData?.user?._id)
      socket.on("deleted",({id}) => {
        setMessages((prev) => prev.map((msg) => msg._id == id ? {...msg,content : "Message Deleted"} : msg))
      })
    
  },[])

  const deleteMessage = async(id) => {
    
    try
    {
     
      const response = await axios.post("/api/delete-message",{id : id})
      setMessages((prev) => prev.map((msg) => msg._id == id ? {...msg,content : "Message Deleted"} : msg))
      console.log("running........")
      socket.emit("message_deleted",{id,receiverId : receiverId.current})
      
    }
    catch(error)
    {
      if(error instanceof AxiosError)
      {
        toast.error(error)
      }
      else
      {
        console.log("Error is : ",error)
      }
    }
  }

  // Voice call functionality removed

const SignOut = () => {
  console.log("signout called")
  signOut({callbackUrl:"http://localhost:3001/sign-in"})
}


useEffect(() => {
  let result = []
  console.log("searchValue is : ",searchValue)
  if(searchValue.trim().length > 0)
  {     
    result = friends.filter((frn) =>
      frn.friendusername.toLowerCase().includes(searchValue.toLowerCase())
    );
    console.log("result is : ",result)
  }
  else
  {
    result = [...friends];
  }

  // Always keep AI friend at top, then sort the rest
  const aiUsers = result.filter(friend => friend.friendusername.toLowerCase().includes('ai'));
  const regularUsers = result.filter(friend => !friend.friendusername.toLowerCase().includes('ai'));
  
  if (sortOrder === 'name') {
    regularUsers.sort((a, b) => a.friendusername.localeCompare(b.friendusername));
  }
  
  result = [...aiUsers, ...regularUsers];
  
  setFilteredFriends(result);
  
}, [searchValue, friends, sortOrder]);

  const suggestMessages = async () => {
    try
    {
      if(session)
      {
      try {
        const response = await axios.post("/api/suggest-message",{
          senderId : sessionData?.user?._id,
          receiverId : receiverId.current
        })
         console.log("response.data is : ",response.data.data)
         form.setValue('content', response.data.data)
         setContent(response.data.data)
         setEnableSend(true)
      } catch (error) {
        console.log("Error is : ",error)
      }

    }
    else
    {
      console.log("NO SESSION DATA FOUND")
    }
    }
    catch(error)
    {
      if(error instanceof AxiosError)
      {
        toast.error(error)
      }
      else
      {
        console.log("Error is : ",error)
      }
    }
  }

  // Enhanced search messages functionality
  const searchMessages = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    
    const results = messages.filter(message => 
      message.content.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(message => ({
      ...message,
      searchHighlight: message.content.toLowerCase().indexOf(searchQuery.toLowerCase())
    }));
    
    setSearchResults(results);
    setCurrentSearchIndex(0);
  };

  // Navigate through search results
  const navigateSearch = (direction) => {
    if (searchResults.length === 0) return;
    
    if (direction === 'next') {
      setCurrentSearchIndex((prev) => (prev + 1) % searchResults.length);
    } else {
      setCurrentSearchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    }
    
    // Auto-scroll to the current search result with subtle blink effect
    setTimeout(() => {
      const messageElements = document.querySelectorAll('[data-message-id]');
      const currentResult = searchResults[currentSearchIndex];
      if (currentResult && messageElements.length > 0) {
        const targetElement = Array.from(messageElements).find(el => 
          el.getAttribute('data-message-id') === currentResult._id
        );
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add elegant blink effect
          targetElement.classList.add('search-highlight');
          
          setTimeout(() => {
            targetElement.classList.remove('search-highlight');
          }, 2000);
        }
      }
    }, 100);
  };

  // Close inline search
  const closeSearch = () => {
    setIsSearchActive(false);
    setSearchQuery("");
    setSearchResults([]);
    setCurrentSearchIndex(0);
  };

  // Search with date filtering
  const searchWithDateFilter = (startDate, endDate) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    let results = messages.filter(message => 
      message.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (startDate || endDate) {
      results = results.filter(message => {
        const messageDate = new Date(message.createdAt || Date.now());
        if (startDate && messageDate < new Date(startDate)) return false;
        if (endDate && messageDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    setSearchResults(results);
  };

  // Clear all messages for current chat
  const clearAllMessages = async () => {
    try {
      if (receiverId.current && sessionData?.user?._id) {
        const response = await axios.post("/api/clear-messages", {
          senderId: sessionData?.user?._id,
          receiverId: receiverId.current
        });
        
        if (response.data.success) {
          // Optimistically clear in UI and remember clear time so old history stays hidden
          setMessages([]);
          const now = Date.now();
          setClearedAtMap(prev => {
            const next = { ...prev, [receiverId.current]: now };
            try { sessionStorage.setItem('clearedAtMap', JSON.stringify(next)) } catch {}
            return next;
          })
          toast.success("All messages cleared successfully");
        } else {
          toast.error("Failed to clear messages");
        }
      }
    } catch (error) {
      console.error("Error clearing messages:", error);
      toast.error("Failed to clear messages");
    }
  };

  // Helper: filter messages that were sent after the user's last clear timestamp for this chat
  const filterClearedMessages = (list, id) => {
    if (!id || !list?.length) return list || [];
    const clearedAt = clearedAtMap[id];
    if (!clearedAt) return list;
    return (list || []).filter(m => {
      const t = m?.createdAt ? new Date(m.createdAt).getTime() : (m?.timestamp || 0);
      return !t || t > clearedAt;
    })
  }

  // User-friendly export chat functionality
  const exportChat = () => {
    const friendInfo = friends.find(f => f.friendid === receiverId.current);
    const currentUser = sessionData?.user;
    
    // Group messages by date
    const messagesByDate = messages.reduce((acc, msg) => {
      const date = new Date(msg.createdAt || Date.now()).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(msg);
      return acc;
    }, {});

    // Create user-friendly chat export
    const chatData = {
      chatTitle: `Chat with ${friendInfo?.friendusername || 'Friend'}`,
      participants: {
        you: currentUser?.username || 'You',
        friend: friendInfo?.friendusername || 'Friend'
      },
      totalMessages: messages.length,
      chatDuration: messages.length > 0 ? {
        started: new Date(Math.min(...messages.map(m => new Date(m.createdAt || Date.now()).getTime()))).toLocaleDateString(),
        ended: new Date(Math.max(...messages.map(m => new Date(m.createdAt || Date.now()).getTime()))).toLocaleDateString()
      } : null,
      conversation: Object.entries(messagesByDate).map(([date, msgs]) => ({
        date: date,
        messages: msgs.map(msg => {
          const isYou = msg.senderid === sessionData?.user?._id;
          const senderName = isYou ? 'You' : (friendInfo?.friendusername || 'Friend');
          const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          return {
            time: time,
            sender: senderName,
            message: msg.content
          };
        })
      })),
      exportedOn: new Date().toLocaleDateString(),
      exportedAt: new Date().toLocaleTimeString()
    };

    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Chat with ${friendInfo?.friendusername || 'Friend'} - ${new Date().toLocaleDateString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  useEffect(() => {
  if(content.length > 0) {
    socket.emit("typing",{receiverId : receiverId.current})
  }
  
  
  const handleTyping = () => {
    if (status === "online") { 
      setIsTyping(true);
      console.log("User is typing");
    }
  };

  if(content.length == 0 || content.length == "null")
  {
      socket.emit("is_not_typing",{receiverId : receiverId.current})
  }

  socket.on("is_typing", handleTyping); 
  
  return () => {
    socket.off("is_typing");

  }
}, [content, status]);

  useEffect(() => {
      socket.on("not_typing",() => {
        setIsTyping(false)
        console.log("user is not typing")
      })
      return () => {
        socket.off("not_typing")
      }
  },[])

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Handle click outside emoji picker
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false)
      }
    }

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  // Load notifications once session is ready (groups now loaded with friends)
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await fetch('/api/notifications')
        const data = await res.json()
        if (data?.success) {
          // Convert database notifications to UI format
          const dbNotifications = data.data.notifications.map(notif => ({
            id: notif._id,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            timestamp: new Date(notif.createdAt).getTime(),
            isRead: notif.isRead,
            data: notif.data
          }))
          setNotifications(prev => {
            // Merge with existing notifications and deduplicate
            const combined = [...dbNotifications, ...(prev || [])]
            const seen = new Set()
            return combined.filter(notif => {
              if (seen.has(notif.id)) return false
              seen.add(notif.id)
              return true
            }).slice(0, 50)
          })
        }
      } catch (e) {
        console.error('Error loading notifications:', e)
      }
    }
    
    if (sessionData?.user?._id) {
      loadNotifications()
    }
  }, [sessionData?.user?._id])

  // Load mute state when chat changes
  useEffect(() => {
    if (receiverId.current) {
      const muteKey = `muted_${receiverId.current}`
      const muted = localStorage.getItem(muteKey) === 'true'
      setIsMuted(muted)
    }
  }, [receiverId.current])

  // Listen for real-time group additions
  useEffect(() => {
    if (!sessionData?.user?._id) return
    const onGroupAdded = (data) => {
      console.log("Group added notification received:", data)
      
      // Add the group to the groups list if it's not already there
      setGroups((prev) => {
        const existing = prev.find(g => {
          const gid = (g?._id && g._id.toString) ? g._id.toString() : g?._id
          return gid === data.group?._id?.toString()
        })
        if (existing) return prev
        
        const newGroups = [data.group, ...prev]
        return deduplicateGroups(newGroups)
      })
      
      // Show toast notification to the added friend
      if (data.message || data.addedBy) {
        const notificationMessage = data.message || `${data.addedBy || 'Someone'} has added you to the group "${data.group?.name || 'a group'}"`
        let shouldShowToast = false
        
        // Add notification to notifications state
        setNotifications(prev => {
          // Check if notification already exists (by group ID and type)
          const existing = prev?.find(n => 
            n.type === 'group_added' && 
            n.data?.groupId?.toString() === data.group?._id?.toString()
          )
          if (existing) return prev
          
          const notificationId = `group_added_${data.group?._id || Date.now()}_${Date.now()}`
          const newNotification = {
            id: notificationId,
            type: 'group_added',
            title: 'Added to Group',
            message: notificationMessage,
            timestamp: Date.now(),
            isRead: false,
            data: {
              groupId: data.group?._id,
              groupName: data.group?.name,
              addedBy: data.addedBy
            }
          }
          
          const next = [newNotification, ...(prev || [])]
          saveGlobalNotifications(next)
          shouldShowToast = true
          return next.slice(0, 50)
        })
        
        // Show toast outside of setState callback
        if (shouldShowToast) {
          const notificationKey = `group_added_${data.group?._id}`
          if (!shownNotificationsRef.current.has(notificationKey)) {
            shownNotificationsRef.current.add(notificationKey)
            setTimeout(() => {
              toast.success(notificationMessage, {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              })
              // Remove from ref after 5 seconds
              setTimeout(() => shownNotificationsRef.current.delete(notificationKey), 5000)
            }, 0)
          }
        }
      }
    }
    socket.on('group_added', onGroupAdded)
    return () => {
      socket.off('group_added', onGroupAdded)
    }
  }, [sessionData?.user?._id])

  // Listen for group creation and updates
  useEffect(() => {
    if (!sessionData?.user?._id) return
    const onGroupCreated = (group) => {
      // Check if group already exists before adding to prevent duplicates
      setGroups((prev) => {
        const existing = prev.find(g => {
          const gid = (g?._id && g._id.toString) ? g._id.toString() : g?._id
          return gid === group?._id?.toString()
        })
        
        if (existing) {
          console.log('Duplicate group creation prevented:', group?._id)
          return prev
        }
        
        const newGroups = [group, ...prev]
        return deduplicateGroups(newGroups)
      })
      
      // Show single notification when group is created (only show toast, don't add to notifications list)
      // Use setTimeout to avoid setState during render warning and prevent duplicates
      const notificationKey = `group_created_${group?._id}`
      if (!shownNotificationsRef.current.has(notificationKey)) {
        shownNotificationsRef.current.add(notificationKey)
        setTimeout(() => {
          toast.success(`Created group "${group?.name || 'New Group'}"`, {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          })
          // Remove from ref after 5 seconds
          setTimeout(() => shownNotificationsRef.current.delete(notificationKey), 5000)
        }, 0)
      }
    }
    const onGroupJoined = (group) => {
      setGroups((prev) => {
        const newGroups = [group, ...prev]
        return deduplicateGroups(newGroups)
      })
    }
    const onGroupDeleted = (payload) => {
      const groupId = typeof payload === 'string' ? payload : payload?.groupId
      const groupIdStr = groupId?.toString()
      const deletedBy = typeof payload === 'object' ? payload?.deletedBy : undefined
      const deletedBySelf = typeof payload === 'object' ? payload?.deletedBySelf : false
      
      // Remove the group by id, normalizing both sides to string (for ALL users including owner)
      setGroups(prev => {
        const filtered = prev.filter(g => {
          const gid = (g?._id && g._id.toString) ? g._id.toString() : g?._id
          return gid !== groupIdStr
        })
        // Ensure group is removed even if already filtered
        return filtered
      })
      
      // If we're currently in the deleted group, navigate away
      if (receiverId.current === `group_${groupIdStr}`) {
        receiverId.current = null
        setActiveChat(null)
        setMessages([])
        window.history.pushState(null, '', '/')
      }
      
      // Only add notification if the current user didn't delete the group themselves
      if (!deletedBySelf) {
        let notificationMessage = deletedBy ? `${deletedBy} deleted this group` : 'This group was deleted by the owner'
        let shouldAddNotification = false
        
        setNotifications(prev => {
          // Check for duplicate notification
          const existing = prev?.find(n => 
            n.type === 'group_deleted' && 
            n.data?.groupId?.toString() === groupIdStr
          )
          if (existing) {
            console.log('Duplicate group_deleted notification prevented:', existing.id)
            return prev
          }
          
          shouldAddNotification = true
          const item = {
            id: `group_deleted_${groupId}_${Date.now()}`,
            type: 'group_deleted',
            title: 'Group Deleted',
            message: notificationMessage,
            timestamp: Date.now(),
            isRead: false,
            data: { groupId }
          }
          const next = [item, ...(prev || [])]
          saveGlobalNotifications(next)
          return next.slice(0, 50)
        })
        
        // Show toast notification outside of setState callback
        if (shouldAddNotification) {
          const notificationKey = `group_deleted_${groupIdStr}`
          if (!shownNotificationsRef.current.has(notificationKey)) {
            shownNotificationsRef.current.add(notificationKey)
            setTimeout(() => {
              toast.error(notificationMessage, {
                position: "top-right",
                autoClose: 4000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              })
              // Remove from ref after 5 seconds
              setTimeout(() => shownNotificationsRef.current.delete(notificationKey), 5000)
            }, 0)
          }
        }
      }
    }
    const onGroupLeft = async (data) => {
      console.log("Group member left notification received:", data)
      
      // Check if current user is the one who left - if so, remove group from their list
      if (data.userId?.toString() === sessionData?.user?._id?.toString()) {
        // Remove the group from groups list for the user who left
        setGroups(prev => prev.filter(g => {
          const gid = (g?._id && g._id.toString) ? g._id.toString() : g?._id
          return gid !== data.groupId?.toString()
        }))
        
        // If we're currently in the left group, navigate away
        if (receiverId.current === `group_${data.groupId}`) {
          receiverId.current = null
          setActiveChat(null)
          setMessages([])
        }
        // Don't show notification if user left themselves
        return
      }
      
      // Show leave notification in group chat if currently viewing that group
      if (receiverId.current === `group_${data.groupId}`) {
        const leaveMessage = {
          id: `leave_${data.userId}_${Date.now()}`,
          content: `${data.username} left the group`,
          senderId: 'system',
          receiverId: `group_${data.groupId}`,
          timestamp: Date.now(),
          type: 'system',
          isSystemMessage: true
        }
        setMessages(prev => [...prev, leaveMessage])
        
        // Persist the leave message to database
        try {
          await fetch('/api/store-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: leaveMessage.content,
              senderId: leaveMessage.senderId,
              receiverId: leaveMessage.receiverId,
              timestamp: leaveMessage.timestamp,
              type: 'system',
              isSystemMessage: true
            })
          })
        } catch (error) {
          console.error('Failed to persist leave message:', error)
        }
      }
      
      // Find the group name for the notification
      const group = groups.find(g => {
        const gid = (g?._id && g._id.toString) ? g._id.toString() : g?._id
        return gid === data.groupId?.toString()
      })
      const groupName = group?.name || 'the group'
      
      // Check if notification already exists before adding
      let shouldShowToast = false
      let notificationMessage = ''
      
      setNotifications(prev => {
        // Check for duplicate by message content and type
        const existing = prev?.find(n => 
          n.type === 'group_member_left' && 
          n.data?.groupId?.toString() === data.groupId?.toString() &&
          n.data?.leftById?.toString() === data.userId?.toString() &&
          n.message?.includes(data.username || 'A member')
        )
        if (existing) {
          console.log('Duplicate notification prevented:', existing.id)
          return prev
        }
        
        const notificationId = `group_member_left_${data.groupId}_${data.userId}_${Date.now()}`
        notificationMessage = `${data.username || 'A member'} left the group "${groupName}"`
        const newNotification = {
          id: notificationId,
          type: 'group_member_left',
          title: 'Member Left Group',
          message: notificationMessage,
          timestamp: Date.now(),
          isRead: false,
          data: {
            groupId: data.groupId,
            groupName: groupName,
            leftBy: data.username,
            leftById: data.userId
          }
        }
        
        const next = [newNotification, ...(prev || [])]
        saveGlobalNotifications(next)
        shouldShowToast = true
        return next.slice(0, 50)
      })
      
      // Show toast notification outside of setState callback
      if (shouldShowToast && notificationMessage) {
        const notificationKey = `group_member_left_${data.groupId}_${data.userId}`
        if (!shownNotificationsRef.current.has(notificationKey)) {
          shownNotificationsRef.current.add(notificationKey)
          setTimeout(() => {
            toast.info(notificationMessage, {
              position: "top-right",
              autoClose: 4000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            })
            // Remove from ref after 5 seconds
            setTimeout(() => shownNotificationsRef.current.delete(notificationKey), 5000)
          }, 0)
        }
      }
    }
    socket.on('group_created', onGroupCreated)
    socket.on('group_joined', onGroupJoined)
    socket.on('group_deleted', onGroupDeleted)
    socket.on('group_member_left', onGroupLeft)
    return () => {
      socket.off('group_created', onGroupCreated)
      socket.off('group_joined', onGroupJoined)
      socket.off('group_deleted', onGroupDeleted)
      socket.off('group_member_left', onGroupLeft)
    }
  }, [sessionData?.user?._id])

  // Listen for group messages
  useEffect(() => {
    if (!sessionData?.user?._id) return
    const onGroupMessage = (data) => {
      // Only add message if it's for the current active group
      if (activeChat === `group_${data.groupId}`) {
        setMessages(prev => [...prev, data.message])
      }
      
      // Note: Notification handling is done by handleNewMessage for new_message events
      // This handler only manages real-time message display for active chats
    }
    socket.on('group_message_received', onGroupMessage)
    return () => {
      socket.off('group_message_received', onGroupMessage)
    }
  }, [sessionData?.user?._id, activeChat])

  // Fetch friend requests
  const fetchFriendRequests = async () => {
    try {
      const response = await axios.get("/api/get-friend-requests")
      if (response.data.success) {
        setFriendRequests(response.data.data.friendRequests || [])
      } else {
        setFriendRequests([])
      }
    } catch (error) {
      console.error("Error fetching friend requests:", error)
      setFriendRequests([])
    }
  }

  // Respond to friend request
  const respondToFriendRequest = async (requestId, action) => {
    try {
      const response = await axios.post("/api/respond-friend-request", {
        requestId,
        action
      })
      
      if (response.data.success) {
        // Remove the request from the list
        setFriendRequests(prev => (prev || []).filter(req => req._id !== requestId))
        
        if (action === 'accept') {
          toast.success("Friend request accepted!")
          // Refresh friends list
          if (sessionData?.user?._id) {
            socket.emit("get_friends", session.user._id)
          }
        } else {
          toast.info("Friend request declined")
        }
      }
    } catch (error) {
      console.error("Error responding to friend request:", error)
      toast.error("Error processing friend request")
    }
  }

  // Fetch friend requests when component mounts
  useEffect(() => {
    if (sessionData?.user?._id) {
      fetchFriendRequests()
    }
  }, [sessionData?.user?._id])

  // Periodic refresh removed - socket handles real-time updates


  // Listen for friend request notifications
  useEffect(() => {
    if (!sessionData?.user?._id) return

    console.log("Setting up friend request listener for user:", session.user._id)

    const handleFriendRequest = (data) => {
      console.log("Received friend request notification:", data)
      console.log("Current user ID:", session.user._id)
      
      // Refresh friend requests
      fetchFriendRequests()
      
      // No toast message - just refresh the friend requests
    }

    // Sender gets response updates when receiver accepts/declines
    const handleFriendRequestResponded = (data) => {
      if (!data) return
      
      console.log('🔔 handleFriendRequestResponded called with:', data)
      
      // Create a unique ID based on the actual data to prevent duplicates
      const uniqueId = `friend_response_${data.receiverId}_${data.status}_${data.receiverUsername}`
      const now = Date.now()
      
      // Check if we're already processing this notification using ref (immediate check)
      if (processingRef.current.has(uniqueId)) {
        console.log('🚫 Notification already being processed (ref check):', uniqueId)
        return
      }
      
      // Check if we've already processed this notification recently (within 5 seconds)
      if (lastNotificationTime[uniqueId] && (now - lastNotificationTime[uniqueId]) < 5000) {
        console.log('🚫 Notification already processed recently:', uniqueId)
        return
      }
      
      // Mark as processing IMMEDIATELY in ref
      processingRef.current.add(uniqueId)
      
      // Mark as processing in state
      setProcessingNotifications(prev => new Set(prev).add(uniqueId))
      
      // Update the last notification time IMMEDIATELY
      setLastNotificationTime(prev => ({
        ...prev,
        [uniqueId]: now
      }))
      
      // Use a single state update with proper deduplication
      setNotifications(prev => {
        const list = prev ? [...prev] : []
        
        // Check if notification already exists to prevent duplicates
        const exists = list.some(notif => notif.id === uniqueId)
        if (exists) {
          console.log('🚫 Duplicate notification prevented in state:', uniqueId)
          return list
        }
        
        console.log('✅ Adding new notification:', uniqueId)
        const newNotification = {
          id: uniqueId,
          message: data.status === 'accepted'
            ? `${data.receiverUsername} has accepted your friend request`
            : `${data.receiverUsername} has declined your friend request`,
          timestamp: now,
          type: 'friend_response',
        }
        
        return [newNotification, ...list].slice(0, 50) // cap list
      })
      
      // Remove from processing set after a delay
      setTimeout(() => {
        processingRef.current.delete(uniqueId)
        setProcessingNotifications(prev => {
          const newSet = new Set(prev)
          newSet.delete(uniqueId)
          return newSet
        })
      }, 3000) // Increased to 3 seconds
      
      // If accepted, refresh friends list
      if (data.status === 'accepted' && sessionData?.user?._id) {
        socket.emit("get_friends", session.user._id)
        // Refresh users list in add friend modal if it's open
        if (showAddFriendModal) {
          fetchAllUsers()
        }
      }
    }

    // Add debug logging for socket events
    socket.on("friend_request_received", handleFriendRequest)
    socket.on("friend_request_responded", (data) => {
      console.log("🔔 friend_request_responded event received:", data)
      handleFriendRequestResponded(data)
    })

    // Listen for friend removal notifications
    socket.on("friend_removed_notification", async (data) => {
      console.log("Friend removed notification received:", data)
      
      // Reload notifications from API to show the friend removal notification
      try {
        const res = await fetch('/api/notifications')
        const responseData = await res.json()
        if (responseData?.success) {
          // Convert database notifications to UI format
          const dbNotifications = responseData.data.notifications.map(notif => ({
            id: notif._id,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            timestamp: new Date(notif.createdAt).getTime(),
            isRead: notif.isRead,
            data: notif.data
          }))
          setNotifications(prev => {
            // Merge with existing notifications and deduplicate
            const combined = [...dbNotifications, ...(prev || [])]
            const seen = new Set()
            return combined.filter(notif => {
              if (seen.has(notif.id)) return false
              seen.add(notif.id)
              return true
            }).slice(0, 50)
          })
        }
      } catch (e) {
        console.error('Error loading notifications:', e)
      }
      
      // Refresh friends list
      socket.emit("get_friends", session.user._id)
      
      // Refresh users list in add friend modal if it's open
      if (showAddFriendModal) {
        fetchAllUsers()
      }
      
      // If we're currently chatting with the friend who removed us, go back to main screen
      if (receiverId.current && data.removerUsername) {
        // Check if the current chat is with the remover
        const currentFriend = friends.find(f => f.friendid === receiverId.current)
        if (currentFriend && currentFriend.friendusername === data.removerUsername) {
          setActiveChat(null)
          setMessages([])
          window.history.pushState(null, '', '/')
          receiverId.current = null
        }
      }
    })

    // Listen for blocked message notifications
    socket.on("message_blocked", (data) => {
      console.log("Message blocked:", data)
      toast.error(data.message)
    })

    // Call functionality removed

    // Listen for friend block/unblock notifications
    socket.on("friend_block_notification", (data) => {
      console.log("Friend block notification:", data)
      // Refresh friends list to get updated block status
      socket.emit("get_friends", session.user._id)
      // Refresh users list in add friend modal if it's open
      if (showAddFriendModal) {
        fetchAllUsers()
      }
    })
    
    // Add general socket event logging (excluding friend_request_responded to prevent duplicates)
    socket.onAny((eventName, ...args) => {
      if (eventName !== 'friend_request_responded') {
        console.log("Socket event received:", eventName, args)
      }
    })
    
    // Test connection response
    socket.on("test_connection_response", (data) => {
      console.log("Test connection response:", data)
    })

    return () => {
      socket.off("friend_request_received", handleFriendRequest)
      socket.off("friend_request_responded", handleFriendRequestResponded)
      socket.off("friend_removed_notification")
      socket.off("message_blocked")
      // Call functionality removed
      socket.off("friend_block_notification")
      socket.offAny()
    }
  }, [sessionData?.user?._id])

  // Bridge notifications from global provider (in case user is on pages without UI component mounted)
  useEffect(() => {
    try {
      const initial = JSON.parse(sessionStorage.getItem('globalNotifications') || '[]')
      if (initial.length) {
        setNotifications(prev => {
          const existing = prev || []
          const merged = [...initial, ...existing]
          // Remove duplicates based on ID
          const unique = merged.filter((item, index, self) => 
            index === self.findIndex(t => t.id === item.id)
          )
          return unique.slice(0, 50)
        })
      }
    } catch {}

    const onGlobal = (e) => {
      const item = e.detail
      console.log('🌐 Global notification received:', item)
      setNotifications(prev => { 
        const existing = prev || []
        // Check if notification already exists to prevent duplicates
        const exists = existing.some(notif => notif.id === item.id)
        if (exists) {
          console.log('🚫 Duplicate global notification prevented:', item.id)
          return existing
        }
        console.log('✅ Adding global notification:', item.id)
        const next = [item, ...existing].slice(0, 50)
        saveGlobalNotifications(next)
        return next
      })
    }
    window.addEventListener('global-notification', onGlobal)
    return () => window.removeEventListener('global-notification', onGlobal)
  }, [])
  

  return (
  <>
    {isInitialLoading ? (
      <ChatlyLoader message="Loading your conversations..." />
    ) : (
      <>
        <div className="flex h-screen bg-gray-100 overflow-hidden">
          {/* Sidebar - Responsive width and visibility */}
          <div className={`
            ${isMobileView ? (showMobileSidebar ? 'w-full' : 'hidden') : 'w-1/3 md:w-1/3 lg:w-1/3'} 
            flex flex-col border-r border-gray-300 bg-white transition-all duration-300
          `}>
            <div className="flex justify-between items-center p-3 sm:p-4 bg-gray-200">
              <div className="flex items-center">
                <div className="relative group">
                  <Avatar 
                    key={`${sessionData?.user?._id}-${sessionData?.user?.profilePicture}-${avatarRefreshKey}-${forceRerender}`}
                    user={sessionData?.user} 
                    size="md" 
                    className="cursor-pointer hover:scale-105 transition-all duration-300"
                    onClick={() => setShowProfileModal(true)}
                    showUserIcon={false}
                  />
                  <div className="absolute top-11 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-pink-500 to-yellow-500 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">View Profile</div>
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-pink-500"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {/* Create Group Icon with Tooltip */}
                <div className="relative group">
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors duration-200"
                    aria-label="Create Group"
                  >
                    <Users size={20} className="text-gray-600 hover:text-purple-600 transition-colors duration-200" />
                  </button>
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">Create Group</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-purple-500"></div>
                  </div>
                </div>
                {/* Add Friend Icon with Tooltip */}
                <div className="relative group">
                  <UserPlus 
                    size={20} 
                    className="text-gray-600 cursor-pointer hover:text-blue-500 transition-colors duration-200" 
                    onClick={handleOpenAddFriendModal}
                  />
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">Add Friend</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-blue-500"></div>
                  </div>
                </div>

                {/* Chat Icon with New Messages Badge */}
                <div className="relative group">
                  <MessageCircle size={20} className="text-gray-600 cursor-pointer hover:text-green-500 transition-colors duration-200" />
                  {totalNewMessages > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-md animate-pulse">
                      {totalNewMessages}
                    </div>
                  )}
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-teal-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">New Chats ({totalNewMessages})</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-green-500"></div>
                  </div>
                </div>

                {/* Notification Icon with Dropdown */}
                <div className="relative group" ref={notificationRef}>
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications)
                    }}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors duration-200 relative"
                  >
                    <Bell size={20} className="text-gray-600 hover:text-blue-500 transition-colors duration-200" />
                    {((notifications?.length || 0) > 0 || (friendRequests?.length || 0) > 0) && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                        {(notifications?.length || 0) + (friendRequests?.length || 0)}
                      </span>
                    )}
                  </button>
                  
                  {/* Tooltip */}
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">Notifications</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-blue-500"></div>
                  </div>
                  
                  {/* Beautiful Notifications Modal (Centered with backdrop) */}
                  {showNotifications && (
                    <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center">
                      {/* Backdrop */}
                      <div
                        aria-hidden
                        onClick={() => setShowNotifications(false)}
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                      />
                      {/* Modal */}
                      <div className="relative mt-20 sm:mt-0 bg-white border border-gray-200 rounded-2xl shadow-2xl w-[90vw] max-w-[32rem] max-h-[80vh] overflow-y-auto bg-white/95 animate-[fadeIn_150ms_ease-out]">
                      {/* Header */}
                      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl sticky top-0 z-10">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-gray-800 text-lg">Notifications</h3>
                          <div className="flex items-center space-x-2">
                            {(((friendRequests?.length || 0) + (notifications?.length || 0)) > 0) && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                {(friendRequests?.length || 0) + (notifications?.length || 0)}
                              </span>
                            )}
                            <button
                              aria-label="Close"
                              onClick={() => setShowNotifications(false)}
                              className="ml-2 text-gray-500 hover:text-gray-700 rounded-full p-1 hover:bg-white/60"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        {/* Updates (responses) Section */}
                        {(notifications?.length || 0) > 0 && (
                          <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              <Bell className="w-4 h-4 mr-2 text-indigo-500" />
                              Updates
                            </h4>
                            <div className="space-y-3">
                              {notifications.map((n) => (
                                <div 
                                  key={n.id} 
                                  className={`group p-4 rounded-xl border hover:shadow-md transition-all duration-200 relative cursor-pointer ${
                                    n.type === 'group_added' 
                                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200' 
                                      : 'bg-white border-gray-200'
                                  } ${!n.isRead ? 'ring-2 ring-blue-200' : ''}`}
                                  onClick={() => {
                                    if (!n.isRead) {
                                      markNotificationAsRead(n.id)
                                      setNotifications(prev => 
                                        prev.map(notif => 
                                          notif.id === n.id ? { ...notif, isRead: true } : notif
                                        )
                                      )
                                    }
                                    // If it's a group addition notification, you could navigate to the group
                                    if (n.type === 'group_added' && n.data?.groupId) {
                                      // You could add navigation logic here if needed
                                    }
                                  }}
                                >
                                  <button
                                    aria-label="Dismiss notification"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      // Delete from database if it's a database notification
                                      if (n.id && !n.id.startsWith('group_added_')) {
                                        await deleteNotification(n.id)
                                      }
                                      // Remove from UI
                                      setNotifications(prev => { 
                                        const next=(prev||[]).filter(x=>x.id!==n.id); 
                                        saveGlobalNotifications(next); 
                                        return next; 
                                      })
                                    }}
                                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                                  >
                                    ×
                                  </button>
                                  <div className="flex items-start space-x-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow ${
                                      n.type === 'group_added' 
                                        ? 'bg-gradient-to-br from-purple-500 to-pink-600' 
                                        : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                    }`}>
                                      <span className="text-white text-sm font-bold">
                                        {n.type === 'group_added' ? '👥' : '!'}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-800">{n.title}</p>
                                      <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                                      <p className="text-xs text-gray-500 mt-1">{new Date(n.timestamp).toLocaleString?.() || new Date(n.timestamp).toLocaleString?.call(new Date(n.timestamp)) || ''}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Friend Requests Section */}
                        {(friendRequests?.length || 0) > 0 && (
                          <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              <UserPlus className="w-4 h-4 mr-2 text-blue-500" />
                              Friend Requests
                            </h4>
                            <div className="space-y-3">
                              {friendRequests.map((request) => (
                                <div key={request._id} className="group p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-md transition-all duration-200 relative">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 flex-1">
                                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                      <span className="text-white text-sm font-bold">
                                        {request.senderUsername.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-800 mb-1">
                                        {request.senderUsername}
                                      </p>
                                        <p className="text-xs text-gray-600 mb-1">
                                        wants to be your friend
                                      </p>
                                        <p className="text-xs text-gray-500">
                                        {new Date(request.createdAt).toLocaleString()}
                                      </p>
                                      </div>
                                    </div>
                                    
                                    {/* Action Buttons - Right Side */}
                                    <div className="flex space-x-2 ml-4">
                                        <button
                                          onClick={() => respondToFriendRequest(request._id, 'accept')}
                                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-medium rounded-full hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center space-x-1"
                                        >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        <span>Accept</span>
                                        </button>
                                        <button
                                          onClick={() => respondToFriendRequest(request._id, 'decline')}
                                        className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-medium rounded-full hover:from-red-600 hover:to-rose-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center space-x-1"
                                        >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                        <span>Decline</span>
                                        </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Messages are not shown in notifications dropdown */}

                        {/* No notifications */}
                        {((friendRequests?.length || 0) + (notifications?.length || 0)) === 0 && (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Bell className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium">No notifications yet</p>
                            <p className="text-gray-400 text-xs mt-1">You'll see friend requests and messages here</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Footer with clear button */}
                      {(((friendRequests?.length || 0) + (notifications?.length || 0)) > 0) && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-gray-500">
                              {(friendRequests?.length || 0) + (notifications?.length || 0)} total
                            </div>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Conference Call functionality removed */}

                {/* Sort Icon with Tooltip */}
                <div className="relative group">
                  <button
                    onClick={() => {
                      const nextSort = sortOrder === 'name' ? 'recent' : sortOrder === 'recent' ? 'unread' : 'name';
                      setSortOrder(nextSort);
                    }}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors duration-200"
                    title={`Sort by ${sortOrder === 'name' ? 'Recent' : sortOrder === 'recent' ? 'Unread' : 'Name'}`}
                  >
                    <ArrowUpDown size={20} className="text-gray-600 hover:text-orange-500 transition-colors duration-200" />
                  </button>
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">Sort by {sortOrder === 'name' ? 'Recent' : sortOrder === 'recent' ? 'Unread' : 'Name'}</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-orange-500"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-gray-100">
              <div className="flex items-center bg-white rounded-lg px-2 sm:px-3 py-2">
                <Search size={18} className="mr-2 text-gray-500" />
                <input
                  type="text"
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search or start new chat"
                  className="w-full outline-none text-sm bg-transparent placeholder-gray-400"
                />
              </div>
            </div>

            <div key={friendsListKey} className="flex-1 overflow-y-auto">
              {/* Combined Chat List */}
              {(() => {
                // Create combined list with proper sorting
                const combinedList = [
                  // AI friends first
                  ...filteredFriends.filter(chat => chat.friendusername.toLowerCase().includes('ai')).map(chat => ({
                    ...chat,
                    type: 'friend',
                    displayName: chat.friendusername,
                    id: chat.friendid,
                    isAI: true
                  })),
                  // Groups after AI friends
                  ...groups.map(group => ({
                    ...group,
                    type: 'group',
                    displayName: group.name,
                    id: `group_${group._id}`,
                    isAI: false
                  })),
                  // Regular friends last
                  ...filteredFriends.filter(chat => !chat.friendusername.toLowerCase().includes('ai')).map(chat => ({
                    ...chat,
                    type: 'friend',
                    displayName: chat.friendusername,
                    id: chat.friendid,
                    isAI: false
                  }))
                ];

                // Apply sorting while keeping AI friends at the top
                const sortedList = combinedList.sort((a, b) => {
                  // AI friends always stay at the top
                  if (a.isAI && !b.isAI) return -1;
                  if (!a.isAI && b.isAI) return 1;
                  if (a.isAI && b.isAI) return 0; // AI friends maintain their order
                  
                  // For non-AI items, apply sorting
                  switch (sortOrder) {
                    case 'name':
                      return a.displayName.localeCompare(b.displayName);
                    case 'recent':
                      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
                    case 'unread':
                      const aUnread = newMessageCounts[a.id] || 0;
                      const bUnread = newMessageCounts[b.id] || 0;
                      return bUnread - aUnread;
                    default:
                      return 0;
                  }
                });

                return sortedList.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center px-2 sm:px-3 py-2 sm:py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 transition-all duration-200 ${
                      activeChat === item.id ? 'bg-gray-200' : ''
                    } ${item.isAI ? 'bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100' : ''}`}
                    onClick={() => onClick(item.id)}
                  >
                    <div className="flex items-center mr-3">
                      {item.type === 'group' ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center shadow-md">
                          <Users size={20} className="text-white" />
                        </div>
                      ) : item.isAI ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                          <Bot size={20} className="text-white" />
                        </div>
                      ) : (
                        <Avatar 
                          key={`${item.friendid}-${item.friendprofilepicture}-${avatarRefreshKey}-${forceRerender}`}
                          user={{ 
                            username: item.friendusername, 
                            profilePicture: item.friendprofilepicture 
                          }} 
                          size="md"
                          showUserIcon={false}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                <h3 className={`font-semibold text-sm ${
                  item.isAI ? 'text-indigo-700' : 'text-gray-800'
                }`}>
                  {item.displayName}
                </h3>
                        {newMessageCounts[item.id] > 0 && (
                          <div className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-md">
                            {newMessageCounts[item.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="border-t border-gray-300 p-3 bg-gray-200">
              {/* Sign Out moved to top */}
              <div 
                onClick={SignOut}
                className="flex items-center justify-between cursor-pointer hover:bg-gray-300 p-2 rounded"
              >
                <div className="flex items-center">
                  <LogOut size={20} className="text-gray-600 mr-2" />
                  <span className="text-sm font-medium">Sign Out</span>
                </div>
              </div>

              {/* Delete Account button */}
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-red-100 p-2 rounded mt-1"
                onClick={() => setShowDeleteAccountModal(true)}
              >
                <div className="flex items-center">
                  <Trash size={20} className="text-red-600 mr-2" />
                  <span className="text-sm font-medium text-red-700">Delete Account</span>
                </div>
              </div>

            {/* Hidden input for file selection */}
            <input ref={fileInputRef} type="file" className="hidden" onChange={handlePickFile} />
            

              {showFriends && (
                <div className="mt-2 bg-white rounded-lg p-3 shadow">
                  <h4 className="font-medium text-sm mb-2">Friends List</h4>
                  <div className="max-h-48 overflow-y-auto">
                    {friends.map(friend => {
                      const isAI = friend.friendusername.toLowerCase().includes('ai');
                      console.log('Rendering friend:', {
                        username: friend.friendusername,
                        profilePicture: friend.friendprofilepicture,
                        safeUrl: getSafeProfilePictureUrl(friend.friendprofilepicture)
                      })
                      return (
                        <div
                          key={friend._id}
                          className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded transition-all duration-200 ${
                            isAI ? 'bg-gradient-to-r from-indigo-50 to-purple-50' : ''
                          }`}
                          onClick={() => {
                            handleMobileChatSelect(friend._id);
                            setShowFriends(false);
                          }}
                        >
                          <div className="flex items-center mr-2">
                            {isAI ? (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Bot size={16} className="text-white" />
                              </div>
                            ) : (
                              <Avatar 
                                key={`friend-${friend.friendid}`}
                                user={{ 
                                  username: friend.friendusername, 
                                  profilePicture: friend.friendprofilepicture 
                                }} 
                                size="sm"
                                showUserIcon={false}
                              />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-sm ${
                              isAI ? 'text-indigo-700 font-medium' : 'text-gray-800'
                            }`}>
                              {friend.friendusername}
                            </span>
                            {friend.isBlocked && (
                              <span className="text-xs text-red-600 font-medium">Blocked</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 border-t pt-2">
                    <button className="flex items-center text-green-600 text-sm font-medium" onClick={handleOpenAddFriendModal}>
                      <UserPlus size={16} className="mr-1" />
                      Add New Friend
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

                {/* Create Group Modal */}
                {showCreateGroup && (
                  <div className="fixed inset-0 z-[1000] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateGroup(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-11/12 sm:w-[92vw] max-w-[680px] max-h-[90vh] overflow-y-auto">
                      <div className="p-5 border-b bg-gradient-to-r from-purple-50 to-pink-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 rounded-lg bg-purple-100">
                              <Users className="text-purple-600" size={18} />
                            </div>
                            <h3 className="font-semibold text-gray-800">Create Group</h3>
                          </div>
                          <button className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" onClick={() => setShowCreateGroup(false)}>×</button>
                        </div>
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Group name</label>
                          <input value={newGroupName} onChange={(e)=>{setNewGroupName(e.target.value); setGroupNameServerError("")}} placeholder="e.g. Weekend Trip" className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${groupSubmitAttempted && newGroupName.trim().length === 0 ? 'border-red-300 focus:ring-red-300' : groupNameServerError ? 'border-red-300 focus:ring-red-300' : 'focus:ring-purple-400'}`} />
                          {groupSubmitAttempted && newGroupName.trim().length === 0 && (
                            <p className="mt-1 text-xs text-red-500">Group name is required.</p>
                          )}
                          {groupNameServerError && (
                            <p className="mt-1 text-xs text-red-500">{groupNameServerError}</p>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs text-gray-600">Invite friends</label>
                            <span className="text-xs text-gray-500">{selectedInviteeIds.length} selected</span>
                          </div>
                          <div className="mb-2">
                            <input
                              type="text"
                              placeholder="Search friends"
                              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                              value={groupSearch}
                              onChange={(e)=>{
                                const val = e.target.value
                                setGroupSearch(val)
                                const q = val.toLowerCase()
                                const filtered = friends.filter((f)=> f.friendusername.toLowerCase().includes(q) && !f.friendusername.toLowerCase().includes('ai'))
                                setGroupFilteredFriends(filtered)
                              }}
                            />
                          </div>
                          <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(groupSearch ? groupFilteredFriends : friends).filter(f=> !f.friendusername.toLowerCase().includes('ai')).map((f)=> (
                              <button type="button" key={f.friendid} onClick={()=>{
                                setSelectedInviteeIds((prev)=> prev.includes(f.friendid) ? prev.filter(id=> id!==f.friendid) : [...prev, f.friendid])
                              }} className={`flex items-center justify-between p-2 rounded-lg border text-left ${selectedInviteeIds.includes(f.friendid) ? 'bg-purple-50 border-purple-300' : 'hover:bg-purple-50'}`}>
                                <span className="text-sm text-gray-700">{f.friendusername}</span>
                                {selectedInviteeIds.includes(f.friendid) && <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Selected</span>}
                              </button>
                            ))}
                            {((groupSearch ? groupFilteredFriends : friends).filter(f=> !f.friendusername.toLowerCase().includes('ai')).length === 0) && (
                              <div className="col-span-2 text-center text-sm text-gray-500 py-6">No friends found</div>
                            )}
                          </div>
                          {groupSubmitAttempted && selectedInviteeIds.length === 0 && (
                            <p className="mt-1 text-xs text-red-500">Select at least one friend to invite.</p>
                          )}
                        </div>
                      </div>
                      <div className="p-5 border-t bg-gray-50 flex items-center justify-end space-x-2">
            <button className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" disabled={isCreatingGroup} onClick={()=> setShowCreateGroup(false)}>Cancel</button>
            <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-60 disabled:cursor-not-allowed" disabled={isCreatingGroup} onClick={async ()=>{
                          setGroupSubmitAttempted(true)
                          if(!newGroupName.trim() || selectedInviteeIds.length === 0) return;
                          try {
                            setIsCreatingGroup(true)
                            const res = await fetch('/api/groups/create',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name:newGroupName})})
                            const data = await res.json()
                            if(data?.success){
                              setGroups((prev) => {
                                const newGroups = [data.data.group, ...prev]
                                return deduplicateGroups(newGroups)
                              })
                              // send invites
                              await Promise.all(selectedInviteeIds.map((uid)=> fetch('/api/groups/invite',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({groupId: data.data.group._id, inviteeId: uid})})))
                              // cleanup + UX
                              setNewGroupName("")
                              setSelectedInviteeIds([])
                              setGroupSubmitAttempted(false)
                              setGroupSearch("")
                              setGroupFilteredFriends([])
                              setShowCreateGroup(false)
                              // Don't show toast here - let socket event handle it to avoid duplicate notifications
                            } else {
                              if (data?.statusCode === 409 || (data?.message || '').toLowerCase().includes('exists')) {
                                setGroupNameServerError(data?.message || 'Group name already exists. Choose another name.')
                              } else {
                                toast.error(data?.message || 'Failed to create group')
                              }
                            }
                          } catch (e) {
                            toast.error('Failed to create group')
                          } finally {
                            setIsCreatingGroup(false)
                          }
                        }}>{isCreatingGroup ? 'Creating...' : 'Create'}</button>
                      </div>
                    </div>
                  </div>
                )}

          {/* Chat Window - Responsive width and visibility */}
          <div className={`
            ${isMobileView ? (showMobileSidebar ? 'hidden' : 'w-full') : 'w-2/3 md:w-2/3 lg:w-2/3'} 
            flex flex-col transition-all duration-300
          `}>
            {activeChat ? (
              <>
                <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-200 border-b border-gray-300 sticky top-0 z-30">
                  <div className="flex items-center">
                    <div className="mr-3">
                      <button 
                        onClick={handleMobileBackToSidebar}
                        className="text-gray-600 cursor-pointer hover:text-gray-800 transition-colors p-2 hover:bg-gray-300 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center" 
                      >
                        <ChevronLeft size={24} />
                      </button>
                    </div>
                    <div className="flex items-center">
                      {receiverId.current?.startsWith('group_') ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mr-3">
                          <Users size={20} className="text-white" />
                        </div>
                      ) : (() => {
                        const currentFriend = friends.find(f => f.friendid === receiverId.current);
                        const isAI = currentFriend?.friendusername?.toLowerCase().includes('ai');
                        
                        if (isAI) {
                          return (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mr-3">
                              <Bot size={20} className="text-white" />
                            </div>
                          );
                        }
                        
                        return (
                          <Avatar 
                            user={{
                              username: currentFriend?.friendusername || 'Friend',
                              profilePicture: currentFriend?.friendprofilepicture
                            }}
                            size="md"
                            className="mr-3"
                          />
                        );
                      })()}
                     <div>
  <h3 className="font-semibold text-sm text-gray-800">
    {receiverId.current?.startsWith('group_') 
      ? groups.find(g => g._id === receiverId.current.replace('group_', ''))?.name || 'Group'
      : friends.find(f => f.friendid === receiverId.current)?.friendusername || 'Friend'
    }
  </h3>
  {(() => {
    // Handle group chats - no status display
    if (receiverId.current?.startsWith('group_')) {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
          <span className="text-xs text-blue-600">Group Chat</span>
        </div>
      );
    }
    
    const currentFriend = friends.find(f => f.friendid === receiverId.current);
    const isAI = currentFriend?.friendusername.toLowerCase().includes('ai');
    const isBlocked = currentFriend?.isBlocked;
    const currentFriendId = receiverId.current;
    const friendStatus = userStatus[currentFriendId] || status;
    
    if (isAI) {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
          <span className="text-xs text-green-600 font-medium">AI Assistant Online</span>
        </div>
      );
    }
    
    if (isBlocked) {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
          <span className="text-xs text-red-600 font-medium">Blocked</span>
        </div>
      );
    }
    
    if (isTyping) {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
          <span className="text-xs text-blue-600">Typing...</span>
        </div>
      );
    }
    
    if (friendStatus === "online" || status === "online") {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
          <span className="text-xs text-gray-500">Online</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center">
        <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
        <span className="text-xs text-gray-500">Offline</span>
      </div>
    );
  })()}
</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {(() => {
                      const currentFriend = friends.find(f => f.friendid === receiverId.current);
                      const isAI = currentFriend?.friendusername.toLowerCase().includes('ai');
                      const isBlocked = currentFriend?.isBlocked;
                      
                      if (isAI) {
                        // AI Chat - Only show search button
                        return (
                          <>
                            {/* Search Messages with Enhanced Functionality */}
                            <div className="relative group">
                              <Search 
                                size={20} 
                                className="text-gray-600 cursor-pointer hover:text-purple-500 transition-colors duration-200" 
                                onClick={() => setIsSearchActive(true)}
                              />
                              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                                <div className="font-medium">Search Messages</div>
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-purple-500"></div>
                              </div>
                            </div>
                          </>
                        );
                      }
                      
                      // Regular Chat - Show buttons based on chat type
                      const isGroupChat = receiverId.current?.startsWith('group_');
                      
                      if (isGroupChat) {
                        // Group Chat - Only show search button
                        return (
                          <>
                            {/* Search with Tooltip */}
                            <div className="relative group">
                              <Search 
                                size={20} 
                                className="text-gray-600 cursor-pointer hover:text-purple-500 transition-colors duration-200" 
                                onClick={() => setIsSearchActive(true)}
                              />
                              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                                <div className="font-medium">Search Messages</div>
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-purple-500"></div>
                              </div>
                            </div>
                          </>
                        );
                      } else {
                        // Friend Chat - Show all buttons
                        return (
                          <>
                            {/* Call functionality removed */}

                            {/* Video and Voice Call Buttons - Only for friend chat */}
                            {!receiverId.current?.startsWith('group_') && (
                              <>
                                {/* Voice Call Button */}
                            <div className="relative group">
                                  <button
                                    onClick={() => {
                                      toast.info("This feature is unavailable. Contact developer to enable it.", {
                                        position: "top-right",
                                        autoClose: 3000,
                                        hideProgressBar: false,
                                        closeOnClick: true,
                                        pauseOnHover: true,
                                        draggable: true,
                                      });
                                    }}
                                    className="p-2 rounded-full transition-all duration-200 bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  >
                                    <Phone className="w-4 h-4" />
                                  </button>
                                  <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                                    <div className="font-medium">Voice Call</div>
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-blue-500"></div>
                              </div>
                            </div>

                                {/* Video Call Button */}
                            <div className="relative group">
                                  <button
                                    onClick={() => {
                                      toast.info("This feature is unavailable. Contact developer to enable it.", {
                                        position: "top-right",
                                        autoClose: 3000,
                                        hideProgressBar: false,
                                        closeOnClick: true,
                                        pauseOnHover: true,
                                        draggable: true,
                                      });
                                    }}
                                    className="p-2 rounded-full transition-all duration-200 bg-purple-100 text-purple-700 hover:bg-purple-200"
                                  >
                                    <Video className="w-4 h-4" />
                                  </button>
                                  <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                                    <div className="font-medium">Video Call</div>
                                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-purple-500"></div>
                              </div>
                            </div>
                              </>
                            )}

                            {/* Block/Unblock Button */}
                            <div className="relative group">
                              <button
                                onClick={() => handleBlockFriend(receiverId.current, isBlocked ? 'unblock' : 'block')}
                                disabled={blockLoading[receiverId.current]}
                                className={`p-2 rounded-full transition-all duration-200 ${
                                  isBlocked 
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {blockLoading[receiverId.current] ? (
                                  <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" />
                                  </svg>
                                )}
                              </button>
                              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-500 to-pink-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                                <div className="font-medium">{isBlocked ? 'Unblock Friend' : 'Block Friend'}</div>
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-red-500"></div>
                              </div>
                            </div>

                            {/* Remove Friend Button */}
                            <div className="relative group">
                              <button
                                onClick={() => handleRemoveFriend(receiverId.current, currentFriend?.friendusername)}
                                disabled={removeLoading[receiverId.current]}
                                className="p-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {removeLoading[receiverId.current] ? (
                                  <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <line x1="22" x2="16" y1="11" y2="11"></line>
                                  </svg>
                                )}
                              </button>
                              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-gray-500 to-gray-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                                <div className="font-medium">Remove Friend</div>
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-500"></div>
                              </div>
                            </div>

                            {/* Search with Tooltip */}
                            <div className="relative group">
                              <Search 
                                size={20} 
                                className="text-gray-600 cursor-pointer hover:text-purple-500 transition-colors duration-200" 
                                onClick={() => setIsSearchActive(true)}
                              />
                              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                                <div className="font-medium">Search Messages</div>
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-purple-500"></div>
                              </div>
                            </div>
                          </>
                        );
                      }
                    })()}

                    {/* More Options with Enhanced Dropdown */}
                    <div className="relative chat-options-menu">
                      <button 
                        onClick={() => setShowChatOptionsMenu(!showChatOptionsMenu)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <MoreVertical size={20} className="text-gray-600 hover:text-orange-500 transition-colors duration-200" />
                      </button>
                      
                      {/* Enhanced Dropdown Menu */}
                      {showChatOptionsMenu && (
                        <div className="absolute top-12 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 min-w-56 sm:min-w-64 overflow-hidden transform transition-all duration-300 scale-95 animate-in zoom-in-95">
                        {/* Gradient Header */}
                        <div className="bg-gradient-to-r from-red-500 to-pink-600 px-4 py-3">
                          <h4 className="text-white text-sm font-semibold flex items-center">
                            Chat Options
                          </h4>
                        </div>
                        
                        {/* Menu Items */}
                        <div className="py-2 bg-gradient-to-b from-gray-50 to-white">
                          {/* Export Chat */}
                          <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-green-400" onClick={exportChat}>
                            <div className="p-2 bg-green-100 rounded-lg mr-3 group-hover/item:bg-green-200 transition-colors duration-200">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-800 group-hover/item:text-green-700">Export Chat</span>
                              <p className="text-xs text-gray-500 group-hover/item:text-green-500">Download conversation as JSON</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-400 group-hover/item:text-green-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>

                          {/* Mute Notifications */}
                          <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-orange-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-yellow-400" onClick={toggleMuteNotifications}>
                            <div className="p-2 bg-yellow-100 rounded-lg mr-3 group-hover/item:bg-yellow-200 transition-colors duration-200">
                              <Bell size={16} className="text-yellow-600" />
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-800 group-hover/item:text-yellow-700">
                                {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                              </span>
                              <p className="text-xs text-gray-500 group-hover/item:text-yellow-500">
                                {isMuted ? 'Enable notifications for this chat' : 'Silence this conversation'}
                              </p>
                            </div>
                            <svg className="w-4 h-4 text-gray-400 group-hover/item:text-yellow-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>

                          {/* Group Members */}
                          {receiverId.current?.startsWith('group_') && (
                            <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-blue-400" onClick={showGroupMembers}>
                              <div className="p-2 bg-blue-100 rounded-lg mr-3 group-hover/item:bg-blue-200 transition-colors duration-200">
                                <Users size={16} className="text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-800 group-hover/item:text-blue-700">Group Members</span>
                                <p className="text-xs text-gray-500 group-hover/item:text-blue-500">View all group members</p>
                              </div>
                              <svg className="w-4 h-4 text-gray-400 group-hover/item:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          )}

                          {/* Group Management Options */}
                          {receiverId.current?.startsWith('group_') && (() => {
                            const groupId = receiverId.current.replace('group_', '');
                            const currentGroup = groups.find(g => g._id === groupId);
                            // ownerId can be populated object or raw ObjectId/string; normalize both sides
                            const ownerIdValue = currentGroup?.ownerId && typeof currentGroup.ownerId === 'object'
                              ? (currentGroup.ownerId._id || currentGroup.ownerId)
                              : currentGroup?.ownerId;
                            const ownerIdStr = ownerIdValue ? ownerIdValue.toString() : null;
                            const userIdStr = sessionData?.user?._id ? sessionData.user._id.toString() : null;
                            const isGroupOwner = !!ownerIdStr && !!userIdStr && ownerIdStr === userIdStr;
                            
                            if (isGroupOwner) {
                              // Group Owner - Show Delete Group option
                              return (
                                <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-red-400" onClick={showDeleteGroupConfirmation}>
                                  <div className="p-2 bg-red-100 rounded-lg mr-3 group-hover/item:bg-red-200 transition-colors duration-200">
                                    <Trash size={16} className="text-red-600" />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-gray-800 group-hover/item:text-red-700">Delete Group</span>
                                    <p className="text-xs text-gray-500 group-hover/item:text-red-500">Permanently delete this group</p>
                                  </div>
                                  <svg className="w-4 h-4 text-gray-400 group-hover/item:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              );
                            } else {
                              // Group Member - Show Exit Group option
                              return (
                                <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-orange-400" onClick={showLeaveGroupConfirmation}>
                                  <div className="p-2 bg-orange-100 rounded-lg mr-3 group-hover/item:bg-orange-200 transition-colors duration-200">
                                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-gray-800 group-hover/item:text-orange-700">Exit Group</span>
                                    <p className="text-xs text-gray-500 group-hover/item:text-orange-500">Leave this group</p>
                                  </div>
                                  <svg className="w-4 h-4 text-gray-400 group-hover/item:text-orange-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              );
                            }
                          })()}

                          {/* Clear All Chat - Moved to bottom */}
                          <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-red-400" onClick={clearAllMessages}>
                            <div className="p-2 bg-red-100 rounded-lg mr-3 group-hover/item:bg-red-200 transition-colors duration-200">
                              <Trash size={16} className="text-red-600" />
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-800 group-hover/item:text-red-700">Clear All Chat</span>
                              <p className="text-xs text-gray-500 group-hover/item:text-red-500">Delete entire conversation</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-400 group-hover/item:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                        
                        {/* Footer with subtle gradient */}
                        <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-4 py-2">
                          <p className="text-xs text-gray-600 text-center">More options coming soon</p>
                        </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Search Bar - WhatsApp Style */}
                {isSearchActive && (
                  <div className="bg-gray-100 border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center space-x-3">
                      {/* Search Input */}
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Search within chat"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value.trim()) {
                              searchMessages();
                            } else {
                              setSearchResults([]);
                            }
                          }}
                          onKeyPress={(e) => e.key === 'Enter' && searchMessages()}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                          autoFocus
                        />
                      </div>
                      
                      {/* Navigation Buttons */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigateSearch('prev')}
                          disabled={searchResults.length === 0}
                          className="p-2 text-gray-600 hover:text-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={() => navigateSearch('next')}
                          disabled={searchResults.length === 0}
                          className="p-2 text-gray-600 hover:text-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={closeSearch}
                          className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Search Results Info */}
                    {searchResults.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        {currentSearchIndex + 1} of {searchResults.length} results
                      </div>
                    )}
                    
                    {searchQuery && searchResults.length === 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        No messages found matching "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4" style={{ scrollBehavior: 'smooth' }}>
                  {isLoading ? (
                    <ChatLoader />
                  ) : (
                    <div className="flex flex-col space-y-2">
                      {groupMessagesByDate(messages || []).map((item, index) => {
                        // Handle date separators
                        if (item.type === 'date') {
                          return (
                            <div key={item.key} className="flex justify-center my-4">
                              <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                {item.date}
                              </div>
                            </div>
                          )
                        }
                        
                        const message = item;
                        // Handle system messages (like leave notifications)
                        if (message.isSystemMessage) {
                          return (
                            <div key={index} className="flex justify-center my-3">
                              <div className="bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 text-sm px-6 py-3 rounded-full border-2 border-orange-200 shadow-lg animate-pulse">
                                <span className="flex items-center space-x-2 font-medium">
                                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>{message.content}</span>
                                </span>
                              </div>
                            </div>
                          )
                        }
                        
                        return (
                        <div
                          key={index}
                          data-message-id={message._id}
                          className={`flex ${message.senderid == sessionData?.user?._id ? 'justify-end' : 'justify-start'} ${message.content == "Message Deleted" ? "mr-15" : ""}`}
                        >
                          <div className="flex items-center group">
                            {/* Copy button for receiver messages (left side) - only for text messages */}
                            {message.senderid !== sessionData?.user?._id && message.content !== "Message Deleted" && !message.attachment && (
                              <div className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button 
                                  onClick={() => copyMessage(message)}
                                  className={`p-1.5 rounded-full shadow-sm transform hover:scale-110 transition-all duration-200 ${copiedMessageId === message._id ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}
                                  title={copiedMessageId === message._id ? 'Copied!' : 'Copy message'}
                                >
                                  {copiedMessageId === message._id ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                  )}
                                </button>
                              </div>
                            )}

                            <div
                              className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg shadow-sm ${
                                message.senderid === sessionData?.user?._id
                                  ? 'bg-green-100 rounded-tr-none'
                                  : 'bg-white rounded-tl-none'
                              } ${message.content == "Message Deleted" ? "bg-red-300 rounded-tr-none pointer-events-none opacity-50" : ""} ${
                                message.senderid === sessionData?.user?._id ? 'flex flex-col items-end' : ''
                              }`}
                            >
                              {/* Render attachment if exists and message is not deleted */}
                              {message.attachment && message.attachment.url && message.content !== "Message Deleted" && (
                                <div className={`mb-2 ${message.senderid === sessionData?.user?._id ? 'w-full' : ''}`}>
                                  
                                  {message.attachment.resourceType === 'image' && message.attachment.format && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(message.attachment.format.toLowerCase()) && !message.attachment.format.toLowerCase().includes('pdf') && (
                                    <div className="relative">
                                      <img 
                                        src={message.attachment.secureUrl || message.attachment.url} 
                                        alt={message.attachment.originalFilename || 'Image'} 
                                        className="max-w-80 max-h-80 w-auto h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
                                        onClick={async (e) => {
                                          e.stopPropagation()
                                          try {
                                            // Download image directly instead of opening in new tab
                                            const response = await fetch(message.attachment.secureUrl || message.attachment.url)
                                            const blob = await response.blob()
                                            const url = window.URL.createObjectURL(blob)
                                            const link = document.createElement('a')
                                            link.href = url
                                            link.download = message.attachment.originalFilename || 'image'
                                            document.body.appendChild(link)
                                            link.click()
                                            document.body.removeChild(link)
                                            window.URL.revokeObjectURL(url)
                                          } catch (error) {
                                            console.error('Download failed:', error)
                                            // Fallback: try direct download
                                            const link = document.createElement('a')
                                            link.href = message.attachment.secureUrl || message.attachment.url
                                            link.download = message.attachment.originalFilename || 'image'
                                            document.body.appendChild(link)
                                            link.click()
                                            document.body.removeChild(link)
                                          }
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                          console.error('Failed to load image:', message.attachment.url)
                                        }}
                                      />
                                      {message.content !== "Message Deleted" && (
                                        <div className="absolute top-2 right-2">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              try {
                                                const response = await fetch(message.attachment.secureUrl || message.attachment.url)
                                                const blob = await response.blob()
                                                const url = window.URL.createObjectURL(blob)
                                                const link = document.createElement('a')
                                                link.href = url
                                                link.download = message.attachment.originalFilename || 'image'
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                                window.URL.revokeObjectURL(url)
                                              } catch (error) {
                                                console.error('Download failed:', error)
                                                // Fallback to direct link
                                                const link = document.createElement('a')
                                                link.href = message.attachment.secureUrl || message.attachment.url
                                                link.download = message.attachment.originalFilename || 'image'
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                              }
                                            }}
                                            className="bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-70"
                                            title="Download image"
                                          >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {message.attachment.resourceType === 'video' && (
                                    <div className="relative">
                                      <video 
                                        src={message.attachment.secureUrl || message.attachment.url} 
                                        controls
                                        className="max-w-80 max-h-80 w-auto h-auto rounded-lg object-cover shadow-lg hover:shadow-xl transition-shadow duration-200"
                                        preload="metadata"
                                        onLoadedMetadata={(e) => {
                                          // Generate thumbnail if not available
                                          if (!message.attachment.thumbnailUrl && e.target.duration > 0) {
                                            // Set to 1 second to capture a good thumbnail
                                            e.target.currentTime = Math.min(1, e.target.duration * 0.1);
                                          }
                                        }}
                                        onSeeked={(e) => {
                                          // Generate thumbnail after seeking
                                          if (!message.attachment.thumbnailUrl && e.target.currentTime > 0) {
                                            const canvas = document.createElement('canvas');
                                            const ctx = canvas.getContext('2d');
                                            canvas.width = e.target.videoWidth;
                                            canvas.height = e.target.videoHeight;
                                            ctx.drawImage(e.target, 0, 0, canvas.width, canvas.height);
                                            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
                                            e.target.poster = thumbnailUrl;
                                            // Reset to beginning immediately and pause
                                            e.target.currentTime = 0;
                                            e.target.pause();
                                          }
                                        }}
                                        onError={(e) => {
                                          console.error('Failed to load video:', message.attachment.url)
                                        }}
                                      />
                                      {message.content !== "Message Deleted" && (
                                        <div className="absolute top-2 right-2">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              try {
                                                const response = await fetch(message.attachment.secureUrl || message.attachment.url)
                                                const blob = await response.blob()
                                                const url = window.URL.createObjectURL(blob)
                                                const link = document.createElement('a')
                                                link.href = url
                                                link.download = message.attachment.originalFilename || 'video'
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                                window.URL.revokeObjectURL(url)
                                              } catch (error) {
                                                console.error('Download failed:', error)
                                                // Fallback to direct link
                                                const link = document.createElement('a')
                                                link.href = message.attachment.secureUrl || message.attachment.url
                                                link.download = message.attachment.originalFilename || 'video'
                                                link.target = '_blank'
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                              }
                                            }}
                                            className="bg-blue-600 text-white p-1 rounded-full hover:bg-blue-700 shadow-lg border border-white"
                                            title="Download video"
                                          >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {message.attachment.resourceType === 'video' && message.attachment.format && ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(message.attachment.format.toLowerCase()) && (
                                    <div className="flex items-center space-x-4 p-4 bg-purple-50 rounded-lg border max-w-80">
                                      <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{message.attachment.originalFilename}</p>
                                        <p className="text-xs text-gray-500">
                                          {message.attachment.bytes ? `${(message.attachment.bytes / 1024 / 1024).toFixed(2)} MB` : 'Audio'}
                                        </p>
                                      </div>
                                      {message.content !== "Message Deleted" && (
                                        <div className="flex space-x-1">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              try {
                                                const response = await fetch(message.attachment.secureUrl || message.attachment.url)
                                                const blob = await response.blob()
                                                const url = window.URL.createObjectURL(blob)
                                                const link = document.createElement('a')
                                                link.href = url
                                                link.download = message.attachment.originalFilename || 'audio'
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                                window.URL.revokeObjectURL(url)
                                              } catch (error) {
                                                console.error('Download failed:', error)
                                                // Fallback to direct link
                                                const link = document.createElement('a')
                                                link.href = message.attachment.secureUrl || message.attachment.url
                                                link.download = message.attachment.originalFilename || 'audio'
                                                link.target = '_blank'
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                              }
                                            }}
                                            className="bg-purple-500 hover:bg-purple-600 text-white p-1 rounded-full transition-colors flex-shrink-0"
                                            title="Download audio"
                                          >
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                          {message.senderid === sessionData?.user?._id && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                deleteMessage(message._id)
                                              }}
                                              className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full transition-colors flex-shrink-0"
                                              title="Delete audio"
                                            >
                                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {(message.attachment.resourceType === 'raw' || message.attachment.format?.toLowerCase().includes('pdf')) && (
                                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border max-w-80">
                                      <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
                                        {message.attachment.format?.toLowerCase().includes('pdf') ? (
                                          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                          </svg>
                                        ) : (
                                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{message.attachment.originalFilename}</p>
                                        <p className="text-xs text-gray-500">
                                          {message.attachment.bytes ? `${(message.attachment.bytes / 1024 / 1024).toFixed(2)} MB` : 'Document'}
                                        </p>
                                      </div>
                                      {message.content !== "Message Deleted" && (
                                        <div className="flex space-x-1">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              // Use signed download URL for untrusted accounts
                                              try {
                                                console.log('Download request data:', {
                                                  publicId: message.attachment.publicId,
                                                  resourceType: message.attachment.resourceType,
                                                  downloadName: message.attachment.originalFilename,
                                                  fullAttachment: message.attachment
                                                })
                                                
                                                const res = await fetch('/api/cloudinary-download', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    publicId: message.attachment.publicId,
                                                    resourceType: message.attachment.resourceType,
                                                    downloadName: message.attachment.originalFilename,
                                                  })
                                                })
                                                if (!res.ok) throw new Error('Failed to generate download URL')
                                                const data = await res.json()
                                                const signedUrl = data?.data?.url || data?.url
                                                if (!signedUrl) throw new Error('No signed URL returned')

                                                // Try signed URL first
                                                const response = await fetch(signedUrl)
                                                if (response.ok) {
                                                  const blob = await response.blob()
                                                const url = window.URL.createObjectURL(blob)
                                                const link = document.createElement('a')
                                                link.href = url
                                                link.download = message.attachment.originalFilename || 'document'
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                                window.URL.revokeObjectURL(url)
                                                } else {
                                                  // If signed URL fails, open in new tab
                                                  window.open(signedUrl, '_blank')
                                                }
                                              } catch (error) {
                                                console.error('Download failed:', error)
                                                // Final fallback: try direct URL
                                                // For raw files (documents), add fl_attachment flag to ensure download
                                                let directUrl = message.attachment.secureUrl || message.attachment.url
                                                if (message.attachment.resourceType === 'raw' && directUrl) {
                                                  // Add fl_attachment flag to the URL for raw files
                                                  // URL format: https://res.cloudinary.com/cloud/raw/upload/v123/public_id.format
                                                  // Should become: https://res.cloudinary.com/cloud/raw/upload/fl_attachment:filename/v123/public_id.format
                                                  const filename = message.attachment.originalFilename || 'document'
                                                  // Sanitize filename to remove special characters that break Cloudinary URLs
                                                  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
                                                  if (directUrl.includes('/upload/')) {
                                                    // Insert fl_attachment:filename after /upload/ and before /v (version)
                                                    directUrl = directUrl.replace('/upload/', '/upload/fl_attachment:' + safeName + '/')
                                                  }
                                                }
                                                window.open(directUrl, '_blank')
                                              }
                                            }}
                                            className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-full transition-colors flex-shrink-0"
                                            title="Download document"
                                          >
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                          {message.senderid === sessionData?.user?._id && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                deleteMessage(message._id)
                                              }}
                                              className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full transition-colors flex-shrink-0"
                                              title="Delete document"
                                            >
                                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Fallback for unknown attachment types or documents */}
                                  {(!message.attachment.resourceType || !['image', 'video', 'raw'].includes(message.attachment.resourceType)) && (
                                    <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg border max-w-48">
                                      <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{message.attachment.originalFilename || 'File'}</p>
                                        <p className="text-xs text-gray-500">
                                          {message.attachment.bytes ? `${(message.attachment.bytes / 1024 / 1024).toFixed(2)} MB` : 'Attachment'}
                                        </p>
                                      </div>
                                      {message.content !== "Message Deleted" && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            try {
                                              const response = await fetch(message.attachment.secureUrl || message.attachment.url)
                                              const blob = await response.blob()
                                              const url = window.URL.createObjectURL(blob)
                                              const link = document.createElement('a')
                                              link.href = url
                                              link.download = message.attachment.originalFilename || 'file'
                                              document.body.appendChild(link)
                                              link.click()
                                              document.body.removeChild(link)
                                              window.URL.revokeObjectURL(url)
                                            } catch (error) {
                                              console.error('Download failed:', error)
                                              // Fallback to direct link
                                              const link = document.createElement('a')
                                              link.href = message.attachment.secureUrl || message.attachment.url
                                              link.download = message.attachment.originalFilename || 'file'
                                              link.target = '_blank'
                                              document.body.appendChild(link)
                                              link.click()
                                              document.body.removeChild(link)
                                            }
                                          }}
                                          className="bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-full transition-colors flex-shrink-0"
                                          title="Download file"
                                        >
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Message content and ticks container for sent messages */}
                              {message.senderid === sessionData?.user?._id ? (
                                <div className="flex items-end justify-between w-full">
                                  {/* Message text */}
                                  {message.content && message.content.trim() !== '' && (
                                    <p className="text-sm flex-1 mr-2">
                                      {isSearchActive && searchQuery && message.content.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                                        <span>
                                          {message.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                                            part.toLowerCase() === searchQuery.toLowerCase() ? (
                                              <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark>
                                            ) : (
                                              <span key={i}>{part}</span>
                                            )
                                          )}
                                        </span>
                                      ) : (
                                        message.content
                                      )}
                                    </p>
                                  )}
                                  
                                  {/* WhatsApp-style double check for sent messages - inside bubble (only show if no attachment) */}
                                  {!message.attachment && (
                                    <div className="flex items-center flex-shrink-0">
                                      <svg 
                                        viewBox="0 0 16 11" 
                                        height="11" 
                                        width="16" 
                                        preserveAspectRatio="xMidYMid meet" 
                                        className={`w-4 h-3 ${message.readStatus?.isRead ? 'text-blue-500' : 'text-gray-400'}`}
                                        fill="currentColor"
                                      >
                                        <title>msg-dblcheck</title>
                                        <path d="M11.0714 0.652832C10.991 0.585124 10.8894 0.55127 10.7667 0.55127C10.6186 0.55127 10.4916 0.610514 10.3858 0.729004L4.19688 8.36523L1.79112 6.09277C1.7488 6.04622 1.69802 6.01025 1.63877 5.98486C1.57953 5.95947 1.51817 5.94678 1.45469 5.94678C1.32351 5.94678 1.20925 5.99544 1.11192 6.09277L0.800883 6.40381C0.707784 6.49268 0.661235 6.60482 0.661235 6.74023C0.661235 6.87565 0.707784 6.98991 0.800883 7.08301L3.79698 10.0791C3.94509 10.2145 4.11224 10.2822 4.29844 10.2822C4.40424 10.2822 4.5058 10.259 4.60313 10.2124C4.70046 10.1659 4.78086 10.1003 4.84434 10.0156L11.4903 1.59863C11.5623 1.5013 11.5982 1.40186 11.5982 1.30029C11.5982 1.14372 11.5348 1.01888 11.4078 0.925781L11.0714 0.652832ZM8.6212 8.32715C8.43077 8.20866 8.2488 8.09017 8.0753 7.97168C7.99489 7.89128 7.8891 7.85107 7.75791 7.85107C7.6098 7.85107 7.4892 7.90397 7.3961 8.00977L7.10411 8.33984C7.01947 8.43717 6.97715 8.54508 6.97715 8.66357C6.97715 8.79476 7.0237 8.90902 7.1168 9.00635L8.1959 10.0791C8.33132 10.2145 8.49636 10.2822 8.69102 10.2822C8.79681 10.2822 8.89838 10.259 8.99571 10.2124C9.09304 10.1659 9.17556 10.1003 9.24327 10.0156L15.8639 1.62402C15.9358 1.53939 15.9718 1.43994 15.9718 1.32568C15.9718 1.1818 15.9125 1.05697 15.794 0.951172L15.4386 0.678223C15.3582 0.610514 15.2587 0.57666 15.1402 0.57666C14.9964 0.57666 14.8715 0.635905 14.7657 0.754395L8.6212 8.32715Z" fill="currentColor"></path>
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                /* Regular text for received messages */
                                message.content && message.content.trim() !== '' && (
                                  <p className="text-sm">
                                    {isSearchActive && searchQuery && message.content.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                                      <span>
                                        {message.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                                          part.toLowerCase() === searchQuery.toLowerCase() ? (
                                            <mark key={i} className="bg-yellow-200 px-1 rounded">{part}</mark>
                                          ) : (
                                            <span key={i}>{part}</span>
                                          )
                                        )}
                                      </span>
                                    ) : (
                                      message.content
                                    )}
                                  </p>
                                )
                              )}
                              
                              {/* Ticks for attachment messages (sent by current user) - bottom left only */}
                              {message.senderid === sessionData?.user?._id && message.attachment && message.content !== "Message Deleted" && (
                                <div className="flex justify-start mt-2">
                                  <div className="flex items-center">
                                    <svg 
                                      viewBox="0 0 16 11" 
                                      height="11" 
                                      width="16" 
                                      preserveAspectRatio="xMidYMid meet" 
                                      className={`w-4 h-3 ${message.readStatus?.isRead ? 'text-blue-500' : 'text-gray-400'}`}
                                      fill="currentColor"
                                    >
                                      <title>msg-dblcheck</title>
                                      <path d="M11.0714 0.652832C10.991 0.585124 10.8894 0.55127 10.7667 0.55127C10.6186 0.55127 10.4916 0.610514 10.3858 0.729004L4.19688 8.36523L1.79112 6.09277C1.7488 6.04622 1.69802 6.01025 1.63877 5.98486C1.57953 5.95947 1.51817 5.94678 1.45469 5.94678C1.32351 5.94678 1.20925 5.99544 1.11192 6.09277L0.800883 6.40381C0.707784 6.49268 0.661235 6.60482 0.661235 6.74023C0.661235 6.87565 0.707784 6.98991 0.800883 7.08301L3.79698 10.0791C3.94509 10.2145 4.11224 10.2822 4.29844 10.2822C4.40424 10.2822 4.5058 10.259 4.60313 10.2124C4.70046 10.1659 4.78086 10.1003 4.84434 10.0156L11.4903 1.59863C11.5623 1.5013 11.5982 1.40186 11.5982 1.30029C11.5982 1.14372 11.5348 1.01888 11.4078 0.925781L11.0714 0.652832ZM8.6212 8.32715C8.43077 8.20866 8.2488 8.09017 8.0753 7.97168C7.99489 7.89128 7.8891 7.85107 7.75791 7.85107C7.6098 7.85107 7.4892 7.90397 7.3961 8.00977L7.10411 8.33984C7.01947 8.43717 6.97715 8.54508 6.97715 8.66357C6.97715 8.79476 7.0237 8.90902 7.1168 9.00635L8.1959 10.0791C8.33132 10.2145 8.49636 10.2822 8.69102 10.2822C8.79681 10.2822 8.89838 10.259 8.99571 10.2124C9.09304 10.1659 9.17556 10.1003 9.24327 10.0156L15.8639 1.62402C15.9358 1.53939 15.9718 1.43994 15.9718 1.32568C15.9718 1.1818 15.9125 1.05697 15.794 0.951172L15.4386 0.678223C15.3582 0.610514 15.2587 0.57666 15.1402 0.57666C14.9964 0.57666 14.8715 0.635905 14.7657 0.754395L8.6212 8.32715Z" fill="currentColor"></path>
                                    </svg>
                                  </div>
                                </div>
                              )}
                              
                              {/* Show beautiful deletion message for attachments */}
                              {message.content === "Message Deleted" && message.attachment && (
                                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm text-red-700 font-medium">
                                      {message.attachment.resourceType === 'image' ? 'Image was deleted' :
                                       message.attachment.resourceType === 'video' ? 'Video was deleted' :
                                       message.attachment.format?.toLowerCase().includes('pdf') ? 'Document was deleted' :
                                       message.attachment.resourceType === 'video' && message.attachment.format && ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(message.attachment.format.toLowerCase()) ? 'Audio was deleted' :
                                       'File was deleted'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            
                            {/* Copy and Delete buttons for sender messages (right side) - only for text messages */}
                            {message.senderid === sessionData?.user?._id && message.content !== "Message Deleted" && !message.attachment && (
                              <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-row space-x-1 items-center">
                                <button 
                                  onClick={() => copyMessage(message)}
                                  className={`p-1.5 rounded-full shadow-sm transform hover:scale-110 transition-all duration-200 ${copiedMessageId === message._id ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'}`}
                                  title={copiedMessageId === message._id ? 'Copied!' : 'Copy message'}
                                >
                                  {copiedMessageId === message._id ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                  )}
                                </button>
                                <button 
                                  onClick={() => deleteMessage(message._id)}
                                  className="p-1.5 bg-red-500 hover:bg-red-600 rounded-full shadow-sm transform hover:scale-110 transition-all duration-200"
                                  title="Delete message"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                <div className="bg-gray-200 p-2 sm:p-3 flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                  >
                    <Smile 
                      size={24} 
                      className="text-gray-600 hover:text-blue-500 transition-colors duration-200" 
                    />
                  </button>
                  {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute bottom-16 left-1/3 z-20">
                      <Picker data={data} onEmojiSelect={addEmoji} />
                    </div>
                  )}
                  <div className="relative">
                    <button type="button" onClick={() => openFilePicker('*')} className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200">
                      <Paperclip size={24} className="text-gray-600 hover:text-blue-500 transition-colors duration-200" />
                    </button>
                  </div>
                  {/* Upload Progress Indicator */}
                  {isUploading && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">Uploading... {uploadProgress}%</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            console.log('Cancel upload button clicked...')
                            // Cancel the upload
                            if (uploadAbortController.current?.xhr) {
                              console.log('Aborting upload...')
                              uploadAbortController.current.xhr.abort()
                            }
                            setIsUploading(false)
                            setUploadingFile(null)
                            setUploadProgress(0)
                            uploadAbortController.current = null
                            // Clean up pending attachment if exists
                            if (pendingAttachment?.url) {
                              URL.revokeObjectURL(pendingAttachment.url)
                            }
                            setPendingAttachment(null)
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ''
                            }
                            console.log('Upload cancelled successfully')
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors duration-200 border border-red-200 hover:border-red-300"
                          title="Cancel upload"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}


                  <div className="flex-1 bg-white rounded-full px-2 sm:px-4 py-2">
                    <FormProvider {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center space-x-2">
                        {/* Show preview inside input field */}
                  {pendingAttachment && !isUploading && (
                          <div className="relative flex items-center space-x-3 mr-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-3 py-2 border border-blue-200 shadow-sm">
                            {/* Thumbnail */}
                            <div className="relative flex-shrink-0">
                        {pendingAttachment.isImage && (
                                <div className="w-10 h-10 rounded-lg overflow-hidden shadow-sm border border-white">
                          <img 
                            src={pendingAttachment.url} 
                            alt="Preview" 
                                    className="w-full h-full object-cover"
                          />
                                </div>
                        )}
                        {pendingAttachment.isVideo && (
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden shadow-sm border border-white bg-gradient-to-br from-purple-100 to-pink-100">
                            <video 
                              src={pendingAttachment.url} 
                              className="w-full h-full object-cover"
                              controls={false}
                              muted
                                    preload="metadata"
                                    crossOrigin="anonymous"
                                    onLoadedMetadata={(e) => {
                                      e.target.currentTime = 1
                                    }}
                                    onSeeked={(e) => {
                                      try {
                                        const canvas = document.createElement('canvas')
                                        const ctx = canvas.getContext('2d')
                                        canvas.width = e.target.videoWidth
                                        canvas.height = e.target.videoHeight
                                        ctx.drawImage(e.target, 0, 0, canvas.width, canvas.height)
                                        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8)
                                        e.target.poster = thumbnailUrl
                                        e.target.currentTime = 0
                                        e.target.pause()
                                      } catch (error) {
                                        e.target.style.display = 'block'
                                      }
                                    }}
                                    onError={(e) => {
                                      console.log('Video load error:', e)
                                    }}
                                    onCanPlay={(e) => {
                                      e.target.currentTime = 1
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                        )}
                        {pendingAttachment.isAudio && (
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center shadow-sm border border-white">
                                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {pendingAttachment.isDocument && (
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center shadow-sm border border-white">
                                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        </div>

                            {/* File Name */}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate block" title={pendingAttachment.name}>
                                {pendingAttachment.name}
                              </span>
                            </div>

                            {/* Cancel Button */}
                        <button
                          type="button"
                          onClick={() => {
                                console.log('Cancel button clicked, removing attachment...')
                            if (pendingAttachment?.url) {
                              URL.revokeObjectURL(pendingAttachment.url)
                            }
                            setPendingAttachment(null)
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ''
                            }
                                console.log('Attachment removed successfully')
                          }}
                              className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 flex-shrink-0"
                              title="Remove attachment"
                        >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                    </div>
                  )}
                        <FormField
                          control={form.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem className="w-full">
                              <FormControl>
                                <Input
                                  placeholder={pendingAttachment ? "Cannot type while attachment is pending..." : "Enter message...."}
                                  disabled={!!pendingAttachment}
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setContent(e.target.value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="relative group">
                          <button type = "button" onClick={suggestMessages}>
                            <Bot size={24} className="text-gray-600 cursor-pointer hover:text-indigo-500 transition-colors duration-200" />
                          </button>
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-teal-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                            <div className="font-medium">Suggest Message</div>
                            {/* Triangle pointing down */}
                            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-indigo-500"></div>
                          </div>
                        </div>
                        <div className="relative group">
                          <Mic 
                            size={24}
                            className={`cursor-pointer transition-all duration-300 ${
                              listening ? 'text-green-500' : 'text-gray-600'
                            }`}
                            onClick={toggleMic}
                          />
                          {listening && (
                            <div 
                              className="absolute inset-0 rounded-full border-2 border-green-500 animate-ping"
                              style={{ pointerEvents: 'none' }}
                            >
                            </div>
                          )}
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap z-10">
                            <div className="font-medium">Voice Typing</div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-purple-500"></div>
                          </div>
                        </div>

                        <div className="relative group">
                          {(() => {
                            const currentFriend = friends.find(f => f.friendid === receiverId.current);
                            const isFriendBlocked = currentFriend?.isBlocked || false;
                            
                            return (
                              <>
                                <Button 
                                  type="submit" 
                                  className={`${isFriendBlocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500'}`} 
                                  disabled={!enableSend}
                                >
                                  {isUploading ? (
                                    <div className="flex items-center space-x-2">
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      <span className="text-sm">{uploadProgress}%</span>
                                    </div>
                                  ) : (
                                    <Send size={24} />
                                  )}
                                </Button>
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-400 to-green-800 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap z-10">
                                  <div className="font-medium">
                                    {isFriendBlocked 
                                      ? 'Cannot send - Friend is blocked' 
                                      : isUploading 
                                        ? `Uploading... ${uploadProgress}%` 
                                        : 'Send Message'
                                    }
                                  </div>
                                  <div className={`absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent ${isFriendBlocked ? 'border-t-gray-400' : 'border-t-green-500'}`}></div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </form>
                    </FormProvider>
                  </div>
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handlePickFile}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-100">
                <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle size={64} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-medium text-gray-600 mb-2">Chatly</h2>
                <p className="text-sm text-gray-500 text-center max-w-md">
                  Select a chat from the sidebar or click on a friend to start messaging
                </p>
              </div>
            )}
          </div>
        </div>
      </>
    )}

    {/* Enhanced Search Modal */}
    {showSearchModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-violet-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-lg font-semibold">Search within chat</h3>
              <div className="flex items-center space-x-2">
                <button className="text-white hover:text-gray-200 transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button className="text-white hover:text-gray-200 transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button className="text-white hover:text-gray-200 transition-colors p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button 
                  onClick={() => setShowSearchModal(false)}
                  className="text-white hover:text-gray-200 transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Search Input with Filters */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex space-x-2 mb-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search in messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchMessages()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={searchMessages}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-purple-500 text-white px-3 py-1 rounded-md hover:bg-purple-600 transition-colors"
                >
                  Search
                </button>
              </div>
            </div>
            
            {/* Date Filters */}
            <div className="flex space-x-2 text-sm">
              <input
                type="date"
                placeholder="From date"
                className="px-3 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500"
                onChange={(e) => {
                  if (e.target.value) {
                    searchWithDateFilter(e.target.value, null);
                  }
                }}
              />
              <input
                type="date"
                placeholder="To date"
                className="px-3 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500"
                onChange={(e) => {
                  if (e.target.value) {
                    searchWithDateFilter(null, e.target.value);
                  }
                }}
              />
            </div>
          </div>

          {/* Search Results */}
          <div className="max-h-96 overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="p-4">
                <div className="mb-3 text-sm text-gray-600">
                  Found {searchResults.length} message{searchResults.length !== 1 ? 's' : ''}
                </div>
                <div className="space-y-3">
                  {searchResults.map((message, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border-l-4 border-purple-400 hover:bg-gray-100 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-700">
                            {message.senderid === sessionData?.user?._id ? 'You' : 'Friend'}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            {new Date(message.createdAt || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(message.createdAt || Date.now()).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {message.content}
                      </p>
                      {message.searchHighlight !== -1 && (
                        <div className="mt-2 text-xs text-purple-600">
                          Found in message content
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : searchQuery ? (
              <div className="p-8 text-center text-gray-500">
                <Search size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No messages found</p>
                <p className="text-sm">No messages match "{searchQuery}"</p>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Search size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Search Messages</p>
                <p className="text-sm">Enter a search term to find messages in this conversation</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {searchResults.length > 0 && `Showing ${searchResults.length} results`}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setShowSearchModal(false)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Beautiful Delete Group Confirmation Modal */}
    {showDeleteGroupModal && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center">
        {/* Backdrop */}
        <div aria-hidden onClick={() => { if (!isDeletingGroup) setShowDeleteGroupModal(false) }} className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-pink-600 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center">
              <div>
                <h3 className="text-white text-lg font-semibold">Delete Group</h3>
                <p className="text-red-100 text-sm">This action cannot be undone</p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-red-50 rounded-full">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-gray-800 font-medium mb-2">Are you sure you want to delete this group?</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  This will permanently delete the group and all its messages. All members will be removed from the group.
                </p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex space-x-3">
            <button
              onClick={() => setShowDeleteGroupModal(false)}
              disabled={isDeletingGroup}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteGroup}
              disabled={isDeletingGroup}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-700 transition-all duration-200 font-medium shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Beautiful Leave Group Confirmation Modal */}
    {showLeaveGroupModal && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center">
        {/* Backdrop */}
        <div aria-hidden onClick={() => { if (!isLeavingGroup) setShowLeaveGroupModal(false) }} className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center">
              <div>
                <h3 className="text-white text-lg font-semibold">Leave Group</h3>
                <p className="text-orange-100 text-sm">You can rejoin if invited again</p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-orange-50 rounded-full">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-gray-800 font-medium mb-2">Are you sure you want to leave this group?</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  You will no longer receive messages from this group. You can rejoin if someone invites you again.
                </p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex space-x-3">
            <button
              onClick={() => setShowLeaveGroupModal(false)}
              disabled={isLeavingGroup}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={confirmLeaveGroup}
              disabled={isLeavingGroup}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-200 font-medium shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLeavingGroup ? 'Leaving...' : 'Leave Group'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Beautiful Remove Friend Confirmation Modal */}
    {showRemoveConfirmModal && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center">
        {/* Backdrop */}
        <div aria-hidden onClick={() => setShowRemoveConfirmModal(false)} className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-95 animate-in zoom-in-95">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-500 to-gray-600 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center">
              <div>
                <h3 className="text-white text-lg font-semibold">Remove Friend</h3>
                <p className="text-gray-200 text-sm">This action cannot be undone</p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-gray-50 rounded-full">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-gray-800 font-medium mb-2">Are you sure you want to remove {friendToRemove?.username} from your friends?</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  This will remove {friendToRemove?.username} from your friends list. They will be notified about this action and you won't be able to send messages to each other.
                </p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex space-x-3">
            <button
              onClick={() => setShowRemoveConfirmModal(false)}
              disabled={removeLoading[friendToRemove?.id]}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={confirmRemoveFriend}
              disabled={removeLoading[friendToRemove?.id]}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {removeLoading[friendToRemove?.id] ? (
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Removing...
                </div>
              ) : (
                'Remove Friend'
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Beautiful Group Members Modal */}
    {showGroupMembersModal && (() => {
      const groupId = receiverId.current?.replace('group_', '');
      const currentGroup = groups.find(g => g._id === groupId);
      const groupMembers = currentGroup?.members || [];
      
      console.log('Group Members Debug:', {
        groupId,
        currentGroup,
        groupMembers,
        membersCount: groupMembers.length
      });
      
      return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          {/* Backdrop */}
          <div aria-hidden onClick={() => setShowGroupMembersModal(false)} className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden transform transition-all duration-300 scale-95 animate-in zoom-in-95">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div>
                    <h3 className="text-white text-lg font-semibold">Group Members</h3>
                    <p className="text-blue-100 text-sm">{groupMembers.length} members</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGroupMembersModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors duration-200"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {groupMembers.map((member, index) => (
                  <div key={member.userId?._id || member.userId || index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                    <Avatar 
                      user={{
                        username: member.userId?.username || member.username || 'Unknown User',
                        profilePicture: member.userId?.profilePicture || member.profilePicture
                      }}
                      size="lg"
                      className="shadow-lg"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{member.userId?.username || member.username || 'Unknown User'}</h4>
                      <p className="text-sm text-gray-500">
                        {member.userId?._id?.toString() === currentGroup?.ownerId?._id?.toString() ? 'Group Owner' : 'Member'}
                      </p>
                    </div>
                    {member.userId?._id?.toString() === currentGroup?.ownerId?._id?.toString() && (
                      <div className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-medium rounded-full">
                        Owner
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t">
              <button
                onClick={() => setShowGroupMembersModal(false)}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Delete Account Confirmation Modal */}
    {showDeleteAccountModal && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center">
        <div aria-hidden onClick={() => { if (!deleteAccountLoading) setShowDeleteAccountModal(false) }} className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-pink-600 px-6 py-4">
            <h3 className="text-white text-lg font-semibold">Delete Account</h3>
            <p className="text-red-100 text-sm">This will delete all your data. This action is irreversible.</p>
          </div>
          <div className="p-6 space-y-3">
            <p className="text-gray-700">Are you sure you want to permanently delete your account? All your conversations, messages, groups and friendships will be removed. Your friends will receive a notification about this action.</p>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t flex space-x-3">
            <button onClick={() => setShowDeleteAccountModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={async () => {
              if (deleteAccountLoading) return;
              try {
                setDeleteAccountLoading(true)
                const res = await fetch('/api/delete-account', { method: 'POST' })
                const data = await res.json()
                if (data?.success) {
                  // Show only message deletion toast; avoid sign-out success toast
                  toast.success('All messages deleted')
                  // Sign out after deletion (silent)
                  SignOut()
                } else {
                  toast.error(data?.message || 'Failed to delete account')
                }
              } catch (e) {
                toast.error('Failed to delete account')
              } finally {
                setDeleteAccountLoading(false)
                setShowDeleteAccountModal(false)
              }
            }} className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-700 disabled:opacity-50" disabled={deleteAccountLoading}>{deleteAccountLoading ? 'Deleting...' : 'Delete Account'}</button>
          </div>
        </div>
      </div>
    )}

    {/* Add Friend Modal */}
    {showAddFriendModal && (
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 pb-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCloseAddFriendModal()
          }
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-11/12 sm:w-full max-w-2xl max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-95 animate-in zoom-in-95">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Add Friends</h2>
                <p className="text-blue-100 mt-1">Discover and connect with people</p>
              </div>
              <button
                onClick={handleCloseAddFriendModal}
                className="text-white hover:text-gray-200 transition-colors p-3 rounded-full hover:bg-white hover:bg-opacity-20 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-6 pt-4 pb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              {friendSearchQuery && (
                <button
                  onClick={() => setFriendSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Modal Content */}
          <div className="px-6 pb-10">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading users...</span>
              </div>
            ) : filteredUsers.length === 0 && !loadingUsers ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {friendSearchQuery ? 'No users found' : 'No users available'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {friendSearchQuery 
                    ? `No users match "${friendSearchQuery}". Try a different search term.`
                    : 'There are no other users to add as friends at the moment.'
                  }
                </p>
                {friendSearchQuery ? (
                  <button
                    onClick={() => setFriendSearchQuery("")}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    onClick={fetchAllUsers}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
                  >
                    Refresh
                  </button>
                )}
              </div>
            ) : (
              <div 
                className="space-y-3 max-h-96 overflow-y-auto pb-6 rounded-lg"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#d1d5db #f3f4f6'
                }}
              >
                {filteredUsers.map((user, index) => (
                  <div
                    key={user._id}
                    className={`flex items-center justify-between p-4 bg-white rounded-xl hover:bg-gray-50 transition-all duration-200 border border-gray-200 shadow-sm hover:shadow-md ${
                      index === filteredUsers.length - 1 ? 'mb-2' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Avatar */}
                      <Avatar 
                        key={`user-${user._id}`}
                        user={user} 
                        size="lg" 
                        showStatus={true} 
                        status={userStatus[user._id] || "offline"}
                        showUserIcon={false}
                      />
                      
                      {/* User Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900">{user.username}</h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center">
                      {user.status === 'friend' && (
                        <div className="flex items-center text-green-600 bg-green-50 px-4 py-2 rounded-full">
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Friends</span>
                        </div>
                      )}
                      
                      {user.status === 'sent' && (
                        <div className="flex items-center text-blue-600 bg-blue-50 px-4 py-2 rounded-full">
                          <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium">Request Sent</span>
                        </div>
                      )}
                      
                      {user.status === 'received' && (
                        <div className="flex items-center text-orange-600 bg-orange-50 px-4 py-2 rounded-full">
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Request Received</span>
                        </div>
                      )}
                      
                      {user.status === 'none' && (
                        <button
                          onClick={() => handleSendFriendRequest(user._id, user.username)}
                          disabled={friendRequestLoading[user._id]}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
                        >
                          {friendRequestLoading[user._id] ? (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Sending...
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Add Friend
                            </div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-gray-50 px-6 py-5 pb-6 border-t">
            <div className="flex justify-between items-center">
              {filteredUsers.length > 0 && (
                <p className="text-sm text-gray-500">
                  {friendSearchQuery ? (
                    `${filteredUsers.length} of ${allUsers.length} users`
                  ) : (
                    `${filteredUsers.length} ${filteredUsers.length === 1 ? 'user' : 'users'} found`
                  )}
                </p>
              )}
              <button
                onClick={handleCloseAddFriendModal}
                className="px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-full hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Profile Modal */}
    {showProfileModal && (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { if (!isUpdatingProfile) setShowProfileModal(false) }}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-11/12 sm:w-full mx-4 sm:mx-6 max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold">Profile Settings</h2>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isUpdatingProfile) setShowProfileModal(false) }}
                disabled={isUpdatingProfile}
                className="text-white hover:text-gray-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed p-2 hover:bg-white hover:bg-opacity-20 rounded-full"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-6">
            {/* Profile Picture Section */}
            <div className="flex flex-col items-center space-y-4">
              <div key={forceRerender} className="relative">
                {profilePicturePreview && profilePicturePreview !== null && !shouldRemoveProfilePicture ? (
                  <div className="relative">
                    <img
                      key={`preview-${forceRerender}`}
                      src={profilePicturePreview}
                      alt="Profile preview"
                      className="w-32 h-32 rounded-full object-cover border-4 border-indigo-200 shadow-lg"
                    />
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveProfilePicture() }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ) : shouldRemoveProfilePicture ? (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {generateAvatarInitials(sessionData?.user?.username || '')}
                  </div>
                ) : getSafeProfilePictureUrl(sessionData?.user?.profilePicture) ? (
                  <div className="relative">
                    <img
                      src={getSafeProfilePictureUrl(sessionData.user.profilePicture)}
                      alt="Current profile"
                      className="w-32 h-32 rounded-full object-cover border-4 border-indigo-200 shadow-lg"
                      onError={(e) => {
                        // Fallback to initials if image fails to load
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg hidden">
                      {generateAvatarInitials(sessionData?.user?.username || '')}
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveProfilePicture() }}
                      className="absolute -top-2 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {generateAvatarInitials(sessionData?.user?.username || '')}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-center space-y-2">
                <input
                  ref={profileFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  id="profile-picture-update"
                  disabled={isUpdatingProfile}
                />
                <label
                  htmlFor="profile-picture-update"
                  className={`px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg transition-all duration-200 font-medium shadow-lg ${
                    isUpdatingProfile 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'cursor-pointer hover:from-purple-600 hover:to-purple-700'
                  }`}
                >
                  Update Picture
                </label>
                {profilePicture && (
                  <p className="text-xs text-gray-500 text-center">
                    {profilePicture.name}
                  </p>
                )}
              </div>
            </div>

            {/* User Information */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editableUsername}
                    onChange={handleUsernameChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                      usernameError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter username"
                    disabled={isCheckingUsername}
                  />
                  {isCheckingUsername && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {usernameError && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {usernameError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={sessionData?.user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowProfileModal(false)}
                disabled={isUpdatingProfile}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={updateProfile}
                disabled={isUpdatingProfile || isCheckingUsername}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingProfile ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Updating...
                  </div>
                ) : (
                  'Update Profile'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
);
}