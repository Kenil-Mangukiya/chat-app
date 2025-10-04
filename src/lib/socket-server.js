// Socket server instance for use in API routes
let ioInstance = null;
let notificationQueue = [];

// Function to try to get socket instance from server
const tryGetSocketInstance = () => {
  try {
    // Try to get the global socket instance
    if (global.socketInstance && !ioInstance) {
      console.log("Retrieved socket instance from global");
      ioInstance = global.socketInstance;
      return true;
    }
  } catch (e) {
    // Ignore errors, this is just a fallback
  }
  return false;
};

// Periodic queue processor
const processQueuePeriodically = () => {
  // Try to get socket instance if not available
  if (!ioInstance) {
    tryGetSocketInstance();
  }
  
  if (ioInstance && notificationQueue.length > 0) {
    console.log("Periodic queue processing:", notificationQueue.length, "notifications");
    const queueCopy = [...notificationQueue];
    notificationQueue = [];
    
    queueCopy.forEach(({ userId, event, data }) => {
      try {
        ioInstance.to(userId.toString()).emit(event, data);
        console.log(`Emitted queued ${event} to user ${userId}:`, data);
      } catch (e) {
        console.error(`Error emitting queued ${event} to user ${userId}:`, e);
      }
    });
  }
};

// Start periodic processing every 1 second for faster processing
setInterval(processQueuePeriodically, 1000);

export const setSocketInstance = (io) => {
  ioInstance = io;
  console.log("Socket instance set successfully:", !!io);
  
  // Process any queued notifications immediately
  if (notificationQueue.length > 0) {
    console.log("Processing queued notifications immediately:", notificationQueue.length);
    const queueCopy = [...notificationQueue]; // Copy the queue
    notificationQueue = []; // Clear the queue first
    
    queueCopy.forEach(({ userId, event, data }) => {
      try {
        ioInstance.to(userId.toString()).emit(event, data);
        console.log(`Emitted queued ${event} to user ${userId}:`, data);
      } catch (e) {
        console.error(`Error emitting queued ${event} to user ${userId}:`, e);
      }
    });
  }
  
  // Also process queue after a short delay to catch any notifications added during processing
  setTimeout(() => {
    if (notificationQueue.length > 0) {
      console.log("Processing remaining queued notifications after delay:", notificationQueue.length);
      const queueCopy = [...notificationQueue];
      notificationQueue = [];
      
      queueCopy.forEach(({ userId, event, data }) => {
        try {
          ioInstance.to(userId.toString()).emit(event, data);
          console.log(`Emitted delayed queued ${event} to user ${userId}:`, data);
        } catch (e) {
          console.error(`Error emitting delayed queued ${event} to user ${userId}:`, e);
        }
      });
    }
  }, 100);
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
  console.log("=== EMIT TO USER DEBUG ===");
  console.log("Attempting to emit to user:", userId);
  console.log("Event:", event);
  console.log("Data:", data);
  console.log("Socket instance available:", !!ioInstance);
  console.log("==========================");
  
  // Try to get socket instance if not available
  if (!ioInstance) {
    tryGetSocketInstance();
  }
  
  if (ioInstance) {
    try {
      ioInstance.to(userId.toString()).emit(event, data);
      console.log(`Emitted ${event} to user ${userId}:`, data);
      
      // If there are queued notifications, process them now
      if (notificationQueue.length > 0) {
        console.log("Processing queued notifications after successful emit...");
        const queueCopy = [...notificationQueue];
        notificationQueue = [];
        
        queueCopy.forEach(({ userId: queuedUserId, event: queuedEvent, data: queuedData }) => {
          try {
            ioInstance.to(queuedUserId.toString()).emit(queuedEvent, queuedData);
            console.log(`Emitted queued ${queuedEvent} to user ${queuedUserId}:`, queuedData);
          } catch (e) {
            console.error(`Error emitting queued ${queuedEvent} to user ${queuedUserId}:`, e);
          }
        });
      }
    } catch (e) {
      console.error(`Error emitting ${event} to user ${userId}:`, e);
      // If emission fails, queue the notification
      notificationQueue.push({ userId, event, data });
      console.log("Notification queued due to error. Queue length:", notificationQueue.length);
    }
  } else {
    console.warn("Socket instance not available, queuing notification");
    notificationQueue.push({ userId, event, data });
    console.log("Notification queued. Queue length:", notificationQueue.length);
    
    // Try to get the socket instance from the server after a short delay
    setTimeout(() => {
      if (ioInstance) {
        console.log("Socket instance became available, processing queued notifications...");
        const queueCopy = [...notificationQueue];
        notificationQueue = [];
        
        queueCopy.forEach(({ userId: queuedUserId, event: queuedEvent, data: queuedData }) => {
          try {
            ioInstance.to(queuedUserId.toString()).emit(queuedEvent, queuedData);
            console.log(`Emitted delayed queued ${queuedEvent} to user ${queuedUserId}:`, queuedData);
          } catch (e) {
            console.error(`Error emitting delayed queued ${queuedEvent} to user ${queuedUserId}:`, e);
          }
        });
      }
    }, 500);
  }
};
