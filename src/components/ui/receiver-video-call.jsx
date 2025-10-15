"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { config } from "@/config/config";
import { Phone, PhoneOff, Mic, Video, Clock } from "lucide-react";
import socket from "@/lib/socket";
import { storeCallHistory } from "@/util/store-call-history";

export default function ReceiverVideoCall() {
  const containerRef = useRef(null);
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const roomId = params.receiverId;
  const [isCallIncoming, setIsCallIncoming] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [zpInstance, setZpInstance] = useState(null);
  const [callerData, setCallerData] = useState({});
  const [callTime, setCallTime] = useState(0);
  const callTimeRef = useRef(null);
  const [callStatus, setCallStatus] = useState("incoming");
  const socketInitialized = useRef(false);
  const callStartTime = useRef(null);
  const hasJoinedRef = useRef(false);

  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const stopAllStreams = () => {
    // Stop all video elements and their streams
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        video.srcObject = null;
      }
    });

    // Also try to get user media streams directly and stop them
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Clear any existing streams that might be cached
      try {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            stream.getTracks().forEach(track => {
              track.stop();
            });
          })
          .catch(() => {
            // Ignore errors when trying to clean up
          });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  };

  const acceptCall = async () => {
    if (hasJoinedRef.current) return; // prevent duplicate accepts

    socket.emit("call_accepted",{receiverId : roomId})
    console.log("call accepted")

    setIsCallIncoming(false);
    setCallStatus("connecting");
    
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

      const instance = ZegoUIKitPrebuilt.create(kitToken);
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
          setIsCallActive(true);
          setCallStatus("active");
          
          // Clear any existing timer first
          if (callTimeRef.current) {
            clearInterval(callTimeRef.current);
          }
          
          // Set start time and create new timer
          callStartTime.current = Date.now();
          setCallTime(0);
          
          callTimeRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
            setCallTime(elapsed);
          }, 1000);
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
      
      // Apply custom styles to Zego elements after they're mounted
      setTimeout(() => {
        customizeZegoUI();
      }, 500);
      
      
    } catch (error) {
      console.error("Failed to join video call:", error);
      setCallStatus("failed");
      setTimeout(() => handleEndCall(), 2000);
    }
  };

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

  const handleEndCall = async () => {
    // Clear the timer first
    if (callTimeRef.current) {
      clearInterval(callTimeRef.current);
      callTimeRef.current = null;
    }
    
    // Reset call start time
    callStartTime.current = null;
    
    // Immediately disable camera and microphone before anything else
    if (zpInstance && typeof zpInstance.turnCameraOn === "function") {
      zpInstance.turnCameraOn(false);
      zpInstance.turnMicrophoneOn(false);
    }
    
    // Stop all media streams
    stopAllStreams();
    
    // Leave the Zego room
    if (zpInstance && typeof zpInstance.leaveRoom === "function") {
      zpInstance.leaveRoom();
    }
    
    // Store call history
    if (session?.user?._id && roomId) {
      try {
        await storeCallHistory({
          senderId: roomId,
          receiverId: session.user._id,
          callType: "video",
          duration: callTime,
          status: callTime > 0 ? "ended" : "missed",
          direction: "incoming",
          roomId: roomId
        });
      } catch (error) {
        console.error("Failed to store call history:", error);
      }
    }
    
    // Additional cleanup - force stop any remaining media
    setTimeout(() => {
      stopAllStreams();
      
      // Clear the container content
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    }, 100);
    
    // Notify the sender that the receiver ended the call (standardized event)
    socket.emit("call_ended", {
      receiverId: roomId,
      endedBy: session?.user?._id,
      direction: "receiver"
    });
    
    setIsCallActive(false);
    setCallStatus("ended");
    
    // Short delay before navigating away
    setTimeout(() => {
      router.back();
    }, 800);
  };

  const declineCall = async () => {
    // Notify the sender that the call was declined
    socket.emit("call_declined", { callerId: roomId });
    
    setCallStatus("declined");
    
    // Store call history for declined call
    if (session?.user?._id && roomId) {
      try {
        await storeCallHistory({
          senderId: roomId,
          receiverId: session.user._id,
          callType: "video",
          duration: 0,
          status: "declined",
          direction: "incoming",
          roomId: roomId
        });
      } catch (error) {
        console.error("Failed to store call history:", error);
      }
    }
    
    setTimeout(() => {
      handleEndCall();
    }, 500);
  };

  // Set up socket listeners immediately when component mounts
  useEffect(() => {
    // Initialize socket listeners as soon as possible
    const initializeSocketListeners = () => {
      console.log("Setting up socket listeners for receiver");
      
      // Listen for sender data
      socket.on("sender_data", (data) => {
        console.log("Received sender data:", data);
        setCallerData(data);
      });
      
      // Listen for call ended by caller (standardized to sender)
      socket.on("call_ended_by_sender", () => {
        if (isCallActive) {
          setCallStatus("ended_remote");
          handleEndCall();
        }
      });
      
      // Re-request sender data if we don't have it yet
      if (roomId && Object.keys(callerData).length === 0) {
        console.log("Requesting sender data");
        socket.emit("request_sender_data", roomId);
      }
    };
    
    // Set up socket listeners immediately
    initializeSocketListeners();
    
    return () => {
      socket.off("sender_data");
      socket.off("call_ended_by_sender");
      
      // Cleanup timer on unmount
      if (callTimeRef.current) {
        clearInterval(callTimeRef.current);
        callTimeRef.current = null;
      }
      
      // Cleanup streams on unmount
      stopAllStreams();
    };
  }, []);

  // Separate useEffect for handling session changes
  useEffect(() => {
    if (session?.user?._id && !socketInitialized.current) {
      console.log("Session available, joining room:", session.user._id);
      socket.emit("join_room", session.user._id);
      
      // Request sender data again after joining the room
      if (roomId) {
        console.log("Requesting sender data after joining room");
        socket.emit("request_sender_data", roomId);
      }
      
      socketInitialized.current = true;
    }
  }, [session, roomId]);

  // Monitor callerData changes
  useEffect(() => {
    console.log("callerData updated:", callerData);
  }, [callerData]);

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

      {/* Connecting status */}
      {callStatus === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 z-20">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping"></div>
            <div className="relative w-full h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Phone size={36} className="text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mt-8 mb-2">Connecting...</h2>
          <p className="text-blue-300">Setting up your call</p>
        </div>
      )}

      {/* Incoming call UI */}
      {isCallIncoming && !isCallActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-95 z-10">
          <div className="flex flex-col items-center p-8 bg-gray-800 bg-opacity-80 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-sm border border-gray-700">
            {/* Caller avatar with pulse effect */}
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping"></div>
              <div className="w-36 h-36 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center relative">
                {callerData?.profilePic ? (
                  <img 
                    src={callerData.profilePic} 
                    alt="avatar" 
                    className="w-full h-full rounded-full object-cover border-4 border-white border-opacity-20" 
                  />
                ) : (
                  <span className="text-5xl font-bold text-white">
                    {callerData?.username?.[0]?.toUpperCase() || "?"}
                  </span>
                )}
              </div>
            </div>

            {/* Caller details */}
            <h2 className="text-3xl font-bold text-white mb-2">{callerData?.username || "Incoming Call"}</h2>
            <div className="flex items-center space-x-2 mb-8">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-blue-400 text-lg">Incoming video call</p>
            </div>
            
            {/* User details if available */}
            {callerData?.email && (
              <div className="w-full bg-gray-900 bg-opacity-60 rounded-xl p-3 mb-6">
                <p className="text-gray-400 text-sm text-center">{callerData?.email}</p>
                {callerData.status && (
                  <p className="text-gray-300 text-sm italic mt-1">{callerData?.status}</p>
                )}
              </div>
            )}

            {/* Call actions */}
            <div className="flex space-x-10 mt-4">
              <button 
                onClick={declineCall}
                className="flex flex-col items-center"
              >
                <div className="bg-red-600 p-5 rounded-full text-white hover:bg-red-700 shadow-lg hover:shadow-red-600/50 transform hover:scale-105 transition-all duration-300">
                  <PhoneOff size={28} />
                </div>
                <span className="text-gray-300 mt-2">Decline</span>
              </button>
              
              <button 
                onClick={acceptCall}
                className="flex flex-col items-center"
              >
                <div className="bg-green-500 p-5 rounded-full text-white hover:bg-green-600 shadow-lg hover:shadow-green-500/50 transform hover:scale-105 transition-all duration-300">
                  <Phone size={28} />
                </div>
                <span className="text-gray-300 mt-2">Accept</span>
              </button>
            </div>
          </div>
        </div>

      )}
      
      {/* Call ending UI */}
      {(callStatus === "ended" || callStatus === "declined" || callStatus === "ended_remote") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 z-20">
          <div className="bg-red-600 p-5 rounded-full mb-6">
            <PhoneOff size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {callStatus === "declined" ? "Call Declined" : 
             callStatus === "ended_remote" ? "Call Ended by Caller" : "Call Ended"}
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