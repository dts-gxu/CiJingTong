const app = getApp();

Page({
  data: {
    isLoading: false,
    exportOptions: {
      format: 'excel', // 'excel' 或 'csv'
      dataType: 'all', // 'all', 'active', 'inactive'
      period: '30days', // 'all', '7days', '30days', '90days'
      includeDetails: true // 是否包含详细学习记录
    },
    exportSuccess: false,
    exportError: '',
    filePath: ''
  },

  onLoad: function(options) {
    this.checkAdminAuth();
  },

  checkAdminAuth: function() {
    const userInfo = app.globalData.userInfo || {};
    if (userInfo.role !== 'admin') {
      wx.showModal({
        title: '权限不足',
        content: '您没有管理员权限',
        showCancel: false,
        success: (res) => {
          wx.navigateBack();
        }
      });
    }
  },

  // 处理单选框变化
  handleRadioChange: function(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    this.setData({
      [`exportOptions.${field}`]: value
    });
  },

  // 处理开关变化
  handleSwitchChange: function(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    this.setData({
      [`exportOptions.${field}`]: value
    });
  },

  // 导出数据
  exportData: function() {
    this.setData({
      isLoading: true,
      exportSuccess: false,
      exportError: '',
      filePath: ''
    });
    
    // 调用云函数导出数据
    wx.cloud.callFunction({
      name: 'exportStudentData',
      data: this.data.exportOptions,
      success: res => {
        if (res.result && res.result.code === 0 && res.result.fileID) {
          // 获取文件临时链接
          wx.cloud.downloadFile({
            fileID: res.result.fileID,
            success: downloadRes => {
              // 保存文件到本地
              wx.saveFile({
                tempFilePath: downloadRes.tempFilePath,
                success: saveRes => {
                  this.setData({
                    isLoading: false,
                    exportSuccess: true,
                    filePath: saveRes.savedFilePath
                  });
                },
                fail: err => {
                  console.error('保存文件失败:', err);
                  this.setData({
                    isLoading: false,
                    exportError: '保存文件失败'
                  });
                }
              });
            },
            fail: err => {
              console.error('下载文件失败:', err);
              this.setData({
                isLoading: false,
                exportError: '下载文件失败'
              });
            }
          });
        } else {
          this.setData({
            isLoading: false,
            exportError: res.result?.message || '导出失败'
          });
        }
      },
      fail: err => {
        console.error('导出数据失败:', err);
        this.setData({
          isLoading: false,
          exportError: '导出数据失败，请稍后再试'
        });
        
        // 如果云函数调用失败，尝试本地导出
        this.exportLocalData();
      }
    });
  },
  
  // 本地导出数据（作为备用方案）
  exportLocalData: function() {
    try {
      // 获取学生数据
      const students = wx.getStorageSync('studentData') || [];
      
      if (students.length === 0) {
        this.setData({
          exportError: '没有可导出的学生数据'
        });
        return;
      }
      
      // 根据选项过滤数据
      let filteredStudents = [...students];
      
      // 按活跃状态过滤
      if (this.data.exportOptions.dataType === 'active') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        filteredStudents = filteredStudents.filter(student => {
          if (!student.lastLoginTime) return false;
          const loginTime = new Date(student.lastLoginTime);
          return loginTime >= oneWeekAgo;
        });
      } else if (this.data.exportOptions.dataType === 'inactive') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        filteredStudents = filteredStudents.filter(student => {
          if (!student.lastLoginTime) return true;
          const loginTime = new Date(student.lastLoginTime);
          return loginTime < oneWeekAgo;
        });
      }
      
      // 按时间段过滤
      if (this.data.exportOptions.period !== 'all') {
        let cutoffDate = new Date();
        const period = parseInt(this.data.exportOptions.period);
        cutoffDate.setDate(cutoffDate.getDate() - period);
        
        filteredStudents = filteredStudents.filter(student => {
          if (!student.lastLoginTime) return false;
          const loginTime = new Date(student.lastLoginTime);
          return loginTime >= cutoffDate;
        });
      }
      
      // 生成CSV或Excel格式数据
      let content = '';
      const format = this.data.exportOptions.format;
      
      if (format === 'csv') {
        // 生成CSV头
        content = '学号,姓名,已学词汇量,正确率,阶段1,阶段2,阶段3,阶段4,阶段5,最后登录时间\n';
        
        // 添加数据行
        filteredStudents.forEach(student => {
          content += `${student.studentId},${student.name},${student.totalWordsLearned || 0},${student.correctRate || 0}%,`;
          content += `${student.progress?.stage1 || 0},${student.progress?.stage2 || 0},${student.progress?.stage3 || 0},`;
          content += `${student.progress?.stage4 || 0},${student.progress?.stage5 || 0},${student.lastLoginTime || ''}\n`;
        });
      } else {
        // 简单的Excel格式（实际上仍是CSV，但添加了一些Excel可以识别的格式）
        content = '\ufeff'; // UTF-8 BOM
        content += '学号,姓名,已学词汇量,正确率,阶段1,阶段2,阶段3,阶段4,阶段5,最后登录时间\n';
        
        filteredStudents.forEach(student => {
          content += `${student.studentId},${student.name},${student.totalWordsLearned || 0},${student.correctRate || 0}%,`;
          content += `${student.progress?.stage1 || 0},${student.progress?.stage2 || 0},${student.progress?.stage3 || 0},`;
          content += `${student.progress?.stage4 || 0},${student.progress?.stage5 || 0},${student.lastLoginTime || ''}\n`;
        });
      }
      
      // 保存文件
      const fs = wx.getFileSystemManager();
      const fileName = `学生学习数据_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
      
      fs.writeFile({
        filePath: filePath,
        data: content,
        encoding: 'utf8',
        success: () => {
          this.setData({
            exportSuccess: true,
            filePath: filePath
          });
        },
        fail: (err) => {
          console.error('保存文件失败:', err);
          this.setData({
            exportError: '保存文件失败'
          });
        }
      });
    } catch (err) {
      console.error('本地导出数据失败:', err);
      this.setData({
        exportError: '导出失败，请稍后再试'
      });
    }
  },
  
  // 打开导出的文件
  openFile: function() {
    if (!this.data.filePath) {
      wx.showToast({
        title: '文件路径无效',
        icon: 'none'
      });
      return;
    }
    
    wx.openDocument({
      filePath: this.data.filePath,
      success: () => {
        console.log('打开文档成功');
      },
      fail: (err) => {
        console.error('打开文档失败', err);
        wx.showToast({
          title: '无法打开文件',
          icon: 'none'
        });
      }
    });
  },
  
  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  }
}); 