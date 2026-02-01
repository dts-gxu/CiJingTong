// 云函数入口文件
const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { fileID, collectionName = 'words_data' } = event;

  if (!fileID) {
    return {
      code: -1,
      message: '未提供文件ID',
      success: false
    };
  }

  try {
    // 下载Excel文件
    const res = await cloud.downloadFile({
      fileID: fileID
    });
    const buffer = res.fileContent;
    
    // 解析Excel文件
    const sheets = xlsx.parse(buffer);
    if (!sheets || sheets.length === 0 || !sheets[0].data || sheets[0].data.length <= 1) {
      return {
        code: -1,
        message: 'Excel文件格式错误或为空',
        success: false
      };
    }
    
    // 获取第一个sheet
    const sheet = sheets[0];
    const rows = sheet.data;
    
    // 第一行应该是表头
    const headers = rows[0];
    
    // 检查表头是否符合要求
    const requiredColumns = ['词语', '拼音'];
    const optionalColumns = ['英语翻译', '土库曼语翻译', '例句', '看词语选拼音', '选词填空'];
    const allColumns = [...requiredColumns, ...optionalColumns];
    const headerIndexMap = {};
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (allColumns.includes(header)) {
        headerIndexMap[header] = i;
      }
    }
    
    // 确保所有必需的列都存在
    for (const col of requiredColumns) {
      if (headerIndexMap[col] === undefined) {
        return {
          code: -1,
          message: `Excel文件缺少必要的列: ${col}`,
          success: false
        };
      }
    }
    
    // 解析数据行
    const words = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // 跳过空行
      if (!row || row.length === 0 || !row[headerIndexMap['词语']]) {
        continue;
      }
      
      // 提取基本词语信息
      const wordText = String(row[headerIndexMap['词语']]).trim();
      const pinyinText = headerIndexMap['拼音'] !== undefined ? String(row[headerIndexMap['拼音']] || '').trim() : '';
      
      if (!wordText || !pinyinText) {
        continue; // 跳过没有词语或拼音的行
      }
      
      // 解析例句信息
      const exampleText = headerIndexMap['例句'] !== undefined ? String(row[headerIndexMap['例句']] || '').trim() : '';
      const example = parseExample(exampleText);
      
      // 解析拼音练习
      const pinyinQuizText = headerIndexMap['看词语选拼音'] !== undefined ? String(row[headerIndexMap['看词语选拼音']] || '').trim() : '';
      const pinyinQuiz = parsePinyinQuiz(pinyinQuizText, pinyinText);
      
      // 解析填空练习
      const fillBlankText = headerIndexMap['选词填空'] !== undefined ? String(row[headerIndexMap['选词填空']] || '').trim() : '';
      const fillBlank = parseFillBlank(fillBlankText, wordText);
      
      // 构建完整的词语数据
      const word = {
        id: 'word_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + i,
        word: wordText,
        pinyin: pinyinText,
        translation: headerIndexMap['英语翻译'] !== undefined ? String(row[headerIndexMap['英语翻译']] || '').trim() : '',
        turkmenTranslation: headerIndexMap['土库曼语翻译'] !== undefined ? String(row[headerIndexMap['土库曼语翻译']] || '').trim() : '',
        example: example,
        imageUrl: '',
        pinyinQuiz: pinyinQuiz,
        fillBlank: fillBlank,
        audioUrl: '',
        rank: 1000,
        createTime: new Date(),
        updateTime: new Date(),
        addTime: new Date().toISOString()
      };
      
      words.push(word);
    }
    
    if (words.length === 0) {
      return {
        code: -1,
        message: '没有有效的词语数据',
        success: false
      };
    }
    
    // 批量添加到指定集合
    const wordsCollection = db.collection(collectionName);
    
    // 由于小程序云开发限制，一次最多操作100条数据，需要分批处理
    const batchSize = 50; // 减小批处理大小，避免超时
    let successCount = 0;
    
    // 优化数据处理方式，使用Promise.all进行并行处理
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      const promises = batch.map(async (word) => {
        try {
          // 查询是否已存在该词语
          const existingWord = await wordsCollection.where({
            word: word.word
          }).get();
          
          if (existingWord.data && existingWord.data.length > 0) {
            // 已存在，更新信息
            await wordsCollection.doc(existingWord.data[0]._id).update({
              data: {
                pinyin: word.pinyin,
                translation: word.translation,
                turkmenTranslation: word.turkmenTranslation,
                example: word.example,
                pinyinQuiz: word.pinyinQuiz,
                fillBlank: word.fillBlank,
                updateTime: new Date().toISOString()
              }
            });
          } else {
            // 不存在，添加新记录
            await wordsCollection.add({
              data: word
            });
          }
          return true;
        } catch (error) {
          console.error('处理词语失败:', word.word, error);
          return false;
        }
      });
      
      // 等待当前批次的处理完成
      const results = await Promise.all(promises);
      successCount += results.filter(result => result).length;
    }
    
    // 删除上传的文件
    await cloud.deleteFile({
      fileList: [fileID]
    });
    
    return {
      code: 0,
      message: '导入成功',
      success: true,
      importCount: successCount
    };
    
  } catch (error) {
    console.error('导入词语数据失败:', error);
    return {
      code: -1,
      message: '导入失败: ' + error.message,
      success: false
    };
  }
};

// 根据正确拼音生成拼音选项
function generatePinyinOptions(correctPinyin, quizData) {
  if (!correctPinyin) return [];
  
  // 如果quizData已经包含选项格式 (A. xx B. xx C. xx D. xx)，解析它
  if (quizData && quizData.includes('A.') && quizData.includes('B.')) {
    try {
      const options = [];
      const optionRegex = /([A-D])\.\s*([^\s]+)/g;
      let match;
      let correctOption = '';
      
      while ((match = optionRegex.exec(quizData)) !== null) {
        const option = {
          label: match[1],
          value: match[2].trim()
        };
        options.push(option);
        
        // 检查是否为正确选项
        if (option.value === correctPinyin.trim()) {
          correctOption = option.label;
        }
      }
      
      // 查找正确答案
      const answerMatch = /答案[:：]\s*([A-D])/i.exec(quizData);
      if (answerMatch) {
        correctOption = answerMatch[1];
      }
      
      return {
        options: options,
        correctOption: correctOption
      };
    } catch (error) {
      console.error('解析拼音选项失败:', error);
    }
  }
  
  // 默认生成4个选项，包括正确答案
  correctPinyin = correctPinyin.trim();
  const options = [
    { label: 'A', value: correctPinyin },
    { label: 'B', value: shufflePinyin(correctPinyin) },
    { label: 'C', value: shufflePinyin(correctPinyin) },
    { label: 'D', value: shufflePinyin(correctPinyin) }
  ];
  
  // 打乱选项顺序
  shuffleArray(options);
  
  // 找出正确选项的标签
  let correctOption = '';
  options.forEach(option => {
    if (option.value === correctPinyin) {
      correctOption = option.label;
    }
  });
  
  return {
    options: options,
    correctOption: correctOption
  };
}

// 打乱拼音
function shufflePinyin(pinyin) {
  // 简单实现：调换声调或替换某个字符
  const pinyinChars = pinyin.split('');
  const index = Math.floor(Math.random() * pinyinChars.length);
  
  if (pinyinChars[index] === 'a') pinyinChars[index] = 'e';
  else if (pinyinChars[index] === 'e') pinyinChars[index] = 'i';
  else if (pinyinChars[index] === 'i') pinyinChars[index] = 'o';
  else if (pinyinChars[index] === 'o') pinyinChars[index] = 'u';
  else if (pinyinChars[index] === 'u') pinyinChars[index] = 'a';
  else if (pinyinChars[index] === '1') pinyinChars[index] = '2';
  else if (pinyinChars[index] === '2') pinyinChars[index] = '3';
  else if (pinyinChars[index] === '3') pinyinChars[index] = '4';
  else if (pinyinChars[index] === '4') pinyinChars[index] = '1';
  
  return pinyinChars.join('');
}

// 打乱数组
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 解析例句信息
function parseExample(exampleText) {
  if (!exampleText) {
    return {
      chinese: '',
      pinyin: '',
      translation: ''
    };
  }
  
  // 如果例句包含分隔符，尝试解析
  const parts = exampleText.split('|');
  if (parts.length >= 3) {
    return {
      chinese: parts[0].trim(),
      pinyin: parts[1].trim(),
      translation: parts[2].trim()
    };
  } else {
    return {
      chinese: exampleText.trim(),
      pinyin: '',
      translation: ''
    };
  }
}

// 解析拼音练习
function parsePinyinQuiz(pinyinQuizText, correctPinyin) {
  if (!pinyinQuizText) {
    // 如果没有提供练习数据，自动生成
    return generatePinyinOptions(correctPinyin, '');
  }
  
  // 如果包含分隔符，解析格式：A选项|B选项|C选项|D选项|正确答案
  const parts = pinyinQuizText.split('|');
  if (parts.length >= 5) {
    return {
      options: {
        options: [
          { label: 'A', value: parts[0].trim() },
          { label: 'B', value: parts[1].trim() },
          { label: 'C', value: parts[2].trim() },
          { label: 'D', value: parts[3].trim() }
        ],
        correctOption: parts[4].trim().toUpperCase()
      }
    };
  } else {
    // 使用原有的解析逻辑
    return {
      options: generatePinyinOptions(correctPinyin, pinyinQuizText)
    };
  }
}

// 解析填空练习
function parseFillBlank(fillBlankText, wordText) {
  if (!fillBlankText) {
    return {
      sentence: '',
      prefix: '',
      suffix: '',
      answer: wordText
    };
  }
  
  // 如果包含分隔符，解析格式：完整句子|前缀|后缀|答案
  const parts = fillBlankText.split('|');
  if (parts.length >= 4) {
    return {
      sentence: parts[0].trim(),
      prefix: parts[1].trim(),
      suffix: parts[2].trim(),
      answer: parts[3].trim()
    };
  } else if (parts.length >= 3) {
    return {
      sentence: parts[0].trim(),
      prefix: parts[1].trim(),
      suffix: parts[2].trim(),
      answer: wordText
    };
  } else {
    // 尝试从完整句子中自动解析
    const sentence = fillBlankText.trim();
    const wordIndex = sentence.indexOf(wordText);
    
    if (wordIndex !== -1) {
      return {
        sentence: sentence,
        prefix: sentence.substring(0, wordIndex),
        suffix: sentence.substring(wordIndex + wordText.length),
        answer: wordText
      };
    } else {
      return {
        sentence: sentence,
        prefix: '',
        suffix: '',
        answer: wordText
      };
    }
  }
} 