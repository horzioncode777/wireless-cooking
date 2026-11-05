import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (["image/jpeg","image/png","image/webp"].includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(Object.assign(new Error("Solo se permiten imágenes JPEG, PNG o WebP de máximo 5 MB"),{status:400}), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default upload;
