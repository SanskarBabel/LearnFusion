const bcrypt = require("bcrypt");
const User = require("../models/User");
const OTP = require("../models/OTP");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const mailSender = require("../utils/mailSender");
const { passwordUpdated } = require("../mail/templates/passwordUpdate");
const Profile = require("../models/Profile");
require("dotenv").config();

//Send OTP
exports.sendOTP = async(req, res) => {

    try {

    //Fetch Email from Reqeuest's Body
    const {email} = req.body;

    // Check if User already exist
    const checkUserPresent = await User.findOne({email});

    // If User already exists, then return a response
    if(checkUserPresent) {
        return res.status(401).json({
            succes: false,
            message: 'User Already Registered',
        })
    }

    //Generate Otp
    var otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
    });
    console.log("OTP Generated: ", otp);

    // Check if the otp is unique
    let result = await OTP.findOne({otp: otp});

    while(result){
        otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
        });
        result = await OTP.findOne({otp: otp});
    }

    const otpPayload = {email, otp};

    //Create an entry for otp in DB
    const otpBody = await OTP.create(otpPayload);
    console.log(otpBody);

    // Return Response Successfully
    return res.status(200).json({
        succes: true,
        message: 'OTP sent Successfully',
        otp,
    });
    }
    catch (error) {
     console.log(error);
     return res.status(500).json({
        succes: false,
        message: error.message,
    });
    };
};

//Signup
exports.signUp = async (req, res) => {

    try {

    // Data fetching from request's body
    const{firstName, lastName, email, password, confirmPassword, accountType, contactNumber, otp} = req.body;
     
    // Data ko validate karlo
    if(!firstName || !lastName || !email || !password || !confirmPassword || !otp){
        return res.status(403).json({
            success:false,
            message:"All fields are required",
        });
    };

    // match the two(password and confirmpassword) password
    if(password !== confirmPassword){ 
        return res.status(400).json({
            success:false,
            message:'Password and ConfirmPassword Value does not match, please try again',
        });
    };

    // Check user already exist or not
    const existingUser = await User.findOne({email});
    if(existingUser){
        return res.status(400).json({
            success:false,
            message:'User is already registered',
        });
    };

    // Find most recent otp stored for the user
    const recentOtp = await OTP.find({email}).sort({createdAt: -1}).limit(1);
    console.log(recentOtp);

    //Validate the OTP
    if(recentOtp.length == 0){ 
        // OTP not found                               
        return res.status(400).json({ 
            success:false,
            message:'OTP NOT Found',
    })}

    else if(otp !== recentOtp.otp){
        // Invalid OTP                           
        return res.status(400).json({
            success:false,
            message:"Invalid OTP",
        });
    };
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Entry created in the DB

    //created entry in Profile in DB
    const profileDetails = await Profile.create({
        gender:null,
        dateOfBirth: null,
        about:null,
        contactNumer:null,
    });

    const user = await User.create({
        firstName,
        lastName,
        email,
        contactNumber,
        password:hashedPassword,
        accountType: accountType,
        approved: approved,
        additionalDetails:profileDetails._id,
        image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`,
    });

    // Return Response
    return res.status(200).json({
        success:true,
        user,
        message:'User is registered Successfully',
    });
    }

    catch (error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"User cannot be registrered. Please try again",
        })
    };
};

// Login
const login = async (req, res) => {
    try {
        // Get data from request body
        const {email, password} = req.body;

        // Validation of Data
        if(!email || !password){
            return res.status(403). json({
                success:false,
                message:'Please Fill up All the Required Fields',
            });
        }
        
        // User check
        const user = await User.findOne({email}).populate("additionalDetails");
        if(!user){
            return res.status(401).json({
                success:false,
                message:"User is not registrered, please signup first",
            });
        }
        
        if(await bcrypt.compare(password, user.password)){
            const payload = {
                email: user.email,
                id: user._id,
                accountType:user.accountType,
            }

            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn:"20h",
            });

            user.token = token;
            user.password= undefined;

            const options = {
                expires: new Date(Date.now() + 3*24*60*60*1000),
                httpOnly:true,
            }

            res.cookie("token", token, options).status(200).json({
                success:true,
                token,
                user,
                message:'Logged in successfully',
            })
        }
        else {
            return res.status(401).json({
                success:false,
                message:'Password is incorrect',
            });
        };
    }
    catch(error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:'Login Failure, please try again',
        });
    }
};

// Change Password
const changePassword = async (req, res) => {
	try {
		const userDetails = await User.findById(req.user.id);
		const { oldPassword, newPassword, confirmNewPassword } = req.body;

		const isPasswordMatch = await bcrypt.compare(oldPassword, userDetails.password );
			 
		if(!isPasswordMatch) {
			return res.status(401).json({ success: false, message: "The password is incorrect" });	 
		}

		if(newPassword !== confirmNewPassword) {
            return res.status(401).json({ 
            success: false,
            message: "The password and confirm password does not match" });	 
		}
			 
		const encryptedPassword = await bcrypt.hash(newPassword, 10);
		const updatedUserDetails = await User.findByIdAndUpdate(req.user.id , { password: encryptedPassword } , { new: true });
		 
		try {     
			const emailResponse = await mailSender(updatedUserDetails.email,
            passwordUpdated(updatedUserDetails.email,
            `Password updated successfully for ${updatedUserDetails.firstName} ${updatedUserDetails.lastName}`));
			console.log("Email sent successfully:", emailResponse.response);
		}
        catch(error) {
			return res.status(500).json({
				success: false,
				message: "Error occurred while sending email",
				error: error.message,
			});
		}

		return res.status(200).json({ 
            success: true, 
            message: "Password updated successfully" 
        });
	} 
    catch(error) {
		console.error("Error occurred while updating password:", error);
		return res.status(500).json({
			success: false,
			message: "Error occurred while updating password",
			error: error.message,
		});
	}
};

module.exports =  {signUp , login , sendOTP , changePassword};