export const getGoogleDriveDirectLink = (url: string): string => {
  if (!url) return '';
  // Check if it's already a direct representation or plain path
  if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('http://') || (url.startsWith('https://') && !url.includes('drive.google.com') && !url.includes('docs.google.com'))) {
    return url;
  }
  // Try to parse Google Drive IDs
  let fileId = '';
  const dMatch = url.match(/\/d\/([^/?]+)/);
  if (dMatch && dMatch[1]) {
    fileId = dMatch[1];
  } else {
    const idMatch = url.match(/[?&]id=([^&]+)/);
    if (idMatch && idMatch[1]) {
      fileId = idMatch[1];
    }
  }

  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  return url;
};
