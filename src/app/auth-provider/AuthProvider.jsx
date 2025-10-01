"use client"

import {SessionProvider} from "next-auth/react"
import { useSession } from "next-auth/react"
import { useEffect } from "react"
import socket from "@/lib/socket"

function AuthProvider({children})
{
    function SocketEventsBridge(){
        const { data: session } = useSession()

        useEffect(() => {
            if(!session?.user?._id) return
            const userId = session.user._id
            socket.emit("join_room", userId)

            const handleResponded = (data) => {
                try {
                    const item = {
                        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                        message: data?.status === 'accepted'
                          ? `${data?.receiverUsername} has accepted your friend request`
                          : `${data?.receiverUsername} has declined your friend request`,
                        timestamp: Date.now(),
                        type: 'friend_response'
                    }
                    const existing = JSON.parse(sessionStorage.getItem('globalNotifications') || '[]')
                    existing.unshift(item)
                    sessionStorage.setItem('globalNotifications', JSON.stringify(existing.slice(0,50)))
                    window.dispatchEvent(new CustomEvent('global-notification', { detail: item }))
                } catch {}
            }

            socket.on('friend_request_responded', handleResponded)
            return () => socket.off('friend_request_responded', handleResponded)
        }, [session?.user?._id])

        return null
    }

    return (
        <SessionProvider>
            <SocketEventsBridge />
            {children}
        </SessionProvider>
    )
}

export default AuthProvider