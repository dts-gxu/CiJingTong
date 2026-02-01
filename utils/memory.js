/**
 * 艾宾浩斯记忆曲线工具类
 * 实现基于艾宾浩斯记忆曲线的词语学习调度算法
 */

// 复习间隔（分钟）：30分钟、1天、3天、7天、15天、30天
const REVIEW_INTERVALS = [30, 1440, 4320, 10080, 21600, 43200];

// 获取用户设置的学习目标
function getUserLearningLimits() {
  try {
    const userSettings = wx.getStorageSync('userSettings') || {};
    return {
      dailyLimit: userSettings.dailyTarget || 20,
      sessionLimit: userSettings.sessionTarget || 10
    };
  } catch (error) {
    console.error('获取用户设置失败:', error);
    return {
      dailyLimit: 20,
      sessionLimit: 10
    };
  }
}

// 默认限制（备用）
const DEFAULT_DAILY_LIMIT = 20;
const DEFAULT_SESSION_LIMIT = 10;

/**
 * 计算下次复习时间
 * @param {Number} currentStage 当前记忆阶段
 * @returns {Date} 下次复习时间
 */
function calculateNextReviewTime(currentStage) {
  const minutes = REVIEW_INTERVALS[currentStage - 1] || REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * 更新词语记忆状态
 * @param {Object} wordStatus 词语状态对象
 * @param {String} wordId 词语ID
 * @param {Boolean} isCorrect 是否回答正确
 * @returns {Object} 更新后的状态对象
 */
function updateWordMemoryStatus(wordStatus, wordId, isCorrect) {
  // 参数有效性检查
  if (!wordStatus || !wordId) {
    console.error('updateWordMemoryStatus参数无效:', { wordStatus: !!wordStatus, wordId });
    return null;
  }
  
  // 获取当前词语状态，如果不存在则初始化
  const status = wordStatus[wordId] || {
    stage: 0,
    nextReviewTime: null,
    reviews: 0,
    correctReviews: 0,
    lastReviewTime: null,
    firstLearnTime: null  // 首次学习时间
  };
  
  // 更新复习次数
  status.reviews = (status.reviews || 0) + 1;
  
  // 记录之前的阶段
  const previousStage = status.stage || 0;
  
  // 如果是首次学习（阶段0），记录首次学习时间
  if (status.stage === 0) {
    status.firstLearnTime = new Date();
  }
  
  // 更新正确复习次数
  if (isCorrect) {
    status.correctReviews = (status.correctReviews || 0) + 1;
    
    // 如果回答正确，进入下一个记忆阶段（最高为5）
    status.stage = Math.min(5, status.stage + 1);
  } else {
    // 如果回答错误，维持原阶段（不退回）
    // 但如果是首次学习（阶段0），仍需要进入阶段1以开始复习循环
    if (status.stage === 0) {
      status.stage = 1;
    }
    // 其他阶段保持不变
  }
  
  // 计算下次复习时间
  // 如果是首次学习完成（从阶段0到阶段1），30分钟后复习
  if (previousStage === 0 && status.stage === 1) {
    status.nextReviewTime = new Date(Date.now() + 30 * 60 * 1000); // 30分钟后
  } else {
    status.nextReviewTime = calculateNextReviewTime(status.stage);
  }
  
  // 更新最后复习时间
  status.lastReviewTime = new Date();
  
  // 保存更新后的状态
  wordStatus[wordId] = status;
  
  // 返回更新后的状态，包含之前的阶段信息
  return {
    ...status,
    previousStage
  };
}

/**
 * 检查词语是否到期需要复习
 * @param {Object} word 词语对象
 * @returns {Boolean} 是否需要复习
 */
function isWordDueForReview(status) {
  if (!status || !status.nextReviewTime) return false;
  
  // 如果下次复习时间已过，则需要复习
  const now = new Date();
  const nextReviewTime = new Date(status.nextReviewTime);
  
  return now >= nextReviewTime;
}

/**
 * 选择下一组学习词语
 * @param {Array} allWords 所有词语
 * @param {Object} userWordStatus 用户词语状态
 * @param {Number} groupSize 组大小
 * @param {Object} userProgress 用户学习进度
 * @returns {Object} 下一组学习词语
 */
function selectNextLearningGroup(allWords, userWordStatus, groupSize, userProgress) {
  // 获取用户设置的学习限制
  const limits = getUserLearningLimits();
  
  // 检查用户学习进度，确保不会超出限制
  if (userProgress) {
    // 计算剩余可学习的词语数量
    const remainingDaily = limits.dailyLimit - (userProgress.dailyLearnedCount || 0);
    const remainingSession = limits.sessionLimit - (userProgress.currentSessionCount || 0);
    const remaining = Math.min(remainingDaily, remainingSession);
    
    // 如果剩余数量小于请求的组大小，则调整组大小
    if (remaining < groupSize) {
      console.log(`调整学习组大小：从${groupSize}到${remaining}，以符合学习限制`);
      groupSize = Math.max(0, remaining);
    }
    
    // 如果没有剩余可学习的词语，直接返回空组
    if (groupSize <= 0) {
      console.log('已达到学习限制，无法获取更多词语');
      return {
        words: [],
        reviewCount: 0,
        newCount: 0
      };
    }
  }

  // 确保allWords是数组
  if (!allWords || !Array.isArray(allWords)) {
    console.error('词语数据无效:', allWords);
    return {
      words: [],
      reviewCount: 0,
      newCount: 0
    };
  }

  // 确保userWordStatus是对象
  if (!userWordStatus || typeof userWordStatus !== 'object') {
    console.error('用户词语状态无效:', userWordStatus);
    userWordStatus = {};
  }

  // 分类词语：待复习的和新的
  const reviewWords = [];
  const newWords = [];
  
  allWords.forEach(word => {
    // 确保word对象有效且有id属性
    if (!word || !word.id) {
      console.warn('无效的词语对象:', word);
      return;
    }
    
    const status = userWordStatus[word.id];
    
    if (status && isWordDueForReview(status)) {
      // 到期需要复习的词
      reviewWords.push({
        ...word,
        status: status
      });
    } else if (!status) {
      // 新词
      newWords.push(word);
    }
  });
  
  // 按照记忆阶段排序复习词，优先复习较低阶段的词
  reviewWords.sort((a, b) => {
    if (!a.status || !b.status) return 0;
    return a.status.stage - b.status.stage;
  });
  
  // 按照rank排序新词
  newWords.sort((a, b) => {
    if (!a.rank && !b.rank) return 0;
    if (!a.rank) return 1;
    if (!b.rank) return -1;
    return a.rank - b.rank;
  });
  
  // 组合下一组学习词语：60%新词 + 40%复习词
  const nextGroup = [];
  let reviewCount = 0;
  let newCount = 0;
  
  // 计算新词和复习词的目标数量
  const targetNewCount = Math.ceil(groupSize * 0.6);  // 60%新词
  const targetReviewCount = groupSize - targetNewCount;  // 40%复习词
  
  // 先添加复习词（从不同记忆阶段随机选取，避免同一阶段集中）
  const reviewWordsByStage = {};
  reviewWords.forEach(word => {
    const stage = word.status?.stage || 1;
    if (!reviewWordsByStage[stage]) {
      reviewWordsByStage[stage] = [];
    }
    reviewWordsByStage[stage].push(word);
  });
  
  // 从不同阶段随机选取复习词
  const stages = Object.keys(reviewWordsByStage).sort((a, b) => parseInt(a) - parseInt(b));
  let stageIndex = 0;
  
  while (reviewCount < targetReviewCount && reviewCount < reviewWords.length) {
    const stage = stages[stageIndex % stages.length];
    if (reviewWordsByStage[stage] && reviewWordsByStage[stage].length > 0) {
      nextGroup.push(reviewWordsByStage[stage].shift());
      reviewCount++;
    }
    stageIndex++;
    
    // 如果所有阶段都遍历完了，重新开始
    if (stageIndex >= stages.length * 10) break; // 防止无限循环
  }
  
  // 再添加新词
  while (newCount < targetNewCount && newWords.length > 0) {
    nextGroup.push(newWords.shift());
    newCount++;
  }
  
  // 如果还有剩余空间，继续添加可用的词语
  while (nextGroup.length < groupSize) {
    if (reviewWords.length > 0) {
      nextGroup.push(reviewWords.shift());
      reviewCount++;
    } else if (newWords.length > 0) {
      nextGroup.push(newWords.shift());
      newCount++;
    } else {
      break;
    }
  }
  
  // 打乱顺序，避免记忆阶段集中
  shuffleArray(nextGroup);
  
  return {
    words: nextGroup,
    reviewCount,
    newCount
  };
}

/**
 * 检查学习限制
 * @param {Object} userProgress 用户学习进度
 * @returns {Object} 检查结果
 */
function checkLearningLimits(userProgress) {
  // 确保userProgress对象存在
  if (!userProgress) {
    console.error('用户学习进度对象不存在');
    return {
      canLearn: false,
      message: '无法获取学习进度，请重新登录'
    };
  }
  
  // 获取用户设置的学习限制
  const limits = getUserLearningLimits();
  
  // 重置每日计数（如果是新的一天）
  resetDailyCount(userProgress);
  
  // 获取当前计数
  const dailyCount = userProgress.dailyLearnedCount || 0;
  const sessionCount = userProgress.currentSessionCount || 0;
  
  console.log('检查学习限制:', {
    dailyCount,
    dailyLimit: limits.dailyLimit,
    sessionCount,
    sessionLimit: limits.sessionLimit
  });
  
  // 严格检查：如果已经达到或超过限制，不允许继续学习
  if (dailyCount >= limits.dailyLimit) {
    return {
      canLearn: false,
      message: `今日学习已达上限(${limits.dailyLimit}词)，请明天再来学习`
    };
  }
  
  if (sessionCount >= limits.sessionLimit) {
    return {
      canLearn: false,
      message: `本次学习已达上限(${limits.sessionLimit}词)，请休息一下再学习`
    };
  }
  
  // 检查剩余可学习数量
  const remainingDaily = limits.dailyLimit - dailyCount;
  const remainingSession = limits.sessionLimit - sessionCount;
  const remaining = Math.min(remainingDaily, remainingSession);
  
  if (remaining <= 0) {
    return {
      canLearn: false,
      message: `学习限制已达上限，请稍后再试`
    };
  }
  
  return {
    canLearn: true,
    remainingCount: remaining
  };
}

/**
 * 重置每日学习计数
 * @param {Object} userProgress 用户学习进度
 */
function resetDailyCount(userProgress) {
  const today = new Date().toISOString().split('T')[0];
  const lastLearnDate = userProgress.lastLearnDate;
  
  if (lastLearnDate !== today) {
    userProgress.dailyLearnedCount = 0;
    userProgress.currentSessionCount = 0;
    userProgress.lastLearnDate = today;
  }
}

/**
 * 打乱数组顺序
 * @param {Array} array 要打乱的数组
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

module.exports = {
  calculateNextReviewTime,
  updateWordMemoryStatus,
  isWordDueForReview,
  selectNextLearningGroup,
  checkLearningLimits,
  resetDailyCount,
  shuffleArray,
  getUserLearningLimits,
  DEFAULT_DAILY_LIMIT,
  DEFAULT_SESSION_LIMIT
}; 