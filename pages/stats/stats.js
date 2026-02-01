// pages/stats/stats.js
// 导入词语服务
const wordService = require('../../services/wordService');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    stats: {
      totalWords: 0,
      learnedWords: 0,
      progressRate: 0,
      retentionRate: 0,
      stageDistribution: [0, 0, 0, 0, 0],
      dailyLearnedCount: 0,
      sessionLearnedCount: 0
    },
    activeTab: 'progress' // 'progress' 或 'distribution'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLogin();
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
    this.checkLogin();
    this.loadStats();
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
   * 加载统计数据
   */
  loadStats: async function() {
    if (!this.checkLogin()) return;
    
    // 获取全局应用实例
    const app = getApp();
    
    try {
      // 使用异步方式获取学习统计数据
      const stats = await wordService.getLearningStats(app);
      
      // 计算进度率和记忆保留率
      const progressRate = stats.totalWords > 0 ? Math.round((stats.learnedWords / stats.totalWords) * 100) : 0;
      
      // 获取学习进度数据
      const learningProgress = app.globalData.learningProgress || {};
      
      // 更新统计数据
      this.setData({
        stats: {
          ...stats,
          progressRate: progressRate,
          retentionRate: 0, // 暂不计算记忆保留率
          dailyLearnedCount: learningProgress.dailyLearnedCount || 0,
          sessionLearnedCount: learningProgress.currentSessionCount || 0,
          stageDistribution: stats.stageDistribution ? stats.stageDistribution.slice(1) : [0, 0, 0, 0, 0] // 去掉stage0
        }
      });
      
      console.log('统计数据已更新:', this.data.stats);
    } catch (error) {
      console.error('获取统计数据失败:', error);
      wx.showToast({
        title: '获取统计数据失败',
        icon: 'none'
      });
    }
  },

  /**
   * 切换标签页
   */
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  /**
   * 返回首页
   */
  goToIndex: function() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
})