const app = getApp()
const db = wx.cloud.database()
const _ = db.command
const wordService = require('../../../services/wordService')
const fileService = require('../../../services/fileService')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    words: [],
    loading: false,
    searchText: '',
    filteredWords: [],
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalWords: 0,
    hasAudioFilter: 'all', // 'all', 'has', 'none'
    // 批量上传相关
    isUploading: false,
    uploadStatus: '',
    uploadedCount: 0,
    totalUploadCount: 0,
    uploadProgress: {
      total: 0,
      current: 0,
      percentage: 0,
      message: ''
    },
    uploadResults: {
      success: 0,
      failed: 0,
      skipped: 0
    },
    isDeleteMode: false,
    selectedWords: {},
    selectedCount: 0,
    isDeleting: false,
    deleteProgress: {
      total: 0,
      current: 0,
      percentage: 0,
      message: ''
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadWords()
  },

  /**
   * 页面显示时加载数据
   */
  onShow() {
    this.loadWords();
  },

  /**
   * 加载词汇数据
   */
  loadWords: async function() {
    this.setData({ loading: true });
    
    try {
      // 从服务获取词汇数据
      const wordsData = await wordService.getAllWords();
      
      if (!wordsData || wordsData.length === 0) {
        this.setData({
          words: [],
          filteredWords: [],
          loading: false,
          totalWords: 0,
          totalPages: 0
        });
        return;
      }
      
      // 输出调试信息
      console.log('词汇数据示例:', wordsData.slice(0, 2));
      
      // 计算总页数
      const totalPages = Math.ceil(wordsData.length / this.data.pageSize);
      
      this.setData({
        words: wordsData,
        totalWords: wordsData.length,
        totalPages: totalPages,
        loading: false
      });
      
      // 应用过滤和分页
      this.filterAndPaginate();
    } catch (error) {
      console.error('加载词汇数据失败:', error);
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },
  
  /**
   * 应用过滤和分页
   */
  filterAndPaginate: function() {
    const { words, searchText, currentPage, pageSize, hasAudioFilter } = this.data;
    
    // 应用搜索过滤
    let filtered = words;
    
    if (searchText) {
      filtered = words.filter(word => 
        word.word.includes(searchText) || 
        (word.pinyin && word.pinyin.includes(searchText))
      );
    }
    
    // 应用录音过滤
    if (hasAudioFilter === 'has') {
      filtered = filtered.filter(word => word.audioFileId);
    } else if (hasAudioFilter === 'none') {
      filtered = filtered.filter(word => !word.audioFileId);
    }
    
    // 计算总页数
    const totalPages = Math.ceil(filtered.length / pageSize);
    
    // 计算当前页数据
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginatedWords = filtered.slice(start, end);
    
    this.setData({
      filteredWords: paginatedWords,
      totalPages: totalPages,
      totalWords: filtered.length
    });
  },
  
  /**
   * 搜索输入变化
   */
  onSearchInput: function(e) {
    this.setData({
      searchText: e.detail.value,
      currentPage: 1
    }, () => {
      this.filterAndPaginate()
    });
  },
  
  /**
   * 切换录音过滤器
   */
  changeAudioFilter: function(e) {
    const type = e.currentTarget.dataset.type;
    
    this.setData({
      hasAudioFilter: type,
      currentPage: 1 // 重置到第一页
    }, this.filterAndPaginate);
  },
  
  /**
   * 上一页
   */
  prevPage: function() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      }, this.filterAndPaginate);
    }
  },
  
  /**
   * 下一页
   */
  nextPage: function() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1
      }, this.filterAndPaginate);
    }
  },
  
  /**
   * 导航到词汇详情页面，用于录音管理
   */
  goToWordDetail: function(e) {
    if (this.data.isDeleteMode) {
      // 在删除模式下点击词汇项应该切换选择状态
      this.toggleWordSelection(e)
      return
    }
    
    const wordId = e.currentTarget.dataset.wordid;
    const word = e.currentTarget.dataset.word;
    
    wx.navigateTo({
      url: `/pages/learn/learn?wordId=${wordId}&word=${word}&isAdmin=true`
    });
  },
  
  /**
   * 播放音频
   */
  playAudio: function(e) {
    const wordId = e.currentTarget.dataset.wordid;
    
    // 防止冒泡触发goToWordDetail
    e.stopPropagation()
    
    // 查找词汇
    const word = this.data.filteredWords.find(w => w._id === wordId);
    if (!word) {
      console.error('找不到词汇', wordId);
      wx.showToast({
        title: '找不到词汇',
        icon: 'none'
      });
      return;
    }
    
    console.log('开始播放音频', word.word);
    wx.showLoading({
      title: '加载音频...'
    });
    
    // 直接从word_audios目录播放
    this.playAudioFromWordAudios(word.word)
      .catch(err => {
        console.error('从word_audios播放失败，尝试使用fileID', err);
        // 如果直接从目录播放失败，尝试使用fileID(兼容旧数据)
        if (word.audioFileId) {
          return this.playAudioWithFileID(word.audioFileId);
        } else {
          throw new Error('没有有效的音频文件');
        }
      })
      .catch(err => {
        console.error('播放音频失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '播放失败',
          icon: 'none'
        });
      });
  },
  
  // 直接从word_audios目录播放
  playAudioFromWordAudios: function(wordName) {
    // 检查用户声音设置
    const userSettings = wx.getStorageSync('userSettings') || {};
    if (userSettings.soundEnabled === false) {
      wx.showToast({
        title: '声音已关闭',
        icon: 'none'
      });
      return;
    }
    return new Promise((resolve, reject) => {
      // 直接查找以词语名称命名的音频文件
      const oldFileID = `cloud://cloud1-2gryxvfp3568274.636c-cloud1-2gryxvfp3568274-1366502308/word_audios/${wordName}.aac`;
      
      // 获取当前云环境ID
      const envID = 'cloud1-2gryxvfp3568274';
      const fileID = `cloud://${envID}/word_audios/${wordName}.aac`;
      
      console.log('尝试播放音频文件:', fileID);
      
      // 使用简化的文件路径格式
      const simpleFileID = `cloud://cloud1-2gryxvfp3568274/word_audios/${wordName}.aac`;
      console.log('使用简化的文件路径:', simpleFileID);
      
      // 获取文件URL
      wx.cloud.getTempFileURL({
        fileList: [simpleFileID],
        success: res => {
          const fileInfo = res.fileList[0];
          if (fileInfo.status === 0) {
            const tempURL = fileInfo.tempFileURL;
            console.log('获取到临时URL', tempURL);
            
            // 播放音频
            const innerAudioContext = wx.createInnerAudioContext();
            innerAudioContext.src = tempURL;
            
            innerAudioContext.onCanplay(() => {
              console.log('音频准备就绪(word_audios方式)，开始播放');
              wx.hideLoading();
              innerAudioContext.play();
            });
            
            innerAudioContext.onPlay(() => {
              console.log('音频播放中(word_audios方式)');
            });
            
            innerAudioContext.onEnded(() => {
              console.log('音频播放结束(word_audios方式)');
              innerAudioContext.destroy();
              resolve();
            });
            
            innerAudioContext.onError((err) => {
              console.error('音频播放错误(word_audios方式)', err);
              innerAudioContext.destroy();
              reject(err);
            });
          } else {
            console.error('文件不存在或获取URL失败', fileInfo);
            
            // 尝试直接获取文件，不指定扩展名
            const noExtFileID = `cloud://cloud1-2gryxvfp3568274/word_audios/${wordName}`;
            console.log('尝试不带扩展名的文件ID:', noExtFileID);
            
            wx.cloud.getTempFileURL({
              fileList: [noExtFileID],
              success: innerRes => {
                const innerFileInfo = innerRes.fileList[0];
                if (innerFileInfo.status === 0) {
                  const innerTempURL = innerFileInfo.tempFileURL;
                  console.log('获取到临时URL', innerTempURL);
                  
                  // 播放音频
                  const innerAudioContext = wx.createInnerAudioContext();
                  innerAudioContext.src = innerTempURL;
                  
                  innerAudioContext.onCanplay(() => {
                    console.log('音频准备就绪(无扩展名方式)，开始播放');
                    wx.hideLoading();
                    innerAudioContext.play();
                  });
                  
                  innerAudioContext.onPlay(() => {
                    console.log('音频播放中(无扩展名方式)');
                  });
                  
                  innerAudioContext.onEnded(() => {
                    console.log('音频播放结束(无扩展名方式)');
                    innerAudioContext.destroy();
                    resolve();
                  });
                  
                  innerAudioContext.onError((err) => {
                    console.error('音频播放错误(无扩展名方式)', err);
                    innerAudioContext.destroy();
                    reject(err);
                  });
                } else {
                  reject(new Error('文件不存在或获取URL失败'));
                }
              },
              fail: innerErr => {
                console.error('第二次获取临时URL失败', innerErr);
                reject(innerErr);
              }
            });
          }
        },
        fail: err => {
          console.error('获取临时URL失败', err);
          reject(err);
        }
      });
    });
  },
  
  // 使用文件ID直接播放
  playAudioWithFileID: function(fileID) {
    // 检查用户声音设置
    const userSettings = wx.getStorageSync('userSettings') || {};
    if (userSettings.soundEnabled === false) {
      wx.showToast({
        title: '声音已关闭',
        icon: 'none'
      });
      return;
    }
    return new Promise((resolve, reject) => {
      const innerAudioContext = wx.createInnerAudioContext();
      innerAudioContext.src = fileID;
      
      innerAudioContext.onCanplay(() => {
        console.log('音频准备就绪，开始播放');
        wx.hideLoading();
        innerAudioContext.play();
      });
      
      innerAudioContext.onPlay(() => {
        console.log('音频播放中');
      });
      
      innerAudioContext.onEnded(() => {
        console.log('音频播放结束');
        innerAudioContext.destroy();
        resolve();
      });
      
      innerAudioContext.onError((err) => {
        console.error('音频播放错误', err);
        innerAudioContext.destroy();
        reject(err);
      });
      
      // 设置超时检查
      setTimeout(() => {
        if (!innerAudioContext.paused) {
          console.log('音频正在播放，无需处理');
        } else {
          console.log('音频未开始播放，可能出现问题');
          innerAudioContext.destroy();
          reject(new Error('播放超时'));
        }
      }, 3000);
    });
  },
  
  // 通过词汇名获取临时URL播放
  playAudioWithTempURL: function(word) {
    // 检查用户声音设置
    const userSettings = wx.getStorageSync('userSettings') || {};
    if (userSettings.soundEnabled === false) {
      wx.showToast({
        title: '声音已关闭',
        icon: 'none'
      });
      return;
    }
    return new Promise((resolve, reject) => {
      wordService.getWordAudioUrl(word)
        .then(url => {
          if (!url) {
            reject(new Error('获取音频URL失败'));
            return;
          }
          
          console.log('获取到临时URL', url);
          const innerAudioContext = wx.createInnerAudioContext();
          innerAudioContext.src = url;
          
          innerAudioContext.onCanplay(() => {
            console.log('音频准备就绪(URL方式)，开始播放');
            wx.hideLoading();
            innerAudioContext.play();
          });
          
          innerAudioContext.onPlay(() => {
            console.log('音频播放中(URL方式)');
          });
          
          innerAudioContext.onEnded(() => {
            console.log('音频播放结束(URL方式)');
            innerAudioContext.destroy();
            resolve();
          });
          
          innerAudioContext.onError((err) => {
            console.error('音频播放错误(URL方式)', err);
            innerAudioContext.destroy();
            reject(err);
          });
        })
        .catch(reject);
    });
  },

  /**
   * 批量上传录音文件
   */
  uploadAudioFiles: function() {
    // 防止重复上传
    if (this.data.isUploading) {
      wx.showToast({
        title: '正在上传中，请等待',
        icon: 'none'
      });
      return;
    }

    // 选择文件
    wx.chooseMessageFile({
      count: 100, // 允许选择的文件数量，最大可设置为100
      type: 'file',
      extension: ['mp4', 'aac'],
      success: (res) => {
        const tempFiles = res.tempFiles;
        if (!tempFiles || tempFiles.length === 0) {
          wx.showToast({
            title: '未选择任何文件',
            icon: 'none'
          });
          return;
        }

        this.processAudioFiles(tempFiles);
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 处理选择的音频文件
   */
  processAudioFiles: function(tempFiles) {
    // 初始化上传状态
    this.setData({
      isUploading: true,
      uploadedCount: 0,
      totalUploadCount: tempFiles.length,
      uploadProgress: {
        total: tempFiles.length,
        current: 0,
        percentage: 0,
        message: '准备上传...'
      },
      uploadStatus: '准备上传...',
      uploadResults: {
        success: 0,
        failed: 0,
        skipped: 0
      }
    });

    // 从文件名中提取词汇名
    const uploadTasks = tempFiles.map(file => {
      // 从文件路径中提取文件名
      const fileName = file.name || file.path.split('/').pop();
      // 获取文件扩展名
      const fileExt = fileName.split('.').pop().toLowerCase();
      // 获取词汇名（去除扩展名）
      const wordName = fileName.replace(`.${fileExt}`, '');
      
      return {
        word: wordName,
        filePath: file.path,
        fileName: fileName,
        fileType: fileExt === 'mp4' ? 'mp4' : 'aac'
      };
    });

    // 检查词汇是否存在于系统中
    const allWords = this.data.words;
    const validTasks = [];
    
    // 打印当前所有词汇进行调试
    console.log('当前系统中的词汇列表:', allWords.map(word => word.word));
    
    for (const task of uploadTasks) {
      // 查找精确匹配的词汇
      const matchedWord = allWords.find(w => w.word === task.word);
      
      if (matchedWord) {
        // 词汇存在，记录词汇ID
        validTasks.push({
          ...task,
          wordId: matchedWord.id || matchedWord._id
        });
        console.log(`词汇 "${task.word}" 匹配成功，ID: ${matchedWord.id || matchedWord._id}`);
      } else {
        console.log(`词汇 "${task.word}" 不存在于系统中，尝试其他匹配方式`);
        
        // 尝试不区分大小写匹配
        const altMatchedWord = allWords.find(w => 
          w.word.toLowerCase() === task.word.toLowerCase()
        );
        
        if (altMatchedWord) {
          validTasks.push({
            ...task,
            word: altMatchedWord.word, // 使用数据库中的精确词汇名
            wordId: altMatchedWord.id || altMatchedWord._id
          });
          console.log(`词汇 "${task.word}" 通过不区分大小写匹配到 "${altMatchedWord.word}"`);
        } else {
          // 仍未匹配到词汇
          console.log(`词汇 "${task.word}" 无法匹配，跳过上传`);
          this.setData({
            'uploadResults.skipped': this.data.uploadResults.skipped + 1
          });
        }
      }
    }

    if (validTasks.length === 0) {
      this.setData({
        isUploading: false,
        uploadStatus: '没有可上传的文件，请确保文件名与词汇名称一致'
      });
      return;
    }

    // 开始上传
    this.uploadAudioFilesSequentially(validTasks, 0);
  },

  /**
   * 按顺序上传文件
   */
  uploadAudioFilesSequentially: function(tasks, index) {
    if (index >= tasks.length) {
      // 所有任务完成
      const { success, failed, skipped } = this.data.uploadResults;
      this.setData({
        isUploading: false,
        uploadProgress: {
          total: this.data.totalUploadCount,
          current: this.data.uploadedCount,
          percentage: 100,
          message: `上传完成: ${success} 成功, ${failed} 失败, ${skipped} 跳过`
        },
        uploadStatus: `上传完成: ${success} 成功, ${failed} 失败, ${skipped} 跳过`
      });
      
      // 重新加载数据以更新UI
      this.loadWords();
      return;
    }

    const task = tasks[index];
    this.setData({
      uploadStatus: `正在上传: ${task.word} (${index + 1}/${tasks.length})`,
    });

    // 上传文件到云存储
    const cloudPath = `word_audios/${task.word}_${Date.now()}.${task.fileType}`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: task.filePath,
      success: (res) => {
        const fileID = res.fileID;
        // 更新数据库中的音频信息
        this.updateWordAudioInfo(task.word, fileID, task.fileType)
          .then(() => {
            // 上传成功
            this.setData({
              uploadedCount: this.data.uploadedCount + 1,
              uploadProgress: {
                total: this.data.totalUploadCount,
                current: this.data.uploadedCount + 1,
                percentage: Math.floor((this.data.uploadedCount / this.data.totalUploadCount) * 100),
                message: `上传中 (${this.data.uploadedCount + 1}/${this.data.totalUploadCount}): ${task.word}`
              },
              'uploadResults.success': this.data.uploadResults.success + 1
            });
          })
          .catch(err => {
            console.error('更新词汇音频信息失败:', err);
            this.setData({
              uploadedCount: this.data.uploadedCount + 1,
              uploadProgress: {
                total: this.data.totalUploadCount,
                current: this.data.uploadedCount + 1,
                percentage: Math.floor((this.data.uploadedCount / this.data.totalUploadCount) * 100),
                message: `上传失败: ${task.word}`,
              },
              'uploadResults.failed': this.data.uploadResults.failed + 1
            });
          })
          .finally(() => {
            // 继续下一个任务
            setTimeout(() => {
              this.uploadAudioFilesSequentially(tasks, index + 1);
            }, 200); // 添加小延迟，避免过快请求
          });
      },
      fail: (err) => {
        console.error('上传文件失败:', err, task);
        this.setData({
          uploadedCount: this.data.uploadedCount + 1,
          uploadProgress: {
            total: this.data.totalUploadCount,
            current: this.data.uploadedCount + 1,
            percentage: Math.floor((this.data.uploadedCount / this.data.totalUploadCount) * 100),
            message: `上传失败: ${task.word}`,
          },
          'uploadResults.failed': this.data.uploadResults.failed + 1
        });
        
        // 继续下一个任务
        setTimeout(() => {
          this.uploadAudioFilesSequentially(tasks, index + 1);
        }, 200);
      }
    });
  },

  /**
   * 更新词汇的音频信息
   */
  updateWordAudioInfo: function(word, fileID, fileType) {
    return new Promise((resolve, reject) => {
      console.log(`准备更新词汇音频: 词汇=${word}, 文件ID=${fileID}, 类型=${fileType}`);
      
      // 先通过词汇名查找词汇对象
      const wordObj = this.data.words.find(w => w.word === word);
      
      if (!wordObj) {
        console.error(`未在本地数据中找到词汇: ${word}`);
        reject(new Error(`未找到词汇: ${word}`));
        return;
      }
      
      // 确定词汇ID
      let wordId = null;
      
      // 检查不同的ID字段格式
      if (wordObj._id) {
        wordId = wordObj._id;
        console.log(`使用_id: ${wordId}`);
      } else if (wordObj.id) {
        wordId = wordObj.id;
        console.log(`使用id: ${wordId}`);
      } else {
        console.error('词汇对象中没有有效的ID字段:', wordObj);
        reject(new Error('词汇对象中没有有效的ID字段'));
        return;
      }
      
      console.log(`找到词汇ID: ${wordId}, 词汇对象:`, wordObj);
      
      // 调用云函数
      wx.cloud.callFunction({
        name: 'updateWordAudio',
        data: {
          wordId: wordId,
          word: word,
          audioFileId: fileID,
          audioFileType: fileType
        },
        success: (res) => {
          console.log('云函数返回结果:', res);
          if (res.result && res.result.code === 0) {
            // 更新本地数据
            wordObj.audioFileId = fileID;
            wordObj.audioFileType = fileType;
            
            resolve(res.result);
          } else {
            const errorMsg = res.result?.message || '未知错误';
            console.error('云函数返回错误:', errorMsg, res);
            reject(new Error('更新词汇音频信息失败: ' + errorMsg));
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          reject(err);
        }
      });
    });
  },

  // ---------------- 批量删除功能 ----------------

  /**
   * 切换删除模式
   */
  toggleDeleteMode: function() {
    this.setData({
      isDeleteMode: !this.data.isDeleteMode,
      selectedWords: {},
      selectedCount: 0
    });
  },

  /**
   * 切换词汇选择
   */
  toggleWordSelection: function(e) {
    const wordId = e.currentTarget.dataset.id;
    const word = this.data.filteredWords.find(w => w._id === wordId);
    
    if (!word) return;
    
    const selectedWords = { ...this.data.selectedWords };
    
    if (selectedWords[wordId]) {
      delete selectedWords[wordId];
    } else {
      selectedWords[wordId] = word;
    }
    
    this.setData({
      selectedWords: selectedWords,
      selectedCount: Object.keys(selectedWords).length
    });
  },

  /**
   * 选择所有词汇
   */
  selectAllWords: function() {
    const selectedWords = {};
    this.data.filteredWords.forEach(word => {
      selectedWords[word._id] = word;
    });
    
    this.setData({
      selectedWords: selectedWords,
      selectedCount: Object.keys(selectedWords).length
    });
  },

  /**
   * 取消所有选择
   */
  deselectAllWords: function() {
    this.setData({
      selectedWords: {},
      selectedCount: 0
    });
  },

  /**
   * 选择有音频的词汇
   */
  selectHasAudioWords: function() {
    const selectedWords = {};
    this.data.filteredWords.forEach(word => {
      if (word.audioFileId) {
        selectedWords[word._id] = word;
      }
    });
    
    this.setData({
      selectedWords: selectedWords,
      selectedCount: Object.keys(selectedWords).length
    });
  },

  /**
   * 删除选中的词汇音频
   */
  deleteSelectedAudios: async function() {
    const selectedWords = this.data.selectedWords;
    const selectedIds = Object.keys(selectedWords);
    
    if (selectedIds.length === 0) {
      wx.showToast({
        title: '请先选择词汇',
        icon: 'none'
      });
      return;
    }
    
    // 确认删除
    wx.showModal({
      title: '确认删除',
      content: `确定要删除这${selectedIds.length}个词汇的音频吗？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#f44336',
      success: res => {
        if (res.confirm) {
          this.performDelete(selectedIds, selectedWords);
        }
      }
    });
  },

  /**
   * 执行删除操作
   */
  performDelete: async function(selectedIds, selectedWords) {
    this.setData({
      isDeleting: true,
      deleteProgress: {
        total: selectedIds.length,
        current: 0,
        percentage: 0,
        message: '准备删除...'
      }
    });
    
    const totalCount = selectedIds.length;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < selectedIds.length; i++) {
      const wordId = selectedIds[i];
      const word = selectedWords[wordId];
      
      this.setData({
        'deleteProgress.current': i + 1,
        'deleteProgress.percentage': Math.round(((i + 1) / totalCount) * 100),
        'deleteProgress.message': `删除中 (${i + 1}/${totalCount}): ${word.word}`
      });
      
      try {
        if (word.audioFileId) {
          // 1. 删除云存储中的音频文件
          await fileService.deleteFile(word.audioFileId);
          
          // 2. 更新数据库中的词汇记录，清除audioFileId
          await this.removeWordAudio(wordId);
          
          successCount++;
        } else {
          console.log(`词汇 ${word.word} 没有音频，跳过`);
        }
      } catch (error) {
        console.error(`删除音频失败: ${word.word}`, error);
        failCount++;
      }
    }
    
    this.setData({
      isDeleting: false,
      'deleteProgress.message': `删除完成: ${successCount}个成功, ${failCount}个失败`,
      isDeleteMode: false,
      selectedWords: {},
      selectedCount: 0
    });
    
    // 重新加载数据
    this.loadWords();
    
    wx.showToast({
      title: `删除完成: ${successCount}个成功`,
      icon: 'success'
    });
  },

  /**
   * 移除词汇的音频ID
   */
  removeWordAudio: function(wordId) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'removeWordAudio',
        data: {
          wordId: wordId
        },
        success: res => {
          console.log(`词汇音频移除成功: ${wordId}`, res);
          resolve(res);
        },
        fail: err => {
          console.error(`词汇音频移除失败: ${wordId}`, err);
          reject(err);
        }
      });
    });
  }
}); 