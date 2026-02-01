const app = getApp();

Page({
  data: {
    isUploading: false,
    uploadSuccess: false,
    uploadError: '',
    fileSelected: false,
    fileName: '',
    importedCount: 0
  },

  onLoad: function(options) {
    // 不检查权限
  },

  // 权限检查函数保留但不做任何检查
  checkAdminAuth: function() {
    // 不做任何权限检查，直接返回
    return true;
  },

  // 选择文件
  chooseFile: function() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls', 'csv'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].path;
        const fileName = res.tempFiles[0].name;
        
        this.setData({
          fileSelected: true,
          fileName: fileName,
          uploadSuccess: false,
          uploadError: ''
        });
        
        // 保存临时文件路径
        this.tempFilePath = tempFilePath;
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
      }
    });
  },

  // 上传文件
  uploadFile: function() {
    if (!this.tempFilePath) {
      this.setData({
        uploadError: '请先选择文件'
      });
      return;
    }

    this.setData({
      isUploading: true,
      uploadSuccess: false,
      uploadError: ''
    });

    // 上传文件到云存储
    wx.cloud.uploadFile({
      cloudPath: `admin/student_lists/${new Date().getTime()}_${this.data.fileName}`,
      filePath: this.tempFilePath,
      success: res => {
        const fileID = res.fileID;
        
        // 调用云函数处理Excel文件
        wx.cloud.callFunction({
          name: 'importStudents',
          data: {
            fileID: fileID
          },
          success: result => {
            console.log('云函数返回结果:', result);
            
            if (result.result && result.result.code === 0) {
              this.setData({
                uploadSuccess: true,
                importedCount: result.result.importCount || 0,
                isUploading: false
              });
              
              // 提示用户导入成功，并询问是否查看学生数据
              setTimeout(() => {
                wx.showModal({
                  title: '导入成功',
                  content: `成功导入${result.result.importCount || 0}名学生，是否立即查看学生学习数据？`,
                  confirmText: '立即查看',
                  cancelText: '稍后查看',
                  success: (res) => {
                    if (res.confirm) {
                      // 跳转到学生学习数据页面
                      wx.navigateTo({
                        url: '/pages/admin/studentData/studentData'
                      });
                    }
                  }
                });
              }, 500);
            } else {
              this.setData({
                uploadError: result.result?.message || '导入失败',
                isUploading: false
              });
            }
          },
          fail: err => {
            console.error('处理Excel文件失败:', err);
            this.setData({
              uploadError: '处理文件失败: ' + (err.errMsg || '请检查文件格式'),
              isUploading: false
            });
          }
        });
      },
      fail: err => {
        console.error('上传文件失败:', err);
        this.setData({
          uploadError: '上传文件失败: ' + (err.errMsg || ''),
          isUploading: false
        });
      }
    });
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  }
}); 