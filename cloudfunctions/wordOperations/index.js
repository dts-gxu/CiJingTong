// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const MAX_LIMIT = 100

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { operation, wordId, wordIds } = event;
  
  try {
    console.log(`执行操作: ${operation}`, event);
    
    // 根据操作类型执行不同的功能
    switch (operation) {
      case 'getWords':
        return await getWords();
      case 'getWordsFromWordList':
        return await getWordsFromWordList();
      case 'getPinyinQuizzes':
        return await getPinyinQuizzes(event.limit);
      case 'deleteWord':
        return await deleteWord(wordId);
      case 'batchDeleteWords':
        return await batchDeleteWords(wordIds);
      case 'deleteCollection':
        return await deleteCollection();
      case 'savePracticeResults':
        return await savePracticeResults(event);
      case 'updateWordAudio':
        return await updateWordAudio(event);
      default:
        return {
          code: -1,
          message: `未知操作: ${operation}`,
          data: null
        };
    }
  } catch (error) {
    console.error('操作执行失败:', error);
    return {
      code: -1,
      message: '云函数执行出错: ' + error.message,
      data: null
    };
  }
};

/**
 * 获取所有词语
 */
async function getWords() {
  try {
    console.log('开始获取词语列表');
    
    // 只使用words_data集合
    const collectionName = 'words_data';
    
      console.log(`尝试从集合 ${collectionName} 获取词语数据`);
      
      // 获取词语总数
    const countResult = await db.collection(collectionName).count();
      const total = countResult.total || 0;
      
      console.log(`集合 ${collectionName} 中有 ${total} 条记录`);
      
      if (total > 0) {
        // 计算需要分几次取
        const batchTimes = Math.ceil(total / MAX_LIMIT);
        console.log(`需要分 ${batchTimes} 次获取数据`);
        
        // 承载所有读操作的 promise 的数组
        const tasks = [];
        
        for (let i = 0; i < batchTimes; i++) {
          const promise = db.collection(collectionName)
            .skip(i * MAX_LIMIT)
            .limit(MAX_LIMIT)
            .get();
          
          tasks.push(promise);
        }
        
        // 等待所有请求完成
        const results = await Promise.all(tasks);
        console.log(`成功执行了 ${results.length} 次查询`);
        
        // 合并结果
        let allWords = [];
        results.forEach(result => {
          console.log(`本批次获取到 ${result.data.length} 条数据`);
          allWords = allWords.concat(result.data);
        });
        
        console.log(`从集合 ${collectionName} 成功获取 ${allWords.length} 条词语数据`);
        
      // 确保每个词语都有_id字段和完整的数据结构
        allWords = allWords.map((word, index) => {
          if (!word._id) {
            word._id = `word_${index}`;
          }
        
        // 修复example字段结构
        if (!word.example) {
          word.example = { chinese: '' };
        } else if (typeof word.example === 'string') {
          // 如果example是字符串，转换为对象
          word.example = { chinese: word.example };
        } else {
          // 确保example对象有中文字段
          word.example = {
            chinese: word.example.chinese || ''
          };
        }
        
        // 修复pinyinQuiz字段结构
        if (!word.pinyinQuiz || !word.pinyinQuiz.options) {
          word.pinyinQuiz = {
            options: {
              options: [
                { label: 'A', value: '' },
                { label: 'B', value: '' },
                { label: 'C', value: '' },
                { label: 'D', value: '' }
              ],
              correctOption: 'A'
            }
          };
        } else {
          // 确保options数组有4个元素
          if (!word.pinyinQuiz.options.options || !Array.isArray(word.pinyinQuiz.options.options)) {
            word.pinyinQuiz.options.options = [
              { label: 'A', value: '' },
              { label: 'B', value: '' },
              { label: 'C', value: '' },
              { label: 'D', value: '' }
            ];
          } else {
            // 补全缺失的选项
            const labels = ['A', 'B', 'C', 'D'];
            for (let i = 0; i < 4; i++) {
              if (!word.pinyinQuiz.options.options[i]) {
                word.pinyinQuiz.options.options[i] = { label: labels[i], value: '' };
              } else {
                word.pinyinQuiz.options.options[i].label = labels[i];
                word.pinyinQuiz.options.options[i].value = word.pinyinQuiz.options.options[i].value || '';
              }
            }
          }
          // 确保有正确答案
          if (!word.pinyinQuiz.options.correctOption) {
            word.pinyinQuiz.options.correctOption = 'A';
          }
        }
        
        // 修复fillBlank字段结构
        if (!word.fillBlank) {
          word.fillBlank = { sentence: '', prefix: '', suffix: '', answer: word.word || '' };
        } else {
          word.fillBlank = {
            sentence: word.fillBlank.sentence || '',
            prefix: word.fillBlank.prefix || '',
            suffix: word.fillBlank.suffix || '',
            answer: word.fillBlank.answer || word.word || ''
          };
        }
        
        // 确保基本字段存在
        word.translation = word.translation || '';
        word.turkmenTranslation = word.turkmenTranslation || '';
        word.imageUrl = word.imageUrl || '';
        
          return word;
        });
        
        return {
          code: 0,
          message: `成功从集合 ${collectionName} 获取词语数据`,
          data: allWords,
          collection: collectionName
        };
    }
    
    // 如果没有数据
    return {
      code: 0,
      message: '没有找到词语数据',
      data: [],
      collection: collectionName
    };
  } catch (error) {
    console.error('获取词语数据失败:', error);
    return {
      code: -1,
      message: '获取失败：' + error.message,
      error: error
    };
  }
}

/**
 * 从word_list表获取词语
 */
async function getWordsFromWordList() {
  try {
    console.log('开始从word_list集合获取词语列表');
    
    // 使用word_list集合
    const collectionName = 'word_list';
    
    try {
      console.log(`尝试从集合 ${collectionName} 获取词语数据`);
      
      // 检查集合是否存在
      const collections = await db.collections();
      const collectionExists = collections.some(col => col.name === collectionName);
      console.log(`集合 ${collectionName} 是否存在:`, collectionExists);
      
      if (!collectionExists) {
        console.log(`集合 ${collectionName} 不存在，需要先创建`);
        return {
          code: 0,
          message: `集合 ${collectionName} 不存在，需要先创建`,
          data: [],
          collection: null
        };
      }
      
      // 获取词语总数
      const countResult = await db.collection(collectionName).count()
        .catch(err => {
          console.log(`集合 ${collectionName} 不存在或无法访问:`, err);
          return { total: 0 };
        });
        
      const total = countResult.total || 0;
      
      console.log(`集合 ${collectionName} 中有 ${total} 条记录`);
      
      if (total > 0) {
        // 计算需要分几次取
        const batchTimes = Math.ceil(total / MAX_LIMIT);
        console.log(`需要分 ${batchTimes} 次获取数据`);
        
        // 承载所有读操作的 promise 的数组
        const tasks = [];
        
        for (let i = 0; i < batchTimes; i++) {
          const promise = db.collection(collectionName)
            .skip(i * MAX_LIMIT)
            .limit(MAX_LIMIT)
            .get();
          
          tasks.push(promise);
        }
        
        // 等待所有请求完成
        const results = await Promise.all(tasks);
        console.log(`成功执行了 ${results.length} 次查询`);
        
        // 合并结果
        let allWords = [];
        results.forEach(result => {
          console.log(`本批次获取到 ${result.data.length} 条数据`);
          allWords = allWords.concat(result.data);
        });
        
        console.log(`从集合 ${collectionName} 成功获取 ${allWords.length} 条词语数据`);
        
        // 确保每个词语都有_id字段
        allWords = allWords.map((word, index) => {
          if (!word._id) {
            word._id = `word_${index}`;
          }
          return word;
        });
        
        return {
          code: 0,
          message: `成功从集合 ${collectionName} 获取词语数据`,
          data: allWords,
          collection: collectionName
        };
      }
    } catch (error) {
      console.error(`从集合 ${collectionName} 获取词语数据失败:`, error);
    }
    
    // 如果没有数据
    return {
      code: 0,
      message: '没有找到词语数据',
      data: [],
      collection: null
    };
  } catch (error) {
    console.error('获取词语数据失败:', error);
    return {
      code: -1,
      message: '获取失败：' + error.message,
      error: error
    };
  }
}

/**
 * 获取拼音练习题
 * @param {number} limit 获取题目数量，默认10题
 */
async function getPinyinQuizzes(limit = 10) {
  try {
    console.log(`开始从pinyin_quiz集合获取拼音练习题，数量: ${limit}`);
    
    // 使用pinyin_quiz集合
    const collectionName = 'pinyin_quiz';
    
    try {
      console.log(`尝试从集合 ${collectionName} 获取拼音练习题数据`);
      
      // 检查集合是否存在
      const collections = await db.collections();
      const collectionExists = collections.some(col => col.name === collectionName);
      console.log(`集合 ${collectionName} 是否存在:`, collectionExists);
      
      if (!collectionExists) {
        console.log(`集合 ${collectionName} 不存在，需要先创建`);
        return {
          code: 0,
          message: `集合 ${collectionName} 不存在，需要先创建`,
          data: [],
          collection: null
        };
      }
      
      // 获取拼音练习题总数
      const countResult = await db.collection(collectionName).count()
        .catch(err => {
          console.log(`集合 ${collectionName} 不存在或无法访问:`, err);
          return { total: 0 };
        });
        
      const total = countResult.total || 0;
      
      console.log(`集合 ${collectionName} 中有 ${total} 条记录`);
      
      if (total > 0) {
        // 计算实际获取数量
        const actualLimit = Math.min(limit, total);
        console.log(`将获取 ${actualLimit} 道拼音练习题`);
        
        // 随机获取题目
        // 由于小程序云数据库不支持直接随机获取，我们使用以下策略：
        // 1. 获取所有题目ID
        // 2. 随机选择所需数量的ID
        // 3. 根据选中的ID获取题目详情
        
        // 获取所有题目ID
        const idQuery = await db.collection(collectionName).field({ _id: true }).get();
        const allIds = idQuery.data.map(item => item._id);
        
        // 随机打乱并选择所需数量的ID
        const shuffledIds = allIds.sort(() => 0.5 - Math.random());
        const selectedIds = shuffledIds.slice(0, actualLimit);
        
        // 根据选中的ID获取题目详情
        const quizzes = await db.collection(collectionName).where({
          _id: db.command.in(selectedIds)
        }).get();
        
        console.log(`成功获取 ${quizzes.data.length} 道拼音练习题`);
        
        return {
          code: 0,
          message: `成功从集合 ${collectionName} 获取拼音练习题`,
          data: quizzes.data,
          collection: collectionName
        };
      }
    } catch (error) {
      console.error(`从集合 ${collectionName} 获取拼音练习题失败:`, error);
    }
    
    // 如果没有数据
    return {
      code: 0,
      message: '没有找到拼音练习题数据',
      data: [],
      collection: null
    };
  } catch (error) {
    console.error('获取拼音练习题失败:', error);
    return {
      code: -1,
      message: '获取失败：' + error.message,
      error: error
    };
  }
}

/**
 * 删除单个词语
 * @param {string} wordId 要删除的词语ID
 */
async function deleteWord(wordId) {
  try {
    if (!wordId) {
      return {
        code: 1,
        message: '缺少必要参数：wordId'
      }
    }
    
    const collectionName = 'words_data';
    
    try {
      // 先查询词语是否存在
      const word = await db.collection(collectionName).doc(wordId).get()
        .catch(err => {
          console.log(`在集合 ${collectionName} 中未找到ID为 ${wordId} 的词语:`, err);
          return null;
        });
      
      // 如果找到了词语，就删除它
      if (word && word.data) {
        const result = await db.collection(collectionName).doc(wordId).remove();
        console.log(`成功从集合 ${collectionName} 中删除词语:`, result);
        
        return {
          code: 0,
          message: '删除成功',
          data: result,
          collection: collectionName
        }
      }
    } catch (error) {
      console.error(`从集合 ${collectionName} 删除词语失败:`, error);
    }
    
    // 如果没有找到词语
    return {
      code: 3,
      message: `未找到ID为 ${wordId} 的词语，或删除失败`
    }
  } catch (error) {
    console.error('删除词语失败:', error);
    return {
      code: 4,
      message: '删除失败：' + error.message,
      error: error
    }
  }
}

/**
 * 批量删除词语
 * @param {Array<string>} wordIds 要删除的词语ID数组
 */
async function batchDeleteWords(wordIds) {
  try {
    if (!wordIds || !Array.isArray(wordIds) || wordIds.length === 0) {
      return {
        code: 1,
        message: '缺少必要参数：wordIds 或格式不正确'
      }
    }
    
    const collectionName = 'words_data';
    let totalDeleted = 0;
    
    try {
      console.log(`尝试在集合 ${collectionName} 中删除词语`);
      
      // 先检查集合是否存在词语
      let hasWords = false;
      try {
        // 尝试获取至少一个匹配的词语
        const checkResult = await db.collection(collectionName).where({
          _id: db.command.in(wordIds.slice(0, 1))
        }).get();
        
        if (checkResult.data.length > 0) {
          hasWords = true;
          console.log(`在集合 ${collectionName} 中找到匹配的词语`);
        }
      } catch (err) {
        console.log(`检查集合 ${collectionName} 失败:`, err);
        return {
          code: 2,
          message: `检查集合 ${collectionName} 失败: ${err.message}`
        }; 
      }
      
      if (!hasWords) {
        console.log(`集合 ${collectionName} 中没有要删除的词语，跳过`);
        return {
          code: 3,
          message: '未找到要删除的词语'
        };
      }
      
      // 由于云函数有操作数量限制，需要分批删除
      const tasks = []
      
      // 分批处理删除
      for (let i = 0; i < wordIds.length; i += MAX_LIMIT) {
        const batchIds = wordIds.slice(i, i + MAX_LIMIT)
        
        // 创建删除任务
        const task = db.collection(collectionName).where({
          _id: db.command.in(batchIds)
        }).remove();
        
        tasks.push(task)
      }
      
      // 等待所有删除任务完成
      const results = await Promise.all(tasks)
      
      // 统计删除数量
      results.forEach(result => {
        if (result && result.stats && result.stats.removed) {
          totalDeleted += result.stats.removed;
        }
      });
      
      console.log(`从集合 ${collectionName} 中删除了 ${totalDeleted} 个词语`);
      
      return {
        code: 0,
        message: '批量删除成功',
        deletedCount: totalDeleted,
        results: results
      }
    } catch (error) {
      console.error(`从集合 ${collectionName} 批量删除词语失败:`, error);
      return {
        code: 4,
        message: `批量删除词语失败: ${error.message}`,
        error: error
      };
    }
  } catch (error) {
    console.error('批量删除词语失败:', error)
    return {
      code: 5,
      message: '批量删除失败：' + error.message,
      error: error
    }
  }
}

/**
 * 删除words集合
 */
async function deleteCollection() {
  try {
    const oldCollectionName = 'words';
    
    try {
      // 检查集合是否存在
      const count = await db.collection(oldCollectionName).count()
        .catch(err => {
          console.log(`集合 ${oldCollectionName} 不存在或无法访问:`, err);
          return { total: 0 };
        });
      
      if (count.total === 0) {
        return {
          code: 1,
          message: `集合 ${oldCollectionName} 不存在或已为空`
        };
      }
      
      // 删除集合中的所有文档
      const batchTimes = Math.ceil(count.total / MAX_LIMIT);
      console.log(`需要分 ${batchTimes} 次删除数据`);
      
      for (let i = 0; i < batchTimes; i++) {
        // 获取一批文档ID
        const docs = await db.collection(oldCollectionName)
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get();
        
        if (docs.data.length > 0) {
          const ids = docs.data.map(doc => doc._id);
          
          // 删除这批文档
          await db.collection(oldCollectionName).where({
            _id: db.command.in(ids)
          }).remove();
          
          console.log(`已删除 ${oldCollectionName} 集合中的 ${ids.length} 条记录`);
        }
      }
      
      return {
        code: 0,
        message: `成功清空集合 ${oldCollectionName}`
      };
    } catch (error) {
      console.error(`删除集合 ${oldCollectionName} 失败:`, error);
      return {
        code: 2,
        message: `删除集合失败: ${error.message}`,
        error: error
      };
    }
  } catch (error) {
    console.error('删除集合失败:', error);
    return {
      code: 3,
      message: '删除集合失败：' + error.message,
      error: error
    }
  }
}

/**
 * 保存用户练习结果
 * @param {Object} data 练习结果数据
 */
async function savePracticeResults(data) {
  try {
    if (!data || !data.studentId) {
      return {
        code: 1,
        message: '缺少必要参数：studentId'
      };
    }

    const { studentId, name, stats, practiceResults, wordResults } = data;
    
    // 准备要保存的数据
    const practiceData = {
      studentId,
      name,
      timestamp: new Date(),
      stats: stats || {},
      practiceResults: practiceResults || {},
      wordResults: wordResults || []
    };

    // 保存到practice_history集合
    const result = await db.collection('practice_history').add({
      data: practiceData
    });

    console.log('保存练习结果成功:', result);

    // 更新用户的总体学习统计
    try {
      // 查询用户是否存在
      const userQuery = await db.collection('user_stats').where({
        studentId: studentId
      }).get();

      if (userQuery.data && userQuery.data.length > 0) {
        // 用户存在，更新统计数据
        const userData = userQuery.data[0];
        const userId = userData._id;

        // 准备更新的数据
        const updateData = {
          lastPracticeTime: new Date(),
          totalPractices: (userData.totalPractices || 0) + 1
        };

        // 计算总体正确率
        if (stats && typeof stats.correct === 'number' && typeof stats.total === 'number') {
          const oldCorrect = userData.totalCorrect || 0;
          const oldTotal = userData.totalQuestions || 0;
          
          updateData.totalCorrect = oldCorrect + stats.correct;
          updateData.totalQuestions = oldTotal + stats.total;
          updateData.overallCorrectRate = Math.round((updateData.totalCorrect / updateData.totalQuestions) * 100);
        }

        // 更新用户统计数据
        await db.collection('user_stats').doc(userId).update({
          data: updateData
        });

        console.log('更新用户统计数据成功');
      } else {
        // 用户不存在，创建新记录
        const newUserData = {
          studentId: studentId,
          name: name,
          lastPracticeTime: new Date(),
          totalPractices: 1,
          totalCorrect: stats?.correct || 0,
          totalQuestions: stats?.total || 0,
          overallCorrectRate: stats ? Math.round((stats.correct / stats.total) * 100) : 0
        };

        await db.collection('user_stats').add({
          data: newUserData
        });

        console.log('创建用户统计数据成功');
      }
    } catch (statError) {
      console.error('更新用户统计数据失败:', statError);
      // 但不影响主流程返回结果
    }

    return {
      code: 0,
      message: '保存练习结果成功',
      data: result
    };
  } catch (error) {
    console.error('保存练习结果失败:', error);
    return {
      code: 2,
      message: '保存练习结果失败: ' + error.message,
      error: error
    };
  }
}

/**
 * 更新词汇的音频数据
 */
async function updateWordAudio(event) {
  try {
    const { word, audioFileId, audioFileType } = event;
    
    if (!word || !audioFileId) {
      return {
        code: -1,
        message: '参数错误：缺少词汇名称或文件ID',
        success: false
      };
    }
    
    // 查找词汇数据
    const wordResult = await db.collection('words_data').where({
      word: word
    }).get();
    
    if (!wordResult.data || wordResult.data.length === 0) {
      return {
        code: -1,
        message: '未找到指定的词汇数据',
        success: false
      };
    }
    
    // 更新词汇的音频信息
    const updateResult = await db.collection('words_data').where({
      word: word
    }).update({
      data: {
        audioFileId: audioFileId,
        audioFileType: audioFileType,
        updatedAt: db.serverDate()
      }
    });
    
    return {
      code: 0,
      message: '成功更新词汇音频数据',
      success: true,
      data: updateResult
    };
  } catch (err) {
    return {
      code: -1,
      message: '更新词汇音频数据失败: ' + err.message,
      success: false
    };
  }
} 