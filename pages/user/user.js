// pages/user/user.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      name: '',
      studentId: '',
      avatar: '/images/avatar_placeholder.png'
    },
    // 学习偏好设置
    learningSettings: {
      dailyTarget: 20,        // 每日学习目标
      sessionTarget: 10,      // 每次学习目标
      reviewReminder: true,   // 复习提醒
      soundEnabled: true,     // 声音开关
      practiceMode: 'mixed'   // 练习模式：pinyin/fillBlank/mixed
    },
    // 数据统计概览（简化版，不与首页重复）
    quickStats: {
      todayStreak: 0,         // 今日连续学习天数
      totalDays: 0,           // 累计学习天数
      currentStage: 'beginner' // 当前水平：beginner/intermediate/advanced
    },
    // 最近复习提醒
    reviewReminders: [],
    // 成就系统
    achievements: [],
    // 全部成就弹窗
    showAllAchievements: false,
    allAchievementsList: [],
    achievementStats: {
      unlockedCount: 0,
      totalCount: 0,
      progress: 0
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo();
    this.loadUserSettings();
    this.loadQuickStats();
    this.loadReviewReminders();
    this.loadAchievements();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadUserInfo();
    this.loadQuickStats();
    this.loadReviewReminders();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadUserInfo();
    this.loadUserSettings();
    this.loadQuickStats();
    this.loadReviewReminders();
    this.loadAchievements();
    wx.stopPullDownRefresh();
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
   * 加载用户信息
   */
  loadUserInfo: function() {
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    
    this.setData({
      userInfo: {
        name: userInfo.name || '未登录',
        studentId: userInfo.studentId || '',
        avatar: userInfo.avatar || '/images/avatar_placeholder.png'
      }
    });
  },

  /**
   * 加载用户设置
   */
  loadUserSettings: function() {
    try {
      const settings = wx.getStorageSync('userSettings') || {};
      this.setData({
        learningSettings: {
          dailyTarget: settings.dailyTarget || 20,
          sessionTarget: settings.sessionTarget || 10,
          reviewReminder: settings.reviewReminder !== false,
          soundEnabled: settings.soundEnabled !== false,
          practiceMode: settings.practiceMode || 'mixed'
        }
      });
    } catch (error) {
      console.error('加载用户设置失败:', error);
    }
  },

  /**
   * 保存用户设置
   */
  saveUserSettings: function() {
    try {
      wx.setStorageSync('userSettings', this.data.learningSettings);
      wx.showToast({
        title: '设置已保存',
        icon: 'success'
      });
    } catch (error) {
      console.error('保存用户设置失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * 加载快速统计（非重复的简化统计）
   */
  loadQuickStats: function() {
    const app = getApp();
    const learningProgress = app.globalData.learningProgress || {};
    
    // 计算今日是否已学习
    const today = new Date().toDateString();
    const lastLearnDate = learningProgress.lastLearnDate;
    
    // 检查今日是否有学习记录
    const dailyCount = learningProgress.dailyLearnedCount || 0;
    const todayStreak = (lastLearnDate === today && dailyCount > 0) ? 1 : 0;
    
    // 计算总学习天数
    let learningDays = wx.getStorageSync('learningDays') || [];
    if (!Array.isArray(learningDays)) {
      learningDays = [];
    }
    
    // 如果今天学习了但不在记录中，添加今天
    if (todayStreak && !learningDays.includes(today)) {
      learningDays.push(today);
      wx.setStorageSync('learningDays', learningDays);
    }
    
    const totalDays = learningDays.length;
    
    // 根据学习词汇数判断当前水平
    const totalLearned = learningProgress.totalWordsLearned || 0;
    let currentStage = 'beginner';
    if (totalLearned >= 500) {
      currentStage = 'advanced';
    } else if (totalLearned >= 200) {
      currentStage = 'intermediate';
    }
    
    this.setData({
      quickStats: {
        todayStreak,
        totalDays,
        currentStage
      }
    });
    
    console.log('快速统计加载完成:', {
      今日打卡: todayStreak,
      累计天数: totalDays,
      当前水平: currentStage,
      今日学习数: dailyCount,
      最后学习日期: lastLearnDate
    });
  },

  /**
   * 加载复习提醒
   */
  loadReviewReminders: function() {
    // 检查复习提醒是否开启
    if (this.data.learningSettings.reviewReminder === false) {
      this.setData({
        reviewReminders: []
      });
      return;
    }
    
    const app = getApp();
    const userWordStatus = app.globalData.wordStatus || {};
    const memoryUtil = require('../../utils/memory');
    
    const reminders = [];
    const now = new Date();
    
    Object.entries(userWordStatus).forEach(([wordId, status]) => {
      if (status && status.nextReviewTime) {
        const reviewTime = new Date(status.nextReviewTime);
        if (reviewTime <= now) {
          reminders.push({
            wordId,
            stage: status.stage,
            overdue: Math.floor((now - reviewTime) / (1000 * 60 * 60)) // 超期小时数
          });
        }
      }
    });
    
    // 按阶段排序，优先显示低阶段的词
    reminders.sort((a, b) => a.stage - b.stage);
    
    this.setData({
      reviewReminders: reminders.slice(0, 5) // 只显示前5个
    });
    
    console.log('复习提醒加载完成:', {
      总词语状态数: Object.keys(userWordStatus).length,
      待复习词语数: reminders.length,
      显示的提醒数: Math.min(reminders.length, 5)
    });
  },

  /**
   * 加载成就系统
   */
  loadAchievements: function() {
    const app = getApp();
    const learningProgress = app.globalData.learningProgress || {};
    const totalLearned = learningProgress.totalWordsLearned || 0;
    
    const achievements = [
      {
        id: 'first_word',
        title: '初学者',
        description: '学习第一个词语',
        unlocked: totalLearned >= 1,
        icon: '🌱'
      },
      {
        id: 'five_words',
        title: '萌芽',
        description: '学习5个词语',
        unlocked: totalLearned >= 5,
        icon: '🌿'
      },
      {
        id: 'ten_words',
        title: '起步者',
        description: '学习10个词语',
        unlocked: totalLearned >= 10,
        icon: '🚀'
      },
      {
        id: 'twenty_words',
        title: '坚持者',
        description: '学习20个词语',
        unlocked: totalLearned >= 20,
        icon: '💪'
      },
      {
        id: 'thirty_words',
        title: '勤奋者',
        description: '学习30个词语',
        unlocked: totalLearned >= 30,
        icon: '📚'
      },
      {
        id: 'fifty_words',
        title: '进步者',
        description: '学习50个词语',
        unlocked: totalLearned >= 50,
        icon: '⭐'
      },
      {
        id: 'seventy_words',
        title: '努力者',
        description: '学习70个词语',
        unlocked: totalLearned >= 70,
        icon: '🔥'
      },
      {
        id: 'hundred_words',
        title: '学习达人',
        description: '学习100个词语',
        unlocked: totalLearned >= 100,
        icon: '🏆'
      },
      {
        id: 'onethirty_words',
        title: '词汇高手',
        description: '学习130个词语',
        unlocked: totalLearned >= 130,
        icon: '🎖️'
      },
      {
        id: 'onefifty_words',
        title: '语言天才',
        description: '学习150个词语',
        unlocked: totalLearned >= 150,
        icon: '🧠'
      },
      {
        id: 'twohundred_words',
        title: '词汇大师',
        description: '学习200个词语',
        unlocked: totalLearned >= 200,
        icon: '👑'
      },
      {
        id: 'twofifty_words',
        title: '语言专家',
        description: '学习250个词语',
        unlocked: totalLearned >= 250,
        icon: '🎓'
      },
      {
        id: 'threehundred_words',
        title: '词汇精英',
        description: '学习300个词语',
        unlocked: totalLearned >= 300,
        icon: '💎'
      },
      {
        id: 'threefifty_words',
        title: '语言宗师',
        description: '学习350个词语',
        unlocked: totalLearned >= 350,
        icon: '🌟'
      },
      {
        id: 'daily_target',
        title: '今日目标',
        description: '完成今日学习目标',
        unlocked: (learningProgress.dailyLearnedCount || 0) >= (this.data.learningSettings.dailyTarget || 20),
        icon: '🎯'
      },
      {
        id: 'three_days',
        title: '三日坚持',
        description: '连续学习3天',
        unlocked: this.data.quickStats.totalDays >= 3,
        icon: '📅'
      },
      {
        id: 'seven_days',
        title: '一周达成',
        description: '累计学习7天',
        unlocked: this.data.quickStats.totalDays >= 7,
        icon: '🗓️'
      },
      {
        id: 'fifteen_days',
        title: '半月坚持',
        description: '累计学习15天',
        unlocked: this.data.quickStats.totalDays >= 15,
        icon: '⏰'
      },
      {
        id: 'thirty_days',
        title: '月度学霸',
        description: '累计学习30天',
        unlocked: this.data.quickStats.totalDays >= 30,
        icon: '🏅'
      },
      {
        id: 'sixty_days',
        title: '学习狂人',
        description: '累计学习60天',
        unlocked: this.data.quickStats.totalDays >= 60,
        icon: '🔥'
      },
      {
        id: 'hundred_days',
        title: '百日筑基',
        description: '累计学习100天',
        unlocked: this.data.quickStats.totalDays >= 100,
        icon: '💯'
      }
    ];
    
    // 优化显示：只显示最相关的成就
    const displayAchievements = this.filterDisplayAchievements(achievements);
    
    this.setData({
      achievements: displayAchievements
    });
  },

  /**
   * 筛选要显示的成就
   */
  filterDisplayAchievements: function(allAchievements) {
    const wordAchievements = allAchievements.filter(a => 
      a.id.includes('words') || a.id === 'first_word'
    );
    const dayAchievements = allAchievements.filter(a => 
      a.id.includes('days') || a.id.includes('target')
    );
    
    const result = [];
    
    // 词汇成就：显示最高已获得 + 下一个待解锁
    const unlockedWordAchievements = wordAchievements.filter(a => a.unlocked);
    const lockedWordAchievements = wordAchievements.filter(a => !a.unlocked);
    
    if (unlockedWordAchievements.length > 0) {
      // 显示最高的已解锁词汇成就
      result.push(unlockedWordAchievements[unlockedWordAchievements.length - 1]);
    }
    
    if (lockedWordAchievements.length > 0) {
      // 显示下一个待解锁的词汇成就
      result.push(lockedWordAchievements[0]);
    }
    
    // 天数成就：显示最高已获得 + 下一个待解锁
    const unlockedDayAchievements = dayAchievements.filter(a => a.unlocked);
    const lockedDayAchievements = dayAchievements.filter(a => !a.unlocked);
    
    if (unlockedDayAchievements.length > 0) {
      // 显示最高的已解锁天数成就
      result.push(unlockedDayAchievements[unlockedDayAchievements.length - 1]);
    }
    
    if (lockedDayAchievements.length > 0) {
      // 显示下一个待解锁的天数成就
      result.push(lockedDayAchievements[0]);
    }
    
    // 如果没有任何成就，至少显示第一个
    if (result.length === 0) {
      result.push(allAchievements[0]);
    }
    
    // 最多显示5个成就
    return result.slice(0, 5);
  },

  /**
   * 查看全部成就
   */
  viewAllAchievements: function() {
    const app = getApp();
    const learningProgress = app.globalData.learningProgress || {};
    const totalLearned = learningProgress.totalWordsLearned || 0;
    
    // 重新生成所有成就（不筛选）
    const allAchievements = [
      {
        id: 'first_word',
        title: '初学者',
        description: '学习第一个词语',
        unlocked: totalLearned >= 1,
        icon: '🌱'
      },
      {
        id: 'five_words',
        title: '萌芽',
        description: '学习5个词语',
        unlocked: totalLearned >= 5,
        icon: '🌿'
      },
      {
        id: 'ten_words',
        title: '起步者',
        description: '学习10个词语',
        unlocked: totalLearned >= 10,
        icon: '🚀'
      },
      {
        id: 'twenty_words',
        title: '坚持者',
        description: '学习20个词语',
        unlocked: totalLearned >= 20,
        icon: '💪'
      },
      {
        id: 'thirty_words',
        title: '勤奋者',
        description: '学习30个词语',
        unlocked: totalLearned >= 30,
        icon: '📚'
      },
      {
        id: 'fifty_words',
        title: '进步者',
        description: '学习50个词语',
        unlocked: totalLearned >= 50,
        icon: '⭐'
      },
      {
        id: 'seventy_words',
        title: '努力者',
        description: '学习70个词语',
        unlocked: totalLearned >= 70,
        icon: '🔥'
      },
      {
        id: 'hundred_words',
        title: '学习达人',
        description: '学习100个词语',
        unlocked: totalLearned >= 100,
        icon: '🏆'
      },
      {
        id: 'onethirty_words',
        title: '词汇高手',
        description: '学习130个词语',
        unlocked: totalLearned >= 130,
        icon: '🎖️'
      },
      {
        id: 'onefifty_words',
        title: '语言天才',
        description: '学习150个词语',
        unlocked: totalLearned >= 150,
        icon: '🧠'
      },
      {
        id: 'twohundred_words',
        title: '词汇大师',
        description: '学习200个词语',
        unlocked: totalLearned >= 200,
        icon: '👑'
      },
      {
        id: 'twofifty_words',
        title: '语言专家',
        description: '学习250个词语',
        unlocked: totalLearned >= 250,
        icon: '🎓'
      },
      {
        id: 'threehundred_words',
        title: '词汇精英',
        description: '学习300个词语',
        unlocked: totalLearned >= 300,
        icon: '💎'
      },
      {
        id: 'threefifty_words',
        title: '语言宗师',
        description: '学习350个词语',
        unlocked: totalLearned >= 350,
        icon: '🌟'
      },
      {
        id: 'daily_target',
        title: '今日目标',
        description: '完成今日学习目标',
        unlocked: (learningProgress.dailyLearnedCount || 0) >= (this.data.learningSettings.dailyTarget || 20),
        icon: '🎯'
      },
      {
        id: 'three_days',
        title: '三日坚持',
        description: '累计学习3天',
        unlocked: this.data.quickStats.totalDays >= 3,
        icon: '📅'
      },
      {
        id: 'seven_days',
        title: '一周达成',
        description: '累计学习7天',
        unlocked: this.data.quickStats.totalDays >= 7,
        icon: '🗓️'
      },
      {
        id: 'fifteen_days',
        title: '半月坚持',
        description: '累计学习15天',
        unlocked: this.data.quickStats.totalDays >= 15,
        icon: '⏰'
      },
      {
        id: 'thirty_days',
        title: '月度学霸',
        description: '累计学习30天',
        unlocked: this.data.quickStats.totalDays >= 30,
        icon: '🏅'
      },
      {
        id: 'sixty_days',
        title: '学习狂人',
        description: '累计学习60天',
        unlocked: this.data.quickStats.totalDays >= 60,
        icon: '🔥'
      },
      {
        id: 'hundred_days',
        title: '百日筑基',
        description: '累计学习100天',
        unlocked: this.data.quickStats.totalDays >= 100,
        icon: '💯'
      }
    ];
    
    const unlockedCount = allAchievements.filter(a => a.unlocked).length;
    const totalCount = allAchievements.length;
    
    // 生成成就列表内容
    let content = `成就进度：${unlockedCount}/${totalCount}\n\n`;
    
    // 按类型分组显示
    const wordAchievements = allAchievements.filter(a => a.id.includes('word'));
    const dayAchievements = allAchievements.filter(a => a.id.includes('days') || a.id.includes('target'));
    
    content += '📚 词汇成就：\n';
    wordAchievements.forEach(achievement => {
      const status = achievement.unlocked ? '✅' : '⭕';
      content += `${status} ${achievement.icon} ${achievement.title}\n`;
    });
    
    content += '\n📅 坚持成就：\n';
    dayAchievements.forEach(achievement => {
      const status = achievement.unlocked ? '✅' : '⭕';
      content += `${status} ${achievement.icon} ${achievement.title}\n`;
    });
    
    // 使用自定义弹窗显示成就
    this.setData({
      showAllAchievements: true,
      allAchievementsList: allAchievements,
      achievementStats: {
        unlockedCount,
        totalCount,
        progress: Math.round((unlockedCount / totalCount) * 100)
      }
    });
  },

  /**
   * 关闭全部成就弹窗
   */
  closeAllAchievements: function() {
    this.setData({
      showAllAchievements: false
    });
  },

  /**
   * 阻止触摸事件冒泡（空方法）
   */
  preventTouchMove: function() {
    // 空方法，用于阻止事件冒泡
  },

  /**
   * 学习偏好设置
   */
  openLearningSettings: function() {
    wx.showActionSheet({
      itemList: ['每日学习目标', '每次学习目标', '复习提醒', '声音设置', '练习模式'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0: this.setDailyTarget(); break;
          case 1: this.setSessionTarget(); break;
          case 2: this.toggleReviewReminder(); break;
          case 3: this.toggleSound(); break;
          case 4: this.setPracticeMode(); break;
        }
      }
    });
  },

  /**
   * 设置每日目标
   */
  setDailyTarget: function() {
    wx.showModal({
      title: '设置每日学习目标',
      content: `当前目标：${this.data.learningSettings.dailyTarget}个词\n请输入新的目标数量（5-50）`,
      editable: true,
      placeholderText: this.data.learningSettings.dailyTarget.toString(),
      success: (res) => {
        if (res.confirm && res.content) {
          const target = parseInt(res.content);
          if (target >= 5 && target <= 50) {
            this.setData({
              'learningSettings.dailyTarget': target
            });
            this.saveUserSettings();
          } else {
            wx.showToast({
              title: '请输入5-50之间的数字',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 设置每次目标
   */
  setSessionTarget: function() {
    wx.showModal({
      title: '设置每次学习目标',
      content: `当前目标：${this.data.learningSettings.sessionTarget}个词\n请输入新的目标数量（5-25）`,
      editable: true,
      placeholderText: this.data.learningSettings.sessionTarget.toString(),
      success: (res) => {
        if (res.confirm && res.content) {
          const target = parseInt(res.content);
          if (target >= 5 && target <= 25) {
            this.setData({
              'learningSettings.sessionTarget': target
            });
            this.saveUserSettings();
          } else {
            wx.showToast({
              title: '请输入5-25之间的数字',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 切换复习提醒（开关组件事件）
   */
  toggleReviewReminder: function(e) {
    const newValue = e.detail.value;
    this.setData({
      'learningSettings.reviewReminder': newValue
    });
    this.saveUserSettings();
    
    // 立即刷新复习提醒列表
    this.loadReviewReminders();
    
    wx.showToast({
      title: newValue ? '复习提醒已开启' : '复习提醒已关闭',
      icon: 'success'
    });
  },

  /**
   * 切换声音（开关组件事件）
   */
  toggleSound: function(e) {
    const newValue = e.detail.value;
    this.setData({
      'learningSettings.soundEnabled': newValue
    });
    this.saveUserSettings();
    wx.showToast({
      title: newValue ? '声音已开启' : '声音已关闭',
      icon: 'success'
    });
  },



  /**
   * 设置练习模式
   */
  setPracticeMode: function() {
    wx.showActionSheet({
      itemList: ['混合练习', '仅拼音练习', '仅填空练习'],
      success: (res) => {
        const modes = ['mixed', 'pinyin', 'fillBlank'];
        const modeNames = ['混合练习', '仅拼音练习', '仅填空练习'];
        
        this.setData({
          'learningSettings.practiceMode': modes[res.tapIndex]
        });
        this.saveUserSettings();
        wx.showToast({
          title: `已切换到${modeNames[res.tapIndex]}`,
          icon: 'success'
        });
      }
    });
  },

  /**
   * 学习历史
   */
  viewLearningHistory: function() {
    wx.navigateTo({
      url: '/pages/stats/stats'
    });
  },

  /**
   * 数据管理
   */
  openDataManagement: function() {
    wx.showActionSheet({
      itemList: ['导出学习数据', '清除缓存数据', '重置学习进度'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0: this.exportData(); break;
          case 1: this.clearCache(); break;
          case 2: this.resetProgress(); break;
        }
      }
    });
  },

  /**
   * 导出学习数据
   */
  exportData: function() {
    wx.showLoading({ title: '准备数据中...', mask: true });
    
    try {
      const app = getApp();
      const userInfo = app.globalData.userInfo || {};
      const learningProgress = app.globalData.learningProgress || {};
      const wordStatus = app.globalData.wordStatus || {};
      const learningSettings = this.data.learningSettings;
      
      // 统计各阶段词语数量
      const stageStats = [0, 0, 0, 0, 0, 0];
      Object.values(wordStatus).forEach(status => {
        if (status && status.stage >= 0 && status.stage <= 5) {
          stageStats[status.stage]++;
        }
      });
      
      // 生成导出数据
      const exportData = {
        exportTime: new Date().toLocaleString(),
        userInfo: {
          name: userInfo.name || '未知',
          studentId: userInfo.studentId || '未知'
        },
      learningStats: {
          totalWordsLearned: learningProgress.totalWordsLearned || 0,
          dailyLearnedCount: learningProgress.dailyLearnedCount || 0,
          stageDistribution: stageStats,
          learningDays: wx.getStorageSync('learningDays') || []
        },
        settings: learningSettings,
        wordProgress: Object.keys(wordStatus).length,
        achievements: this.data.achievements.filter(a => a.unlocked).map(a => a.title)
      };
      
      wx.hideLoading();
      
      // 显示数据摘要
      const summary = `学习数据导出摘要：
用户：${exportData.userInfo.name}
学号：${exportData.userInfo.studentId}
总学习词汇：${exportData.learningStats.totalWordsLearned}
学习天数：${exportData.learningStats.learningDays.length}天
当前设置：每日目标${exportData.settings.dailyTarget}词
已获得成就：${exportData.achievements.length}个

数据已复制到剪贴板，您可以粘贴保存`;
      
      // 复制到剪贴板
      wx.setClipboardData({
        data: JSON.stringify(exportData, null, 2),
        success: () => {
          wx.showModal({
            title: '导出成功',
            content: summary,
            showCancel: false,
            confirmText: '确定'
          });
        },
        fail: () => {
          wx.showToast({
            title: '复制到剪贴板失败',
            icon: 'none'
          });
        }
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('导出数据失败:', error);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  },

  /**
   * 清除缓存数据
   */
  clearCache: function() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？这不会影响您的学习进度。',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清除非关键缓存数据
            wx.removeStorageSync('currentLearningGroup');
            wx.removeStorageSync('currentPracticeProgress');
            wx.removeStorageSync('tempData');
            
            wx.showToast({
              title: '缓存已清除',
              icon: 'success'
            });
          } catch (error) {
            wx.showToast({
              title: '清除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 重置学习进度
   */
  resetProgress: function() {
    wx.showModal({
      title: '重置学习进度',
      content: '⚠️ 警告：此操作将清除所有学习记录和进度，无法恢复！确定要继续吗？',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '最后确认',
            content: '请再次确认，这将清除所有学习数据！',
            confirmColor: '#ff0000',
            success: (res2) => {
              if (res2.confirm) {
                this.performReset();
              }
            }
          });
        }
      }
    });
  },

  /**
   * 执行重置操作
   */
  performReset: function() {
    try {
      const app = getApp();
      
      // 重置全局数据
      app.globalData.learningProgress = {
        totalWordsLearned: 0,
        wordsAtStage: [0, 0, 0, 0, 0],
        dailyLearnedCount: 0,
        currentSessionCount: 0,
        lastLearnDate: null
      };
      app.globalData.wordStatus = {};
      app.globalData.currentGroup = {
        words: [],
        progress: 0,
        mode: 'learn',
        results: []
      };
      
      // 清除本地存储
      wx.removeStorageSync('learningHistory');
      wx.removeStorageSync('currentLearningGroup');
      wx.removeStorageSync('currentPracticeProgress');
      wx.removeStorageSync('totalLearningDays');
      
      // 保存重置后的数据
      app.saveUserData();
      
      wx.showToast({
        title: '重置完成',
        icon: 'success'
      });
      
      // 刷新页面数据
      this.loadQuickStats();
      this.loadReviewReminders();
      this.loadAchievements();
      
    } catch (error) {
      console.error('重置失败:', error);
      wx.showToast({
        title: '重置失败',
        icon: 'none'
      });
    }
  },

  /**
   * 立即复习
   */
  startReview: function() {
    console.log('点击立即复习按钮，复习提醒数量:', this.data.reviewReminders.length);
    
    if (this.data.reviewReminders.length === 0) {
      wx.showModal({
        title: '暂无复习',
        content: '当前没有需要复习的词语。\n\n请先完成一些学习，30分钟后会有词语需要复习。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    
    wx.showLoading({
      title: '准备复习...',
      mask: true
    });
    
    setTimeout(() => {
      wx.hideLoading();
      wx.switchTab({
        url: '/pages/learn/learn',
        success: () => {
          wx.showToast({
            title: `开始复习${this.data.reviewReminders.length}个词`,
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('跳转到学习页面失败:', err);
          wx.showToast({
            title: '跳转失败，请手动进入学习页面',
            icon: 'none'
          });
        }
      });
    }, 500);
  },



  /**
   * 退出登录
   */
  logout: function() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();
          
          // 保存用户ID用于清除数据
          const studentId = app.globalData.userInfo ? app.globalData.userInfo.studentId : null;
          
          // 清除用户信息
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;
          
          // 清除全局学习进度数据
          app.globalData.learningProgress = {
            totalWordsLearned: 0,
            wordsAtStage: [0, 0, 0, 0, 0],
            dailyLearnedCount: 0,
            currentSessionCount: 0,
            lastLearnDate: null
          };
          
          // 清除词语状态
          app.globalData.wordStatus = {};
          
          // 清除本地存储的用户信息
          wx.removeStorageSync('userInfo');
          
          // 清除特定用户的数据缓存（如果有studentId）
          if (studentId) {
            wx.removeStorageSync('userData_' + studentId);
          }
          
          // 跳转到登录页面
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  },

  /**
   * 关于我们
   */
  aboutUs: function() {
    wx.showModal({
      title: '关于我们',
      content: '词境通 v1.0\n基于AI驱动的汉语词汇学习方案，采用艾宾浩斯遗忘曲线，帮助学生高效学习汉语词汇。',
      showCancel: false
    });
  },

  /**
   * 联系客服
   */
  contactService: function() {
    wx.showModal({
      title: '联系客服',
      content: '客服功能暂未开放，如有问题请通过以下方式联系：\n\n相关学习群组咨询',
      showCancel: false,
      confirmText: '知道了'
    });
  }
}) 