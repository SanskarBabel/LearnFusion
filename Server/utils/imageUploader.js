const cloudinary = require('cloudinary').v2;

exports.uploadImageToCloudinary  = async (file, folder, height, quality) => {
    const options = {folder};

    if(height){
        options.height = height;
    };

    // height and quality is used to image compression
    if(quality){
        options.quality = quality;
    };

    // it auto fetch image type;
    options.resource_type = "auto";    

    return await cloudinary.uploader.upload(file.tempFilePath, options);
};