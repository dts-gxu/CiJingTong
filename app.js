const memoryUtil = require('./utils/memory');
const cloudImageConfig = require('./utils/cloudImageConfig');
const imageOptimizer = require('./utils/imageOptimizer');

App({
  globalData: {
    userInfo: null,
    learningProgress: {
      totalWordsLearned: 0,
      wordsAtStage: [0, 0, 0, 0, 0],
      dailyLearnedCount: 0,
      currentSessionCount: 0,
      lastLearnDate: null
    },
    currentGroup: {
      words: [],
      progress: 0,
      mode: 'learn',
      results: [],
    },
    wordStatus: {},
    lastSyncTime: null,
    cloudImages: cloudImageConfig.wordImages,
    cloudImagesBase: cloudImageConfig.cloudImagesBase,
    getWordImagePath: cloudImageConfig.getWordImagePath,
    imageOptimizer: imageOptimizer
  },

  onLaunch: function() {
    console.log('应用启动');
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true,
      });
    }
    
    this.loadUserInfo();
    this.loadUserData();
    memoryUtil.resetDailyCount(this.globalData.learningProgress);
    this.setupAutoSave();
    this.initGlobalData();
    setTimeout(() => {
      this.updateLearningProgress().then(() => {
        wx.setStorageSync('needRefreshIndex', true);
      }).catch(err => {
        console.error('更新学习进度失败:', err);
      });
    }, 2000);

    this.optimizeWordImages();

    wx.resetUserData = () => {
      if (!this.globalData.userInfo || !this.globalData.userInfo.studentId) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }
      
      // 保存当前用户ID
      const studentId = this.globalData.userInfo.studentId;
      
      this.initGlobalData();
      this.globalData.learningProgress = {
        totalWordsLearned: 0,
        wordsAtStage: [0, 0, 0, 0, 0],
        dailyLearnedCount: 0,
        currentSessionCount: 0,
        lastLearnDate: new Date().toDateString()
      };
      this.globalData.wordStatus = {};
      
      // 清空本地存储的用户数据
      wx.removeStorageSync('userData_' + studentId);
      
      // 清空云端用户数据
      this.saveUserData();
      
      wx.showToast({
        title: '用户数据已重置',
        icon: 'success'
      });
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }, 1500);
    };
  },
  
  setupAutoSave: function() {
    setInterval(() => this.saveUserData(), 60000);
  },
  
  loadUserInfo: function() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) this.globalData.userInfo = userInfo;
    } catch (e) {
      console.error('加载用户信息失败:', e);
    }
  },

  // 加载用户学习数据
  loadUserData: function() {
    try {
      // 首先检查用户是否已登录
      const userInfo = this.globalData.userInfo;
      if (!userInfo || !userInfo.studentId) {
        // console.log('用户未登录，无法加载数据');
        return;
      }
      
      const studentId = userInfo.studentId;
      
      // 先重置数据，确保不会混合不同用户的数据
      this.globalData.learningProgress = {
        totalWordsLearned: 0,
        wordsAtStage: [0, 0, 0, 0, 0],
        dailyLearnedCount: 0,
        currentSessionCount: 0,
        lastLearnDate: null
      };
      this.globalData.wordStatus = {};
      this.globalData.lastSyncTime = null;
      
      // 本地临时存储时加上用户ID前缀，确保不同用户数据隔离
      const userData = wx.getStorageSync('userData_' + studentId);
      if (userData) {
        // 加载保存的学习进度
        this.globalData.learningProgress = {
          ...this.globalData.learningProgress,
          totalWordsLearned: userData.learningProgress?.totalWordsLearned || 0,
          wordsAtStage: userData.learningProgress?.wordsAtStage || [0, 0, 0, 0, 0],
          dailyLearnedCount: userData.learningProgress?.dailyLearnedCount || 0,
          currentSessionCount: userData.learningProgress?.currentSessionCount || 0,
          lastLearnDate: userData.learningProgress?.lastLearnDate || null
        };
        
        this.globalData.wordStatus = userData.wordStatus || {};
        this.globalData.lastSyncTime = userData.lastSyncTime || null;
      }
      
      // 如果用户已登录，从云端获取最新数据
      if (this.globalData.userInfo && this.globalData.userInfo.studentId) {
        this.loadUserDataFromCloud();
      }
    } catch (e) {
      console.error('加载用户学习数据失败:', e);
    }
  },
  
  // 从云端获取用户学习数据
  loadUserDataFromCloud: function() {
    if (!this.globalData.userInfo || !this.globalData.userInfo.studentId) {
              // console.log('用户未登录，无法从云端获取数据');
      return;
    }
    
    const studentId = this.globalData.userInfo.studentId;
    
    // 调用云函数获取用户数据
    wx.cloud.callFunction({
      name: 'getUserData',
      data: {
        studentId: studentId
      },
      success: res => {
        
        if (res.result && res.result.data) {
          const cloudData = res.result.data;
          
          // 确保数据属于当前登录用户
          if (cloudData.studentId !== studentId) {
            console.error('云端数据与当前用户不匹配，拒绝加载');
            return;
          }
          
          // 合并云端数据和本地数据，使用最新的版本
          const localLastSync = this.globalData.lastSyncTime ? new Date(this.globalData.lastSyncTime) : new Date(0);
          const cloudLastSync = cloudData.lastSyncTime ? new Date(cloudData.lastSyncTime) : new Date(0);
          
          if (cloudLastSync > localLastSync) {
            if (cloudData.learningProgress) this.globalData.learningProgress = cloudData.learningProgress;
            if (cloudData.wordStatus) this.globalData.wordStatus = cloudData.wordStatus;
            this.globalData.lastSyncTime = cloudData.lastSyncTime;
            wx.setStorageSync('userData_' + studentId, {
              learningProgress: this.globalData.learningProgress,
              wordStatus: this.globalData.wordStatus,
              lastSyncTime: this.globalData.lastSyncTime
            });
          }
        }
      },
      fail: err => {
        console.error('从云端获取用户数据失败', err);
      }
    });
  },

  saveUserData: function() {
    try {
      const userInfo = this.globalData.userInfo;
      if (!userInfo || !userInfo.studentId) return;
      
      const studentId = userInfo.studentId;
      wx.setStorageSync('userData_' + studentId, {
        learningProgress: this.globalData.learningProgress,
        wordStatus: this.globalData.wordStatus,
        lastSyncTime: new Date().toISOString()
      });
      
      if (this.globalData.userInfo?.studentId) this.saveUserDataToCloud();
    } catch (e) {
      console.error('保存数据失败:', e);
    }
  },
  
  saveUserDataToCloud: function() {
    if (!this.globalData.userInfo?.studentId) return;
    
    const { studentId, name } = this.globalData.userInfo;
    const currentTime = new Date().toISOString();
    
    let totalReviews = 0, correctReviews = 0;
    Object.values(this.globalData.wordStatus || {}).forEach(status => {
      if (status?.reviews) {
        totalReviews += status.reviews;
        correctReviews += status.correctReviews || 0;
      }
    });
    
    wx.cloud.callFunction({
      name: 'saveUserData',
      data: {
        studentId, name,
        learningProgress: this.globalData.learningProgress,
        wordStatus: this.globalData.wordStatus,
        lastSyncTime: currentTime,
        stats: {
          totalWordsLearned: this.globalData.learningProgress.totalWordsLearned || 0,
          correctRate: totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0,
          wordsAtStage: this.globalData.learningProgress.wordsAtStage || [0, 0, 0, 0, 0],
          lastUpdateTime: currentTime
        }
      },
      success: () => { this.globalData.lastSyncTime = currentTime; },
      fail: err => console.error('保存到云端失败', err)
    });
  },

  getWordsDataFromCloud: function() {
    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'getWordsData',
        success: res => {
          resolve(res.result?.data?.length > 0 ? res.result.data : []);
        },
        fail: () => resolve([])
      });
    });
  },

  ensureCurrentGroup: function() {
    // 如果当前学习组不存在或为空，创建一个新的
    if (!this.globalData.currentGroup || !this.globalData.currentGroup.words || this.globalData.currentGroup.words.length === 0) {
      console.log('创建新的学习组');
      const wordService = require('./services/wordService');
      wordService.getNextLearningGroup(this).then(nextGroup => {
        return nextGroup;
      }).catch(error => {
        console.error('创建学习组失败:', error);
        return null;
      });
    }
    
    return this.globalData.currentGroup;
  },

  // 同步用户数据到服务器
  syncUserData: async function() {
    // 检查用户信息
    if (!this.globalData.userInfo || !this.globalData.userInfo.studentId) {
              // console.error('同步用户数据失败：用户未登录');
      return false;
    }
    
    try {
      // 确保有词语状态和学习进度
      if (!this.globalData.wordStatus) {
        this.globalData.wordStatus = {};
      }
      
      if (!this.globalData.learningProgress) {
        this.initLearningProgress();
      }
      
      // 更新学习进度数据
      await this.updateLearningProgress();
      
      // 调用云函数保存用户数据
      const result = await wx.cloud.callFunction({
        name: 'saveUserData',
        data: {
          studentId: this.globalData.userInfo.studentId,
          name: this.globalData.userInfo.name,
          learningProgress: this.globalData.learningProgress,
          wordStatus: this.globalData.wordStatus,
          lastSyncTime: new Date().toISOString()
        }
      });
      
      console.log('同步用户数据成功:', result);
      return true;
    } catch (error) {
      console.error('同步用户数据失败:', error);
      return false;
    }
  },
  
  // 更新学习进度数据
  updateLearningProgress: async function() {
    // 确保词语状态存在
    if (!this.globalData.wordStatus) {
      this.globalData.wordStatus = {};
    }
    
    // 确保学习进度存在
    if (!this.globalData.learningProgress) {
      this.initLearningProgress();
    }
    
    const learningProgress = this.globalData.learningProgress;
    const wordStatus = this.globalData.wordStatus;
    
    // 重新计算已学习词语总数
    const learnedWords = Object.keys(wordStatus);
    learningProgress.totalWordsLearned = learnedWords.length;
    
    // 更新阶段分布
    const stageDistribution = [0, 0, 0, 0, 0, 0];
    
    // 遍历所有词语状态
    for (const wordId in wordStatus) {
      const status = wordStatus[wordId];
      if (!status) continue;
      
      const stage = status.stage || 0;
      if (stage >= 0 && stage < stageDistribution.length) {
        stageDistribution[stage]++;
      }
    }
    
    // 更新阶段分布
    learningProgress.wordsAtStage = stageDistribution;
    
    // 获取词汇总量
    try {
      const countResult = await wx.cloud.callFunction({
        name: 'getWordsStats'
      });
      
      if (countResult && countResult.result && countResult.result.totalCount) {
        learningProgress.totalVocabulary = countResult.result.totalCount;
      }
    } catch (error) {
      console.error('获取词汇总量失败:', error);
    }
    
    return learningProgress;
  },

  // 优化词语图片路径，使用云存储路径
  optimizeWordImages: function() {
    // 检查当前组中的词语是否使用了云存储路径
    if (this.globalData.currentGroup && this.globalData.currentGroup.words) {
      const words = this.globalData.currentGroup.words;
      
      // 遍历词语，将本地图片路径转换为云存储路径
      words.forEach(word => {
        if (word.imagePath && !imageOptimizer.isCloudPath(word.imagePath)) {
          // 转换为云存储路径
          word.imagePath = imageOptimizer.convertToCloudPath(word.imagePath);
        } else if (word.word && !word.imagePath) {
          // 如果没有图片路径，但有词语，则设置默认的云存储路径
          word.imagePath = imageOptimizer.getWordImagePath(word.word);
        }
      });
    }
  }
}); 