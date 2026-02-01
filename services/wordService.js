/**
 * 词语数据服务
 * 负责获取和处理词语数据
 */

// 导入记忆算法工具
const memoryUtil = require('../utils/memory');

// 全局词汇数据缓存
let wordsDataCache = null;
let lastFetchTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存

/**
 * 获取所有词语数据
 * @returns {Promise<Array>} 词语数组
 */
async function getAllWords() {
  try {
    // 检查缓存是否有效
    const now = new Date().getTime();
    if (wordsDataCache && lastFetchTime && (now - lastFetchTime < CACHE_DURATION)) {
      return wordsDataCache;
    }

    // 从云函数获取词语数据
    console.log('调用wordOperations云函数获取词语');
    const result = await wx.cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'getWords'
      }
    });

    console.log('云函数返回结果:', JSON.stringify(result.result));

    if (result && result.result && result.result.code === 0 && result.result.data) {
      // 确保每个词语都有正确的数据结构
      const processedWords = result.result.data.map(word => {
        // 确保有id字段
        if (!word.id && word._id) {
          word.id = word._id;
        } else if (!word.id) {
          // 如果没有id，生成一个随机id
          word.id = 'word_' + Math.random().toString(36).substr(2, 9);
        }
        
        // 添加默认图片路径
        if (!word.imageUrl || word.imageUrl.includes('/words/')) {
          word.imageUrl = '/images/default_word.png';
        }
        
        // 处理example字段
        if (typeof word.example === 'string') {
          word.example = { chinese: word.example };
        } else if (!word.example) {
          word.example = { chinese: `这是"${word.word}"的例句。` };
        }
        
        // 处理拼音测验数据
        if (typeof word.pinyinQuiz === 'string') {
          try {
            // 尝试解析格式如："阿姨A. ā yí B. à yí C. ā yí D. à yí 答案: C"
            const quizStr = word.pinyinQuiz;
            const options = [];
            let correctOption = 'A';
            
            // 提取选项
            const optionMatches = quizStr.match(/([A-D])\.\s*([^\s]*\s*[^\s]*)\s*/g);
            if (optionMatches) {
              optionMatches.forEach(match => {
                const optMatch = match.match(/([A-D])\.\s*(.*?)(?=\s*[A-D]\.|\s*$|\s*答案)/);
                if (optMatch) {
                  const label = optMatch[1];
                  const value = optMatch[2].trim();
                  options.push({ label, value });
                }
              });
            }
            
            // 提取正确答案
            const answerMatch = quizStr.match(/答案:\s*([A-D])/i);
            if (answerMatch) {
              correctOption = answerMatch[1];
            }
            
            // 格式化为对象结构
            if (options.length > 0) {
              word.pinyinQuiz = {
                options: {
                  options,
                  correctOption
                }
              };
            }
          } catch (err) {
            console.error('解析拼音测验数据失败:', err);
          }
        } else if (!word.pinyinQuiz) {
          // 如果没有拼音测验数据，创建默认结构
          word.pinyinQuiz = {
            options: {
              options: [
                { label: 'A', value: word.pinyin || '' },
                { label: 'B', value: '错误选项1' },
                { label: 'C', value: '错误选项2' },
                { label: 'D', value: '错误选项3' }
              ],
              correctOption: 'A'
            }
          };
        }
        
        // 处理填空题数据
        if (typeof word.fillBlank === 'string') {
          // 尝试解析字符串格式的fillBlank
          try {
            const fillBlankStr = word.fillBlank;
            
            // 提取句子部分（题干）
            const sentenceMatch = fillBlankStr.match(/(.*?)(?=\s*A\.|$)/);
            let sentence = sentenceMatch ? sentenceMatch[1].trim() : '';
            
            // 提取前缀和后缀
            let prefix = '';
            let suffix = '';
            const bracketMatch = sentence.match(/(.*)（\s*）(.*)/);
            if (bracketMatch) {
              prefix = bracketMatch[1];
              suffix = bracketMatch[2];
            } else {
              // 如果没有明显的括号，尝试找到词语位置
              const wordIndex = sentence.indexOf(word.word);
              if (wordIndex !== -1) {
                prefix = sentence.substring(0, wordIndex);
                suffix = sentence.substring(wordIndex + word.word.length);
              } else {
                prefix = sentence;
                suffix = '';
              }
            }
            
            // 提取正确答案
            let answer = word.word;
            const answerMatch = fillBlankStr.match(/答案：\s*([A-D])/i);
            if (answerMatch) {
              const answerLetter = answerMatch[1];
              const optionMatch = fillBlankStr.match(new RegExp(answerLetter + "\\.\\s*([^\\s]+)"));
              if (optionMatch) {
                answer = optionMatch[1];
              }
            }
            
            // 保存原始字符串
            const originalString = word.fillBlank;
            
            // 创建新的fillBlank对象
            word.fillBlank = {
              sentence: sentence,
              prefix: prefix,
              suffix: suffix,
              answer: answer,
              originalString: originalString // 保存原始字符串以备需要
            };
            
            console.log(`成功解析填空题: ${word.word}`, word.fillBlank);
          } catch (err) {
            console.error(`解析填空题失败: ${word.word}`, err);
            // 如果解析失败，创建一个默认的填空题对象
            word.fillBlank = {
              sentence: `请选择"${word.word}"的正确用法。`,
              prefix: '请在括号中填入正确的词语：',
              suffix: '',
              answer: word.word
            };
          }
        } else if (!word.fillBlank && word.example) {
          // 检查example是否为字符串或对象
          const exampleText = typeof word.example === 'string' ? word.example : 
                             (word.example.chinese ? word.example.chinese : `这是"${word.word}"的例句。`);
          
          const wordIndex = exampleText.indexOf(word.word);
          
          if (wordIndex !== -1) {
            word.fillBlank = {
              sentence: exampleText,
              prefix: exampleText.substring(0, wordIndex),
              suffix: exampleText.substring(wordIndex + word.word.length),
              answer: word.word
            };
          } else {
            word.fillBlank = {
              sentence: `请选择"${word.word}"的正确用法。`,
              prefix: '请在括号中填入正确的词语：',
              suffix: '',
              answer: word.word
            };
          }
        } else if (!word.fillBlank) {
          word.fillBlank = {
            sentence: `请选择"${word.word}"的正确用法。`,
            prefix: '请在括号中填入正确的词语：',
            suffix: '',
            answer: word.word
          };
        }
        
        // 确保fillBlank对象结构完整
        if (word.fillBlank && typeof word.fillBlank === 'object') {
          if (!word.fillBlank.sentence) {
            word.fillBlank.sentence = `请选择"${word.word}"的正确用法。`;
          }
          
          if (!word.fillBlank.prefix && word.fillBlank.sentence) {
            const sentence = word.fillBlank.sentence;
            const bracketMatch = sentence.match(/(.*)（\s*）(.*)/);
            if (bracketMatch) {
              word.fillBlank.prefix = bracketMatch[1];
              word.fillBlank.suffix = bracketMatch[2];
            } else {
              // 尝试找到词语位置
              const wordIndex = sentence.indexOf(word.word);
              if (wordIndex !== -1) {
                word.fillBlank.prefix = sentence.substring(0, wordIndex);
                word.fillBlank.suffix = sentence.substring(wordIndex + word.word.length);
              }
            }
          }
          
          // 确保有答案字段
          if (!word.fillBlank.answer) {
            word.fillBlank.answer = word.word;
          }
          
          // 确保有前缀和后缀
          if (!word.fillBlank.prefix) {
            word.fillBlank.prefix = '';
          }
          if (!word.fillBlank.suffix) {
            word.fillBlank.suffix = '';
          }
        }
        
        return word;
      });
      
      console.log(`成功处理了${processedWords.length}个词语数据`);
      
      // 更新缓存
      wordsDataCache = processedWords;
      lastFetchTime = now;
      
      return processedWords;
    } else {
      console.error('获取词语数据失败:', result);
      return [];
    }
  } catch (e) {
    console.error('获取词语数据失败:', e);
    return [];
  }
}

/**
 * 从words_data表获取词汇数据，替代原来的word_list表查询
 * @returns {Promise<Array>} 词语数组
 */
async function getWordsFromWordList() {
  try {
    // 从云函数获取words_data表中的词语数据
    console.log('调用wordOperations云函数获取words_data表中的词语');
    const result = await wx.cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'getWords'  // 使用getWords操作，而不是getWordsFromWordList
      }
    });

    console.log('words_data表数据结果:', JSON.stringify(result.result));

    // 检查是否成功获取到数据
    if (result && result.result && result.result.code === 0 && result.result.data && result.result.data.length > 0) {
      // 确保每个词语都有正确的数据结构
      const processedWords = result.result.data.map(word => {
        // 确保有id字段
        if (!word.id && word._id) {
          word.id = word._id;
        } else if (!word.id) {
          word.id = 'word_' + Math.random().toString(36).substr(2, 9);
        }
        
        // 处理拼音数据
        if (!word.pinyin) {
          word.pinyin = '';
        }
        
        // 处理拼音测验数据
        if (!word.pinyinQuiz) {
          // 创建默认的拼音测验数据
          word.pinyinQuiz = {
            options: {
              options: [
                { label: 'A', value: word.pinyin },
                { label: 'B', value: shufflePinyin(word.pinyin) },
                { label: 'C', value: shufflePinyin(word.pinyin) },
                { label: 'D', value: shufflePinyin(word.pinyin) }
              ],
              correctOption: 'A'
            }
          };
        }
        
        // 处理填空题数据
        if (!word.fillBlank && word.example) {
          const exampleText = word.example;
          const wordIndex = exampleText.indexOf(word.word);
          
          if (wordIndex !== -1) {
            word.fillBlank = {
              sentence: exampleText,
              prefix: exampleText.substring(0, wordIndex),
              suffix: exampleText.substring(wordIndex + word.word.length),
              answer: word.word
            };
          } else {
            word.fillBlank = {
              sentence: `请选择"${word.word}"的正确用法。`,
              prefix: '请在括号中填入正确的词语：',
              suffix: '',
              answer: word.word
            };
          }
        } else if (!word.fillBlank) {
          word.fillBlank = {
            sentence: `请选择"${word.word}"的正确用法。`,
            prefix: '请在括号中填入正确的词语：',
            suffix: '',
            answer: word.word
          };
        }
        
        return word;
      });
      
      console.log(`从words_data表成功处理了${processedWords.length}个词语数据`);
      return processedWords;
    } else {
      // 如果words_data表为空，直接使用pinyinQuizData中的数据
      console.log('words_data表中没有数据，直接使用pinyinQuizData中的数据');
      
      // 导入拼音题库数据
      const pinyinQuizData = require('../data/pinyinQuizData');
      const pinyinWords = pinyinQuizData.pinyin_quiz;
      
      // 转换为words_data格式
      const convertedWords = pinyinWords.map(word => {
        // 获取正确答案的拼音
        const correctPinyin = word.options[word.answer];
        
        return {
          id: 'word_' + Math.random().toString(36).substr(2, 9),
          word: word.word,
          pinyin: correctPinyin,
          example: `这是"${word.word}"的例句。`, // 默认例句
          fillBlank: {
            prefix: `请在括号中填入正确的词语"${word.word}"：（`,
            suffix: `）`,
            answer: word.word
          },
          pinyinQuiz: {
            options: word.options,
            answer: word.answer
          }
        };
      });
      
      console.log(`从pinyinQuizData成功转换了${convertedWords.length}个词语数据`);
      return convertedWords;
    }
  } catch (e) {
    console.error('获取词语数据失败:', e);
    
    // 出错时也使用pinyinQuizData中的数据作为备选
    try {
      console.log('发生错误，使用pinyinQuizData中的数据作为备选');
      
      // 导入拼音题库数据
      const pinyinQuizData = require('../data/pinyinQuizData');
      const pinyinWords = pinyinQuizData.pinyin_quiz;
      
      // 转换为words_data格式
      const convertedWords = pinyinWords.map(word => {
        // 获取正确答案的拼音
        const correctPinyin = word.options[word.answer];
        
        return {
          id: 'word_' + Math.random().toString(36).substr(2, 9),
          word: word.word,
          pinyin: correctPinyin,
          example: `这是"${word.word}"的例句。`, // 默认例句
          fillBlank: {
            prefix: `请在括号中填入正确的词语"${word.word}"：（`,
            suffix: `）`,
            answer: word.word
          },
          pinyinQuiz: {
            options: word.options,
            answer: word.answer
          }
        };
      });
      
      console.log(`从pinyinQuizData成功转换了${convertedWords.length}个词语数据（备选）`);
      return convertedWords;
    } catch (innerError) {
      console.error('使用备选数据也失败:', innerError);
      return [];
    }
  }
}

/**
 * 辅助函数：打乱拼音
 */
function shufflePinyin(pinyin) {
  if (!pinyin) return '拼音未知';
  
  // 这里简单替换拼音中的一些字符，实际应用中可能需要更复杂的逻辑
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

/**
 * 获取下一组学习词语
 * @param {Object} app 全局应用实例
 * @returns {Object} 下一组学习词语
 */
async function getNextLearningGroup(app) {
  // 检查是否有未完成的学习组
  const currentGroup = app.globalData.currentGroup;
  if (currentGroup && currentGroup.words && currentGroup.words.length > 0 && 
      currentGroup.progress < currentGroup.words.length) {
    return currentGroup;
  }
  
  // 检查学习限制
  const canLearn = memoryUtil.checkLearningLimits(app.globalData.learningProgress);
  if (!canLearn.canLearn) {
    wx.showToast({
      title: canLearn.message,
      icon: 'none'
    });
    return null;
  }
  
  try {
    // 获取同步后的词语数据（确保拼音练习和学习使用相同的词语）
    const syncedWords = await syncPinyinQuizWithWordList();
    
    if (!syncedWords || syncedWords.length === 0) {
      wx.showToast({
        title: '获取词语数据失败',
        icon: 'none'
      });
      return null;
    }
  
    // 获取用户词语状态
    const userWordStatus = app.globalData.wordStatus || {};
    
    // 获取学习进度
    const learningProgress = app.globalData.learningProgress || {};
    
    // 限制每组词语数量
    const groupSize = 7; // 每组7个词
    
    // 使用新的记忆算法选择学习词语
    const learningGroup = memoryUtil.selectNextLearningGroup(
      syncedWords, 
      userWordStatus, 
      groupSize, 
      learningProgress
    );
    
    const selectedWords = learningGroup.words;
    
    if (!selectedWords || selectedWords.length === 0) {
      wx.showToast({
        title: '没有可学习的词语',
        icon: 'none'
      });
      return null;
    }
    
    // 设置当前学习组
    app.globalData.currentGroup = {
      words: selectedWords,
      progress: 0,
      mode: 'learn',
      results: []
    };
    
    // 保存当前学习组到缓存，供练习页面使用
    wx.setStorageSync('currentLearningGroup', {
      words: selectedWords.map(word => word.word), // 只保存词语文本
      timestamp: new Date().getTime()
    });
    
    // 上报学习数据到后台
    await reportLearningData(app.globalData.userInfo, {
      action: 'start_learning',
      groupSize: selectedWords.length,
      reviewCount: learningGroup.reviewCount,
      newCount: learningGroup.newCount
    });
    
    return app.globalData.currentGroup;
  } catch (error) {
    console.error('获取学习组失败:', error);
    wx.showToast({
      title: '获取学习组失败',
      icon: 'none'
    });
    return null;
  }
}

/**
 * 获取练习用的词语
 * 优先从word_list表获取，如果没有则从默认数据获取
 * @returns {Promise<Array>} 可用于练习的词语列表
 */
async function getWordsForPractice() {
  try {
    // 首先尝试从word_list表获取
    const wordListWords = await getWordsFromWordList();
    
    if (wordListWords && wordListWords.length > 0) {
      console.log(`从word_list表获取了${wordListWords.length}个词语用于练习`);
      return wordListWords;
    }
    
    // 如果word_list表没有数据，则使用默认词语表
    console.log('word_list表没有数据，使用默认词语表');
    const allWords = await getAllWords();
    return allWords;
  } catch (error) {
    console.error('获取练习词语失败:', error);
    
    // 如果出现错误，尝试使用默认词语表
    try {
      const allWords = await getAllWords();
      return allWords;
    } catch (e) {
      console.error('获取默认词语也失败:', e);
      return []; // 返回空数组，表示没有可用词语
    }
  }
}

/**
 * 提交练习结果
 * @param {Object} app 全局应用实例
 * @param {Array} results 练习结果数组
 * @returns {Object} 统计结果
 */
async function submitPracticeResults(app, results) {
  // 检查参数有效性
  if (!app || !results || !Array.isArray(results)) {
    console.error('提交练习结果参数无效:', { app: !!app, results: results });
    return { correctCount: 0, totalCount: 0, correctRate: 0 };
  }
  
  console.log('开始处理练习结果，参数:', { 
    appExists: !!app, 
    resultsLength: results.length,
    hasLearningProgress: !!app.globalData.learningProgress
  });
  
  try {
  // 获取用户词语状态
  const userWordStatus = app.globalData.wordStatus || {};
  
  // 获取学习进度
  const learningProgress = app.globalData.learningProgress || {
    totalWordsLearned: 0,
    wordsAtStage: [0, 0, 0, 0, 0],
    dailyLearnedCount: 0,
    currentSessionCount: 0,
    lastLearnDate: new Date().toDateString()
  };
  
  // 确保必要的数据结构存在
  if (!learningProgress.wordsAtStage) {
    learningProgress.wordsAtStage = [0, 0, 0, 0, 0];
  }
  
  if (!learningProgress.learnedWords) {
    learningProgress.learnedWords = [];
  }
  
  // 重置每日计数（如果是新的一天）
  memoryUtil.resetDailyCount(learningProgress);
  
  // 记录今日学习（用于个人中心统计）
  const today = new Date().toDateString();
  let learningDays = wx.getStorageSync('learningDays') || [];
  if (!Array.isArray(learningDays)) {
    learningDays = [];
  }
  if (!learningDays.includes(today)) {
    learningDays.push(today);
    wx.setStorageSync('learningDays', learningDays);
  }
  
  // 统计正确数和总数
  let correctCount = 0;
  let validResultsCount = 0;
  
  console.log('开始处理练习结果，共', results.length, '个结果');
  
  // 处理每个词语的结果
  results.forEach(result => {
    // 检查结果对象的有效性
    if (!result || typeof result !== 'object') {
      console.warn('无效的结果对象:', result);
      return; // 跳过此结果
    }
    
    // 使用wordId而不是尝试访问word.id
    const wordId = result.wordId;
    
    // 检查wordId的有效性
    if (!wordId) {
      console.warn('无效的wordId:', result);
      return; // 跳过此结果
    }
    
    // 新增：追踪是否为新词
    const isNew = !userWordStatus[wordId];
    
    const isCorrect = !!result.isCorrect;
    validResultsCount++;
    
    // 更新词语记忆状态
    const updatedStatus = memoryUtil.updateWordMemoryStatus(userWordStatus, wordId, isCorrect);
    
    // 检查updatedStatus是否有效
    if (!updatedStatus) {
      console.warn('无法更新词语状态:', { wordId, isCorrect });
      return; // 跳过此结果
    }
    
    if (isCorrect) {
      correctCount++;
    }
    
    // 新增：更新学习统计数据
    // 如果是首次学习该词，增加总词数计数
    if (isNew) {
      learningProgress.totalWordsLearned = (learningProgress.totalWordsLearned || 0) + 1;
      
      // 添加到已学习词列表
      if (Array.isArray(learningProgress.learnedWords)) {
        if (!learningProgress.learnedWords.includes(wordId)) {
          learningProgress.learnedWords.push(wordId);
        }
      } else {
        learningProgress.learnedWords = [wordId];
      }
      
      // 增加日学习计数和本次学习计数
      learningProgress.dailyLearnedCount = (learningProgress.dailyLearnedCount || 0) + 1;
      learningProgress.currentSessionCount = (learningProgress.currentSessionCount || 0) + 1;
    }
    
    // 更新用户词语状态
    userWordStatus[wordId] = updatedStatus;
    
    // 更新阶段分布
    const stage = updatedStatus.stage || 0;
      const previousStage = updatedStatus.previousStage || 0;
      
    if (!learningProgress.wordsAtStage) {
      learningProgress.wordsAtStage = [0, 0, 0, 0, 0, 0, 0];
    }
    
    // 更新记忆阶段统计
      // 从之前的阶段减1，新阶段加1
      if (previousStage > 0 && previousStage < learningProgress.wordsAtStage.length) {
        learningProgress.wordsAtStage[previousStage] = Math.max(0, (learningProgress.wordsAtStage[previousStage] || 0) - 1);
      }
      
      if (stage > 0 && stage < learningProgress.wordsAtStage.length) {
        learningProgress.wordsAtStage[stage] = (learningProgress.wordsAtStage[stage] || 0) + 1;
    }
  });
  
  // 确保每个阶段数值都不为负
  if (learningProgress.wordsAtStage) {
    for (let i = 0; i < learningProgress.wordsAtStage.length; i++) {
      if (learningProgress.wordsAtStage[i] < 0) {
        learningProgress.wordsAtStage[i] = 0;
      }
    }
  }
  
  console.log('学习进度更新结果:', {
    totalWordsLearned: learningProgress.totalWordsLearned,
    dailyLearnedCount: learningProgress.dailyLearnedCount,
    currentSessionCount: learningProgress.currentSessionCount,
    wordsAtStage: learningProgress.wordsAtStage
  });
  
  // 更新app全局数据
  app.globalData.wordStatus = userWordStatus;
  app.globalData.learningProgress = learningProgress;
  
    // 保存用户数据到云端
  if (app.globalData.userInfo && app.globalData.userInfo.studentId) {
      // 计算统计数据
      const stats = {
        totalWordsLearned: learningProgress.totalWordsLearned || 0,
        correctRate: validResultsCount > 0 ? Math.round(correctCount / validResultsCount * 100) : 0,
        wordsAtStage: learningProgress.wordsAtStage || [0, 0, 0, 0, 0]
      };
      
      // 调用云函数保存数据
      await wx.cloud.callFunction({
        name: 'saveUserData',
        data: {
          studentId: app.globalData.userInfo.studentId,
          name: app.globalData.userInfo.name,
      learningProgress: app.globalData.learningProgress,
      wordStatus: app.globalData.wordStatus,
          lastSyncTime: new Date().toISOString(),
          stats: stats
        }
    });
  }
  
  // 计算正确率
  const totalCount = validResultsCount;
  const correctRate = totalCount > 0 ? (correctCount / totalCount * 100).toFixed(0) : 0;
  
  // 重置当前组
  app.globalData.currentGroup = {
    words: [],
    progress: 0,
    mode: 'learn',
    results: []
  };
  
  return {
    correctCount,
    totalCount,
    correctRate
  };
  } catch (error) {
    console.error('提交练习结果失败:', error);
    return {
      correctCount: 0,
      totalCount: 0,
      correctRate: 0
    };
  }
}

/**
 * 获取用户学习统计
 * @param {Object} app 全局应用实例
 * @returns {Object} 学习统计数据
 */
async function getLearningStats(app) {
  try {
    // 获取词汇总量
    const countResult = await wx.cloud.callFunction({
      name: 'getWordsStats'
    });
    
    // 提取词汇总量
    const totalWords = countResult.result?.totalCount || 0;
    
    // 获取用户词语学习状态
    const wordStatus = app.globalData.wordStatus || {};
    
    // 计算已学习的词语数量
    const learnedWordsCount = Object.keys(wordStatus).length;
    
    // 计算未学习的词语数量（阶段0）
    const stage0Count = Math.max(0, totalWords - learnedWordsCount);
    
    // 计算各个阶段的词语数量
    let stage1Count = 0;  // 阶段1：记忆曲线第一阶段
    let stage2Count = 0;  // 阶段2：记忆曲线第二阶段
    let stage3Count = 0;  // 阶段3：记忆曲线第三阶段
    let stage4Count = 0;  // 阶段4：记忆曲线第四阶段
    let stage5Count = 0;  // 阶段5：记忆曲线最终阶段
    
    // 遍历统计各个阶段的词语数量
    Object.values(wordStatus).forEach(status => {
      if (!status) return;
      
      const stage = status.stage || 0;
      switch(stage) {
        case 1: stage1Count++; break;
        case 2: stage2Count++; break;
        case 3: stage3Count++; break;
        case 4: stage4Count++; break;
        case 5: stage5Count++; break;
        default: break;
      }
    });
    
    // 如果app有全局进度数据，将其同步更新
    if (app.globalData.learningProgress) {
      app.globalData.learningProgress.totalWordsLearned = learnedWordsCount;
      app.globalData.learningProgress.wordsAtStage = [stage0Count, stage1Count, stage2Count, stage3Count, stage4Count, stage5Count];
    }
    
    // 返回统计数据
    return {
      totalWords: totalWords,
      learnedWords: learnedWordsCount,
      notLearnedWords: stage0Count,
      stageDistribution: [stage0Count, stage1Count, stage2Count, stage3Count, stage4Count, stage5Count]
    };
  } catch (error) {
    console.error('获取学习统计数据失败:', error);
    return {
      totalWords: 0,
      learnedWords: 0,
      notLearnedWords: 0,
      stageDistribution: [0, 0, 0, 0, 0, 0]
    };
  }
}

/**
 * 上报学习数据到后台
 * @param {Object} userInfo 用户信息
 * @param {Object} data 学习数据
 */
async function reportLearningData(userInfo, data) {
  if (!userInfo) return;
  
  try {
    // 向云函数发送学习数据
    await wx.cloud.callFunction({
      name: 'reportLearningData',
      data: {
    studentId: userInfo.studentId,
    name: userInfo.name,
    timestamp: new Date().toISOString(),
    ...data
      }
    });
  } catch (error) {
    console.error('上报学习数据失败:', error);
  }
}

/**
 * 获取拼音练习题
 * @param {number} limit 获取题目数量，默认10题
 * @returns {Promise<Array>} 拼音练习题数组
 */
async function getPinyinQuizzes(limit = 10) {
  try {
    // 从云函数获取拼音练习题数据
    console.log('调用wordOperations云函数获取拼音练习题');
    const result = await wx.cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'getPinyinQuizzes',
        limit: limit
      }
    });

    console.log('拼音练习题结果:', JSON.stringify(result.result));

    if (result && result.result && result.result.code === 0 && result.result.data) {
      return result.result.data;
    } else {
      console.error('获取拼音练习题失败:', result);
      return [];
    }
  } catch (e) {
    console.error('获取拼音练习题失败:', e);
    return [];
  }
}

/**
 * 同步拼音练习题与词语列表
 * 确保两者包含相同的词语
 * @returns {Promise<Array>} 同步后的词语数组
 */
async function syncPinyinQuizWithWordList() {
  try {
    // 导入拼音题库数据
    const pinyinQuizData = require('../data/pinyinQuizData');
    const pinyinWords = pinyinQuizData.pinyin_quiz;
    
    // 获取word_list中的词语
    const wordListWords = await getWordsFromWordList();
    
    if (!wordListWords || wordListWords.length === 0) {
      console.warn('word_list中没有词语数据，无法同步');
      return pinyinWords;
    }
    
    // 获取两个列表中的词语
    const pinyinWordTexts = pinyinWords.map(item => item.word);
    const wordListTexts = wordListWords.map(item => item.word);
    
    console.log('拼音练习词语:', pinyinWordTexts);
    console.log('词语列表词语:', wordListTexts);
    
    // 找出两个列表中共同的词语
    const commonWords = pinyinWordTexts.filter(word => wordListTexts.includes(word));
    
    console.log('共同的词语:', commonWords);
    
    if (commonWords.length === 0) {
      console.warn('没有找到共同的词语，无法同步');
      return pinyinWords;
    }
    
    // 从两个列表中筛选出共同的词语对象
    const filteredPinyinWords = pinyinWords.filter(item => commonWords.includes(item.word));
    const filteredWordListWords = wordListWords.filter(item => commonWords.includes(item.word));
    
    // 创建映射关系，方便查找
    const wordListMap = {};
    filteredWordListWords.forEach(word => {
      wordListMap[word.word] = word;
    });
    
    // 将拼音练习题的内容与词语列表同步
    const syncedWords = filteredPinyinWords.map(pinyinWord => {
      const wordListWord = wordListMap[pinyinWord.word];
      if (wordListWord) {
        // 保留拼音练习题的选项和答案
        wordListWord.pinyinOptions = pinyinWord.options;
        wordListWord.pinyinAnswer = pinyinWord.answer;
      }
      return wordListWord || pinyinWord;
    });
    
    console.log(`成功同步了${syncedWords.length}个词语`);
    return syncedWords;
  } catch (error) {
    console.error('同步词语数据失败:', error);
    // 出错时返回原始拼音练习题
    const pinyinQuizData = require('../data/pinyinQuizData');
    return pinyinQuizData.pinyin_quiz;
  }
}

/**
 * 处理词语的音频文件
 * @param {String} word 词语
 * @param {String} filePath 录音文件路径
 * @returns {Promise<Object>} 处理结果
 */
async function uploadWordAudio(word, filePath) {
  try {
    if (!word || !filePath) {
      console.error('上传词汇音频参数错误:', {word, filePath});
      return {
        success: false,
        message: '参数错误'
      };
    }

    // 获取文件扩展名
    const fileExtension = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();
    
    // 检查文件类型是否为aac或mp4
    if (fileExtension !== 'aac' && fileExtension !== 'mp4') {
      return {
        success: false,
        message: '仅支持AAC或MP4格式的录音文件'
      };
    }

    // 构建云存储路径
    const cloudPath = `audio/words/${word}.${fileExtension}`;
    
    console.log('开始上传音频文件:', {word, filePath, cloudPath});
    
    // 上传文件到云存储
    const uploadResult = await wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath
    });
    
    console.log('音频文件上传结果:', uploadResult);
    
    if (!uploadResult.fileID) {
      throw new Error('上传失败，未获取到文件ID');
    }
    
    // 更新词语数据，添加音频文件ID
    const result = await wx.cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'updateWordAudio',
        word: word,
        audioFileId: uploadResult.fileID,
        audioFileType: fileExtension
      }
    });
    
    console.log('更新词语音频数据结果:', result);
    
    // 清除缓存，确保下次获取数据时能获取到最新的
    wordsDataCache = null;
    
    return {
      success: true,
      message: '音频上传成功',
      fileID: uploadResult.fileID
    };
  } catch (error) {
    console.error('上传词汇音频失败:', error);
    return {
      success: false,
      message: '上传失败: ' + error.message
    };
  }
}

/**
 * 获取词汇音频URL
 * @param {string} word 词汇
 * @returns {Promise<string>} 音频URL
 */
async function getWordAudioUrl(word) {
  try {
    if (!word) {
      console.error('获取词汇音频URL失败: 缺少词汇参数');
      return null;
    }
    
    console.log(`开始获取词汇 "${word}" 的音频URL`);
    
    // 查询词汇信息
    const db = wx.cloud.database();
    const wordRes = await db.collection('words').where({
      word: word
    }).get();
    
    console.log('词汇查询结果:', wordRes);
    
    if (!wordRes.data || wordRes.data.length === 0) {
      console.error('获取词汇音频URL失败: 词汇不存在');
      
      // 尝试模糊查询
      try {
        console.log('尝试进行词汇模糊查询');
        const sampleWords = await db.collection('words').limit(5).get();
        console.log('数据库中的词汇示例:', sampleWords.data.map(w => w.word));
      } catch (err) {
        console.error('模糊查询失败:', err);
      }
      
      return null;
    }
    
    const wordData = wordRes.data[0];
    console.log('找到词汇数据:', {
      word: wordData.word,
      hasAudio: !!wordData.audioFileId,
      audioFileId: wordData.audioFileId
    });
    
    if (!wordData.audioFileId) {
      console.log('该词汇没有音频文件');
      return null;
    }
    
    // 获取音频临时URL
    console.log(`开始获取云存储文件临时URL: ${wordData.audioFileId}`);
    const result = await wx.cloud.getTempFileURL({
      fileList: [wordData.audioFileId]
    });
    
    console.log('获取临时URL结果:', result);
    
    if (result.fileList && result.fileList.length > 0) {
      const tempUrl = result.fileList[0].tempFileURL;
      console.log(`获取临时URL成功: ${tempUrl}`);
      return tempUrl;
    } else {
      console.error('获取词汇音频临时URL失败', result);
      return null;
    }
  } catch (error) {
    console.error('获取词汇音频URL异常:', error);
    return null;
  }
}

module.exports = {
  getAllWords,
  getWordsFromWordList,
  getWordsForPractice,
  getNextLearningGroup,
  submitPracticeResults,
  getLearningStats,
  reportLearningData,
  getPinyinQuizzes,
  syncPinyinQuizWithWordList,
  uploadWordAudio,
  getWordAudioUrl
}; 