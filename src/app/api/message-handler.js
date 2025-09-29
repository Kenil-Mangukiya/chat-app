// @/app/api/message-handler.js
import socket from "@/lib/socket";
import axios from "axios";
import { io } from "socket.io-client";

export const sendMessage = async (senderid, receiverid, content) => {
  try 
  {

    console.log("Sending message:", { senderid, receiverid, content });

    const newMessage = {
        senderid: senderid, 
        receiverid: receiverid,
        content: content,
        createdAt: new Date().toISOString()
      };
  
    console.log("newMessage in function is : ",newMessage)    
    
    socket.emit("send_message", {
      senderid: senderid,  
      receiverid: receiverid,
      content: content
    });

    console.log("new_messages is called")
    socket.emit("new_messages",({receiverId: receiverid,content,senderId : senderid}))

    if(receiverid == "682b2f6d291405d4562b7f51")
    { 
      console.log("gemini is called")
      const response = await axios.post("/api/gemini",{prompt : content})
      console.log("response is : ",response)

      socket.emit("send_message",{
        senderid : receiverid,
        receiverid : senderid,
        content : response.data.data
      })

    }

    return newMessage;

  } 
  catch (error) 
  {

    console.error("Error in sendMessage:", error);
    throw error;

  }
};