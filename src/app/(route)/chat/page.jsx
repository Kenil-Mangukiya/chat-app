"use client"

import { sendMessage } from "@/app/api/message-handler.js"
import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import socket from "@/lib/socket"
import { messageSchema } from "@/schema/message-schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { Bell, MessageCircle, Phone, Video, PhoneOff, PhoneCall } from "lucide-react"
import { formatCallDuration, getCallStatusText } from "@/util/store-call-history"

function ChatPage() {
    const { data: session, status } = useSession()
    const [messages, setMessages] = useState([])
    const searchParams = useSearchParams()
    const receiverId = searchParams.get("receiverId")
    const [contentError, setContentError] = useState("")
    const [notifications, setNotifications] = useState([])
    const [showNotifications, setShowNotifications] = useState(false)
    const notificationRef = useRef(null)

    console.log("Session data is: ", session)
    console.log("Receiver ID from URL: ", receiverId)

    const form = useForm({
        resolver: zodResolver(messageSchema),
        defaultValues: {
            content: ""
        }
    })

    useEffect(() => {
        if (session?.user?._id) {
            socket.emit("join_room", session.user._id)
            console.log("Joined room:", session.user._id)
        }
    }, [session])

    useEffect(() => {
        socket.on("message_sent", (newMessage) => {
            console.log("Message from server is : ", newMessage)
            setMessages((prevMessages) => [...prevMessages, newMessage])
        })

        socket.on("receive_message", (newMessage) => {
          console.log("Received message from server: ", newMessage);
          setMessages((prevMessages) => [...prevMessages, newMessage]);
          
          // Add notification for received messages
          if (newMessage.senderid !== session?.user?._id) {
            setNotifications(prev => [...prev, {
              id: Date.now(),
              message: newMessage.content,
              sender: newMessage.senderid,
              timestamp: new Date()
            }]);
          }
        });

        return () => {
            socket.off("message_sent") // Clean up listener on unmount
        }
    }, [session?.user?._id])

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

    const onSubmit = async (data) => {
        if (!data.content || data.content.trim() === "") {
            setContentError("Please enter a message")
            return
        }

        setContentError("")

        if (session?.user?._id && receiverId) {
            try {
                await sendMessage(session.user._id, receiverId, data.content)
                form.reset()
            } catch (error) {
                console.error(error)
                setContentError("Failed to send message")
            }
        } else {
            console.error("Cannot send message: Missing user ID or receiver ID")
            if (!session?.user?._id) {
                setContentError("You must be logged in to send messages")
            } else if (!receiverId) {
                setContentError("No recipient selected")
            }
        }
    }

    // Function to render call history message
    const renderCallMessage = (msg) => {
        const isOwnMessage = msg.senderid === session?.user?._id;
        const callData = msg.callData;
        const statusText = getCallStatusText(callData.status, callData.direction, callData.callType);
        const duration = callData.duration > 0 ? formatCallDuration(callData.duration) : null;
        
        // Determine icon and colors based on call type and status
        const getCallIcon = () => {
            if (callData.status === 'missed' || callData.status === 'declined') {
                return callData.callType === 'voice' ? 
                    <PhoneOff className="w-4 h-4" /> : 
                    <Video className="w-4 h-4" />;
            }
            return callData.callType === 'voice' ? 
                <Phone className="w-4 h-4" /> : 
                <Video className="w-4 h-4" />;
        };

        const getCallColors = () => {
            if (callData.status === 'missed' || callData.status === 'declined') {
                return {
                    bg: isOwnMessage ? 'bg-red-50 border-red-200' : 'bg-red-50 border-red-200',
                    text: 'text-red-700',
                    icon: 'text-red-500'
                };
            }
            return {
                bg: isOwnMessage ? 'bg-green-50 border-green-200' : 'bg-green-50 border-green-200',
                text: 'text-green-700',
                icon: 'text-green-500'
            };
        };

        const colors = getCallColors();

        return (
            <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
                <div className={`max-w-xs px-4 py-3 rounded-2xl border ${colors.bg} ${colors.text} shadow-sm`}>
                    <div className="flex items-center space-x-3">
                        <div className={`${colors.icon}`}>
                            {getCallIcon()}
                        </div>
                        <div className="flex-1">
                            <div className="font-medium text-sm flex items-center gap-2">
                                <span>{statusText}</span>
                                {duration && (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/60">
                                    <PhoneCall className="w-3 h-3 opacity-80" />
                                    {duration}
                                  </span>
                                )}
                            </div>
                            <div className="text-xs opacity-60 mt-1">
                                {new Date(msg.createdAt).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Function to render regular text message
    const renderTextMessage = (msg) => {
        const isOwnMessage = msg.senderid === session?.user?._id;
        
        return (
            <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
                <div className={`max-w-xs px-4 py-3 rounded-2xl ${
                    isOwnMessage 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-800'
                } shadow-sm`}>
                    <div className="text-sm">
                        {msg.content}
                    </div>
                    <div className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4">
            {/* Display messages */}
            <div className="mb-4 border rounded-lg p-4 h-auto max-h-96 overflow-y-auto bg-gray-50">
                {messages.map((msg, index) => (
                    <div key={index}>
                        {msg.messageType === 'call' ? renderCallMessage(msg) : renderTextMessage(msg)}
                    </div>
                ))}
                {messages.length === 0 && (
                    <div className="flex items-center justify-center h-32">
                        <p className="text-gray-400 text-center">No messages yet</p>
                    </div>
                )}
            </div>

            {/* Message input form */}
            <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Message</FormLabel>
                                <FormControl>
                                    <Input
                                        type="text"
                                        placeholder="Enter message..."
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {contentError && <p className="text-red-500">{contentError}</p>}
                    <div className="flex items-center space-x-3">
                        <Button type="submit" className="flex items-center space-x-2">
                            <MessageCircle size={16} />
                            <span>Send</span>
                        </Button>
                        
                        {/* Notification Icon */}
                        <div className="relative group" ref={notificationRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors duration-200 relative"
                            >
                                <Bell size={20} className="text-gray-600" />
                                {notifications.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                                        {notifications.length}
                                    </span>
                                )}
                            </button>
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg whitespace-nowrap">
                                <div className="font-medium">Notifications</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                            </div>
                            
                            {/* Notifications Dropdown */}
                            {showNotifications && (
                                <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg w-80 max-h-64 overflow-y-auto z-50">
                                    <div className="p-3 border-b border-gray-200">
                                        <h3 className="font-semibold text-gray-800">Notifications</h3>
                                    </div>
                                    <div className="p-2">
                                        {notifications.length === 0 ? (
                                            <p className="text-gray-500 text-sm text-center py-4">No notifications</p>
                                        ) : (
                                            notifications.map((notification) => (
                                                <div key={notification.id} className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                                    <div className="flex items-start space-x-2">
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                                        <div className="flex-1">
                                                            <p className="text-sm text-gray-800">{notification.message}</p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {notification.timestamp.toLocaleTimeString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {notifications.length > 0 && (
                                        <div className="p-2 border-t border-gray-200">
                                            <button
                                                onClick={() => setNotifications([])}
                                                className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                            >
                                                Clear all notifications
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </FormProvider>

            {/* Display receiver info */}
            {receiverId ? (
                <p className="mt-4 text-sm text-gray-500">Chatting with user: {receiverId}</p>
            ) : (
                <p className="mt-4 text-sm text-red-500">No recipient selected. Add "?receiverId=USER_ID" to the URL.</p>
            )}
        </div>
    )
}

export default ChatPage
