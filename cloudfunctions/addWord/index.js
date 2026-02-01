// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { wordData } = event



  // 参数验证
  if (!wordData) {
    return {
      code: -1,
      message: 'wordData不能为空',
      success: false
    }
  }
  
  if (!wordData.word || wordData.word.trim() === '') {
    return {
      code: -1,
      message: '词语不能为空',
      success: false
    }
  }

  if (!wordData.pinyin || wordData.pinyin.trim() === '') {
    return {
      code: -1,
      message: '拼音不能为空',
      success: false
    }
  }

  try {
    // 检查管理员权限（可选，根据需要启用）
    // const adminResult = await db.collection('admins').where({
    //   openid: wxContext.OPENID
    // }).get()
    // 
    // if (adminResult.data.length === 0) {
    //   return {
    //     code: 403,
    //     message: '没有权限执行此操作'
    //   }
    // }

    // 检查词语是否已存在
    const existingWord = await db.collection('words_data').where({
      word: wordData.word
    }).get()

    if (existingWord.data.length > 0) {
      return {
        code: -1,
        message: `词语"${wordData.word}"已存在`,
        success: false
      }
    }

    // 生成唯一ID
    const wordId = 'word_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // 构建完整的词语数据
    const completeWordData = {
      id: wordId,
      word: wordData.word.trim(),
      pinyin: wordData.pinyin.trim(),
      translation: wordData.translation ? wordData.translation.trim() : '',
      turkmenTranslation: wordData.turkmenTranslation ? wordData.turkmenTranslation.trim() : '',
      
      // 例句信息
      example: {
        chinese: wordData.example && wordData.example.chinese ? wordData.example.chinese.trim() : ''
      },
      
      // 图片URL
      imageUrl: wordData.imageUrl || '',
      
      // 看词语选拼音练习
      pinyinQuiz: {
        options: {
          options: wordData.pinyinQuiz && wordData.pinyinQuiz.options && wordData.pinyinQuiz.options.options ? 
            wordData.pinyinQuiz.options.options.map(option => ({
              label: option.label,
              value: option.value.trim()
            })) : [
              { label: 'A', value: '' },
              { label: 'B', value: '' },
              { label: 'C', value: '' },
              { label: 'D', value: '' }
            ],
          correctOption: wordData.pinyinQuiz && wordData.pinyinQuiz.options && wordData.pinyinQuiz.options.correctOption ?
            wordData.pinyinQuiz.options.correctOption : 'A'
        }
      },
      
      // 选词填空练习
      fillBlank: {
        sentence: wordData.fillBlank && wordData.fillBlank.sentence ? wordData.fillBlank.sentence.trim() : '',
        prefix: wordData.fillBlank && wordData.fillBlank.prefix ? wordData.fillBlank.prefix.trim() : '',
        suffix: wordData.fillBlank && wordData.fillBlank.suffix ? wordData.fillBlank.suffix.trim() : '',
        answer: wordData.fillBlank && wordData.fillBlank.answer ? wordData.fillBlank.answer.trim() : wordData.word.trim()
      },
      
      // 其他属性
      audioUrl: '',
      rank: 1000, // 默认排序值
      createTime: new Date(),
      updateTime: new Date(),
      createdBy: wxContext.OPENID
    }

    // 如果没有填空练习的前缀和后缀，但有完整句子，尝试自动生成
    if (completeWordData.fillBlank.sentence && !completeWordData.fillBlank.prefix && !completeWordData.fillBlank.suffix) {
      const sentence = completeWordData.fillBlank.sentence;
      const word = completeWordData.word;
      const wordIndex = sentence.indexOf(word);
      
      if (wordIndex !== -1) {
        completeWordData.fillBlank.prefix = sentence.substring(0, wordIndex);
        completeWordData.fillBlank.suffix = sentence.substring(wordIndex + word.length);
      }
    }

    // 添加到数据库
    console.log('准备添加词语到数据库:', JSON.stringify(completeWordData, null, 2));
    
    const result = await db.collection('words_data').add({
      data: completeWordData
    })

    console.log('词语添加成功:', result);

    return {
      code: 0,
      message: '添加词语成功',
      success: true,
      wordId: wordId,
      _id: result._id,
      data: completeWordData
    }
  } catch (err) {
    console.error('添加词语失败:', err);
    return {
      code: -1,
      message: '添加词语失败: ' + err.message,
      success: false,
      error: err
    }
  }
} 