const mongoose = require("mongoose")
const Profile = require("../models/Profile")
const CourseProgress = require("../models/CourseProgress")
const Course = require("../models/Course")
const User = require("../models/User")
const { uploadImageToCloudinary } = require("../utils/imageUploader")
const { convertSecondsToDuration } = require("../utils/secToDuration")

exports.updateProfile = async (req, res) => {
  try {
    // Get Data
    const 
    {
        firstName = "",  
        lastName = "", 
        dateOfBirth = "",  
        about = "",  
        contactNumber = "",  
        gender = "", 
    } = req.body;

    // Get User ID
    const id = req.user.id;

    // Validate 
    if(!firstName || !lastName || !contactNumber || !gender || !id) {
        return res.status(400).json({
            success: false,
            message: 'All Fields are required',
        });
    };

    // Find the profile by id
    const userDetails = await User.findById(id);
    const profileId = userDetails.additionalDetails;
    const profileDetails = await Profile.findById(profileId);

    // Update the profile fields
    profileDetails.dateOfBirth = dateOfBirth;
    profileDetails.about = about;
    profileDetails.contactNumber = contactNumber;
    profileDetails.gender = gender;

    // Save the updated profile
    await profileDetails.save();

    // Return response
    return res.json({
      success: true,
      message: "Profile updated successfully",
      profileDetails,
    });
  } 
  catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    // Get ID
    const id = req.user.id;
    const userDetails = await User.findById(id);

    // Validation
    if(!userDetails) {
      return res.status(404).json({ 
        success: false,  
        message: "User not found", 
    })
    };

    // Delete Profile
    await Profile.findByIdAndDelete({_id: userDetails.additionalDetails});
     
    // Unenroll user from all enrolled courses
    for(const courseId of userDetails.courses) 
    {
      await Course.findByIdAndUpdate(courseId, 
    {
        $pull: {studentsEnrolled: id}
    }, {new: true});
    };

    // Delete User
    await User.findByIdAndDelete({ _id: id });

    // Return Response
    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });

   await CourseProgress.deleteMany({ userId: id });
   } 
   catch (error)
    {
    res.status(500).json({ 
        success: false, 
        message: "User Cannot be deleted successfully" 
    });
    };
};

exports.getAllUserDetails = async (req, res) => {
  try {
    // Fetch Data
    const id = req.user.id;

    // Validation and get user details
    const userDetails = await User.findById(id).populate("additionalDetails").exec();
       
    res.status(200).json({
      success: true,
      message: "User Data fetched successfully",
      data: userDetails,
    });
    }
    catch (error) {
        return res.status(500).json({
        success: false,
        message: error.message,
    });
  };
};

exports.updateDisplayPicture = async (req, res) => {
  try {
    const displayPicture = req.files.displayPicture;
    const userId = req.user.id;
    const image = await uploadImageToCloudinary(displayPicture,  process.env.FOLDER_NAME, 1000, 1000);
       
    const updatedProfile = await User.findByIdAndUpdate(
    { _id: userId }, 
    { image: image.secure_url }, 
    { new: true });

    res.send({
      success: true,
      message: `Image Updated successfully`,
      data: updatedProfile,
    });
  } 
  catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  };
};

exports.getEnrolledCourses = async (req, res) => {
  try {
    const userId = req.user.id
    let userDetails = await User.findOne({ _id: userId, })
        .populate({
          path: "courses",
          populate: {
            path: "courseContent",
            populate: {
                path: "subSection",
            },
        },
        }).exec();

    userDetails = userDetails.toObject();
    var SubsectionLength = 0;
    for(var i = 0; i < userDetails.courses.length; i++) {
      let totalDurationInSeconds = 0
      SubsectionLength = 0
      for(var j = 0; j < userDetails.courses[i].courseContent.length; j++){
          totalDurationInSeconds += userDetails.courses[i].courseContent[j].subSection.reduce((acc, curr) => acc + parseInt(curr.timeDuration), 0)
          userDetails.courses[i].totalDuration = convertSecondsToDuration(totalDurationInSeconds)
          SubsectionLength +=  userDetails.courses[i].courseContent[j].subSection.length
      }
      let courseProgressCount = await CourseProgress.findOne({courseID: userDetails.courses[i]._id,  userId: userId,})
      courseProgressCount = courseProgressCount?.completedVideos.length
      if(SubsectionLength === 0) {
        userDetails.courses[i].progressPercentage = 100
      } 
      else {                                             // To make it up to 2 decimal point 
        const multiplier = Math.pow(10, 2)
        userDetails.courses[i].progressPercentage =  Math.round( (courseProgressCount / SubsectionLength) * 100 * multiplier ) / multiplier
      }
    }

    if(!userDetails) {
       return res.status(400).json({success: false,  message: `Could not find user with id: ${userDetails}`,})
    }

    return res.status(200).json({
      success: true,
      data: userDetails.courses,
    })
  } 
  catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
};

exports.instructorDashboard = async (req, res) => {
  try {
    const courseDetails = await Course.find({ instructor: req.user.id });

    const courseData = courseDetails.map((course) => 
    {
      const totalStudentsEnrolled = course?.studentsEnrolled?.length
      const totalAmountGenerated = totalStudentsEnrolled * course.price

      // Create a new object with the additional fields
      const courseDataWithStats = 
    {
        _id: course._id,
        courseName: course.courseName,
        courseDescription: course.courseDescription,
        totalStudentsEnrolled,
        totalAmountGenerated,
    }
    return courseDataWithStats;
    });

    res.status(200).json({
        courses: courseData,
    })
    }
    catch (error) {
    console.error(error)
    res.status(500).json({ 
        message: "Server Error" 
    });
    };
};