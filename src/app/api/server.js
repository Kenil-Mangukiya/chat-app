import userModel from "../../model/user-model.js";
import { connectDb } from "../../db/connect-db.js";
import conversationModel from "../../model/conversation-model.js";
import messageModel from "../../model/message-model.js";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import friendModel from "../../model/friend-model.js";
import mongoose from "mongoose";
import socket from "../../lib/socket.js";
import { setSocketInstance, processNotificationQueue } from "../../lib/socket-server.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();


app.prepare().then(async () => {
  await connectDb(); 

  const server = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  // Export the socket instance for use in other modules
  global.socketInstance = io;

  // Set the socket instance and immediately drain any queued notifications
  setSocketInstance(io);
  console.log("Socket instance set, processing any queued notifications...");
  
  // Process queued notifications after a short delay to ensure everything is ready
  setTimeout(() => {
    try {
      const drained = processNotificationQueue();
      if (drained) {
        console.log("Queued notifications processed after socket init");
      }
    } catch (e) {
      console.log("Error processing queued notifications:", e);
    }
  }, 100);


  const callDataCache = new Map();
  const socketUser  = new Map();

  // Function to update user data in cache
  const updateUserCache = async (userId) => {
    try {
      const updatedUser = await userModel.findOne({_id: userId});
      if (updatedUser) {
        callDataCache.set(userId, updatedUser);
        console.log(`Updated user cache for ${userId}:`, updatedUser);
      }
    } catch (error) {
      console.error(`Error updating user cache for ${userId}:`, error);
    }
  };

  // Export the updateUserCache function for use in API routes
  global.updateUserCache = updateUserCache;

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_room", async (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined room`);
      socketUser.set(socket.id,userId)
      socket.userId = userId; 
      socket.broadcast.emit("user_came_online", { userId: userId });
      console.log(userId, " User joined room")
      
  });

  socket.on("set_data",async ({userId}) => {
    const findUser = await userModel.findOne({_id : userId})
    console.log(userId,findUser)
    if(findUser)
    {
      if(!callDataCache.has(userId))
      {
        callDataCache.set(userId,findUser)
        console.log("callDataCache is : ",callDataCache)
      }
      else
      {
        console.log("User is already in callDataCache",callDataCache)
      }
    }
  })
  

    socket.on("send_message", async (messageData) => {
      try {
        console.log("Message data is: ", messageData);

        // Check if either user has blocked the other
        const friendship1 = await friendModel.findOne({
          userid: messageData.senderid,
          friendid: messageData.receiverid
        });

        const friendship2 = await friendModel.findOne({
          userid: messageData.receiverid,
          friendid: messageData.senderid
        });

        // If either friendship is blocked, prevent messaging
        if ((friendship1 && friendship1.isBlocked) || (friendship2 && friendship2.isBlocked)) {
          console.log("Message blocked: Users have blocked each other");
          io.to(messageData.senderid).emit("message_blocked", {
            message: "You cannot send messages to this user. They have been blocked.",
            receiverId: messageData.receiverid
          });
          return;
        }

        let conversation = await conversationModel.findOne({
          participants: { $all: [messageData.senderid, messageData.receiverid] },
        });

        if (!conversation) {
          conversation = await conversationModel.create({
            participants: [messageData.senderid, messageData.receiverid],
          });
        }

        const newMessage = await messageModel.create({
          conversationid: conversation._id,
          senderid: messageData.senderid,
          receiverid: messageData.receiverid,
          content: messageData.content,
          attachment: messageData.attachment,
          messageType: messageData.messageType || 'text',
        });

        await conversationModel.findByIdAndUpdate(conversation._id, {
          lastmessage: newMessage._id,
          updatedat: Date.now(),
        });

        console.log("📤 EMITTING TO SENDER:", messageData.senderid, "MESSAGE:", newMessage._id);
        io.to(messageData.senderid).emit("send_message_to_sender", newMessage);
        
        console.log("📤 EMITTING TO RECEIVER:", messageData.receiverid, "MESSAGE:", newMessage._id);
        io.to(messageData.receiverid).emit("send_message_to_receiver", newMessage);

        // Emit new_message event for notifications (only to receiver)
        let notificationContent = messageData.content;
        if (!notificationContent && messageData.attachment) {
          // Create specific notification content based on attachment type
          const attachment = messageData.attachment;
          if (attachment.resourceType === 'image') {
            notificationContent = '📷 Sent a photo';
          } else if (attachment.resourceType === 'video') {
            notificationContent = '🎥 Sent a video';
          } else if (attachment.resourceType === 'raw') {
            notificationContent = '📎 Sent a document';
          } else {
            notificationContent = '📎 Sent a file';
          }
        }
        
        io.to(messageData.receiverid).emit("new_message", {
          content: notificationContent,
          receiverId: messageData.receiverid,
          senderId: messageData.senderid
        });

      } catch (error) {
        console.log("Error while sending the message in server.js file: ", error);
      }
    });

    // Call functionality removed

    // Call functionality removed

    socket.on("all_messages", async ({ senderId, receiverId }) => {
      try {
        const conversation = await conversationModel.findOne({
          participants: { $all: [senderId, receiverId] },
        });

        if (!conversation) {
          return socket.emit("receive_messages", []);
        }

        // Check if user has cleared messages
        const clearedState = conversation.clearedFor?.[`clearedFor_${senderId}`];
        let query = { conversationid: conversation._id };

        // If user has cleared messages, only show messages after the cleared timestamp
        if (clearedState && clearedState.lastMessageId) {
          query.createdAt = { $gt: new Date(clearedState.clearedAt) };
        }

        const messages = await messageModel.find(query).sort({ createdAt: 1 });

        socket.emit("receive_messages", messages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    });

    socket.on("get_friends", async (userId) => {
      try {
        const friendData = await friendModel.find({ userid: userId }).sort({ friendusername: 1 });
        console.log("friendData is : ",friendData)
        socket.emit("friend_list", friendData);
      } catch (error) {
        console.log("Error in get_friends event: ", error);
      }
    });

    // Handle profile updates and notify all friends
    socket.on("profile_updated", async (data) => {
      try {
        console.log("Profile updated for user:", data.userId);
        console.log("Profile update data:", data);
        
        // Find all users who have this user as a friend (reverse relationship)
        const reverseFriends = await friendModel.find({ friendid: data.userId });
        console.log("Found friends to notify:", reverseFriends.length);
        
        // Notify each user who has this person as a friend
        for (const friend of reverseFriends) {
          const friendSocket = Array.from(socketUser.entries()).find(([socketId, userId]) => userId === friend.userid);
          if (friendSocket) {
            const [socketId] = friendSocket;
            console.log(`Notifying friend ${friend.userid} via socket ${socketId}`);
            io.to(socketId).emit("friend_profile_updated", {
              friendId: data.userId,
              username: data.username,
              profilePicture: data.profilePicture,
              email: data.email
            });
          } else {
            console.log(`Friend ${friend.userid} is not connected`);
          }
        }
        
        // Also notify the user's own friends list
        console.log("Notifying user's own socket");
        socket.emit("friend_profile_updated", {
          friendId: data.userId,
          username: data.username,
          profilePicture: data.profilePicture,
          email: data.email
        });
        
      } catch (error) {
        console.log("Error in profile_updated event: ", error);
      }
    });

    // Group events
    socket.on("group_member_added", ({ groupId, userId }) => {
      io.to(userId).emit("group_invited", { groupId });
    });

    // Call functionality removed

    socket.on("message_deleted",async ({id,receiverId}) => {
    
    console.log("message_deleted called")
    io.to(receiverId).emit("deleted",{id})

  })

  // Call functionality removed

 socket.on("status", ({receiverId}) => {
    console.log("receiverId in server.js is : ", receiverId)
    // Find the socket ID of the receiver to check if they're online
    const receiverSocketId = Array.from(socketUser.entries())
        .find(([socketId, userId]) => userId == receiverId)?.[0];
    console.log("receiverSocketId is :----------- ",receiverSocketId)
    if(receiverId == "682b2f6d291405d4562b7f51")
    {
        socket.emit("online", {userId: receiverId});
        return
    }
    if (receiverSocketId) {
        // Receiver is online - send status only to the requester
        socket.emit("online", {userId: receiverId});
    } else {
        // Receiver is offline - send status to requester
        socket.emit("offline", {userId: receiverId});
    }
    
})

  socket.on("typing",({receiverId}) => {
    console.log("receiverId is : ",receiverId)
    io.to(receiverId).emit("is_typing",[])
  })

  socket.on("is_not_typing",({receiverId}) => {
    io.to(receiverId).emit("not_typing",[])
  })

  socket.on("new_messages",({receiverId,content,senderId}) =>
  {
    console.log("receiverId is :---------- ",receiverId)
    console.log("content is :-----------",content)
    io.to(receiverId).emit("new_message",{content,receiverId,senderId})
  })

  // Test connection handler
  socket.on("test_connection", ({userId}) => {
    console.log("Test connection received from user:", userId)
    socket.emit("test_connection_response", { status: "connected", userId })
  })

  // Handle friend request notifications
  socket.on("friend_request_sent", ({receiverId, senderUsername}) => {
    console.log("Friend request sent to:", receiverId, "from:", senderUsername)
    console.log("Emitting friend_request_received to room:", receiverId)
    
    // Check if the receiver is online
    const receiverSocketId = Array.from(socketUser.entries())
        .find(([socketId, userId]) => userId == receiverId)?.[0];
    
    console.log("Receiver socket ID:", receiverSocketId)
    console.log("All connected users:", Array.from(socketUser.values()))
    
    io.to(receiverId).emit("friend_request_received", {
      senderUsername,
      timestamp: new Date()
    })
    
    console.log("Friend request notification emitted")
  })

  // Forward friend request response notifications (fallback path if API queued)
  socket.on("friend_request_responded", ({ senderId, status, receiverUsername, receiverId }) => {
    try {
      io.to(senderId).emit("friend_request_responded", {
        status,
        receiverUsername,
        receiverId
      })
      console.log("Forwarded friend_request_responded to:", senderId, status)
    } catch (e) {
      console.log("Error forwarding friend_request_responded:", e)
    }
  })

  // Handle friend removal notifications
  socket.on("friend_removed_notification", ({ receiverId, removerUsername, message }) => {
    try {
      io.to(receiverId).emit("friend_removed_notification", {
        removerUsername,
        message
      })
      console.log("Friend removal notification sent to:", receiverId, "from:", removerUsername)
    } catch (e) {
      console.log("Error sending friend removal notification:", e)
    }
  })

  // Handle friend block/unblock notifications
  socket.on("friend_block_notification", ({ receiverId, blockerUsername, action, message }) => {
    try {
      io.to(receiverId).emit("friend_block_notification", {
        blockerUsername,
        action,
        message
      })
      console.log("Friend block notification sent to:", receiverId, "action:", action, "from:", blockerUsername)
    } catch (e) {
      console.log("Error sending friend block notification:", e)
    }
  })

   socket.on("disconnect", () => {
    console.log("socket.id is : ", socket.id)
    console.log("socketUser is : ", socketUser)
    const userId = socketUser.get(socket.id); 
    console.log("userId is : ", userId)
    if (userId) {
        console.log(`User disconnected: ${userId} (socket: ${socket.id})`);
        socketUser.delete(socket.id); 

        socket.broadcast.emit("user_went_offline", { userId: userId });
        
        const userCallData = callDataCache.get(userId);
        if (userCallData) {
            console.log("User call data from cache:", userCallData);
        }
    } else {
        console.log(`Unknown disconnect: socket id ${socket.id} (no user mapping)`);
    }
})
  })



  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
