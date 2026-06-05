export function getStorage() {
  return {};
}

export function ref(_storage: any, path: string) {
  return { path };
}

export function uploadBytes(_ref: any, _file: any) {
  return Promise.resolve({ ref: _ref });
}

export function uploadBytesResumable(_ref: any, _file: any) {
  const task = {
    on: (event: string, progressCb: any, errorCb: any, completeCb: any) => {
      // Simulate slow upload of 100ms
      setTimeout(() => {
        if (progressCb) {
          progressCb({ bytesTransferred: 100, totalBytes: 100 });
        }
        if (completeCb) {
          completeCb();
        }
      }, 100);
    },
    snapshot: {
      ref: _ref
    }
  };
  return task;
}

export function getDownloadURL(refObj: any) {
  return Promise.resolve(refObj.path || 'https://via.placeholder.com/150');
}
