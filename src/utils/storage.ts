import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Compresses an image file and converts it to a Base64 string.
 */
export function compressImageToBase64(
  file: File,
  maxWidth = 800,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context from canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
  });
}

/**
 * Generates a unique path for a file by appending a timestamp.
 */
export function generateUniquePath(folder: string, fileName: string): string {
  const cleanFolder = folder.replace(/\/+$/, '');
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  // Clean filename to only alpha-numeric and extensions
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
  return `${cleanFolder}/${timestamp}_${randomStr}_${cleanFileName}`;
}

/**
 * Uploads a file directly to Firebase Storage with optional progress callback.
 */
export async function uploadFile(
  file: File | Blob,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(progress);
          }
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in uploadFile helper:', error);
    throw error;
  }
}

/**
 * Compresses an image, then uploads it to Firebase Storage under the given folder.
 * Falls back to returning base64 if upload fails or is not supported.
 */
export async function compressAndUploadImage(
  file: File,
  folder: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.7,
  onProgress?: (progress: number) => void,
  forceReturnURL = false
): Promise<string> {
  let base64String = '';
  try {
    // Generate Base64 for fallback or local preview
    base64String = await compressImageToBase64(file, maxWidth, quality);
  } catch (err) {
    console.warn('Compression to Base64 failed:', err);
  }

  try {
    // 1. Create compressed Blob using Canvas
    const blob = await new Promise<Blob>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Constrain dimensions
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error('Canvas toBlob returned null'));
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Canvas image load failed'));
      };
      reader.onerror = () => reject(new Error('Canvas reader failed'));
    });

    // 2. Determine unique path
    const path = generateUniquePath(folder, file.name);

    // 3. Perform upload
    const downloadUrl = await uploadFile(blob, path, onProgress);
    return downloadUrl;
  } catch (e) {
    console.warn('Firebase Storage upload failed, falling back to base64 String. Error:', e);
    
    // If we're forcing a web URL and can't use base64, we might throw an error or return base64
    if (forceReturnURL && !base64String) {
      throw new Error('Image upload failed and no fallback is available: ' + (e instanceof Error ? e.message : String(e)));
    }
    
    // Standard fallback is to return the local base64/dataURL representation
    if (base64String) {
      if (onProgress) {
        onProgress(100);
      }
      return base64String;
    }
    
    throw e;
  }
}
