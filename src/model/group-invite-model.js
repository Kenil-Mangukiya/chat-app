import mongoose from "mongoose"

const groupInviteSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "group",
      required: true,
      index: true,
    },
    inviterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    inviteeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
)

groupInviteSchema.index({ groupId: 1, inviteeId: 1 }, { unique: true })

const groupInvite =
  mongoose.models?.groupInvite || mongoose.model("groupInvite", groupInviteSchema)

export default groupInvite


