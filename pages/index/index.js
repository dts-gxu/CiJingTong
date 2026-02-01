// pages/index/index.js
// 导入词语服务
const wordService = require('../../services/wordService');
const memoryUtil = require('../../utils/memory');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    learningProgress: {
      totalWordsLearned: 0,
      wordsAtStage: [0, 0, 0, 0, 0],
      dailyLearnedCount: 0,
      currentSessionCount: 0
    },
    dailyLimit: 50,
    sessionLimit: 25,
    reviewWords: 0,
    newWords: 0,
    isLoading: false,
    showAdminEntrance: false,
    tapCount: 0,
    updateTimer: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    this.checkLogin();
    
    // 重置点击计数
    this.setData({
      tapCount: 0
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function() {
    this.checkLogin();
    
    // 检查是否需要刷新数据
    const needRefresh = wx.getStorageSync('needRefreshIndex');
    if (needRefresh) {
      console.log('检测到刷新标记，刷新首页数据');
      // 清除刷新标记
      wx.removeStorageSync('needRefreshIndex');
      // 强制刷新数据
      this.loadUserData();
    } else {
      // 正常加载数据
      this.loadUserData();
    }
    
    // 设置定时更新，每30秒刷新一次数据
    this.data.updateTimer = setInterval(() => {
      this.loadUserData();
    }, 30000);
    
    // 上报用户学习数据到后台
    this.reportLearningData();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 清除定时器
    if (this.data.updateTimer) {
      clearInterval(this.data.updateTimer);
    }
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 清除定时器
    if (this.data.updateTimer) {
      clearInterval(this.data.updateTimer);
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    console.log('用户下拉刷新');
    // 重新加载用户数据
    this.loadUserData();
    
    // 上报用户学习数据到后台
    this.reportLearningData();
    
    // 完成刷新
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 检查是否已登录
   */
  checkLogin: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.studentId || !userInfo.name) {
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return false;
    }

    this.setData({
      userInfo: userInfo
    });
    return true;
  },

  /**
   * 加载用户数据
   */
  loadUserData: function() {
    if (!this.checkLogin()) return;

    console.log('加载用户数据');
    // 获取全局应用实例
    const app = getApp();
    
    // 获取学习进度数据
    const learningProgress = app.globalData.learningProgress;
    
    // 先设置一个初始状态，所有计数为0
    this.setData({
      learningProgress,
      reviewWords: 0,
      newWords: 0,
      stats: {
        learnedWords: learningProgress.totalWordsLearned || 0,
        todayLearned: learningProgress.dailyLearnedCount || 0,
        todayTarget: this.data.dailyLimit || 50,
        sessionLearned: learningProgress.currentSessionCount || 0,
        sessionTarget: this.data.sessionLimit || 25,
        stage0Words: 0,
        stage1Words: 0,
        stage2Words: 0,
        stage3Words: 0,
        stage4Words: 0,
        stage5Words: 0,
        reviewWords: 0,
        newWords: 0,
        totalVocabulary: 0
      }
    });
    
    // 计算待复习词语数量
    let reviewWords = 0;
    let newWords = 0;
    
    // 使用异步方式获取词语数据
    wordService.getAllWords().then(words => {
      if (!words || !Array.isArray(words)) {
        console.error('获取词语数据失败或格式不正确:', words);
        words = [];
      }
      
      const wordStatus = app.globalData.wordStatus || {};
      
      words.forEach(word => {
        if (!word || !word.id) return;
        const status = wordStatus[word.id];
        if (status && memoryUtil.isWordDueForReview(status)) {
          reviewWords++;
        } else if (!status) {
          newWords++;
        }
      });
      
      // 获取学习统计数据，包括总词汇量
      wordService.getLearningStats(app).then(stats => {
        // 计算各阶段词语数量
        const stageDistribution = learningProgress.wordsAtStage || [0, 0, 0, 0, 0, 0, 0];
        
        console.log('更新前数据:', {
          reviewWords: this.data.reviewWords,
          newWords: this.data.newWords,
          totalWordsLearned: this.data.learningProgress ? this.data.learningProgress.totalWordsLearned : 0,
          dailyLearnedCount: learningProgress.dailyLearnedCount || 0,
          currentSessionCount: learningProgress.currentSessionCount || 0,
          stageDistribution: this.data.stats ? this.data.stats.stageDistribution : []
        });
        
        // 更新数据
        this.setData({
          learningProgress,
          reviewWords,
          newWords,
          stats: {
            ...stats,
            learnedWords: learningProgress.totalWordsLearned || 0,
            todayLearned: learningProgress.dailyLearnedCount || 0,
            todayTarget: this.data.dailyLimit || 50,
            sessionLearned: learningProgress.currentSessionCount || 0,
            sessionTarget: this.data.sessionLimit || 25,
            stage0Words: stats.stageDistribution ? stats.stageDistribution[0] || 0 : stats.notLearnedWords || 0, // 未学习词语
            stage1Words: stats.stageDistribution ? stats.stageDistribution[1] || 0 : 0,  // 阶段1
            stage2Words: stats.stageDistribution ? stats.stageDistribution[2] || 0 : 0,  // 阶段2
            stage3Words: stats.stageDistribution ? stats.stageDistribution[3] || 0 : 0,  // 阶段3
            stage4Words: stats.stageDistribution ? stats.stageDistribution[4] || 0 : 0,  // 阶段4
            stage5Words: stats.stageDistribution ? stats.stageDistribution[5] || 0 : 0,  // 阶段5
            reviewWords: reviewWords,
            newWords: newWords,
            totalVocabulary: stats.totalWords || 0
          }
        });
        
        console.log('用户数据加载完成', {
          reviewWords,
          newWords,
          totalWordsLearned: learningProgress.totalWordsLearned,
          todayLearned: learningProgress.dailyLearnedCount,
          sessionLearned: learningProgress.currentSessionCount,
          totalVocabulary: stats.totalWords,
          stageDistribution
        });
        
        // 强制页面重新渲染
        this.forceUpdate();
      }).catch(error => {
        console.error('获取学习统计数据失败:', error);
        // 即使获取统计失败，也尝试更新部分数据
        this.setData({
          learningProgress,
          reviewWords,
          newWords
        });
        this.forceUpdate();
      });
    }).catch(error => {
      console.error('获取词语数据失败:', error);
      // 出错时也更新基本数据
      this.setData({
        learningProgress
      });
      this.forceUpdate();
    });
  },

  /**
   * 强制页面更新
   */
  forceUpdate: function() {
    // 使用一个不可见的数据变更来触发页面重新渲染
    this.setData({
      _forceUpdateTimestamp: new Date().getTime()
    });
  },

  /**
   * 开始学习
   */
  startLearning: function() {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    
    // 获取全局应用实例
    const app = getApp();
    
    // 检查学习限制
    const canLearn = memoryUtil.checkLearningLimits(app.globalData.learningProgress);
    if (!canLearn.canLearn) {
      wx.showModal({
        title: '学习限制',
        content: canLearn.message,
        showCancel: false
      });
      this.setData({ isLoading: false });
      return;
    }
    
    // 异步获取下一组学习词语
    wordService.getNextLearningGroup(app).then(nextGroup => {
      if (!nextGroup || !nextGroup.words || nextGroup.words.length === 0) {
        let message = '没有可学习的词语';
        
        // 检查是否是因为达到限制
        if (app.globalData.learningProgress.dailyLearnedCount >= this.data.dailyLimit) {
          message = `今日学习已达上限(${this.data.dailyLimit}词)，请明天再来学习`;
        } else if (app.globalData.learningProgress.currentSessionCount >= this.data.sessionLimit) {
          message = `本次学习已达上限(${this.data.sessionLimit}词)，请休息一下再学习`;
        }
        
        wx.showToast({
          title: message,
          icon: 'none',
          duration: 2000
        });
        this.setData({ isLoading: false });
        return;
      }
      
      // 跳转到学习页面
      wx.navigateTo({
        url: '/pages/learn/learn'
      });
      
      this.setData({ isLoading: false });
    }).catch(error => {
      console.error('获取学习组失败:', error);
      wx.showToast({
        title: '获取学习内容失败，请重试',
        icon: 'none'
      });
      this.setData({ isLoading: false });
    });
  },

  /**
   * 查看统计
   */
  viewStats: function() {
    wx.switchTab({
      url: '/pages/stats/stats'
    });
  },

  /**
   * 显示管理员入口
   */
  showAdminEntrance: function() {
    this.setData({
      tapCount: this.data.tapCount + 1
    });
    
    if (this.data.tapCount >= 2) {
      this.setData({
        showAdminEntrance: true,
        tapCount: 0
      });
      
      wx.showToast({
        title: '管理员入口已显示',
        icon: 'none',
        duration: 1500
      });
    }
  },

  /**
   * 上报学习数据到后台
   */
  reportLearningData: function() {
    if (!this.data.userInfo) return;
    
    const app = getApp();
    
    // 准备要上报的数据
    const reportData = {
      studentId: this.data.userInfo.studentId,
      name: this.data.userInfo.name,
      timestamp: new Date().toISOString(),
      action: 'page_view',
      totalWordsLearned: app.globalData.learningProgress.totalWordsLearned || 0,
      dailyLearnedCount: app.globalData.learningProgress.dailyLearnedCount || 0,
      stageDistribution: app.globalData.learningProgress.wordsAtStage || [0, 0, 0, 0, 0, 0, 0],
      reviewWords: this.data.reviewWords,
      newWords: this.data.newWords,
      totalVocabulary: this.data.stats ? this.data.stats.totalWords : 0
    };
    
    console.log('上报学习数据', reportData);
    
    // 调用云函数上报数据
    wx.cloud.callFunction({
      name: 'reportLearningData',
      data: reportData,
      success: res => {
        console.log('数据上报成功', res);
      },
      fail: err => {
        console.error('数据上报失败', err);
      }
    });
  },

  /**
   * 触发管理员入口
   */
  tapAdminEntrance: function() {
    console.log('管理员入口被点击');
    
    // 更新点击计数
    let currentTapCount = this.data.tapCount + 1;
    console.log('当前点击次数:', currentTapCount);
    
    this.setData({
      tapCount: currentTapCount
    });
    
    // 显示点击反馈
    wx.showToast({
      title: '再点击' + (5 - currentTapCount) + '次进入管理模式',
      icon: 'none',
      duration: 500
    });
    
    // 5次点击后显示管理员入口
    if (currentTapCount >= 5) {
      console.log('达到5次点击，显示管理员选项');
      wx.showActionSheet({
        itemList: ['管理员登录', '清除数据重置'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 跳转到管理员登录页
            console.log('用户选择了管理员登录');
            
            // 检查是否已经有有效的管理员登录
            const adminInfo = wx.getStorageSync('adminInfo');
            if (adminInfo && adminInfo.isLoggedIn && adminInfo.username === 'admin') {
              // 已有有效管理员登录，直接跳转到管理员页面
              wx.navigateTo({
                url: '/pages/admin/admin',
                fail: (err) => {
                  console.error('跳转到管理员页面失败:', err);
                  wx.showToast({
                    title: '页面跳转失败: ' + err.errMsg,
                    icon: 'none'
                  });
                }
              });
            } else {
              // 没有管理员登录，先跳转到登录页面
              wx.navigateTo({
                url: '/pages/login/login',
                success: () => {
                  wx.showToast({
                    title: '请输入管理员账号密码',
                    icon: 'none'
                  });
                },
                fail: (err) => {
                  console.error('跳转到登录页面失败:', err);
                  wx.showToast({
                    title: '页面跳转失败',
                    icon: 'none'
                  });
                }
              });
            }
          } else if (res.tapIndex === 1) {
            // 提示用户确认是否清除数据
            wx.showModal({
              title: '确认重置',
              content: '这将清除所有学习数据，确定要继续吗？',
              success: (res) => {
                if (res.confirm) {
                  // 调用全局重置函数
                  const app = getApp();
                  if (wx.resetUserData) {
                    wx.resetUserData();
                  } else {
                    wx.showToast({
                      title: '重置功能未定义',
                      icon: 'none'
                    });
                  }
                }
              }
            });
          }
        },
        fail: (res) => {
          console.error('显示操作菜单失败:', res.errMsg);
          wx.showToast({
            title: '操作失败: ' + res.errMsg,
            icon: 'none'
          });
        }
      });
      
      // 重置点击计数
      this.setData({
        tapCount: 0
      });
    }
  },
})