"use client"
import { sendMessage } from '@/app/api/message-handler';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import socket from '@/lib/socket';
import { messageSchema } from '@/schema/message-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageCircle, Phone, Video, Search, MoreVertical, Paperclip, Smile, Mic, Send, ChevronLeft, User, LogOut, UserPlus, Users, Copy, Delete, Users2, ArrowUpDown, ArrowUp, ArrowDown, Bot, UserMinus, Trash, Bell } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { signOut } from "next-auth/react";


export default function WhatsAppUI() {
  // Add CSS for search highlight animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .search-highlight {
        animation: searchBlink 2s ease-in-out;
        background-color: #fef3c7 !important;
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
  const [friends, setFriends] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const { data: session } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const searchParams = useSearchParams();
  const receiverId = useRef();
  const [enableSend, setEnableSend] = useState(false);
  const bottomRef = useRef();
  const [showEmojiPicker,setShowEmojiPicker] = useState("")
  const [searchValue,setSearchValue] = useState("")
  const [filteredFriends,setFilteredFriends] = useState([])
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [sortOrder, setSortOrder] = useState('none'); // 'none', 'desc', 'asc'
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
  const [processedMessages, setProcessedMessages] = useState(new Set()) // Track processed message IDs
  const [showSearchModal, setShowSearchModal] = useState(false) // Search modal state
  const [searchQuery, setSearchQuery] = useState("") // Search query
  const [searchResults, setSearchResults] = useState([]) // Search results
  const [isSearchActive, setIsSearchActive] = useState(false) // Inline search state
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0) // Current search result index
  const [showNotifications, setShowNotifications] = useState(false) // Notification dropdown state
  const [notifications, setNotifications] = useState([]) // Notification messages
  const [friendRequests, setFriendRequests] = useState([]) // Friend requests
  const notificationRef = useRef(null)

  
  const ChatLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <MessageCircle size={20} className="text-green-500" />
        </div>
      </div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <p className="text-sm text-gray-600 font-medium">Loading chat...</p>
    </div>
  </div>
);

const FullUILoader = () => (
  <div className="flex h-screen bg-gray-100">
    {/* Left sidebar skeleton */}
    <div className="w-1/3 flex flex-col border-r border-gray-300 bg-white">
      <div className="flex justify-between items-center p-4 bg-gray-200">
        <div className="w-10 h-10 rounded-full bg-gray-300 animate-pulse"></div>
        <div className="flex items-center space-x-4">
          <div className="w-5 h-5 rounded bg-gray-300 animate-pulse"></div>
          <div className="w-5 h-5 rounded bg-gray-300 animate-pulse"></div>
          <div className="w-5 h-5 rounded bg-gray-300 animate-pulse"></div>
          <div className="w-5 h-5 rounded bg-gray-300 animate-pulse"></div>
        </div>
      </div>
      
      <div className="p-2 bg-gray-100">
        <div className="bg-gray-300 rounded-lg h-10 animate-pulse"></div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center px-3 py-3 border-b border-gray-200">
            <div className="w-10 h-10 rounded-full bg-gray-300 animate-pulse mr-3"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="border-t border-gray-300 p-3 bg-gray-200">
        <div className="h-10 bg-gray-300 rounded animate-pulse mb-2"></div>
        <div className="h-10 bg-gray-300 rounded animate-pulse"></div>
      </div>
    </div>

    {/* Right chat area */}
    <div className="w-2/3 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center space-y-6">
          {/* Main loader animation */}
          <div className="relative">
            <div className="w-20 h-20 border-4 border-green-200 border-t-green-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <MessageCircle size={32} className="text-green-500" />
            </div>
          </div>
          
          {/* Bouncing dots */}
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          
          {/* Loading text */}
          <div className="text-center">
            <h2 className="text-xl font-medium text-gray-700 mb-2">WhatsApp Web</h2>
            <p className="text-sm text-gray-500">Loading your conversations...</p>
          </div>
          
          {/* Progress bar */}
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
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
    if(content.length == 0)
    {
      setEnableSend(false)
    }
    if(content.length > 0)
    {
      setEnableSend(true)
    }
    }, [content]);

  useEffect(() => {
  if (session) {
    const userId = session.user._id;
    
    console.log("Setting up socket connection for user:", userId)
    
    // Join room and set initial data
    socket.emit("join_room", userId);
    console.log(userId, " User joined room");
    socket.emit("set_data", { userId: userId });
    console.log("senderId is : ", userId);
    
    // Test socket connection
    socket.emit("test_connection", { userId: userId })

    // Check status of current receiver
    socket.emit("status", { receiverId: receiverId.current });

    // Get friends list
    socket.emit("get_friends", userId);
    socket.on("friend_list", (friendData) => {
      setFriends(friendData);
    });

    // Ensure AI friend is added for existing users
    const ensureAiFriend = async () => {
      try {
        const response = await fetch("/api/ensure-ai-friend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const result = await response.json();
        console.log("AI friend ensure result:", result);
      } catch (error) {
        console.error("Failed to ensure AI friend:", error);
      }
    };
    
    // Call ensure AI friend after a short delay to allow session to be established
    setTimeout(ensureAiFriend, 1000);
    
    setIsInitialLoading(false);
  } else {
    console.log("NO SESSION DATA");
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
    if (!session?.user?._id) return;

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
  }, [session?.user?._id, receiverId.current]);

  // Handle session changes - only reset counts when session is completely lost
  useEffect(() => {
    if (!session?.user?._id) {
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
  }, [session?.user?._id]);

  useEffect(() => {
    if (!session?.user?._id) return;

    socket.on("send_message_to_sender", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("send_message_to_receiver", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off("send_message_to_sender");
      socket.off("send_message_to_receiver");
    };
  }, [session?.user?._id]);

 useEffect(() => {
  if (bottomRef.current) {
    const chatContainer = bottomRef.current.closest('.overflow-y-auto');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
}, [messages]);

  const onSubmit = (data) => {
    if (receiverId.current && session?.user?._id && data.content.length > 0) {
      sendMessage(session.user._id, receiverId.current, data.content);
      form.reset();
      setContent("")
    }
  };

  // Handle new messages with proper cleanup
  useEffect(() => {
    if (!session?.user?._id) return;

    const handleNewMessage = ({ content, receiverId, senderId }) => {
      // Create a unique message identifier
      const messageId = `${senderId}-${receiverId}-${content}-${Date.now()}`;
      
      console.log("New message received:", { content, receiverId, senderId, messageId });
      console.log("Current activeChat:", activeChat);
      console.log("Current session user:", session?.user?._id);
      console.log("Processed messages:", Array.from(processedMessages));

      // Check if this message has already been processed
      if (processedMessages.has(messageId)) {
        console.log("Message already processed, skipping...");
        return;
      }

      // Only process if the message is for the current user
      if (receiverId === session?.user?._id) {
        // Mark this message as processed
        setProcessedMessages(prev => new Set([...prev, messageId]));
        
        // If user is not actively chatting with this sender, increment the count
        if (activeChat !== senderId) {
          console.log("User not actively chatting with sender, incrementing count");
          
          // Add notification for received messages
          setNotifications(prev => [...prev, {
            id: Date.now(),
            message: content,
            sender: senderId,
            timestamp: new Date()
          }]);
          
          // Add a small delay to ensure stable state updates
          setTimeout(() => {
            setNewMessageCounts(prev => {
              const newCounts = {
                ...prev,
                [senderId]: (prev[senderId] || 0) + 1
              };
              
              // Update total count
              const total = Object.values(newCounts).reduce((sum, count) => sum + count, 0);
              setTotalNewMessages(total);
              
              return newCounts;
            });
          }, 50);
        } else {
          console.log("User is actively chatting with sender, not incrementing count");
        }
      }
    };

    // Register the listener
    socket.on("new_message", handleNewMessage);

    // Cleanup function
    return () => {
      socket.off("new_message", handleNewMessage);
      // Clear processed messages to prevent memory leaks
      setProcessedMessages(new Set());
    };
  }, [session?.user?._id, activeChat]); // Only depend on session and activeChat


  // This is already handled in the main session useEffect above

  useEffect(() => {
    console.log("newMessages are : ",newMessages)
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
    console.log("Session user:", session?.user?._id);
    console.log("===========================");
  }, [newMessageCounts, totalNewMessages, processedMessages, activeChat, session?.user?._id])

  const onClick = (id) => {
    if (id) {
      setIsLoading(true)
      setActiveChat(id);
      const startTime = Date.now();
      window.history.pushState(null, '', `/ui?receiverId=${id}`);
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
      
      socket.emit("all_messages", {
        senderId: session?.user?._id,
        receiverId: id,
      });
      socket.once("receive_messages", (msgs) => {
         const elapsedTime = Date.now() - startTime;
         const remainingTime = Math.max(1000 - elapsedTime, 0);
        setTimeout(() => {
          setMessages(msgs);
          setIsLoading(false);
        },remainingTime);
    })
    
    // Request status for this user and reset status
    if (receiverId.current && session) {
      socket.emit("status", { receiverId: receiverId.current });
      // Reset status to offline initially, will be updated by server response
      setStatus("offline");
    }
    }
  };

  useEffect(() => {
  if (!session?.user?._id) return;

  socket.on("incoming_call", (data) => {
    if (data.receiverId != session?.user?._id) return;
    console.log("Data is : ",data)
    if (data.type == "video") {
      router.push(`/video-call/${data.receiverId}/receiver`);
    } else if (data.type == "audio") {
      router.push(`/audio-call/${data.receiverId}/receiver`);
    }

  });

  return () => socket.off("incoming_call");
}, [session]);


  const handleVideoCall = () => {
    
    socket.emit("user_call", {
    senderId: session?.user?._id,
    receiverId: receiverId.current,
    type: "video"
  });

  // Caller should go to the video call page as caller
  router.push(`/video-call/${receiverId.current}/sender`);
  
};

  const copyMessage = async (value) => {
    await navigator.clipboard.writeText(value)
  }

  useEffect(() => {
    // console.log("receiverId.current : ",receiverId.current)
    // console.log("session.user._id : ",session?.user?._id)
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

  const handleVoiceCall = () => {
    
    socket.emit("user_call", {
    senderId: session?.user?._id,
    receiverId: receiverId.current,
    type: "audio"
  });

  // Caller should go to the video call page as caller
  router.push(`/audio-call/${receiverId.current}/sender`);
  
};

const SignOut = () => {
  console.log("signout called")
  signOut({callbackUrl:"http://localhost:3001/sign-in"})
  toast.success("Signed out successfully")
}

const handleSortToggle = () => {
  if (sortOrder === 'none') {
    setSortOrder('desc');
  } else if (sortOrder === 'desc') {
    setSortOrder('asc');
  } else {
    setSortOrder('none');
  }
};

const getSortIcon = () => {
  switch (sortOrder) {
    case 'desc':
      return ArrowDown;
    case 'asc':
      return ArrowUp;
    default:
      return ArrowUpDown;
  }
};

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
  
  if (sortOrder === 'desc') {
    regularUsers.sort((a, b) => b.friendusername.localeCompare(a.friendusername));
  } else if (sortOrder === 'asc') {
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
          senderId : session?.user?._id,
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
      if (receiverId.current && session?.user?._id) {
        const response = await axios.post("/api/clear-messages", {
          senderId: session?.user?._id,
          receiverId: receiverId.current
        });
        
        if (response.data.success) {
          setMessages([]);
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

  // User-friendly export chat functionality
  const exportChat = () => {
    const friendInfo = friends.find(f => f.friendid === receiverId.current);
    const currentUser = session?.user;
    
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
          const isYou = msg.senderid === session?.user?._id;
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
    toast.success("Chat exported successfully in user-friendly format");
  };
  useEffect(() => {
  if(content.length > 0) {
    console.log("content is : ",content)
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

  // Fetch friend requests
  const fetchFriendRequests = async () => {
    try {
      console.log("Fetching friend requests for user:", session?.user?._id)
      const response = await axios.get("/api/get-friend-requests")
      console.log("Friend requests API response:", response.data)
      
      if (response.data.success) {
        setFriendRequests(response.data.data.friendRequests || [])
        console.log("Friend requests fetched:", response.data.data.friendRequests)
        console.log("Friend requests count:", (response.data.data.friendRequests || []).length)
      } else {
        console.error("Failed to fetch friend requests:", response.data.message)
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
          if (session?.user?._id) {
            socket.emit("get_friends", session.user._id)
          }
          // Fallback notify sender in case API emit was queued
          if (response.data?.data?.senderId) {
            socket.emit("friend_request_responded", {
              senderId: response.data.data.senderId,
              status: "accepted",
              receiverUsername: session?.user?.username,
              receiverId: session?.user?._id
            })
          }
        } else {
          toast.info("Friend request declined")
          if (response.data?.data?.senderId) {
            socket.emit("friend_request_responded", {
              senderId: response.data.data.senderId,
              status: "declined",
              receiverUsername: session?.user?.username,
              receiverId: session?.user?._id
            })
          }
        }
      }
    } catch (error) {
      console.error("Error responding to friend request:", error)
      toast.error("Error processing friend request")
    }
  }

  // Fetch friend requests when component mounts
  useEffect(() => {
    if (session?.user?._id) {
      fetchFriendRequests()
    }
  }, [session?.user?._id])

  // Periodic refresh of friend requests (fallback for socket notifications)
  useEffect(() => {
    if (!session?.user?._id) return

    const interval = setInterval(() => {
      console.log("Periodic friend request refresh")
      fetchFriendRequests()
    }, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [session?.user?._id])


  // Listen for friend request notifications
  useEffect(() => {
    if (!session?.user?._id) return

    console.log("Setting up friend request listener for user:", session.user._id)

    const handleFriendRequest = (data) => {
      console.log("Received friend request notification:", data)
      console.log("Current user ID:", session.user._id)
      
      // Refresh friend requests
      fetchFriendRequests()
      
      // Show notification toast
      toast.info(`New friend request from ${data.senderUsername}!`, {
        position: "top-right",
        autoClose: 5000,
      })
    }

    // Sender gets response updates when receiver accepts/declines
    const handleFriendRequestResponded = (data) => {
      if (!data) return
      const text = data.status === 'accepted'
        ? `${data.receiverUsername} has accepted your friend request`
        : `${data.receiverUsername} has declined your friend request`
      toast.info(text, { position: "top-right", autoClose: 5000 })
      // If accepted, refresh friends list
      if (data.status === 'accepted' && session?.user?._id) {
        socket.emit("get_friends", session.user._id)
      }
    }

    // Add debug logging for socket events
    socket.on("friend_request_received", handleFriendRequest)
    socket.on("friend_request_responded", handleFriendRequestResponded)
    
    // Add general socket event logging
    socket.onAny((eventName, ...args) => {
      console.log("Socket event received:", eventName, args)
    })
    
    // Test connection response
    socket.on("test_connection_response", (data) => {
      console.log("Test connection response:", data)
    })

    return () => {
      socket.off("friend_request_received", handleFriendRequest)
      socket.off("friend_request_responded", handleFriendRequestResponded)
      socket.offAny()
    }
  }, [session?.user?._id])
  

  return (
  <>
    {isInitialLoading ? (
      <FullUILoader />
    ) : (
      <>
        <div className="flex h-screen bg-gray-100 overflow-hidden ">
          <div className="w-1/3 flex flex-col border-r border-gray-300 bg-white">
            <div className="flex justify-between items-center p-4 bg-gray-200">
              <div className="flex items-center">
                <div className="relative group">
                  <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center cursor-pointer hover:bg-gradient-to-r hover:from-pink-500 hover:to-yellow-500 transition-all duration-300">
                    <User size={20} className="text-white" />
                  </div>
                  <div className="absolute top-11 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-pink-500 to-yellow-500 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">View Profile</div>
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-pink-500"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {/* Add Friend Icon with Tooltip */}
                <div className="relative group">
                  <UserPlus 
                    size={20} 
                    className="text-gray-600 cursor-pointer hover:text-blue-500 transition-colors duration-200" 
                    onClick={() => router.replace("/add-friend")}
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
                      // Clear only message notifications when opening dropdown, not friend requests
                      if (!showNotifications && (notifications?.length || 0) > 0) {
                        setNotifications([])
                      }
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
                  
                  {/* Beautiful Notifications Dropdown */}
                  {showNotifications && (
                    <div className="fixed top-16 right-4 sm:right-6 md:right-10 bg-white border border-gray-200 rounded-2xl shadow-2xl w-[22rem] sm:w-[24rem] md:w-[28rem] max-h-[70vh] overflow-y-auto z-[1000] backdrop-blur-sm bg-white/95 animate-[fadeIn_150ms_ease-out]">
                      {/* Header */}
                      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-gray-800 text-lg">Notifications</h3>
                          <div className="flex items-center space-x-2">
                            {(friendRequests?.length || 0) > 0 && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                {(friendRequests?.length || 0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4">
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
                                  <button
                                    aria-label="Dismiss notification"
                                    onClick={() => setFriendRequests(prev => (prev || []).filter(r => r._id !== request._id))}
                                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                                  >
                                    ×
                                  </button>
                                  <div className="flex items-start space-x-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                      <span className="text-white text-sm font-bold">
                                        {request.senderUsername.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-800 mb-1">
                                        {request.senderUsername}
                                      </p>
                                      <p className="text-xs text-gray-600 mb-3">
                                        wants to be your friend
                                      </p>
                                      <p className="text-xs text-gray-500 mb-3">
                                        {new Date(request.createdAt).toLocaleString()}
                                      </p>
                                      <div className="flex space-x-2">
                                        <button
                                          onClick={() => respondToFriendRequest(request._id, 'accept')}
                                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-medium rounded-full hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                                        >
                                          ✓ Accept
                                        </button>
                                        <button
                                          onClick={() => respondToFriendRequest(request._id, 'decline')}
                                          className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-medium rounded-full hover:from-red-600 hover:to-rose-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                                        >
                                          ✗ Decline
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Messages are not shown in notifications dropdown */}

                        {/* No notifications */}
                        {(friendRequests?.length || 0) === 0 && (
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
                      {(friendRequests?.length || 0) > 0 && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-gray-500">
                              {(friendRequests?.length || 0)} total
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Conference Call Icon with Tooltip */}
                <div className="relative group">
                  <Users2 
                    size={20} 
                    className="text-gray-600 cursor-pointer hover:text-purple-500 transition-colors duration-200" 
                  />
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">Conference Call</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-purple-500"></div>
                  </div>
                </div>

                {/* Sort Icon with Tooltip */}
                <div className="relative group">
                  {(() => {
                    const SortIcon = getSortIcon();
                    return (
                      <SortIcon 
                        size={20} 
                        className="text-gray-600 cursor-pointer hover:text-orange-500 transition-colors duration-200" 
                        onClick={handleSortToggle}
                      />
                    );
                  })()}
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                    <div className="font-medium">
                      {sortOrder === 'none' ? 'Sort Friends' : sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-orange-500"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 bg-gray-100">
              <div className="flex items-center bg-white rounded-lg px-3 py-2">
                <Search size={18} className="mr-2 text-gray-500" />
                <input
                  type="text"
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search or start new chat"
                  className="w-full outline-none text-sm bg-transparent placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredFriends.map(chat => {
                const isAI = chat.friendusername.toLowerCase().includes('ai');
                return (
                  <div
                    key={chat._id}
                    className={`flex items-center px-3 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 transition-all duration-200 ${
                      activeChat === chat.friendid ? 'bg-gray-200' : ''
                    } ${isAI ? 'bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100' : ''}`}
                    onClick={() => onClick(chat.friendid)}
                  >
                    <div className="flex items-center mr-3">
                      {isAI ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                          <Bot size={20} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center">
                          <User size={20} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h3 className={`font-semibold text-sm ${
                          isAI ? 'text-indigo-700' : 'text-gray-800'
                        }`}>
                          {chat.friendusername}
                        </h3>
                        {newMessageCounts[chat.friendid] > 0 && (
                          <div className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-md">
                            {newMessageCounts[chat.friendid]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-300 p-3 bg-gray-200">
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-gray-300 p-2 rounded"
                onClick={() => router.replace("/remove-friend")}
              >
                <div className="flex items-center">
                  <UserMinus size={20} className="text-gray-600 mr-2" />
                  <span className="text-sm font-medium">Remove Friend</span>
                </div>
              </div>

              <div 
                onClick={SignOut}
                className="flex items-center justify-between cursor-pointer hover:bg-gray-300 p-2 rounded mt-1"
              >
                <div className="flex items-center">
                  <Button onClick={SignOut}>
                    <LogOut size={20} className="text-gray-600 mr-2" />
                  </Button>
                  <span className="text-sm font-medium">Sign Out</span>
                </div>
              </div>

              {showFriends && (
                <div className="mt-2 bg-white rounded-lg p-3 shadow">
                  <h4 className="font-medium text-sm mb-2">Friends List</h4>
                  <div className="max-h-48 overflow-y-auto">
                    {friends.map(friend => {
                      const isAI = friend.friendusername.toLowerCase().includes('ai');
                      return (
                        <div
                          key={friend._id}
                          className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded transition-all duration-200 ${
                            isAI ? 'bg-gradient-to-r from-indigo-50 to-purple-50' : ''
                          }`}
                          onClick={() => {
                            setActiveChat(friend._id);
                            setShowFriends(false);
                          }}
                        >
                          <div className="flex items-center mr-2">
                            {isAI ? (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Bot size={16} className="text-white" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
                                <User size={16} className="text-white" />
                              </div>
                            )}
                            
                          </div>
                          <span className={`text-sm ${
                            isAI ? 'text-indigo-700 font-medium' : 'text-gray-800'
                          }`}>
                            {friend.friendusername}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 border-t pt-2">
                    <button className="flex items-center text-green-600 text-sm font-medium" onClick={() => router.replace("/add-friend")}>
                      <UserPlus size={16} className="mr-1" />
                      Add New Friend
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-2/3 flex flex-col">
            {activeChat ? (
              <>
                <div className="flex justify-between items-center p-3 bg-gray-200 border-b border-gray-300">
                  <div className="flex items-center">
                    <div className="mr-3">
                      <ChevronLeft 
                        size={24} 
                        onClick={() => {
                          setActiveChat(null);
                          setMessages([]);
                          window.history.pushState(null, '', '/ui');
                          receiverId.current = null;
                          // Clear all new message counts when going back to main screen
                          setNewMessageCounts({});
                          setTotalNewMessages(0);
                        }} 
                        className="text-gray-600 cursor-pointer" 
                      />
                    </div>
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center mr-3">
                        <User size={20} className="text-white" />
                      </div>
                     <div>
  <h3 className="font-semibold text-sm text-gray-800">
    {friends.find(f => f.friendid === receiverId.current)?.friendusername || 'Friend'}
  </h3>
  {(() => {
    const isAI = friends.find(f => f.friendid === receiverId.current)?.friendusername.toLowerCase().includes('ai');
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
                      const isAI = friends.find(f => f.friendid === receiverId.current)?.friendusername.toLowerCase().includes('ai');
                      
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
                      
                      // Regular Chat - Show all buttons
                      return (
                        <>
                          {/* Video Call with Tooltip */}
                          <div className="relative group">
                            <Video
                              size={20}
                              className="text-gray-600 cursor-pointer hover:text-blue-500 transition-colors duration-200"
                              onClick={handleVideoCall}
                            />
                            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-pink-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                              <div className="font-medium">Video Call</div>
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-blue-500"></div>
                            </div>
                          </div>

                          {/* Voice Call with Tooltip */}
                          <div className="relative group">
                            <Phone 
                              size={20} 
                              className="text-gray-600 cursor-pointer hover:text-green-500 transition-colors duration-200" 
                              onClick={handleVoiceCall}
                            />
                            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                              <div className="font-medium">Voice Call</div>
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-green-500"></div>
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
                    })()}

                    {/* More Options with Enhanced Dropdown */}
                    <div className="relative group">
                      <MoreVertical size={20} className="text-gray-600 cursor-pointer hover:text-orange-500 transition-colors duration-200" />
                      
                      {/* Enhanced Dropdown Menu */}
                      <div className="absolute top-8 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-20 min-w-56 overflow-hidden transform scale-95 group-hover:scale-100">
                        {/* Gradient Header */}
                        <div className="bg-gradient-to-r from-red-500 to-pink-600 px-4 py-3">
                          <h4 className="text-white text-sm font-semibold flex items-center">
                            Chat Options
                          </h4>
                        </div>
                        
                        {/* Menu Items */}
                        <div className="py-2 bg-gradient-to-b from-gray-50 to-white">
                          {/* Clear All Chat */}
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
                          
                          {/* Search in Chat */}
                          <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-blue-400" onClick={() => setIsSearchActive(true)}>
                            <div className="p-2 bg-blue-100 rounded-lg mr-3 group-hover/item:bg-blue-200 transition-colors duration-200">
                              <Search size={16} className="text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-800 group-hover/item:text-blue-700">Search in Chat</span>
                              <p className="text-xs text-gray-500 group-hover/item:text-blue-500">Find specific messages</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-400 group-hover/item:text-blue-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>

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

                          {/* Copy Chat Link */}
                          <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-purple-50 hover:to-violet-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-purple-400" onClick={() => {
                            const chatUrl = `${window.location.origin}/ui?receiverId=${receiverId.current}`;
                            navigator.clipboard.writeText(chatUrl);
                            toast.success("Chat link copied to clipboard");
                          }}>
                            <div className="p-2 bg-purple-100 rounded-lg mr-3 group-hover/item:bg-purple-200 transition-colors duration-200">
                              <Copy size={16} className="text-purple-600" />
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-800 group-hover/item:text-purple-700">Copy Chat Link</span>
                              <p className="text-xs text-gray-500 group-hover/item:text-purple-500">Share this conversation</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-400 group-hover/item:text-purple-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>

                          {/* Mute Notifications */}
                          <div className="flex items-center px-4 py-3 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-orange-50 cursor-pointer group/item transition-all duration-200 border-l-4 border-transparent hover:border-yellow-400">
                            <div className="p-2 bg-yellow-100 rounded-lg mr-3 group-hover/item:bg-yellow-200 transition-colors duration-200">
                              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM5 7h5L5 2v5z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-800 group-hover/item:text-yellow-700">Mute Notifications</span>
                              <p className="text-xs text-gray-500 group-hover/item:text-yellow-500">Silence this conversation</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-400 group-hover/item:text-yellow-500 opacity-0 group-hover/item:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                        
                        {/* Footer with subtle gradient */}
                        <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-4 py-2">
                          <p className="text-xs text-gray-600 text-center">More options coming soon</p>
                        </div>
                      </div>
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
                        
                        <button className="p-2 text-gray-600 hover:text-purple-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                      {messages?.map((message, index) => (
                        <div
                          key={index}
                          data-message-id={message._id}
                          className={`flex ${message.senderid == session?.user?._id ? 'justify-end' : 'justify-start'} ${message.content == "Message Deleted" ? "mr-15" : ""}`}
                        >
                          <div className="flex items-center group">
                            {/* Copy button for receiver messages (left side) */}
                            {message.senderid !== session?.user?._id && message.content !== "Message Deleted" && (
                              <div className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button 
                                  onClick={() => copyMessage(message.content)}
                                  className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded-full shadow-sm transform hover:scale-110 transition-all duration-200"
                                  title="Copy message"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                </button>
                              </div>
                            )}

                            <div
                              className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
                                message.senderid === session?.user?._id
                                  ? 'bg-green-100 rounded-tr-none'
                                  : 'bg-white rounded-tl-none'
                              } ${message.content == "Message Deleted" ? "bg-red-300 rounded-tr-none pointer-events-none opacity-50" : ""}`}
                            >
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
                            </div>
                            
                            {/* Copy and Delete buttons for sender messages (right side) */}
                            {message.senderid === session?.user?._id && message.content !== "Message Deleted" && (
                              <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-row space-x-1 items-center">
                                <button 
                                  onClick={() => copyMessage(message.content)}
                                  className="p-1.5 bg-blue-500 hover:bg-blue-600 rounded-full shadow-sm transform hover:scale-110 transition-all duration-200"
                                  title="Copy message"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
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
                      ))}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                <div className="bg-gray-200 p-3 flex items-center space-x-2">
                  <Smile 
                    size={24} 
                    className="text-gray-600 cursor-pointer" 
                    onClick={() => setShowEmojiPicker((prev) => !prev)} 
                  />
                  {showEmojiPicker && (
                    <div className="absolute bottom-10 left-0 z-10">
                      <Picker data={data} onEmojiSelect={addEmoji} />
                    </div>
                  )}
                  <Paperclip size={24} className="text-gray-600" />
                  <div className="flex-1 bg-white rounded-full px-4 py-2">
                    <FormProvider {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem className="w-full">
                              <FormControl>
                                <Input
                                  placeholder="Enter message...."
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
                          <Button type="submit" className="bg-green-500" disabled={!enableSend}>
                            <Send size={24} />
                          </Button>
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-400 to-green-800 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap z-10">
                            <div className="font-medium">Send Message</div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-green-500"></div>
                          </div>
                        </div>
                      </form>
                    </FormProvider>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-100">
                <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle size={64} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-medium text-gray-600 mb-2">WhatsApp Web</h2>
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
                            {message.senderid === session?.user?._id ? 'You' : 'Friend'}
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
  </>
);
}