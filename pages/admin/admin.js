// pages/admin/admin.js
const app = getApp();

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isAdmin: true,
    adminUsername: '',
    adminPassword: '',
    errorMessage: '',
    isLoading: false,
    isLoggedIn: true,
    students: [],
    filteredStudents: [], // 搜索过滤后的学生列表
    searchKeyword: '', // 搜索关键词
    totalWords: 0,
    currentTab: 'whitelist', // 'whitelist', 'students'
    whitelistStudents: [],
    uploadStatus: '',
    showStudentDetail: false, // 是否显示学生详情弹窗
    currentStudent: null, // 当前查看的学生详情
    statsPeriod: '30days', // '7days', '30days', 'all'
    userInfo: {},
    showUploadModal: false,
    showLoginForm: false // 是否显示登录表单
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 直接加载数据，不检查权限
    this.loadStudentDataFromCloud();
    this.loadWhitelistData();
    this.loadVocabularyStats();
  },
  
  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      });
    }
    // 直接加载数据，不检查权限
    this.loadStudentDataFromCloud();
    this.loadWhitelistData();
  },

  /**
   * 从云端加载学生数据
   */
  loadStudentDataFromCloud: function() {
    this.setData({ isLoading: true });
    
    wx.cloud.callFunction({
      name: 'getStudentStats',
      success: res => {
        if (res.result && res.result.code === 0 && res.result.data) {
          const studentList = res.result.data;
          
          this.setData({
            students: studentList,
            filteredStudents: studentList,
            isLoading: false
          });
          
          wx.showToast({
            title: `已加载${studentList.length}名学生数据`,
            icon: 'none'
          });
        } else {
          this.loadSampleStudentData(); // 加载示例数据作为后备
          this.setData({ isLoading: false });
        }
      },
      fail: err => {
        console.error('获取学生数据失败:', err);
        this.loadSampleStudentData(); // 加载示例数据作为后备
        this.setData({ isLoading: false });
      }
    });
  },
  
  /**
   * 加载示例学生数据（仅在云函数失败时使用）
   */
  loadSampleStudentData: function() {
    // 创建示例学生数据
    const sampleStudents = [
      {
        studentId: '20230001',
        name: '张三',
        totalWordsLearned: 17,
        correctRate: 34,
        progress: {
          stage1: 7,
          stage2: 2,
          stage3: 10,
          stage4: 2,
          stage5: 2
        },
        lastLoginTime: '2025-06-27 16:22'
      }
    ];
    
    this.setData({
      students: sampleStudents,
      filteredStudents: sampleStudents
    });
    
    wx.showToast({
      title: '无法连接到云端，显示示例数据',
      icon: 'none'
    });
  },
  
  /**
   * 计算正确率
   */
  calculateCorrectRate: function(wordStatus) {
    let totalReviews = 0;
    let correctReviews = 0;
    
    Object.keys(wordStatus || {}).forEach(wordId => {
      const status = wordStatus[wordId];
      if (status && status.reviews) {
        totalReviews += status.reviews;
        correctReviews += status.correctReviews || 0;
      }
    });
    
    return totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;
  },

  /**
   * 加载白名单数据
   */
  loadWhitelistData: function() {
    this.setData({ isLoading: true });
    
    wx.cloud.callFunction({
      name: 'getWhitelist',
      success: res => {
        if (res.result && res.result.code === 0) {
          this.setData({
            whitelistStudents: res.result.data || [],
            isLoading: false
          });
        } else {
          this.setData({ 
            whitelistStudents: [],
            isLoading: false
          });
          
          wx.showToast({
            title: '获取白名单失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取白名单失败:', err);
        this.setData({ 
          whitelistStudents: [],
          isLoading: false
        });
        
        wx.showToast({
          title: '获取白名单失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 加载词汇统计数据
   */
  loadVocabularyStats: function() {
    // 从云端获取词汇数据统计
    wx.cloud.callFunction({
      name: 'getWordsStats',
      success: res => {
        if (res.result && res.result.code === 0) {
          this.setData({
            totalWords: res.result.totalCount || 0
          });
        } else {
          // 使用本地数据作为后备
          const wordService = require('../../services/wordService');
          const allWords = wordService.getAllWords();
          this.setData({
            totalWords: allWords.length
          });
        }
      },
      fail: err => {
        console.error('获取词汇统计数据失败:', err);
        // 使用本地数据作为后备
        const wordService = require('../../services/wordService');
        const allWords = wordService.getAllWords();
        this.setData({
          totalWords: allWords.length
        });
      }
    });
  },

  /**
   * 输入框内容变化处理
   */
  onInputChange: function(e) {
    this.setData({
      adminPassword: e.detail.value,
      errorMessage: '' // 清除错误信息
    });
  },

  /**
   * 用户名输入处理
   */
  onUsernameInput: function(e) {
    this.setData({
      adminUsername: e.detail.value,
      errorMessage: '' // 清除错误信息
    });
  },

  /**
   * 搜索输入框内容变化处理
   */
  onSearchInput: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    
    // 如果输入为空，恢复显示所有学生
    if (!e.detail.value) {
      this.setData({
        filteredStudents: this.data.students
      });
    }
  },

  /**
   * 执行学生搜索
   */
  searchStudent: function() {
    const keyword = this.data.searchKeyword.trim().toLowerCase();
    
    if (!keyword) {
      // 如果关键词为空，显示所有学生
      this.setData({
        filteredStudents: this.data.students
      });
      return;
    }
    
    // 根据学号或姓名过滤学生
    const filteredStudents = this.data.students.filter(student => {
      return student.studentId.toLowerCase().includes(keyword) || 
             student.name.toLowerCase().includes(keyword);
    });
    
    this.setData({
      filteredStudents: filteredStudents
    });
    
    // 显示搜索结果提示
    wx.showToast({
      title: `找到 ${filteredStudents.length} 名学生`,
      icon: 'none'
    });
  },

  /**
   * 管理员登录
   */
  adminLogin: function() {
    // 直接设置为已登录状态
    wx.setStorageSync('adminInfo', {
      isLoggedIn: true,
      username: 'admin'
    });
    
    this.setData({
      isAdmin: true,
      isLoggedIn: true,
      showLoginForm: false
    });
    
    // 加载数据
    this.loadStudentDataFromCloud();
    this.loadWhitelistData();
    this.loadVocabularyStats();
  },
  
  /**
   * 切换标签页
   */
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    });
  },
  
  /**
   * 查看学生详情
   */
  viewStudentDetail: function(e) {
    const studentId = e.currentTarget.dataset.id;
    
    // 设置加载状态
    this.setData({ isLoading: true });
    
    // 从云端获取学生的详细数据
    wx.cloud.callFunction({
      name: 'getUserData',
      data: {
        studentId: studentId
      },
      success: res => {
        this.setData({ isLoading: false });
        
        if (res.result && res.result.code === 0 && res.result.data) {
          // 处理学生详情数据
          const studentData = res.result.data;
          
          // 计算学习曲线数据
          const statsHistory = studentData.statsHistory || [];
          const learningCurve = this.processLearningCurveData(statsHistory, this.data.statsPeriod);
          
          // 设置当前学生详情
          this.setData({
            currentStudent: {
              ...studentData,
              learningCurve,
              studentId: studentData.studentId,
              name: studentData.name,
              totalWordsLearned: studentData.stats?.totalWordsLearned || 0,
              correctRate: studentData.stats?.correctRate || 0,
              progress: studentData.stats?.progress || {
                stage1: 0,
                stage2: 0,
                stage3: 0,
                stage4: 0,
                stage5: 0
              }
            },
            showStudentDetail: true
          });
        } else {
          wx.showToast({
            title: '获取学生详情失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取学生详情失败:', err);
        this.setData({ isLoading: false });
        
        wx.showToast({
          title: '获取学生详情失败',
          icon: 'none'
        });
      }
    });
  },
  
  /**
   * 处理学习曲线数据
   */
  processLearningCurveData: function(history, period) {
    if (!history || history.length === 0) {
      return {
        dates: [],
        totalWords: [],
        correctRates: []
      };
    }
    
    // 根据周期过滤数据
    let filteredHistory = [...history];
    const now = new Date();
    
    if (period === '7days') {
      // 过滤最近7天数据
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredHistory = history.filter(item => new Date(item.time) >= sevenDaysAgo);
    } else if (period === '30days') {
      // 过滤最近30天数据
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredHistory = history.filter(item => new Date(item.time) >= thirtyDaysAgo);
    }
    
    // 确保有足够的数据点
    if (filteredHistory.length < 2) {
      filteredHistory = history.slice(-Math.min(7, history.length));
    }
    
    // 格式化数据
    const dates = filteredHistory.map(item => {
      const date = new Date(item.time);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    
    const totalWords = filteredHistory.map(item => item.totalWordsLearned || 0);
    const correctRates = filteredHistory.map(item => item.correctRate || 0);
    
    return {
      dates,
      totalWords,
      correctRates
    };
  },
  
  /**
   * 切换统计周期
   */
  changePeriod: function(e) {
    const period = e.currentTarget.dataset.period;
    this.setData({ statsPeriod: period });
    
    // 如果当前有学生详情，重新处理学习曲线数据
    if (this.data.currentStudent && this.data.currentStudent.statsHistory) {
      const learningCurve = this.processLearningCurveData(
        this.data.currentStudent.statsHistory,
        period
      );
      
      this.setData({
        'currentStudent.learningCurve': learningCurve
      });
    }
  },
  
  /**
   * 关闭学生详情
   */
  closeStudentDetail: function() {
    this.setData({
      showStudentDetail: false,
      currentStudent: null
    });
  },
  
  /**
   * 检查管理员权限
   */
  checkAdminAuth: function() {
    // 直接设置为管理员
    this.setData({
      isAdmin: true,
      isLoggedIn: true,
      showLoginForm: false
    });
    
    // 加载数据
    this.loadStudentDataFromCloud();
    this.loadWhitelistData();
    this.loadVocabularyStats();
  },
  
  /**
   * 退出登录
   */
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出管理员登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态
          wx.removeStorageSync('adminInfo');
          
          this.setData({
            isLoggedIn: false,
            isAdmin: false,
            showLoginForm: true
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },
  
  /**
   * 返回首页
   */
  backToHome: function() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },
  
  /**
   * 添加白名单学生
   */
  addWhitelistStudent: function(e) {
    const { studentId, name, department, major } = e.detail.value;
    
    if (!studentId || !name) {
      wx.showToast({
        title: '学号和姓名不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 设置加载状态
    this.setData({ isLoading: true });
    
    // 调用云函数添加白名单学生
    wx.cloud.callFunction({
      name: 'updateWhitelist',
      data: {
        action: 'add',
        student: {
          studentId,
          name,
          department: department || '',
          major: major || '',
          addTime: new Date().toISOString()
        }
      },
      success: res => {
        this.setData({ isLoading: false });
        
        if (res.result && res.result.code === 0) {
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
          
          // 重新加载白名单数据
          this.loadWhitelistData();
        } else {
          wx.showToast({
            title: res.result?.message || '添加失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('添加白名单学生失败:', err);
        this.setData({ isLoading: false });
        
        wx.showToast({
          title: '添加失败',
          icon: 'none'
        });
      }
    });
  },
  
  /**
   * 删除白名单学生
   */
  deleteWhitelistStudent: function(e) {
    const studentId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要从白名单中删除该学生吗？',
      success: (res) => {
        if (res.confirm) {
          // 设置加载状态
          this.setData({ isLoading: true });
          
          // 调用云函数删除白名单学生
          wx.cloud.callFunction({
            name: 'updateWhitelist',
            data: {
              action: 'delete',
              studentId
            },
            success: res => {
              this.setData({ isLoading: false });
              
              if (res.result && res.result.code === 0) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
                
                // 重新加载白名单数据
                this.loadWhitelistData();
              } else {
                wx.showToast({
                  title: res.result?.message || '删除失败',
                  icon: 'none'
                });
              }
            },
            fail: err => {
              console.error('删除白名单学生失败:', err);
              this.setData({ isLoading: false });
              
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },
  
  /**
   * 上传Excel文件添加白名单
   */
  uploadExcel: function() {
    // 选择文件
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xls', 'xlsx'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].path;
        const fileName = res.tempFiles[0].name;
        
        this.setData({
          uploadStatus: `正在上传: ${fileName}...`
        });
        
        // 上传文件到云存储
        const cloudPath = `whitelist/${new Date().getTime()}_${fileName}`;
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: res => {
            const fileID = res.fileID;
            
            // 调用云函数解析Excel并添加到白名单
            wx.cloud.callFunction({
              name: 'parseWhitelistExcel',
              data: {
                fileID: fileID
              },
              success: res => {
                if (res.result && res.result.code === 0) {
                  this.setData({
                    uploadStatus: `成功导入 ${res.result.importCount || 0} 名学生`
                  });
                  
                  // 重新加载白名单数据
                  this.loadWhitelistData();
                  
                  // 重新加载学生数据，以显示新导入的学生
                  this.loadStudentDataFromCloud();
                  
                  // 提示用户切换到学生学习情况标签页查看
                  setTimeout(() => {
                    wx.showModal({
                      title: '导入成功',
                      content: '是否切换到学生学习情况页面查看?',
                      success: (res) => {
                        if (res.confirm) {
                          this.setData({
                            currentTab: 'students'
                          });
                        }
                      }
                    });
                  }, 1000);
                } else {
                  this.setData({
                    uploadStatus: res.result?.message || '导入失败，请检查Excel格式'
                  });
                }
              },
              fail: err => {
                console.error('解析Excel失败:', err);
                this.setData({
                  uploadStatus: '解析Excel失败，请稍后再试'
                });
              }
            });
          },
          fail: err => {
            console.error('上传Excel失败:', err);
            this.setData({
              uploadStatus: '上传失败，请稍后再试'
            });
          }
        });
      },
      fail: err => {
        console.error('选择文件失败:', err);
      }
    });
  },
  
  /**
   * 手动添加学生到白名单
   */
  addToWhitelist: function() {
    wx.navigateTo({
      url: '/pages/admin/addStudent'
    });
  },
  
  /**
   * 导出白名单
   */
  exportWhitelist: function() {
    // 设置加载状态
    this.setData({ isLoading: true });
    
    try {
      // 使用当前页面上的白名单数据
      const students = this.data.whitelistStudents || [];
      
      if (students.length === 0) {
        wx.showToast({
          title: '没有可导出的白名单数据',
          icon: 'none'
        });
        this.setData({ isLoading: false });
        return;
      }
      
      // 生成CSV格式的数据
      let csvContent = '学号,姓名,院系,专业\n';
      
      students.forEach(student => {
        csvContent += `${student.studentId},${student.name},${student.department || ''},${student.major || ''}\n`;
      });
      
      // 使用文件系统API保存文件
      const fs = wx.getFileSystemManager();
      const fileName = `whitelist_export_${new Date().getTime()}.csv`;
      
      // 保存到临时目录
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
      
      try {
        fs.writeFileSync(filePath, csvContent, 'utf8');
        
        // 保存成功后，让用户保存文件到本地
        wx.shareFileMessage({
          filePath: filePath,
          success: () => {
            this.setData({ isLoading: false });
            wx.showToast({
              title: '导出成功',
              icon: 'success'
            });
          },
          fail: err => {
            console.error('分享文件失败:', err);
            this.setData({ isLoading: false });
            wx.showToast({
              title: '分享文件失败',
              icon: 'none'
            });
          }
        });
      } catch (fsError) {
        console.error('保存文件失败:', fsError);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '保存文件失败',
          icon: 'none'
        });
      }
    } catch (e) {
      console.error('导出白名单失败:', e);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '导出白名单失败',
        icon: 'none'
      });
    }
  },

  /**
   * 导航到学生数据管理页面
   */
  navigateToStudentData: function() {
    wx.navigateTo({
      url: '/pages/admin/studentData/studentData'
    });
  },

  /**
   * 导航到词汇表初始化页面
   */
  navigateToInitWordList: function() {
    wx.navigateTo({
      url: '/pages/admin/initWordList/initWordList'
    });
  },

  /**
   * 导航到词汇录音管理页面
   */
  navigateToWordAudio: function() {
    wx.navigateTo({
      url: '/pages/admin/wordAudio/wordAudio'
    });
  },

  /**
   * 导航到上传学生名单页面
   */
  navigateToUploadStudents: function() {
    wx.navigateTo({
      url: '/pages/admin/uploadStudents/uploadStudents'
    });
  },

  /**
   * 导航到添加词语页面
   */
  navigateToAddWord: function() {
    wx.navigateTo({
      url: '/pages/admin/addWord/addWord'
    });
  },

  /**
   * 导航到词语管理页面
   */
  navigateToWordManage: function() {
    wx.navigateTo({
      url: '/pages/admin/wordManage/wordManage'
    });
  },

  /**
   * 导航到词语图片管理页面
   */
  navigateToWordImages: function() {
    wx.navigateTo({
      url: '/pages/admin/wordImages/wordImages'
    });
  },

  /**
   * 清除用户数据
   */
  clearUserData: function() {
    wx.showModal({
      title: '警告',
      content: '此操作将清除所有用户的学习数据和进度，无法恢复。确定要继续吗？',
      confirmText: '确定清除',
      confirmColor: '#FF0000',
      cancelText: '取消',
      success: res => {
        if (res.confirm) {
          // 二次确认
          wx.showModal({
            title: '二次确认',
            content: '请再次确认：此操作将删除所有用户的学习记录和进度数据，且无法恢复！',
            confirmText: '确定清除',
            confirmColor: '#FF0000',
            cancelText: '取消',
            success: res2 => {
              if (res2.confirm) {
                this.setData({ isLoading: true });
                
                wx.showLoading({
                  title: '正在清除数据...',
                  mask: true
                });
                
                wx.cloud.callFunction({
                  name: 'clearUserData'
                }).then(res => {
                  this.setData({ isLoading: false });
                  wx.hideLoading();
                  
                  if (res.result && res.result.success) {
                    wx.showToast({
                      title: '数据清除成功',
                      icon: 'success'
                    });
                  } else {
                    wx.showToast({
                      title: res.result ? res.result.message : '操作失败',
                      icon: 'none'
                    });
                  }
                }).catch(err => {
                  console.error('清除数据失败:', err);
                  this.setData({ isLoading: false });
                  wx.hideLoading();
                  
                  wx.showToast({
                    title: '清除数据失败',
                    icon: 'none'
                  });
                });
              }
            }
          });
        }
      }
    });
  },
});