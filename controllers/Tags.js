const Tag = require("../models/tags");

// Create tag's Handler Function

exports.createTag = async(req, res) => {
    try {
        // Fetch Data
        const {name, description} = req.body;
        
        // Validation
        if(!name || !description) {
            return res.status(400).json({
                success:false,
                message: 'All Fields are Required',
            })  
        }

        // Create Entry in DB
        const tagDetails = await Tag.create({
            name:name,
            description:description,
        });
        console.log(tagDetails);

        // Return Response
        return res.status(200).json({
            success:true,
            message: "Tag Created Successfully",
        })
    } 
    catch (error) {
        return res.status(500).json({
            success:false,
            message: error.message,
        })
    }
};

// Get all Tags Handler Function
exports.showAllTags = async(req, res) => {
    try {
        const allTags = await Tag.find({}, 
            {
                name: true,
                description: true,
            });
        
        res.status(200).json({
            success:true,
            message: "All Tags Returned Successfully",
            allTags,
        });    
    } 
    catch (error) {
        return res.status(500).json({
            success:false,
            message: error.message,
        })
    }
}