// pages/result/result.js
// 导入词语服务
const wordService = require('../../services/wordService');
// 导入记忆算法工具
const memoryUtil = require('../../utils/memory');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    stats: {
      correct: 0,
      total: 0,
      percent: 0
    },
    feedback: '',
    nextReviewTime: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取全局应用实例
    this.getApp = getApp;
    const app = this.getApp();
    
    // 获取练习结果
    const results = app.globalData.currentGroup.results || [];
    const correctCount = results.filter(r => r && r.isCorrect).length;
    const totalCount = results.length;
    const correctRate = Math.round((correctCount / totalCount) * 100) || 0;
    
    // 生成反馈信息
    let feedback = '';
    if (correctRate >= 90) {
      feedback = '太棒了！你的掌握程度非常好！';
    } else if (correctRate >= 70) {
      feedback = '做得不错！继续保持！';
    } else if (correctRate >= 50) {
      feedback = '还不错，继续努力！';
    } else {
      feedback = '需要更多练习，加油！';
    }
    
    // 计算下次复习时间，基于艾宾浩斯记忆曲线
    let nextReviewTime = '';
    try {
      const userWordStatus = app.globalData.wordStatus || {};
      
      // 找到最近需要复习的词语
      let earliestReviewTime = null;
      let totalReviewWords = 0;
      
      Object.values(userWordStatus).forEach(status => {
        if (status && status.nextReviewTime) {
          totalReviewWords++;
          const reviewTime = new Date(status.nextReviewTime);
          if (!earliestReviewTime || reviewTime < earliestReviewTime) {
            earliestReviewTime = reviewTime;
          }
        }
      });
      
      if (earliestReviewTime) {
        const now = new Date();
        const timeDiff = earliestReviewTime.getTime() - now.getTime();
        
        if (timeDiff <= 0) {
          nextReviewTime = '现在就可以复习！';
        } else if (timeDiff < 60 * 60 * 1000) {
          // 小于1小时
          const minutes = Math.ceil(timeDiff / (60 * 1000));
          nextReviewTime = `${minutes}分钟后`;
        } else if (timeDiff < 24 * 60 * 60 * 1000) {
          // 小于1天
          const hours = Math.ceil(timeDiff / (60 * 60 * 1000));
          nextReviewTime = `${hours}小时后`;
        } else {
          // 大于1天
          const days = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
          nextReviewTime = `${days}天后`;
        }
        
        if (totalReviewWords > 1) {
          nextReviewTime += `（共${totalReviewWords}个词待复习）`;
        }
      } else {
        nextReviewTime = '暂无复习安排';
      }
    } catch (error) {
      console.error('计算复习时间失败:', error);
      nextReviewTime = '计算复习时间出错';
    }
    
    this.setData({
      stats: {
        correct: correctCount,
        total: totalCount,
        percent: correctRate
      },
      feedback,
      nextReviewTime
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
  onShow() {

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
   * 返回首页
   */
  goToIndex: function() {
    wx.switchTab({
      url: '../index/index'
    });
  },
  
  /**
   * 查看学习统计
   */
  goToStats: function() {
    wx.switchTab({
      url: '../stats/stats'
    });
  }
})