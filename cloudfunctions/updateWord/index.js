// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  // 检查是否具有管理员权限
  const { OPENID } = cloud.getWXContext()
  
  try {
    // 移除权限检查，直接允许更新操作
    console.log('开始更新词语操作');
    
    // 获取需要更新的词语ID和数据
    const { wordId, wordData } = event
    
    if (!wordId) {
      return {
        code: -1,
        message: '词语ID不能为空'
      }
    }
    
    if (!wordData) {
      return {
        code: -1,
        message: '词语数据不能为空'
      }
    }
    
    console.log('准备更新词语:', wordId);
    console.log('词语数据:', JSON.stringify(wordData, null, 2));
    
    // 创建一个干净的更新数据对象
    const updateData = { ...wordData };
    
    // 移除_id字段，防止更新错误
    if (updateData._id) {
      delete updateData._id;
    }
    
    // 确保数据结构完整
    if (!updateData.example) {
      updateData.example = { chinese: '', pinyin: '', translation: '' };
    }
    if (!updateData.pinyinQuiz) {
      updateData.pinyinQuiz = { options: { options: [], correctOption: 'A' } };
    }
    if (!updateData.fillBlank) {
      updateData.fillBlank = { sentence: '', prefix: '', suffix: '', answer: '' };
    }
    
    // 添加更新时间戳
    updateData.updatedAt = new Date();
    updateData.updateTime = new Date();
    
    // 只使用words_data集合
    const collectionName = 'words_data';
    
    console.log(`在集合 ${collectionName} 中更新词语`);
        
    // 更新词语
    const updateResult = await db.collection(collectionName).doc(wordId).update({
      data: updateData
        });
        
        console.log(`在集合 ${collectionName} 中更新词语成功:`, updateResult);
    
      return {
        code: 0,
        data: updateResult,
      collection: collectionName,
      message: `在集合 ${collectionName} 中更新词语成功`
    }
    
  } catch (err) {
    console.error('更新词语失败：', err)
    return {
      code: -1,
      message: '更新词语失败：' + err.message
    }
  }
} 