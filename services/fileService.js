/**
 * 文件服务
 * 处理与云存储相关的操作
 */
const fileService = {
  /**
   * 删除云存储中的文件
   * @param {string} fileID - 要删除的文件ID
   * @returns {Promise} - 操作结果Promise
   */
  deleteFile: function(fileID) {
    if (!fileID) {
      return Promise.reject(new Error('无效的文件ID'));
    }

    console.log('正在删除文件:', fileID);
    
    return wx.cloud.deleteFile({
      fileList: [fileID]
    }).then(res => {
      console.log('删除文件成功:', res);
      
      if (res.fileList && res.fileList[0]) {
        if (res.fileList[0].status === 0) {
          return Promise.resolve(res.fileList[0]);
        } else {
          return Promise.reject(new Error(res.fileList[0].errMsg || '删除失败'));
        }
      } else {
        return Promise.reject(new Error('删除文件返回结果格式不正确'));
      }
    }).catch(err => {
      console.error('删除文件失败:', err);
      return Promise.reject(err);
    });
  },
  
  /**
   * 获取临时文件URL
   * @param {string} fileID - 文件ID
   * @param {number} maxAge - URL有效期（秒），默认3600秒
   * @returns {Promise<string>} - 临时访问URL
   */
  getTempFileURL: function(fileID, maxAge = 3600) {
    if (!fileID) {
      return Promise.reject(new Error('无效的文件ID'));
    }
    
    return wx.cloud.getTempFileURL({
      fileList: [{ 
        fileID: fileID, 
        maxAge: maxAge 
      }]
    }).then(res => {
      if (res.fileList && res.fileList[0]) {
        if (res.fileList[0].status === 0) {
          return Promise.resolve(res.fileList[0].tempFileURL);
        } else {
          return Promise.reject(new Error(res.fileList[0].errMsg || '获取临时URL失败'));
        }
      } else {
        return Promise.reject(new Error('获取临时URL返回结果格式不正确'));
      }
    }).catch(err => {
      console.error('获取临时URL失败:', err);
      return Promise.reject(err);
    });
  }
};

module.exports = fileService; 