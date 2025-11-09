import { io } from "socket.io-client";

const getSocketUrl = () => {
  // Use NEXT_PUBLIC_SOCKET_URL if set, otherwise use NEXT_PUBLIC_FRONTEND_URL, otherwise default to localhost:3000
  const socketUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
  return socketUrl;
};

const socket = io(getSocketUrl(), {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

export default socket;