const User = require("../models/User");
const OTP = require("../models/OTP");

//Send OTP
exports.sendOTP = async(req, res) => {

    //Fetch Email from Reqeuest's Body
    const {email} = req.body;

    // Check if User already exist
    const checkUserPresent = await User.findOne({email});

}

//Signup

// Login

// Change Password