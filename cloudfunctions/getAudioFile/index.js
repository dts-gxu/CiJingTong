// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云环境
cloud.init({
  env: 'cloud1-2gryvxfp35682746'
})

// 云函数入口函数
exports.main = async (event, context) => {
  const { word } = event;
  
  // 检查参数
  if (!word) {
    return {
      success: false,
      message: '缺少word参数'
    };
  }
  
  try {
    // 构建文件路径 - 不使用模板字符串，避免可能的Symbol错误
    const fileID = 'cloud://cloud1-2gryvxfp35682746.636c-cloud1-2gryvxfp35682746-1366502308/word-audio/' + word + '.aac';
    
    // 获取临时URL
    const result = await cloud.getTempFileURL({
      fileList: [fileID]
    });
    
    // 检查结果
    if (result.fileList && result.fileList.length > 0) {
      const fileInfo = result.fileList[0];
      if (fileInfo.status === 0 && fileInfo.tempFileURL) {
        return {
          success: true,
          fileURL: fileInfo.tempFileURL
        };
      }
    }
    
    // 尝试备用路径
    const backupFileID = 'cloud://cloud1-2gryvxfp35682746.636c-cloud1-2gryvxfp35682746-1366502308/images/sounds/' + word + '.aac';
    
    const backupResult = await cloud.getTempFileURL({
      fileList: [backupFileID]
    });
    
    if (backupResult.fileList && backupResult.fileList.length > 0) {
      const backupFileInfo = backupResult.fileList[0];
      if (backupFileInfo.status === 0 && backupFileInfo.tempFileURL) {
        return {
          success: true,
          fileURL: backupFileInfo.tempFileURL
        };
      }
    }
    
    // 如果都找不到，返回失败
    return {
      success: false,
      message: '未找到音频文件'
    };
  } catch (error) {
    // 简化错误处理
    return {
      success: false,
      message: '获取音频文件失败'
    };
  }
} 