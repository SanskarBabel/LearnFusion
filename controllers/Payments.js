const {instance} = require("../config/razorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const {courseEnrollmentEmail} = require("../mail/templates/courseEnrollmentEmail");
const { default: mongoose } = require("mongoose");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");
const crypto = require("crypto");
const CourseProgress = require("../models/CourseProgress");

// Capture the payment and initiate the Razorpay order
exports.capturePayment = async(req, res) => {

    // Get CourseID and UserID
    const {course_id} = req.body;
    const userId = req.user.id;

    // Validation
    if(!course_id){
        return res.json({
            success:false, 
            message:"Please provide Valid Course Id"
        });
    };

    // Valid CourseDetails
    let course;
    try{
        course = await Course.findById(course_id);
        if(!course) {
            return res.status(200).json({
                success:false, 
                message:"Could not find the course"
            });
        };

    const uid  = new mongoose.Types.ObjectId(userId);
        if(course.studentsEnrolled.includes(uid)) {
            return res.status(200).json({
                success:false, 
                message:"Student is already Enrolled"
            });
        };
    }
    catch(error){
        console.log(error);
        return res.status(500).json({
            success:false, 
            message:error.message
        });
    };
    
    // Order Create
    const amount = course.price;
    const currency = "INR";
    const options = {
        amount: amount * 100,
        currency,
        receipt: Math.random(Date.now()).toString(),
        notes: {
            courseID: course_id,
            userId,
        }
    };

    try{
        // Initiate the payment using Razorpay
        const paymentResponse = await instance.orders.create(options);
        return res.status(200).json({
            success:true,
            courseName: course.courseName,
            courseDescription: course.courseDescription,
            thumbnail: course.thumbnail,
            orderId: paymentResponse.id,
            currency: paymentResponse.currency,
            amount: paymentResponse.amount,
            message:paymentResponse,
        })
    }
    catch(error) {
        console.log(error);
        return res.status(500).json({
            success:false, 
            mesage:"Could not Initiate Order"
        });
    }
};

//verify Signature
exports.verifySignature = async (req, res) => {
    const webhookSecret = "12345678";

    const signature = req.headers["x-razorpay-signature"];

    const shasum = crypto.createHmac("sha256", webhookSecret);
    shasum.update(JSON.stringify(req.body));

    const digest = shasum.digest("hex");

    if(signature === digest){
        console.log("Payment is Authorized");

        const {courseId, userId} = req.body.payload.payment.entity.notes;

        try {
            // Fulfil the action

            //  Find the course ad enroll the student in it
            const enrolledCourse = await Course.findOneAndUpdate(
                {_id:courseId}, 
                {$push:{studentsEnrolled:userId}},
                {new:true},
            );

            if(!enrolledCourse){
                return res.status(500).json({
                    success:false,
                    message:"Course not Found"
                });
            };

            console.log(enrolledCourse);

            // Find the student and add the course to their list of enrolled courses
            const enrolledStudent = await User.findOneAndUpdate(
                {_id: userId},  
                {$push:{courses: courseId,}},
                {new:true}
            );

            console.log(enrolledStudent);

            // to send confirmation mail
            const emailResponse = await mailSender( enrollStudents.email, 
                `Successfully Enrolled into ${enrolledCourse.courseName}`, 
                courseEnrollmentEmail(enrolledCourse.courseName, 
                `${enrolledStudent.firstName}`
            ));

            console.log(emailResponse);

            return res.status(200).json({
                success:true, 
                message: "Signature Verified and Course Added",
            });
        } 
        catch (error) {
            console.log(error)
            return res.status(500).json({
                success:false, 
                message:error.message,
            });
        }
    }

    else {
        return res.status(400).json({
            success:false, 
            message: "Invalid request",
        });
    };
};