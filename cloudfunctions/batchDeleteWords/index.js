// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('batchDeleteWords被调用，正在重定向到wordOperations');
  
  try {
    // 重定向到wordOperations云函数
    const result = await cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'batchDeleteWords',
        wordIds: event.wordIds
      }
    });
    
    return result.result;
  } catch (error) {
    console.error('调用wordOperations云函数失败:', error);
    return {
      code: 999,
      message: '调用失败: ' + error.message,
      error: error
    };
  }
}; 