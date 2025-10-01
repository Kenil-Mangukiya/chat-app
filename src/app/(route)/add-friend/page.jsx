"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AxiosError } from "axios"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { toast } from "react-toastify"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { z } from "zod"
import socket from "@/lib/socket"
import { useEffect } from "react"
import { useSession } from "next-auth/react"

// New schema for username-based friend requests
const addFriendSchema = z.object({
    username: z.string().min(1, "Username is required")
})

function AddFriendPage() {
    const { data: session } = useSession()
    const [message, setMessage] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [debugInfo, setDebugInfo] = useState(null)
    const router = useRouter()
    
    // Ensure the sender joins their own room and listens for response notifications
    useEffect(() => {
        if (!session?.user?._id) return
        const userId = session.user._id
        socket.emit("join_room", userId)
        
        const handleResponse = (data) => {
            // No toast here; UI page modal will display the update when user is there.
            // Keeping listener so the sender stays in the room if they navigate back.
        }
        socket.on("friend_request_responded", handleResponse)

        return () => {
            socket.off("friend_request_responded", handleResponse)
        }
    }, [session?.user?._id])
        
    const form = useForm({
        resolver: zodResolver(addFriendSchema),
        defaultValues: {
            username: ""
        }
    })

    const onSubmit = async (data) => {
        setIsLoading(true)
        setMessage("")
        
        try {
            const response = await axios.post("/api/send-friend-request", {
                username: data.username
            })
            
            if (response.data.success) {
                // Server attempts notification; also emit client-side as reliable fallback
                console.log("Friend request sent successfully, server will handle notification")
                try {
                    if (response.data.receiverId && response.data.senderUsername) {
                        console.log("Emitting client-side fallback notification to:", response.data.receiverId)
                        socket.emit("friend_request_sent", {
                            receiverId: response.data.receiverId.toString(),
                            senderUsername: response.data.senderUsername
                        })
                    } else {
                        console.log("Missing receiver/sender info in response; skipping client emit")
                    }
                } catch (e) {
                    console.log("Client-side fallback notification emit failed:", e)
                }

                const message = response.data.wasReplaced 
                    ? "Friend request updated successfully!" 
                    : "Friend request sent successfully!"
                
                toast.success(message, {
                    icon: "✅",
                    position: "bottom-right",
                    style: {
                        background: "#d1fae5",        
                        color: "#065f46",               
                        border: "1px solid #10b981",    
                        padding: "12px 16px",
                        fontWeight: "500",
                        borderRadius: "8px",
                    }
                })
                setMessage(message)
                form.reset()
            } else {
                setMessage(response.data.message)
                toast.error(response.data.message)
            }
        } catch (error) {
            console.log("Full error object:", error)
            if (error instanceof AxiosError) {
                const errorMessage = error.response?.data?.message || "Error sending friend request"
                console.log("Error response:", error.response?.data)
                setMessage(errorMessage)
                toast.error(errorMessage)
            } else {
                setMessage("Error sending friend request")
                toast.error("Error sending friend request")
            }
            console.log("Error is:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const debugFriendRequest = async (username) => {
        try {
            const response = await axios.post("/api/debug-friend-request", {
                targetUsername: username
            })
            
            if (response.data.success) {
                setDebugInfo(response.data.data)
                console.log("Debug info:", response.data.data)
            }
        } catch (error) {
            console.error("Debug error:", error)
        }
    }

    return(
        <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Add Friend</h2>
            <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Username</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="text"
                                        disabled={isLoading}
                                        placeholder="Enter friend's username" 
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    {message && (
                        <p className={`text-sm ${message.includes("successfully") ? "text-green-600" : "text-red-500"}`}>
                            {message}
                        </p>
                    )}
                    
                    <div className="flex space-x-2">
                        <Button 
                            type="submit" 
                            disabled={isLoading}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                        >
                            {isLoading ? "Sending..." : "Send Friend Request"}
                        </Button>
                        
                        <Button 
                            type="button"
                            onClick={() => debugFriendRequest(form.getValues('username'))}
                            disabled={!form.getValues('username')}
                            className="bg-gray-500 hover:bg-gray-600 text-white"
                        >
                            Debug
                        </Button>
                    </div>
                    
                    {debugInfo && (
                        <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
                            <h4 className="font-bold mb-2">Debug Info:</h4>
                            <p><strong>Target User:</strong> {debugInfo.targetUser?.username}</p>
                            <p><strong>Existing Friend:</strong> {debugInfo.existingFriend ? 'Yes' : 'No'}</p>
                            <p><strong>Existing Requests:</strong> {debugInfo.existingRequests?.length || 0}</p>
                            {debugInfo.existingRequests?.length > 0 && (
                                <div className="mt-2">
                                    {debugInfo.existingRequests.map((req, index) => (
                                        <div key={index} className="text-xs">
                                            Request {index + 1}: {req.status} (Sender: {req.senderId}, Receiver: {req.receiverId})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </form> 
            </FormProvider>
        </div>
    )
}

export default AddFriendPage