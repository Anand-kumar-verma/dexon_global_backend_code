const path = require("path");
const fs = require("fs");

const uploadVideo = (imageFile, folder = "uploads") => {
  return new Promise((resolve, reject) => {
    try {
      if (!imageFile) {
        return reject("No image file provided");
      }

      // Ensure folder exists in project root
      const uploadPath = path.join(process.cwd(), folder);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Extract extension only
      const ext = path.extname(imageFile.name);
      const fileName = Date.now() + ext; // timestamp + extension
      const savePath = path.join(uploadPath, fileName);

      // Move file
      imageFile.mv(savePath, (err) => {
        if (err) {
          return reject(err);
        }
        // return relative path for usage
        resolve(`/${folder}/${fileName}`);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = uploadVideo;
