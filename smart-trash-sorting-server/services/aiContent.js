/**
 * AI内容生成服务 — 复用SiliconFlow API，纯文本提示词生成
 * 用于辅助管理员撰写分类知识、常见误区、每日环保小知识等内容
 */
const axios = require('axios');

const AI_CONFIG = {
  apiUrl: process.env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY || ''
};

// 文本生成优先使用纯文本模型，避免浪费视觉模型资源
const getTextModelCandidates = () => {
  const envModel = (process.env.SILICONFLOW_TEXT_MODEL || '').trim();
  const candidates = envModel ? [envModel] : [];
  // 回退到视觉模型（它们也能做文本生成）
  candidates.push(
    'Qwen/Qwen2.5-7B-Instruct',
    'Qwen/Qwen2.5-VL-7B-Instruct'
  );
  return candidates;
};

const CATEGORY_PROMPTS = {
  knowledge: {
    system: '你是垃圾分类科普专家。请根据用户提供的主题，撰写一篇垃圾分类知识科普文章。',
    instruction: '请为以下主题撰写一篇垃圾分类知识文章，包含：定义说明、主要分类物品、投放提示。语言通俗易懂，适合普通市民阅读。',
    outputFormat: '严格只输出JSON，格式：{"title":"文章标题","summary":"50字以内摘要","content":"正文内容，可包含换行符\\n"}'
  },
  mistake: {
    system: '你是垃圾分类科普专家。请根据用户提供的主题，撰写一条常见的垃圾分类误区解析。',
    instruction: '请为以下主题撰写一条垃圾分类常见误区解析，先说明错误认知，再给出正确解释和判断方法。',
    outputFormat: '严格只输出JSON，格式：{"title":"误区标题（问句形式）","summary":"50字以内摘要","content":"详细解析内容，可包含换行符\\n"}'
  },
  daily_tip: {
    system: '你是环保知识科普专家。请根据用户提供的主题，撰写一条简短的每日环保小知识。',
    instruction: '请为以下主题撰写一条每日环保小知识，包含一个引人注意的事实和简短的行动建议。控制在200字以内。',
    outputFormat: '严格只输出JSON，格式：{"title":"标题（简洁有力）","summary":"一句话概括","content":"完整内容"}'
  },
  news: {
    system: '你是环保资讯编辑。请根据用户提供的主题，撰写一篇环保相关的资讯文章。',
    instruction: '请为以下主题撰写一篇环保资讯文章，内容真实可信，语言正式。',
    outputFormat: '严格只输出JSON，格式：{"title":"文章标题","summary":"100字以内摘要","content":"正文内容，可包含换行符\\n"}'
  }
};

/**
 * 通过AI生成内容
 * @param {string} category - 内容类别: knowledge/mistake/daily_tip/news
 * @param {string} topic - 用户提供的主题/关键词
 * @returns {object} { success, data: { title, summary, content }, error }
 */
async function generateContent(category, topic) {
  if (!AI_CONFIG.apiKey) {
    return { success: false, error: 'AI服务未配置密钥', code: 'AI_KEY_MISSING' };
  }

  const promptConfig = CATEGORY_PROMPTS[category];
  if (!promptConfig) {
    return { success: false, error: '不支持的内容类别', code: 'INVALID_CATEGORY' };
  }

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return { success: false, error: '请提供内容主题', code: 'EMPTY_TOPIC' };
  }

  const systemPrompt = `${promptConfig.system}\n\n${promptConfig.outputFormat}`;
  const userPrompt = `${promptConfig.instruction}\n\n主题：${topic.trim()}`;

  const modelCandidates = getTextModelCandidates();

  for (let i = 0; i < modelCandidates.length; i++) {
    const model = modelCandidates[i];
    try {
      const response = await axios.post(
        `${AI_CONFIG.apiUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          timeout: 60000,
          headers: {
            Authorization: `Bearer ${AI_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const rawContent = response?.data?.choices?.[0]?.message?.content || '';
      const parsed = parseGeneratedJson(rawContent);

      if (parsed && parsed.title) {
        return {
          success: true,
          data: {
            title: String(parsed.title).trim(),
            summary: String(parsed.summary || '').trim(),
            content: String(parsed.content || '').trim()
          }
        };
      }

      // 如果解析失败但有原始文本，作为content返回
      if (rawContent.trim()) {
        return {
          success: true,
          data: {
            title: topic.trim(),
            summary: '',
            content: rawContent.trim()
          }
        };
      }
    } catch (error) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error.message || '';
      console.warn(`AI文本生成失败 (model=${model}):`, { status, msg });

      // 可重试的错误，尝试下一个模型
      if (i < modelCandidates.length - 1 && (status === 429 || status >= 500 || error.code === 'ECONNABORTED')) {
        continue;
      }

      return {
        success: false,
        error: `AI生成失败: ${msg}`,
        code: 'AI_GENERATE_FAILED'
      };
    }
  }

  return { success: false, error: 'AI生成失败：所有模型均不可用', code: 'AI_ALL_MODELS_FAILED' };
}

function parseGeneratedJson(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;

  // 提取 JSON 代码块
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1] : rawText;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const raw = jsonMatch[0];
  try {
    return JSON.parse(raw);
  } catch (e) {
    // 尝试修复常见问题
    const fixed = raw
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      return null;
    }
  }
}

module.exports = {
  generateContent,
  CATEGORY_PROMPTS
};
