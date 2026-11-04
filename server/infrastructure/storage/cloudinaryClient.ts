// The only place the Cloudinary SDK is configured.
import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env";

if (env.cloudinary.configured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

export const storageConfigured = env.cloudinary.configured;
export { cloudinary };
