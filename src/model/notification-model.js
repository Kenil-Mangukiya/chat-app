import mongoose from "mongoose"

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["group_added", "friend_request", "message", "other", "group_member_left", "group_deleted", "friend_blocked", "friend_unblocked", "friend_removed"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, isRead: 1 })
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, groupId: 1, type: 1, senderId: 1 }, { unique: true, partialFilterExpression: { type: { $in: ["group_added", "group_member_left", "group_deleted"] } } })

const notification = mongoose.models?.notification || mongoose.model("notification", notificationSchema)

export default notification
