// Socket server instance for use in API routes
let ioInstance = null;
let notificationQueue = [];

export const setSocketInstance = (io) => {
  ioInstance = io;
  console.log("Socket instance set successfully:", !!io);
  
  // Process any queued notifications
  if (notificationQueue.length > 0) {
    console.log("Processing queued notifications:", notificationQueue.length);
    notificationQueue.forEach(({ userId, event, data }) => {
      ioInstance.to(userId.toString()).emit(event, data);
      console.log(`Emitted queued ${event} to user ${userId}:`, data);
    });
    notificationQueue = [];
  }
};

export const getSocketInstance = () => {
  return ioInstance;
};

export const processNotificationQueue = () => {
  if (ioInstance && notificationQueue.length > 0) {
    console.log("Manually processing queued notifications:", notificationQueue.length);
    notificationQueue.forEach(({ userId, event, data }) => {
      ioInstance.to(userId.toString()).emit(event, data);
      console.log(`Emitted queued ${event} to user ${userId}:`, data);
    });
    notificationQueue = [];
    return true;
  }
  return false;
};

export const emitToUser = (userId, event, data) => {
  console.log("Attempting to emit to user:", userId, "Socket instance available:", !!ioInstance);
  if (ioInstance) {
    ioInstance.to(userId.toString()).emit(event, data);
    console.log(`Emitted ${event} to user ${userId}:`, data);
  } else {
    console.warn("Socket instance not available, queuing notification");
    notificationQueue.push({ userId, event, data });
    console.log("Notification queued. Queue length:", notificationQueue.length);
  }
};
