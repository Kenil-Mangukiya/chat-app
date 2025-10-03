import mongoose from "mongoose"

const groupMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    members: {
      type: [groupMemberSchema],
      default: [],
    },
    // Optional picture or metadata for future UI use
    avatarUrl: {
      type: String,
    },
  },
  { timestamps: true }
)

groupSchema.index({ ownerId: 1, name: 1 }, { unique: true })

const group = mongoose.models?.group || mongoose.model("group", groupSchema)

export default group


