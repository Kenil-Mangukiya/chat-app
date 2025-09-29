// video-call/[receiverId]/page.jsx
"use client";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VideoCallPage() {
  const router = useRouter() 
  const params = useParams();
  const { data: session } = useSession();
  const receiverId = params.receiverId ;

  useEffect(() => {
    
    if (session) {
      // Check if the logged-in user is the sender
      if (session.user._id == receiverId) {
        // If the logged-in user is the receiver, navigate to the receiver page
        router.push(`/video-call/${receiverId}/receiver`);
      } else {
        // If the logged-in user is the sender, navigate to the sender page
        router.push(`/video-call/${receiverId}/sender`);
      }
    }
  }, [session, receiverId, params]);

  return <div>Loading...</div>;
}
