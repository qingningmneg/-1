const fs = require('fs');
const path = require('path');
const { parseQuestions } = require('../server');

const sample = `# 2021年05月 系统集成项目管理工程师 —— 考题+答案+解析

## 第1题

**关于区块链的描述，不正确的是：( )。**

A.区块链的共识机制可有效防止记账节点信息被篡改
B.区块链可在不可信的网络进行可信的信息交换
C.存储在区块链的交易信息是高度加密的
D.区块链是一个分布式共享账本和数据库

**答案：C**

**解析：**
- 示例解析
`;
const qs = parseQuestions(sample, { id: 'SAMPLE', title: 'sample.md' });
if (qs.length !== 1) throw new Error(`expected 1 question, got ${qs.length}`);
if (qs[0].answer !== 'C') throw new Error('answer parse failed');
if (qs[0].options.length !== 4) throw new Error(`options parse failed: ${qs[0].options.length}`);
console.log('parser ok', qs[0]);
