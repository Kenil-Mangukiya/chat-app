"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { config } from "@/config/config";
import { Phone, PhoneOff, Mic, MicOff, User, Clock } from "lucide-react";
import socket from "@/lib/socket";
import { storeCallHistory } from "@/util/store-call-history";

export default function ReceiverVoiceCall() {
  const containerRef = useRef(null);
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [zpInstance, setZpInstance] = useState(null);
  const [isCallConnecting, setIsCallConnecting] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const callTimeRef = useRef(null);
  const [callStatus, setCallStatus] = useState("incoming"); // Changed from "connecting" to "incoming"
  const [callerData, setCallerData] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const socketInitialized = useRef(false);
  const [localStream, setLocalStream] = useState(null);
  const hasJoinedRef = useRef(false);
  const cameraOffEnforcerRef = useRef(null);
  const domObserverRef = useRef(null);
  const endedByRemoteRef = useRef(false);

  const roomId = params.receiverid;
  const callerId = params.receiverid;

  // Format call time into MM:SS
  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Stop all media tracks (mic and camera)
  const stopAllStreams = () => {
    // Stop all audio elements
    const audioElements = document.querySelectorAll("audio");
    audioElements.forEach((audio) => {
      const stream = audio.srcObject;
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      }
    });

    // Stop all video elements (in case camera was accessed)
    const videoElements = document.querySelectorAll("video");
    videoElements.forEach((video) => {
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      }
    });

    // Also stop any getUserMedia streams directly
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: false, video: false }).catch(() => {});
    }
  };

 const toggleMute = () => {
  if (zpInstance && zpInstance.express && typeof zpInstance.express.muteMicrophone === "function") {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);

    zpInstance.express.muteMicrophone(newMuteState); // true = mute, false = unmute
    console.log("Mic mute toggled via express.muteMicrophone:", newMuteState);
  } else {
    console.warn("muteMicrophone not found in zpInstance.express");
  }
};

  // End call
  const handleEndCall = async () => {
    console.log("handleEndCall is called")
    
    // Reset state flags immediately to prevent re-joins
    hasJoinedRef.current = false;
    
    // Stop all streams first
    stopAllStreams();
    
    // Immediately disable microphone before anything else
    if (zpInstance && typeof zpInstance.turnMicrophoneOn === "function") {
      await zpInstance.turnMicrophoneOn(false);
    }
    
    // Also disable camera if it was somehow turned on
    if (zpInstance && typeof zpInstance.turnCameraOn === "function") {
      zpInstance.turnCameraOn(false);
    }

    if (zpInstance && typeof zpInstance.leaveRoom === "function") {
      zpInstance.leaveRoom();
    }

    // Store call history only if local user ended (avoid duplicates)
    if (!endedByRemoteRef.current && session?.user?._id && callerId) {
      try {
        await storeCallHistory({
          senderId: callerId,
          receiverId: session.user._id,
          callType: "voice",
          duration: callTime,
          status: callTime > 0 ? "ended" : "missed",
          direction: "incoming",
          roomId: roomId
        });
      } catch (error) {
        console.error("Failed to store call history:", error);
      }
    }

    if (!endedByRemoteRef.current) {
      socket.emit("call_ended",{
        receiverId: callerId,
        endedBy : session.user._id,
        direction : "receiver",
        duration: callTime
      })
    }

    if (callTimeRef.current) {
      clearInterval(callTimeRef.current);
      callTimeRef.current = null;
    }
    
    if (cameraOffEnforcerRef.current) {
      clearInterval(cameraOffEnforcerRef.current);
      cameraOffEnforcerRef.current = null;
    }
    
    setIsCallActive(false);
    setCallStatus("ended");
    
    // Short delay before navigating away
    setTimeout(() => {
      router.push(`/ui?callerId=${callerId}`);
    }, 300);
  };

  // Decline call
  const handleDeclineCall = async () => {
    socket.emit("call_declined", {
      callerId: callerId,
      receiverId: session?.user?._id
    });
    
    setCallStatus("declined");
    
    // Store call history for declined call
    if (session?.user?._id && callerId) {
      try {
        await storeCallHistory({
          senderId: callerId,
          receiverId: session.user._id,
          callType: "voice",
          duration: 0,
          status: "declined",
          direction: "incoming",
          roomId: roomId
        });
      } catch (error) {
        console.error("Failed to store call history:", error);
      }
    }
    
    // Short delay before navigating away
    setTimeout(() => {
      router.push(`/ui?callerId=${callerId}`);
    }, 1500);
  };

  // Accept call
  const handleAcceptCall = async () => {
    if (!session || !containerRef.current) return;
    if (hasJoinedRef.current) {
      console.log("Preventing duplicate accept - already joined");
      return;
    }

    setCallStatus("connecting");
    const receiverId = session.user._id;

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

      // Emit call accepted event (notify sender explicitly)
      socket.emit("call_accepted", {
        receiverId: receiverId
      });

      hasJoinedRef.current = true;
      instance.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall,
        },
        showPreJoinView: false,
        showLeavingView: false,
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: false, // Disable camera for voice calls
        showMyCameraToggleButton: false, // Hide camera toggle
        showAudioVideoSettingsButton: false, // Hide AV settings
        showScreenSharingButton: false, // Hide screen sharing
        showTextChat: false, // Hide text chat
        showUserList: false, // Hide user list
        showRoomTimer: false, // Hide room timer
        showConnectionState: false, // Hide connection state
        maxUsers: 2,
        onJoinRoom: () => {
          console.log("Receiver successfully joined room");
          setIsCallConnecting(false);
          setIsCallActive(true);
          setCallStatus("active");

          // Start timer only once
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

          // Aggressively ensure camera stays off
          const enforceCameraOff = () => {
            if (instance && typeof instance.turnCameraOn === "function") {
              instance.turnCameraOn(false);
            }
          };

          // Immediate enforcement
          enforceCameraOff();
          
          // Multiple delayed enforcements
          setTimeout(enforceCameraOff, 100);
          setTimeout(enforceCameraOff, 500);
          setTimeout(enforceCameraOff, 1000);
          setTimeout(enforceCameraOff, 2000);

          // Extra safeguard: enforce camera off repeatedly
          if (!cameraOffEnforcerRef.current) {
            let attempts = 0;
            cameraOffEnforcerRef.current = setInterval(() => {
              attempts += 1;
              enforceCameraOff();
              if (attempts >= 10) {
                clearInterval(cameraOffEnforcerRef.current);
                cameraOffEnforcerRef.current = null;
              }
            }, 300);
          }

          startCameraOffDomWatcher();
        },
        
        onLeaveRoom: () => {
          console.log("Receiver left room");
          handleEndCall();
        },
        
        onUserLeave: () => {
          console.log("Remote user left");
          // Handle remote user leaving
          setTimeout(() => {
            handleEndCall();
          }, 1000);
        },
      });
    } catch (error) {
      console.error("Failed to join voice call:", error);
      setIsCallConnecting(false);
      setCallStatus("failed");
      hasJoinedRef.current = false; // Reset on error
      setTimeout(() => router.push(`/ui?callerId=${callerId}`), 2000);
    }
  };

  const customizeZegoUI = () => {
    // Hide video elements since this is voice-only
    const videoElements = document.querySelectorAll('.ZegoUIKitPrebuilt-video-player');
    videoElements.forEach(element => {
      if (element) {
        element.style.display = 'none';
      }
    });
    
    // Hide any camera related UI elements
    const cameraButtons = document.querySelectorAll('[data-testid*="camera"], [class*="camera"]');
    cameraButtons.forEach(element => {
      if (element) {
        element.style.display = 'none';
      }
    });
    
    // Find Zego UI elements and apply custom styles
    const controlBar = document.querySelector('.ZegoUIKitPrebuilt-control-bar');
    if (controlBar) {
      controlBar.style.display = 'none'; // Hide the default control bar
    }
  };

  const startCameraOffDomWatcher = () => {
    if (domObserverRef.current) return;
    const observer = new MutationObserver(() => {
      const videos = document.querySelectorAll("video");
      videos.forEach((v) => {
        const stream = v.srcObject;
        if (stream) {
          stream.getVideoTracks?.().forEach((t) => {
            try { t.stop(); t.enabled = false; } catch {}
          });
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    domObserverRef.current = observer;
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
        
        // Listen for call ended by caller
        socket.once("call_ended_by_sender", (data) => {
            endedByRemoteRef.current = true;
            if (typeof data?.duration === "number" && data.duration >= 0) {
              setCallTime(data.duration);
            }
            handleEndCall();
        });
        // Fallback: also react to generic call_ended
        socket.once("call_ended", (data) => {
            endedByRemoteRef.current = true;
            if (typeof data?.duration === "number" && data.duration >= 0) {
              setCallTime(data.duration);
            }
            handleEndCall();
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
        socket.off("call_ended_by_sender")
        socket.off("call_ended")
        clearInterval(callTimeRef.current);
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

  useEffect(() => {
    if (session) {
      socket.emit("join_room", session.user._id);
      
      // We don't automatically join the call now - wait for user to accept
      // The joinVoiceCall() function has been removed from here and is now called 
      // by the Accept Call button via handleAcceptCall()
    }

    return () => {
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
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-600 rounded-full filter blur-3xl animate-blob"></div>
          <div className="absolute top-40 -right-40 w-80 h-80 bg-violet-600 rounded-full filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-40 left-1/4 w-80 h-80 bg-blue-600 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Hidden container for Zego */}
      <div ref={containerRef} className="hidden" />

      {/* Active call UI */}
      {isCallActive && (
        <div className="relative z-20 flex flex-col items-center justify-center h-full w-full">
          {/* Profile and call info */}
          <div className="flex flex-col items-center">
            {/* Avatar */}
            <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-6 relative">
              {callerData.avatar ? (
                <img 
                  src={callerData.avatar} 
                  alt={callerData.username || "User"} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User size={64} className="text-white" />
              )}
              
              {/* Sound wave animation */}
              <div className={`absolute inset-0 rounded-full ${isMuted ? 'hidden' : ''}`}>
                <div className="absolute inset-0 rounded-full border-4 border-white opacity-30 animate-ping"></div>
                <div className="absolute inset-0 rounded-full border-2 border-white opacity-20 animate-ping animation-delay-300"></div>
              </div>
            </div>
            
            {/* Caller name */}
            <h2 className="text-2xl font-bold text-white mb-2">
              {callerData.username || "User"}
            </h2>
            
            {/* Call status */}
            <div className="flex items-center space-x-2 bg-black bg-opacity-40 backdrop-blur-md py-2 px-6 rounded-full mb-8 border border-white border-opacity-10">
              <Clock size={16} className="text-green-400" />
              <span className="text-white font-medium">
                {formatCallTime(callTime)}
              </span>
            </div>
            
            {/* Audio visualization */}
            <div className={`flex items-end justify-center space-x-2 mb-16 ${isMuted ? 'opacity-30' : 'opacity-100'}`}>
              {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
                <div 
                  key={bar}
                  className={`w-3 bg-blue-500 rounded-full ${isMuted ? '' : 'animate-sound-wave'}`}
                  style={{ 
                    height: `${Math.random() * 40 + 10}px`,
                    animationDelay: `${bar * 0.1}s` 
                  }}
                ></div>
              ))}
            </div>
            
            {/* Call controls */}
            <div className="flex items-center space-x-8">
              {/* Mute/unmute button */}
              <button
                onClick={toggleMute}
                className={`p-5 rounded-full transition-all duration-300 transform hover:scale-105 flex items-center justify-center ${
                  isMuted 
                    ? "bg-gray-800 text-red-500 border-2 border-red-500" 
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-600/50"
                }`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              
              {/* End call button */}
              <button
                onClick={handleEndCall}
                className="bg-red-600 hover:bg-red-700 text-white p-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-red-600/50 transform hover:scale-105 flex items-center justify-center"
              >
                <PhoneOff size={24} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connecting overlay */}
      {callStatus === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 z-20">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-indigo-500 opacity-30 animate-ping"></div>
            <div className="relative w-full h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
              <Phone size={36} className="text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mt-8 mb-2">
            Connecting to{callerData.username ? ` ${callerData.username}` : '...'}
          </h2>
          <p className="text-indigo-300">Please wait...</p>
        </div>
      )}

      {/* Incoming call UI - NEW */}
      {callStatus === "incoming" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 z-20">
          <div className="flex flex-col items-center">
            {/* Caller avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-6 relative">
              {callerData.avatar ? (
                <img 
                  src={callerData.avatar} 
                  alt={callerData.username || "User"} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User size={48} className="text-white" />
              )}
              
              {/* Ringing animation */}
              <div className="absolute inset-0 rounded-full">
                <div className="absolute inset-0 rounded-full border-4 border-green-400 opacity-75 animate-ping"></div>
                <div className="absolute inset-0 rounded-full border-2 border-green-400 opacity-50 animate-ping animation-delay-300"></div>
              </div>
            </div>
            
            {/* Caller info */}
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              {callerData.username || "User"}
            </h2>
            <p className="text-indigo-300 mb-12">Incoming voice call</p>
            
            {/* Call actions */}
            <div className="flex items-center space-x-8">
              {/* Decline button */}
              <button
                onClick={handleDeclineCall}
                className="bg-red-600 hover:bg-red-700 text-white p-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-red-600/50 transform hover:scale-105"
              >
                <PhoneOff size={24} />
              </button>
              
              {/* Accept button */}
              <button
                onClick={handleAcceptCall}
                className="bg-green-600 hover:bg-green-700 text-white p-5 rounded-full transition-all duration-300 shadow-lg hover:shadow-green-600/50 transform hover:scale-105"
              >
                <Phone size={24} />
              </button>
            </div>
          </div>
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
             callStatus === "ended_remote" ? "Call Ended by Caller" : 
             callStatus === "failed" ? "Call Failed" : "Call Ended"}
          </h2>
          <p className="text-gray-400">Returning to previous screen...</p>
        </div>
      )}
      
      {/* Add CSS for animations */}
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
        .animation-delay-300 {
          animation-delay: 0.3s;
        }
        @keyframes sound-wave {
          0% { height: 10px; }
          50% { height: 40px; }
          100% { height: 10px; }
        }
        .animate-sound-wave {
          animation: sound-wave 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}