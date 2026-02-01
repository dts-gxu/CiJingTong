// pages/practice/practice.js
// 导入词语服务
const wordService = require('../../services/wordService');

// 导入拼音题库数据
const pinyinQuizData = require('../../data/pinyinQuizData');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentWord: null,
    currentIndex: 0,
    totalWords: 0,
    progressPercent: 0,
    options: [],
    selectedOption: '',
    isCorrect: false,
    showAnswer: false,
    isCompleted: false,
    results: [],
    stats: {
      correct: 0,
      total: 0,
      percent: 0
    },
    practiceMode: 'pinyin', // 从拼音练习开始
    completedPinyinExercises: 0, // 已完成的拼音练习数量
    completedFillBlankExercises: 0, // 已完成的选词填空练习数量
    totalExercisesPerType: 7, // 每种练习类型的总数量
    currentExerciseWords: [], // 当前练习的词语列表
    pinyinWords: [], // 拼音练习的词语列表
    fillBlankWords: [], // 选词填空的词语列表
    correctPinyinAnswer: '', // 当前拼音练习的正确答案
    learningHistory: {
      completedWords: [],
      reviewWords: [],
      lastReviewTime: null,
      stage: 1 // 学习阶段：1=初次学习，2=复习阶段
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    console.log('练习页面加载');
    
    try {
      // 获取全局应用实例
      const app = getApp();
      
      // 获取用户设置
      const userSettings = wx.getStorageSync('userSettings') || {};
      const practiceMode = userSettings.practiceMode || 'mixed';
      
      // 根据用户设置决定练习模式
      if (practiceMode === 'pinyin') {
        this.setData({ practiceMode: 'pinyin' });
      } else if (practiceMode === 'fillBlank') {
        this.setData({ practiceMode: 'fillBlank' });
      } else {
        this.setData({ practiceMode: 'pinyin' }); // 混合模式仍从拼音开始
      }
      
      // 获取用户学习记录
      const learningHistory = wx.getStorageSync('learningHistory') || {
        completedWords: [],
        reviewWords: [],
        lastReviewTime: null,
        stage: 1 // 学习阶段：1=初次学习，2=复习阶段
      };
      
      console.log('当前学习记录:', learningHistory);
      
      // 获取当前学习组（如果存在）
      const currentLearningGroup = wx.getStorageSync('currentLearningGroup');
      const currentLearningWords = currentLearningGroup && currentLearningGroup.words ? currentLearningGroup.words : [];
      
      console.log('当前学习组词语:', currentLearningWords);
      
      // 如果是新的学习组，清除旧的练习进度
      if (currentLearningGroup && currentLearningGroup.timestamp) {
        const savedProgress = wx.getStorageSync('currentPracticeProgress');
        if (!savedProgress || !savedProgress.timestamp || 
            savedProgress.timestamp < currentLearningGroup.timestamp) {
          console.log('检测到新的学习组，清除旧的练习进度');
          wx.removeStorageSync('currentPracticeProgress');
        }
      }
      
      // 导入拼音题库数据
      const pinyinQuizData = require('../../data/pinyinQuizData');
      
      // 如果有当前学习组，则使用学习组中的词语进行练习
      let pinyinWords = [];
      if (currentLearningWords && currentLearningWords.length > 0) {
        // 从拼音题库中筛选出当前学习组中的词语
        pinyinWords = pinyinQuizData.pinyin_quiz.filter(word => 
          currentLearningWords.includes(word.word)
        );
        
        console.log('从当前学习组筛选出的拼音练习词语:', pinyinWords.map(w => w.word));
      } else {
        // 如果没有当前学习组，则根据学习记录筛选词语
        pinyinWords = [...pinyinQuizData.pinyin_quiz];
        
        // 当前时间
        const now = new Date().getTime();
        
        if (learningHistory.stage === 1) {
          // 初次学习阶段：过滤掉已学习的词汇
          if (learningHistory.completedWords.length > 0) {
            pinyinWords = pinyinWords.filter(word => 
              !learningHistory.completedWords.some(completed => completed.word === word.word)
            );
          }
        } else {
          // 复习阶段：只使用需要复习的词汇（已到达复习时间的词汇）
          // 先筛选出需要复习的词汇
          const wordsNeedingReview = learningHistory.completedWords.filter(word => 
            word.reviewDue && word.reviewDue <= now
          );
          
          console.log('需要复习的词汇:', wordsNeedingReview.map(w => w.word));
          
          // 将需要复习的词汇添加到reviewWords
          learningHistory.reviewWords = wordsNeedingReview;
          
          // 从拼音题库中筛选出需要复习的词汇
          if (learningHistory.reviewWords.length > 0) {
            pinyinWords = pinyinWords.filter(word => 
              learningHistory.reviewWords.some(review => review.word === word.word)
            );
          } else {
            // 如果没有需要复习的词汇，切换回学习阶段
            console.log('没有需要复习的词汇，切换回学习阶段');
            learningHistory.stage = 1;
            
            // 重新筛选未学习的词汇
            pinyinWords = pinyinWords.filter(word => 
              !learningHistory.completedWords.some(completed => completed.word === word.word)
            );
          }
        }
        
        // 保存更新的学习记录
        wx.setStorageSync('learningHistory', learningHistory);
        
        // 如果没有新词可学习，进入复习阶段
        if (pinyinWords.length === 0 && learningHistory.stage === 1) {
          console.log('没有新词可学习，等待旧词汇达到复习时间');
          wx.showToast({
            title: '您已学习完所有词汇，请等待复习时间',
            icon: 'none',
            duration: 2000
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
          return;
        }
      }
      
      // 打乱词语顺序
      const shuffledPinyinWords = this.shuffleArray([...pinyinWords]);
      
      // 限制每次练习的词汇数量
      const limitedPinyinWords = shuffledPinyinWords.slice(0, this.data.totalExercisesPerType);
      
      // 获取word_list中的词语用于填空练习
      wordService.getWordsFromWordList().then(words => {
        if (!words || words.length === 0) {
          wx.showToast({
            title: '没有可用的词语数据',
            icon: 'none'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }
        
        // 从word_list中筛选出与拼音练习相同的词语
        const pinyinWordTexts = limitedPinyinWords.map(w => w.word);
        const filteredWords = words.filter(word => pinyinWordTexts.includes(word.word));
        
        console.log('从word_list筛选出的填空练习词语:', filteredWords.map(w => w.word));
        
        // 如果筛选后的词语不足，则使用拼音练习词语代替
        let fillBlankWords = filteredWords;
        if (fillBlankWords.length < limitedPinyinWords.length) {
          console.log('word_list中匹配的词语不足，使用拼音练习词语代替');
          // 将拼音练习词语转换为填空题格式
          const convertedWords = limitedPinyinWords.map(word => {
            return {
              word: word.word,
              fillBlank: {
                prefix: `请在括号中填入正确的词语"${word.word}"：（`,
                suffix: `）`,
                answer: word.word
              }
            };
          });
          fillBlankWords = convertedWords;
        }
        
        // 打乱填空词语顺序
        const shuffledFillBlankWords = this.shuffleArray([...fillBlankWords]);
        
        // 限制填空练习的词汇数量
        const limitedFillBlankWords = shuffledFillBlankWords.slice(0, this.data.totalExercisesPerType);
        
        this.setData({
          pinyinWords: limitedPinyinWords,
          fillBlankWords: limitedFillBlankWords,
          currentExerciseWords: limitedPinyinWords, // 默认从拼音练习开始
          totalWords: this.data.totalExercisesPerType * 2, // 固定为 7*2=14，每种练习类型固定7个
          completedPinyinExercises: 0,
          completedFillBlankExercises: 0,
          practiceMode: 'pinyin', // 确保从拼音练习开始
          learningHistory: learningHistory // 保存学习记录到页面数据中
        });
        
        // 尝试恢复之前的进度
        const restored = this.tryResumeProgress();
        
        if (!restored) {
          // 如果没有恢复进度，加载第一个练习
          this.loadCurrentExercise();
        }
      }).catch(error => {
        console.error('获取词语数据失败:', error);
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
      });
    } catch (error) {
      console.error('初始化练习失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
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
   * 准备练习词语
   */
  prepareExerciseWords: function(words) {
    // 随机打乱词语顺序
    const shuffledWords = this.shuffleArray([...words]);
    
    // 限制词语数量
    return shuffledWords.slice(0, this.data.totalExercisesPerType);
  },

  /**
   * 尝试恢复之前的练习进度
   */
  tryResumeProgress: function() {
    try {
      const savedProgress = wx.getStorageSync('currentPracticeProgress');
      
      if (savedProgress) {
        console.log('恢复之前的练习进度', savedProgress);
        
        // 检查保存的进度是否过期（缩短为2小时）
        const savedTime = new Date(savedProgress.timestamp).getTime();
        const currentTime = new Date().getTime();
        const timeLimit = 2 * 60 * 60 * 1000; // 2小时
        
        if (currentTime - savedTime > timeLimit) {
          console.log('保存的进度已过期，不恢复');
          wx.removeStorageSync('currentPracticeProgress');
          return false;
        }
        
        // 检查当前学习组是否与保存的进度匹配
        const currentLearningGroup = wx.getStorageSync('currentLearningGroup');
        if (!currentLearningGroup || !currentLearningGroup.timestamp || 
            currentLearningGroup.timestamp > savedProgress.timestamp) {
          console.log('学习组已更新，不恢复旧进度');
          wx.removeStorageSync('currentPracticeProgress');
          return false;
        }
        
        // 关键修改：始终从拼音练习开始，但保留results数据
        // 这样可以保留用户已完成练习的结果，但重新开始练习流程
        const savedResults = savedProgress.results || [];
        
        this.setData({
          practiceMode: 'pinyin', // 强制从拼音练习开始
          completedPinyinExercises: 0, // 重置拼音练习计数
          completedFillBlankExercises: 0, // 重置填空练习计数
          results: savedResults // 保留已有的练习结果
        });
        
        console.log('已保留练习结果，但重置练习进度，从拼音练习开始');
        
        // 加载第一个练习
        this.loadCurrentExercise();
        return true;
      }
    } catch (error) {
      console.error('恢复练习进度失败', error);
    }
    
    return false;
  },

  /**
   * 保存当前练习进度
   */
  saveProgress: function() {
    try {
      wx.setStorageSync('currentPracticeProgress', {
        practiceMode: this.data.practiceMode,
        completedPinyinExercises: this.data.completedPinyinExercises,
        completedFillBlankExercises: this.data.completedFillBlankExercises,
        results: this.data.results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('保存练习进度失败:', error);
    }
  },

  /**
   * 加载当前练习
   */
  loadCurrentExercise: function() {
    console.log('加载当前练习');
    
    try {
      // 根据当前练习模式选择相应的练习词语和进度
      let currentIndex, currentWord;
      
      if (this.data.practiceMode === 'pinyin') {
        // 拼音练习模式
        currentIndex = this.data.completedPinyinExercises;
        if (currentIndex >= this.data.pinyinWords.length) {
          console.warn('拼音练习索引超出范围，重置为0');
          currentIndex = 0;
          this.setData({ completedPinyinExercises: 0 });
        }
        currentWord = this.data.pinyinWords[currentIndex];
        console.log('加载拼音练习:', { 
          index: currentIndex, 
          totalPinyinWords: this.data.pinyinWords.length,
          word: currentWord ? currentWord.word : '未找到词语'
        });
      } else {
        // 选词填空模式
        currentIndex = this.data.completedFillBlankExercises;
        if (currentIndex >= this.data.fillBlankWords.length) {
          console.warn('填空练习索引超出范围，重置为0');
          currentIndex = 0;
          this.setData({ completedFillBlankExercises: 0 });
        }
        currentWord = this.data.fillBlankWords[currentIndex];
        console.log('加载选词填空练习:', { 
          index: currentIndex, 
          totalFillBlankWords: this.data.fillBlankWords.length,
          word: currentWord ? currentWord.word : '未找到词语'
        });
      }
      
      if (!currentWord) {
        console.error('当前词语不存在', { 
          currentIndex, 
          currentMode: this.data.practiceMode,
          pinyinWordsLength: this.data.pinyinWords.length,
          fillBlankWordsLength: this.data.fillBlankWords.length
        });
        
        // 如果当前词语不存在，切换到另一种练习模式或重置
        if (this.data.practiceMode === 'pinyin' && this.data.fillBlankWords.length > 0) {
          console.log('拼音练习词语不存在，切换到填空练习');
          this.setData({
            practiceMode: 'fillblank',
            completedFillBlankExercises: 0
          });
          return this.loadCurrentExercise(); // 递归调用
        } else if (this.data.practiceMode === 'fillblank' && this.data.pinyinWords.length > 0) {
          console.log('填空练习词语不存在，切换到拼音练习');
          this.setData({
            practiceMode: 'pinyin',
            completedPinyinExercises: 0
          });
          return this.loadCurrentExercise(); // 递归调用
        } else {
          // 如果两种模式都没有词语，显示错误并返回
          wx.showToast({
            title: '词语数据错误',
            icon: 'none'
          });
          
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
          return;
        }
      }
      
      // 计算总进度百分比
      const totalCompletedExercises = this.data.completedPinyinExercises + this.data.completedFillBlankExercises;
      const progressPercent = (totalCompletedExercises / this.data.totalWords) * 100;
      
      // 准备选项
      let options;
      try {
        if (this.data.practiceMode === 'pinyin') {
          options = this.preparePinyinOptions(currentWord);
          
          // 获取正确答案
          const correctAnswer = currentWord.options[currentWord.answer];
          console.log('拼音练习正确答案:', correctAnswer);
          
          this.setData({
            correctPinyinAnswer: correctAnswer
          });
        } else {
          options = this.prepareFillBlankOptions(currentWord);
        }
      } catch (optionError) {
        console.error('准备选项时出错:', optionError);
        
        // 创建默认选项
        if (this.data.practiceMode === 'pinyin') {
          options = ['选项A', '选项B', '选项C', '选项D'];
          this.setData({
            correctPinyinAnswer: options[0]
          });
        } else {
          options = [currentWord.word, '选项B', '选项C', '选项D'];
        }
      }
      
      console.log('成功加载练习词语:', { 
        word: currentWord.word,
        currentIndex,
        practiceMode: this.data.practiceMode
      });
      
      this.setData({
        currentWord,
        currentIndex,
        progressPercent,
        options,
        selectedOption: '',
        showAnswer: false,
        isCorrect: false
      });
    } catch (error) {
      console.error('加载当前练习失败:', error);
      
      // 显示错误信息
      wx.showToast({
        title: '加载练习失败',
        icon: 'none'
      });
      
      // 重置到初始状态
      this.setData({
        practiceMode: 'pinyin',
        completedPinyinExercises: 0,
        completedFillBlankExercises: 0
      });
      
      // 抛出错误以便上层函数处理
      throw error;
    }
  },

  /**
   * 准备拼音选项
   */
  preparePinyinOptions: function(word) {
    console.log('准备拼音选项:', word);
    
    // 对于拼音题库数据，直接使用选项
    if (word.options) {
      const options = [];
      for (const key in word.options) {
        if (word.options.hasOwnProperty(key) && key !== 'answer') {
          options.push(word.options[key]);
        }
      }
      return options;
    }
    
    // 使用词语自带的拼音选项
    if (word.pinyinQuiz && word.pinyinQuiz.options && word.pinyinQuiz.options.options) {
      console.log('使用词语自带的拼音选项:', word.pinyinQuiz.options);
      // 返回选项值的数组
      return word.pinyinQuiz.options.options.map(option => option.value);
    }
    
    // 如果没有预设选项，生成随机选项
    console.log('没有预设拼音选项，生成随机选项');
    const options = [word.pinyin];
    
    // 添加3个假选项 (简单示例，实际应该生成更合理的拼音变体)
    const fakePinyinOptions = [
      this.shufflePinyin(word.pinyin),
      this.shufflePinyin(word.pinyin),
      this.shufflePinyin(word.pinyin)
    ];
    
    console.log('生成的拼音选项:', [...options, ...fakePinyinOptions]);
    
    // 合并选项并打乱顺序
    return this.shuffleArray([...options, ...fakePinyinOptions]);
  },

  /**
   * 准备翻译选项
   */
  prepareOptions: function(word) {
    // 使用词语自带的选项
    if (word.options && word.options.length >= 4) {
      // 打乱选项顺序
      return this.shuffleArray([...word.options]);
    }
    
    // 如果没有预设选项，生成随机选项（实际应用中应该有更好的选项生成方法）
    const options = [word.translation];
    
    // 添加3个假选项
    const fakeOptions = ['fake option 1', 'fake option 2', 'fake option 3', 'fake option 4', 'fake option 5'];
    
    while (options.length < 4) {
      const fake = fakeOptions[Math.floor(Math.random() * fakeOptions.length)];
      if (!options.includes(fake)) {
        options.push(fake);
      }
    }
    
    // 打乱选项顺序
    return this.shuffleArray(options);
  },

  /**
   * 准备句子选项
   */
  prepareSentenceOptions: function(word) {
    // 如果词语有预设的多选题选项
    if (word.multipleChoice && word.multipleChoice.options) {
      return [
        word.multipleChoice.options.A,
        word.multipleChoice.options.B,
        word.multipleChoice.options.C,
        word.multipleChoice.options.D
      ];
    }
    
    // 如果没有预设选项，返回词语和一些随机词语
    const options = [word.word];
    
    // 添加3个假选项
    const fakeOptions = ['选项1', '选项2', '选项3', '选项4', '选项5'];
    
    while (options.length < 4) {
      const fake = fakeOptions[Math.floor(Math.random() * fakeOptions.length)];
      if (!options.includes(fake)) {
        options.push(fake);
      }
    }
    
    // 打乱选项顺序
    return this.shuffleArray(options);
  },

  /**
   * 准备选词填空选项
   */
  prepareFillBlankOptions: function(word) {
    console.log('准备填空题选项:', word);
    
    // 首先确保fillBlank是对象而不是字符串
    if (typeof word.fillBlank === 'string') {
      // 如果fillBlank是字符串，将其转换为对象
      const fillBlankStr = word.fillBlank;
      
      try {
        // 尝试解析字符串格式的fillBlank
        // 提取句子部分（题干）
        const sentenceMatch = fillBlankStr.match(/(.*?)(?=\s*A\.|$)/);
        let sentence = sentenceMatch ? sentenceMatch[1].trim() : '';
        
        // 提取前缀和后缀
        let prefix = '';
        let suffix = '';
        const bracketMatch = sentence.match(/(.*)（\s*）(.*)/);
        if (bracketMatch) {
          prefix = bracketMatch[1];
          suffix = bracketMatch[2];
        } else {
          // 如果没有明显的括号，尝试找到词语位置
          const wordIndex = sentence.indexOf(word.word);
          if (wordIndex !== -1) {
            prefix = sentence.substring(0, wordIndex);
            suffix = sentence.substring(wordIndex + word.word.length);
          } else {
            prefix = sentence;
            suffix = '';
          }
        }
        
        // 提取正确答案
        let answer = word.word;
        const answerMatch = fillBlankStr.match(/答案：\s*([A-D])/i);
        if (answerMatch) {
          const answerLetter = answerMatch[1];
          const optionMatch = fillBlankStr.match(new RegExp(answerLetter + "\\.\\s*([^\\s]+)"));
          if (optionMatch) {
            answer = optionMatch[1];
          }
        }
        
        // 创建新的fillBlank对象
        word.fillBlank = {
          sentence: sentence,
          prefix: prefix,
          suffix: suffix,
          answer: answer
        };
        
        console.log(`成功解析填空题字符串: ${word.word}`, word.fillBlank);
      } catch (err) {
        console.error(`解析填空题字符串失败: ${word.word}`, err);
        // 创建默认的fillBlank对象
        word.fillBlank = {
          sentence: `请选择"${word.word}"的正确用法。`,
          prefix: '请选择正确的词语：',
          suffix: '',
          answer: word.word
        };
      }
    }
    
    // 处理新导入的fillBlank格式（从Excel导入）
    if (word.fillBlank && typeof word.fillBlank === 'object') {
      // 确保sentence存在并且非空
      if (!word.fillBlank.sentence || !word.fillBlank.sentence.trim()) {
        // 创建默认的填空题
        word.fillBlank.sentence = `请选择"${word.word}"的正确用法。`;
        word.fillBlank.prefix = '请选择正确的词语：';
        word.fillBlank.suffix = '';
        word.fillBlank.answer = word.word;
      } 
      // 如果sentence存在但没有prefix和suffix，尝试分割
      else if (!word.fillBlank.prefix && !word.fillBlank.suffix) {
        const sentence = word.fillBlank.sentence;
        // 尝试找到带有括号的部分，如"我家对门住着一位热心的（）"
        const bracketMatch = sentence.match(/(.*)（\s*）(.*)/);
        if (bracketMatch) {
          word.fillBlank.prefix = bracketMatch[1];
          word.fillBlank.suffix = bracketMatch[2];
        } 
        // 尝试找到词语在句子中的位置
        else {
          const wordIndex = sentence.indexOf(word.word);
          if (wordIndex !== -1) {
            word.fillBlank.prefix = sentence.substring(0, wordIndex);
            word.fillBlank.suffix = sentence.substring(wordIndex + word.word.length);
          } else {
            // 如果没有明显分隔，直接使用整个句子作为前缀
            word.fillBlank.prefix = sentence;
            word.fillBlank.suffix = '';
          }
        }
      }
      
      // 记录处理后的填空题数据
      console.log('处理后的填空题数据:', {
        word: word.word,
        prefix: word.fillBlank.prefix,
        suffix: word.fillBlank.suffix,
        answer: word.fillBlank.answer || word.word
      });
    }
    // 如果词语没有fillBlank属性，创建一个默认的
    else if (!word.fillBlank) {
      // 使用例句来创建填空题
      if (word.example && word.example.chinese) {
        const sentence = word.example.chinese;
        const wordIndex = sentence.indexOf(word.word);
        
        if (wordIndex !== -1) {
          word.fillBlank = {
            prefix: sentence.substring(0, wordIndex),
            suffix: sentence.substring(wordIndex + word.word.length),
            sentence: sentence,
            answer: word.word
          };
        } else {
          // 如果例句中没有这个词，创建一个简单的填空
          word.fillBlank = {
            prefix: '请选择正确的词语：',
            suffix: '',
            sentence: '请选择正确的词语：',
            answer: word.word
          };
        }
      } else {
        // 如果没有例句，创建一个简单的填空
        word.fillBlank = {
          prefix: '请选择正确的词语：',
          suffix: '',
          sentence: '请选择正确的词语：',
          answer: word.word
        };
      }
    }
    
    // 确保fillBlank对象有所有必要的字段
    if (!word.fillBlank.answer) {
      word.fillBlank.answer = word.word;
    }
    if (!word.fillBlank.prefix) {
      word.fillBlank.prefix = '';
    }
    if (!word.fillBlank.suffix) {
      word.fillBlank.suffix = '';
    }
    
    // 准备选项
    const options = [word.fillBlank.answer || word.word];
    
    // 获取所有词语
    const app = getApp();
    const currentGroup = app.globalData.currentGroup;
    const allWords = currentGroup ? currentGroup.words : [];
    
    // 随机选择3个不同的词语作为干扰项
    if (allWords && allWords.length > 3) {
      let attempts = 0;
      while (options.length < 4 && attempts < 20) {
        attempts++;
        const randomIndex = Math.floor(Math.random() * allWords.length);
        const randomWord = allWords[randomIndex].word;
        
        if (!options.includes(randomWord) && randomWord !== word.word) {
          options.push(randomWord);
        }
      }
      
      // 如果尝试20次后仍未找到足够的选项，使用通用选项补充
      if (options.length < 4) {
        const genericOptions = ['学习', '工作', '生活', '思考', '运动', '休息', '吃饭', '睡觉'];
        while (options.length < 4) {
          const randomOption = genericOptions[Math.floor(Math.random() * genericOptions.length)];
          if (!options.includes(randomOption)) {
            options.push(randomOption);
          }
        }
      }
    } else {
      // 如果没有足够的词语，添加一些通用选项
      const genericOptions = ['学习', '工作', '生活', '思考', '运动', '休息', '吃饭', '睡觉'];
      while (options.length < 4) {
        const randomOption = genericOptions[Math.floor(Math.random() * genericOptions.length)];
        if (!options.includes(randomOption)) {
          options.push(randomOption);
        }
      }
    }
    
    // 打乱选项顺序
    return this.shuffleArray(options);
  },

  /**
   * 打乱数组顺序
   */
  shuffleArray: function(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  /**
   * 判断选项是否为正确选项
   * 此函数将在wxml中被调用
   */
  isCorrectOption: function(option) {
    if (!this.data.showAnswer) return false;
    
    const word = this.data.currentWord;
    if (!word) return false;
    
    // 获取正确的拼音答案
    const correctAnswer = this.data.correctPinyinAnswer;
    console.log('检查选项是否正确:', option, '正确答案:', correctAnswer);
    return option === correctAnswer;
  },

  /**
   * 选择选项
   */
  selectOption: function(e) {
    if (this.data.showAnswer) return;
    
    const selectedOption = e.currentTarget.dataset.option;
    const selectedIndex = e.currentTarget.dataset.index;
    const isCorrect = this.checkOption(selectedOption, selectedIndex);
    
    // 获取全局应用实例
    const app = getApp();
    
    // 获取用户词语状态，用于记录先前的阶段
    const userWordStatus = app.globalData.wordStatus || {};
    // 确保使用正确的wordId，优先使用id，然后是_id，最后是word字段
    const wordId = this.data.currentWord.id || this.data.currentWord._id || this.data.currentWord.word;
    const previousStage = userWordStatus[wordId] ? userWordStatus[wordId].stage : 0;
    
    // 记录结果
    const results = [...this.data.results];
    results.push({
      wordId: wordId,
      isCorrect: isCorrect,
      previousStage: previousStage,
      word: this.data.currentWord,
      practiceType: this.data.practiceMode
    });
    
    this.setData({
      selectedOption,
      isCorrect,
      showAnswer: true,
      results
    });
    
    // 保存进度
    this.saveProgress();
  },

  /**
   * 检查选项是否正确
   */
  checkOption: function(option, index) {
    // 根据不同练习模式检查答案
    if (this.data.practiceMode === 'pinyin') {
      return this.checkPinyinOption(option, index);
    } else {
      return this.checkFillBlankOption(option);
    }
  },
  
  /**
   * 检查拼音选项是否正确
   */
  checkPinyinOption: function(option, index) {
    const word = this.data.currentWord;
    if (!word) return false;
    
    // 对于拼音题库数据
    if (word.options) {
      // 将索引转换为选项字母
      const optionLabel = ['A', 'B', 'C', 'D'][index];
      // 检查是否与答案匹配
      return word.answer === optionLabel;
    }
    
    // 获取正确的拼音答案
    const correctAnswer = this.data.correctPinyinAnswer;
    console.log('检查拼音选项是否正确:', option, '正确答案:', correctAnswer);
    return option === correctAnswer;
  },
  
  /**
   * 检查填空选项是否正确
   */
  checkFillBlankOption: function(option) {
    const word = this.data.currentWord;
    if (!word) return false;
    
    // 从fillBlank.answer获取正确答案，如果没有则使用词语本身
    const correctAnswer = (word.fillBlank && word.fillBlank.answer) 
                        ? word.fillBlank.answer 
                        : word.word;
    
    return option === correctAnswer;
  },

  /**
   * 播放发音
   */
  playPronunciation: function() {
    // 这里应该是播放当前词语的发音
    // 由于我们暂时没有音频资源，这里只显示一个提示
    wx.showToast({
      title: '播放发音',
      icon: 'none'
    });
  },

  /**
   * 显示下一个词语
   */
  nextWord: function() {
    try {
      // 获取当前词语
      const currentWord = this.data.currentWord;
      
      // 更新学习记录
      if (this.data.practiceMode === 'pinyin' && this.data.showAnswer) {
        const learningHistory = {...this.data.learningHistory};
        const isCorrect = this.data.isCorrect;
        const wordInfo = {
          word: currentWord.word,
          lastPracticed: new Date().toISOString(),
          correctCount: 0,
          incorrectCount: 0,
          reviewDue: this.calculateNextReviewTime(0, isCorrect)
        };
        
        // 检查词语是否已在学习记录中
        const existingWordIndex = learningHistory.completedWords.findIndex(w => w.word === currentWord.word);
        
        if (existingWordIndex >= 0) {
          // 更新已有记录
          const existingWord = learningHistory.completedWords[existingWordIndex];
          existingWord.lastPracticed = wordInfo.lastPracticed;
          if (isCorrect) {
            existingWord.correctCount = (existingWord.correctCount || 0) + 1;
          } else {
            existingWord.incorrectCount = (existingWord.incorrectCount || 0) + 1;
          }
          existingWord.reviewDue = this.calculateNextReviewTime(
            existingWord.correctCount, 
            isCorrect
          );
          learningHistory.completedWords[existingWordIndex] = existingWord;
          
          console.log('更新词语记录:', {
            word: existingWord.word,
            correctCount: existingWord.correctCount,
            incorrectCount: existingWord.incorrectCount,
            reviewDue: new Date(existingWord.reviewDue).toLocaleString()
          });
        } else {
          // 添加新记录
          if (isCorrect) {
            wordInfo.correctCount = 1;
          } else {
            wordInfo.incorrectCount = 1;
          }
          learningHistory.completedWords.push(wordInfo);
          
          console.log('添加新词语记录:', {
            word: wordInfo.word,
            correctCount: wordInfo.correctCount,
            incorrectCount: wordInfo.incorrectCount,
            reviewDue: new Date(wordInfo.reviewDue).toLocaleString()
          });
        }
        
        // 如果是复习阶段，从复习列表中移除已完成的词语
        if (learningHistory.stage === 2) {
          learningHistory.reviewWords = learningHistory.reviewWords.filter(w => w.word !== currentWord.word);
        }
        
        // 保存更新后的学习记录
        this.setData({ learningHistory });
        wx.setStorageSync('learningHistory', learningHistory);
      }
      
      // 更新完成数量
      if (this.data.practiceMode === 'pinyin') {
        // 更新拼音练习完成数
        this.setData({
          completedPinyinExercises: this.data.completedPinyinExercises + 1
        });
        
        // 检查是否已完成所有拼音练习
        if (this.data.completedPinyinExercises >= this.data.pinyinWords.length) {
          // 检查用户练习模式设置
          const userSettings = wx.getStorageSync('userSettings') || {};
          const practiceMode = userSettings.practiceMode || 'mixed';
          
          if (practiceMode === 'mixed') {
            console.log('拼音练习完成，切换到选词填空');
            this.setData({
              practiceMode: 'fillblank',
              currentExerciseWords: this.data.fillBlankWords
            });
          } else if (practiceMode === 'pinyin') {
            // 只练拼音模式，直接完成
            console.log('拼音练习完成，用户设置为只练拼音');
            // 这里应该结束练习
          }
        }
      } else {
        // 更新选词填空练习完成数
        this.setData({
          completedFillBlankExercises: this.data.completedFillBlankExercises + 1
        });
      }
      
      // 计算总完成练习数
      const totalCompletedExercises = this.data.completedPinyinExercises + this.data.completedFillBlankExercises;
      
      console.log('当前完成情况:', {
        completedPinyin: this.data.completedPinyinExercises,
        completedFillBlank: this.data.completedFillBlankExercises,
        totalCompleted: totalCompletedExercises,
        totalWords: this.data.totalWords
      });
      
      // 检查是否已经完成所有练习
      if (totalCompletedExercises >= this.data.totalWords) {
        console.log('所有练习已完成，准备提交结果', {
          resultsLength: this.data.results.length,
          totalWords: this.data.totalWords
        });
        
        try {
          // 获取全局应用实例
          const app = getApp();
          
          // 手动计算正确率
          let correctCount = 0;
          const totalCount = this.data.totalExercisesPerType * 2; // 固定为 7*2=14
          
          // 统计正确答案数量
          this.data.results.forEach(result => {
            if (result.isCorrect) {
              correctCount++;
            }
          });
          
          // 计算正确率
          const correctRate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
          
          const stats = {
            correctCount: correctCount,
            totalCount: totalCount,
            correctRate: correctRate
          };
          
          // 提交练习结果
          wordService.submitPracticeResults(app, this.data.results);
          
          console.log('练习结果提交成功', stats);
          
          // 保存用户数据
          app.saveUserData();
          
          // 上报练习结果到后台
          this.reportPracticeResults(stats);

          // 清除练习进度缓存
          wx.removeStorageSync('currentPracticeProgress');
          
          // 强制刷新首页数据
          this.refreshIndexPageData();
          
          // 显示完成页面
          this.setData({
            isCompleted: true,
            stats: {
              correct: correctCount,
              total: totalCount,
              percent: correctRate
            }
          });
          
          // 设置刷新标记，确保首页刷新数据
          wx.setStorageSync('needRefreshIndex', true);
          
          // 更新学习记录，检查是否需要进入复习阶段
          this.updateLearningStage();
          
        } catch (error) {
          console.error('提交练习结果失败', error);
          wx.showToast({
            title: '提交结果失败，请重试',
            icon: 'none'
          });
          
          // 显示一个基本的完成页面，避免用户卡在练习页
          this.setData({
            isCompleted: true,
            stats: {
              correct: 0,
              total: this.data.totalWords,
              percent: 0
            }
          });
        }
        
        return;
      }
      
      // 如果还有练习，加载下一个
      console.log('加载下一个练习', {
        completedPinyin: this.data.completedPinyinExercises,
        completedFillBlank: this.data.completedFillBlankExercises,
        currentMode: this.data.practiceMode
      });
      
      this.loadCurrentExercise();
      
    } catch (error) {
      console.error('处理下一个词语失败', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 计算下次复习时间
   * @param {Object|number} wordRecord 词语记录或正确次数
   * @param {boolean} isCorrect 本次是否正确
   * @returns {number|string} 下次复习时间的时间戳或ISO字符串
   */
  calculateNextReviewTime: function(wordRecord, isCorrect) {
    const now = new Date();
    let correctCount = 0;
    
    // 兼容两种调用方式
    if (typeof wordRecord === 'object' && wordRecord !== null) {
      correctCount = wordRecord.correctCount || 0;
    } else if (typeof wordRecord === 'number') {
      correctCount = wordRecord;
    }
    
    // 根据是否正确和正确次数计算下次复习时间
    if (!isCorrect) {
      // 错误答案：30分钟后复习
      return now.getTime() + (30 * 60 * 1000);
    } else {
      // 正确答案：根据正确次数增加间隔
      let daysToAdd = 1;
      
      switch (correctCount) {
        case 0: daysToAdd = 1; break;  // 第一次正确，1天后复习
        case 1: daysToAdd = 3; break;  // 第二次正确，3天后复习
        case 2: daysToAdd = 7; break;  // 第三次正确，7天后复习
        case 3: daysToAdd = 14; break; // 第四次正确，14天后复习
        case 4: daysToAdd = 30; break; // 第五次正确，30天后复习
        default: daysToAdd = 60; break; // 更多次正确，60天后复习
      }
      
      const nextTime = now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
      return nextTime;
    }
  },

  /**
   * 更新学习阶段
   */
  updateLearningStage: function() {
    const { learningHistory } = this.data;
    const now = new Date().getTime();
    
    // 检查是否有需要复习的词语（已到达复习时间的词汇）
    const wordsNeedingReview = learningHistory.completedWords.filter(word => {
      return word.reviewDue && word.reviewDue <= now;
    });
    
    console.log('需要复习的词汇数量:', wordsNeedingReview.length);
    
    if (wordsNeedingReview.length > 0) {
      // 有需要复习的词语，进入复习阶段
      this.setData({
        'learningHistory.stage': 2,
        'learningHistory.reviewWords': wordsNeedingReview,
        'learningHistory.lastReviewTime': now
      });
      console.log('进入复习阶段，需复习词汇:', wordsNeedingReview.map(w => w.word));
    } else if (learningHistory.stage === 2 && learningHistory.reviewWords.length === 0) {
      // 复习阶段已完成所有词语，返回学习阶段
      this.setData({
        'learningHistory.stage': 1,
        'learningHistory.lastReviewTime': now
      });
      console.log('复习完成，返回学习阶段');
    }
    
    // 保存更新后的学习记录
    this.saveLearningHistory();
  },

  /**
   * 强制刷新首页数据
   */
  refreshIndexPageData: function() {
    console.log('尝试刷新首页数据');
    
    // 设置刷新标记
    wx.setStorageSync('needRefreshIndex', true);
    
    // 尝试获取首页实例
    const pages = getCurrentPages();
    const indexPage = pages.find(page => page && page.__route__ && page.__route__ === 'pages/index/index');
    
    if (indexPage) {
      console.log('找到首页实例，直接刷新数据');
      // 直接调用首页的loadUserData方法
      try {
        indexPage.loadUserData();
        console.log('首页数据刷新成功');
      } catch (error) {
        console.error('刷新首页数据失败:', error);
      }
    } else {
      console.log('未找到首页实例，已设置刷新标记，返回首页时将自动刷新');
    }
    
    // 获取全局应用实例
    const app = getApp();
    
    // 打印当前学习进度，用于调试
    console.log('当前学习进度:', {
      totalWordsLearned: app.globalData.learningProgress.totalWordsLearned,
      dailyLearnedCount: app.globalData.learningProgress.dailyLearnedCount,
      currentSessionCount: app.globalData.learningProgress.currentSessionCount
    });
  },

  /**
   * 上报练习结果到后台
   */
  reportPracticeResults: function(stats) {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.studentId) return;
    
    // 获取全局应用实例
    const app = getApp();
    
    // 准备要上报的数据
    const reportData = {
      operation: 'savePracticeResults',  // 指定操作类型
      studentId: userInfo.studentId,
      name: userInfo.name,
      timestamp: new Date().toISOString(),
      practiceType: 'mixed', // 混合练习类型
      practiceResults: {
        pinyin: {
          total: this.data.totalExercisesPerType,
          completed: this.data.completedPinyinExercises
        },
        fillBlank: {
          total: this.data.totalExercisesPerType,
          completed: this.data.completedFillBlankExercises
        }
      },
      stats: {
        correct: stats.correctCount || 0,
        total: stats.totalCount || 0,
        correctRate: stats.correctRate || 0
      },
      wordResults: this.data.results.map(result => ({
        wordId: result.wordId,
        isCorrect: result.isCorrect,
        practiceType: result.practiceType || 'fillBlank'
      }))
    };
    
    // 调用云函数保存结果
    wx.cloud.callFunction({
      name: 'wordOperations',
      data: reportData
    }).then(res => {
      console.log('练习结果上报成功:', res);
    }).catch(err => {
      console.error('练习结果上报失败:', err);
    });
  },

  /**
   * 返回首页
   */
  goToIndex: function() {
    wx.navigateBack({
      delta: 1
    });
  },

  /**
   * 打乱拼音(简单示例)
   */
  shufflePinyin: function(pinyin) {
    // 实际应用中可能需要更复杂的逻辑来生成合理的错误拼音
    // 这里只是简单地替换声调或元音
    const tones = ['ā', 'á', 'ǎ', 'à', 'ō', 'ó', 'ǒ', 'ò', 'ē', 'é', 'ě', 'è', 'ī', 'í', 'ǐ', 'ì', 'ū', 'ú', 'ǔ', 'ù'];
    const normalVowels = ['a', 'o', 'e', 'i', 'u'];
    
    // 随机决定是替换声调还是替换元音
    if (Math.random() > 0.5) {
      // 替换声调
      const randomTone = tones[Math.floor(Math.random() * tones.length)];
      return pinyin.replace(/[āáǎàōóǒòēéěèīíǐìūúǔù]/, randomTone);
    } else {
      // 替换元音
      const randomVowel = normalVowels[Math.floor(Math.random() * normalVowels.length)];
      return pinyin.replace(/[aoeiu]/, randomVowel);
    }
  },

  /**
   * 加载学习历史记录
   */
  loadLearningHistory: function() {
    try {
      const history = wx.getStorageSync('learningHistory');
      if (history) {
        this.setData({
          learningHistory: history
        });
        console.log('加载学习历史记录成功', history);
      } else {
        console.log('未找到学习历史记录，使用初始值');
      }
    } catch (e) {
      console.error('加载学习历史记录失败', e);
    }
  },

  /**
   * 保存学习历史记录
   */
  saveLearningHistory: function() {
    try {
      wx.setStorageSync('learningHistory', this.data.learningHistory);
      console.log('保存学习历史记录成功', this.data.learningHistory);
    } catch (e) {
      console.error('保存学习历史记录失败', e);
    }
  },

  /**
   * 根据学习阶段筛选词汇
   */
  filterVocabularyByLearningStage: function() {
    const { learningHistory, pinyinWords } = this.data;
    let filteredWords = [];
    const now = new Date().getTime();
    
    // 确保pinyinWords是数组
    if (!Array.isArray(pinyinWords)) {
      console.error('pinyinWords不是数组:', pinyinWords);
      wx.showToast({
        title: '词汇数据格式错误',
        icon: 'none'
      });
      return;
    }
    
    if (learningHistory.stage === 1) { // 学习新词阶段
      // 筛选未学习的词汇
      filteredWords = pinyinWords.filter(word => 
        !learningHistory.completedWords.some(item => item.word === word.word)
      );
      
      if (filteredWords.length === 0) {
        // 检查是否有需要复习的词汇
        const wordsNeedingReview = learningHistory.completedWords.filter(word => 
          word.reviewDue && word.reviewDue <= now
        );
        
        if (wordsNeedingReview.length > 0) {
          // 有需要复习的词汇，转入复习阶段
          this.setData({
            'learningHistory.stage': 2,
            'learningHistory.reviewWords': wordsNeedingReview,
            'learningHistory.lastReviewTime': now
          });
          this.saveLearningHistory();
          return this.filterVocabularyByLearningStage(); // 递归调用，使用更新后的学习阶段
        } else {
          // 没有新词可学，也没有需要复习的词汇
          wx.showToast({
            title: '您已学习完所有词汇，请等待复习时间',
            icon: 'none',
            duration: 2000
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
          return;
        }
      }
    } else { // 复习阶段
      // 更新需要复习的词汇列表（已到达复习时间的词汇）
      const wordsNeedingReview = learningHistory.completedWords.filter(word => 
        word.reviewDue && word.reviewDue <= now
      );
      
      this.setData({
        'learningHistory.reviewWords': wordsNeedingReview
      });
      
      // 使用待复习的词汇
      filteredWords = pinyinWords.filter(word => 
        learningHistory.reviewWords.some(item => item.word === word.word)
      );
      
      if (filteredWords.length === 0) {
        // 如果没有词需要复习，转回学习新词阶段
        this.setData({
          'learningHistory.stage': 1,
          'learningHistory.lastReviewTime': now
        });
        this.saveLearningHistory();
        
        // 检查是否还有未学习的词汇
        const newWords = pinyinWords.filter(word => 
          !learningHistory.completedWords.some(item => item.word === word.word)
        );
        
        if (newWords.length > 0) {
          return this.filterVocabularyByLearningStage(); // 递归调用，使用更新后的学习阶段
        } else {
          // 没有新词可学，也没有需要复习的词汇
          wx.showToast({
            title: '您已学习完所有词汇，请等待复习时间',
            icon: 'none',
            duration: 2000
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
          return;
        }
      }
    }
    
    // 随机排序筛选后的词汇
    filteredWords = this.shuffleArray(filteredWords);
    
    // 限制练习数量
    const maxExercises = Math.min(filteredWords.length, 10);
    filteredWords = filteredWords.slice(0, maxExercises);
    
    this.setData({
      exercises: filteredWords,
      totalExercises: filteredWords.length
    });
    
    // 加载第一个练习
    if (filteredWords.length > 0) {
      this.loadCurrentExercise();
    }
  },

  /**
   * 完成所有练习
   */
  completeAllExercises: function() {
    // 计算正确率
    const { stats } = this.data;
    const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    
    this.setData({
      isCompleted: true,
      'stats.percent': percent
    });
    
    console.log('所有练习已完成', this.data.stats);
    
    // 保存学习历史记录
    this.saveLearningHistory();
  }
})