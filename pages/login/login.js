// pages/login/login.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    studentId: '',
    name: '',
    errorMessage: '',
    isLoading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查是否已登录
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.studentId && userInfo.name) {
      // 已登录，跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  /**
   * 输入框内容变化处理
   */
  onInputChange: function(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    console.log('输入变化:', field, value);
    
    this.setData({
      [field]: value,
      errorMessage: '' // 清除错误信息
    });
  },

  /**
   * 管理员登录验证
   */
  checkAdminLogin: function() {
    // 管理员登录信息
    if (this.data.studentId === 'admin' && this.data.name === 'admin123') {
      this.setData({ isLoading: true });
      
      // 保存管理员登录状态到本地存储
      wx.setStorageSync('adminInfo', {
        isLoggedIn: true,
        username: 'admin',
        loginTime: new Date().getTime()
      });
      
      // 跳转到管理员页面
      setTimeout(() => {
        this.setData({ isLoading: false });
        wx.navigateTo({
          url: '/pages/admin/admin'
        });
      }, 1000);
      
      return true;
    }
    
    return false;
  },

  /**
   * 登录
   */
  login: function(e) {
    console.log('登录按钮点击:', this.data);
    
    if (!this.data.studentId || !this.data.name) {
      this.setData({
        errorMessage: '学号和姓名不能为空'
      });
      return;
    }
    
    this.setData({ 
      isLoading: true,
      errorMessage: ''
    });
    
    // 检查是否是管理员登录
    if (this.checkAdminLogin()) {
      return;
    }

    // 调用云函数验证用户
    wx.cloud.callFunction({
      name: 'userLogin',
      data: {
        studentId: this.data.studentId,
        name: this.data.name
      },
      success: res => {
        this.setData({ isLoading: false });
        
        if (res.result && res.result.code === 0) {
          // 验证成功，保存用户信息
          const userInfo = {
            studentId: this.data.studentId,
            name: this.data.name,
            department: res.result.userInfo?.department || '',
            major: res.result.userInfo?.major || '',
            loginTime: new Date().getTime(),
            lastLoginTime: this.formatDateTime(new Date())
          };
          
          // 获取全局应用实例
          const app = getApp();
          
          // 先清除之前用户的数据
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;
          app.globalData.learningProgress = {
            totalWordsLearned: 0,
            wordsAtStage: [0, 0, 0, 0, 0],
            dailyLearnedCount: 0,
            currentSessionCount: 0,
            lastLearnDate: null
          };
          app.globalData.wordStatus = {};
          app.globalData.lastSyncTime = null;
          
          // 保存用户信息到本地
          wx.setStorageSync('userInfo', userInfo);
          
          // 更新app全局数据
          app.globalData.userInfo = userInfo;
          app.globalData.isLoggedIn = true;
          
          // 确保初始化全局数据对象
          app.initGlobalData();
          
          // 首先尝试加载本地缓存的用户数据
          const userData = wx.getStorageSync('userData_' + userInfo.studentId);
          if (userData) {
            console.log('找到本地缓存的用户数据:', userInfo.studentId);
            // 使用本地缓存的用户数据更新全局状态
            app.globalData.learningProgress = userData.learningProgress || app.globalData.learningProgress;
            app.globalData.wordStatus = userData.wordStatus || {};
            app.globalData.lastSyncTime = userData.lastSyncTime || null;
          }
          
          // 然后尝试从云端加载最新数据
          app.loadUserDataFromCloud();
          
          // 跳转到首页
          wx.switchTab({
            url: '/pages/index/index'
          });
        } else {
          // 验证失败，降级到本地白名单验证
          this.localLoginVerify();
        }
      },
      fail: err => {
        console.error('登录失败:', err);
        this.setData({ isLoading: false });
        
        // 云函数调用失败，降级到本地白名单验证
        this.localLoginVerify();
      }
    });
  },
  
  /**
   * 本地登录验证（作为云函数失败的降级方案）
   */
  localLoginVerify: function() {
    // 从存储中获取白名单数据
    const whitelistStudents = wx.getStorageSync('whitelistStudents') || [];
    
    // 如果白名单为空，使用默认白名单（仅用于初始状态）
    const defaultWhitelist = [
      { studentId: '20230001', name: '张三' },
      { studentId: '20230002', name: '李四' },
      { studentId: '20230003', name: '王五' }
    ];
    
    // 使用白名单或默认白名单
    const whitelist = whitelistStudents.length > 0 ? whitelistStudents : defaultWhitelist;

    // 验证是否在白名单中
    const isValid = whitelist.some(item => 
      item.studentId === this.data.studentId && item.name === this.data.name
    );

    if (isValid) {
      // 查找用户在白名单中的完整信息
      const userInfo = whitelist.find(item => 
        item.studentId === this.data.studentId && item.name === this.data.name
      );
      
      // 创建用户信息对象
      const userInfoData = {
        studentId: this.data.studentId,
        name: this.data.name,
        department: userInfo.department || '',
        major: userInfo.major || '',
        loginTime: new Date().getTime(),
        lastLoginTime: this.formatDateTime(new Date())
      };
      
      // 保存用户信息到本地
      wx.setStorageSync('userInfo', userInfoData);
      
      // 更新app全局数据
      const app = getApp();
      
      // 先清除之前用户的数据
      app.globalData.userInfo = null;
      app.globalData.isLoggedIn = false;
      app.globalData.learningProgress = {
        totalWordsLearned: 0,
        wordsAtStage: [0, 0, 0, 0, 0],
        dailyLearnedCount: 0,
        currentSessionCount: 0,
        lastLearnDate: null
      };
      app.globalData.wordStatus = {};
      app.globalData.lastSyncTime = null;
      
      // 设置新用户信息
      app.globalData.userInfo = userInfoData;
      app.globalData.isLoggedIn = true;
      
      // 确保初始化全局数据对象
      app.initGlobalData();
      
      // 首先尝试加载本地缓存的用户数据
      const userData = wx.getStorageSync('userData_' + userInfoData.studentId);
      if (userData) {
        console.log('找到本地缓存的用户数据:', userInfoData.studentId);
        // 使用本地缓存的用户数据更新全局状态
        app.globalData.learningProgress = userData.learningProgress || app.globalData.learningProgress;
        app.globalData.wordStatus = userData.wordStatus || {};
        app.globalData.lastSyncTime = userData.lastSyncTime || null;
      }
      
      // 记录学生登录（本地模式）
      this.recordStudentLoginLocal();
      
      // 跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    } else {
      this.setData({
        errorMessage: '学号或姓名不正确，请重试'
      });
    }
  },
  
  /**
   * 格式化日期时间
   */
  formatDateTime: function(date) {
    return date.getFullYear() + '-' + 
           (date.getMonth() + 1).toString().padStart(2, '0') + '-' + 
           date.getDate().toString().padStart(2, '0') + ' ' + 
           date.getHours().toString().padStart(2, '0') + ':' + 
           date.getMinutes().toString().padStart(2, '0');
  },
  
  /**
   * 记录学生登录信息（本地模式）
   */
  recordStudentLoginLocal: function() {
    // 获取现有学生数据
    let studentData = wx.getStorageSync('studentData') || [];
    
    // 查找是否已存在该学生
    const studentIndex = studentData.findIndex(item => item.studentId === this.data.studentId);
    
    const loginTime = this.formatDateTime(new Date());
    
    if (studentIndex >= 0) {
      // 更新现有学生数据
      studentData[studentIndex].lastLoginTime = loginTime;
    } else {
      // 添加新学生数据
      studentData.push({
        studentId: this.data.studentId,
        name: this.data.name,
        totalWordsLearned: 0,
        correctRate: 0,
        lastLoginTime: loginTime,
        progress: {
          stage1: 0,
          stage2: 0,
          stage3: 0,
          stage4: 0,
          stage5: 0
        }
      });
    }
    
    // 保存更新后的学生数据
    wx.setStorageSync('studentData', studentData);
    
    // 创建用户特定的数据存储键
    const userDataKey = `userData_${this.data.studentId}`;
    
    // 获取全局应用实例
    const app = getApp();
    
    // 保存用户特定的学习数据
    wx.setStorageSync(userDataKey, {
      learningProgress: app.globalData.learningProgress || {
        totalWordsLearned: 0,
        wordsAtStage: [0, 0, 0, 0, 0],
        dailyLearnedCount: 0,
        currentSessionCount: 0,
        lastLearnDate: new Date().toDateString()
      },
      wordStatus: app.globalData.wordStatus || {},
      lastSyncTime: new Date().toISOString()
    });
  }
}) 