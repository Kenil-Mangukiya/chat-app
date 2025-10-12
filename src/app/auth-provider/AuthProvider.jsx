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

            // Removed duplicate friend_request_responded handler - now handled in UI page only
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