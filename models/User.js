const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    firstname: {
      type: String,
      required: true,
      trim: true,
    },
    lastname: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    accountType: {
      type: String,
      enum: ["Admin", "Student", "Instructor"],
      required: true,
    },
    additionalDetails: {
        type:mongoose.Schema.Types.ObjectId,
        required: true,
        ref:"Profile",
    },
    courses: {
        
    }
  });
  
  module.exports = mongoose.model("User", userSchema);
  