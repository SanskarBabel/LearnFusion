const Course = require("../models/Course");
const Tag = require("../models/tags");
const User = require("../models/User");
const { uploadImageToCloudinary } = require("../utils/imageUploader");

// Function to create a new course
exports.createCourse = async (req, res) => {
  try {
    const {courseName, courseDescription, whatYouWillLearn, price, tag} = req.body;
  
    // Get thumbnail image from request files
    const thumbnail = req.files.thumbnailImage;

    // Check if any of the required fields are missing
    if(!courseName || !courseDescription || !whatYouWillLearn || !price || !tag || !thumbnail) {
          return res.status(400).json({
            success: false, 
            message: "All Fields are Mandatory", 
        })
    };

    // Check if the user is an instructor
    const userId = req.user.id
    const instructorDetails = await User.findById(userId);
      
    if(!instructorDetails) {
      return res.status(404).json({
        success: false,
        message: "Instructor Details Not Found",
      })
    };

    // Check given tag is valid or not
    const tagDetails = await Tag.findById(tag);
    if(!tagDetails) {
        return res.status(404).json({
            success: false,
            message: "Tag Details Not Found",
        });
    };

    // Upload the Thumbnail to Cloudinary
    const thumbnailImage = await uploadImageToCloudinary(thumbnail, process.env.FOLDER_NAME);
    
    // Create a new course with the given details in DB
    const newCourse = await Course.create({
        courseName, 
        courseDescription, 
        instructor: instructorDetails._id,
        whatYouWillLearn: whatYouWillLearn,
        price,
        tag:tagDetails._id,
        thumbnail: thumbnailImage.secure_url,
    });

    // Add the new course to the User Schema of the Instructor
    await User.findByIdAndUpdate( 
        { _id: instructorDetails._id,}, 
        {
            $push: {
                courses: newCourse._id,
            },
        },  
        {new: true} 
    );

    // Update the tag Schema - todo
     
    // Return the new course and a success message
    res.status(200).json({                                      
      success: true,
      data: newCourse,
      message: "Course Created Successfully",
    })
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create course",
      error: error.message,
    })
  };
};

// Get Course List
exports.showAllCourses = async (req, res) => {
  try {
    const allCourses = await Course.find( {}, {courseName: true,  
        price: true, 
        thumbnail: true, 
        instructor: true, 
        ratingAndReviews: true, 
        studentsEnrolled: true,}).populate("instructor").exec();
    
        return res.status(200).json({
         success: true,
         message: 'Data for all courses fetched successfully',
         data: allCourses,
        });
  } 
    catch(error){
        return res.status(404).json({
            success: false,
            message: `Can't Fetch Course Data`,
            error: error.message,
        })
  };
};