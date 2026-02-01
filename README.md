# 词境通 - 汉语词汇学习小程序

> 作者: **dts** | 开源协议: MIT

基于**艾宾浩斯记忆曲线**的微信小程序，帮助用户高效学习和记忆汉语词汇。

![WeChat](https://img.shields.io/badge/WeChat-Mini%20Program-07C160?logo=wechat)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 功能特性

- **艾宾浩斯记忆法** - 科学复习调度，提高记忆效率
- **双模式学习** - 学习模式 + 练习模式
- **智能分组** - 每组7词，新词+复习词混合
- **数据统计** - 学习曲线、阶段分布可视化
- **AI助手** - DeepSeek驱动的智能学习辅助
- **管理后台** - 词库管理、学生数据管理

## 技术栈

- **前端**: 微信小程序原生开发
- **后端**: 微信云开发 (云函数 + 云数据库)
- **AI**: DeepSeek API

## 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/dts-gxu/CiJingTong.git
```

### 2. 导入微信开发者工具
- 打开微信开发者工具
- 导入项目，选择项目目录
- 填入自己的 AppID

### 3. 配置云开发
- 开通云开发环境
- 在云开发控制台创建数据库集合
- 部署云函数

### 4. 配置环境变量
在云函数环境变量中设置：
```
DEEPSEEK_API_KEY=你的API密钥
ADMIN_PASSWORD=管理员密码
```

## 项目结构

```
├── app.js              # 小程序入口
├── app.json            # 全局配置
├── app.wxss            # 全局样式
├── pages/              # 页面文件
├── services/           # 服务层
├── utils/              # 工具函数
├── cloudfunctions/     # 云函数
└── data/               # 静态数据
```

## License

MIT License

## 作者

**dts** 

---

如果觉得这个项目对你有帮助，请给一个 Star！
