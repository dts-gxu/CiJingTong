Page({

  /**
   * 页面的初始数据
   */
  data: {
    isAdmin: false,
    words: [],
    isLoading: false,
    hasUploaded: false,
    uploadResults: null,
    updateResults: null,
    hasUpdated: false,
    defaultImagePath: '/images/default_word.png'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkAdminAuth();
    this.loadWords();
    this.ensureDefaultImage();
  },

  /**
   * 确保默认图片存在
   */
  ensureDefaultImage() {
    // 检查默认图片是否存在
    wx.getFileSystemManager().access({
      path: this.data.defaultImagePath.slice(1), // 去除前导斜杠
      success: () => {
        console.log('默认图片存在');
      },
      fail: () => {
        console.log('默认图片不存在，使用placeholder');
        this.setData({
          defaultImagePath: '/placeholder.png'
        });
      }
    });
  },

  /**
   * 处理图片加载错误
   */
  handleImageError(e) {
    console.log('图片加载错误:', e);
    const wordIndex = e.currentTarget.dataset.word;
    
    // 查找对应的词语索引
    const index = this.data.wordsWithImages.findIndex(item => item.word === wordIndex);
    
    if (index !== -1) {
      // 更新为默认图片
      const wordsWithImages = [...this.data.wordsWithImages];
      wordsWithImages[index].imagePath = this.data.defaultImagePath;
      
      this.setData({
        wordsWithImages: wordsWithImages
      });
    }
  },

  /**
   * 检查管理员权限
   */
  checkAdminAuth() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.isAdmin) {
      this.setData({
        isAdmin: true
      });
    } else {
      wx.showToast({
        title: '无管理员权限',
        icon: 'none'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 加载词语列表
   */
  loadWords() {
    this.setData({ isLoading: true });
    
    wx.cloud.callFunction({
      name: 'getWords',
      success: res => {
        if (res.result && res.result.code === 0) {
          // 过滤出有图片的词语
          const words = res.result.data;
          const wordsWithImages = words.filter(word => word.imagePath);
          const wordsWithoutImages = words.filter(word => !word.imagePath);
          
          this.setData({
            words: words,
            wordsWithImages: wordsWithImages,
            wordsWithoutImages: wordsWithoutImages,
            isLoading: false
          });
        } else {
          this.setData({ isLoading: false });
          wx.showToast({
            title: '获取词语失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取词语失败:', err);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '获取词语失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 上传词语图片
   */
  uploadWordImages() {
    wx.showModal({
      title: '上传确认',
      content: '确定要上传词语图片吗？这将把本地images/words目录下的图片上传到云存储。',
      success: res => {
        if (res.confirm) {
          this.setData({ isLoading: true });
          
          wx.showLoading({
            title: '上传中...',
          });
          
          // 调用上传图片云函数
          wx.cloud.callFunction({
            name: 'uploadWordImages',
            success: res => {
              wx.hideLoading();
              
              if (res.result && res.result.success) {
                this.setData({
                  hasUploaded: true,
                  uploadResults: res.result,
                  isLoading: false
                });
                
                wx.showToast({
                  title: '上传成功',
                  icon: 'success'
                });
              } else {
                this.setData({ isLoading: false });
                wx.showToast({
                  title: '上传失败',
                  icon: 'none'
                });
              }
            },
            fail: err => {
              wx.hideLoading();
              console.error('上传图片失败:', err);
              this.setData({ isLoading: false });
              wx.showToast({
                title: '上传失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  /**
   * 更新词语图片路径
   */
  updateWordImagePaths() {
    wx.showModal({
      title: '更新确认',
      content: '确定要更新词语图片路径吗？这将为每个词语添加对应的图片路径。',
      success: res => {
        if (res.confirm) {
          this.setData({ isLoading: true });
          
          wx.showLoading({
            title: '更新中...',
          });
          
          // 调用更新图片路径云函数
          wx.cloud.callFunction({
            name: 'updateWordImages',
            success: res => {
              wx.hideLoading();
              
              if (res.result && res.result.success) {
                this.setData({
                  hasUpdated: true,
                  updateResults: res.result,
                  isLoading: false
                });
                
                // 重新加载词语列表
                this.loadWords();
                
                wx.showToast({
                  title: '更新成功',
                  icon: 'success'
                });
              } else {
                this.setData({ isLoading: false });
                wx.showToast({
                  title: '更新失败',
                  icon: 'none'
                });
              }
            },
            fail: err => {
              wx.hideLoading();
              console.error('更新图片路径失败:', err);
              this.setData({ isLoading: false });
              wx.showToast({
                title: '更新失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  /**
   * 返回管理页面
   */
  goBack() {
    wx.navigateBack();
  }
}) 