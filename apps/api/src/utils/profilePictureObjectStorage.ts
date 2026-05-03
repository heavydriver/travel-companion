import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AppError } from "../middleware/errorHandler";

export function getObjectStorageClient():
  | { client: S3Client; bucket: string }
  | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || "us-east-005";
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return { client, bucket };
}

export async function putProfilePictureJpeg(userId: string, jpeg: Buffer): Promise<void> {
  const cfg = getObjectStorageClient();
  if (!cfg) {
    throw new Error("Object storage is not configured");
  }

  try {
    await cfg.client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: `profile-pic/${userId}.jpg`,
        Body: jpeg,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Object storage upload failed";
    throw new AppError(502, "STORAGE_ERROR", message);
  }
}
