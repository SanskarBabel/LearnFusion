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

// Get Course Details
exports.getCourseDetails = async (req, res) => {
  try {
    // Get ID
    const { courseId } = req.body;

    // Find Course details
    const courseDetails = await Course.find({ _id: courseId, }).populate
    ({                    
      path: "instructor",                    
      populate: {path: "additionalDetails",},
    }).populate("category").populate("ratingAndReviews")
    .populate({
      path: "courseContent",                
      populate: {   
        path: "subSection",               
      },
    }).exec();

    // Validation
    if(!courseDetails){
      return res.status(400).json({
        success: false,
        message: `Could not find course with id: ${courseId}`,
      })
    };

    return res.status(200).json({
      success: true,
      message: "Course Details Fetched Successfully",
      data: {courseDetails, totalDuration,},
    })
  }
  catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  };
};

exports.editCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const updates = req.body;
    const course = await Course.findById(courseId);

    if(!course){
      return res.status(404).json({ 
        error: "Course not found" 
      })
    };

    // If Thumbnail Image is found, update it
    if(req.files){
      const thumbnail = req.files.thumbnailImage
      const thumbnailImage = await uploadImageToCloudinary( thumbnail,  process.env.FOLDER_NAME )
      course.thumbnail = thumbnailImage.secure_url
    };

    // Update only the fields that are present in the request body
    for(const key in updates) {
      if(updates.hasOwnProperty(key)) {
        if(key === "tag" || key === "instructions") {
          course[key] = JSON.parse(updates[key])
        }
        else {
          course[key] = updates[key]
        }
      };
    };

    await course.save();

    const updatedCourse = await Course.findOne({ _id: courseId,})
      .populate({ path: "instructor", populate: { path: "additionalDetails",},})
      .populate("category")
      .populate("ratingAndReviews")
      .populate({ path: "courseContent", populate: { path: "subSection", },}).exec();

    res.json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    })
  }
};

exports.getFullCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    const courseDetails = await Course.findOne({ _id: courseId, })
    .populate({path: "instructor", populate: { path: "additionalDetails", },})
    .populate("category")
    .populate("ratingAndReviews")
    .populate({path: "courseContent", populate: { path: "subSection",},}).exec();

    let courseProgressCount = await CourseProgress.findOne({courseID: courseId,  userId: userId,});

    if(!courseDetails){
      return res.status(400).json({
        success: false,
        message: `Could not find course with id: ${courseId}`,
      })
    };

    let totalDurationInSeconds = 0;
    courseDetails.courseContent.forEach((content) => {
      content.subSection.forEach((subSection) => {
        const timeDurationInSeconds = parseInt(subSection.timeDuration)
        totalDurationInSeconds += timeDurationInSeconds
      })
    });

    const totalDuration = convertSecondsToDuration(totalDurationInSeconds);

    return res.status(200).json({
      success: true,
      data: {
        courseDetails,
        totalDuration,
        completedVideos: courseProgressCount?.completedVideos ? courseProgressCount?.completedVideos : [], 
      },
    });
  } 
  catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
};

// Get a list of Course for a given Instructor
exports.getInstructorCourses = async (req, res) => {
  try {
    // Get the instructor ID from the authenticated user or request body
    const instructorId = req.user.id;

    // Find all courses belonging to the instructor
    const instructorCourses = await Course.find({ instructor: instructorId, }).sort({ createdAt: -1 })
      
    // Return the instructor's courses
    res.status(200).json({                     
      success: true,
      data: instructorCourses,
    })
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve instructor courses",
      error: error.message,
    })
  }
};

// Delete the Course
exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.body
    
    // Find the course
    const course = await Course.findById(courseId)                     
    if(!course){
      return res.status(404).json({ 
        message: "Course not found" 
      })
    };

    // Unenroll students from the course
    const studentsEnrolled = course.studentsEnrolled                   
    for(const studentId of studentsEnrolled){
      await User.findByIdAndUpdate(studentId, {$pull: { courses: courseId },})
    }

    // Delete sections and sub-sections
    const courseSections = course.courseContent                   
    for(const sectionId of courseSections) {
      // Delete sub-sections of the section
      const section = await Section.findById(sectionId)
      if(section) {
        const subSections = section.subSection
        for (const subSectionId of subSections) {
          await subSections.findByIdAndDelete(subSectionId)
        }
      }
      await section.findByIdAndDelete(sectionId);
    }

    await Course.findByIdAndDelete(courseId);

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    })
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  };
};