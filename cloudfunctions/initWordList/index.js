// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 验证管理员权限
    const adminResult = await db.collection('admins')
      .where({
        openid: wxContext.OPENID
      })
      .get()
    
    // 如果不是管理员，拒绝操作
    if (!adminResult || !adminResult.data || adminResult.data.length === 0) {
      return {
        code: -1,
        message: '没有管理员权限',
        success: false
      }
    }
    
    // 检查word_list表是否存在
    try {
      const countResult = await db.collection('word_list').count()
      console.log('word_list表已存在，包含', countResult.total, '条记录')
      
      // 如果表已存在且有数据，根据参数决定是否清空
      if (countResult.total > 0 && !event.forceReset) {
        return {
          code: 0,
          message: `word_list表已存在，包含${countResult.total}条记录，未进行重置`,
          success: true,
          count: countResult.total
        }
      }
      
      // 如果需要重置表，先删除现有数据
      if (countResult.total > 0) {
        console.log('清空word_list表现有数据')
        const MAX_LIMIT = 100
        
        // 分批获取所有记录的ID
        const batchTimes = Math.ceil(countResult.total / MAX_LIMIT)
        for (let i = 0; i < batchTimes; i++) {
          const records = await db.collection('word_list')
            .skip(i * MAX_LIMIT)
            .limit(MAX_LIMIT)
            .get()
          
          const ids = records.data.map(record => record._id)
          
          // 删除这批记录
          await db.collection('word_list').where({
            _id: db.command.in(ids)
          }).remove()
        }
        
        console.log('已清空word_list表')
      }
    } catch (err) {
      console.log('word_list表不存在或无法访问，将创建新表')
      // 表不存在的错误可以忽略，会在后续步骤中创建
    }
    
    // 从words_data表获取数据作为初始数据
    const wordsResult = await db.collection('words_data').limit(100).get()
    const words = wordsResult.data
    
    if (!words || words.length === 0) {
      return {
        code: -1,
        message: '没有找到词语数据源',
        success: false
      }
    }
    
    // 准备要插入的数据
    const wordListData = words.map(word => {
      return {
        word: word.word,
        pinyin: word.pinyin || '',
        example: word.example?.chinese || '',
        imageUrl: word.imageUrl || '',
        createdAt: new Date(),
        // 添加拼音练习数据
        pinyinQuiz: {
          options: {
            options: [
              { label: 'A', value: word.pinyin || '' },
              { label: 'B', value: shufflePinyin(word.pinyin || '') },
              { label: 'C', value: shufflePinyin(word.pinyin || '') },
              { label: 'D', value: shufflePinyin(word.pinyin || '') }
            ],
            correctOption: 'A'
          }
        },
        // 添加填空练习数据
        fillBlank: word.fillBlank || {
          prefix: '请在括号中填入正确的词语：',
          suffix: '',
          answer: word.word
        }
      }
    })
    
    // 批量插入数据
    const insertResults = []
    for (let i = 0; i < wordListData.length; i++) {
      try {
        const result = await db.collection('word_list').add({
          data: wordListData[i]
        })
        insertResults.push(result)
      } catch (err) {
        console.error('插入词语失败:', err)
      }
    }
    
    return {
      code: 0,
      message: `成功初始化word_list表，插入了${insertResults.length}条记录`,
      success: true,
      insertCount: insertResults.length
    }
  } catch (err) {
    console.error('初始化word_list表失败:', err)
    return {
      code: -1,
      message: '初始化word_list表失败: ' + err.message,
      success: false,
      error: err
    }
  }
}

/**
 * 辅助函数：打乱拼音
 */
function shufflePinyin(pinyin) {
  if (!pinyin) return '拼音未知';
  
  // 这里简单替换拼音中的一些字符
  const tones = ['ā', 'á', 'ǎ', 'à', 'ō', 'ó', 'ǒ', 'ò', 'ē', 'é', 'ě', 'è', 'ī', 'í', 'ǐ', 'ì', 'ū', 'ú', 'ǔ', 'ù'];
  const normalVowels = ['a', 'o', 'e', 'i', 'u'];
  
  // 随机决定是替换声调还是替换元音
  if (Math.random() > 0.5 && /[āáǎàōóǒòēéěèīíǐìūúǔù]/.test(pinyin)) {
    // 替换声调
    const randomTone = tones[Math.floor(Math.random() * tones.length)];
    return pinyin.replace(/[āáǎàōóǒòēéěèīíǐìūúǔù]/, randomTone);
  } else if (/[aoeiu]/.test(pinyin)) {
    // 替换元音
    const randomVowel = normalVowels[Math.floor(Math.random() * normalVowels.length)];
    return pinyin.replace(/[aoeiu]/, randomVowel);
  } else {
    // 如果没有匹配的声调和元音，加一个随机音节
    const randomSyllable = ['yi', 'er', 'san', 'si', 'wu'][Math.floor(Math.random() * 5)];
    return pinyin + ' ' + randomSyllable;
  }
} 