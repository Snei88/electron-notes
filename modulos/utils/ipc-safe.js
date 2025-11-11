// modulos/utils/ipc-safe.js
function safeIPCCall(ipcMethod, ...args) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof ipcMethod !== 'function') {
        reject(new Error('IPC method not available'));
        return;
      }
      
      const result = ipcMethod(...args);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        resolve(result);
      }
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { safeIPCCall };