// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  // 获取调用者的 openid
  const { OPENID } = cloud.getWXContext()
  
  try {
    console.log('=== 开始处理更新词汇录音请求 ===');
    
    // 检查是否为管理员
    const adminResult = await db.collection('admins').where({
      openid: OPENID
    }).get()
    
    // 如果不是管理员，则拒绝操作
    if (!adminResult.data || adminResult.data.length === 0) {
      console.log('权限检查: 用户不是管理员');
      return {
        code: 403,
        message: '没有管理员权限'
      }
    }
    
    console.log('权限检查: 用户是管理员');
    
    // 获取参数
    const { wordId, word, audioFileId, audioFileType } = event
    
    console.log('收到的参数:', { 
      wordId, 
      word, 
      wordLength: word ? word.length : 0,
      wordCodePoints: word ? Array.from(word).map(char => char.codePointAt(0).toString(16)).join(' ') : '',
      audioFileId: audioFileId ? audioFileId.substring(0, 20) + '...' : null, 
      audioFileType 
    });
    
    // 验证必要参数
    if (!audioFileId) {
      console.log('参数验证: 缺少音频文件ID');
      return {
        code: 400,
        message: '缺少音频文件ID'
      }
    }
    
    // 必须提供词汇名称
    if (!word) {
      console.log('参数验证: 缺少词汇名称');
      return {
        code: 400,
        message: '缺少词汇名称'
      }
    }
    
    console.log('参数验证: 通过');
    
    // 查询词汇
    console.log(`正在检查词汇 "${word}" 是否存在`);
    let wordCheck;
    
    try {
      wordCheck = await db.collection('words').where({
        word: word
      }).get();
      
      console.log(`词汇检查结果:`, {
        found: wordCheck.data && wordCheck.data.length > 0,
        count: wordCheck.data ? wordCheck.data.length : 0
      });
      
      if (wordCheck.data && wordCheck.data.length > 0) {
        const wordData = wordCheck.data[0];
        console.log('找到词汇:', {
          id: wordData._id,
          word: wordData.word,
          pinyin: wordData.pinyin
        });
      } else {
        console.log(`词汇 "${word}" 不存在`);
        
        // 尝试模糊查询
        console.log('尝试模糊查询');
        const fuzzyCheck = await db.collection('words').limit(5).get();
        console.log('数据库中的词汇示例:', fuzzyCheck.data.map(w => ({ 
          id: w._id, 
          word: w.word 
        })));
        
        return {
          code: 404,
          message: `未找到词汇: ${word}`,
          word: word
        };
      }
    } catch (checkErr) {
      console.error('查询词汇失败:', checkErr);
      return {
        code: 500,
        message: '查询词汇失败: ' + checkErr.message,
        error: checkErr.message
      };
    }
    
    // 直接使用词汇名称更新
    console.log(`尝试通过词汇名称 "${word}" 直接更新音频信息`);
    
    try {
      // 更新前再次检查词汇是否存在
      const wordDoc = wordCheck.data[0];
      const docId = wordDoc._id;
      
      console.log(`使用文档ID: ${docId} 更新`);
      
      // 直接通过ID更新
      const updateResult = await db.collection('words').doc(docId).update({
        data: {
          audioFileId: audioFileId,
          audioFileType: audioFileType || 'aac',
          updateTime: db.serverDate()
        }
      });
      
      console.log('更新结果:', updateResult);
      
      if (updateResult.stats && updateResult.stats.updated > 0) {
        console.log(`成功更新词汇 "${word}"`);
        return {
          code: 0,
          message: '更新成功',
          data: {
            word,
            audioFileId,
            audioFileType,
            updatedCount: updateResult.stats.updated
          }
        };
      } else {
        console.log(`词汇 "${word}" 存在但更新失败`);
        return {
          code: 500,
          message: '词汇存在但更新失败',
          detail: wordDoc
        };
      }
    } catch (error) {
      console.error('更新词汇音频信息失败:', error);
      return {
        code: 500,
        message: '更新失败: ' + error.message,
        error: error.message
      };
    }
  } catch (error) {
    console.error('处理请求失败:', error);
    return {
      code: 500,
      message: '系统错误: ' + error.message,
      error: error.message
    };
  }
} 