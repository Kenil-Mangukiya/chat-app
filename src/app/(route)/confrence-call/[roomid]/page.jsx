"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { config } from "@/config/config"; // Make sure this contains zegoCloudAppId & zegoCloudServerSecret

export default function VideoCallRoom() {
  const containerRef = useRef(null);
  const { roomid } = useParams(); // Make sure your folder is [roomid], not [roomId]
const roomID = roomid
  useEffect(() => {
    const startMeeting = async () => {
      if (!roomid || !containerRef.current) return;

      const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt"); // IMPORT INSIDE useEffect

      const appID = config.zegoCloudAppId;
      const serverSecret = config.zegoCloudServerSecret;
      const userID = roomid; // or generate one
      const userName = "Kenil";
        console.log("appID is : ",appID)
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        roomID,
        userID,
        userName
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);

      zp.joinRoom({
        container: containerRef.current,
        sharedLinks: [
          {
            name: "Personal Link",
            url: `${window.location.protocol}//${window.location.host}/video-call/${roomID}`,
          },
        ],
        scenario: {
          mode: ZegoUIKitPrebuilt.VideoConference,
        },
      });
    };

    startMeeting();
  }, [roomID]);

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4 text-center">Room ID: {roomid}</h1>
      <div ref={containerRef} className="w-full h-[600px]" />
    </div>
  );
}
