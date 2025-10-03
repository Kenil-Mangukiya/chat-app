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

  // Set the socket instance and immediately drain any queued notifications
  setSocketInstance(io);
  try {
    const drained = processNotificationQueue();
    if (drained) {
      console.log("Queued notifications processed after socket init");
    }
  } catch (e) {
    console.log("Error processing queued notifications:", e);
  }


  const callDataCache = new Map();
  const socketUser  = new Map();

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
        });

        await conversationModel.findByIdAndUpdate(conversation._id, {
          lastmessage: newMessage._id,
          updatedat: Date.now(),
        });

        io.to(messageData.senderid).emit("send_message_to_sender", newMessage);
        io.to(messageData.receiverid).emit("send_message_to_receiver", newMessage);

      } catch (error) {
        console.log("Error while sending the message in server.js file: ", error);
      }
    });

    socket.on("user_call", async ({ senderId, receiverId, type }) => {
      try {
        console.log("Call requested - senderId:", senderId);
        console.log("Call requested - receiverId:", receiverId);

        const findData = await userModel.findOne({ _id: senderId });
        console.log("Sender data found:", findData);

        // Cache the call data for potential retrieval later
        callDataCache.set(receiverId, {
          senderData: findData,
          callType: type
        });

        // Send the call notification to the receiver
        io.to(receiverId).emit("incoming_call", { senderId, receiverId, type });
        
        // Send the sender's data immediately
        io.to(receiverId).emit("sender_data", findData);
      } catch (err) {
        console.error("Error in user_call event:", err);
      }
    });

    // Handle requests for sender data (when receiver reloads page or misses initial data)
    socket.on("request_sender_data", async (receiverId) => {
      try {
        console.log("Sender data requested for receiverId:", receiverId);
        
        // Check if we have cached data for this call
        const cachedCallData = callDataCache.get(receiverId);
        
        if (cachedCallData) {
          console.log("Found cached sender data, resending");
          socket.emit("sender_data", cachedCallData.senderData);
        } else {
          console.log("No cached sender data found");
        }
      } catch (err) {
        console.error("Error in request_sender_data event:", err);
      }
    });

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
        const friendData = await friendModel.find({ userid: userId });
        console.log("friendData is : ",friendData)
        socket.emit("friend_list", friendData);
      } catch (error) {
        console.log("Error in get_friends event: ", error);
      }
    });

    // Group events
    socket.on("group_member_added", ({ groupId, userId }) => {
      io.to(userId).emit("group_invited", { groupId });
    });

    socket.on("call_ended",({receiverId,endedBy,direction}) => {
      console.log("sender :_________",receiverId)
      console.log("call ended is called from sender end")

      const callData = callDataCache.get(endedBy)
      const callerData = callDataCache.get(receiverId)
      console.log("callData is : ",callData)
      console.log("callerData is : ",callerData)
      const id = callData?.senderData._id.toString()
      console.log("id is : ",id)
      if(callerData)
      {
        if(direction == "sender")
      {
      io.to(receiverId).emit("call_ended_by_sender",[])
      console.log("call_ended_by_sender is called-------------")
      }
    }
      if(callData)
      {
        console.log("call cut from receiver")
        io.to(id).emit("call_ended_by_receiver",[])
      }
    })

    socket.on("message_deleted",async ({id,receiverId}) => {
    
    console.log("message_deleted called")
    io.to(receiverId).emit("deleted",{id})

  })

  socket.on("call_accepted",({receiverId}) => {
    console.log("receiverId is : ",receiverId)
    const callData = callDataCache.get(receiverId)
    console.log("callData is : ",callData)
    const id = callData.senderData._id.toString()
    io.to(id).emit("accepted",[])
  })

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
