"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { config } from "@/config/config";
import { Phone, PhoneOff, Clock } from "lucide-react";
import socket from "@/lib/socket";

export default function SenderVideoCall() {
  const containerRef = useRef(null);
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [zpInstance, setZpInstance] = useState(null);
  const [isCallConnecting, setIsCallConnecting] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const callTimeRef = useRef(null);
  const [callStatus, setCallStatus] = useState("connecting");
  const [receiverData, setReceiverData] = useState({});
  const hasJoinedRef = useRef(false);

  const roomId = params.receiverId;
  const receiverId = params.receiverId;

  // Format call time into MM:SS
  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Stop all media tracks (camera/mic)
  const stopAllStreams = () => {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      }
    });
  };

  // End call
  const handleEndCall = () => {
    // Immediately disable camera and microphone before anything else
    if (zpInstance && typeof zpInstance.turnCameraOn === "function") {
      zpInstance.turnCameraOn(false);
      zpInstance.turnMicrophoneOn(false);
    }
    
    stopAllStreams();
    
    if (zpInstance && typeof zpInstance.leaveRoom === "function") {
      zpInstance.leaveRoom();
    }
    
    // Notify other user the call has ended
    socket.emit("call_ended", {
      receiverId: receiverId,
      endedBy: session?.user?._id
    });
    
    if (callTimeRef.current) {
      clearInterval(callTimeRef.current);
      callTimeRef.current = null;
    }
    
    setIsCallActive(false);
    setCallStatus("ended");
    
    // Short delay before navigating away
    setTimeout(() => {
      router.push(`/ui?receiverId=${receiverId}`);
    }, 200);
  };

  useEffect(() => {
    socket.on("call_ended_by_receiver",() => {
      handleEndCall()
    })
  },[])

  const customizeZegoUI = () => {
    // Find Zego UI elements and apply custom styles
    const controlBar = document.querySelector('.ZegoUIKitPrebuilt-control-bar');
    if (controlBar) {
      controlBar.style.borderRadius = '18px';
      controlBar.style.backdropFilter = 'blur(10px)';
      controlBar.style.background = 'rgba(0, 0, 0, 0.5)';
      controlBar.style.padding = '8px 16px';
    }
    
    // Style video elements
    const videoContainers = document.querySelectorAll('.ZegoUIKitPrebuilt-video-player');
    videoContainers.forEach(container => {
      container.style.borderRadius = '24px';
      container.style.overflow = 'hidden';
      container.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
    });
  };

  useEffect(() => {
    const startMeeting = async () => {
      if (!session || !containerRef.current) return;
      if (hasJoinedRef.current) return; // prevent duplicate joins

      setIsCallConnecting(true);
      setCallStatus("connecting");
      const callerId = session.user._id;

      try {
        const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
        const appID = config.zegoCloudAppId;
        const serverSecret = config.zegoCloudServerSecret;
        const userID = session.user._id;
        const userName = session.user.username;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomId,
          userID,
          userName
        );

        const instance = ZegoUIKitPrebuilt.create(kitToken, {
          plugins: [ZegoUIKitPrebuilt.ZIM],
        });

        setZpInstance(instance);

        hasJoinedRef.current = true;
        instance.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          showPreJoinView: false,
          showLeavingView: false,
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: true,
          maxUsers: 2,
          onJoinRoom: () => {
            setIsCallConnecting(false);
            setIsCallActive(true);
            setCallStatus("active");

            if (!callTimeRef.current) {
              const timerId = setInterval(() => {
                setCallTime((prev) => prev + 1);
              }, 1000);
              callTimeRef.current = timerId;
            }
            
            // Apply custom styles to Zego elements after they're mounted
            setTimeout(() => {
              customizeZegoUI();
            }, 500);
          },
          
          onLeaveRoom: () => {
            handleEndCall();
          },
          
          onUserLeave: () => {
            // Handle remote user leaving
            setTimeout(() => {
              handleEndCall();
            }, 1000);
          },
        });
      
        
        socket.on("call_declined", (data) => {
          setCallStatus("declined");
          setTimeout(() => {
            handleEndCall();
          }, 1000);
        });
        
        socket.on("call_ended", (data) => {
          if (isCallActive || isCallConnecting) {
            setCallStatus("ended_remote");
            handleEndCall();
          }
        });
        
      } catch (error) {
        console.error("Failed to start video call:", error);
        setIsCallConnecting(false);
        setCallStatus("failed");
        setTimeout(() => router.push(`/ui?receiverId=${receiverId}`), 2000);
      }
    };

    
      socket.emit("join_room", session.user._id);
      socket.once("accepted",() => {
        setCallStatus("active");
        startMeeting()
      })
    

    return () => {
      socket.off("accepted");
      socket.off("call_declined");
      socket.off("call_ended");
      socket.off("userData");
      
      if (callTimeRef.current) {
        clearInterval(callTimeRef.current);
        callTimeRef.current = null;
      }
      stopAllStreams();
    };
  }, [session, roomId]);

  if (!session) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="text-white flex items-center gap-3">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <span>Wait a moment...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-20">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-600 rounded-full filter blur-3xl animate-blob"></div>
          <div className="absolute top-40 -right-40 w-80 h-80 bg-purple-600 rounded-full filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-40 left-1/4 w-80 h-80 bg-teal-600 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Video container */}
      <div ref={containerRef} className={`w-full h-full z-10 ${!isCallActive ? 'hidden' : ''}`} />

      {/* Call timer when active */}
      {isCallActive && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-black bg-opacity-40 backdrop-blur-md py-2 px-6 rounded-full flex items-center space-x-2 border border-white border-opacity-10">
            <Clock size={16} className="text-green-400" />
            <span className="text-white font-medium">
              {formatCallTime(callTime)}
            </span>
          </div>
        </div>
      )}

      {/* Connecting overlay */}
      {callStatus === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 z-20">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping"></div>
            <div className="relative w-full h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Phone size={36} className="text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mt-8 mb-2">Calling{receiverData.username ? ` ${receiverData.username}` : '...'}</h2>
          <p className="text-blue-300">Please wait</p>
          
          <button
            onClick={handleEndCall}
            className="mt-12 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-red-600/50 transform hover:scale-105 flex items-center justify-center"
          >
            <PhoneOff size={28} />
          </button>
        </div>
      )}
      
      {/* Call ending UI */}
      {(callStatus === "ended" || callStatus === "declined" || callStatus === "ended_remote" || callStatus === "failed") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 z-20">
          <div className="bg-red-600 p-5 rounded-full mb-6">
            <PhoneOff size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {callStatus === "declined" ? "Call Declined" : 
             callStatus === "ended_remote" ? "Call Ended by Receiver" : 
             callStatus === "failed" ? "Call Failed" : "Call Ended"}
          </h2>
          <p className="text-gray-400">Returning to previous screen...</p>
        </div>
      )}
      
      {/* Add some CSS for animations */}
      <style jsx global>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}